import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { ProgrammingService } = require("../dist/programming.js");
const { PhysicsService } = require("../dist/physics.js");
const { RunnerCoordinator } = require("../dist/runner-coordinator.js");
const subjectAi = require("../dist/subject-ai.js");
const learningAccess = require("../dist/learning-access.js");
const id = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
function harness(t, subject, options = {}) {
  t.mock.method(learningAccess, "requireProductLearningAccess", async () => {});
  let transactionOpen = false,
    aiCalls = 0,
    stale = false;
  const writes = [],
    sent = [];
  const filename =
    subject === "physics" ? "physics-kinematics" : "python-basics";
  const payload = JSON.parse(
    readFileSync(
      new URL(`../data/${filename}.draft.v1.json`, import.meta.url),
      "utf8",
    ),
  )[0];
  payload.kind = options.transfer ? "transfer" : "main";
  payload.hints = payload.hints.map((h) => ({ ...h, reviewed: true }));
  if (payload.programming) {
    payload.programming.referenceCode = "PRIVATE_REFERENCE_NEVER_SENT";
    payload.programming.tests[1].input = "PRIVATE_HIDDEN_CASE_NEVER_SENT";
  }
  const verdict =
    subject === "physics"
      ? {
          status: "wrong_unit",
          valueCorrect: true,
          unitCorrect: false,
          diagnosis: { code: "unit_conversion" },
        }
      : {
          status: "runtime_error",
          stdout: "PRIVATE_STDOUT",
          stderr: "PRIVATE_TRACE",
          allPassed: false,
          passed: 0,
          total: 2,
        };
  if (options.running) verdict.status = "running";
  const attempt = {
    id,
    problem_revision_id: revisionId,
    revision: 0,
    assistance_level: 0,
    independent: true,
    verdict,
    source_raw: "PRIVATE_STUDENT_CODE_OR_ANSWER",
  };
  const owner = {
    ownerKey: "user:owner",
    userId: "owner",
    role: "student",
    authSessionId: "session",
  };
  const tx = {
    $queryRaw: async (query) => {
      const sql = query.join("?");
      if (sql.includes("FROM subject_attempts"))
        return [{ ...attempt, revision: stale ? 1 : 0 }];
      if (sql.includes("FROM studio_revisions"))
        return [
          {
            id: revisionId,
            item_id: id,
            code: "public-code",
            payload,
            status: "published",
          },
        ];
      return [];
    },
    $executeRaw: async (sql, ...values) => {
      writes.push({ sql: sql.join("?"), values });
      return 1;
    },
  };
  t.mock.method(
    RunnerCoordinator.prototype,
    "run",
    async (_owner, _request, _operation, _body, work) => {
      transactionOpen = true;
      let plan;
      try {
        plan = await work.prepare(tx);
      } finally {
        transactionOpen = false;
      }
      assert.equal(plan.runs, 0);
      const evaluated = await work.execute(plan.snapshot, {
        accepted: async () => {},
      });
      if (options.stale) stale = true;
      transactionOpen = true;
      try {
        return await work.finish(tx, plan.snapshot, evaluated);
      } finally {
        transactionOpen = false;
      }
    },
  );
  t.mock.method(subjectAi, "composeSubjectHint", async (input) => {
    assert.equal(
      transactionOpen,
      false,
      "provider must run outside a DB transaction",
    );
    aiCalls++;
    sent.push(input);
    assert.equal(JSON.stringify(input).includes("PRIVATE_"), false);
    assert.equal(Object.hasOwn(input, "attemptId"), false);
    assert.equal(Object.hasOwn(input, "problemRevisionId"), false);
    return {
      textAr: "راجع المهارة وحدود الخطوة.",
      source: "llm_validated",
      reasonCode: "AI_VALIDATED",
    };
  });
  t.mock.method(
    subjectAi,
    "canDeliverSubjectAi",
    async () => options.consent !== false,
  );
  const store = {},
    accounts = {
      actor: async () => owner,
      authorizeInTransaction: async () => {},
    };
  const service =
    subject === "physics"
      ? new PhysicsService(store, accounts)
      : new ProgrammingService(store, accounts, {});
  return { service, writes, sent, payload, verdict, calls: () => aiCalls };
}
for (const subject of ["programming", "physics"]) {
  test(`${subject}: hint reaches the composer without private input and preserves verifier judgment`, async (t) => {
    const h = harness(t, subject);
    const original = structuredClone(h.verdict);
    const result = await h.service.hint({}, id, {
      level: 1,
      expectedRevision: 0,
    });
    assert.equal(h.calls(), 1);
    assert.equal(h.sent[0].subject, subject);
    assert.equal(
      h.sent[0].observationCode,
      subject === "programming" ? "runtime_error" : "wrong_unit",
    );
    assert.equal(result.source, "llm_validated");
    assert.equal(result.revision, 1);
    assert.deepEqual(h.verdict, original);
    const event = h.writes.find((w) =>
      w.sql.includes("INSERT INTO subject_attempt_events"),
    );
    assert.ok(event);
    assert.equal(JSON.parse(event.values.at(-1)).source, "llm_validated");
  });
  test(`${subject}: consent revoked during generation falls back and stale generation is never saved`, async (t) => {
    const h = harness(t, subject, { consent: false });
    const result = await h.service.hint({}, id, {
      level: 1,
      expectedRevision: 0,
    });
    assert.equal(result.source, "reviewed_template");
    assert.equal(result.textAr, h.payload.hints[0].textAr);
  });
  test(`${subject}: revision change rejects a delayed generated hint`, async (t) => {
    const h = harness(t, subject, { stale: true });
    await assert.rejects(
      h.service.hint({}, id, { level: 1, expectedRevision: 0 }),
      (error) => error.status === 409 && error.code === "revision_conflict",
    );
    assert.equal(
      h.writes.some((w) =>
        w.sql.includes("INSERT INTO subject_attempt_events"),
      ),
      false,
    );
  });
  test(`${subject}: independent transfer rejects hints before provider invocation`, async (t) => {
    const h = harness(t, subject, { transfer: true });
    await assert.rejects(
      h.service.hint({}, id, { level: 1, expectedRevision: 0 }),
      (error) => error.code === "invalid_state",
    );
    assert.equal(h.calls(), 0);
  });
  test(`${subject}: explicit H4 uses reviewed content without Gemini`, async (t) => {
    const h = harness(t, subject);
    const result = await h.service.hint({}, id, {
      level: 4,
      expectedRevision: 0,
      confirmFullSolution: true,
    });
    assert.equal(result.source, "reviewed_template");
    assert.equal(h.calls(), 0);
    assert.equal(result.level, 4);
  });
}
test("a programming hint cannot orphan a still-running verdict by advancing its revision", async (t) => {
  const h = harness(t, "programming", { running: true });
  await assert.rejects(
    h.service.hint({}, id, { level: 1, expectedRevision: 0 }),
    (error) => error.code === "request_in_progress",
  );
  assert.equal(h.calls(), 0);
  assert.equal(h.writes.length, 0);
});
