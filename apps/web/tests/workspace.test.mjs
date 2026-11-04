import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  canAdoptVerification,
  statusLabels,
} = require("../../../.local/ph05-web-tests/apps/web/src/workspace-model.js");
const {
  ApiClient,
  ClientFault,
} = require("../../../.local/ph05-web-tests/apps/web/src/api-client.js");
const meta = () => ({
  requestId: randomUUID(),
  serverTime: new Date().toISOString(),
  apiVersion: "1",
});
const report = () => ({
  id: randomUUID(),
  attemptId: randomUUID(),
  attemptRevision: 2,
  problemRevisionId: randomUUID(),
  scope: "current_sequence",
  isCurrent: true,
  transitions: [],
  firstBlockingTransitionIndex: null,
  completion: {
    state: "unknown",
    canMarkAttemptCompleted: false,
    explanationAr: "لم يثبت اكتمال الحل.",
  },
  diagnosisCandidate: null,
});
test("UI rejects late results after local edits, server revisions, resource changes or replaced step versions", () => {
  const result = report(),
    step = { id: randomUUID(), currentVersion: 1 };
  result.transitions = [
    {
      from: { kind: "problem", stepId: null, stepVersion: null },
      to: { stepId: step.id, stepVersion: 1 },
    },
  ];
  const attempt = {
      id: result.attemptId,
      revision: 2,
      problemRevisionId: result.problemRevisionId,
      steps: [step],
    },
    ticket = {
      attemptId: attempt.id,
      revision: 2,
      problemRevisionId: attempt.problemRevisionId,
      editEpoch: 3,
    };
  assert.equal(canAdoptVerification(ticket, attempt, 3, result), true);
  assert.equal(
    canAdoptVerification(ticket, attempt, 3, { ...result, transitions: [] }),
    false,
  );
  assert.equal(canAdoptVerification(ticket, attempt, 4, result), false);
  assert.equal(
    canAdoptVerification(ticket, { ...attempt, revision: 3 }, 3, result),
    false,
  );
  assert.equal(
    canAdoptVerification(ticket, { ...attempt, id: randomUUID() }, 3, result),
    false,
  );
  assert.equal(
    canAdoptVerification(
      ticket,
      { ...attempt, steps: [{ ...step, currentVersion: 2 }] },
      3,
      result,
    ),
    false,
  );
  assert.equal(
    canAdoptVerification(ticket, attempt, 3, { ...result, isCurrent: false }),
    false,
  );
});
test("all six statuses have distinct Arabic labels and abstention is not called wrong", () => {
  assert.equal(Object.keys(statusLabels).length, 6);
  assert.equal(new Set(Object.values(statusLabels)).size, 6);
  for (const key of [
    "syntax_error",
    "unsupported",
    "inconclusive",
    "service_error",
  ])
    assert.equal(/خاطئ|ضعيف|لا تفهم/.test(statusLabels[key]), false);
});
test("client preserves explicit retry key, revision and raw while enforcing same-origin credentials", async () => {
  let observed;
  const stepId = randomUUID(),
    attemptId = randomUUID();
  const data = {
    attemptId,
    attemptRevision: 1,
    step: {
      id: stepId,
      position: 1,
      currentVersion: 1,
      source: {
        sourceRaw: " ٢س = ٤ ",
        displayAr: null,
        parseStatus: "not_checked",
      },
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    invalidatedFromPosition: 1,
    invalidatedVerificationCount: 0,
  };
  const client = new ApiClient(async (url, options) => {
    observed = { url, options };
    return Response.json({ data, meta: meta() });
  });
  const body = {
    expectedRevision: 0,
    position: 1,
    sourceRaw: " ٢س = ٤ ",
    inputOrigin: "math_editor",
  };
  const received = await client.request(
    "/attempts/" + attemptId + "/steps",
    "StepMutationEnvelope",
    "POST",
    body,
    "same_retry_key_123",
  );
  assert.equal(observed.options.credentials, "same-origin");
  assert.equal(
    observed.options.headers["Idempotency-Key"],
    "same_retry_key_123",
  );
  assert.deepEqual(JSON.parse(observed.options.body), body);
  assert.equal(received.step.source.sourceRaw, body.sourceRaw);
});
test("malformed or extra API fields cannot become frontend state", async () => {
  const client = new ApiClient(async () =>
    Response.json({
      data: { id: "invalid", answer_spec: "hidden" },
      meta: meta(),
    }),
  );
  await assert.rejects(
    client.request("/attempts/" + randomUUID(), "AttemptEnvelope"),
    (e) => e instanceof ClientFault && e.code === "invalid_response",
  );
});
test("503 and 409 remain typed operational failures rather than mathematical verdicts", async () => {
  for (const [status, code] of [
    [503, "math_unavailable"],
    [409, "revision_conflict"],
  ]) {
    const client = new ApiClient(async () =>
      Response.json(
        {
          error: {
            code,
            messageAr: "احتفظنا بخطوتك.",
            issues: [],
            currentRevision: status === 409 ? 4 : null,
            retryable: status === 503,
            retryAfterSeconds: null,
          },
          meta: meta(),
        },
        { status },
      ),
    );
    await assert.rejects(
      client.request(
        "/attempts/" + randomUUID() + "/verify",
        "VerificationEnvelope",
        "POST",
        {},
        "retry_key_123",
      ),
      (e) => e.status === status && e.code === code,
    );
  }
});
test("browser validators run with dynamic code generation disabled (strict CSP)", () => {
  const vm = require("node:vm"),
    source = readFileSync(
      "packages/contracts/src/generated/api-validators.cjs",
      "utf8",
    );
  const sandbox = { exports: {}, require };
  vm.runInNewContext(source, sandbox, {
    contextCodeGeneration: { strings: false, wasm: false },
  });
  assert.equal(
    sandbox.exports.ErrorEnvelope({
      error: {
        code: "math_unavailable",
        messageAr: "تعذر التحقق.",
        issues: [],
        currentRevision: null,
        retryable: true,
        retryAfterSeconds: null,
      },
      meta: meta(),
    }),
    true,
  );
});
