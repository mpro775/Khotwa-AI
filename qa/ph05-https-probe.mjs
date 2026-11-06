import assert from "node:assert/strict";
import { request as httpsRequest } from "node:https";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const metadata = JSON.parse(readFileSync(".local/ph05-local.json", "utf8")),
  base = new URL(metadata.url),
  ca = readFileSync(".local/ph05-tls/cert.pem");
assert.equal(base.protocol, "https:");
assert.equal(base.hostname, "localhost");
assert.equal(base.username, "");
assert.equal(base.password, "");
const jar = new Map(),
  checks = [];
let csrf;
async function call(
  path,
  method = "GET",
  body,
  key = randomUUID(),
  origin = base.origin,
) {
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
  assert.equal(JSON.stringify(detail).includes("PH05_SERVER_ONLY_KEY"), false);
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
const result = {
  phase: "PH-05",
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
};
writeFileSync(
  "qa-reports/ph05-https-results.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: checks.length,
    url: base.origin,
    scope: "actual TLS with local CA pinned only for this probe; real Python",
  }),
);
