import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { observeTransition } = require("../dist/diagnosis-rules.js");
const { DiagnosisService } = require("../dist/diagnosis.js");
const i = (v) =>
  v < 0
    ? { type: "Negate", operand: i(-v) }
    : { type: "Integer", value: String(v) };
const x = { type: "Variable", name: "س" };
const b = (type, left, right) => ({ type, left, right });
const eq = (left, right) => ({
  schemaVersion: "math-ast-v1",
  root: b("Equation", left, right),
});
const invalid = {
  mathStatus: "verified_invalid",
  evidence: { witness: { satisfiesPrevious: true, satisfiesNext: false } },
};
const observe = (p, q, v = invalid, prior = true) =>
  observeTransition(p, q, v, prior);
test("six distinct structural observations remain hypotheses, including overlaps", () => {
  const cases = [
    [
      eq(b("Multiply", i(5), b("Add", x, i(4))), i(35)),
      eq(b("Add", b("Multiply", i(5), x), i(4)), i(35)),
      "ERR-ALG-01",
    ],
    [
      eq(b("Subtract", x, i(9)), i(-4)),
      eq(x, b("Subtract", i(-4), i(9))),
      "ERR-ALG-02",
    ],
    [eq(b("Add", x, i(9)), i(12)), eq(b("Add", x, i(9)), i(3)), "ERR-ALG-03"],
    [
      eq(b("Multiply", i(7), x), i(21)),
      eq(x, b("Multiply", i(21), i(7))),
      "ERR-ALG-04",
    ],
    [eq(x, b("Subtract", i(14), i(8))), eq(x, i(7)), "ERR-ALG-05"],
    [
      eq(b("Multiply", i(-5), b("Subtract", x, i(4))), i(10)),
      eq(b("Subtract", b("Multiply", i(-5), x), i(20)), i(10)),
      "ERR-ALG-06",
    ],
  ];
  for (const [p, q, code] of cases) {
    const h = observe(p, q);
    assert.equal(h.primary, code);
    assert.notEqual(h.state, "supported_by_probe");
    assert.ok(h.observation.length);
  }
  assert.deepEqual(observe(cases[1][0], cases[1][1]).candidates, [
    "ERR-ALG-02",
    "ERR-ALG-04",
  ]);
  assert.deepEqual(observe(cases[5][0], cases[5][1]).candidates, [
    "ERR-ALG-06",
    "ERR-ALG-01",
  ]);
});
test("valid, abstention, technical failure, missing witness and broken prior path cannot diagnose", () => {
  const p = eq(x, i(2)),
    q = eq(x, i(3));
  for (const mathStatus of [
    "verified_valid",
    "syntax_error",
    "unsupported",
    "inconclusive",
    "service_error",
  ])
    assert.equal(observe(p, q, { ...invalid, mathStatus }), null);
  assert.equal(
    observe(p, q, { mathStatus: "verified_invalid", evidence: null }),
    null,
  );
  assert.equal(
    observe(p, q, {
      ...invalid,
      evidence: { witness: { satisfiesPrevious: true, satisfiesNext: true } },
    }),
    null,
  );
  assert.equal(observe(p, q, invalid, false), null);
});
test("a wrong isolated numeric answer does not reveal the procedure or a misconception", () => {
  assert.equal(
    observe(eq(b("Multiply", i(2), x), i(4)), eq(x, i(3))).state,
    "unresolved",
  );
});
test("same structural one-sided change receives the same tentative policy for different numbers", () => {
  for (const n of [3, 5, 13]) {
    const p = eq(b("Add", x, i(n)), i(20)),
      q = eq(b("Add", x, i(n)), i(20 - n));
    assert.equal(observe(p, q).state, "tentative");
  }
});
test("reversed equation sides and harmless grouping do not require text matching", () => {
  const p = eq(i(35), b("Multiply", i(5), b("Add", x, i(4))));
  const q = eq(i(35), b("Add", b("Multiply", i(5), x), i(4)));
  assert.equal(observe(p, q).primary, "ERR-ALG-01");
});
test("only owned bounded ASTs are eligible, and a zero division never becomes an arithmetic diagnosis", () => {
  assert.equal(
    observe({ schemaVersion: "foreign", root: {} }, eq(x, i(3))),
    null,
  );
  let huge = x;
  for (let n = 0; n < 30; n++) huge = b("Add", huge, i(1));
  assert.equal(observe(eq(huge, i(9)), eq(x, i(3))), null);
  assert.equal(
    observe(eq(x, b("Divide", i(9), i(0))), eq(x, i(3))).primary,
    null,
  );
});
test("PH06 activation fails closed outside explicit synthetic review", () => {
  assert.throws(
    () => new DiagnosisService({ syntheticData: false }, true),
    /synthetic/,
  );
  assert.equal(
    new DiagnosisService({ syntheticData: true }, false).active,
    false,
  );
});
