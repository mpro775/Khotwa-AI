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
  const result = ts.transpileModule(readFileSync(file, "utf8"), {
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
  mod._compile(result.outputText, file);
  cache.set(file, mod.exports);
  return mod.exports;
}
const source = (file) =>
  fileURLToPath(new URL(`../src/${file}`, import.meta.url));
const api = trustedModule(source("advanced-learning/advanced-api.ts"));
const author = trustedModule(
  source("advanced-learning/AdvancedContentStudio.tsx"),
);
const preferences = trustedModule(
  source("advanced-learning/display-preferences.ts"),
);
const paths = trustedModule(source("learning-path-api.ts"));
const intelligence = trustedModule(source("intelligent-learning-api.ts"));
const draftCache = trustedModule(source("advanced-learning/draft-cache.ts"));
const { clearLearningStorage } = trustedModule(source("product-session.ts"));
const { LessonRenderer } = trustedModule(source("LessonRenderer.tsx"));
const { RepresentationSwitcher } = trustedModule(
  source("advanced-learning/RepresentationSwitcher.tsx"),
);
const { ProblemJourney } = trustedModule(
  source("advanced-learning/ProblemJourney.tsx"),
);
const { ProjectWorkspace } = trustedModule(
  source("advanced-learning/ProjectWorkspace.tsx"),
);
const { LearningAnalyticsDashboard } = trustedModule(
  source("advanced-learning/LearningAnalyticsDashboard.tsx"),
);
const { ProductApi } = trustedModule(source("product-api.ts"));
const problem = author.newActivity("algebra", ["SK-ALG-05"], "problem_based");
Object.assign(problem, {
  titleAr: "مقارنة عرضين",
  publicBriefAr: "قارن التكلفة ضمن المعطيات.",
  scenarioAr: "متى يتساوى العرضان؟",
  privateEvaluation: {
    solutionKey: "SECRET-ANSWER-3",
    privateRubric: [{ criterionCode: "private", noteAr: "SECRET-RUBRIC" }],
    hiddenTests: [{ input: "hidden", expectedOutput: "SECRET-OUTPUT" }],
    hints: [{ level: "H1", textAr: "SECRET-HINT" }],
  },
});
problem.representations[0] = {
  ...problem.representations[0],
  titleAr: "وصف المهمة",
  accessibleText: "الرسوم ثابتة ثم تزداد مع الوحدات.",
  learningObjective: "مقارنة عرضين",
  textAr: "قارن دون فرض طريقة واحدة.",
};
const project = {
  ...author.newActivity("programming", ["SK-PROG-01"], "project_based"),
  titleAr: "نموذج ميزانية",
  publicBriefAr: "منتج نصي مع مراجعة وتحسين.",
  drivingQuestionAr: "كيف تنظّم الميزانية؟",
};
const lesson = {
  kind: "lesson",
  subject: "algebra",
  code: "lesson",
  titleAr: "درس",
  descriptionAr: "تجربة",
  objectives: ["فهم المقارنة"],
  skillCodes: ["SK-ALG-05"],
  prerequisiteSkillCodes: [],
  prerequisiteLessonIds: [],
  contentBlocks: [
    { type: "problem_activity", textAr: "مشكلة", activity: problem },
  ],
  practiceProblemRevisionIds: [],
  assessmentProblemRevisionIds: [],
  errorCodes: [],
  mappingPending: [],
};
const session = {
  id: "owned-session",
  revision: 2,
  trackRevisionId: "track",
  lessonRevisionId: "lesson",
  blockIndex: 0,
  activity: problem,
  stage: "plan",
  status: "active",
  answers: { frame: "المعطيات", plan: "خطة" },
  assistanceLevel: 0,
  supportAr: null,
  result: null,
  evidenceClass: "learning_only",
  readOnly: false,
  transfer: {
    available: false,
    reasonCode: "assessment_service_rechecks_novelty",
  },
};
test("C public decoder removes keys, rubric, tests, hints at the activity boundary", () => {
  const value = api.activity(problem);
  assert.equal(value.privateEvaluation, undefined);
  assert.doesNotMatch(JSON.stringify(value), /SECRET/);
  assert.equal(
    api.activity(problem, true).privateEvaluation.solutionKey,
    "SECRET-ANSWER-3",
  );
});
test("C lesson public decoding and private author roundtrip share one format", () => {
  const student = paths.learningPayload(lesson);
  assert.equal(student.contentBlocks[0].activity.type, "problem_based");
  assert.doesNotMatch(JSON.stringify(student), /SECRET/);
  assert.equal(
    paths.learningPayload(lesson, true).contentBlocks[0].activity
      .privateEvaluation.solutionKey,
    "SECRET-ANSWER-3",
  );
});
test("C session decoding enforces learning-only evidence and strips private data", () => {
  assert.equal(api.problemSession(session).answers.plan, "خطة");
  assert.doesNotMatch(JSON.stringify(api.problemSession(session)), /SECRET/);
  assert.throws(() =>
    api.problemSession({ ...session, evidenceClass: "independent" }),
  );
});
test("C representations reject a fabricated independent evaluation mode", () => {
  assert.throws(() =>
    api.representation({
      ...problem.representations[0],
      evaluationMode: "independent",
    }),
  );
});
test("C table representation exposes caption, row and column headings and fallback text", () => {
  const variant = {
    ...problem.representations[0],
    kind: "table",
    columns: ["عدد الوحدات", "التكلفة"],
    rows: [
      ["١", "١٥"],
      ["٢", "١٨"],
    ],
  };
  const html = renderToStaticMarkup(
    React.createElement(RepresentationSwitcher, { variants: [variant] }),
  );
  assert.match(html, /<caption>مقارنة عرضين<\/caption>/);
  assert.match(html, /scope="col"/);
  assert.match(html, /scope="row"/);
  assert.match(html, /الرسوم ثابتة/);
  assert.match(html, /لا يمحو عملك/);
});
test("C code representation escapes HTML and preserves LTR indentation", () => {
  const code = {
    ...problem.representations[0],
    kind: "code",
    codeText: 'for n in range(2):\n    print("<script>unsafe()</script>")',
  };
  const html = renderToStaticMarkup(
    React.createElement(RepresentationSwitcher, { variants: [code] }),
  );
  assert.match(html, /dir="ltr"/);
  assert.match(html, / {4}print/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
test("C Studio learner preview never renders author-only evaluation keys", () => {
  const html = renderToStaticMarkup(
    React.createElement(LessonRenderer, { payload: lesson }),
  );
  assert.match(html, /معاينة طالب نصية/);
  assert.match(html, /خيارات القراءة والعرض/);
  assert.doesNotMatch(html, /SECRET/);
});
test("C problem and project views disclose synthetic, assistance and review limits", () => {
  const props = {
    api: {},
    trackRevisionId: "track",
    lessonRevisionId: "lesson",
    blockIndex: 0,
    onClose() {},
  };
  const problemHtml = renderToStaticMarkup(
    React.createElement(ProblemJourney, { ...props, activity: problem }),
  );
  assert.match(problemHtml, /تجربة اصطناعية/);
  assert.match(problemHtml, /لا يمنح دليل إتقان/);
  assert.doesNotMatch(problemHtml, /SECRET/);
  const projectHtml = renderToStaticMarkup(
    React.createElement(ProjectWorkspace, { ...props, activity: project }),
  );
  assert.match(projectHtml, /بيئة اصطناعية/);
  assert.match(projectHtml, /المراجعة والتحسين/);
  assert.match(projectHtml, /ابدأ مشروعي/);
});
const dashboard = {
  schemaVersion: "learning-metrics-v1",
  metricVersion: "c-metrics-1.0",
  trackRevisionId: "track",
  generatedAt: "2026-11-08T10:00:00Z",
  window: { from: "2026-11-01T10:00:00Z", to: "2026-11-08T10:00:00Z", days: 7 },
  synthetic: true,
  metrics: [
    {
      metric: "independent_success_rate",
      metricVersion: "c-metrics-1.0",
      n: 0,
      numerator: 0,
      denominator: 0,
      value: 0,
      status: "not_measured",
      missingReason: "insufficient_data",
    },
  ],
  activity: { problemCompleted: 1, projectCompleted: 2, projectSubmitted: 3 },
  provenance: ["assessments"],
  missingCount: 1,
  notesAr: [],
};
test("C zero denominator and suppressed metrics cannot become zero percent", () => {
  assert.equal(api.analyticsDashboard(dashboard).metrics[0].value, null);
  assert.equal(
    api.analyticsDashboard({
      ...dashboard,
      metrics: [
        {
          ...dashboard.metrics[0],
          denominator: 4,
          status: "suppressed",
          value: 0.75,
        },
      ],
    }).metrics[0].value,
    null,
  );
  assert.equal(preferences.metricDisplay(null), "غير مقاس");
  assert.throws(() =>
    api.analyticsDashboard({ ...dashboard, synthetic: false }),
  );
});
test("C dashboard requests no data until invoked, with accessible window and honest missingness", () => {
  let requests = 0;
  const html = renderToStaticMarkup(
    React.createElement(LearningAnalyticsDashboard, {
      api: {
        request() {
          requests++;
        },
      },
      trackRevisionId: "track",
    }),
  );
  assert.equal(requests, 0);
  assert.match(html, /نافذة العرض/);
  assert.match(html, /غياب البيانات لا يعني الفشل/);
});
test("C A1 adapter preserves the versioned advanced activity reference and rejects bad indices", () => {
  const base = {
    id: "id",
    revision: 1,
    decisionId: "d",
    trackRevisionId: "t",
    activityKind: "guided_practice",
    lessonRevisionId: "l",
    sourceAttemptId: null,
    skillCode: "SK-ALG-05",
    status: "active",
    assessmentId: null,
    assistanceLevel: 1,
    createdAt: "2026-11-08",
    advancedActivity: { kind: "problem_based", blockIndex: 2 },
  };
  assert.deepEqual(
    intelligence.activityData(base).advancedActivity,
    base.advancedActivity,
  );
  assert.throws(() =>
    intelligence.activityData({
      ...base,
      advancedActivity: { kind: "problem_based", blockIndex: -1 },
    }),
  );
});
test("C mutations retain same-origin CSRF/idempotency transport and safe retry", async () => {
  const calls = [];
  const transport = async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify({ data: session, requestId: "r" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = new ProductApi(transport);
  const result = await client.request(
    "/learning/problem-sessions",
    api.problemSession,
    "POST",
    { trackRevisionId: "track", lessonRevisionId: "lesson", blockIndex: 0 },
  );
  assert.equal(result.id, "owned-session");
  assert.equal(calls[0].path, "/api/v1/learning/problem-sessions");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.ok(calls[0].options.headers["Idempotency-Key"]);
});
function draftStorage() {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}
test("C revision-zero unsent answer survives local navigation without caching a verdict or private key", () => {
  const storage = draftStorage(),
    key = draftCache.draftKey("problem", "track", "lesson", 0);
  const draft = {
    schemaVersion: "c-local-problem-draft-v1",
    sessionId: "owned",
    baseRevision: 0,
    answers: { plan: "خطة لم تُحفظ بعد", privateRubric: "SECRET" },
    answer: "٢س + ١ = ٥",
    unit: "m/s",
    result: { result: "correct_practice" },
    privateEvaluation: { solutionKey: "SECRET" },
  };
  draftCache.writeLocalDraft(storage, key, draft);
  const restored = draftCache.readLocalDraft(storage, key, "owned");
  assert.equal(restored.answer, draft.answer);
  assert.equal(restored.baseRevision, 0);
  assert.equal(restored.answers.plan, draft.answers.plan);
  assert.doesNotMatch(
    storage.getItem(key),
    /SECRET|correct_practice|privateEvaluation|result/,
  );
  assert.equal(
    draftCache.readLocalDraft(storage, key, "another-owner-session"),
    null,
  );
});
test("C project draft retains pending artifact text and version for an explicit stale-draft comparison", () => {
  const storage = draftStorage(),
    key = draftCache.draftKey("project", "track", "lesson", 1);
  const draft = {
    schemaVersion: "c-local-project-draft-v1",
    sessionId: "owned-project",
    baseRevision: 3,
    notes: { model: "راجعت الافتراض" },
    artifact: "for n in range(2):\n    print(n)",
    milestoneCode: "model",
    isFinal: false,
    review: { decision: "accepted" },
  };
  draftCache.writeLocalDraft(storage, key, draft);
  const restored = draftCache.readLocalDraft(storage, key, "owned-project");
  assert.equal(restored.baseRevision, 3);
  assert.equal(restored.artifact, draft.artifact);
  assert.equal(restored.milestoneCode, "model");
  assert.equal("review" in restored, false);
});
test("C malformed or oversized cache cannot become a restored learner draft", () => {
  const storage = draftStorage(),
    key = draftCache.draftKey("problem", "t", "l", 0);
  storage.setItem(key, "bad json");
  assert.equal(draftCache.readLocalDraft(storage, key, "owned"), null);
  storage.setItem(
    key,
    JSON.stringify({
      schemaVersion: "c-local-problem-draft-v1",
      sessionId: "owned",
      baseRevision: 1,
      answers: { plan: "a".repeat(3001) },
      answer: "",
      unit: "m/s",
    }),
  );
  assert.equal(draftCache.readLocalDraft(storage, key, "owned"), null);
});
test("C identity cleanup removes raw local drafts and resource IDs", () => {
  const storage = draftStorage(),
    key = draftCache.draftKey("project", "t", "l", 0);
  storage.setItem(key, "private pending student text");
  storage.setItem("khotwa-path:c:problem:t:l:0", "resource-id");
  storage.setItem("display-preference", "unrelated");
  clearLearningStorage(storage);
  assert.equal(storage.getItem(key), null);
  assert.equal(storage.getItem("khotwa-path:c:problem:t:l:0"), null);
  assert.equal(storage.getItem("display-preference"), "unrelated");
});
test("C unavailable browser storage does not throw or alter the in-memory draft", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  const draft = {
    schemaVersion: "c-local-problem-draft-v1",
    sessionId: "owned",
    baseRevision: 1,
    answers: { frame: "نصي" },
    answer: "س = ٢",
    unit: "m/s",
  };
  assert.doesNotThrow(() =>
    draftCache.writeLocalDraft(
      blocked,
      draftCache.draftKey("problem", "t", "l", 0),
      draft,
    ),
  );
  assert.equal(draft.answer, "س = ٢");
  assert.equal(draftCache.readLocalDraft(blocked, "key", "owned"), null);
});
