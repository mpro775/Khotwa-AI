import {
  HINT_REPLY_SCHEMA,
  HINT_SYSTEM_PROMPT,
  validateTutorReply,
  AiProviderFailure,
} from "./ai-tutor";
import type { AiTutorPort, AiReply, HintContext } from "./ai-tutor";
import { GeminiQuota } from "./gemini-quota";
import {
  generationRules,
  PH08_GENERATIVE_PROMPT,
  type GenerationProfile,
} from "./ph08-generative";
import type { DraftResult } from "./ai-tutor";

export interface GenerativeMode {
  prepare(context: HintContext): Promise<GenerationProfile>;
  meaning(text: string, context: HintContext): DraftResult | null;
}

export interface GeminiMetric {
  event: "ph08_gemini_call";
  at: string;
  requestedModel: string;
  actualModel: string | null;
  thinkingLevel: string;
  latencyMs: number;
  httpStatus: number | null;
  providerErrorCode: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  thinkingTokens: number | null;
  outcome: string;
  textOrigin: "none" | "gemini_literal" | "gemini_generated";
  generationVersion: string | null;
}
export interface GeminiSettings {
  apiKey: string;
  model: string;
  thinkingLevel: string;
}
type ObjectValue = Record<string, unknown>;
const obj = (v: unknown): ObjectValue =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as ObjectValue)
    : {};
