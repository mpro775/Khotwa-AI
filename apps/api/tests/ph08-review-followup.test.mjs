import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const {
  generationRules,
  validateGeneratedMeaning,
} = require("../dist/ph08-generative.js");
const {
  buildHintContext,
  composeWithDeadline,
} = require("../dist/ai-tutor.js");
const { GeminiAdapter } = require("../dist/gemini-adapter.js");
const { GeminiQuota } = require("../dist/gemini-quota.js");
const { observeTransition } = require("../dist/diagnosis-rules.js");
const context = (level) =>
  buildHintContext({
    level,
    templateId: "review-test",
    contentVersion: "draft",
    textAr: "راجع خطوتك بهدوء.",
    variants: [],
    skillNameAr: "للمراجعة فقط",
    observationAr: "السبب غير محسوم.",
    maxOutputTokens: 256,
  });
test("the division example is an existing tentative arithmetic observation, not new PH08 math policy", () => {
  const integer = (n) => ({ type: "Integer", value: String(n) }),
    x = { type: "Variable", name: "س" };
  const equation = (right) => ({
    schemaVersion: "math-ast-v1",
    root: { type: "Equation", left: x, right },
  });
  const before = equation({
      type: "Divide",
      left: integer(12),
      right: integer(3),
    }),
    after = equation(integer(9));
  const observed = observeTransition(
    before,
    after,
    {
      mathStatus: "verified_invalid",
      evidence: { witness: { satisfiesPrevious: true, satisfiesNext: false } },
    },
    true,
  );
  assert.equal(12 / 3, 4);
  assert.notEqual(12 / 3, 9);
  assert.equal(observed.primary, "ERR-ALG-05");
  assert.equal(observed.family, "calculation_divide");
  assert.notEqual(observed.state, "supported_by_probe");
});
test("owner-approved SK06 arithmetic generation gate leaves the domain mapping unresolved", () => {
  const p = {
    skillCode: "SK-ALG-06",
    errorCode: "ERR-ALG-05",
    diagnosisMode: "possible",
    phase: "remediation",
    transferExited: false,
  };
  assert.equal(generationRules(p, "H1"), null);
  const decision = readFileSync("planning/ph08-review-decisions.md", "utf8");
  assert.match(decision, /pending/);
  assert.match(decision, /calculation_divide/);
});
for (const diagnosisMode of ["possible", "unresolved"])
  for (const level of [1, 2, 3])
    test(`temporary SK06/ERR05 gate ${diagnosisMode} H${level} cannot contact Gemini`, async (t) => {
      const dir = mkdtempSync(path.join(tmpdir(), "ph08-mapping-gate-"));
      const quota = new GeminiQuota({
        ledgerPath: path.join(dir, "offline.json"),
        roundLimit: 4,
        dailyRemaining: 4,
        validUntil: Date.now() + 60000,
        model: "gemini-3.5-flash-lite",
      });
      t.after(() => {
        quota.close();
        rmSync(dir, { recursive: true, force: true });
      });
      const p = {
        skillCode: "SK-ALG-06",
        errorCode: "ERR-ALG-05",
        diagnosisMode,
        phase: "remediation",
        transferExited: false,
      };
      let sent = 0;
      const adapter = new GeminiAdapter(
        {
          apiKey: "offline-test",
          model: "gemini-3.5-flash-lite",
          thinkingLevel: "minimal",
        },
        quota,
        () => true,
        () => {},
        async () => {
          sent++;
          throw Error("must not dispatch");
        },
        {
          prepare: async () => p,
          meaning: (text, c) => validateGeneratedMeaning(text, c, p),
        },
      );
      assert.equal(
        (
          await composeWithDeadline(
            adapter,
            context(level),
            new AbortController().signal,
            200,
            256,
          )
        ).text,
        null,
      );
      assert.equal(sent, 0);
      assert.equal(quota.spent, 0);
      assert.equal(adapter.requiresReviewedFallback(), true);
    });
