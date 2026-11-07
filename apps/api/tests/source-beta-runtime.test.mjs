import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  BetaGeminiPort,
  betaHintMeaning,
  betaAllowedTexts,
  withProductAiOwner,
} = require("../dist/beta-gemini.js");
const {
  buildHintContext,
  composeWithDeadline,
} = require("../dist/ai-tutor.js");
const { betaAiConfigured } = require("../dist/external-ai-access.js");
const context = () =>
  buildHintContext({
    level: 1,
    templateId: "reviewed-template-v1",
    contentVersion: "v1",
    textAr: "عندما تطرح العدد من طرفي المعادلة تحافظ على التوازن.",
    variants: [],
    skillNameAr: "المساواة",
    observationAr: "انتقال يحتاج مراجعة دون جزم بالسبب.",
    maxOutputTokens: 64,
  });
test("Beta accepts only the reviewed core, approved variants and neutral wrappers, never a word-bag inversion", () => {
  const c = context();
  for (const text of betaAllowedTexts(c))
    assert.equal(betaHintMeaning(text, c).reason, "AI_VALIDATED");
  for (const text of [
    "لا تحافظ على التوازن عندما تطرح العدد من طرفي المعادلة.",
    "تحافظ على العدد عندما تطرح التوازن من طرفي المعادلة.",
    "الحل هو سبعة.",
    c.reviewedHintTextAr + " لا.",
    "س = ٣",
  ])
    assert.equal(betaHintMeaning(text, c).text, null);
});
function setup(t) {
  const config = {
    BETA_ENABLED: "true",
    BETA_ACCESS_PAUSED: "false",
    BETA_GEMINI_ENABLED: "true",
    AI_ENABLED: "true",
    BETA_AI_ENABLED: "true",
    BETA_GEMINI_AUTHORIZATION_ID: "beta-source-unit-new-authorization",
    BETA_GEMINI_AUTHORIZATION_EXPIRES_AT: new Date(
      Date.now() + 3600000,
    ).toISOString(),
    BETA_GEMINI_MODEL: "gemini-fixture",
    GEMINI_API_KEY: "fixture-not-a-real-key-123456789",
    BETA_GEMINI_KNOWN_DAILY_REMAINING: "50",
    BETA_GEMINI_DAILY_REQUEST_LIMIT: "20",
    REAL_LEARNING_ENABLED: "true",
    REAL_LEARNING_POLICY_VERSION: "real-learning-v1",
    REAL_LEARNING_APPROVAL_REFERENCE: "real-learning-unit-policy",
    BETA_GEMINI_OUTPUT_CAP_POLICY: "total_generation",
    BETA_GEMINI_MAX_BILLABLE_OUTPUT_TOKENS: "64",
    BETA_AI_MAX_CALL_COST_MICROS: "30000",
    BETA_AI_DAILY_COST_MICROS: "300000",
    BETA_AI_MONTHLY_COST_MICROS: "3000000",
    BETA_AI_USER_DAILY_TOKENS: "1000000",
    GEMINI_PRICING_JSON: JSON.stringify({
      version: "unit-fictional-rates",
      currency: "USD",
      models: {
        "gemini-fixture": {
          inputMicrosPerMillion: 1000000,
          outputMicrosPerMillion: 1000000,
        },
      },
    }),
  };
  const old = Object.fromEntries(
    Object.keys(config).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, config);
  t.after(() => {
    for (const [key, value] of Object.entries(old))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  });
  const state = {
    tx: 0,
    stopped: false,
    reserved: 0,
    consent: true,
    calls: 0,
    mode: "valid",
    sent: null,
    abortBeforeDispatch: null,
    writes: [],
  };
  const db = {
    $queryRaw: async (sql) => {
      const query = sql.join("?");
      if (query.includes("LEFT JOIN account_learning_consents"))
        return [
          {
            is_internal: false,
            enabled: true,
            policy_version: "real-learning-v1",
          },
        ];
      if (query.includes("SELECT u.is_internal FROM users"))
        return [{ is_internal: false }];
      if (query.includes("FROM account_learning_consents"))
        return [{ enabled: true, policy_version: "real-learning-v1" }];
      if (query.includes("FROM account_ai_consents"))
        return [{ enabled: state.consent, policy_version: "external-ai-v1" }];
      if (query.includes("SELECT quota_stopped")) {
        if (query.includes("FOR SHARE")) state.abortBeforeDispatch?.();
        return [
          { quota_stopped: state.stopped, reserved_calls: state.reserved },
        ];
      }
      if (query.includes("FROM beta_ai_reservations"))
        return [
          {
            day_calls: 0n,
            minute_calls: 0n,
            parallel: 0n,
            daily_cost: 0n,
            monthly_cost: 0n,
            user_calls: 0n,
            user_tokens: 0n,
          },
        ];
      return [];
    },
    $executeRaw: async (sql, ...values) => {
      const query = sql.join("?");
      state.writes.push({ query, values });
      if (query.includes("quota_stopped=true")) state.stopped = true;
      if (query.includes("reserved_calls=reserved_calls+1")) state.reserved++;
      return 1;
    },
  };
  db.$transaction = async (work) => {
    state.tx++;
    try {
      return await work(db);
    } finally {
      state.tx--;
    }
  };
  const store = { db, syntheticData: false };
  const owner = {
    ownerKey: "user:" + randomUUID(),
    userId: randomUUID(),
    authSessionId: randomUUID(),
    guestId: null,
    role: "student",
  };
  const port = new BetaGeminiPort(store, undefined, async (url, options) => {
    assert.equal(state.tx, 0, "no network inside a database transaction");
    state.calls++;
    const body = JSON.parse(options.body);
    state.sent = { url: String(url), options, body };
    assert.equal(options.redirect, "error");
    assert.ok(
      String(url).startsWith("https://generativelanguage.googleapis.com/"),
    );
    assert.equal(options.body.includes(owner.userId), false);
    assert.equal(options.body.includes(owner.authSessionId), false);
    assert.equal(
      Object.hasOwn(
        body.generationConfig.responseJsonSchema.properties.schemaVersion,
        "const",
      ),
      false,
    );
    assert.equal(body.generationConfig.maxOutputTokens, 64);
    if (state.mode === "quota")
      return Response.json(
        { error: { status: "RESOURCE_EXHAUSTED" } },
        { status: 429 },
      );
    const sent = JSON.parse(body.contents[0].parts[0].text);
    const text =
      state.mode === "inversion"
        ? "لا تحافظ على التوازن عندما تطرح العدد من طرفي المعادلة."
        : "لنراجع الفكرة معًا. " + sent.reviewedHintTextAr;
    const total = state.mode === "excess" ? 200 : 140;
    const usage =
      state.mode === "unknown"
        ? { promptTokenCount: 120, candidatesTokenCount: 16 }
        : {
            promptTokenCount: 120,
            candidatesTokenCount: 16,
            totalTokenCount: total,
          };
    return Response.json({
      modelVersion: "gemini-fixture",
      usageMetadata: usage,
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify({
                  schemaVersion: "ai-draft-v1",
                  task: "hint_rephrase",
                  decision: "usable",
                  messageAr: text,
                  reasonCode: "APPROVED_HINT_REPHRASE",
                  sourceTemplateId: sent.sourceTemplateId,
                  isAnswerRevealed: false,
                }),
              },
            ],
          },
        },
      ],
    });
  });
  const invoke = (signal = new AbortController().signal) =>
    withProductAiOwner(store, owner, async () => {
      const result = await composeWithDeadline(
        port,
        context(),
        signal,
        500,
        64,
      );
      return { result, invoked: port.invocationStarted() };
    });
  return { state, invoke, port };
}
test("fresh Beta with PH09 enabled uses the shared validated Gemini transport and versioned priced reservation", async (t) => {
  const h = setup(t);
  const previous = process.env.PH09_API_ENABLED;
  process.env.PH09_API_ENABLED = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.PH09_API_ENABLED;
    else process.env.PH09_API_ENABLED = previous;
  });
  const { result, invoked } = await h.invoke();
  assert.equal(invoked, true);
  assert.equal(result.reason, "AI_VALIDATED");
  assert.equal(result.billingOutputTokens, 20);
  assert.ok(result.text.startsWith("لنراجع"));
  const reservation = h.state.writes.find((w) =>
    w.query.includes("INSERT INTO beta_ai_reservations"),
  );
  assert.ok(reservation);
  assert.equal(reservation.values[2], 25024 + 64);
});
test("a deadline reached during final authorization checking cannot dispatch or claim a provider invocation", async (t) => {
  const h = setup(t),
    controller = new AbortController();
  h.state.abortBeforeDispatch = () => controller.abort();
  const result = await h.invoke(controller.signal);
  assert.equal(result.invoked, false);
  assert.equal(h.state.calls, 0);
  assert.equal(result.result.text, null);
});
test("authorization quota does not reset merely because the daily usage window rolls over", async (t) => {
  const h = setup(t);
  process.env.BETA_GEMINI_KNOWN_DAILY_REMAINING = "1";
  assert.equal((await h.invoke()).invoked, true);
  // The fixture's day_calls remains zero, representing a reset daily window.
  assert.equal((await h.invoke()).invoked, false);
  assert.equal(h.state.reserved, 1);
  assert.equal(h.state.calls, 1);
});
test("missing consent or prices prevent network dispatch and do not invent usage", async (t) => {
  const h = setup(t);
  h.state.consent = false;
  assert.equal((await h.invoke()).invoked, false);
  assert.equal(h.state.calls, 0);
  h.state.consent = true;
  delete process.env.GEMINI_PRICING_JSON;
  assert.equal((await h.invoke()).invoked, false);
  assert.equal(h.state.calls, 0);
});
for (const mode of ["inversion", "unknown", "excess", "quota"])
  test(`Beta ${mode} safely falls back, meters invocation and durably stops this authorization`, async (t) => {
    const h = setup(t);
    h.state.mode = mode;
    const first = await h.invoke();
    assert.equal(first.invoked, true);
    assert.equal(first.result.text, null);
    assert.equal(h.state.stopped, true);
    assert.equal((await h.invoke()).invoked, false);
    assert.equal(h.state.calls, 1);
  });