const tokens = (v: unknown): number | null =>
  Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 2147483647
    ? (v as number)
    : null;
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error("GEMINI_EMPTY_RESPONSE");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 65536) throw Error("GEMINI_RESPONSE_SIZE");
      parts.push(next.value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
function billingOutputTokens(
  metric: GeminiMetric,
  model: string,
): number | null {
  return metric.actualModel?.replace(/^models\//, "") === model &&
    metric.totalTokens !== null &&
    metric.inputTokens !== null &&
    metric.outputTokens !== null &&
    metric.totalTokens >= metric.inputTokens + metric.outputTokens
    ? metric.totalTokens - metric.inputTokens
    : null;
}
/** Network-only adapter: no DB, learner identifiers, answer keys, tools or retries. */
export class GeminiAdapter implements AiTutorPort {
  readonly kind = "gemini";
  readonly maximumCostUnits = 1; // reservation unit, never a currency/price claim
  private inFlight = false;
  invocationAudit: () => Readonly<
    Record<string, string | number | boolean | null>
  > = () => ({});
  ph08Meaning = (text: string, context: HintContext): DraftResult | null =>
    this.generation?.meaning(text, context) ?? null;
  requiresReviewedFallback = () =>
    this.generation !== undefined && this.enabled;
  constructor(
    private readonly settings: GeminiSettings,
    readonly quota: Pick<GeminiQuota, "reserve" | "stopForQuota" | "close">,
    private readonly scopeEnabled: () => boolean,
    private readonly audit: (metric: GeminiMetric) => void = (metric) =>
      console.info(JSON.stringify(metric)),
    private readonly transport: typeof fetch = fetch,
    private readonly generation?: GenerativeMode,
  ) {
    if (
      !settings.apiKey ||
      !/^gemini-[a-zA-Z0-9._-]{1,80}$/.test(settings.model) ||
      !["minimal", "low", "medium", "high"].includes(settings.thinkingLevel)
    )
      throw Error("GEMINI_CONFIGURATION_INVALID");
  }
  get enabled() {
    return this.scopeEnabled();
  }
  get model() {
    return this.settings.model;
  }
  async adaptHint(context: HintContext, signal: AbortSignal): Promise<AiReply> {
    if (!this.enabled || signal.aborted || this.inFlight)
      throw Error("GEMINI_SCOPE_OR_SERIAL_LIMIT");
    if (
      context.task !== "hint_rephrase" ||
      !["H1", "H2", "H3"].includes(context.targetHintLevel) ||
      !Number.isSafeInteger(context.maxOutputTokens) ||
      context.maxOutputTokens < 1 ||
      context.maxOutputTokens > 256
    )
      throw Error("GEMINI_CONTEXT_LIMIT");
    const profile = this.generation
      ? await this.generation.prepare(context)
      : null;
    const rules = profile
      ? generationRules(profile, context.targetHintLevel)
      : null;
    if (this.generation && !rules)
      throw Error("PH08_GENERATION_PROFILE_REQUIRED");
    if (signal.aborted || this.inFlight)
      throw Error("GEMINI_SCOPE_OR_SERIAL_LIMIT");
    const schema = {
      ...HINT_REPLY_SCHEMA,
      properties: {
        ...HINT_REPLY_SCHEMA.properties,
        schemaVersion: {
          type: "string",
          enum: [HINT_REPLY_SCHEMA.properties.schemaVersion.const],
        },
        task: {
          type: "string",
          enum: [HINT_REPLY_SCHEMA.properties.task.const],
        },
        messageAr: {
          type: "string",
          ...(rules
            ? { minLength: 1, maxLength: 360 }
            : {
                enum: [
                  context.reviewedHintTextAr,
                  ...context.approvedRephrasesAr,
                ],
              }),
        },
      },
    };
    const body = JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: rules
              ? PH08_GENERATIVE_PROMPT
              : HINT_SYSTEM_PROMPT +
                " اختر نصًا حرفيًا من الصيغ المسموح بها؛ لا تضف صياغة جديدة. عند الامتناع استخدم أيضًا نص القالب مع decision=abstain.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify(
                rules
                  ? { ...context, generation: { profile, rules } }
                  : context,
              ),
            },
          ],
        },
      ],
      generationConfig: {
        candidateCount: 1,
        maxOutputTokens: context.maxOutputTokens,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        thinkingConfig: { thinkingLevel: this.settings.thinkingLevel },
      },
    });
    if (Buffer.byteLength(body) > 12000) throw Error("GEMINI_CONTEXT_LIMIT");
    this.quota.reserve();
    this.inFlight = true;
    const start = performance.now();
    const metric: GeminiMetric = {
      event: "ph08_gemini_call",
      at: new Date().toISOString(),
      requestedModel: this.settings.model,
      actualModel: null,
      thinkingLevel: this.settings.thinkingLevel,
      latencyMs: 0,
      httpStatus: null,
      providerErrorCode: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      thinkingTokens: null,
      outcome: "GEMINI_PROVIDER_ERROR",
      textOrigin: "none",
      generationVersion: rules ? rules.version : null,
    };
    try {
      const response = await this.transport(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.settings.model}:generateContent`,
        {
          method: "POST",
          redirect: "error",
          signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.settings.apiKey,
          },
          body,
        },
      );
      metric.httpStatus = response.status;
      if (!response.ok) {
        try {
          const failure = obj(obj(await boundedJson(response)).error);
          const details = Array.isArray(failure.details) ? failure.details : [];
          const reason = details
            .map((v) => obj(v).reason)
            .find((v) => typeof v === "string" && /^[A-Z_]{1,80}$/.test(v));
          const status =
            typeof failure.status === "string" &&
            /^[A-Z_]{1,80}$/.test(failure.status)
              ? failure.status
              : null;
          metric.providerErrorCode =
            typeof reason === "string" ? reason : status;
        } catch {
          /* Never log raw upstream errors or echoed credentials. */
        }
        metric.outcome = `GEMINI_HTTP_${response.status}`;
        if (
          response.status === 429 ||
          metric.providerErrorCode === "RESOURCE_EXHAUSTED" ||
          metric.providerErrorCode === "QUOTA_EXCEEDED"
        )
          this.quota.stopForQuota();
        throw Error("GEMINI_HTTP_FAILURE");
      }
      const value = obj(await boundedJson(response)),
        usage = obj(value.usageMetadata);
      metric.actualModel =
        typeof value.modelVersion === "string" &&
        /^(?:models\/)?gemini-[a-zA-Z0-9._-]{1,100}$/.test(value.modelVersion)
          ? value.modelVersion
          : null;
      metric.inputTokens = tokens(usage.promptTokenCount);
      metric.outputTokens = tokens(usage.candidatesTokenCount);
      metric.totalTokens = tokens(usage.totalTokenCount);
      metric.thinkingTokens = tokens(usage.thoughtsTokenCount);
      if (!metric.actualModel) throw Error("GEMINI_MODEL_METADATA_MISSING");
      if (metric.actualModel.replace(/^models\//, "") !== this.settings.model) {
        metric.outcome = "GEMINI_MODEL_MISMATCH";
        throw Error("GEMINI_MODEL_MISMATCH");
      }
      const candidates = value.candidates;
      const candidate = obj(
        Array.isArray(candidates) && candidates.length === 1
          ? candidates[0]
          : null,
      );
      const content = obj(candidate.content),
        parts = content.parts;
      const texts = Array.isArray(parts)
        ? parts.filter((p) => obj(p).thought !== true)
        : [];
      const text =
        texts.length === 1 && typeof obj(texts[0]).text === "string"
          ? (obj(texts[0]).text as string)
          : "";
      const reply: AiReply = {
        rawJson: text,
        finish:
          candidate.finishReason === "STOP"
            ? "complete"
            : candidate.finishReason === "MAX_TOKENS"
              ? "truncated"
              : "refused",
        contentVersion: context.contentVersion,
        policyVersion: context.policyVersion,
        promptVersion: context.promptVersion,
        inputTokens: metric.inputTokens,
        outputTokens: metric.outputTokens,
        billingOutputTokens: billingOutputTokens(metric, this.settings.model),
      };
      const verdict = validateTutorReply(
        reply,
        context,
        context.maxOutputTokens,
        this.generation ? this.ph08Meaning : undefined,
      );
      metric.outcome = verdict.reason;
      metric.textOrigin = verdict.text
        ? verdict.reason === "PH08_GENERATED_VALIDATED"
          ? "gemini_generated"
          : "gemini_literal"
        : "none";
      if (!verdict.text) throw Error("GEMINI_LOCAL_VALIDATION_REJECTED");
      return reply;
    } catch {
      if (signal.aborted) metric.outcome = "GEMINI_ABORTED";
      throw new AiProviderFailure({
        inputTokens: metric.inputTokens,
        outputTokens: metric.outputTokens,
        billingOutputTokens: billingOutputTokens(metric, this.settings.model),
      });
    } finally {
      metric.latencyMs = Math.round((performance.now() - start) * 1000) / 1000;
      this.inFlight = false;
      this.audit(metric);
    }
  }
}
