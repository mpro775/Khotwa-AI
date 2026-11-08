import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { applyProblemStep, validateProjectArtifact, C_STAGES } = require("../dist/advanced-learning/workflow-state.js");
const { parseCActivity, publicCActivity } = require("../dist/advanced-learning/activity-payload.js");
const { AdvancedLearningService } = require("../dist/advanced-learning/workflows.js");
const { eligibleCandidates } = require("../dist/pedagogy-engine.js");
const fixtures = JSON.parse(readFileSync(new URL("../../../qa/fixtures/advanced-learning-c/fixtures.synthetic.json", import.meta.url), "utf8"));
const data = () => ({ trackRevisionId: "track", lessonRevisionId: "lesson", blockIndex: 0, contentHash: "hash", policyVersion: "advanced-learning-workflow-1.0", familyCode: "family", subject: "algebra", contextExposures: [], assistanceLevel: 0, eventCount: 0, lastEvent: "problem_started", stage: "frame", status: "active", answers: {}, supportAr: null, result: { result: "correct_practice" }, answer: null, domainVerification: [{ private: "server-only" }] });

test("six TEST_ONLY fixtures parse, redact private solutions and preserve authentic stages", () => {
  assert.equal(fixtures.reviewStatus, "TEST_ONLY");
  assert.equal(fixtures.humanApproval, null);
  assert.equal(fixtures.problems.length, 3);
  assert.equal(fixtures.projects.length, 3);
  for (const value of [...fixtures.problems, ...fixtures.projects]) {
    const parsed = parseCActivity(value, value.subject);
    assert.ok(parsed.privateEvaluation.solutionKey);
    const visible = publicCActivity(parsed);
    assert.equal(Object.hasOwn(visible, "privateEvaluation"), false);
    assert.equal(JSON.stringify(visible).includes("solutionKey"), false);
    assert.ok(visible.representations.some((r) => r.kind === "text"));
    if (visible.type === "problem_based") assert.deepEqual(visible.stages, C_STAGES);
    else assert.ok(visible.milestones.length >= 3);
  }
});
test("alternate strategy text is preserved, edits invalidate feedback, and input immutable", () => {
  const original = data();
  const next = applyProblemStep(original, "plan", "سأقارن بجدول ثم أبني نموذجًا.");
  assert.equal(next.answers.plan, "سأقارن بجدول ثم أبني نموذجًا.");
  assert.equal(next.result, null);
  assert.deepEqual(next.domainVerification, []);
  assert.equal(original.result.result, "correct_practice");
  assert.equal(original.eventCount, 0);
});
test("student can revisit a stage without linear strategy lock", () => {
  let current = applyProblemStep(data(), "reflect", "سأراجع افتراضي");
  current = applyProblemStep(current, "frame", "المطلوب مقارنة التكلفة");
  assert.equal(current.stage, "frame");
  assert.equal(current.answers.reflect, "سأراجع افتراضي");
});
test("pause/resume and abandonment never permit silent resurrection", () => {
  const paused = applyProblemStep(data(), "frame", undefined, "pause");
  assert.equal(paused.status, "paused");
  assert.throws(() => applyProblemStep(paused, "plan", "مسودة"), (e) => e.code === "invalid_state");
  const resumed = applyProblemStep(paused, "frame", undefined, "resume");
  assert.equal(resumed.status, "active");
  const abandoned = applyProblemStep(resumed, "frame", undefined, "abandon");
  assert.throws(() => applyProblemStep(abandoned, "frame", undefined, "resume"));
  assert.throws(() => applyProblemStep({ ...data(), status: "completed" }, "frame", "تعديل"));
});
test("bounded stages and event budget reject malformed or runaway activity", () => {
  assert.throws(() => applyProblemStep(data(), "inject", "text"));
  assert.throws(() => applyProblemStep(data(), "plan", "x".repeat(3001)));
  assert.throws(() => applyProblemStep({ ...data(), eventCount: 200 }, "plan", "خطة"), (e) => e.status === 429);
});
test("text code artifacts remain literal nonexecuted data", () => {
  const raw = '<script>globalThis.hacked=true</script>\nprint("demo")';
  assert.equal(validateProjectArtifact("text", raw), raw);
  assert.equal(globalThis.hacked, undefined);
  assert.deepEqual(validateProjectArtifact("json", { "الوحدات": "m/s", samples: [1, 2], explanation: "تفسير" }), { "الوحدات": "m/s", samples: [1, 2], explanation: "تفسير" });
});
test("artifacts enforce type, bytes, depth, numbers and forbidden key limits", () => {
  assert.throws(() => validateProjectArtifact("upload", "file"));
  assert.throws(() => validateProjectArtifact("text", "س".repeat(16001)));
  assert.throws(() => validateProjectArtifact("json", { v: Number.NaN }));
  assert.throws(() => validateProjectArtifact("json", JSON.parse('{"__proto__":{"x":1}}')));
  assert.throws(() => validateProjectArtifact("json", { privateRubric: "hidden" }));
  assert.throws(() => validateProjectArtifact("json", { items: Array(101).fill(1) }));
  assert.throws(() => validateProjectArtifact("json", { a: { b: { c: { d: { e: { f: { g: "deep" } } } } } } }));
});

