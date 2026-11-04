import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  learningObservation,
  evidenceState,
  publicMathReport,
} = require("../dist/learning-policy.js");
const { LearningService } = require("../dist/learning.js");
const report = (status = "verified_valid", complete = true) => ({
  isCurrent: true,
  scope: "current_sequence",
  transitions: [{ mathStatus: status }],
  completion: { canMarkAttemptCompleted: complete },
});
test("only a current verified complete chain supports a positive independent observation", () => {
  assert.equal(learningObservation(report(), true), "positive");
  assert.equal(learningObservation(report(), false), "assisted");
  assert.equal(
    learningObservation(report("verified_valid", false), true),
    "non_assessable",
  );
  assert.equal(
    learningObservation({ ...report(), isCurrent: false }, true),
    "non_assessable",
  );
  assert.equal(
    learningObservation({ ...report(), scope: "target_edge" }, true),
    "non_assessable",
  );
  assert.equal(
    learningObservation({ ...report(), transitions: [] }, true),
    "non_assessable",
  );
});
for (const status of [
  "syntax_error",
  "unsupported",
  "inconclusive",
  "service_error",
])
  test(
    status + " never creates negative or positive conceptual evidence",
    () => {
      assert.equal(learningObservation(report(status), true), "non_assessable");
      assert.equal(
        evidenceState([
          { observation: "non_assessable", event_kind: "transfer_observation" },
        ]),
        "not_assessed",
      );
    },
  );
test("an invalid edge before a correct final answer cannot count as independent transfer", () => {
  const r = {
    ...report(),
    transitions: [
      { mathStatus: "verified_invalid" },
      { mathStatus: "verified_valid" },
    ],
  };
  assert.equal(learningObservation(r, true), "needs_review");
});
test("non-assessable attempts do not erase valid prior evidence; guided activity is never a transfer count", () => {
  assert.equal(evidenceState([]), "not_assessed");
  assert.equal(
    evidenceState([{ observation: "assisted", event_kind: "guided_practice" }]),
    "practice_with_support",
  );
  assert.equal(
    evidenceState([
      { observation: "positive", event_kind: "transfer_observation" },
      { observation: "non_assessable", event_kind: "transfer_observation" },
    ]),
    "new_evidence_of_understanding",
  );
  assert.equal(
    evidenceState([
      { observation: "needs_review", event_kind: "transfer_observation" },
    ]),
    "needs_followup",
  );
});
test("activation is restricted to synthetic stores and explicitly bounded finite loops", () => {
  assert.throws(
    () => new LearningService({ syntheticData: false }, true),
    /synthetic/,
  );
  assert.throws(
    () => new LearningService({ syntheticData: true }, true, 0, 2),
    /bounded/,
  );
  assert.throws(
    () => new LearningService({ syntheticData: true }, true, 2, 11),
    /bounded/,
  );
});

test("public transfer reports hide solution-bearing proofs on copies, without changing math truth", () => {
  const r = {
    ...report(),
    transitions: [
      {
        mathStatus: "verified_invalid",
        evidence: {
          previousSolution: {
            kind: "singleton",
            value: { num: "2", den: "1" },
          },
        },
      },
    ],
    diagnosisCandidate: { state: "tentative" },
  };
  const p = publicMathReport("transfer", r);
  assert.equal(p.transitions[0].evidence, null);
  assert.equal(p.diagnosisCandidate, null);
  assert.equal(p.transitions[0].mathStatus, r.transitions[0].mathStatus);
  assert.ok(r.transitions[0].evidence);
  assert.equal(publicMathReport("main", r), r);
});

test("an unresolved verified difficulty remains follow-up after guided practice, while valid transfer evidence is retained", () => {
  assert.equal(
    evidenceState([
      { observation: "assisted", event_kind: "guided_practice" },
      { observation: "needs_review", event_kind: "transfer_observation" },
    ]),
    "needs_followup",
  );
  assert.equal(
    evidenceState([
      { observation: "positive", event_kind: "transfer_observation" },
      { observation: "needs_review", event_kind: "transfer_observation" },
    ]),
    "new_evidence_of_understanding",
  );
});
