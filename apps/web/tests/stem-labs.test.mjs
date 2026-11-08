import assert from "node:assert/strict";
import test from "node:test";
import Module, { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const cache = new Map();
function trustedModule(file) {
  if (cache.has(file)) return cache.get(file);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const mod = new Module(file),
    require = createRequire(file);
  cache.set(file, mod.exports);
  mod.require = (name) => {
    if (name.endsWith(".css")) return {};
    const local = [".ts", ".tsx"]
      .map((extension) => resolve(dirname(file), name + extension))
      .find(existsSync);
    return name.startsWith(".") && local ? trustedModule(local) : require(name);
  };
  mod._compile(compiled.outputText, file);
  cache.set(file, mod.exports);
  return mod.exports;
}
const source = (name) =>
  fileURLToPath(new URL(`../src/${name}`, import.meta.url));
const api = trustedModule(source("stem-lab-api.ts"));
const paths = trustedModule(source("learning-path-api.ts"));
const views = trustedModule(source("StemLabs.tsx"));
const geometry = trustedModule(source("stem-lab-view.ts"));
const authoring = trustedModule(source("StemLabAuthoring.tsx"));
const { LessonRenderer } = trustedModule(source("LessonRenderer.tsx"));
const { clearLearningStorage } = trustedModule(source("product-session.ts"));
const intelligent = trustedModule(source("intelligent-learning-api.ts"));

const graph = {
  schemaVersion: "subject-lab-v1",
  activityRevisionId: "lesson",
  blockIndex: 0,
  subject: "algebra",
  labKind: "math_linear_graph_v1",
  objectiveAr: "اربط القيم بالرسم",
  familyCode: "graph",
  skillCodes: ["SK-ALG-05"],
  domainSpec: {
    kind: "math_linear_graph_v1",
    model: {
      modelVersion: "linear_function_v1",
      a: 2,
      b: 1,
      xMin: -1,
      xMax: 1,
      step: 1,
    },
    points: [
      { x: -1, y: -1 },
      { x: 0, y: 1 },
      { x: 1, y: 3 },
    ],
    privateValidation: { answer: "secret" },
  },
};
const session = {
  id: "session-owned",
  revision: 1,
  trackRevisionId: "track",
  lessonRevisionId: "lesson",
  blockIndex: 0,
  subject: "algebra",
  labKind: "math_linear_graph_v1",
  stage: "opened",
  activity: graph,
  prediction: null,
  observation: null,
  explanation: null,
  parameters: { a: 2, b: 1 },
  assistanceLevel: 0,
  resultRevealed: false,
  artifact: {
    points: [
      { x: -1, y: -1 },
      { x: 0, y: 1 },
      { x: 1, y: 3 },
    ],
  },
  result: null,
  evidenceClass: "learning_only",
  transfer: { available: false, reasonCode: "no_fresh_bank" },
};

test("B content decoders retain private author data only in Studio, while the lesson preview discloses no key", () => {
  const lab = {
    ...authoring.newStemLab("programming"),
    objectiveAr: "توقع الناتج",
    familyCode: "draft",
    skillCodes: ["PY-LOOPS"],
  };
  const block = { type: "subject_lab_activity", textAr: "نشاط Python", lab };
  const visible = paths.lessonBlock(block),
    authored = paths.lessonBlock(block, true);
  assert.equal("domainSpec" in visible.lab, false);
  assert.equal(authored.lab.domainSpec.privateValidation.expectedOutput, "6");
  const payload = {
    kind: "lesson",
    subject: "programming",
    code: "PY-LAB",
    titleAr: "درس",
    descriptionAr: "",
    objectives: [],
    skillCodes: [],
    prerequisiteSkillCodes: [],
    prerequisiteLessonIds: [],
    contentBlocks: [authored],
    practiceProblemRevisionIds: [],
    assessmentProblemRevisionIds: [],
    errorCodes: [],
    mappingPending: [],
  };
  const html = renderToStaticMarkup(
    React.createElement(LessonRenderer, { payload, onLab() {} }),
  );
  assert.ok(html.includes("افتح المختبر"));
  assert.equal(html.includes("expectedOutput"), false);
  assert.equal(html.includes("total = 0"), false);
});

test("B1 graph and table use the same signed server values, including zero slope, with accessible labels", () => {
  const points = session.artifact.points;
  const decoded = api.labSession(session);
  assert.deepEqual(decoded.artifact.points, points);
  assert.equal("privateValidation" in decoded.activity.domainSpec, false);
  const html = renderToStaticMarkup(
    React.createElement(views.LabPlot, { points, caption: "ص = ٢س + ١" }),
  );
  assert.equal((html.match(/<circle/g) ?? []).length, 3);
  assert.equal((html.match(/<tr>/g) ?? []).length, 4);
  assert.ok(html.includes('role="img"'));
  assert.ok(html.includes('<th scope="col">س</th>'));
  const zero = geometry.plotGeometry([
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]);
  assert.ok(
    zero.coordinates.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    ),
  );
  assert.equal(new Set(zero.coordinates.map((point) => point.y)).size, 1);
  assert.equal(geometry.plotGeometry([{ x: Infinity, y: 1 }]), null);
  assert.equal(
    geometry.plotGeometry(
      Array.from({ length: 502 }, (_, i) => ({ x: i, y: i })),
    ),
    null,
  );
});

