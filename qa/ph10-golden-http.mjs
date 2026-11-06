import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { MathGateway } = require("../apps/api/dist/math-gateway.js");
const bytes = readFileSync("docs/14-GOLDEN-DATASET.cases.json"),
  data = JSON.parse(bytes);
const gateway = new MathGateway({
  baseUrl: process.env.MATH_ENGINE_BASE_URL,
  token: process.env.MATH_INTERNAL_TOKEN,
  timeoutMs: 15000,
  expectedEngine: "0.3.0",
});
const context = () => ({
  attemptId: randomUUID(),
  attemptRevision: 1,
  problemRevisionId: randomUUID(),
  notationProfile: "ar-mashriq-school-v1",
  domain: "reals",
});
const rational = (text) => {
  const ascii = text
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replaceAll("−", "-")
    .replace(/[{} ]/g, "");
  const [n, d = "1"] = ascii.split("/");
  return [BigInt(n), BigInt(d)];
};
const member = (set, value) =>
  set === "ℝ" ||
  (set !== "∅" && rational(set)[0] * value[1] === value[0] * rational(set)[1]);
function sameSet(actual, expected) {
  if (expected === "ℝ" || expected === "∅")
    return actual.kind === (expected === "ℝ" ? "all_reals" : "empty");
  const [n, d] = rational(expected);
  return (
    actual.kind === "singleton" &&
    BigInt(actual.value.num) * d === n * BigInt(actual.value.den)
  );
}
const cases = [],
  timings = [];
for (const c of data.parse) {
  const raw = c.raw
      .replaceAll("[U+202E]", "\u202e")
      .replaceAll("[U+2066]", "\u2066"),
    start = performance.now();
  try {
    const r = await gateway.parse(
      context(),
      { kind: "step", stepVersionId: randomUUID() },
      raw,
    );
    assert.equal(r.parseStatus, c.status === "accepted" ? "parsed" : c.status);
    assert.equal(r.reasonCode, c.reason === "—" ? null : c.reason);
    if (r.parseStatus === "parsed") assert.equal(r.ast.sourceRaw, raw);
    cases.push({
      id: c.id,
      status: "PASS",
      actual: r,
      transport: "NestJS MathGateway -> authenticated Python HTTP",
    });
  } catch (e) {
    cases.push({ id: c.id, status: "FAIL", error: e.message });
  }
  timings.push(performance.now() - start);
}
for (const c of data.math) {
  const start = performance.now();
  try {
    const r = await gateway.verify(context(), {
      fromKind: "problem",
      fromStepVersionId: null,
      toStepVersionId: randomUUID(),
      fromRaw: c.before,
      toRaw: c.after,
    });
    assert.equal(r.status, c.status);
    assert.ok(sameSet(r.evidence.previousSolution, c.before_set));
    assert.ok(sameSet(r.evidence.nextSolution, c.after_set));
    if (r.status === "verified_invalid") {
      const w = r.evidence.witness,
        v = [BigInt(w.value.num), BigInt(w.value.den)];
      assert.notEqual(member(c.before_set, v), member(c.after_set, v));
      assert.equal(w.satisfiesPrevious, member(c.before_set, v));
      assert.equal(w.satisfiesNext, member(c.after_set, v));
      assert.notEqual(
        member(c.before_set, rational(c.witness)),
        member(c.after_set, rational(c.witness)),
      );
    }
    cases.push({
      id: c.id,
      status: "PASS",
      actual: r,
      independentExpectedSetsAndWitnessCheck: true,
      kind: c.kind,
      transport: "NestJS MathGateway -> authenticated Python HTTP",
    });
  } catch (e) {
    cases.push({ id: c.id, status: "FAIL", error: e.message });
  }
  timings.push(performance.now() - start);
}
timings.sort((a, b) => a - b);
const report = {
  runId: process.env.PH10_RUN_ID,
  commit: process.env.PH10_COMMIT,
  at: new Date().toISOString(),
  datasetSha256: createHash("sha256").update(bytes).digest("hex"),
  reviewStatus: data.review_status,
  cases,
  performance: {
    scope:
      "97 sequential development cases; container-local gateway HTTP, no load test",
    samples: timings.length,
    p50Ms: timings[Math.ceil(timings.length * 0.5) - 1],
    p95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
  },
};
writeFileSync(
  "/evidence/golden-math-http.json",
  JSON.stringify(report, null, 2) + "\n",
);
assert.equal(cases.filter((c) => c.status === "FAIL").length, 0);
console.log(
  "97 Golden parser/math cases executed through HTTP; reference review remains pending",
);
