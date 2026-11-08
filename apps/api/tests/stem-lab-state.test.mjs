import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  applyLabEvent,
  validateLabAnswer,
} = require("../dist/stem/lab-state.js");
const {
  parseLabBlock,
  publicLabActivity,
  labMathSources,
} = require("../dist/stem/lab-registry.js");
const {
  physicsLabContextKeys,
  mergeLabExposures,
  readLabExposures,
} = require("../dist/stem/lab-exposure.js");
const {
  learningStudentContentDto,
} = require("../dist/learning-path-content.js");
const { parseLearningPayload } = require("../dist/learning-path-payload.js");
const { decideActivity } = require("../dist/pedagogy-engine.js");
const { StemLabService } = require("../dist/stem/lab-service.js");
const math = JSON.parse(
  readFileSync(new URL("./fixtures/stem-math.v1.json", import.meta.url)),
).activities;
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/stem-models.v1.json", import.meta.url)),
);
const physicsDomain = {
  kind: "physics_prediction_experiment_v1",
  model: fixture.physics.positiveVelocity,
  predictionPromptAr: "ما توقعك؟",
  observationPromptAr: "ماذا لاحظت؟",
  explanationPromptAr: "كيف تفسر؟",
  assumptionsAr: ["حركة على محور واحد"],
  controlledVariables: ["السرعة"],
};
const wrap = (subject, domainSpec) => ({
  schemaVersion: "subject-lab-v1",
  subject,
  labKind: domainSpec.kind,
  objectiveAr: "تجربة وفهم",
  familyCode: "synthetic-family",
  skillCodes: [
    subject === "algebra"
      ? "SK-ALG-04"
      : subject === "physics"
        ? "PHYS-CONSTANT_MOTION"
        : "PY-LOOPS",
  ],
  domainSpec,
});
const data = (extra = {}) => ({
  trackRevisionId: "track",
  lessonRevisionId: "lesson",
  blockIndex: 0,
  contentHash: "hash",
  policyVersion: "test-only",
  familyCode: "synthetic-family",
  contextExposures: [],
  subject: "physics",
  labKind: physicsDomain.kind,
  stage: "opened",
  prediction: null,
  parameters: { v_mps: 3, t_s: 4, x0_m: 0 },
  observation: null,
  explanation: null,
  assistanceLevel: 0,
  resultRevealed: false,
  traceRevealedCount: 0,
  eventCount: 0,
  lastEvent: "lab_opened",
  answer: null,
  result: null,
  ...extra,
});
const fault = (status) => (e) => e?.status === status;

