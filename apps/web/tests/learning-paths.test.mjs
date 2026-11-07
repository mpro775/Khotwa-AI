import assert from "node:assert/strict";
import test from "node:test";
import Module, { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Compile trusted repository modules only. Learner input below is always data.
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
const { assessmentSession, bankProblem, learningRevision } = trustedModule(
  source("learning-path-api.ts"),
);
const { readAnswerDraft, readPathSelection, writeAnswerDraft } = trustedModule(
  source("learning-path-session.ts"),
);
const { clearLearningStorage } = trustedModule(source("product-session.ts"));
const { LessonRenderer } = trustedModule(source("LessonRenderer.tsx"));
const problem = {
  revisionId: "problem-revision",
  problemId: "problem",
  source: "algebra",
  subject: "algebra",
  titleAr: "توزيع",
  statementAr: "حل المعادلة",
  skillCodes: ["SK-ALG-04"],
  primarySkillCode: "SK-ALG-04",
  difficulty: 1,
  kind: "main",
  familyCode: "family",
  equationRaw: "٢(س + ٣) = ١٠",
};
const lesson = {
  kind: "lesson",
  subject: "algebra",
  code: "ALG-L04",
  titleAr: "توزيع الأقواس",
  descriptionAr: "شرح التوزيع",
  objectives: ["توزيع المعامل"],
  skillCodes: ["SK-ALG-04"],
  prerequisiteSkillCodes: [],
  prerequisiteLessonIds: [],
  contentBlocks: [
    { type: "paragraph", textAr: '<img src=x onerror="alert(1)">' },
    {
      type: "math_example",
      textAr: "مثال",
      raw: "٢(س + ٣) = ١٠",
      steps: [{ raw: "٢س + ٦ = ١٠", explanationAr: "نوزع على الحدين" }],
    },
    {
      type: "code_example",
      textAr: "كود نصي",
      code: "<script>alert(1)</script>",
    },
  ],
  practiceProblemRevisionIds: [],
  assessmentProblemRevisionIds: [],
  errorCodes: [],
  mappingPending: [],
};
function session(subject = "algebra", status = "verified_valid") {
  return {
    id: "assessment",
    revision: 2,
    subject,
    kind: "post_remediation",
    trackRevisionId: "track",
    lessonRevisionId: "lesson",
    status: "active",
    mode: "independent",
    questions: [
      {
        id: "question",
        problem: { ...problem, subject },
        attemptId: "attempt",
        steps: ["٢س + ٦ = ١٠"],
        value: "",
        unit: "",
        status,
        independent: true,
        supportLevel: 0,
        completed: false,
      },
    ],
    coverage: {
      requested: 2,
      available: 1,
      partial: true,
      messageAr: "تغطية جزئية",
    },
    createdAt: "2026-11-08T00:00:00Z",
  };
}

test("LP/SEC: public bank projection discards hidden keys and private code tests", () => {
  const publicProblem = bankProblem({
    ...problem,
    subject: "programming",
    source: "studio",
    answerRaw: "secret",
    programming: {
      starterCode: "print(1)",
      publicTests: [{ input: "", expectedOutput: "1" }],
      referenceCode: "private",
      hiddenTests: ["private"],
    },
  });
  assert.equal("answerRaw" in publicProblem, false);
  assert.deepEqual(Object.keys(publicProblem.programming).sort(), [
    "publicTests",
    "starterCode",
  ]);
});
test("LP/MATH: subject verdict mismatch cannot become a trusted assessment result", () => {
  assert.throws(
    () => assessmentSession(session("algebra", "wrong_unit")),
    /invalid_response/,
  );
  assert.throws(
    () => assessmentSession(session("physics", "verified_valid")),
    /invalid_response/,
  );
  const mixed = session();
  mixed.questions[0].problem.subject = "physics";
  assert.throws(() => assessmentSession(mixed), /invalid_response/);
  assert.equal(
    assessmentSession(session("algebra", "service_error")).questions[0].status,
    "service_error",
  );
});
test("LP/SEC: lesson renderer escapes prose and code and keeps math source intact", () => {
  const html = renderToStaticMarkup(
    React.createElement(LessonRenderer, { payload: lesson }),
  );
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img "), false);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes('dir="ltr"'));
  assert.ok(html.includes("٢(س + ٣) = ١٠"));
  assert.ok(html.includes("٢س + ٦ = ١٠"));
});
test("LP/Content: unknown structured block types are rejected before render", () => {
  assert.throws(
    () =>
      learningRevision({
        id: "r",
        itemId: "i",
        version: 1,
        editRevision: 0,
        status: "published",
        payload: {
          ...lesson,
          contentBlocks: [{ type: "raw_html", textAr: "unsafe" }],
        },
        contentHash: "hash",
        validation: null,
        createdAt: "time",
        reviewedAt: null,
        publishedAt: null,
      }),
    /invalid_response/,
  );
});
test("LP/Raw: draft restores exact Arabic/whitespace even while input exceeds engine limits", () => {
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
  const raw = "  ٢(س + ٣) = ١٠\n" + " ".repeat(300);
  writeAnswerDraft(storage, "a", "q", { steps: [raw], value: "", unit: "" });
  assert.equal(readAnswerDraft(storage, "a", "q").steps[0], raw);
  assert.equal(readAnswerDraft(storage, "other", "q"), null);
  storage.setItem(
    "khotwa-path:active",
    JSON.stringify({
      subject: "algebra",
      trackId: "r1",
      lessonId: "l1",
      assessmentId: "a",
    }),
  );
  assert.equal(readPathSelection(storage).assessmentId, "a");
  storage.setItem(
    "khotwa-path:active",
    '{"subject":"algebra","assessmentId":true}',
  );
  assert.equal(readPathSelection(storage), null);
});
test("LP/SEC: identity switch removes saved path IDs and raw drafts but retains unrelated preferences", () => {
  const values = new Map([
    ["khotwa-path:active", "id"],
    ["khotwa-path:last:algebra", "id"],
    ["khotwa-path:draft:a:q", "raw"],
    ["unrelated", "keep"],
  ]);
  clearLearningStorage({
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
  });
  assert.deepEqual([...values], [["unrelated", "keep"]]);
});
