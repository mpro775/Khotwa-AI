import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const { GeminiQuota } = require("../dist/gemini-quota.js");
const { GeminiAdapter } = require("../dist/gemini-adapter.js");
const { buildHintContext } = require("../dist/ai-tutor.js");
const { ph08TutoringFromEnvironment } = require("../dist/ph08-gemini.js");
const context = () =>
  buildHintContext({
    level: 1,
    templateId: "synthetic-template",
    contentVersion: "draft-v1",
    textAr: "راقب الحدين داخل القوس.",
    variants: ["انظر إلى الحدين في القوس."],
    skillNameAr: "خاصية التوزيع",
    observationAr: "الانتقال يحتاج مراجعة دون جزم بالسبب.",
    maxOutputTokens: 256,
  });
const draft = (c) => ({
  schemaVersion: "ai-draft-v1",
  task: "hint_rephrase",
  decision: "usable",
  messageAr: c.reviewedHintTextAr,
  reasonCode: "APPROVED_HINT_REPHRASE",
  sourceTemplateId: c.sourceTemplateId,
  isAnswerRevealed: false,
});
function fixture(t, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "khotwa-gemini-"));
  let now = 100000;
  const config = {
    ledgerPath: path.join(dir, "quota.json"),
    roundLimit: 15,
    dailyRemaining: 100,
    validUntil: 1000000,
    model: "gemini-3.5-flash-lite",
    ...options,
  };
  const quota = new GeminiQuota(config, () => now);
  t.after(() => {
    quota.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    quota,
    config,
    dir,
    advance: (n) => {
      now += n;
    },
  };
}
test("rolling quota persists reservations, counts failures and respects the exact 60s boundary", (t) => {
  const { quota, config, advance } = fixture(t);
  for (let i = 0; i < 10; i++) quota.reserve();
  assert.throws(() => quota.reserve(), /ROLLING_LIMIT/);
  advance(59999);
  assert.throws(() => quota.reserve(), /ROLLING_LIMIT/);
  advance(1);
  quota.reserve();
  assert.equal(quota.spent, 11);
  quota.close();
  const restarted = new GeminiQuota(config, () => 160000);
  assert.equal(restarted.spent, 11);
  for (let i = 0; i < 4; i++) restarted.reserve();
  assert.throws(() => restarted.reserve(), /ROUND_OR_DAILY_LIMIT/);
  restarted.close();
});
test("actual remaining daily allowance and reset time fail closed", (t) => {
  const { quota, advance } = fixture(t, { dailyRemaining: 1 });
  quota.reserve();
  assert.throws(() => quota.reserve(), /ROUND_OR_DAILY_LIMIT/);
  advance(900000);
  assert.throws(() => quota.reserve(), /QUOTA_EXPIRED/);
});
test("exclusive lock prevents a second process/adapter from bypassing the ledger", (t) => {
  const { config } = fixture(t);
  assert.throws(() => new GeminiQuota(config, () => 100000), /EEXIST/);
});
test("corrupt ledger and changed round configuration cannot replenish a round", (t) => {
  const { quota, config } = fixture(t);
  quota.reserve();
  quota.close();
  assert.throws(
    () => new GeminiQuota({ ...config, roundLimit: 10 }, () => 100000),
    /LEDGER_INVALID/,
  );
  writeFileSync(config.ledgerPath, "{}");
  assert.throws(() => new GeminiQuota(config, () => 100000), /LEDGER_INVALID/);
});
test("structured request uses configurable model/minimal, secret header and local schema validation", async (t) => {
  const { quota, config } = fixture(t),
    c = context(),
    metrics = [];
  const adapter = new GeminiAdapter(
    {
      apiKey: "secret-test-only",
      model: config.model,
      thinkingLevel: "minimal",
    },
    quota,
    () => true,
    (m) => metrics.push(m),
    async (url, options) => {
      assert.equal(
        url,
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
      );
      assert.equal(options.headers["x-goog-api-key"], "secret-test-only");
      assert.equal(options.redirect, "error");
      const body = JSON.parse(options.body),
        generation = body.generationConfig;
      assert.equal(generation.thinkingConfig.thinkingLevel, "minimal");
      assert.equal(generation.responseMimeType, "application/json");
      assert.equal(generation.responseJsonSchema.additionalProperties, false);
      assert.deepEqual(
        generation.responseJsonSchema.properties.messageAr.enum,
        [c.reviewedHintTextAr, ...c.approvedRephrasesAr],
      );
      assert.ok(!options.body.includes("secret-test-only"));
      return Response.json({
        modelVersion: config.model,
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 60,
          totalTokenCount: 180,
        },
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(draft(c)) }] },
          },
        ],
      });
    },
  );
  assert.equal(
    JSON.parse(
      (await adapter.adaptHint(c, new AbortController().signal)).rawJson,
    ).messageAr,
    c.reviewedHintTextAr,
  );
  assert.equal(metrics[0].outcome, "AI_VALIDATED");
  assert.equal(metrics[0].totalTokens, 180);
  assert.equal(metrics[0].actualModel, config.model);
  assert.ok(!JSON.stringify(metrics).includes("secret-test-only"));
  assert.ok(
    !readFileSync(config.ledgerPath, "utf8").includes("secret-test-only"),
  );
});
for (const [name, mutate, reason] of [
  [
    "extra schema fields",
    (v) => ({ ...v, extra: "bad" }),
    "AI_SCHEMA_REJECTED",
  ],
  [
    "invented math verdict",
    (v) => ({ ...v, mathStatus: "verified_valid" }),
    "AI_SCHEMA_REJECTED",
  ],
  [
    "early answer despite false no-leak flag",
    (v) => ({ ...v, messageAr: "س = ٢" }),
    "AI_UNAPPROVED_MEANING",
  ],
  [
    "new unreviewed teaching meaning",
    (v) => ({ ...v, messageAr: "اكتب الناتج مباشرة." }),
    "AI_UNAPPROVED_MEANING",
  ],
  [
    "wrong template",
    (v) => ({ ...v, sourceTemplateId: "another" }),
    "AI_TEMPLATE_MISMATCH",
  ],
  [
    "abstention",
    (v) => ({ ...v, decision: "abstain", reasonCode: "SAFE_ABSTENTION" }),
    "AI_ABSTAINED",
  ],
])
  test(`local rejection: ${name}`, async (t) => {
    const { quota, config } = fixture(t),
      c = context(),
      metrics = [];
    const adapter = new GeminiAdapter(
      { apiKey: "test", model: config.model, thinkingLevel: "minimal" },
      quota,
      () => true,
      (m) => metrics.push(m),
      async () =>
        Response.json({
          modelVersion: config.model,
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: JSON.stringify(mutate(draft(c))) }] },
            },
          ],
        }),
    );
    await assert.rejects(
      adapter.adaptHint(c, new AbortController().signal),
      /SAFE_FAILURE/,
    );
    assert.equal(metrics[0].outcome, reason);
    assert.equal(quota.spent, 1);
  });
