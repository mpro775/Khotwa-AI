import assert from "node:assert/strict";
import test from "node:test";
import Module, { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Transpile repository-owned UI modules; all fixture strings remain inert data.
const cache = new Map();
function trustedModule(file) {
  if (cache.has(file)) return cache.get(file);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
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
const decoders = trustedModule(source("intelligent-learning-api.ts"));
const { ProductFault } = trustedModule(source("product-api.ts"));
const { clearLearningStorage } = trustedModule(source("product-session.ts"));
const { MasteryDimensions, KnowledgeGraphView } = trustedModule(
  source("IntelligentLearningPanel.tsx"),
);
const { LessonRenderer } = trustedModule(source("LessonRenderer.tsx"));
const { lessonBlock } = trustedModule(source("learning-path-api.ts"));
const base = {
  id: "item",
  revision: 1,
  trackRevisionId: "track",
  lessonRevisionId: "lesson",
  skillCode: "SK-ALG-04",
};
const mastery = {
  trackRevisionId: "track",
  modelVersion: "mastery-a2-v1",
  evidenceFingerprint: "opaque",
  computedAt: "2026-11-08T00:00:00Z",
  skills: [
    {
      skillCode: "SK-ALG-04",
      titleAr: '<img src=x onerror="bad()">',
      dimensions: {
        exposure: "seen",
        supportedPractice: "observed",
        independentPerformance: "none",
        transfer: "not_tested",
        retention: "not_due",
        evidenceQuality: "insufficient",
      },
      counts: { assisted: 1, eligibleIndependent: 0, independentErrors: 0 },
      evidenceIds: ["evidence"],
      reasonCodes: ["needs_independent_evidence"],
      masteryProbability: 1,
    },
  ],
};

test("A1 public decision/activity decoders exclude private keys and reject unknown activity kinds", () => {
  const decision = {
    ...base,
    decisionId: "decision",
    policyVersion: "a1-v1",
    evidenceFingerprint: "fingerprint",
    mappingSnapshotHash: "map",
    activityKind: "independent_check",
    sourceAttemptId: null,
    reasonCode: "new_check",
    reasonAr: "مسألة جديدة",
    alternatives: [],
    expiresAt: "2026-11-08T12:00:00Z",
    privateRules: "secret",
    correctAnswer: "secret",
    ownerKey: "other",
  };
  const value = decoders.decisionData(decision);
  for (const key of ["privateRules", "correctAnswer", "ownerKey"])
    assert.equal(key in value, false);
  assert.equal(value.activityKind, "independent_check");
  assert.throws(
    () => decoders.decisionData({ ...decision, activityKind: "grant_mastery" }),
    /invalid_response/,
  );
  const activity = decoders.activityData({
    ...base,
    decisionId: "decision",
    sourceAttemptId: null,
    activityKind: "guided_practice",
    status: "active",
    assessmentId: null,
    assistanceLevel: 1,
    createdAt: "now",
    hiddenTests: ["private"],
  });
  assert.equal("hiddenTests" in activity, false);
});
test("A2 assisted evidence does not become independent or a percentage in the rendered UI", () => {
  const value = decoders.masteryData(mastery),
    skill = value.skills[0];
  assert.equal(skill.dimensions.independentPerformance, "none");
  assert.equal("masteryProbability" in skill, false);
  const html = renderToStaticMarkup(
    React.createElement(MasteryDimensions, { value }),
  );
  assert.ok(html.includes("لم يتوفر دليل مستقل بعد"));
  assert.ok(html.includes("ظهر نجاح مدعوم"));
  assert.ok(html.includes("لم يحن وقت قياس الاحتفاظ"));
  assert.ok(html.includes("&lt;img"));
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("100%"), false);
});
test("A2 malformed dimension cannot be shown as trusted progress", () => {
  const value = structuredClone(mastery);
  value.skills[0].dimensions.retention = "permanently_mastered";
  assert.throws(() => decoders.masteryData(value), /invalid_response/);
});
test("A3 diagnosis projection keeps hypotheses tentative and strips probe answers", () => {
  const value = decoders.diagnosisData({
    attemptId: "attempt",
    attemptRevision: 4,
    state: "unresolved",
    candidateCauses: [
      {
        errorCode: "ERR-ALG-01",
        candidateSkillCodes: ["SK-ALG-04"],
        basisEvidenceIds: ["e"],
        confidenceLabel: "possible",
        correctAnswer: "secret",
      },
    ],
    probeId: null,
    nextIntervention: "no_safe_probe",
    policyVersion: "a3-v1",
    rules_json: "secret",
  });
  assert.equal(value.candidateCauses[0].confidenceLabel, "possible");
  assert.equal("correctAnswer" in value.candidateCauses[0], false);
  assert.equal("rules_json" in value, false);
});
test("A4 graph renders reviewed coverage only as actionable lesson links", () => {
  const value = decoders.graphData({
    trackRevisionId: "track",
    graphVersion: "v1",
    mappingSnapshotHash: "map",
    nodes: [
      {
        skillCode: "a",
        titleAr: "الدرس المنشور",
        subject: "algebra",
        lessonRevisionId: "published",
        reviewState: "reviewed",
      },
      {
        skillCode: "b",
        titleAr: "مهارة معلقة",
        subject: "algebra",
        lessonRevisionId: "pending",
        reviewState: "mapping_pending",
      },
      {
        skillCode: "c",
        titleAr: "مهارة ثانوية",
        subject: "algebra",
        lessonRevisionId: null,
        reviewState: "missing_coverage",
      },
    ],
    edges: [
      {
        fromSkill: "a",
        toSkill: "b",
        relationKind: "helpful",
        rationaleAr: "رابط مساعد",
        reviewState: "pending",
      },
    ],
    issues: ["missing_coverage"],
    draftLesson: "private",
  });
  const html = renderToStaticMarkup(
    React.createElement(KnowledgeGraphView, { value, onOpenLesson() {} }),
  );
  assert.equal((html.match(/<button/g) ?? []).length, 1);
  assert.ok(html.includes("لا يوجد درس أساسي منشور مرتبط"));
  assert.ok(html.includes("مهارة مساعدة"));
  assert.equal("draftLesson" in value, false);
});
test("A5 scheduled/deferred review states do not invent retention success", () => {
  const value = decoders.reviewData({
    ...base,
    sourceEvidenceId: "e",
    policyVersion: "spacing-test-v1",
    dueAt: "2026-11-09T00:00:00Z",
    status: "deferred",
    assessmentId: null,
    retentionOutcome: "not_tested",
    anchorAt: "2026-11-08T00:00:00Z",
    stepIndex: 0,
    correctAnswer: "secret",
  });
  assert.equal(value.retentionOutcome, "not_tested");
  assert.equal("correctAnswer" in value, false);
  assert.throws(
    () => decoders.reviewData({ ...value, retentionOutcome: "forgotten" }),
    /invalid_response/,
  );
});
test("A6 scaffold decoder and completion renderer disclose only approved visible fields", () => {
  const scaffold = decoders.scaffoldData({
    ...base,
    stage: "S1",
    status: "active",
    contentVersion: 1,
    problemRaw: "٣(س + ٢) = ١٢",
    visibleSteps: [
      {
        raw: "٣س + ٦ = ١٢",
        explanationAr: "خطوة مهيأة",
        hiddenAnswer: "private",
      },
    ],
    supportCount: 1,
    assessmentId: null,
    independentEligible: false,
    messageAr: "تدريب مدعوم",
    allSteps: ["private"],
  });
  assert.equal("allSteps" in scaffold, false);
  assert.equal(scaffold.problemRaw, "٣(س + ٢) = ١٢");
  assert.equal(
    decoders.scaffoldData({ ...scaffold, problemRaw: null }).problemRaw,
    null,
  );
  assert.throws(
    () => decoders.scaffoldData({ ...scaffold, problemRaw: 12 }),
    /invalid_response/,
  );
  assert.equal("hiddenAnswer" in scaffold.visibleSteps[0], false);
  const payload = {
    kind: "lesson",
    subject: "algebra",
    code: "ALG-L04",
    titleAr: "أكمل خطوة",
    descriptionAr: "",
    objectives: [],
    skillCodes: [],
    prerequisiteSkillCodes: [],
    prerequisiteLessonIds: [],
    contentBlocks: [
      lessonBlock({
        type: "completion_step",
        textAr: "أكمل التوزيع",
        raw: "٣(س + ٢) = ١٢",
        steps: [{ raw: "SECRET-SOLUTION", explanationAr: "private" }],
      }),
      lessonBlock({ type: "self_check_prompt", textAr: "ما سبب هذه الخطوة؟" }),
    ],
    practiceProblemRevisionIds: [],
    assessmentProblemRevisionIds: [],
    errorCodes: [],
    mappingPending: [],
  };
  const html = renderToStaticMarkup(
    React.createElement(LessonRenderer, { payload }),
  );
  assert.ok(html.includes("٣(س + ٢) = ١٢"));
  assert.equal(html.includes("SECRET-SOLUTION"), false);
  assert.ok(html.includes("ولا يُحسب قياسًا مستقلًا"));
});
test("A7 tutor is assisted, local, bounded and cannot silently accept an external verdict", () => {
  const session = {
    ...base,
    state: "awaiting_student",
    hintLevel: 1,
    turnCount: 1,
    maxTurns: 6,
    assistance: true,
    source: "offline_reviewed_template",
    turns: [{ role: "tutor", textAr: "ماذا يحدث للحد الثاني؟", hintLevel: 1 }],
    assessmentId: null,
    messageAr: "فكر معي",
    isCorrect: true,
    answerRaw: "secret",
  };
  const value = decoders.tutorData(session);
  assert.equal("isCorrect" in value, false);
  assert.equal("answerRaw" in value, false);
  assert.throws(
    () => decoders.tutorData({ ...session, assistance: false }),
    /invalid_response/,
  );
  assert.throws(
    () => decoders.tutorData({ ...session, source: "unreviewed_llm" }),
    /invalid_response/,
  );
  assert.throws(
    () => decoders.tutorData({ ...session, hintLevel: 5 }),
    /invalid_response/,
  );
});
test("A8 confidence/self-report remains separate from canonical outcome", () => {
  const value = decoders.reflectionData({
    id: "r",
    trackRevisionId: "track",
    activityId: "a",
    goalId: null,
    phase: "reflect",
    confidence: 100,
    textAr: "أنا متأكد تمامًا",
    skipped: false,
    verifiedOutcome: "error",
    messageAr: "توقعك مختلف عن نتيجة السؤال",
    createdAt: "now",
    masteryPercent: 100,
  });
  assert.equal(value.confidence, 100);
  assert.equal(value.verifiedOutcome, "error");
  assert.equal("masteryPercent" in value, false);
});
test("A8 editing a goal submits CAS without replacing its original evidence baseline", async () => {
  const original = {
    ...base,
    targetIndependentCount: 2,
    textAr: "هدف أول",
    status: "active",
    independentCount: 1,
    createdAt: "2026-11-08T00:00:00Z",
    updatedAt: "2026-11-08T00:00:00Z",
    baselineEvidenceIds: ["original-evidence"],
    baselineProblemIds: ["original-problem"],
  };
  let sent;
  const updated = await decoders.updateLearningGoal(
    {
      async request(path, decode, method, body) {
        sent = { path, method, body };
        return decode({
          ...original,
          revision: 2,
          targetIndependentCount: 3,
          textAr: "هدف معدل",
        });
      },
    },
    original,
    "هدف معدل",
    3,
  );
  assert.equal(sent.path, "/learning/goals/item/update");
  assert.equal(sent.method, "POST");
  assert.deepEqual(sent.body, {
    expectedRevision: 1,
    textAr: "هدف معدل",
    targetIndependentCount: 3,
  });
  assert.equal("baselineEvidenceIds" in updated, false);
  assert.equal(updated.independentCount, 1);
  assert.equal(updated.revision, 2);
  assert.equal(original.textAr, "هدف أول");
});
test("A/UI flag-off handling preserves the legacy path without suppressing network failures", () => {
  assert.equal(
    decoders.featureUnavailable(new ProductFault(403, "forbidden", "مغلق")),
    true,
  );
  assert.equal(
    decoders.featureUnavailable(new ProductFault(404, "not_found", "مغلق")),
    true,
  );
  assert.equal(
    decoders.featureUnavailable(
      new ProductFault(503, "service_unavailable", "غير متاح"),
    ),
    false,
  );
  assert.equal(decoders.featureUnavailable(new Error("offline")), false);
});
test("A/UI A1-off keeps A2 and A5 available without preloading any question bank", async () => {
  const paths = [];
  const result = await decoders.loadIntelligentFeatures(
    {
      async request(path, decode) {
        paths.push(path);
        if (path.startsWith("/learning/mastery?")) return decode(mastery);
        if (path.startsWith("/learning/reviews/due?"))
          return decode({ policyVersion: "spacing-v1", reviews: [] });
        throw new ProductFault(403, "forbidden", "الميزة مغلقة");
      },
    },
    "track-with-independent-flags",
  );
  assert.equal(result.decision, null);
  assert.equal(
    result.mastery.skills[0].dimensions.supportedPractice,
    "observed",
  );
  assert.deepEqual(result.reviews.reviews, []);
  assert.deepEqual(result.errors, []);
  assert.equal(paths.length, 6);
  assert.equal(
    paths.some((path) => /catalog|bank|assessments|lessons\//.test(path)),
    false,
  );
});
test("A/SEC resume IDs are track-scoped and cleared on identity switch", () => {
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      get length() {
        return values.size;
      },
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => values.delete(key),
    };
  decoders.writeIntelligentResume(storage, "track-a", {
    activityId: "owned-activity",
    tutorId: "owned-tutor",
  });
  assert.equal(
    decoders.readIntelligentResume(storage, "track-a").activityId,
    "owned-activity",
  );
  assert.deepEqual(decoders.readIntelligentResume(storage, "track-b"), {});
  values.set("khotwa-path:a:bad", '{"activityId":true}');
  assert.deepEqual(decoders.readIntelligentResume(storage, "bad"), {});
  clearLearningStorage(storage);
  assert.equal(values.size, 0);
});