test("B content allowlists all six math types and redacts every private key", () => {
  for (const spec of math) {
    const lab = parseLabBlock(wrap("algebra", spec), "algebra"),
      pub = publicLabActivity(lab, "revision", 0);
    assert.equal(pub.labKind, spec.kind);
    assert.equal(JSON.stringify(pub).includes("privateValidation"), false);
    assert.equal(JSON.stringify(pub).includes("acceptedChoiceIds"), false);
    assert.equal(JSON.stringify(pub).includes("acceptedMethodIds"), false);
  }
});
test("B subject boundaries, skill gate and unknown executable payloads reject", () => {
  assert.throws(
    () => parseLabBlock(wrap("algebra", math[0]), "physics"),
    fault(422),
  );
  assert.throws(
    () =>
      parseLabBlock(
        { ...wrap("algebra", math[0]), skillCodes: ["SK-ALG-08"] },
        "algebra",
      ),
    fault(422),
  );
  assert.throws(
    () =>
      parseLabBlock(
        { ...wrap("algebra", math[0]), onChange: "alert(1)" },
        "algebra",
      ),
    fault(422),
  );
  assert.throws(
    () =>
      parseLabBlock(
        wrap("algebra", { kind: "general_cas", expression: "جا(س)" }),
        "algebra",
      ),
    fault(422),
  );
  assert.throws(
    () =>
      parseLabBlock(
        wrap("physics", {
          ...physicsDomain,
          model: { ...fixture.physics.positiveVelocity, sampleCount: 1000000 },
        }),
        "physics",
      ),
    fault(422),
  );
});
test("B public lesson metadata contains no private domain or Parsons solution", () => {
  const payload = {
    kind: "lesson",
    subject: "programming",
    code: "PY-TEST",
    titleAr: "اختبار اصطناعي",
    descriptionAr: "مسودة للاختبار",
    objectives: ["قراءة الكود"],
    skillCodes: ["PY-LOOPS"],
    prerequisiteSkillCodes: [],
    prerequisiteLessonIds: [],
    contentBlocks: [
      {
        type: "subject_lab_activity",
        textAr: "تدريب",
        lab: wrap("programming", fixture.coding.parsons),
      },
    ],
    practiceProblemRevisionIds: [],
    assessmentProblemRevisionIds: [],
    errorCodes: [],
    mappingPending: [],
  };
  const normalized = parseLearningPayload(payload);
  const dto = learningStudentContentDto({
    id: "lesson",
    item_id: "item",
    version: 1,
    edit_revision: 0,
    status: "published",
    payload: normalized,
    content_hash: "hash",
    validation: null,
    created_at: new Date(),
    reviewed_at: new Date(),
    published_at: new Date(),
  });
  assert.equal(dto.payload.contentBlocks[0].lab.domainSpec, undefined);
  assert.equal(
    normalized.contentBlocks[0].lab.domainSpec.privateValidation !== undefined,
    true,
  );
  const pub = publicLabActivity(
    wrap("programming", fixture.coding.parsons),
    "lesson",
    0,
  );
  assert.equal(pub.domainSpec.sourceCode, undefined);
  assert.equal(pub.domainSpec.privateValidation, undefined);
});
test("B lesson lab skills must be a subset of the owning lesson", () => {
  const payload = {
    kind: "lesson",
    subject: "algebra",
    code: "ALG-TEST",
    titleAr: "اختبار",
    descriptionAr: "اختبار",
    objectives: ["فهم"],
    skillCodes: ["SK-ALG-01"],
    prerequisiteSkillCodes: [],
    prerequisiteLessonIds: [],
    contentBlocks: [
      {
        type: "subject_lab_activity",
        textAr: "تدريب",
        lab: wrap("algebra", math[0]),
      },
    ],
    practiceProblemRevisionIds: [],
    assessmentProblemRevisionIds: [],
    errorCodes: [],
    mappingPending: [],
  };
  assert.throws(() => parseLearningPayload(payload), fault(422));
});
test("B2 prediction must commit before reveal; it is immutable after commit", () => {
  const initial = data();
  assert.throws(
    () => applyLabEvent(initial, "simulation_revealed", {}),
    fault(409),
  );
  assert.throws(
    () =>
      applyLabEvent(initial, "simulation_parameter_changed", {
        parameters: { t_s: 8 },
      }),
    fault(409),
  );
  const saved = applyLabEvent(initial, "prediction_submitted", {
    textAr: "لا أعرف",
  });
  assert.equal(initial.prediction, null);
  assert.equal(saved.stage, "prediction_saved");
  assert.throws(
    () => applyLabEvent(saved, "prediction_submitted", { textAr: "أغير رأيي" }),
    fault(409),
  );
  const shown = applyLabEvent(saved, "simulation_revealed", {});
  assert.equal(shown.resultRevealed, true);
  assert.equal(shown.assistanceLevel, 1);
  assert.throws(
    () =>
      applyLabEvent(shown, "prediction_submitted", { textAr: "قيمة مكشوفة" }),
    fault(409),
  );
});
test("B2 parameter changes invalidate prior derived result and preserve prediction/support", () => {
  const before = data({
    stage: "submitted",
    prediction: "تزيد",
    resultRevealed: true,
    assistanceLevel: 1,
    result: { result: "correct_practice" },
    answer: { observationAr: "ملاحظة" },
    observation: "قديم",
    explanation: "قديم",
  });
  const after = applyLabEvent(before, "simulation_parameter_changed", {
    parameters: { t_s: 8 },
  });
  assert.deepEqual(after.parameters, { v_mps: 3, t_s: 8, x0_m: 0 });
  assert.equal(after.result, null);
  assert.equal(after.answer, null);
  assert.equal(after.observation, null);
  assert.equal(after.prediction, "تزيد");
  assert.equal(after.assistanceLevel, 1);
  const restored = applyLabEvent(after, "simulation_parameter_changed", {
    parameters: { t_s: 4 },
  });
  assert.deepEqual(restored.parameters, before.parameters);
  assert.equal(restored.result, null);
  assert.throws(
    () =>
      applyLabEvent(after, "simulation_parameter_changed", {
        parameters: { js: "alert(1)" },
      }),
    fault(422),
  );
});
test("B trace reveals require prediction and sequential support history", () => {
  const first = data({
    subject: "programming",
    labKind: "code_trace",
    parameters: {},
  });
  assert.throws(
    () => applyLabEvent(first, "trace_step_revealed", { index: 0 }),
    fault(409),
  );
  const predicted = applyLabEvent(first, "prediction_submitted", {
    textAr: "المجموع ستة",
  });
  const shown = applyLabEvent(predicted, "trace_step_revealed", { index: 0 });
  assert.equal(shown.traceRevealedCount, 1);
  assert.equal(shown.assistanceLevel, 1);
  assert.throws(
    () => applyLabEvent(shown, "trace_step_revealed", { index: 0 }),
    fault(409),
  );
  assert.throws(
    () => applyLabEvent(shown, "trace_step_revealed", { index: 2 }),
    fault(409),
  );
});
test("B explanation is a bounded self-report, not a domain result", () => {
  const shown = data({ resultRevealed: true });
  const explained = applyLabEvent(shown, "explanation_saved", {
    textAr: "كنت أخلط المسافة بالإزاحة",
  });
  assert.equal(explained.result, null);
  assert.equal(explained.stage, "explained");
  assert.throws(
    () =>
      applyLabEvent(shown, "explanation_saved", { textAr: "أ".repeat(1001) }),
    fault(422),
  );
  assert.throws(() => applyLabEvent(shown, "mastery_awarded", {}), fault(422));
  assert.throws(
    () =>
      applyLabEvent(data({ eventCount: 200 }), "observation_saved", {
        textAr: "نهاية",
      }),
    fault(429),
  );
});
test("B physics exploration identities retain earlier parameter scenarios", () => {
  const lab = wrap("physics", physicsDomain),
    base = physicsLabContextKeys(lab, { v_mps: 3, t_s: 4, x0_m: 0 }),
    changed = physicsLabContextKeys(lab, { v_mps: 3, t_s: 8, x0_m: 0 });
  const first = mergeLabExposures([], base, "2026-11-08T00:00:00Z"),
    second = mergeLabExposures(first, changed, "2026-11-08T00:01:00Z");
  assert.equal(base.length, 2);
  assert.equal(second.length, 4);
  assert.equal(second[0].at, first[0].at);
  assert.equal(mergeLabExposures(second, base).length, 4);
  assert.notEqual(base[0], changed[0]);
});
test("B completion and alternate-method sources enter the exposure identity list", () => {
  const completion = math.find((s) => s.kind === "math_completion_v1"),
    methods = math.find((s) => s.kind === "math_method_comparison_v1");
  assert.ok(
    labMathSources(wrap("algebra", completion)).includes(
      completion.privateValidation.completionRaw,
    ),
  );
  assert.ok(
    labMathSources(wrap("algebra", methods)).includes(
      methods.methods[1].steps[0],
    ),
  );
});
test("B client cannot supply a verdict or independent evidence through answer", () => {
  for (const key of [
    "verdict",
    "status",
    "independent",
    "evidenceClass",
    "hiddenTests",
    "privateValidation",
  ])
    assert.throws(() => validateLabAnswer({ [key]: true }), fault(422));
  assert.throws(
    () => validateLabAnswer({ output: "x".repeat(8193) }),
    fault(422),
  );
  assert.deepEqual(validateLabAnswer({ output: "6" }), { output: "6" });
});
test("B physics scalar reference must match the visible model identity", () => {
  const reference = {
    topic: "kinematics_1d",
    formula: "constant_velocity_displacement",
    quantity: "displacement",
    expectedDimension: "length",
    expectedValueSI: "12",
    expectedUnit: "m",
    tolerance: "0",
    givens: { v: "3", t: "4" },
  };
  const valid = wrap("physics", {
    ...physicsDomain,
    privateValidation: { reference },
  });
  assert.equal(
    publicLabActivity(valid, "revision", 0).domainSpec.quantity,
    "displacement",
  );
  assert.throws(
    () =>
      parseLabBlock(
        wrap("physics", {
          ...physicsDomain,
          privateValidation: {
            reference: {
              ...reference,
              givens: { v: "6", t: "4" },
              expectedValueSI: "24",
            },
          },
        }),
        "physics",
      ),
    fault(422),
  );
});
test("B GET-only lesson exposure blocks equivalent physics contexts across families", async () => {
  const seen = new Date("2026-11-08T00:00:00Z"),
    lab = wrap("physics", physicsDomain);
  let queries = 0;
  const tx = {
    $queryRaw: async () =>
      ++queries === 1
        ? []
        : [{ payload: { contentBlocks: [{ lab }] }, exposed_at: seen }],
  };
  const exposures = await readLabExposures(tx, "guest:synthetic");
  assert.equal(exposures.length, 1);
  assert.equal(exposures[0].family, lab.familyCode);
  assert.ok(exposures[0].contexts.length >= 2);
  assert.equal(exposures[0].contexts[0].at, seen.toISOString());
});
test("B reuses A1 guided practice for nonexecuting coding, never independent Python", () => {
  const base = {
    activityKind: "guided_practice",
    lessonRevisionId: "lesson",
    skillCode: "PY-LOOPS",
    reasonCode: "subject_lab_practice",
    published: true,
    mappingPending: false,
    questionCoverage: 0,
    novel: false,
    reviewed: true,
    subject: "programming",
  };
  assert.equal(decideActivity([base]).chosen, null);
  assert.equal(
    decideActivity([{ ...base, labKind: "code_trace", labBlockIndex: 0 }])
      .chosen.activityKind,
    "guided_practice",
  );
  assert.equal(
    decideActivity([
      {
        ...base,
        activityKind: "independent_check",
        labKind: "code_trace",
        labBlockIndex: 0,
      },
    ]).chosen,
    null,
  );
});
test("B capabilities stay closed with flags absent and reject real-learning storage", async () => {
  const names = [
    "MATH_LAB_ENABLED",
    "PHYSICS_LAB_ENABLED",
    "CODING_LAB_NONEXEC_ENABLED",
  ];
  const old = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    for (const name of names) delete process.env[name];
    const actor = { ownerKey: "guest:test", guestAuth: {}, userId: null };
    const store = {
      syntheticData: true,
      authorizeInTransaction: async () => {},
      db: { $transaction: async (fn) => fn({}) },
    };
    const service = new StemLabService(store, { actor: async () => actor }, {});
    const capabilities = await service.capabilities({ headers: {} });
    assert.equal(capabilities.math, false);
    assert.equal(capabilities.physics, false);
    assert.equal(capabilities.codingNonExecuting, false);
    assert.equal(capabilities.runnerBridge, false);
    assert.equal(capabilities.phet, false);
    store.syntheticData = false;
    await assert.rejects(service.capabilities({ headers: {} }), fault(403));
  } finally {
    for (const name of names)
      if (old[name] === undefined) delete process.env[name];
      else process.env[name] = old[name];
  }
});