for (const mode of ["possible", "unresolved"])
  for (const level of [1, 2, 3])
    test(`SK08 ${mode} H${level} cannot dispatch or reserve Gemini quota`, async (t) => {
      const dir = mkdtempSync(path.join(tmpdir(), "ph08-review-")),
        quota = new GeminiQuota({
          ledgerPath: path.join(dir, "offline.json"),
          roundLimit: 10,
          dailyRemaining: 10,
          validUntil: Date.now() + 60000,
          model: "gemini-3.5-flash-lite",
        });
      t.after(() => {
        quota.close();
        rmSync(dir, { recursive: true, force: true });
      });
      const p = {
        skillCode: "SK-ALG-08",
        errorCode: mode === "possible" ? "ERR-ALG-05" : null,
        diagnosisMode: mode,
        phase: "remediation",
        transferExited: false,
      };
      let dispatched = 0;
      const adapter = new GeminiAdapter(
        {
          apiKey: "offline-test",
          model: "gemini-3.5-flash-lite",
          thinkingLevel: "minimal",
        },
        quota,
        () => true,
        () => {},
        async () => {
          dispatched++;
          throw Error("must not dispatch");
        },
        {
          prepare: async () => p,
          meaning: (text, c) => validateGeneratedMeaning(text, c, p),
        },
      );
      const c = context(level),
        result = await composeWithDeadline(
          adapter,
          c,
          new AbortController().signal,
          200,
          256,
        );
      assert.equal(generationRules(p, c.targetHintLevel), null);
      assert.equal(result.text, null);
      assert.equal(quota.spent, 0);
      assert.equal(dispatched, 0);
      assert.equal(adapter.requiresReviewedFallback(), true);
    });
test("fraction transfer remains blocked from generation before and after measurement exit", () => {
  for (const transferExited of [false, true]) {
    const p = {
      skillCode: "SK-ALG-08",
      errorCode: null,
      diagnosisMode: "unresolved",
      phase: "transfer",
      transferExited,
    };
    assert.equal(generationRules(p, "H1"), null);
    assert.equal(
      validateGeneratedMeaning("راجع طرفي المساواة.", context(1), p).text,
      null,
    );
  }
});
test("the review pack carries draft status, no signature and hashes bound to source and content", () => {
  const pack = JSON.parse(
    readFileSync("qa-reports/ph08-content-review-pack.json", "utf8"),
  );
  const { packSha256, ...payload } = pack;
  assert.equal(
    createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    packSha256,
  );
  assert.equal(pack.status, "draft");
  assert.equal(pack.reviewerSigned, null);
  assert.equal(pack.reviewedAt, null);
  assert.equal(pack.approvalEvidence, null);
  assert.equal(pack.actualGeminiCalls, 0);
  assert.equal(pack.candidates.length, 21);
  assert.equal(pack.specialCases.length, 3);
  assert.equal(pack.mappingFallbackCandidates.length, 3);
  assert.equal(
    pack.temporaryMappingGate.state,
    "owner_approved_temporary_block",
  );
  for (const c of pack.mappingFallbackCandidates) {
    assert.equal(c.reviewStatus, "draft");
    assert.equal(c.reviewDecision, null);
    assert.equal(c.eligibleForGeneration, false);
  }
  for (const c of pack.candidates) {
    const { contentSha256, ...content } = c;
    assert.equal(
      createHash("sha256").update(JSON.stringify(content)).digest("hex"),
      contentSha256,
    );
    assert.equal(c.reviewStatus, "draft");
    assert.equal(c.reviewDecision, null);
    const level = Number(c.hintLevel.slice(1)),
      ctx = context(level);
    assert.equal(
      validateGeneratedMeaning(c.generatedExampleAr, ctx, c.profile).text,
      c.generatedExampleAr,
    );
    assert.ok(!/[٠-٩0-9=×÷]/u.test(c.fallbackTextAr));
  }
  for (const c of pack.specialCases) {
    assert.equal(c.eligibleForGeneration, false);
    assert.equal(c.reviewStatus, "draft");
    assert.ok(
      c.publicationBlockedBy.includes("fraction_math_and_visual_checks_DR007"),
    );
  }
  assert.deepEqual(pack.approvalTemplate.approvedCandidateIds, []);
});
test("a future small four-attempt ceiling persists across restart without changing the previous ten-attempt ledger", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "ph08-review-budget-"));
  const config = {
    ledgerPath: path.join(dir, "proposed-offline.json"),
    roundLimit: 4,
    dailyRemaining: 4,
    validUntil: Date.now() + 60000,
    model: "gemini-3.5-flash-lite",
  };
  let quota = new GeminiQuota(config);
  t.after(() => {
    quota.close();
    rmSync(dir, { recursive: true, force: true });
  });
  for (let i = 0; i < 3; i++) quota.reserve();
  quota.close();
  quota = new GeminiQuota(config);
  quota.reserve();
  assert.equal(quota.spent, 4);
  assert.throws(() => quota.reserve(), /ROUND_OR_DAILY_LIMIT/);
});
