import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  MATH_LAB_KINDS,
  generateLinearGraph,
  validateMathLabSpec,
  publicMathActivity,
  revealMathActivity,
  verifyMathSequence,
  verifyMathLabSubmission,
  validateMathLabContent,
} = require("../dist/stem/math-lab.js");
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/stem-math.v1.json", import.meta.url),
    "utf8",
  ),
);
const specs = fixture.activities.map(validateMathLabSpec);
const context = {
  attemptId: "11111111-1111-4111-8111-111111111111",
  attemptRevision: 3,
  problemRevisionId: "22222222-2222-4222-8222-222222222222",
  notationProfile: "ar-linear-v1",
  domain: "reals",
};
function port(statuses = ["verified_valid"]) {
  const calls = [];
  return {
    calls,
    verify: async (ctx, transition) => {
      calls.push({ ctx, transition });
      const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
      if (status === "throw") throw new Error("private token must not leak");
      return {
        status,
        requestId: "report-" + calls.length,
        engineVersion: "math-0.3.0",
        attemptRevision: ctx.attemptRevision,
        evidence:
          status === "verified_invalid" ? { type: "counterexample" } : null,
      };
    },
    checkFinal: async () => ({
      status: "verified_valid",
      isIsolated: true,
      substitutionValid: true,
    }),
  };
}
test("B1 six domain specifications are strict and public projections redact answer keys", () => {
  assert.deepEqual(
    specs.map((s) => s.kind),
    MATH_LAB_KINDS,
  );
  for (const spec of specs) {
    const exposed = JSON.stringify(publicMathActivity(spec));
    for (const key of [
      "privateValidation",
      "acceptedChoiceIds",
      "acceptedMethodIds",
      "expectedFirstInvalidStep",
      "completionRaw",
      "workedSteps",
      '"mode"',
    ])
      assert.ok(!exposed.includes(key), key);
    assert.throws(() => validateMathLabSpec({ ...spec, isCorrect: true }));
  }
  assert.throws(() => validateMathLabSpec({ kind: "math_general_algebra" }));
  assert.equal(fixture.reviewStatus, "draft");
});
test("B1 graph and table use one point list with exact decimal stepping", () => {
  const graph = generateLinearGraph(fixture.graphModels[0]);
  assert.deepEqual(graph.points, [
    { x: -1, y: -1 },
    { x: 0, y: 1 },
    { x: 1, y: 3 },
  ]);
  assert.equal(graph.measurementMode, "learning_only");
  const decimal = generateLinearGraph(fixture.graphModels[4]);
  assert.deepEqual(decimal.points[13], { x: 0.3, y: 0.23 });
  assert.equal(decimal.points.length, 21);
});
test("B1 generated points agree with an independent Python Fraction oracle", () => {
  const local = resolve(
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const python = existsSync(local) ? local : (process.env.PYTHON ?? "python");
  const oracle = spawnSync(
    python,
    ["services/math-engine/tests/stem_math_oracle.py"],
    {
      input: JSON.stringify(fixture.graphModels),
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(oracle.status, 0, oracle.stderr);
  assert.deepEqual(
    fixture.graphModels.map((m) => generateLinearGraph(m).points),
    JSON.parse(oracle.stdout),
  );
});
test("B1 zero coefficient distinguishes horizontal all-reals and empty intersections", () => {
  assert.equal(
    generateLinearGraph(fixture.graphModels[1]).intersection.kind,
    "all_reals",
  );
  assert.equal(
    generateLinearGraph(fixture.graphModels[2]).intersection.kind,
    "empty",
  );
  const out = generateLinearGraph(fixture.graphModels[3]);
  assert.equal(out.intersection.x, -10);
  assert.equal(out.intersection.inWindow, false);
});
test("B1 graph bounds prevent unbounded points, nonfinite values and imprecise domains", () => {
  const good = fixture.graphModels[0];
  for (const change of [
    { a: Infinity },
    { b: NaN },
    { a: 1001 },
    { step: 0 },
    { step: -1 },
    { step: 0.001 },
    { xMax: -1 },
    { step: 0.3 },
    { a: 0.0000001 },
    { formula: "eval" },
  ])
    assert.throws(
      () => generateLinearGraph({ ...good, ...change }),
      JSON.stringify(change),
    );
  assert.equal(generateLinearGraph(fixture.graphModels[5]).points.length, 101);
});
test("B1 only first proven invalid transition is selected and later errors remain locked", async () => {
  const math = port(["verified_valid", "verified_invalid", "verified_invalid"]);
  const result = await verifyMathSequence(
    "٣(س+٢)=٩",
    ["٣س+٦=٩", "٣س=٤", "س=٢"],
    math,
    context,
  );
  assert.equal(result.outcome, "first_invalid");
  assert.equal(result.firstInvalidStep, 2);
  assert.equal(math.calls.length, 2);
  assert.equal(math.calls[0].transition.fromKind, "problem");
  assert.equal(math.calls[1].transition.fromKind, "step");
  assert.equal(
    math.calls[1].transition.fromStepVersionId,
    math.calls[0].transition.toStepVersionId,
  );
  assert.equal(math.calls[0].ctx.attemptRevision, 3);
});
for (const technical of [
  "unsupported",
  "syntax_error",
  "inconclusive",
  "service_error",
  "throw",
])
  test(`B1 ${technical} before a bad transition returns cannot_determine`, async () => {
    const math = port([technical, "verified_invalid"]);
    const result = await verifyMathSequence(
      "س=١",
      ["س=", "س=٢"],
      math,
      context,
    );
    assert.equal(result.outcome, "cannot_determine");
    assert.equal(result.firstInvalidStep, null);
    assert.equal(math.calls.length, 1);
  });
test("B1 fraction and trigonometry activities abstain without expanding the algebra scope", async () => {
  for (const raw of ["س/٢=١", "جا(س)=١", "جتا(س)=١"]) {
    const math = port();
    assert.equal(
      (await verifyMathSequence("س=٢", [raw], math, context)).outcome,
      "cannot_determine",
    );
    assert.equal(math.calls.length, 0);
  }
  assert.rejects(() =>
    verifyMathSequence("س=٢", new Array(13).fill("س=٢"), port(), context),
  );
});
test("B1 equivalent alternative methods remain valid with no forced unique method", async () => {
  const math = port();
  assert.equal(
    (await validateMathLabContent(specs[1], math, context)).valid,
    true,
  );
  const outcome = await verifyMathLabSubmission(
    specs[1],
    { methodIds: ["divide", "distribute"] },
    math,
    context,
  );
  assert.equal(outcome.result, "correct_practice");
  assert.equal(outcome.evidenceClass, "learning_only");
  assert.equal(
    (
      await verifyMathLabSubmission(
        specs[1],
        { methodIds: ["divide"] },
        port(),
        context,
      )
    ).result,
    "incorrect_practice",
  );
});
test("B1 author validation rejects a false correct method and an incomplete method", async () => {
  assert.equal(
    (
      await validateMathLabContent(
        specs[1],
        port(["verified_invalid"]),
        context,
      )
    ).valid,
    false,
  );
  const math = port();
  math.checkFinal = async () => ({
    status: "verified_valid",
    isIsolated: false,
    substitutionValid: null,
  });
  assert.equal(
    (await validateMathLabContent(specs[1], math, context)).valid,
    false,
  );
});
test("B1 intentional common mistakes require mode plus a proven invalid transition", async () => {
  const spec = structuredClone(specs[1]);
  spec.methods[1].mode = "common_mistake";
  spec.methods[1].steps = ["٣س+٢=٩"];
  spec.privateValidation.acceptedMethodIds = ["distribute"];
  const math = port([
    "verified_valid",
    "verified_valid",
    "verified_valid",
    "verified_invalid",
  ]);
  assert.equal(
    (await validateMathLabContent(validateMathLabSpec(spec), math, context))
      .valid,
    true,
  );
  assert.equal(
    (await validateMathLabContent(validateMathLabSpec(spec), port(), context))
      .valid,
    false,
  );
});
test("B1 first-error answer is checked against domain reports, not a client verdict", async () => {
  const answer = await verifyMathLabSubmission(
    specs[2],
    { transitionIndex: 1 },
    port(["verified_invalid"]),
    context,
  );
  assert.equal(answer.result, "correct_practice");
  assert.deepEqual(answer.verificationReportIds, ["report-1"]);
  assert.ok(!JSON.stringify(answer).includes("expectedFirstInvalidStep"));
  assert.equal(
    (await validateMathLabContent(specs[2], port(["verified_valid"]), context))
      .valid,
    false,
  );
  await assert.rejects(() =>
    verifyMathLabSubmission(
      specs[2],
      { transitionIndex: 1, isCorrect: true },
      port(),
      context,
    ),
  );
});
test("B1 why selection uses a reviewed key only after a verified transformation", async () => {
  assert.equal(
    (
      await verifyMathLabSubmission(
        specs[3],
        { choiceIds: ["subtract"], explanationAr: "تفسير للمراجعة" },
        port(),
        context,
      )
    ).result,
    "correct_practice",
  );
  assert.equal(
    (
      await verifyMathLabSubmission(
        specs[3],
        { choiceIds: ["change"] },
        port(),
        context,
      )
    ).result,
    "incorrect_practice",
  );
  assert.equal(
    (
      await verifyMathLabSubmission(
        specs[3],
        { choiceIds: ["subtract"] },
        port(["verified_invalid"]),
        context,
      )
    ).result,
    "cannot_determine",
  );
});
test("B1 completion and worked reveal remain assisted practice with safe public content", async () => {
  assert.equal(
    publicMathActivity(specs[4]).scaffoldActivity,
    "completion_step",
  );
  assert.ok(
    revealMathActivity(specs[4]).revealedSupport.workedSteps.length > 0,
  );
  const answer = await verifyMathLabSubmission(
    specs[4],
    { raw: "٣س=٣" },
    port(),
    context,
  );
  assert.equal(answer.result, "correct_practice");
  assert.equal(answer.evidenceClass, "learning_only");
  assert.equal(
    (
      await verifyMathLabSubmission(
        specs[4],
        { raw: "س=٢" },
        port(["verified_valid", "verified_invalid"]),
        context,
      )
    ).result,
    "incorrect_practice",
  );
});
test("B1 an incorrect student equivalence judgment does not alter the domain verdict", async () => {
  const answer = await verifyMathLabSubmission(
    specs[5],
    { equivalent: false },
    port(),
    context,
  );
  assert.equal(answer.result, "incorrect_practice");
  assert.equal(answer.domainStatus, "verified_valid");
  assert.equal(
    (
      await verifyMathLabSubmission(
        specs[5],
        { equivalent: false },
        port(["verified_invalid"]),
        context,
      )
    ).result,
    "correct_practice",
  );
});
test("B1 graph observations preserve free text without pretending it is independently verified", async () => {
  const answer = await verifyMathLabSubmission(
    specs[0],
    { observationAr: "<script>نص فقط</script>" },
    port(),
    context,
  );
  assert.equal(answer.result, "needs_review");
  assert.equal(answer.evidenceClass, "learning_only");
});
test("B1 duplicate or unknown choice IDs and invalid private author fields are rejected", async () => {
  await assert.rejects(() =>
    verifyMathLabSubmission(
      specs[3],
      { choiceIds: ["subtract", "subtract"] },
      port(),
      context,
    ),
  );
  await assert.rejects(() =>
    verifyMathLabSubmission(
      specs[3],
      { choiceIds: ["secret"] },
      port(),
      context,
    ),
  );
  const bad = structuredClone(specs[3]);
  bad.privateValidation.acceptedChoiceIds = ["not_present"];
  assert.throws(() => validateMathLabSpec(bad));
  bad.privateValidation = {
    acceptedChoiceIds: ["subtract"],
    reasonAr: "سبب",
    hiddenTests: [],
  };
  assert.throws(() => validateMathLabSpec(bad));
});