test("B2 a premature artifact remains hidden until prediction/reveal; no client-generated result is accepted", () => {
  const activity = {
    ...graph,
    subject: "physics",
    labKind: "physics_prediction_experiment_v1",
    domainSpec: {
      kind: "physics_prediction_experiment_v1",
      model: {
        schemaVersion: "physics-lab-v1",
        modelCode: "constant_velocity_1d",
        modelVersion: "1.0.0",
      },
      assumptionsAr: ["حركة على محور واحد"],
    },
  };
  const before = {
    ...session,
    subject: "physics",
    labKind: activity.labKind,
    activity,
    artifact: {
      points: [
        { t_s: 0, x_m: 0, v_mps: -3 },
        { t_s: 4, x_m: -12, v_mps: -3 },
      ],
      distance_m: 12,
      displacement_m: -12,
      finalVelocity_mps: -3,
    },
  };
  assert.equal(api.labSession(before).artifact, null);
  const after = api.labSession({
    ...before,
    stage: "revealed",
    prediction: "لا أعرف",
    resultRevealed: true,
  });
  assert.equal(after.artifact.distance_m, 12);
  assert.equal(after.artifact.displacement_m, -12);
  assert.throws(
    () =>
      api.labSession({ ...before, evidenceClass: "independent_assessment" }),
    /invalid_response/,
  );
  assert.throws(
    () =>
      api.labCapabilities({
        schemaVersion: "subject-lab-v1",
        math: true,
        physics: true,
        codingNonExecuting: true,
        runnerBridge: true,
        phet: false,
        reasonCode: "enabled",
      }),
    /invalid_response/,
  );
});

test("B3 Parsons uses shuffled public lines without a solved source; reorder preserves indentation and offers keyboard controls", () => {
  const activity = api.labActivity({
    ...graph,
    subject: "programming",
    labKind: "parsons_reorder",
    domainSpec: {
      kind: "parsons_reorder",
      lineItems: [
        { lineId: "D", text: "print(total)", indentationLevel: 0 },
        { lineId: "C", text: "total += n", indentationLevel: 4 },
      ],
      correctOrder: ["C", "D"],
      hiddenTests: ["secret"],
    },
  });
  assert.equal("sourceCode" in activity.domainSpec, false);
  assert.equal("correctOrder" in activity.domainSpec, false);
  assert.equal("hiddenTests" in activity.domainSpec, false);
  const lines = activity.domainSpec.lineItems,
    next = geometry.moveLabLine(lines, 1, -1);
  assert.equal(next[0].id, "C");
  assert.equal(next[0].indent, 4);
  assert.equal(lines[0].id, "D");
  const html = renderToStaticMarkup(
    React.createElement(views.ParsonsEditor, { lines, onChange() {} }),
  );
  assert.ok(html.includes("لأعلى"));
  assert.ok(html.includes("لأسفل"));
  assert.ok(html.includes("تراجع عن آخر ترتيب"));
  assert.ok(html.includes("    total += n"));
});