test("old PH08 authority, expired authority, pause and missing total-output policy cannot enable this runtime", async (t) => {
  const h = setup(t);
  const original = process.env.BETA_GEMINI_AUTHORIZATION_ID;
  process.env.BETA_GEMINI_AUTHORIZATION_ID = "PH08-OWNER-2026-11-06-live4";
  assert.equal(betaAiConfigured(), false);
  process.env.BETA_GEMINI_AUTHORIZATION_ID =
    "SOURCE-CLOSURE-OWNER-ORDER-2026-11-08";
  assert.equal(betaAiConfigured(), false);
  process.env.BETA_GEMINI_AUTHORIZATION_ID = original;
  process.env.BETA_GEMINI_AUTHORIZATION_EXPIRES_AT = new Date(
    Date.now() - 1000,
  ).toISOString();
  assert.equal(betaAiConfigured(), false);
  process.env.BETA_GEMINI_AUTHORIZATION_EXPIRES_AT = new Date(
    Date.now() + 3600000,
  ).toISOString();
  process.env.BETA_ACCESS_PAUSED = "true";
  assert.equal(betaAiConfigured(), false);
  process.env.BETA_ACCESS_PAUSED = "false";
  delete process.env.BETA_GEMINI_OUTPUT_CAP_POLICY;
  assert.equal(h.port.enabled, false);
  assert.equal((await h.invoke()).invoked, false);
  assert.equal(h.state.calls, 0);
});
