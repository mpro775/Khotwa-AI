import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const {
  reviewedCards,
  reviewedTemplateVersion,
  assertReviewedTemplate,
  PH08_CONTENT_AUTHORIZATION,
} = require("../dist/ph08-reviewed-content.js");
const { GeminiQuota } = require("../dist/gemini-quota.js");
const { GeminiAdapter } = require("../dist/gemini-adapter.js");
const { buildHintContext } = require("../dist/ai-tutor.js");
const { ph08TutoringFromEnvironment } = require("../dist/ph08-gemini.js");
const file = path.resolve("content/ph08-reviewed-2026-11-06.json");
test("a different actual model cannot supply displayed text", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ph08-model-"));
  const quota = new GeminiQuota({
    ledgerPath: path.join(dir, "quota.json"),
    roundLimit: 4,
    dailyRemaining: null,
    validUntil: Date.now() + 60000,
    model: "gemini-3.5-flash-lite",
  });
  const metrics = [];
  const adapter = new GeminiAdapter(
    {
      apiKey: "mock-only",
      model: "gemini-3.5-flash-lite",
      thinkingLevel: "minimal",
    },
    quota,
    () => true,
    (m) => metrics.push(m),
    async () => Response.json({ modelVersion: "gemini-other-model" }),
  );
  try {
    const context = buildHintContext({
      level: 1,
      templateId: "mock",
      contentVersion: "mock",
      textAr: "راجع ما تغير في خطوتك الأخيرة.",
      variants: [],
      skillNameAr: "مهارة اختبار",
      observationAr: "سبب غير محسوم",
      maxOutputTokens: 256,
    });
    await assert.rejects(
      adapter.adaptHint(context, new AbortController().signal),
    );
    assert.equal(metrics[0].outcome, "GEMINI_MODEL_MISMATCH");
    assert.equal(metrics[0].textOrigin, "none");
    assert.equal(quota.spent, 1);
  } finally {
    quota.close();
  }
});
test("27 exact owner-attested cards retain signature absence and fraction block", () => {
  const cards = reviewedCards(file),
    manifest = JSON.parse(readFileSync(file));
  assert.equal(cards.length, 27);
  assert.equal(manifest.reviewerSigned, false);
  assert.equal(manifest.reviewerReviewedAt, null);
  assert.equal(
    cards.filter((c) => c.operationalStatus === "reviewed_ph08_only").length,
    21,
  );
  assert.equal(
    cards.filter(
      (c) =>
        c.operationalStatus === "approved_fallback_only_generation_blocked",
    ).length,
    3,
  );
  for (const card of cards) {
    const row = {
      template_version: reviewedTemplateVersion(card),
      text_ar: card.textAr,
      hint_level: Number(card.hintLevel.slice(1)),
      error_code: card.errorCode,
      review_status: "reviewed",
    };
    if (card.skillCode === "SK-ALG-08")
      assert.throws(() => assertReviewedTemplate(cards, row));
    else {
      assert.equal(assertReviewedTemplate(cards, row).id, card.id);
      if (card.errorCode)
        assert.throws(() =>
          assertReviewedTemplate(cards, { ...row, skill_code: "SK-ALG-08" }),
        );
      assert.throws(() =>
        assertReviewedTemplate(cards, {
          ...row,
          text_ar: row.text_ar + " تغير",
        }),
      );
      assert.throws(() =>
        assertReviewedTemplate(cards, { ...row, review_status: "draft" }),
      );
    }
  }
});
test("modified manifest is rejected before trusting text", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ph08-content-")),
    target = path.join(dir, "changed.json");
  writeFileSync(target, readFileSync(file, "utf8") + " ");
  assert.throws(() => reviewedCards(target), /HASH_MISMATCH/);
});
test("quota stop survives restart and never replenishes reservations", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ph08-quota-"));
  const cfg = {
    ledgerPath: path.join(dir, "quota.json"),
    roundLimit: 4,
    dailyRemaining: null,
    validUntil: Date.now() + 60000,
    model: "gemini-3.5-flash-lite",
  };
  const q = new GeminiQuota(cfg);
  q.reserve();
  q.stopForQuota();
  q.close();
  const restarted = new GeminiQuota(cfg);
  assert.equal(restarted.spent, 1);
  assert.throws(() => restarted.reserve(), /QUOTA_STOPPED/);
  restarted.close();
});
test("unknown RPD exception requires exact new authorization, content and hard ceiling four", () => {
  const original = { ...process.env },
    dir = mkdtempSync(path.join(os.tmpdir(), "ph08-owner-round-"));
  const env = {
    AI_ENABLED: "true",
    PH08_API_ENABLED: "true",
    PH09_API_ENABLED: "false",
    PH08_GEMINI_OFFLINE: "false",
    PH08_GEMINI_GENERATIVE_ENABLED: "true",
    PH08_REVIEWED_CONTENT_ENABLED: "true",
    PH08_REVIEWED_CONTENT_PATH: file,
    GEMINI_API_KEY: "test-no-network",
    GEMINI_LIVE_AUTHORIZATION_ID: PH08_CONTENT_AUTHORIZATION,
    GEMINI_DAILY_QUOTA_POLICY: "owner_authorized_unknown_rpd_live4",
    GEMINI_DAILY_REMAINING: "unknown",
    GEMINI_ROUND_CALL_LIMIT: "4",
    GEMINI_MODEL: "gemini-3.5-flash-lite",
    GEMINI_THINKING_LEVEL: "minimal",
    GEMINI_QUOTA_VALID_UNTIL: new Date(Date.now() + 60000).toISOString(),
    GEMINI_QUOTA_LEDGER_PATH: path.join(
      dir,
      "ph08-generative-owner-20261106-live4.json",
    ),
  };
  try {
    Object.assign(process.env, env);
    const service = ph08TutoringFromEnvironment(
      { syntheticData: true },
      {},
      {},
      { requestTimeoutMs: 20000 },
      true,
    );
    assert.equal(service.gemini.quota.config.dailyRemaining, null);
    assert.equal(service.gemini.quota.config.roundLimit, 4);
    service.onModuleDestroy();
    for (const [key, value] of [
      ["GEMINI_ROUND_CALL_LIMIT", "5"],
      ["GEMINI_LIVE_AUTHORIZATION_ID", "old-grant"],
      [
        "GEMINI_QUOTA_LEDGER_PATH",
        path.join(dir, "ph08-gemini-first-round.json"),
      ],
      ["PH08_REVIEWED_CONTENT_ENABLED", "false"],
    ]) {
      Object.assign(process.env, env, { [key]: value });
      assert.throws(
        () =>
          ph08TutoringFromEnvironment(
            { syntheticData: true },
            {},
            {},
            { requestTimeoutMs: 20000 },
            true,
          ),
        /QUOTA_UNKNOWN/,
      );
    }
  } finally {
    process.env = original;
  }
});
