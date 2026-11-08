import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  normalizeCEvents,
  projectCMetrics,
  replayCEvents,
} = require("../dist/advanced-learning/analytics-projection.js");
const {
  CAnalyticsService,
} = require("../dist/advanced-learning/analytics-service.js");
const observation = (id, outcome, extra = {}) => ({
  skillCode: "SK-ALG-04",
  problemId: `problem-${id}`,
  difficulty: 1,
  evidenceId: `evidence-${id}`,
  attemptId: `attempt-${id}`,
  attemptRevision: 1,
  outcome,
  time: "2026-11-08T00:00:00.000Z",
  verifiedCorrect: outcome === "correct",
  ...extra,
});
const metric = (events, name) =>
  projectCMetrics(events).metrics.find((m) => m.metric === name);

test("C5 separates independent, assisted, abstained and activity denominators", () => {
  const events = normalizeCEvents(
    [
      observation("a", "correct"),
      observation("b", "error"),
      observation("c", "assisted", { verifiedCorrect: true }),
      observation("d", "unassessable"),
    ],
    "algebra",
    [],
    [
      {
        id: "project",
        kind: "project_run",
        revision: 2,
        subject: "algebra",
        completed: true,
        at: "2026-11-08T00:00:00Z",
      },
    ],
  );
  assert.equal(metric(events, "independent_success_rate").value, 1 / 2);
  assert.equal(metric(events, "assistance_dependency").value, 1 / 3);
  assert.equal(projectCMetrics(events).activity.projectCompleted, 1);
  assert.equal(projectCMetrics(events).missingCount, 1);
});
test("C5 no baseline, retention or transfer means null with reason, never zero success", () => {
  for (const m of projectCMetrics([]).metrics) {
    assert.equal(m.value, null);
    assert.equal(m.status, "not_measured");
    assert.equal(m.denominator, 0);
    assert.ok(m.missingReason);
  }
});
test("C5 replay ten times and out-of-order corrections preserves one denominator", () => {
  const old = normalizeCEvents(
    [observation("a", "unassessable")],
    "algebra",
  )[0];
  const current = normalizeCEvents(
    [observation("a", "correct", { attemptRevision: 2 })],
    "algebra",
  )[0];
  const events = Array.from({ length: 10 }, () => [current, old]).flat();
  assert.equal(replayCEvents(events).length, 1);
  assert.equal(metric(events, "independent_success_rate").denominator, 1);
  assert.equal(projectCMetrics(events).missingCount, 0);
});
test("C5 revised assisted classification supersedes former independent result", () => {
  const old = normalizeCEvents([observation("a", "correct")], "algebra")[0];
  const current = normalizeCEvents(
    [observation("a", "assisted", { attemptRevision: 2 })],
    "algebra",
  )[0];
  assert.equal(
    metric([old, current], "independent_success_rate").denominator,
    0,
  );
});
test("C5 canonical A2 semantic/problem dedupe cannot count equivalent problems twice", () => {
  const events = normalizeCEvents(
    [
      observation("a", "correct", { contentKey: "same" }),
      observation("b", "correct", {
        contentKey: "same",
        time: "2026-11-08T01:00:00Z",
      }),
    ],
    "algebra",
  );
  assert.equal(events.length, 1);
  assert.equal(metric(events, "independent_success_rate").denominator, 1);
});
test("C5 delayed retention requires canonical independent followup, new problem, due and anchor", () => {
  const base = observation("a", "correct", {
    time: "2026-11-01T00:00:00.000Z",
  });
  const follow = observation("b", "correct", {
    assessmentId: "delayed",
    transferEligible: true,
  });
  const review = {
    status: "completed",
    skillCode: "SK-ALG-04",
    assessmentId: "delayed",
    sourceEvidenceId: "evidence-a",
    anchorAt: base.time,
    dueAt: "2026-11-08T00:00:00Z",
  };
  const events = normalizeCEvents([base, follow], "algebra", [review]);
  assert.equal(metric(events, "delayed_retention").value, 1);
  assert.equal(
    events.find((e) => e.retentionDelayDays !== null).retentionDelayDays,
    7,
  );
  assert.equal(metric(events, "transfer_success").denominator, 1);
  const early = normalizeCEvents([base, follow], "algebra", [
    { ...review, dueAt: "2026-11-09T00:00:00Z" },
  ]);
  assert.equal(metric(early, "delayed_retention").value, null);
  const helped = normalizeCEvents(
    [base, { ...follow, outcome: "assisted" }],
    "algebra",
    [review],
  );
  assert.equal(metric(helped, "delayed_retention").denominator, 0);
});
test("C5 rejects invalid time and drops all private/PII/raw extra properties", () => {
  const events = normalizeCEvents(
    [
      observation("a", "correct", {
        raw_answer: "PRIVATE_ANSWER",
        full_code: "SECRET_CODE",
        email: "PRIVATE_EMAIL",
        hiddenTests: ["SECRET_TEST"],
        ownerPseudonym: "OWNER_SECRET",
        contentKey: "SECRET_EQUATION",
      }),
      observation("invalid", "correct", { time: "not a date" }),
    ],
    "algebra",
  );
  assert.equal(events.length, 1);
  assert.doesNotMatch(
    JSON.stringify(events),
    /PRIVATE_|SECRET_|hiddenTests|raw_answer|email|ownerPseudonym|contentKey/,
  );
});
test("C5 source cannot infer learning from completed project or reflection", () => {
  const result = projectCMetrics(
    normalizeCEvents(
      [],
      "programming",
      [],
      [
        {
          id: "project",
          kind: "project_run",
          revision: 20,
          completed: true,
          subject: "programming",
          at: "2026-11-08T00:00:00Z",
        },
      ],
    ),
  );
  assert.equal(result.activity.projectCompleted, 1);
  assert.equal(result.metrics[0].denominator, 0);
});
test("C5 cohort is blocked even when a feature flag is set", async () => {
  process.env.C_COHORT_ANALYTICS_ENABLED = "true";
  const service = new CAnalyticsService(
    {},
    { actor: async () => ({ role: "admin" }) },
    {},
    {},
  );
  await assert.rejects(
    () => service.cohort({}, "11111111-1111-4111-8111-111111111111"),
    (e) => e.status === 403,
  );
  delete process.env.C_COHORT_ANALYTICS_ENABLED;
});
test("C5 flag off denies before reading sources", async () => {
  delete process.env.C_LEARNING_ANALYTICS_ENABLED;
  const service = new CAnalyticsService({}, {}, {}, {});
  await assert.rejects(
    () => service.me({}, {}),
    (e) => e.status === 403,
  );
});