test("B negative-velocity distance exposure covers signed and magnitude givens without changing positive contexts", () => {
  const { physicsExposureKey } = require("../dist/physics-learning.js");
  const lab = wrap("physics", physicsDomain);
  const negative = physicsLabContextKeys(lab, { v_mps: -3, t_s: 4, x0_m: 0 });
  for (const v of ["-3", "3", "−٣"])
    assert.ok(
      negative.includes(
        physicsExposureKey({
          physics: {
            formula: "constant_speed_distance",
            quantity: "distance",
            givens: { v, t: "4" },
          },
        }),
      ),
      v,
    );
  assert.equal(negative.length, 3);
  assert.equal(new Set(negative).size, negative.length);
  const positive = physicsLabContextKeys(lab, { v_mps: 3, t_s: 4, x0_m: 0 });
  assert.equal(positive.length, 2);
  assert.ok(
    positive.includes(
      physicsExposureKey({
        physics: {
          formula: "constant_speed_distance",
          quantity: "distance",
          givens: { v: "3", t: "4" },
        },
      }),
    ),
  );
  assert.equal(
    negative.includes(
      physicsExposureKey({
        physics: {
          formula: "constant_velocity_displacement",
          quantity: "displacement",
          givens: { v: "3", t: "4" },
        },
      }),
    ),
    false,
  );
});

test("B exposure families are scoped to their subject even when algebra and physics share a family code", async () => {
  const seen = new Date("2026-11-08T00:00:00Z");
  const labs = [wrap("physics", physicsDomain), wrap("algebra", math[0])];
  assert.equal(labs[0].familyCode, labs[1].familyCode);
  const transaction = () => {
    let query = 0;
    return {
      $queryRaw: async () =>
        ++query === 1
          ? labs.map((lab) => ({
              family: lab.familyCode,
              subject: lab.subject,
              created_at: seen,
              contexts: [],
            }))
          : [
              {
                payload: { contentBlocks: labs.map((lab) => ({ lab })) },
                exposed_at: seen,
              },
            ],
    };
  };
  const all = await readLabExposures(transaction(), "guest:synthetic");
  assert.equal(all.length, 4);
  for (const subject of ["algebra", "physics"]) {
    const scoped = await readLabExposures(
      transaction(),
      "guest:synthetic",
      subject,
    );
    assert.equal(scoped.length, 2);
    assert.ok(scoped.every((exposure) => exposure.subject === subject));
    assert.ok(
      scoped.every((exposure) => exposure.family === labs[0].familyCode),
    );
  }
});
