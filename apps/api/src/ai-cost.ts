/** Prices are supplied by the operator, never inferred from a model name.
 * Rates are integer micro-USD per million tokens; usage comes from the provider.
 * This is an estimate, never a claim about an invoice or reserved budget. */
export interface GeminiCostEstimate {
  status: "estimated" | "unknown" | "not_invoked";
  tokenUsage: "reported" | "unknown";
  estimatedCostMicros: number | null;
  currency: "USD" | null;
  pricingVersion: string | null;
  reason: string;
}
const usageKnown = (input: number | null, output: number | null) =>
  input !== null &&
  output !== null &&
  Number.isSafeInteger(input) &&
  Number.isSafeInteger(output) &&
  input >= 0 &&
  output >= 0;
export function estimateGeminiCost(
  model: string | undefined,
  inputTokens: number | null,
  outputTokens: number | null,
  prices = process.env.GEMINI_PRICING_JSON,
  invoked = true,
): GeminiCostEstimate {
  const known = usageKnown(inputTokens, outputTokens);
  const unknown = (reason: string): GeminiCostEstimate => ({
    status: invoked ? "unknown" : "not_invoked",
    tokenUsage: known ? "reported" : "unknown",
    estimatedCostMicros: null,
    currency: null,
    pricingVersion: null,
    reason,
  });
  if (!invoked) return unknown("NOT_INVOKED");
  if (!known) return unknown("TOKEN_USAGE_UNKNOWN");
  if (!model || !/^gemini-[A-Za-z0-9._-]{1,100}$/.test(model))
    return unknown("MODEL_UNKNOWN");
  if (!prices) return unknown("PRICE_NOT_CONFIGURED");
  let value: unknown;
  try {
    value = JSON.parse(prices);
  } catch {
    return unknown("PRICE_TABLE_INVALID");
  }
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  if (
    !object(value) ||
    value.currency !== "USD" ||
    typeof value.version !== "string" ||
    !/^[A-Za-z0-9._-]{1,80}$/.test(value.version) ||
    !object(value.models) ||
    !Object.hasOwn(value.models, model)
  )
    return unknown("MODEL_PRICE_UNKNOWN");
  const price = value.models[model];
  if (
    !object(price) ||
    !Number.isSafeInteger(price.inputMicrosPerMillion) ||
    !Number.isSafeInteger(price.outputMicrosPerMillion) ||
    (price.inputMicrosPerMillion as number) < 0 ||
    (price.outputMicrosPerMillion as number) < 0
  )
    return unknown("MODEL_PRICE_INVALID");
  const numerator =
    BigInt(inputTokens!) * BigInt(price.inputMicrosPerMillion as number) +
    BigInt(outputTokens!) * BigInt(price.outputMicrosPerMillion as number);
  const micros = (numerator + 999999n) / 1000000n;
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) return unknown("COST_OVERFLOW");
  return {
    status: "estimated",
    tokenUsage: "reported",
    estimatedCostMicros: Number(micros),
    currency: "USD",
    pricingVersion: value.version,
    reason: "REPORTED_TOKENS_CONFIGURED_PRICE",
  };
}