test("C5 repeated window params are invalid rather than coerced into a valid window", async () => {
  const previous = process.env.C_LEARNING_ANALYTICS_ENABLED;
  try {
    process.env.C_LEARNING_ANALYTICS_ENABLED = "true";
    const service = new CAnalyticsService({}, {}, {}, {});
    await assert.rejects(
      () =>
        service.me(
          {},
          {
            trackRevisionId: "11111111-1111-4111-8111-111111111111",
            window: ["7"],
          },
        ),
      (e) => e.status === 422,
    );
  } finally {
    if (previous === undefined) delete process.env.C_LEARNING_ANALYTICS_ENABLED;
    else process.env.C_LEARNING_ANALYTICS_ENABLED = previous;
  }
});
test("C5 conflicting equal-version deliveries cannot preserve a false independent outcome", () => {
  const first = normalizeCEvents(
    [observation("same", "correct")],
    "algebra",
  )[0];
  const correction = { ...first, evidenceClass: "assisted" };
  for (const sequence of [
    [first, correction],
    [correction, first],
  ]) {
    assert.equal(metric(sequence, "independent_success_rate").denominator, 0);
    assert.equal(projectCMetrics(sequence).missingCount, 1);
  }
});

test("A/B/C synthetic guard rejects real identities even with real-learning configured", async () => {
  const { aRead } = require("../dist/intelligent-learning-data.js");
  let called = false;
  const tx = { $queryRaw: async () => [{ is_internal: false }] };
  const store = {
    syntheticData: true,
    db: { $transaction: async (fn) => fn(tx) },
  };
  await assert.rejects(
    () =>
      aRead(store, { userId: "user", ownerKey: "user:test" }, async () => {
        called = true;
      }),
    (e) => e.status === 403,
  );
  assert.equal(called, false);
});
test("synthetic authorization applies before product idempotency cache replay", async () => {
  const { aMutation } = require("../dist/intelligent-learning-data.js");
  let cacheRead = false;
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async (parts) => {
      const sql = parts.join("?");
      if (sql.includes("product_mutations")) {
        cacheRead = true;
        return [{ fingerprint: "same", response_cache: { secret: true } }];
      }
      if (sql.includes("SELECT is_internal")) return [{ is_internal: false }];
      return [{ id: "user" }];
    },
  };
  const store = {
    syntheticData: true,
    security: { keyDigest: () => "key", fingerprint: () => "same" },
    db: { $transaction: async (fn) => fn(tx) },
  };
  await assert.rejects(
    () =>
      aMutation(
        store,
        { userId: "user", ownerKey: "user:test", role: "student" },
        {
          headers: { "idempotency-key": "test-key-0000000000000000000000000" },
        },
        "test",
        {},
        async () => ({}),
      ),
    (e) => e.status === 403,
  );
  assert.equal(cacheRead, false);
});