for (const [finishReason, text, reason] of [
  ["STOP", "invalid", "AI_INVALID_JSON"],
  ["MAX_TOKENS", "{}", "AI_TRUNCATED"],
  ["SAFETY", "", "AI_REFUSED"],
])
  test(`provider finish/JSON: ${reason}`, async (t) => {
    const { quota, config } = fixture(t),
      metrics = [];
    const adapter = new GeminiAdapter(
      { apiKey: "test", model: config.model, thinkingLevel: "minimal" },
      quota,
      () => true,
      (m) => metrics.push(m),
      async () =>
        Response.json({
          modelVersion: config.model,
          candidates: [{ finishReason, content: { parts: [{ text }] } }],
        }),
    );
    await assert.rejects(
      adapter.adaptHint(context(), new AbortController().signal),
    );
    assert.equal(metrics[0].outcome, reason);
  });
test("429 spends one reservation without retry or logging the response body", async (t) => {
  const { quota, config } = fixture(t),
    metrics = [];
  let calls = 0;
  const adapter = new GeminiAdapter(
    { apiKey: "test", model: config.model, thinkingLevel: "minimal" },
    quota,
    () => true,
    (m) => metrics.push(m),
    async () => {
      calls++;
      return new Response("secret echoed by remote", { status: 429 });
    },
  );
  await assert.rejects(
    adapter.adaptHint(context(), new AbortController().signal),
  );
  assert.equal(calls, 1);
  assert.equal(quota.spent, 1);
  assert.equal(metrics[0].httpStatus, 429);
  assert.ok(!JSON.stringify(metrics).includes("secret echoed"));
});
test("out-of-scope and pre-aborted calls never contact provider or reserve quota", async (t) => {
  const { quota, config } = fixture(t);
  let calls = 0;
  const adapter = new GeminiAdapter(
    { apiKey: "test", model: config.model, thinkingLevel: "minimal" },
    quota,
    () => false,
    () => {},
    async () => {
      calls++;
      throw Error();
    },
  );
  await assert.rejects(
    adapter.adaptHint(context(), new AbortController().signal),
  );
  assert.equal(calls, 0);
  assert.equal(quota.spent, 0);
});
test("second concurrent call is rejected without dispatch or reservation", async (t) => {
  const { quota, config } = fixture(t);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const adapter = new GeminiAdapter(
    { apiKey: "test", model: config.model, thinkingLevel: "minimal" },
    quota,
    () => true,
    () => {},
    async () => {
      await gate;
      return new Response("", { status: 503 });
    },
  );
  const first = adapter.adaptHint(context(), new AbortController().signal);
  await assert.rejects(
    adapter.adaptHint(context(), new AbortController().signal),
    /SERIAL_LIMIT/,
  );
  release();
  await assert.rejects(first);
  assert.equal(quota.spent, 1);
});
test("environment factory keeps disabled behavior and rejects PH09/non-synthetic activation", () => {
  const original = { ...process.env };
  try {
    process.env.AI_ENABLED = "false";
    const disabled = ph08TutoringFromEnvironment(
      { syntheticData: true },
      {},
      { enabled: false },
      {},
      false,
    );
    assert.equal(disabled.ai.enabled, false);
    process.env.AI_ENABLED = "true";
    process.env.PH08_API_ENABLED = "true";
    process.env.PH09_API_ENABLED = "true";
    assert.throws(
      () =>
        ph08TutoringFromEnvironment({ syntheticData: true }, {}, {}, {}, true),
      /restricted/,
    );
    process.env.PH09_API_ENABLED = "false";
    assert.throws(
      () =>
        ph08TutoringFromEnvironment({ syntheticData: false }, {}, {}, {}, true),
      /restricted/,
    );
  } finally {
    process.env = original;
  }
});
