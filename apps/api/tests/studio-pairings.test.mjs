import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  selectStudioPairing,
  pairingEquationKey,
  materializeStudioPairings,
} = require("../dist/studio-pairings.js");
const drafts = JSON.parse(
  readFileSync("apps/api/data/algebra-expansion.draft.v1.json", "utf8"),
);
const reviewed = (i) => ({
  ...structuredClone(drafts[i]),
  hints: drafts[i].hints.map((h) => ({ ...h, reviewed: true })),
});
const source = (index, id) => ({
  id,
  item_id: "item-" + id,
  payload: reviewed(index),
  content_hash: "published-hash-" + id,
  validation: {
    valid: true,
    issues: [],
    checkedAt: "2026-11-07T00:00:00.000Z",
    engine: "math-internal-v1",
  },
  reviewed_by: "00000000-0000-4000-8000-000000000004",
  reviewed_at: new Date("2026-11-07T00:00:00.000Z"),
  published_at: new Date("2026-11-07T00:00:00.000Z"),
});
const rows = () => [source(1, "rem-1"), source(2, "transfer-1")];
test("display-only equation copies cannot masquerade as fresh transfer", () => {
  assert.equal(
    pairingEquationKey("٢(س + ٣) = ٨"),
    pairingEquationKey("8=2 × (س+3)"),
  );
  assert.notEqual(
    pairingEquationKey("٢(س + ٣) = ٨"),
    pairingEquationKey("٣(س + ٤) = ١٨"),
  );
  const candidates = rows();
  candidates[1].payload.algebra.equationRaw = "٨ = ٢ × (س + ٣)";
  assert.equal(selectStudioPairing(reviewed(0), candidates), null);
});
test("pairing needs reviewed published validated same-lesson sources with contrast", () => {
  const root = reviewed(0),
    pair = selectStudioPairing(root, rows());
  assert.equal(pair.remediation.id, "rem-1");
  assert.equal(pair.transfer.id, "transfer-1");
  for (const change of [
    (s) => (s.validation.valid = false),
    (s) => (s.validation.engine = "language-model"),
    (s) => (s.reviewed_by = null),
    (s) => (s.reviewed_at = null),
    (s) => (s.published_at = null),
    (s) => (s.payload.hints[0].reviewed = false),
    (s) => (s.payload.lessonCode = "unrelated"),
    (s) => (s.payload.skillCodes = ["SK-ALG-07"]),
    (s) => (s.payload.familyCode = root.familyCode),
    (s) => (s.payload.difficulty = 3),
  ]) {
    const candidates = rows();
    change(candidates[0]);
    assert.equal(selectStudioPairing(root, candidates), null);
  }
  const sameFamily = rows();
  sameFamily[1].payload.familyCode = sameFamily[0].payload.familyCode;
  assert.equal(selectStudioPairing(root, sameFamily), null);
});
function fakeTx({
  status = "draft",
  candidates = rows(),
  family = reviewed(0).familyCode,
} = {}) {
  const calls = [];
  return {
    calls,
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join("?");
      calls.push({ kind: "query", sql, values });
      return sql.includes("FROM problem_revisions p JOIN content_releases")
        ? [{ id: "root", learning_family: family, status }]
        : candidates;
    },
    $executeRaw: async (strings, ...values) => {
      calls.push({ kind: "mutation", sql: strings.join("?"), values });
      return 1;
    },
  };
}
const input = () => ({
  root: reviewed(0),
  rootRevisionId: "00000000-0000-4000-8000-000000000001",
  releaseId: "00000000-0000-4000-8000-000000000002",
  skillId: "00000000-0000-4000-8000-000000000003",
  reviewerId: "00000000-0000-4000-8000-000000000004",
});
test("snapshot pairing clones into the new release without modifying source revisions", async () => {
  const candidates = rows(),
    before = JSON.stringify(candidates),
    tx = fakeTx({ candidates }),
    context = input();
  const result = await materializeStudioPairings(tx, context);
  assert.ok(result.pairingId);
  assert.notEqual(result.remediationRevisionId, result.transferRevisionId);
  assert.equal(JSON.stringify(candidates), before);
  const mutations = tx.calls.filter((c) => c.kind === "mutation");
  assert.ok(mutations.every((c) => c.sql.startsWith("INSERT")));
  const clones = mutations.filter((c) =>
    c.sql.includes("INSERT INTO problem_revisions"),
  );
  assert.equal(clones.length, 2);
  assert.ok(
    clones.every(
      (c) =>
        c.values.includes(context.releaseId) &&
        !c.values.includes(context.rootRevisionId),
    ),
  );
  assert.equal(
    mutations.some((c) => c.sql.includes("studio_algebra_links")),
    false,
  );
  assert.equal(
    mutations.filter((c) =>
      c.sql.includes("INSERT INTO intervention_templates"),
    ).length,
    8,
  );
  const pairing = mutations.find((c) =>
    c.sql.includes("INSERT INTO content_pairings"),
  );
  assert.ok(pairing.values.includes(result.remediationRevisionId));
  assert.ok(pairing.values.includes(result.transferRevisionId));
  assert.ok(pairing.values.includes(context.rootRevisionId));
  const provenance = pairing.values.find(
    (v) => typeof v === "string" && v.startsWith('{"status"'),
  );
  const checks = JSON.parse(provenance);
  assert.equal(checks.basis, "snapshot_of_validated_published_content");
  assert.equal(checks.sources.length, 2);
  assert.equal(checks.sources[0].payload.kind, "remediation");
});
test("missing reviewed pair and already frozen release fail before snapshot writes", async () => {
  const none = fakeTx({ candidates: [] });
  await assert.rejects(
    () => materializeStudioPairings(none, input()),
    (e) => e.status === 422 && e.messageAr.includes("انشر أولًا"),
  );
  assert.equal(
    none.calls.some((c) => c.kind === "mutation"),
    false,
  );
  const frozen = fakeTx({ status: "published" });
  await assert.rejects(
    () => materializeStudioPairings(frozen, input()),
    (e) => e.status === 409,
  );
  assert.equal(
    frozen.calls.some((c) => c.kind === "mutation"),
    false,
  );
  const nonMain = fakeTx();
  assert.equal(
    (
      await materializeStudioPairings(nonMain, {
        ...input(),
        root: reviewed(1),
      })
    ).pairingId,
    null,
  );
  assert.equal(nonMain.calls.length, 0);
});
test("all six prepared lessons have coherent conceptual hints and eligible draft pairs after explicit simulated review", () => {
  for (let n = 0; n < drafts.length; n += 4) {
    const root = reviewed(n);
    assert.ok(
      selectStudioPairing(root, [
        source(n + 1, "r" + n),
        source(n + 2, "t" + n),
      ]),
    );
    for (const item of drafts.slice(n, n + 4))
      for (const h of item.hints.filter((h) => h.level < 4))
        assert.equal(/الكمية|الوحدة|معطى/.test(h.textAr), false);
  }
});
