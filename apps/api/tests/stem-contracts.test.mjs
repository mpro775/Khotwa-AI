import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const require = createRequire(import.meta.url);
require("reflect-metadata");
const { publicLabActivity } = require("../dist/stem/lab-registry.js");
const { StemLabController } = require("../dist/stem/lab-service.js");
const { simulatePhysicsModel } = require("../dist/stem/physics-inquiry.js");
const { revealMathActivity } = require("../dist/stem/math-lab.js");
const spec = parse(
  readFileSync(
    new URL("../../../docs/12-API-CONTRACT.yaml", import.meta.url),
    "utf8",
  ),
);
const fixtures = JSON.parse(
  readFileSync(
    new URL("fixtures/stem-models.v1.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat("int32", { type: "number", validate: Number.isInteger });
ajv.addSchema({ $id: "stem-contract", components: spec.components });
const cache = new Map();
function check(name, value) {
  if (!cache.has(name))
    cache.set(
      name,
      ajv.compile({ $ref: "stem-contract#/components/schemas/" + name }),
    );
  return cache.get(name)(value);
}
const uid = "11111111-1111-4111-8111-111111111111";
const envelope = (data) => ({
  data,
  meta: { requestId: uid, serverTime: "2026-11-08T12:00:00Z", apiVersion: "1" },
});
const meta = (subject, labKind, domainSpec) => ({
  schemaVersion: "subject-lab-v1",
  subject,
  labKind,
  objectiveAr: "نشاط اصطناعي للتجربة",
  familyCode: "synthetic-family",
  skillCodes: [
    subject === "algebra"
      ? "SK-ALG-04"
      : subject === "physics"
        ? "PHYS-CONSTANT_MOTION"
        : "PY-LOOPS",
  ],
  ...(domainSpec ? { domainSpec } : {}),
});
const physicsDomain = {
  kind: "physics_prediction_experiment_v1",
  model: fixtures.physics.positiveVelocity,
  predictionPromptAr: "ما توقعك؟",
  observationPromptAr: "ماذا لاحظت؟",
  explanationPromptAr: "كيف تفسر ذلك؟",
  assumptionsAr: ["حركة أحادية البعد"],
  controlledVariables: ["السرعة"],
};
const session = (activity) => ({
  id: uid,
  revision: 0,
  trackRevisionId: uid,
  lessonRevisionId: uid,
  blockIndex: 0,
  subject: activity.subject,
  labKind: activity.labKind,
  stage: "opened",
  activity,
  prediction: null,
  parameters: {},
  observation: null,
  explanation: null,
  assistanceLevel: 0,
  resultRevealed: false,
  artifact: null,
  result: null,
  answer: null,
  evidenceClass: "learning_only",
  transfer: {
    available: false,
    reasonCode:
      activity.subject === "programming"
        ? "runner_gate_blocked"
        : "insufficient_novel_bank",
  },
});

test("B operations remain compatible in contract v1.5 and later additive v1 releases", () => {
  const [major, minor] = spec.info.version.split(".");
  assert.equal(major, "1");
  assert.ok(Number(minor) >= 5, "STEM requires contract 1.5 or later");
  const canonical = Object.keys(spec.paths).filter((path) =>
    path.startsWith("/api/v1/learning/labs/"),
  );
  assert.equal(canonical.length, 7);
  const methods = { 0: "get", 1: "post" };
  for (const name of Object.getOwnPropertyNames(StemLabController.prototype)) {
    if (name === "constructor") continue;
    const handler = StemLabController.prototype[name];
    const path =
      "/" +
      Reflect.getMetadata("path", StemLabController) +
      "/" +
      Reflect.getMetadata("path", handler).replace(":id", "{id}");
    const method = methods[Reflect.getMetadata("method", handler)];
    const operation = spec.paths[path]?.[method];
    assert.ok(operation, `${method} ${path}`);
    assert.ok(operation.responses["200"]);
    assert.deepEqual(operation.security, [
      { GuestCookie: [] },
      { AccountCookie: [] },
    ]);
    for (const code of ["401", "403", "404", "409", "422", "429", "503"])
      assert.ok(operation.responses[code]);
    if (method === "post") {
      assert.ok(
        operation.parameters.some((parameter) =>
          parameter.$ref?.endsWith("/Csrf"),
        ),
      );
      assert.ok(
        operation.parameters.some((parameter) =>
          parameter.$ref?.endsWith("/Idempotency"),
        ),
      );
    }
  }
  assert.equal(
    spec.paths["/api/v1/learning/labs/activities/{id}"].get.parameters.find(
      (p) => p.name === "blockIndex",
    ).required,
    true,
  );
});
test("B schemas compile and preserve the existing strict A contracts with optional lab targets", () => {
  for (const name of Object.keys(spec.components.schemas).filter(
    (name) => name.startsWith("Stem") || name.startsWith("LPAuthor"),
  ))
    assert.doesNotThrow(() => check(name, null), name);
  for (const name of [
    "AActivityAlternative",
    "ANextActivityDecision",
    "ALearningActivity",
  ]) {
    assert.equal(spec.components.schemas[name].additionalProperties, false);
    assert.equal(
      spec.components.schemas[name].properties.labBlockIndex.maximum,
      49,
    );
    assert.ok(spec.components.schemas[name].properties.labKind);
    assert.equal(
      spec.components.schemas[name].required.includes("labBlockIndex"),
      false,
    );
  }
});
test("B strict public activity union accepts actual projections and rejects hidden keys or a mismatched subject/kind", () => {
  const authored = [
    meta("physics", physicsDomain.kind, physicsDomain),
    ...Object.values(fixtures.coding).map((coding) =>
      meta("programming", coding.kind, coding),
    ),
    meta("algebra", "math_linear_graph_v1", {
      kind: "math_linear_graph_v1",
      model: {
        modelVersion: "linear_function_v1",
        a: 2,
        b: 1,
        xMin: -1,
        xMax: 1,
        step: 1,
      },
    }),
  ];
  for (const block of authored) {
    assert.equal(
      check("StemLabAuthorBlock", block),
      true,
      JSON.stringify(cache.get("StemLabAuthorBlock").errors),
    );
    const activity = publicLabActivity(block, uid, 0);
    assert.equal(
      check("StemLabActivityEnvelope", envelope(activity)),
      true,
      JSON.stringify(cache.get("StemLabActivityEnvelope").errors),
    );
    assert.equal(
      check("StemLabActivity", { ...activity, privateValidation: {} }),
      false,
    );
    assert.equal(
      check("StemLabActivity", {
        ...activity,
        domainSpec: { ...activity.domainSpec, expectedOutput: "secret" },
      }),
      false,
    );
    assert.equal(
      check("StemLabActivity", {
        ...activity,
        subject: block.subject === "algebra" ? "physics" : "algebra",
      }),
      false,
    );
  }
  const activity = publicLabActivity(authored[0], uid, 0);
  assert.equal(
    check("StemLabActivity", { ...activity, labKind: "physics_units_v1" }),
    false,
  );
});
test("B author/public lesson split requires domainSpec only for Studio and never on a student block", () => {
  const authorLab = meta(
    "programming",
    "parsons_reorder",
    fixtures.coding.parsons,
  );
  const { domainSpec, ...publicLab } = authorLab;
  const publicBlock = {
    type: "subject_lab_activity",
    textAr: "رتب الأسطر",
    lab: publicLab,
  };
  const authorBlock = { ...publicBlock, lab: authorLab };
  assert.equal(check("LPAuthorLessonBlock", authorBlock), true);
  assert.equal(check("LPLessonBlock", publicBlock), true);
  assert.equal(check("LPLessonBlock", authorBlock), false);
  assert.equal(check("LPAuthorLessonBlock", publicBlock), false);
  assert.equal(
    check("LPLessonBlock", {
      type: "subject_lab_activity",
      textAr: "بلا مواصفة",
    }),
    false,
  );
  assert.equal(
    check("LPLessonBlock", { type: "paragraph", textAr: "نص", lab: publicLab }),
    false,
  );
  assert.ok(domainSpec.privateValidation);
  assert.equal(
    spec.paths["/api/v1/studio/learning-content"].post.requestBody.content[
      "application/json"
    ].schema.$ref.endsWith("/LPAuthorLearningContentPayload"),
    true,
  );
});
test("B Parsons schema rejects solved source while retaining only shuffled public line items", () => {
  const activity = publicLabActivity(
    meta("programming", "parsons_reorder", fixtures.coding.parsons),
    uid,
    0,
  );
  assert.equal("sourceCode" in activity.domainSpec, false);
  assert.equal(check("StemLabActivity", activity), true);
  assert.equal(
    check("StemLabActivity", {
      ...activity,
      domainSpec: {
        ...activity.domainSpec,
        sourceCode: fixtures.coding.parsons.sourceCode,
      },
    }),
    false,
  );
});
test("B event and submit schemas require CAS and allowlisted bounded payloads without client verdicts", () => {
  const event = {
    expectedRevision: 0,
    eventKind: "prediction_submitted",
    payload: { textAr: "لا أعرف" },
  };
  assert.equal(check("StemLabEventInput", event), true);
  assert.equal(
    check("StemLabEventInput", { ...event, expectedRevision: undefined }),
    false,
  );
  assert.equal(
    check("StemLabEventInput", {
      ...event,
      payload: { ...event.payload, verdict: "correct" },
    }),
    false,
  );
  assert.equal(
    check("StemLabEventInput", { ...event, eventKind: "unknown" }),
    false,
  );
  assert.equal(
    check("StemLabEventInput", {
      expectedRevision: 0,
      eventKind: "trace_step_revealed",
      payload: { index: 100 },
    }),
    false,
  );
  assert.equal(
    check("StemLabEventInput", {
      ...event,
      payload: { textAr: "أ".repeat(1001) },
    }),
    false,
  );
  assert.equal(
    check("StemLabStartInput", {
      trackRevisionId: uid,
      lessonRevisionId: uid,
      blockIndex: 50,
    }),
    false,
  );
  assert.equal(
    check("StemLabSubmitInput", {
      expectedRevision: 0,
      answer: { output: "6" },
    }),
    true,
  );
  for (const answer of [
    { output: "6", verdict: "correct" },
    { expectedOutput: "6" },
    { hiddenTests: [] },
    { sourceCode: "arbitrary()" },
  ])
    assert.equal(
      check("StemLabSubmitInput", { expectedRevision: 0, answer }),
      false,
    );
});
test("B session schema enforces neutral evidence and forbids premature artifacts or runner capability", () => {
  const physics = session(
    publicLabActivity(
      meta("physics", physicsDomain.kind, physicsDomain),
      uid,
      0,
    ),
  );
  assert.equal(check("StemLabSessionEnvelope", envelope(physics)), true);
  const revealed = {
    ...physics,
    prediction: "تزداد",
    resultRevealed: true,
    stage: "revealed",
    artifact: simulatePhysicsModel(physicsDomain.model),
  };
  assert.equal(
    check("StemLabSession", revealed),
    true,
    JSON.stringify(cache.get("StemLabSession").errors),
  );
  assert.equal(
    check("StemLabSession", { ...revealed, resultRevealed: false }),
    false,
  );
  assert.equal(
    check("StemLabSession", { ...physics, evidenceClass: "independent" }),
    false,
  );
  assert.equal(
    check("StemLabSession", {
      ...physics,
      transfer: {
        available: true,
        reasonCode: "insufficient_novel_bank",
      },
    }),
    false,
  );
  const capabilities = {
    schemaVersion: "subject-lab-v1",
    math: false,
    physics: false,
    codingNonExecuting: false,
    runnerBridge: false,
    phet: false,
    reasonCode: "synthetic_review_required",
  };
  assert.equal(
    check("StemLabCapabilitiesEnvelope", envelope(capabilities)),
    true,
  );
  assert.equal(
    check("StemLabCapabilities", { ...capabilities, runnerBridge: true }),
    false,
  );
  assert.equal(
    check("StemLabCapabilities", { ...capabilities, phet: true }),
    false,
  );
  assert.equal(
    check("StemLabSession", {
      ...physics,
      transfer: {
        available: true,
        reasonCode: "assessment_service_rechecks_novelty",
      },
    }),
    true,
  );
});
test("B browser validators reach public STEM schemas only, never author rubrics or expected outputs", () => {
  const browser = JSON.parse(
    readFileSync(
      new URL("../../../apps/web/src/api-schemas.json", import.meta.url),
      "utf8",
    ),
  ).components.schemas;
  for (const name of [
    "StemLabCapabilitiesEnvelope",
    "StemLabActivityEnvelope",
    "StemLabSessionEnvelope",
  ])
    assert.ok(browser[name]);
  for (const name of Object.keys(browser))
    assert.equal(
      name.startsWith("Stem") && name.includes("Author"),
      false,
      name,
    );
  const visited = new Set(),
    queue = ["StemLabActivityEnvelope", "StemLabSessionEnvelope"];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.$ref) queue.push(value.$ref.split("/").at(-1));
    if (value.properties)
      for (const key of [
        "privateValidation",
        "privateRubric",
        "expectedOutput",
        "hiddenTests",
        "correctPatchIds",
        "validOrders",
        "precedence",
      ])
        assert.equal(Object.hasOwn(value.properties, key), false, key);
    for (const child of Object.values(value)) visit(child);
  };
  while (queue.length) {
    const name = queue.pop();
    if (visited.has(name)) continue;
    visited.add(name);
    assert.ok(browser[name], name);
    visit(browser[name]);
  }
});

test("B math support is valid only after durable disclosure, and equivalence fallback remains typed", () => {
  const authored = {
    kind: "math_why_question_v1",
    fromRaw: "٢س=٨",
    toRaw: "س=٤",
    choices: [{ id: "divide", textAr: "قسمنا الطرفين على اثنين" }],
    privateValidation: {
      acceptedChoiceIds: ["divide"],
      reasonAr: "حافظنا على المساواة.",
    },
  };
  const activity = publicLabActivity(
    meta("algebra", authored.kind, authored),
    uid,
    0,
  );
  const saved = session(activity);
  saved.artifact = revealMathActivity(authored);
  assert.equal(check("StemLabSession", saved), false);
  saved.resultRevealed = true;
  saved.assistanceLevel = 1;
  saved.stage = "revealed";
  assert.equal(
    check("StemLabSession", saved),
    true,
    JSON.stringify(cache.get("StemLabSession").errors),
  );
  const equivalent = {
    kind: "math_equivalence_probe_v1",
    fromRaw: "٢س=٨",
    toRaw: "س=٤",
  };
  saved.activity = publicLabActivity(
    meta("algebra", equivalent.kind, equivalent),
    uid,
    0,
  );
  saved.labKind = equivalent.kind;
  saved.artifact = revealMathActivity(equivalent);
  assert.equal(
    check("StemLabSession", saved),
    true,
    JSON.stringify(cache.get("StemLabSession").errors),
  );
});

test("B account export includes safe owner lab history while rejecting answers, artifacts and private specs", () => {
  const coding = session(
    publicLabActivity(
      meta("programming", "code_trace", fixtures.coding.trace),
      uid,
      0,
    ),
  );
  const safe = Object.fromEntries(
    [
      "id",
      "revision",
      "trackRevisionId",
      "lessonRevisionId",
      "blockIndex",
      "subject",
      "labKind",
      "stage",
      "prediction",
      "observation",
      "explanation",
      "assistanceLevel",
      "evidenceClass",
    ].map((key) => [key, coding[key]]),
  );
  safe.updatedAt = "2026-11-08T12:00:00Z";
  assert.equal(check("StemLabExport", safe), true);
  for (const key of ["answer", "artifact", "domainSpec", "privateValidation"])
    assert.equal(
      check("StemLabExport", { ...safe, [key]: { secret: "hidden" } }),
      false,
    );
  const validate = ajv.compile({
    components: spec.components,
    ...spec.components.schemas.AccountExportEnvelope.properties.data.properties
      .intelligentLearning,
  });
  assert.equal(
    validate({ goals: [], reflections: [], labs: [safe], truncated: false }),
    true,
  );
  assert.equal(
    validate({ goals: [], reflections: [], truncated: false }),
    false,
  );
});

test("B physics value/unit activities publish only quantity and unit allowlist, never the private reference", () => {
  const domain = structuredClone(physicsDomain);
  domain.kind = "physics_units_v1";
  domain.privateValidation = {
    reference: {
      topic: "kinematics_1d",
      formula: "constant_velocity_displacement",
      quantity: "displacement",
      expectedDimension: "length",
      expectedValueSI: "12",
      expectedUnit: "m",
      tolerance: "0",
      givens: { v: "3", t: "4" },
    },
  };
  const activity = publicLabActivity(
    meta("physics", domain.kind, domain),
    uid,
    0,
  );
  assert.equal(activity.domainSpec.quantity, "displacement");
  assert.ok(activity.domainSpec.allowedUnits.includes("m"));
  assert.equal(
    check("StemLabActivity", activity),
    true,
    JSON.stringify(cache.get("StemLabActivity").errors),
  );
  assert.equal("privateValidation" in activity.domainSpec, false);
  assert.equal(
    check("StemLabActivity", {
      ...activity,
      domainSpec: { ...activity.domainSpec, quantity: "force" },
    }),
    false,
  );
});
