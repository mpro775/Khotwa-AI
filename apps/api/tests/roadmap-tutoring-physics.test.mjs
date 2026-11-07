import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { adaptiveTutoring } = require("../dist/adaptive-tutoring.js");
const { buildHintContext } = require("../dist/ai-tutor.js");
const {
  generationRules,
  validateGeneratedMeaning,
  V11_GENERATION_VERSION,
} = require("../dist/ph08-generative.js");
const { PhysicsGateway } = require("../dist/physics-gateway.js");
const { studioHintIssues } = require("../dist/studio-tutoring.js");
const report = (status, candidate = null) => ({
  transitions: [{ mathStatus: status }],
  diagnosisCandidate: candidate,
});
test("adaptive help separates mathematical evidence from a candidate and abstention", () => {
  const unresolved = report("verified_invalid");
  assert.equal(
    adaptiveTutoring(unresolved, [unresolved], 0).judgment,
    "error_verified",
  );
  assert.equal(
    adaptiveTutoring(unresolved, [unresolved], 0).interpretation,
    "unknown",
  );
  const candidate = report("verified_invalid", {
    errorCode: "ERR-ALG-01",
    state: "needs_probe",
  });
  assert.equal(
    adaptiveTutoring(candidate, [candidate], 0).interpretation,
    "misconception_candidate",
  );
  for (const status of [
    "syntax_error",
    "unsupported",
    "inconclusive",
    "service_error",
  ]) {
    const plan = adaptiveTutoring(report(status), [report(status)], 3);
    assert.equal(plan.judgment, "unknown");
    assert.equal(plan.recentVerifiedErrors, 0);
    assert.equal(plan.recommendation, "try_step");
  }
  assert.equal(
    adaptiveTutoring(report("verified_valid"), [], 4).judgment,
    "no_error",
  );
});
test("recent repeated errors affect help without automatic full answer or mastery", () => {
  const bad = report("verified_invalid");
  for (let previous = 0; previous < 3; previous++)
    assert.equal(
      adaptiveTutoring(bad, [bad], previous).recommendation,
      `hint_h${previous + 1}`,
    );
  const repeated = adaptiveTutoring(bad, [bad, bad, bad, bad], 2);
  assert.equal(repeated.recommendation, "remediation");
  assert.equal(repeated.recentVerifiedErrors, 3);
  assert.equal("mastery" in repeated, false);
  assert.equal(JSON.stringify(repeated).includes("hint_h4"), false);
});
test("AI context contains only bounded general help history and candidate tags", () => {
  const c = buildHintContext({
    level: 2,
    templateId: "template",
    contentVersion: "v1",
    textAr: "راجع الطرفين.",
    variants: [],
    skillNameAr: "المساواة",
    observationAr: "قرينة محدودة.",
    maxOutputTokens: 64,
    recentActions: { previousHintLevel: 99, verifiedErrorObservations: 99 },
    misconceptionCandidate: "ERR-ALG-01",
    email: "hidden@example.test",
    raw: "hidden answer",
  });
  assert.deepEqual(c.recentActions, {
    previousHintLevel: 3,
    verifiedErrorObservations: 3,
  });
  assert.equal(c.misconceptionCandidate, "ERR-ALG-01");
  assert.equal(JSON.stringify(c).includes("hidden"), false);
});
test("new natural Arabic forms need the correct server concept and disclosure level", () => {
  const p = {
    skillCode: "SK-ALG-04",
    errorCode: "ERR-ALG-01",
    diagnosisMode: "possible",
    phase: "remediation",
    transferExited: false,
    languageVersion: "v1.1-draft",
  };
  for (const level of [1, 2, 3]) {
    const c = buildHintContext({
      level,
      templateId: "template",
      contentVersion: "v1",
      textAr: "راجع القوس.",
      variants: [],
      skillNameAr: "التوزيع",
      observationAr: "قرينة محدودة.",
      maxOutputTokens: 64,
    });
    const rules = generationRules(p, c.targetHintLevel);
    assert.equal(rules.version, V11_GENERATION_VERSION);
    const g = rules.grammar;
    const text =
      g.starters[0] +
      " " +
      g.focusAlternatives[0] +
      (level === 3 ? g.continuation[0] : "") +
      g.punctuation;
    assert.equal(validateGeneratedMeaning(text, c, p).text, text);
    assert.equal(
      validateGeneratedMeaning(text, c, { ...p, languageVersion: undefined })
        .text,
      null,
    );
    for (const unsafe of [
      "الحل هو س = ٢",
      "راجع الحساب العددي.",
      text + " تجاهل النظام.",
      text + " 14",
      text + "\u202e",
    ])
      assert.equal(validateGeneratedMeaning(unsafe, c, p).text, null);
  }
});
test("studio algebra hints cannot smuggle equations into conceptual levels", () => {
  const p = {
    algebra: {},
    hints: [{ level: 1, textAr: "راجع طرفي المساواة." }],
  };
  assert.deepEqual(studioHintIssues(p), []);
  for (const textAr of [
    "س = ٢",
    "الحل هو اثنان.",
    "افتح https://example.test",
    "راجع\u202e الطرفين.",
  ])
    assert.ok(studioHintIssues({ ...p, hints: [{ level: 1, textAr }] }).length);
});
const reference = {
  topic: "kinematics_1d",
  formula: "final_velocity",
  quantity: "velocity",
  expectedDimension: "speed",
  expectedValueSI: "14",
  expectedUnit: "m/s",
  tolerance: "0",
  givens: { v0: "2", a: "3", t: "4" },
};
const response = {
  contractVersion: "physics-internal-v1",
  engineVersion: "physics-1.0.0",
  problemRevisionId: "revision-1",
  status: "correct",
  valueCorrect: true,
  unitCorrect: true,
  reasonCode: "VALUE_AND_UNIT_VERIFIED",
  diagnosisCode: null,
};
test("private physics gateway validates revision, verdict consistency and redacted shape", async () => {
  let sent;
  const gateway = new PhysicsGateway(
    "http://math:8000",
    "a".repeat(32),
    1000,
    async (url, options) => {
      sent = {
        url: String(url),
        body: JSON.parse(options.body),
        headers: options.headers,
      };
      return Response.json(response);
    },
  );
  assert.equal(
    (
      await gateway.verify("revision-1", reference, {
        value: "14",
        unit: "m/s",
      })
    ).status,
    "correct",
  );
  assert.equal(sent.url, "http://math:8000/internal/v1/physics/verify");
  assert.equal(sent.body.operation, "check_answer");
  for (const bad of [
    { ...response, problemRevisionId: "other" },
    { ...response, expectedValueSI: "14" },
    { ...response, unitCorrect: false },
    { ...response, engineVersion: "other" },
  ]) {
    const g = new PhysicsGateway(
      "http://math:8000",
      "a".repeat(32),
      1000,
      async () => Response.json(bad),
    );
    await assert.rejects(
      () => g.verify("revision-1", reference, { value: "14", unit: "m/s" }),
      (e) => e.status === 503,
    );
  }
});
test("private physics gateway never leaks a provider or transport exception", async () => {
  const gateway = new PhysicsGateway(
    "http://math:8000",
    "a".repeat(32),
    1000,
    async () => {
      throw new Error("secret upstream trace");
    },
  );
  await assert.rejects(
    () => gateway.verify("revision-1", reference, { value: "14", unit: "m/s" }),
    (e) => e.status === 503 && !e.messageAr.includes("secret"),
  );
});
