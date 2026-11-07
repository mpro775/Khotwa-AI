import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { parsePayload } = require("../dist/content-payload.js");
const { materializeStudioHints } = require("../dist/studio-tutoring.js");
const { matchesHintErrorCode } = require("../dist/tutoring-policy.js");
const { estimateGeminiCost } = require("../dist/ai-cost.js");
const { betaTelemetry } = require("../dist/beta-operations.js");
const { MathGateway } = require("../dist/math-gateway.js");
const { PhysicsGateway } = require("../dist/physics-gateway.js");
const { ContentStudioService } = require("../dist/content-studio.js");
const {
  AiProviderFailure,
  composeWithDeadline,
} = require("../dist/ai-tutor.js");
const draft = () =>
  JSON.parse(
    readFileSync(
      new URL("../data/algebra-expansion.draft.v1.json", import.meta.url),
      "utf8",
    ),
  )[0];
test("legacy hints remain general; targeted variants preserve level and pattern without duplicates", () => {
  const p = draft();
  assert.equal(parsePayload(p).hints[0].errorCode, undefined);
  p.hints.push({ ...p.hints[0], errorCode: "ERR-ALG-01" });
  assert.equal(parsePayload(p).hints.length, 5);
  assert.equal(parsePayload(p).hints[4].errorCode, "ERR-ALG-01");
  p.hints.push({ ...p.hints[4] });
  assert.throws(
    () => parsePayload(p),
    (error) =>
      error.code === "invalid_input" && error.messageAr.includes("لا تكرر"),
  );
  p.hints.pop();
  p.hints[4].errorCode = "ERR-ALG-07";
  assert.throws(() => parsePayload(p));
});
test("an ERR catalog cannot be attached to a different subject or guessed from arbitrary input", () => {
  const p = JSON.parse(
    readFileSync(
      new URL("../data/physics-kinematics.draft.v1.json", import.meta.url),
      "utf8",
    ),
  )[0];
  p.hints[0].errorCode = "ERR-ALG-01";
  assert.throws(() => parsePayload(p));
  for (const code of ["ERR-ALG-01", "ERR-ALG-02", null]) {
    assert.equal(
      matchesHintErrorCode(code, "ERR-ALG-01"),
      code !== "ERR-ALG-02",
    );
    assert.equal(matchesHintErrorCode(code, null), code === null);
  }
});
test("materialization saves scoped ERR and keeps the general fallback; only an existing reviewed catalog permits it", async () => {
  const p = draft();
  p.hints = p.hints.map((h) => ({ ...h, reviewed: true }));
  p.hints.push({ ...p.hints[0], errorCode: "ERR-ALG-01" });
  const writes = [];
  const input = {
    payload: p,
    releaseId: "release",
    problemRevisionId: "problem",
    studioRevisionId: "studio",
    reviewerId: "reviewer",
  };
  const tx = {
    $queryRaw: async () => [{ error_code: "ERR-ALG-01" }],
    $executeRaw: async (sql, ...values) => {
      writes.push({ sql: sql.join("?"), values });
      return 1;
    },
  };
  await materializeStudioHints(tx, input);
  assert.equal(writes.length, 5);
  assert.equal(writes[0].values[3], null);
  assert.equal(writes[4].values[3], "ERR-ALG-01");
  writes.length = 0;
  await assert.rejects(
    materializeStudioHints({ ...tx, $queryRaw: async () => [] }, input),
    (error) =>
      error.code === "invalid_input" && error.messageAr.includes("كتالوج"),
  );
  assert.equal(writes.length, 0);
});
// These are deliberately fictional test rates, not vendor prices.
test("studio publication copies the reviewed skill catalog before binding authored ERR hints", async () => {
  const payload = draft();
  payload.kind = "remediation";
  payload.hints = payload.hints.map((h) => ({ ...h, reviewed: true }));
  payload.hints.push({ ...payload.hints[0], errorCode: "ERR-ALG-01" });
  let catalogCopied = false;
  const order = [];
  const reviewed = {
    error_code: "ERR-ALG-01",
    catalog_version: "reviewed-v1",
    reviewed_by_role: "source-reviewer",
    reviewed_at: new Date(),
  };
  const tx = {
    $queryRaw: async (sql) => {
      const query = sql.join("?");
      if (query.includes("SELECT c.id FROM content_releases"))
        return [{ id: "reviewed-release" }];
      if (query.includes("FROM misconception_catalog m JOIN skills"))
        return [reviewed];
      if (query.includes("SELECT error_code FROM misconception_catalog"))
        return catalogCopied ? [reviewed] : [];
      return [];
    },
    $executeRaw: async (sql, ...values) => {
      const query = sql.join("?");
      if (query.includes("INSERT INTO misconception_catalog")) {
        catalogCopied = true;
        order.push("catalog");
      }
      if (
        query.includes("INSERT INTO intervention_templates") &&
        values.includes("ERR-ALG-01")
      )
        order.push("targeted-hint");
      return 1;
    },
  };
  const studio = new ContentStudioService({}, {}, {}, {});
  await studio.materializeAlgebra(
    tx,
    {
      payload,
      id: "studio",
      item_id: "item",
      version: 1,
      content_hash: "hash",
    },
    { userId: "reviewer" },
  );
  assert.deepEqual(order, ["catalog", "targeted-hint"]);
});
const prices = JSON.stringify({
  version: "fixture-prices-v1",
  currency: "USD",
  models: {
    "gemini-fixture": {
      inputMicrosPerMillion: 2000000,
      outputMicrosPerMillion: 3000000,
    },
  },
});
test("reported token counts yield a versioned estimate, rounded once, never an invoice", () => {
  const cost = estimateGeminiCost("gemini-fixture", 100, 40, prices);
  assert.equal(cost.status, "estimated");
  assert.equal(cost.estimatedCostMicros, 320);
  assert.equal(cost.pricingVersion, "fixture-prices-v1");
  assert.equal(cost.tokenUsage, "reported");
  const fractional = JSON.stringify({
    version: "fractional",
    currency: "USD",
    models: {
      "gemini-fixture": { inputMicrosPerMillion: 1, outputMicrosPerMillion: 1 },
    },
  });
  assert.equal(
    estimateGeminiCost("gemini-fixture", 1, 1, fractional).estimatedCostMicros,
    1,
  );
});
test("missing usage, model, price, invalid rates, overflow and non-invocation never invent spending", () => {
  for (const args of [
    ["gemini-fixture", null, 10, prices],
    ["gemini-other", 10, 10, prices],
    [undefined, 10, 10, prices],
    ["gemini-fixture", 10, 10, ""],
    ["gemini-fixture", 10, 10, "{"],
    ["gemini-fixture", -1, 10, prices],
    [
      "gemini-fixture",
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      prices,
    ],
  ]) {
    const cost = estimateGeminiCost(...args);
    assert.equal(cost.status, "unknown");
    assert.equal(cost.estimatedCostMicros, null);
  }
  assert.equal(
    estimateGeminiCost("gemini-fixture", 10, 10, prices, false).status,
    "not_invoked",
  );
  const free = JSON.stringify({
    version: "explicit-zero",
    currency: "USD",
    models: {
      "gemini-fixture": { inputMicrosPerMillion: 0, outputMicrosPerMillion: 0 },
    },
  });
  assert.equal(
    estimateGeminiCost("gemini-fixture", 10, 10, free).estimatedCostMicros,
    0,
  );
});
test("telemetry separates reported tokens, unknown prices and estimated subsets", () => {
  const previous = process.env.GEMINI_PRICING_JSON;
  try {
    process.env.GEMINI_PRICING_JSON = prices;
    const before = betaTelemetry.snapshot();
    const usage = {
      provider: "gemini",
      model: "gemini-fixture",
      source: "reviewed_template",
      inputTokens: 100,
      outputTokens: 40,
      estimatedCostMicros: null,
      invoked: true,
    };
    betaTelemetry.recordAi(usage);
    betaTelemetry.recordAi({ ...usage, model: "gemini-unpriced" });
    betaTelemetry.recordAi({ ...usage, inputTokens: null, outputTokens: null });
    const after = betaTelemetry.snapshot();
    assert.equal(
      after.ai.estimatedCostMicros - before.ai.estimatedCostMicros,
      320,
    );
    assert.equal(after.ai.unknownCostCalls - before.ai.unknownCostCalls, 2);
    assert.equal(
      after.aiCost.reportedTokenCalls - before.aiCost.reportedTokenCalls,
      2,
    );
    assert.equal(
      after.aiCost.unknownTokenCalls - before.aiCost.unknownTokenCalls,
      1,
    );
    assert.equal(after.aiCost.actualBilledCostMicros, null);
    assert.ok(after.aiCost.pricingVersions.includes("fixture-prices-v1"));
  } finally {
    if (previous === undefined) delete process.env.GEMINI_PRICING_JSON;
    else process.env.GEMINI_PRICING_JSON = previous;
  }
});
test("rejected provider output retains only reported usage for billing; reasoning output is not silently free", async () => {
  const result = await composeWithDeadline(
    {
      enabled: true,
      adaptHint: async () => {
        throw new AiProviderFailure({
          inputTokens: 100,
          outputTokens: 40,
          billingOutputTokens: 60,
        });
      },
    },
    {},
    new AbortController().signal,
    100,
    100,
  );
  assert.equal(result.text, null);
  assert.equal(result.reason, "AI_PROVIDER_ERROR");
  assert.equal(
    estimateGeminiCost(
      "gemini-fixture",
      result.inputTokens,
      result.billingOutputTokens,
      prices,
    ).estimatedCostMicros,
    380,
  );
  assert.equal(
    estimateGeminiCost("gemini-fixture", result.inputTokens, null, prices)
      .status,
    "unknown",
  );
  assert.equal(JSON.stringify(result).includes("rawJson"), false);
});
test("HTTP200 worker timeout is counted independently of transport timeout, never as a student error", async (t) => {
  const examples = JSON.parse(
    readFileSync(
      new URL(
        "../../../docs/contracts/math-internal-v1.examples.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ).examples;
  const request = structuredClone(
    examples.find((e) => e.schema === "InternalMathParseRequest").payload,
  );
  const result = structuredClone(
    examples.find((e) => e.schema === "InternalMathParseResult").payload,
  );
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const sent = JSON.parse(options.body);
    return Response.json({
      ...result,
      requestId: sent.requestId,
      context: sent.context,
      source: sent.source,
      parseStatus: "service_error",
      normalizedText: null,
      displayAr: null,
      ast: null,
      issue: null,
      reasonCode: "MATH_TIMEOUT",
    });
  });
  const before = betaTelemetry.snapshot().mathTimeouts;
  const math = new MathGateway({
    baseUrl: "http://math:8000",
    token: "t".repeat(40),
    timeoutMs: 1000,
    expectedEngine: result.engineVersion,
  });
  assert.equal(
    (await math.parse(request.context, request.source, request.raw))
      .parseStatus,
    "service_error",
  );
  const physics = new PhysicsGateway(
    "http://math:8000",
    "t".repeat(40),
    1000,
    async () =>
      Response.json({
        contractVersion: "physics-internal-v1",
        engineVersion: "physics-1.0.0",
        problemRevisionId: "revision",
        status: "service_error",
        valueCorrect: null,
        unitCorrect: null,
        diagnosisCode: null,
        reasonCode: "MATH_TIMEOUT",
      }),
  );
  const reference = JSON.parse(
    readFileSync(
      new URL("../data/physics-kinematics.draft.v1.json", import.meta.url),
      "utf8",
    ),
  )[0].physics;
  assert.equal(
    (await physics.verify("revision", reference, { value: "1", unit: "m" }))
      .status,
    "service_error",
  );
  assert.equal(betaTelemetry.snapshot().mathTimeouts - before, 2);
});
test("internal HTTP408/504 are declared service timeouts and never negative mathematical verdicts", async (t) => {
  const examples = JSON.parse(
    readFileSync(
      new URL(
        "../../../docs/contracts/math-internal-v1.examples.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ).examples;
  const request = structuredClone(
    examples.find((e) => e.schema === "InternalMathParseRequest").payload,
  );
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "request_timeout" }, { status: 408 }),
  );
  const before = betaTelemetry.snapshot().mathTimeouts;
  const math = new MathGateway({
    baseUrl: "http://math:8000",
    token: "t".repeat(40),
    timeoutMs: 1000,
    expectedEngine: "0.3.0",
  });
  await assert.rejects(
    math.parse(request.context, request.source, request.raw),
    (error) => error.status === 503 && error.code === "math_unavailable",
  );
  const physics = new PhysicsGateway(
    "http://math:8000",
    "t".repeat(40),
    1000,
    async () => Response.json({ error: "upstream_timeout" }, { status: 504 }),
  );
  const reference = JSON.parse(
    readFileSync(
      new URL("../data/physics-kinematics.draft.v1.json", import.meta.url),
      "utf8",
    ),
  )[0].physics;
  await assert.rejects(
    physics.verify("revision", reference, { value: "1", unit: "m" }),
    (error) => error.status === 503 && error.code === "math_unavailable",
  );
  assert.equal(betaTelemetry.snapshot().mathTimeouts - before, 2);
});