test("B3 disclosed trace values and support are projected explicitly; reference answers remain absent", () => {
  const activity = {
    ...graph,
    subject: "programming",
    labKind: "code_trace",
    domainSpec: {
      kind: "code_trace",
      sourceCode: "print(total)",
      traceStepCount: 1,
    },
  };
  const decoded = api.labSession({
    ...session,
    subject: "programming",
    labKind: "code_trace",
    activity,
    resultRevealed: true,
    artifact: {
      traceSteps: [
        {
          lineId: "one",
          variablesDisplay: { n: 3, total: 6, complete: true, missing: null },
          stdoutCumulative: "6",
          explanationAr: "نطبع الناتج",
          secret: "never",
        },
      ],
      privateValidation: { expectedOutput: "secret" },
    },
    answer: {
      output: "6",
      status: "verified_valid",
      privateValidation: { answer: "secret" },
    },
  });
  assert.equal(decoded.artifact.traceSteps[0].variablesDisplay.total, "6");
  assert.equal("secret" in decoded.artifact.traceSteps[0], false);
  assert.deepEqual(decoded.answer, { output: "6" });
  const support = api.labSession({
    ...session,
    resultRevealed: true,
    artifact: {
      revealedSupport: {
        reasonAr: "اطرح من الطرفين",
        completionRaw: "٣س = ٣",
        workedSteps: ["س = ١"],
        acceptedChoiceIds: ["secret"],
      },
    },
  });
  assert.equal(support.artifact.reasonAr, "اطرح من الطرفين");
  assert.equal("acceptedChoiceIds" in support.artifact, false);
});

test("B abstention feedback is neutral and authored prose is escaped in SVG, status and code", () => {
  const raw = '<img src=x onerror="bad()">',
    result = api.labResult({
      result: "cannot_determine",
      domainVerifier: "math-internal-v1",
      reasonCode: "unavailable",
      feedbackAr: raw,
      evidenceClass: "learning_only",
      answerKey: "secret",
    });
  const html = renderToStaticMarkup(
    React.createElement(views.LabOutcome, { result }),
  );
  assert.ok(html.includes("لم نعتبر تعذر التحقق خطأً"));
  assert.ok(html.includes("&lt;img"));
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("answerKey"), false);
  const chart = renderToStaticMarkup(
    React.createElement(views.LabPlot, {
      points: [{ x: 0, y: 1 }],
      caption: raw,
    }),
  );
  assert.equal(chart.includes("<img"), false);
});

test("B resume resource IDs are track/lesson/block scoped and cleared on account switch", () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      get length() {
        return data.size;
      },
      key: (index) => [...data.keys()][index] ?? null,
      removeItem: (k) => data.delete(k),
    };
  geometry.writeLabResume(storage, "track-a", "lesson-a", 0, "owned-session");
  assert.equal(
    geometry.readLabResume(storage, "track-a", "lesson-a", 0),
    "owned-session",
  );
  assert.equal(geometry.readLabResume(storage, "track-b", "lesson-a", 0), null);
  assert.equal(geometry.readLabResume(storage, "track-a", "lesson-a", 1), null);
  clearLearningStorage(storage);
  assert.equal(data.size, 0);
});

test("A1 lab references survive decoding without turning guided practice into a new activity enum", () => {
  const value = intelligent.activityData({
    id: "a",
    revision: 1,
    decisionId: "d",
    trackRevisionId: "t",
    activityKind: "guided_practice",
    lessonRevisionId: "l",
    sourceAttemptId: null,
    skillCode: "SK-ALG-04",
    status: "active",
    assessmentId: null,
    assistanceLevel: 0,
    createdAt: "now",
    labKind: "math_first_error_v1",
    labBlockIndex: 3,
  });
  assert.equal(value.activityKind, "guided_practice");
  assert.equal(value.labBlockIndex, 3);
  assert.equal(value.labKind, "math_first_error_v1");
  assert.throws(
    () => intelligent.activityData({ ...value, labBlockIndex: -1 }),
    /invalid_response/,
  );
});