test("C1 canonical algebra verifier accepts alternatives without grading reasoning", async () => {
  let called = 0;
  const content = {
    bank: async () => [{ equationRaw: "٢س + ١٠ = ٤س" }],
    math: { checkFinal: async (_context, raw, step) => {
      called++;
      assert.equal(raw, "٢س + ١٠ = ٤س");
      assert.equal(step.raw, "س = ٥");
      return { status: "verified_valid", isIsolated: true, substitutionValid: true, engineVersion: "math-test" };
    } },
  };
  const service = new AdvancedLearningService({}, {}, content, {});
  const spec = { ...fixtures.problems[0], verification: { kind: "bank_problem", problemRevisionId: "00000000-0000-4000-8000-000000000001" } };
  const result = await service.verify({}, { id: "00000000-0000-4000-8000-000000000002", revision: 1, data: data() }, spec, { raw: "س = ٥" }, null);
  assert.equal(called, 1);
  assert.equal(result.result.result, "correct_practice");
  assert.equal(result.result.evidenceClass, "learning_only");
  assert.equal(result.result.domainVerifier, "math-test");
  assert.equal(result.reports.length, 1);
});
test("canonical abstentions remain neutral and never become a learner error", async () => {
  const service = new AdvancedLearningService({}, {}, { bank: async () => [{ equationRaw: "٢س = ١٠" }], math: { checkFinal: async () => ({ status: "unsupported", engineVersion: "math-test", reasonCode: "UNSUPPORTED" }) } }, {});
  const spec = { ...fixtures.problems[0], verification: { kind: "bank_problem", problemRevisionId: "00000000-0000-4000-8000-000000000001" } };
  const outcome = await service.verify({}, { id: "id", revision: 1, data: data() }, spec, { raw: "س² = ٢٥" }, null);
  assert.equal(outcome.result.result, "cannot_determine");
  assert.equal(outcome.result.reasonCode, "UNSUPPORTED");
});
test("open reasoning and programming never receive an autonomous grade", async () => {
  const service = new AdvancedLearningService({}, {}, { bank: async () => [{}] }, {});
  const open = await service.verify({}, { data: data() }, fixtures.problems[0], null, null);
  assert.equal(open.result.result, "needs_review");
  const spec = { ...fixtures.problems[2], verification: { kind: "bank_problem", problemRevisionId: "00000000-0000-4000-8000-000000000001" } };
  const code = await service.verify({}, { data: data() }, spec, { raw: "print('example')" }, null);
  assert.equal(code.result.result, "needs_review");
  assert.match(code.result.reasonCode, /RUNNER_GATE_BLOCKED/);
});
test("linked B session reuses ownership path and requires matching pinned context", async () => {
  const session = { trackRevisionId: "track", lessonRevisionId: "lesson", blockIndex: 2, subject: "programming", result: { result: "correct_practice", evidenceClass: "learning_only", domainVerifier: "parsons-v1" } };
  let seenRequest;
  const service = new AdvancedLearningService({}, {}, {}, { get: async (r, id) => { seenRequest = r; assert.equal(id, "lab-session"); return session; } });
  const request = { headers: { cookie: "session" } }, spec = { ...fixtures.problems[2], verification: { kind: "stem_lab", blockIndex: 2 } };
  const outcome = await service.verify(request, { data: data() }, spec, null, "lab-session");
  assert.equal(seenRequest, request);
  assert.equal(outcome.result.domainVerifier, "parsons-v1");
  await assert.rejects(() => service.verify(request, { data: { ...data(), lessonRevisionId: "other" } }, spec, null, "lab-session"), (e) => e.status === 404);
});

test("A1 permits published C programming learning without opening independent execution", () => {
  const candidate = { activityKind: "guided_practice", lessonRevisionId: "lesson", skillCode: "PY-CONDITIONS", reasonCode: "problem_based_learning", published: true, mappingPending: false, questionCoverage: 0, novel: false, reviewed: true, subject: "programming", advancedActivity: { kind: "problem_based", blockIndex: 0 } };
  assert.equal(eligibleCandidates([candidate])[0].rejection, null);
  assert.equal(eligibleCandidates([{ ...candidate, advancedActivity: undefined }])[0].rejection, "runner_read_only");
  assert.equal(eligibleCandidates([{ ...candidate, activityKind: "independent_check" }])[0].rejection, "runner_read_only");
  assert.equal(eligibleCandidates([{ ...candidate, mappingPending: true }])[0].rejection, "mapping_pending");
  assert.equal(eligibleCandidates([{ ...candidate, published: false }])[0].rejection, "unpublished_content");
});
test("native support and assessment adapters report closed feature gates", async () => {
  const oldC = process.env.C_PROBLEM_LEARNING_ENABLED, oldScaffold = process.env.FADING_SCAFFOLD_ENABLED;
  try {
    process.env.C_PROBLEM_LEARNING_ENABLED = "true";
    process.env.FADING_SCAFFOLD_ENABLED = "false";
    const service = new AdvancedLearningService({}, { actor: async () => ({ ownerKey: "guest:test" }) }, {}, {});
    await assert.rejects(() => service.support({}, "id", { expectedRevision: 0, kind: "scaffold" }), (e) => e.status === 403);
    await assert.rejects(() => service.independentAssessment({}, "problem", "id", { expectedRevision: 0 }), (e) => e.status === 403);
  } finally {
    if (oldC === undefined) delete process.env.C_PROBLEM_LEARNING_ENABLED; else process.env.C_PROBLEM_LEARNING_ENABLED = oldC;
    if (oldScaffold === undefined) delete process.env.FADING_SCAFFOLD_ENABLED; else process.env.FADING_SCAFFOLD_ENABLED = oldScaffold;
  }
});
