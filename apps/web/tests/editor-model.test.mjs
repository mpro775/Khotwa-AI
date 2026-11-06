import assert from "node:assert/strict";
import test from "node:test";
import {
  findDisplayFixture,
  localInputIssue,
  previousSymbolStart,
  replaceSelection,
  sourceOffset,
  visibleRaw,
} from "../src/editor-model.ts";
import { editorFixtures, issueSamples } from "../src/editor-fixtures.ts";

test("AN-002: original ASCII digits stay distinct from a known Arabic display", () => {
  const raw = "2س + 3 = 7";
  const recipe = findDisplayFixture(raw);
  assert.equal(recipe?.raw, "٢س + ٣ = ٧");
  assert.equal(raw, "2س + 3 = 7");
  assert.equal(localInputIssue(raw), null);
});
test("AN-011: fraction recipe explicitly keeps numerator 1 and denominator 2", () => {
  const parts = findDisplayFixture("س = ١/٢")?.display;
  assert.deepEqual(parts?.at(-1), { numerator: "١", denominator: "٢" });
});
test("known examples and aliases retain their own source without a parser claim", () => {
  assert.equal(
    new Set(editorFixtures.map((f) => f.id)).size,
    editorFixtures.length,
  );
  for (const f of editorFixtures)
    for (const raw of [f.raw, ...(f.aliases ?? [])]) {
      assert.equal(findDisplayFixture(raw)?.id, f.id);
      assert.equal(localInputIssue(raw), null);
    }
});
test("AN-013/018/020: ambiguous or unsupported samples never acquire a display meaning", () => {
  for (const f of issueSamples) {
    assert.equal(localInputIssue(f.raw)?.status, f.status);
    assert.equal(findDisplayFixture(f.raw), undefined);
  }
});
test("AN-030: directional and other hidden controls are reported and kept visible in audit", () => {
  for (const c of [
    "\u200e",
    "\u200f",
    "\u202e",
    "\u2066",
    "\u2069",
    "\u200d",
    "\u0000",
  ]) {
    const raw = "س" + c + "=٢";
    assert.equal(localInputIssue(raw)?.status, "syntax_error");
    assert.equal(localInputIssue(raw)?.start, 1);
    assert.match(visibleRaw(raw), /\\u[0-9a-f]{4}/);
    assert.equal([...raw][1], c);
  }
});
test("a 257 code point paste is retained and flagged rather than silently truncated", () => {
  const raw = "٢".repeat(257);
  assert.equal(localInputIssue(raw)?.status, "unsupported");
  assert.equal(raw.length, 257);
  assert.equal(localInputIssue("٢".repeat(256)), null);
});
test("new edits immediately invalidate the previous fixture meaning and local issue", () => {
  assert.ok(findDisplayFixture("٢س + ٣ = ٧"));
  assert.equal(findDisplayFixture("٢س + ٣ = ٨"), undefined);
  assert.equal(localInputIssue("س² + ١ = ٠")?.status, "unsupported");
  assert.equal(localInputIssue("س = ٢"), null);
  assert.equal(findDisplayFixture("<script>alert(1)</script>"), undefined);
});
test("unknown text, including x, is never aliased to س or treated as a successful parse", () => {
  for (const raw of ["x=2", "س/س=1", "١/٢س=٣", "3.5س=7", "نص حر", "سَ=٢"]) {
    assert.equal(findDisplayFixture(raw), undefined);
  }
});
test("selection replacement preserves source order and exact punctuation", () => {
  assert.deepEqual(replaceSelection("٢(س + ٣) = ١٠", 6, 7, "٤"), {
    raw: "٢(س + ٤) = ١٠",
    caret: 7,
  });
});
test("issue selection translates Unicode code points into textarea UTF-16 offsets", () => {
  assert.equal(sourceOffset("🙂س=٢", 2), 3);
  assert.equal(sourceOffset("س\u202e=٢", 1), 1);
});

test("shallow editor guards flag foreign characters and unbalanced brackets but never assert math validity", () => {
  for (const raw of ["x=2", "جا(30)", "س^2=4", "3.5س=7", "۱س=۲"])
    assert.equal(localInputIssue(raw)?.status, "unsupported");
  for (const raw of ["سَ=٢", "٢(س+٣=١٠", "س)=٢", "س=٢=٣"])
    assert.equal(localInputIssue(raw)?.status, "syntax_error");
  assert.equal(localInputIssue("س/س=1"), null);
  assert.equal(findDisplayFixture("س/س=1"), undefined);
});
test("deleting a pasted supplementary character does not split a UTF-16 surrogate pair", () => {
  assert.equal(previousSymbolStart("🙂س", 2), 0);
  assert.equal(previousSymbolStart("س", 0), 0);
});