test("Every author activity kind starts with a complete editable draft template", () => {
  const { parseLabBlock } = trustedModule(
    fileURLToPath(
      new URL("../../api/src/stem/lab-registry.ts", import.meta.url),
    ),
  );
  for (const [subject, kinds] of Object.entries({
    algebra: [
      "math_linear_graph_v1",
      "math_method_comparison_v1",
      "math_first_error_v1",
      "math_why_question_v1",
      "math_completion_v1",
      "math_equivalence_probe_v1",
    ],
    physics: [
      "physics_prediction_experiment_v1",
      "physics_parameter_simulation_v1",
      "physics_graph_to_physics_v1",
      "physics_units_v1",
      "physics_misconception_contrast_v1",
    ],
    programming: [
      "predict_output",
      "code_trace",
      "parsons_reorder",
      "debug_select_fix",
    ],
  })) {
    for (const kind of kinds) {
      const value = authoring.stemDomainTemplate(subject, kind);
      assert.equal(value.kind, kind);
      assert.ok(Object.keys(value).length > 1);
      const validated = parseLabBlock(
        {
          schemaVersion: "subject-lab-v1",
          subject,
          labKind: kind,
          objectiveAr: "مثال اصطناعي للمراجعة",
          familyCode: "draft-lab",
          skillCodes: [
            subject === "algebra"
              ? "SK-ALG-04"
              : subject === "physics"
                ? "PHYS-CONSTANT_MOTION"
                : "PY-LOOPS",
          ],
          domainSpec: value,
        },
        subject,
      );
      assert.equal(validated.labKind, kind);
    }
  }
});

test("B2 scalar exercise exposes its target quantity and its editable template matches the published model", () => {
  const { parseLabBlock, publicLabActivity } = trustedModule(
    fileURLToPath(
      new URL("../../api/src/stem/lab-registry.ts", import.meta.url),
    ),
  );
  const domainSpec = authoring.stemDomainTemplate(
    "physics",
    "physics_units_v1",
  );
  const authored = parseLabBlock(
    {
      schemaVersion: "subject-lab-v1",
      subject: "physics",
      labKind: "physics_units_v1",
      objectiveAr: "احسب الإزاحة",
      familyCode: "units-draft",
      skillCodes: ["PHYS-DISPLACEMENT"],
      domainSpec,
    },
    "physics",
  );
  const visible = api.labActivity(publicLabActivity(authored, "lesson", 0));
  assert.equal(visible.domainSpec.quantity, "displacement");
  assert.equal("privateValidation" in visible.domainSpec, false);
  assert.equal(
    domainSpec.model.parameters.v_mps,
    Number(domainSpec.privateValidation.reference.givens.v),
  );
  assert.equal(
    domainSpec.model.parameters.t_s,
    Number(domainSpec.privateValidation.reference.givens.t),
  );
});

test("B resume keeps separately saved reflection edits and marks the older submitted outcome stale", () => {
  const resumed = geometry.resumeLabReflection({
    observation: "ملاحظة جديدة محفوظة",
    explanation: "تفسير جديد محفوظ",
    answer: {
      observationAr: "ملاحظة التسليم القديم",
      explanationAr: "تفسير التسليم القديم",
    },
    result: { result: "needs_review" },
  });
  assert.equal(resumed.observation, "ملاحظة جديدة محفوظة");
  assert.equal(resumed.explanation, "تفسير جديد محفوظ");
  assert.equal(resumed.stale, true);
  const fallback = geometry.resumeLabReflection({
    observation: null,
    explanation: null,
    answer: {
      observationAr: "آخر ملاحظة مرسلة",
      explanationAr: "آخر تفسير مرسل",
    },
    result: { result: "needs_review" },
  });
  assert.equal(fallback.observation, "آخر ملاحظة مرسلة");
  assert.equal(fallback.explanation, "آخر تفسير مرسل");
  assert.equal(fallback.stale, false);
  assert.equal(
    geometry.resumeLabReflection({
      observation: "مطابق",
      explanation: "مطابق",
      answer: { observationAr: "مطابق", explanationAr: "مطابق" },
      result: { result: "needs_review" },
    }).stale,
    false,
  );
});
