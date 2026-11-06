import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { summarizeSkill, ProgressService } = require("../dist/progress.js");
const {
  teacherArtifact,
  teacherSummary,
  TeacherDemoService,
  TEACHER_DATASET_SHA256,
} = require("../dist/teacher-demo.js");
const { retentionReview } = require("../dist/retention-review.js");
const bytes = readFileSync(
    new URL("../data/teacher-demo.v1.json", import.meta.url),
  ),
  data = JSON.parse(bytes);
const skill = { id: "skill-a", skill_code: "SK-ALG-04", name_ar: "التوزيع" },
  row = (observation, event_kind = "guided_practice", id = "skill-a") => ({
    skill_id: id,
    observation,
    event_kind,
    created_at: new Date("2026-11-04T00:00:00Z"),
  });
test("not_assessed never becomes a percentage or a negative score", () => {
  const s = summarizeSkill(skill, []);
  assert.equal(s.state, "not_assessed");
  assert.equal(s.evidenceCount, 0);
  assert.equal(s.updatedAt, null);
  assert.ok(!Object.keys(s).some((k) => /score|percent|mastery/i.test(k)));
});
test("non-assessable and foreign-skill events do not create conceptual difficulty", () => {
  const s = summarizeSkill(skill, [
    row("non_assessable"),
    row("needs_review", "guided_practice", "other"),
  ]);
  assert.equal(s.state, "not_assessed");
  assert.equal(s.evidenceCount, 0);
  assert.equal(s.independentTransferCount, 0);
});
test("guided completion and H4 context are separate from new independent transfer evidence", () => {
  const s = summarizeSkill(skill, [
    row("assisted"),
    row("positive", "transfer_observation"),
  ]);
  assert.equal(s.state, "new_evidence_of_understanding");
  assert.equal(s.independentTransferCount, 1);
  assert.equal(s.assistedPracticeCount, 1);
  assert.equal(s.evidenceCount, 2);
});
test("unresolved verified difficulty remains followup and failure does not erase a different valid transfer", () => {
  assert.equal(
    summarizeSkill(skill, [row("needs_review"), row("assisted")]).state,
    "needs_followup",
  );
  assert.equal(
    summarizeSkill(skill, [
      row("non_assessable"),
      row("positive", "transfer_observation"),
    ]).state,
    "new_evidence_of_understanding",
  );
});
test("teacher artifact is pinned, independently synthetic, and all numbers trace to rows", () => {
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    TEACHER_DATASET_SHA256,
  );
  const d = teacherArtifact(data),
    s = teacherSummary(d);
  assert.equal(s.sampleStudentCount, 8);
  assert.equal(s.sampleAttemptCount, 12);
  const counts = Object.fromEntries(s.metrics.map((m) => [m.code, m.count]));
  assert.deepEqual(counts, {
    evaluable_attempts: 8,
    non_assessable_attempts: 4,
    verified_invalid_attempts: 3,
    independent_transfer_attempts: 2,
    assisted_completions: 2,
  });
  assert.equal(
    s.topMisconceptions.reduce((n, e) => n + e.count, 0),
    3,
  );
  assert.equal(s.exampleIds.length, 3);
  assert.ok(d.rows.every((r) => r.isSynthetic));
});
test("real-data flags, PII/extra fields, contradictory assistance, duplicate keys and cross-dataset examples fail closed", () => {
  for (const change of [
    (d) => (d.isSynthetic = false),
    (d) => (d.rows[0].isSynthetic = false),
    (d) => (d.rows[0].email = "private@example.test"),
    (d) => (d.rows[0].independentTransfer = true),
    (d) => (d.rows[1].key = d.rows[0].key),
    (d) => (d.examples[0].datasetCode = "foreign"),
  ]) {
    const d = structuredClone(data);
    change(d);
    assert.throws(() => teacherArtifact(d));
  }
});
test("teacher reader has no configurable database source and cannot resolve a real attempt id", () => {
  const prev = process.env.PH09_API_ENABLED,
    source = process.env.TEACHER_DEMO_SOURCE;
  try {
    process.env.PH09_API_ENABLED = "true";
    process.env.TEACHER_DEMO_SOURCE = "database";
    const service = new TeacherDemoService(true);
    assert.deepEqual(service.summary(), teacherSummary(data));
    assert.throws(
      () => service.example("00000000-0000-4000-8000-000000000001"),
      (e) => e.status === 404,
    );
    assert.throws(
      () => new TeacherDemoService(false).summary(),
      (e) => e.status === 404,
    );
  } finally {
    if (prev === undefined) delete process.env.PH09_API_ENABLED;
    else process.env.PH09_API_ENABLED = prev;
    if (source === undefined) delete process.env.TEACHER_DEMO_SOURCE;
    else process.env.TEACHER_DEMO_SOURCE = source;
  }
});
test("PH09 progress cannot activate on a non-synthetic store", () => {
  assert.throws(
    () => new ProgressService({ syntheticData: false }, true),
    /synthetic/,
  );
});
test("owner retention eligibility is seven days after actual absolute expiry, not last activity", () => {
  const input = {
    expiresAt: new Date("2026-11-02T00:00:00Z"),
    lastSeenAt: new Date("2026-11-01T23:00:00Z"),
    revokedAt: null,
  };
  assert.equal(
    retentionReview(input, new Date("2026-11-08T23:59:59.999Z")).eligible,
    false,
  );
  const r = retentionReview(input, new Date("2026-11-09T00:00:00Z"));
  assert.equal(r.eligible, true);
  assert.equal(r.eligibleAt, "2026-11-09T00:00:00.000Z");
  assert.equal(r.action, "review_only_no_deletion");
});
test("idle expiry and logout start a limited retention window without claiming immediate deletion", () => {
  const input = {
    expiresAt: new Date("2026-11-02T00:00:00Z"),
    lastSeenAt: new Date("2026-11-01T00:00:00Z"),
    revokedAt: null,
  };
  assert.equal(
    retentionReview(input, new Date("2026-11-08T02:00:00Z")).eligible,
    true,
  );
  const r = retentionReview(
    { ...input, revokedAt: new Date("2026-11-01T01:00:00Z") },
    new Date("2026-11-01T01:00:01Z"),
  );
  assert.equal(r.eligible, false);
  assert.equal(r.eligibleAt, "2026-11-08T01:00:00.000Z");
  assert.throws(() =>
    retentionReview({ ...input, expiresAt: new Date("invalid") }, new Date()),
  );
});
