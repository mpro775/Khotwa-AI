import { bank } from "./ph09-fixtures.mjs";
import assert from "node:assert/strict";
import { request as httpsRequest } from "node:https";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const metadata = JSON.parse(readFileSync(".local/mvp-local.json", "utf8")),
  base = new URL(metadata.url),
  ca = readFileSync(".local/mvp-tls/cert.pem");
assert.equal(base.protocol, "https:");
assert.equal(base.hostname, "localhost");
assert.equal(base.username, "");
assert.equal(base.password, "");
const jar = new Map(),
  checks = [];
const timings = [];
let csrf;
async function call(
  path,
  method = "GET",
  body,
  key = randomUUID(),
  origin = base.origin,
) {
  const started = performance.now();
  const headers = { origin };
  if (jar.size)
    headers.cookie = [...jar].map(([k, v]) => k + "=" + v).join("; ");
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  if (method !== "GET")
    Object.assign(headers, {
      "content-type": "application/json",
      "x-csrf-token": csrf ?? "",
      "idempotency-key": key,
    });
  if (payload) headers["content-length"] = payload.length;
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      new URL(path, base),
      { method, headers, ca, servername: "localhost", timeout: 30000 },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          timings.push(performance.now() - started);
          const text = Buffer.concat(chunks).toString("utf8");
          for (const value of res.headers["set-cookie"] ?? []) {
            const [k, v] = value.split(";")[0].split("=");
            if (v) jar.set(k, v);
            else jar.delete(k);
          }
          resolve({
            status: res.statusCode,
            text,
            body: res.headers["content-type"]?.includes("application/json")
              ? JSON.parse(text)
              : null,
            headers: res.headers,
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("HTTPS request timeout")));
    req.on("error", reject);
    req.end(payload);
  });
}
const home = await call("/");
assert.equal(home.status, 200);
assert.ok(home.text.includes('id="root"'));
assert.equal(
  home.headers["content-security-policy"].includes("unsafe-eval"),
  false,
);
checks.push(
  "HTTPS page and strict CSP with pinned local CA; verification remains enabled",
);
let r = await call("/api/v1/bootstrap");
assert.equal(r.status, 200);
csrf = r.body.data.csrfToken;
r = await call("/api/v1/guest-sessions", "POST", {});
assert.equal(r.status, 201);
csrf = r.body.data.csrfToken;
for (const flag of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/"])
  assert.ok(r.headers["set-cookie"][0].includes(flag));
assert.equal(r.headers["set-cookie"][0].includes("Domain="), false);
checks.push("real TLS guest bootstrap, CSRF and secured host-only cookie");
const learning = (await call("/api/v1/learning-sessions", "POST", {})).body
  .data;
assert.equal(learning.isSynthetic, true);
const skills = (await call("/api/v1/skills")).body.data.items;
const catalog = (await call("/api/v1/problems?skillId=" + skills[0].id)).body
  .data.items;
let problem;
for (const p of catalog) {
  const detail = (await call("/api/v1/problems/" + p.id)).body.data;
  assert.equal(JSON.stringify(detail).includes("PH09_SERVER_ONLY_KEY"), false);
  if (detail.originalEquation === "٢(س + ٣) = ١٠") problem = detail;
}
assert.ok(problem);
checks.push("live published synthetic catalog, no answer specification");
const attempt = (
  await call("/api/v1/attempts", "POST", {
    learningSessionId: learning.id,
    source: { kind: "catalog", problemRevisionId: problem.revisionId },
  })
).body.data;
const first = await call(`/api/v1/attempts/${attempt.id}/steps`, "POST", {
  expectedRevision: 0,
  position: 1,
  sourceRaw: "٢س + ٦ = ١٠",
  inputOrigin: "math_editor",
});
assert.equal(first.status, 201);
const intermediate = await call(
  `/api/v1/attempts/${attempt.id}/verify`,
  "POST",
  { expectedRevision: 1, scope: "current_sequence", targetStepId: null },
);
assert.equal(intermediate.status, 200);
assert.equal(intermediate.body.data.completion.canMarkAttemptCompleted, false);
await call(`/api/v1/attempts/${attempt.id}/steps`, "POST", {
  expectedRevision: 1,
  position: 2,
  sourceRaw: "س = ٢",
  inputOrigin: "keyboard",
});
const key = randomUUID(),
  body = { expectedRevision: 2, scope: "current_sequence", targetStepId: null };
const final = await call(
  `/api/v1/attempts/${attempt.id}/verify`,
  "POST",
  body,
  key,
);
assert.equal(final.status, 200);
assert.equal(final.body.data.completion.canMarkAttemptCompleted, true);
checks.push(
  "HTTPS → nginx → NestJS → PostgreSQL → real Python → verified chain completion",
);
const retry = await call(
  `/api/v1/attempts/${attempt.id}/verify`,
  "POST",
  body,
  key,
);
assert.equal(retry.status, 200);
assert.deepEqual(retry.body.data, final.body.data);
checks.push("HTTPS verification retry reuses the same result");
const diagnosticAttempt = (
  await call("/api/v1/attempts", "POST", {
    learningSessionId: learning.id,
    source: { kind: "catalog", problemRevisionId: problem.revisionId },
  })
).body.data;
await call(`/api/v1/attempts/${diagnosticAttempt.id}/steps`, "POST", {
  expectedRevision: 0,
  position: 1,
  sourceRaw: "٢س + ٣ = ١٠",
  inputOrigin: "math_editor",
});
const observed = await call(
  `/api/v1/attempts/${diagnosticAttempt.id}/verify`,
  "POST",
  {
    expectedRevision: 1,
    scope: "current_sequence",
    targetStepId: null,
  },
);
assert.equal(observed.status, 200);
assert.equal(observed.body.data.diagnosisCandidate.state, "needs_probe");
assert.equal(observed.body.data.diagnosisCandidate.errorCode, "ERR-ALG-01");
const question = await call(
  `/api/v1/attempts/${diagnosticAttempt.id}/probes`,
  "POST",
  {
    expectedRevision: 1,
    verificationResultId:
      observed.body.data.transitions[0].verificationResultId,
  },
);
assert.equal(question.status, 201);
assert.equal(JSON.stringify(question.body.data).includes("supports"), false);
assert.equal(JSON.stringify(question.body.data).includes("rules_json"), false);
checks.push(
  "HTTPS pinned invalid-edge hypothesis and private-key-free diagnostic probe",
);
const unknown = question.body.data.options.find((o) => o.labelAr === "لا أدري");
assert.ok(unknown);
const answerKey = randomUUID(),
  answerBody = {
    expectedRevision: 1,
    answer: { kind: "choice", optionId: unknown.id },
  };
const evaluated = await call(
  `/api/v1/attempts/${diagnosticAttempt.id}/probes/${question.body.data.id}/responses`,
  "POST",
  answerBody,
  answerKey,
);
assert.equal(evaluated.status, 201);
assert.equal(evaluated.body.data.evaluation, "unclear");
assert.equal(evaluated.body.data.diagnosis.state, "unresolved");
const answeredAgain = await call(
  `/api/v1/attempts/${diagnosticAttempt.id}/probes/${question.body.data.id}/responses`,
  "POST",
  answerBody,
  answerKey,
);
assert.deepEqual(answeredAgain.body.data, evaluated.body.data);
checks.push("HTTPS uncertain answer remains unresolved and idempotent");
await call(`/api/v1/attempts/${diagnosticAttempt.id}/steps`, "POST", {
  expectedRevision: 1,
  position: 2,
  sourceRaw: "س = ٢",
  inputOrigin: "keyboard",
});
assert.equal(
  (
    await call(
      `/api/v1/attempts/${diagnosticAttempt.id}/probes/${question.body.data.id}/responses`,
      "POST",
      answerBody,
      answerKey,
    )
  ).status,
  409,
);
checks.push("HTTPS stale probe-answer replay rejected after revision change");
const guided = (
  await call("/api/v1/attempts", "POST", {
    learningSessionId: learning.id,
    source: { kind: "catalog", problemRevisionId: problem.revisionId },
  })
).body.data;
const savedWrong = await call(`/api/v1/attempts/${guided.id}/steps`, "POST", {
  expectedRevision: 0,
  position: 1,
  sourceRaw: "٢س + ٣ = ١٠",
  inputOrigin: "math_editor",
});
assert.equal(savedWrong.status, 201);
assert.equal(
  (
    await call(`/api/v1/attempts/${guided.id}/verify`, "POST", {
      expectedRevision: 1,
      scope: "current_sequence",
      targetStepId: null,
    })
  ).status,
  200,
);
const hintKey = randomUUID(),
  hintBody = { expectedRevision: 1, action: "next_hint" };
const firstHint = await call(
  `/api/v1/attempts/${guided.id}/hints`,
  "POST",
  hintBody,
  hintKey,
);
assert.equal(firstHint.status, 200);
assert.equal(firstHint.body.data.hintLevel, "H1");
assert.equal(firstHint.body.data.generationSource, "manual");
assert.equal(firstHint.body.data.independentEvidenceEligible, false);
assert.deepEqual(
  (await call(`/api/v1/attempts/${guided.id}/hints`, "POST", hintBody, hintKey))
    .body.data,
  firstHint.body.data,
);
for (const level of ["H2", "H3"])
  assert.equal(
    (await call(`/api/v1/attempts/${guided.id}/hints`, "POST", hintBody)).body
      .data.hintLevel,
    level,
  );
checks.push(
  "HTTPS authored H1/H2/H3, real partial-math checks and idempotency; no external AI claimed",
);
assert.equal(
  (
    await call(`/api/v1/attempts/${guided.id}/hints`, "POST", {
      expectedRevision: 1,
      action: "show_full_solution",
    })
  ).status,
  422,
);
const solution = await call(`/api/v1/attempts/${guided.id}/hints`, "POST", {
  expectedRevision: 1,
  action: "show_full_solution",
  confirmAssistedCompletion: true,
});
assert.equal(solution.status, 200);
assert.equal(solution.body.data.hintLevel, "H4");
assert.equal(solution.body.data.solutionStepsAr.at(-1), "س = ٢");
checks.push("HTTPS explicit H4 confirmation and verified solution");
const corrected = await call(
  `/api/v1/attempts/${guided.id}/steps/${savedWrong.body.data.step.id}`,
  "PUT",
  { expectedRevision: 1, sourceRaw: "س = ٢", inputOrigin: "math_editor" },
);
assert.equal(corrected.status, 200);
assert.equal(
  (
    await call(`/api/v1/attempts/${guided.id}/verify`, "POST", {
      expectedRevision: 2,
      scope: "current_sequence",
      targetStepId: null,
    })
  ).body.data.completion.canMarkAttemptCompleted,
  true,
);
assert.equal(
  (await call(`/api/v1/attempts/${guided.id}`)).body.data.status,
  "assisted_completed",
);
assert.equal(
  (await call(`/api/v1/attempts/${guided.id}/hints`, "POST", hintBody, hintKey))
    .status,
  409,
);
checks.push(
  "HTTPS durable assisted completion and rejection of old hint replay after edit",
);

const episodeResult = await call(
  `/api/v1/attempts/${guided.id}/remediation`,
  "POST",
  { expectedRevision: 2 },
);
assert.equal(episodeResult.status, 201, JSON.stringify(episodeResult.body));
const episode = episodeResult.body.data,
  rem = episode.assignments.at(-1);
assert.equal(rem.phase, "remediation");
assert.equal(
  episode.assignments.some((x) => x.phase === "transfer"),
  false,
);
for (const [eq] of bank[0].transfer)
  assert.equal(JSON.stringify(episode).includes(eq), false);
checks.push(
  "HTTPS single-skill remediation assignment without premature transfer disclosure",
);
async function assigned(x) {
  const r = await call("/api/v1/attempts", "POST", {
    learningSessionId: learning.id,
    source: { kind: "assignment", assignmentId: x.id },
  });
  assert.equal(r.status, 201);
  return r.body.data;
}
async function solve(at, equation) {
  const solution = bank
    .flatMap((w) => [[w.root, w.solution], ...w.rem, ...w.transfer])
    .find(([eq]) => eq === equation)[1];
  const saved = await call(`/api/v1/attempts/${at.id}/steps`, "POST", {
    expectedRevision: 0,
    position: 1,
    sourceRaw: solution,
    inputOrigin: "math_editor",
  });
  assert.equal(saved.status, 201);
  const verified = await call(`/api/v1/attempts/${at.id}/verify`, "POST", {
    expectedRevision: 1,
    scope: "current_sequence",
    targetStepId: null,
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.equal(verified.body.data.completion.canMarkAttemptCompleted, true);
  return verified.body.data;
}
const remAttempt = await assigned(rem);
assert.equal(
  (
    await call(`/api/v1/attempts/${remAttempt.id}/hints`, "POST", {
      expectedRevision: 0,
      action: "show_full_solution",
      confirmAssistedCompletion: true,
    })
  ).status,
  200,
);
await solve(remAttempt, rem.problem.originalEquation);
checks.push(
  "HTTPS real authored H4 on remediation and verified assisted completion",
);
const transferResult = await call(
  `/api/v1/attempts/${guided.id}/transfer`,
  "POST",
  { expectedRevision: 2, episodeId: episode.id },
);
assert.equal(transferResult.status, 201, JSON.stringify(transferResult.body));
const tx = transferResult.body.data.assignments.at(-1);
assert.equal(tx.phase, "transfer");
assert.equal(tx.assistancePolicy, "independent");
assert.notEqual(tx.problem.originalEquation, rem.problem.originalEquation);
const txAttempt = await assigned(tx),
  txReport = await solve(txAttempt, tx.problem.originalEquation);
assert.ok(txReport.transitions.every((t) => t.evidence === null));
assert.equal(txReport.diagnosisCandidate, null);
checks.push(
  "HTTPS structurally different unseen transfer with solution-bearing public proofs withheld",
);
let currentProgress = (
  await call("/api/v1/progress?learningSessionId=" + learning.id)
).body.data;
let target = currentProgress.skills.find((s) => s.skillId === episode.skillId);
assert.equal(target.independentTransferCount, 1);
assert.equal(target.assistedPracticeCount, 1);
assert.equal(target.state, "new_evidence_of_understanding");
checks.push(
  "HTTPS limited current evidence distinguishes assisted training from independent transfer",
);
const txHelp = await call(`/api/v1/attempts/${txAttempt.id}/hints`, "POST", {
  expectedRevision: 1,
  action: "show_full_solution",
  confirmAssistedCompletion: true,
});
assert.equal(txHelp.status, 200, JSON.stringify(txHelp.body));
assert.equal(
  (
    await call("/api/v1/progress?learningSessionId=" + learning.id)
  ).body.data.skills.find((s) => s.skillId === episode.skillId)
    .independentTransferCount,
  0,
);
assert.equal(
  (await call(`/api/v1/attempts/${txAttempt.id}`)).body.data.status,
  "assisted_completed",
);
checks.push(
  "HTTPS explicit transfer help leaves measurement and immediately revokes independent evidence",
);
const replacement = await call(
  `/api/v1/attempts/${guided.id}/transfer`,
  "POST",
  { expectedRevision: 2, episodeId: episode.id },
);
assert.equal(replacement.status, 201, JSON.stringify(replacement.body));
assert.notEqual(
  replacement.body.data.assignments.at(-1).problemRevisionId,
  tx.problemRevisionId,
);
checks.push(
  "HTTPS replacement measurement uses fresh content after assisted transfer",
);
assert.equal(
  (
    await call(
      `/api/v1/attempts/${guided.id}/steps/${savedWrong.body.data.step.id}`,
      "PUT",
      { expectedRevision: 2, sourceRaw: "س = ٩٩", inputOrigin: "keyboard" },
    )
  ).status,
  200,
);
const cancelled = (await call("/api/v1/learning-episodes/" + episode.id)).body
  .data;
assert.equal(cancelled.state, "cancelled");
assert.deepEqual(cancelled.assignments, []);
checks.push(
  "HTTPS root editing invalidates current episode assignments and derived evidence",
);
const rejected = await call(
  `/api/v1/attempts/${attempt.id}/verify`,
  "POST",
  body,
  randomUUID(),
  "https://untrusted.invalid",
);
assert.equal(rejected.status, 403);
assert.equal(rejected.body.error.code, "csrf_invalid");
checks.push("cross-origin HTTPS mutation rejected");
assert.equal((await call("/internal/health/live")).status, 403);
checks.push("private paths blocked by public proxy");

const teacherPage = await call("/demo/teacher");
assert.equal(teacherPage.status, 200);
assert.equal(
  teacherPage.headers["content-security-policy"].includes("unsafe-eval"),
  false,
);
checks.push(
  "HTTPS teacher SPA entry serves with strict CSP; browser rendering remains a separate pending check",
);
const teacher = await call("/api/v1/teacher-demo/summary");
assert.equal(teacher.status, 200);
assert.equal(teacher.body.data.isSynthetic, true);
assert.equal(teacher.body.data.sampleStudentCount, 8);
assert.equal(teacher.body.data.sampleAttemptCount, 12);
const metrics = Object.fromEntries(
  teacher.body.data.metrics.map((m) => [m.code, m.count]),
);
assert.equal(metrics.evaluable_attempts, 8);
assert.equal(metrics.non_assessable_attempts, 4);
assert.equal(metrics.verified_invalid_attempts, 3);
checks.push(
  "HTTPS teacher sample and all card counts derive from the fixed twelve-row synthetic artifact",
);
for (const id of teacher.body.data.exampleIds) {
  const ex = await call("/api/v1/teacher-demo/examples/" + id);
  assert.equal(ex.status, 200);
  assert.equal(ex.body.data.isSynthetic, true);
  assert.equal(ex.body.data.datasetCode, teacher.body.data.datasetCode);
  assert.equal(ex.body.data.mathStatus, "verified_invalid");
  assert.equal(ex.text.includes(guided.id), false);
  assert.equal(ex.text.includes("PH09_SERVER_ONLY_KEY"), false);
}
checks.push(
  "HTTPS fixed teacher examples stay synthetic and separate from saved guest attempts and answer specifications",
);
assert.equal(
  (await call("/api/v1/teacher-demo/examples/" + guided.id)).status,
  404,
);
assert.equal(
  (await call("/api/v1/teacher-demo/summary?learningSessionId=" + learning.id))
    .status,
  404,
);
checks.push(
  "HTTPS teacher endpoints reject real resource identifiers and source-switching parameters",
);
const firstJar = [...jar],
  firstCsrf = csrf;
jar.clear();
assert.equal((await call("/api/v1/teacher-demo/summary")).status, 401);
checks.push("HTTPS teacher summary requires an authenticated guest");
csrf = (await call("/api/v1/bootstrap")).body.data.csrfToken;
const secondGuest = await call("/api/v1/guest-sessions", "POST", {});
assert.equal(secondGuest.status, 201);
csrf = secondGuest.body.data.csrfToken;
assert.equal(
  (await call("/api/v1/progress?learningSessionId=" + learning.id)).status,
  404,
);
assert.deepEqual(
  (await call("/api/v1/teacher-demo/summary")).body.data,
  teacher.body.data,
);
checks.push(
  "HTTPS another guest sees the same fixed demo but cannot read the prior guest progress",
);
jar.clear();
for (const [k, v] of firstJar) jar.set(k, v);
csrf = firstCsrf;
// J-03: a different equivalent route, including a reversed final equality.
const alternative = (
  await call("/api/v1/attempts", "POST", {
    learningSessionId: learning.id,
    source: { kind: "catalog", problemRevisionId: problem.revisionId },
  })
).body.data;
for (const [index, raw] of ["س + ٣ = ٥", "٢ = س"].entries()) {
  assert.equal(
    (
      await call(`/api/v1/attempts/${alternative.id}/steps`, "POST", {
        expectedRevision: index,
        position: index + 1,
        sourceRaw: raw,
        inputOrigin: "keyboard",
      })
    ).status,
    201,
  );
}
const alternativeReport = await call(
  `/api/v1/attempts/${alternative.id}/verify`,
  "POST",
  {
    expectedRevision: 2,
    scope: "current_sequence",
    targetStepId: null,
  },
);
assert.ok(
  alternativeReport.body.data.transitions.every(
    (t) => t.mathStatus === "verified_valid",
  ),
);
assert.equal(
  alternativeReport.body.data.completion.canMarkAttemptCompleted,
  true,
);
checks.push(
  "QA-E2E-J03: equivalent alternative route and reversed equality on actual HTTPS",
);
// J-04: unsupported content stays non-assessable and cannot decrement evidence.
const unsupported = (
  await call("/api/v1/attempts", "POST", {
    learningSessionId: learning.id,
    source: { kind: "catalog", problemRevisionId: problem.revisionId },
  })
).body.data;
await call(`/api/v1/attempts/${unsupported.id}/steps`, "POST", {
  expectedRevision: 0,
  position: 1,
  sourceRaw: "جا(س) = ١",
  inputOrigin: "keyboard",
});
const unsupportedReport = await call(
  `/api/v1/attempts/${unsupported.id}/verify`,
  "POST",
  {
    expectedRevision: 1,
    scope: "current_sequence",
    targetStepId: null,
  },
);
assert.equal(
  unsupportedReport.body.data.transitions[0].mathStatus,
  "unsupported",
);
assert.equal(unsupportedReport.body.data.diagnosisCandidate, null);
checks.push(
  "QA-E2E-J04: unsupported trigonometry has no diagnosis or false verdict on actual HTTPS",
);
timings.sort((a, b) => a - b);
const result = {
  phase: "MVP-CLOSURE",
  runId: randomUUID(),
  url: base.origin,
  recordedAt: new Date().toISOString(),
  passed: checks.length,
  checks,
  tls: {
    certificateValidation: true,
    explicitTestCa: true,
    globalTrustStoreChanged: false,
    browserAcceptance: "separate manual certificate handoff required",
  },
  syntheticOnly: true,
  externalAiEnabled: false,
  actualLlmInferences: 0,
  performance: {
    scope: "sequential synthetic HTTPS journey on this desktop; no load test",
    samples: timings.length,
    p50Ms: timings[Math.ceil(timings.length * 0.5) - 1],
    p95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
  },
  journeys: Object.fromEntries(
    ["J-01", "J-02", "J-03", "J-04", "J-05"].map((id) => [
      id,
      {
        api: "PASS",
        reactChrome: "NOT_RUN",
        contentAcceptance: "pending review beyond PH08 cards",
      },
    ]),
  ),
};
writeFileSync(
  "qa-reports/mvp-demo/https-results.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: checks.length,
    url: base.origin,
    scope: "actual TLS with local CA pinned only for this probe; real Python",
  }),
);
