import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const {
  simulatePhysicsModel,
  validatePhysicsLabSpec,
  physicsQuantityToSI,
} = require("../dist/stem/physics-inquiry.js");
const {
  validateCodingActivity,
  publicCodingActivity,
  revealCodingTrace,
  gradeCodingSubmission,
} = require("../dist/stem/coding-lab.js");
const fixtures = JSON.parse(
  readFileSync(
    new URL("fixtures/stem-models.v1.json", import.meta.url),
    "utf8",
  ),
);
const clone = (value) => structuredClone(value);
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("B2-T02 constant signed motion shares trajectory/table values and stable checksum", () => {
  const spec = clone(fixtures.physics.positiveVelocity);
  const result = simulatePhysicsModel(spec);
  assert.equal(result.displacement_m, 12);
  assert.equal(result.distance_m, 12);
  assert.deepEqual(
    result.points.map((point) => point.x_m),
    [0, 3, 6, 9, 12],
  );
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
  assert.equal(simulatePhysicsModel(spec).checksum, result.checksum);
  spec.parameters.v_mps = -3;
  const negative = simulatePhysicsModel(spec);
  assert.equal(negative.displacement_m, -12);
  assert.equal(negative.distance_m, 12);
  assert.equal(negative.finalVelocity_mps, -3);
  assert.notEqual(negative.checksum, result.checksum);
});
test("B2-T04 reversal splits distance at turning point rather than abs(displacement)", () => {
  const result = simulatePhysicsModel(fixtures.physics.reversal);
  assert.equal(result.reversalTime_s, 1);
  assert.equal(result.displacement_m, -3);
  assert.equal(result.distance_m, 5);
  assert.equal(result.finalVelocity_mps, -4);
  const noReversal = clone(fixtures.physics.reversal);
  noReversal.parameters = { v0_mps: 10, a_mps2: -2, t_s: 3, x0_m: 0 };
  const stopped = simulatePhysicsModel(noReversal);
  assert.equal(stopped.finalVelocity_mps, 4);
  assert.equal(stopped.displacement_m, 21);
  assert.equal(stopped.distance_m, 21);
  assert.equal(stopped.reversalTime_s, null);
});
test("B2 model properties preserve endpoint, translation, distance and signed velocity", () => {
  for (const v0 of [-3, 0, 2])
    for (const a of [-2, 0, 3])
      for (const time of [0, 1, 3]) {
        const spec = clone(fixtures.physics.reversal);
        spec.parameters = { v0_mps: v0, a_mps2: a, t_s: time, x0_m: 7 };
        const r = simulatePhysicsModel(spec);
        const last = r.points.at(-1);
        close(last.t_s, time);
        close(last.x_m - 7, v0 * time + 0.5 * a * time * time);
        close(last.v_mps, v0 + a * time);
        assert.ok(r.distance_m + 1e-10 >= Math.abs(r.displacement_m));
        const splitTimes = [0, time];
        if (r.reversalTime_s !== null)
          splitTimes.splice(1, 0, r.reversalTime_s);
        let integratedDistance = 0;
        for (let index = 1; index < splitTimes.length; index++) {
          const t0 = splitTimes[index - 1];
          const t1 = splitTimes[index];
          integratedDistance +=
            ((Math.abs(v0 + a * t0) + Math.abs(v0 + a * t1)) / 2) * (t1 - t0);
        }
        close(r.distance_m, integratedDistance);
      }
});
test("B2 zero time, stationary model and bounded sample endpoints stay finite", () => {
  const spec = clone(fixtures.physics.positiveVelocity);
  spec.parameters.t_s = 0;
  assert.equal(simulatePhysicsModel(spec).points.length, 1);
  spec.parameters.t_s = 4;
  spec.parameters.v_mps = 0;
  spec.sampleCount = 501;
  const stationary = simulatePhysicsModel(spec);
  assert.equal(stationary.points.length, 501);
  assert.ok(stationary.points.every((point) => point.x_m === 0));
  assert.equal(stationary.distance_m, 0);
  assert.equal(stationary.reversalTime_s, null);
});
test("B2-T05 explicit allowlisted SI conversions keep dimensions separate", () => {
  assert.deepEqual(physicsQuantityToSI(36, "km/h"), {
    valueSI: 10,
    dimension: "speed",
  });
  assert.deepEqual(physicsQuantityToSI(2, "m/s²"), {
    valueSI: 2,
    dimension: "acceleration",
  });
  assert.throws(() => physicsQuantityToSI(36, "mph"));
  assert.throws(() => physicsQuantityToSI(Infinity, "m/s"));
  assert.throws(() => physicsQuantityToSI(1, "toString"));
});
test("B2-T07 unsupported versions, resource floods and extra executable fields are rejected", () => {
  const base = fixtures.physics.positiveVelocity;
  for (const patch of [
    { modelCode: "projectile_2d" },
    { modelVersion: "2.0.0" },
    { sampleCount: 1_000_000 },
    { sampleCount: 2.5 },
    { expression: "process.exit()" },
    { parameters: { ...base.parameters, t_s: -1 } },
    { parameters: { ...base.parameters, t_s: NaN } },
    { parameters: { ...base.parameters, v_mps: Infinity } },
    { parameters: { ...base.parameters, a_mps2: 2 } },
    { parameters: { ...base.parameters, x0_m: 1e20 } },
  ])
    assert.throws(() => simulatePhysicsModel({ ...base, ...patch }));
  const spec = validatePhysicsLabSpec(base);
  spec.parameters.v_mps = 99;
  assert.equal(base.parameters.v_mps, 3);
});
test("B3-T01 range(1,4) uses pinned static totals 1,3,6 and output 6 without execution", () => {
  const activity = validateCodingActivity(fixtures.coding.trace);
  const totals = [0, 1, 2].map(
    (index) => revealCodingTrace(activity, index).variablesDisplay.total,
  );
  assert.deepEqual(totals, [1, 3, 6]);
  assert.equal(revealCodingTrace(activity, 3).stdoutCumulative, "6");
  assert.equal(
    gradeCodingSubmission(activity, { output: "6\n" }).status,
    "correct_practice",
  );
  assert.equal(
    gradeCodingSubmission(activity, { output: "10" }).status,
    "incorrect_practice",
  );
  assert.throws(() => revealCodingTrace(activity, 4));
  assert.throws(() => revealCodingTrace(activity, -1));
});
test("B3-T02 Parsons validates the order and indentation without exposing the answer", () => {
  const activity = fixtures.coding.parsons;
  const answer = {
    lines: ["A", "B", "C", "D"].map((lineId) => ({
      lineId,
      indentationLevel: lineId === "C" ? 1 : 0,
    })),
  };
  assert.equal(
    gradeCodingSubmission(activity, answer).status,
    "correct_practice",
  );
  answer.lines[2].indentationLevel = 0;
  assert.equal(
    gradeCodingSubmission(activity, answer).reasonCode,
    "INDENTATION_NEEDS_REVIEW",
  );
  answer.lines[2].indentationLevel = 1;
  [answer.lines[0], answer.lines[1]] = [answer.lines[1], answer.lines[0]];
  assert.equal(
    gradeCodingSubmission(activity, answer).status,
    "incorrect_practice",
  );
});
test("B3-T03 multiple valid orders and reviewed precedence DAGs both accept ties", () => {
  const activity = clone(fixtures.coding.parsons);
  activity.lineItems = [
    { lineId: "A", text: "a = 1", indentationLevel: 0 },
    { lineId: "B", text: "b = 2", indentationLevel: 0 },
    { lineId: "C", text: "print(a + b)", indentationLevel: 0 },
  ];
  activity.sourceCode = "a = 1\nb = 2\nprint(a + b)";
  activity.privateValidation.validOrders = [
    ["A", "B", "C"],
    ["B", "A", "C"],
  ];
  for (const order of activity.privateValidation.validOrders)
    assert.equal(
      gradeCodingSubmission(activity, {
        lines: order.map((lineId) => ({ lineId, indentationLevel: 0 })),
      }).status,
      "correct_practice",
    );
  delete activity.privateValidation.validOrders;
  activity.privateValidation.precedence = [
    ["A", "C"],
    ["B", "C"],
  ];
  for (const order of [
    ["A", "B", "C"],
    ["B", "A", "C"],
  ])
    assert.equal(
      gradeCodingSubmission(activity, {
        lines: order.map((lineId) => ({ lineId, indentationLevel: 0 })),
      }).status,
      "correct_practice",
    );
  activity.privateValidation.precedence.push(["C", "A"]);
  assert.throws(() => validateCodingActivity(activity), /CYCLIC_PARSONS_RULE/);
});
test("B3 static debug uses closed reviewed patches, never free form source execution", () => {
  assert.equal(
    gradeCodingSubmission(fixtures.coding.debug, { patchId: "include-three" })
      .status,
    "correct_practice",
  );
  assert.equal(
    gradeCodingSubmission(fixtures.coding.debug, { patchId: "skip-one" })
      .status,
    "incorrect_practice",
  );
  assert.throws(() =>
    gradeCodingSubmission(fixtures.coding.debug, { patchId: "arbitrary" }),
  );
  assert.throws(() =>
    gradeCodingSubmission(fixtures.coding.debug, { sourceCode: "print(6)" }),
  );
});
test("B3-T04 all static results remain conceptual practice after reveal or success", () => {
  for (const activity of [fixtures.coding.predict, fixtures.coding.trace]) {
    const result = gradeCodingSubmission(activity, { output: "6" });
    assert.equal(result.evidenceClass, "conceptual_practice");
    assert.equal(result.independentEligible, false);
    assert.equal("mastery" in result, false);
  }
});
test("B3-T09 explicit public projection redacts rubrics, trace states, distractor keys and answers", () => {
  for (const activity of Object.values(fixtures.coding)) {
    const dto = publicCodingActivity(activity);
    const serialized = JSON.stringify(dto);
    for (const secret of [
      "privateValidation",
      "expectedOutput",
      "correctPatchIds",
      "validOrders",
      "precedence",
      "variablesDisplay",
      "stdoutCumulative",
      "isDistractor",
    ])
      assert.equal(serialized.includes(secret), false, secret);
    assert.equal(dto.independentEligible, false);
  }
  assert.equal(publicCodingActivity(fixtures.coding.trace).traceStepCount, 4);
  assert.equal(
    "sourceCode" in publicCodingActivity(fixtures.coding.parsons),
    false,
  );
});
test("B3 validates immutable snapshots, empty output, preserved spaces and mismatched trace references", () => {
  const activity = clone(fixtures.coding.predict);
  activity.privateValidation.expectedOutput = "";
  assert.equal(
    gradeCodingSubmission(activity, { output: "" }).status,
    "correct_practice",
  );
  assert.equal(
    gradeCodingSubmission(fixtures.coding.predict, { output: " 6" }).status,
    "incorrect_practice",
  );
  for (const patch of [
    { sourceCode: "import os" },
    { sourceCode: "print(__import__('os'))" },
    { sourceCode: "while True:\n    print(1)" },
    { hiddenTests: [] },
  ])
    assert.throws(() =>
      validateCodingActivity({ ...fixtures.coding.predict, ...patch }),
    );
  const trace = clone(fixtures.coding.trace);
  trace.privateValidation.traceSteps[0].sourceLine = 50;
  assert.throws(() => validateCodingActivity(trace));
  trace.privateValidation.traceSteps[0].sourceLine = 3;
  trace.privateValidation.expectedOutput = "7";
  assert.throws(
    () => validateCodingActivity(trace),
    /CODING_TRACE_OUTPUT_MISMATCH/,
  );
  const pinned = validateCodingActivity(fixtures.coding.trace);
  revealCodingTrace(pinned, 0).variablesDisplay.total = 100;
  assert.equal(revealCodingTrace(pinned, 0).variablesDisplay.total, 1);
});
test("B3 rejects duplicate/unknown lines and inconsistent reviewed orders", () => {
  const activity = fixtures.coding.parsons;
  const lines = ["A", "A", "C", "D"].map((lineId) => ({
    lineId,
    indentationLevel: 0,
  }));
  assert.throws(() => gradeCodingSubmission(activity, { lines }));
  lines[1].lineId = "unknown";
  assert.throws(() => gradeCodingSubmission(activity, { lines }));
  const bad = clone(activity);
  bad.privateValidation.precedence = [["D", "A"]];
  assert.throws(() => validateCodingActivity(bad), /INCONSISTENT_PARSONS_RULE/);
});
