import { AsyncLocalStorage } from "node:async_hooks";
import type { Schema } from "./contracts";
import { NoExternalAi } from "./ai-tutor";
import type { GuestAuth, Store } from "./store";
import type { MathPort } from "./math-gateway";
import { TutoringService, type TutoringLimits } from "./tutoring";
import { GeminiAdapter, type GeminiMetric } from "./gemini-adapter";
import { GeminiQuota } from "./gemini-quota";
import {
  validateGeneratedMeaning,
  type GenerationProfile,
} from "./ph08-generative";
import type { HintContext } from "./ai-tutor";
type GeminiScope = {
  allowed: boolean;
  metric?: GeminiMetric;
  attemptId: string;
  auth: GuestAuth;
  profile?: GenerationProfile;
  templateId?: string;
};

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
        attemptId,
        auth,
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
  const offline = env.PH08_GEMINI_OFFLINE === "true";
  // No inference is authorized by an old key, unknown daily quota or a new
  // filename. A future live round requires its own explicit authorization ID,
  // ceiling and known positive remaining daily allowance. Never edit old ledgers.
  if (!offline) {
    required(env, "GEMINI_LIVE_AUTHORIZATION_ID");
    const remaining = Number(required(env, "GEMINI_DAILY_REMAINING"));
    if (!Number.isSafeInteger(remaining) || remaining < 1)
      throw Error("GEMINI_DAILY_QUOTA_UNKNOWN");
    required(env, "GEMINI_ROUND_CALL_LIMIT");
  }
  const settings = {
    apiKey: offline
      ? "offline-synthetic-no-key"
      : required(env, "GEMINI_API_KEY"),
    model: env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
    thinkingLevel: env.GEMINI_THINKING_LEVEL ?? "minimal",
  };
  const scope = new AsyncLocalStorage<GeminiScope>();
  const quota = new GeminiQuota({
    ledgerPath: required(env, "GEMINI_QUOTA_LEDGER_PATH"),
    roundLimit: Number(env.GEMINI_ROUND_CALL_LIMIT ?? "10"),
    dailyRemaining: offline
      ? Number(env.GEMINI_ROUND_CALL_LIMIT ?? "10")
      : Number(env.GEMINI_DAILY_REMAINING),
    validUntil: Date.parse(required(env, "GEMINI_QUOTA_VALID_UNTIL")),
    model: settings.model,
  });
  try {
    const generative = env.PH08_GEMINI_GENERATIVE_ENABLED === "true";
    const prepare = async (
      context: HintContext,
    ): Promise<GenerationProfile> => {
      const current = scope.getStore();
      if (!current?.allowed) throw Error("PH08_GENERATION_OUT_OF_SCOPE");
      const profile = await store.db.$transaction(async (tx) => {
        await store.authorizeInTransaction(tx, current.auth);
        await store.readAttemptInTransaction(
          tx,
          current.auth,
          current.attemptId,
        );
        const [row] = await tx.$queryRaw<
          {
            skill_code: string;
            error_code: string | null;
            phase: "remediation" | "transfer";
            measurement_exited_at: Date | null;
            assistance_policy: string;
            hint_level: number;
          }[]
        >`SELECT s.skill_code,t.error_code,x.phase,x.measurement_exited_at,x.assistance_policy,t.hint_level FROM learning_assignments x JOIN learning_episodes e ON e.id=x.episode_id JOIN skills s ON s.id=e.skill_id JOIN intervention_templates t ON t.id=${context.sourceTemplateId}::uuid AND t.release_id=e.release_id AND t.enabled AND t.is_synthetic WHERE x.attempt_id=${current.attemptId}::uuid AND x.invalidated_at IS NULL`;
        if (
          !row ||
          `H${row.hint_level}` !== context.targetHintLevel ||
          (row.phase === "transfer" &&
            (!row.measurement_exited_at ||
              row.assistance_policy === "independent"))
        )
          throw Error("PH08_GENERATION_PROFILE_INVALID");
        return {
          skillCode: row.skill_code,
          errorCode: row.error_code,
          diagnosisMode: row.error_code
            ? ("possible" as const)
            : ("unresolved" as const),
          phase: row.phase,
          transferExited: !!row.measurement_exited_at,
        };
      });
      current.profile = profile;
      current.templateId = context.sourceTemplateId;
      return profile;
    };
    const adapter = new GeminiAdapter(
      settings,
      quota,
      () => scope.getStore()?.allowed === true,
      (metric) => {
        const current = scope.getStore();
        if (current) current.metric = metric;
        console.info(JSON.stringify(metric));
      },
      offline
        ? async () => {
            throw Error("PH08_OFFLINE_TRANSPORT_NOT_CONFIGURED");
          }
        : fetch,
      generative
        ? {
            prepare,
            meaning: (text, context) => {
              const current = scope.getStore();
              return current?.allowed &&
                current.profile &&
                current.templateId === context.sourceTemplateId
                ? validateGeneratedMeaning(text, context, current.profile)
                : { text: null, reason: "PH08_GENERATION_OUT_OF_SCOPE" };
            },
          }
        : undefined,
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
            textOrigin: metric.textOrigin,
            generationVersion: metric.generationVersion,
            ...(metric.textOrigin === "gemini_generated"
              ? { generatedContentStatus: "draft_pending_human_review" }
              : {}),
            transportMode: offline ? "offline_simulated" : "live",
            ...(offline ? { actualLlmUsed: false } : {}),
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
