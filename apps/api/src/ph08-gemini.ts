import { AsyncLocalStorage } from "node:async_hooks";
import type { Schema } from "./contracts";
import { NoExternalAi } from "./ai-tutor";
import type { GuestAuth, Store } from "./store";
import type { MathPort } from "./math-gateway";
import { TutoringService, type TutoringLimits } from "./tutoring";
import { GeminiAdapter, type GeminiMetric } from "./gemini-adapter";
import { GeminiQuota } from "./gemini-quota";
type GeminiScope = { allowed: boolean; metric?: GeminiMetric };

/** Context-local gate prevents concurrent PH07 requests from inheriting PH08 AI.
 * Transfer policy still commits measurement exit inside the existing service
 * before the provider can run. No hints are generated on assignment/GET/verify.
 */
export class Ph08GeminiTutoring extends TutoringService {
  constructor(
    store: Store,
    math: MathPort,
    readonly gemini: GeminiAdapter,
    limits: TutoringLimits,
    private readonly scope: AsyncLocalStorage<GeminiScope>,
  ) {
    super(store, math, gemini, limits, true);
  }
  override async request(
    auth: GuestAuth,
    attemptId: string,
    key: string,
    body: Schema<"HintInput">,
  ) {
    const assigned = await this.store.db.$transaction(async (tx) => {
      await this.store.authorizeInTransaction(tx, auth);
      await this.store.readAttemptInTransaction(tx, auth, attemptId);
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM learning_assignments WHERE attempt_id=${attemptId}::uuid AND invalidated_at IS NULL`;
      return rows.length === 1;
    });
    return this.scope.run(
      {
        allowed:
          assigned &&
          process.env.PH08_API_ENABLED === "true" &&
          process.env.AI_ENABLED === "true",
      },
      () => super.request(auth, attemptId, key, body),
    );
  }
  onModuleDestroy() {
    this.gemini.quota.close();
  }
}
const required = (env: NodeJS.ProcessEnv, name: string) => {
  if (!env[name]) throw Error(`Missing ${name}`);
  return env[name]!;
};
export function ph08TutoringFromEnvironment(
  store: Store,
  math: MathPort,
  disabled: NoExternalAi,
  limits: TutoringLimits,
  active: boolean,
): TutoringService {
  const env = process.env;
  if (env.AI_ENABLED !== "true")
    return new TutoringService(store, math, disabled, limits, active);
  if (
    !active ||
    env.PH08_API_ENABLED !== "true" ||
    env.PH09_API_ENABLED === "true" ||
    !store.syntheticData
  )
    throw Error(
      "Gemini is restricted to synthetic PH08 review with PH09 disabled",
    );
  const timeoutMs = Number(env.PH08_GEMINI_TIMEOUT_MS ?? "8000");
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs >= limits.requestTimeoutMs
  )
    throw Error("PH08 Gemini timeout must fit whole-request deadline");
  const settings = {
    apiKey: required(env, "GEMINI_API_KEY"),
    model: env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
    thinkingLevel: env.GEMINI_THINKING_LEVEL ?? "minimal",
  };
  const scope = new AsyncLocalStorage<GeminiScope>();
  const quota = new GeminiQuota({
    ledgerPath: required(env, "GEMINI_QUOTA_LEDGER_PATH"),
    roundLimit: Number(env.GEMINI_ROUND_CALL_LIMIT ?? "10"),
    dailyRemaining:
      required(env, "GEMINI_DAILY_REMAINING") === "unlimited"
        ? null
        : Number(env.GEMINI_DAILY_REMAINING),
    validUntil: Date.parse(required(env, "GEMINI_QUOTA_VALID_UNTIL")),
    model: settings.model,
  });
  try {
    const adapter = new GeminiAdapter(
      settings,
      quota,
      () => scope.getStore()?.allowed === true,
      (metric) => {
        const current = scope.getStore();
        if (current) current.metric = metric;
        console.info(JSON.stringify(metric));
      },
    );
    adapter.invocationAudit = (): Readonly<
      Record<string, string | number | boolean | null>
    > => {
      const metric = scope.getStore()?.metric;
      return metric
        ? {
            actualLlmUsed: metric.actualModel !== null,
            providerAttempted: true,
            modelRequested: metric.requestedModel,
            modelActual: metric.actualModel,
            thinkingLevel: metric.thinkingLevel,
            providerLatencyMs: metric.latencyMs,
            providerHttpStatus: metric.httpStatus,
            providerErrorCode: metric.providerErrorCode,
            providerValidation: metric.outcome,
            reportedInputTokens: metric.inputTokens,
            reportedOutputTokens: metric.outputTokens,
            reportedTotalTokens: metric.totalTokens,
          }
        : {};
    };
    return new Ph08GeminiTutoring(
      store,
      math,
      adapter,
      { ...limits, aiTimeoutMs: timeoutMs, maxParallel: 1 },
      scope,
    );
  } catch (e) {
    quota.close();
    throw e;
  }
}
