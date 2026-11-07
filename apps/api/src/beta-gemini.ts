import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Store, GuestAuth } from "./store";
import type { ProductOwner } from "./product-core";
import { GeminiAdapter, type GeminiSettings } from "./gemini-adapter";
import { estimateGeminiCost } from "./ai-cost";
import {
  AiProviderFailure,
  safeTeachingText,
  type AiReply,
  type AiTutorPort,
  type DraftResult,
  type HintContext,
} from "./ai-tutor";
import { betaAiConfigured, canDeliverExternalAi } from "./external-ai-access";

const scope = new AsyncLocalStorage<{
  store: Store;
  owner: ProductOwner;
  invoked: boolean;
}>();
export function withBetaAiOwner<T>(
  store: Store,
  auth: GuestAuth,
  work: () => Promise<T>,
): Promise<T> {
  const owner = betaAiOwner(auth);
  return scope.run({ store, owner, invoked: false }, work);
}
export function betaAiOwner(auth: GuestAuth): ProductOwner {
  return {
    ownerKey: auth.accountUserId
      ? "user:" + auth.accountUserId
      : "guest:" + auth.row.id,
    userId: auth.accountUserId ?? null,
    guestId: auth.row.id,
    authSessionId: auth.accountSessionId,
    guestAuth: auth.accountUserId ? undefined : auth,
    role: "student",
  };
}
export function withProductAiOwner<T>(
  store: Store,
  owner: ProductOwner,
  work: () => Promise<T>,
): Promise<T> {
  return scope.run({ store, owner, invoked: false }, work);
}
const integer = (key: string, fallback: number, max: number) => {
  const n = Number(process.env[key] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1 || n > max)
    throw Error("BETA_AI_LIMIT_INVALID");
  return n;
};
export function betaAllowedTexts(context: HintContext): string[] {
  const core = context.reviewedHintTextAr;
  return [
    ...new Set([
      core,
      ...context.approvedRephrasesAr.slice(0, 4),
      "لنراجع الفكرة معًا. " + core,
      core + " جرّب خطوة واحدة ثم راجعها.",
    ]),
  ];
}
export function betaHintMeaning(
  text: string,
  context: HintContext,
): DraftResult {
  if (
    !safeTeachingText(text) ||
    /[٠-٩۰-۹=×÷+*/(){}]|(?:الجواب هو|الحل هو|الحل النهائي|يساوي)/u.test(text)
  )
    return { text: null, reason: "BETA_AI_UNSAFE_CONTENT" };
  return betaAllowedTexts(context).includes(text)
    ? { text, reason: "AI_VALIDATED" }
    : { text: null, reason: "BETA_AI_UNAPPROVED_MEANING" };
}
/** New opt-in runtime: no historical PH08 round, no learner text or identity in
 * the provider payload, no retry, durable quota/budget reservations before I/O. */
export class BetaGeminiPort implements AiTutorPort {
  readonly kind = "gemini" as const;
  readonly maximumCostUnits = 1;
  readonly ph08Meaning = (text: string, context: HintContext) =>
    betaHintMeaning(text, context);
  requiresReviewedFallback() {
    return true;
  }
  constructor(
    readonly store: Store,
    readonly settings: GeminiSettings = {
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: process.env.BETA_GEMINI_MODEL ?? "",
      thinkingLevel: process.env.BETA_GEMINI_THINKING_LEVEL ?? "minimal",
    },
    readonly transport: typeof fetch = fetch,
  ) {}
  get model() {
    return this.settings.model;
  }
  get enabled() {
    return (
      betaAiConfigured() &&
      process.env.BETA_GEMINI_OUTPUT_CAP_POLICY === "total_generation"
    );
  }
  invocationStarted() {
    return scope.getStore()?.invoked === true;
  }
  private async reserve(
    owner: ProductOwner,
    inputBound: number,
    outputBound: number,
  ): Promise<{ id: string; authorization: string } | null> {
    const authorization = process.env.BETA_GEMINI_AUTHORIZATION_ID ?? "";
    const estimate = estimateGeminiCost(this.model, inputBound, outputBound);
    const maxCost = Number(process.env.BETA_AI_MAX_CALL_COST_MICROS ?? 0),
      daily = Number(process.env.BETA_AI_DAILY_COST_MICROS ?? 0),
      monthly = Number(process.env.BETA_AI_MONTHLY_COST_MICROS ?? 0);
    if (
      estimate.status !== "estimated" ||
      estimate.estimatedCostMicros === null ||
      estimate.estimatedCostMicros < 0 ||
      !Number.isSafeInteger(maxCost) ||
      maxCost < 1 ||
      maxCost < estimate.estimatedCostMicros ||
      !Number.isSafeInteger(daily) ||
      daily < maxCost ||
      !Number.isSafeInteger(monthly) ||
      monthly < maxCost
    )
      return null;
    return this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71941020261107)`;
      if (!(await canDeliverExternalAi(tx, owner))) return null;
      await tx.$executeRaw`INSERT INTO external_ai_runtime(authorization_id) VALUES(${authorization}) ON CONFLICT(authorization_id) DO NOTHING`;
      const [runtime] = await tx.$queryRaw<
        { quota_stopped: boolean; reserved_calls: number }[]
      >`SELECT quota_stopped,reserved_calls FROM external_ai_runtime WHERE authorization_id=${authorization} FOR UPDATE`;
      if (
        !runtime ||
        runtime.quota_stopped ||
        !Number.isSafeInteger(runtime.reserved_calls) ||
        runtime.reserved_calls >=
          integer("BETA_GEMINI_KNOWN_DAILY_REMAINING", 1, 100000)
      )
        return null;
      const [usage] = await tx.$queryRaw<
        {
          day_calls: bigint;
          minute_calls: bigint;
          parallel: bigint;
          daily_cost: bigint;
          monthly_cost: bigint;
          user_calls: bigint;
          user_tokens: bigint;
        }[]
      >`SELECT count(*) FILTER(WHERE authorization_id IS NOT NULL AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS day_calls,count(*) FILTER(WHERE authorization_id IS NOT NULL AND created_at>now()-interval '60 seconds') AS minute_calls,count(*) FILTER(WHERE authorization_id IS NOT NULL AND finished_at IS NULL AND deadline_at>now()) AS parallel,coalesce(sum(maximum_cost_micros) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0) AS daily_cost,coalesce(sum(maximum_cost_micros) FILTER(WHERE created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0) AS monthly_cost,count(*) FILTER(WHERE owner_key=${owner.ownerKey} AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS user_calls,coalesce(sum(maximum_tokens) FILTER(WHERE owner_key=${owner.ownerKey} AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0) AS user_tokens FROM beta_ai_reservations WHERE created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' OR created_at>now()-interval '60 seconds' OR (finished_at IS NULL AND deadline_at>now())`;
      const allowed = integer("BETA_GEMINI_DAILY_REQUEST_LIMIT", 20, 10000);
      if (
        Number(usage?.day_calls ?? 0) >= allowed ||
        Number(usage?.minute_calls ?? 0) >= integer("BETA_GEMINI_RPM", 5, 10) ||
        Number(usage?.parallel ?? 0) >=
          integer("BETA_GEMINI_MAX_PARALLEL", 1, 4) ||
        Number(usage?.daily_cost ?? 0) + maxCost > daily ||
        Number(usage?.monthly_cost ?? 0) + maxCost > monthly ||
        Number(usage?.user_calls ?? 0) >=
          integer("BETA_AI_USER_DAILY_CALLS", 10, 1000) ||
        Number(usage?.user_tokens ?? 0) + inputBound + outputBound >
          integer("BETA_AI_USER_DAILY_TOKENS", 64000, 1000000)
      )
        return null;
      const id = randomUUID();
      await tx.$executeRaw`INSERT INTO beta_ai_reservations(id,owner_key,maximum_tokens,maximum_cost_micros,authorization_id,model,deadline_at) VALUES(${id}::uuid,${owner.ownerKey},${inputBound + outputBound},${maxCost},${authorization},${this.model},${new Date(Date.now() + integer("BETA_GEMINI_TIMEOUT_MS", 8000, 20000))})`;
      await tx.$executeRaw`UPDATE external_ai_runtime SET reserved_calls=reserved_calls+1,updated_at=now() WHERE authorization_id=${authorization}`;
      return { id, authorization };
    });
  }
  async adaptHint(context: HintContext, parent: AbortSignal): Promise<AiReply> {
    const active = scope.getStore();
    if (
      !this.enabled ||
      !active ||
      active.store !== this.store ||
      parent.aborted
    )
      throw Error("BETA_AI_DISABLED_OR_UNCONSENTED");
    if (
      context.task !== "hint_rephrase" ||
      !["H1", "H2", "H3"].includes(context.targetHintLevel) ||
      !safeTeachingText(context.reviewedHintTextAr) ||
      context.reviewedHintTextAr.length > 1200
    )
      throw Error("BETA_AI_CONTEXT_REJECTED");
    const outputBound = Math.min(
      integer("BETA_GEMINI_MAX_BILLABLE_OUTPUT_TOKENS", 256, 256),
      context.maxOutputTokens,
    );
    if (!Number.isSafeInteger(outputBound) || outputBound < 1)
      throw Error("BETA_AI_OUTPUT_LIMIT");
    // The shared adapter rejects a complete wire body over 12KB. Reserve a
    // conservative token bound including schema/system overhead, outside I/O.
    const reserved = await this.reserve(
      active.owner,
      12000 * 2 + 1024,
      outputBound,
    );
    if (!reserved) throw Error("BETA_AI_BUDGET_OR_QUOTA");
    const signal = AbortSignal.any([
      parent,
      AbortSignal.timeout(integer("BETA_GEMINI_TIMEOUT_MS", 8000, 20000)),
    ]);
    const stop = async () => {
      await this.store.db
        .$executeRaw`UPDATE external_ai_runtime SET quota_stopped=true,updated_at=now() WHERE authorization_id=${reserved.authorization}`;
    };
    try {
      const allowed = betaAllowedTexts(context);
      const port = new GeminiAdapter(
        this.settings,
        { reserve() {}, stopForQuota() {}, close() {} },
        () => this.enabled,
        () => {},
        async (url, options) => {
          const deliver = await this.store.db.$transaction(async (tx) => {
            if (!(await canDeliverExternalAi(tx, active.owner))) return false;
            const [runtime] = await tx.$queryRaw<
              { quota_stopped: boolean }[]
            >`SELECT quota_stopped FROM external_ai_runtime WHERE authorization_id=${reserved.authorization} FOR SHARE`;
            return runtime?.quota_stopped === false;
          });
          if (!deliver) throw Error("BETA_AI_CONSENT_OR_QUOTA_CHANGED");
          if (options?.signal?.aborted || !this.enabled)
            throw Error("BETA_AI_ABORTED_BEFORE_DISPATCH");
          active.invoked = true;
          const response = await this.transport(url, options);
          if (response.status === 429) await stop();
          return response;
        },
      );
      const reply = await port.adaptHint(
        {
          ...context,
          approvedRephrasesAr: allowed.filter(
            (text) => text !== context.reviewedHintTextAr,
          ),
          maxOutputTokens: outputBound,
        },
        signal,
      );
      if (
        reply.billingOutputTokens === null ||
        reply.billingOutputTokens === undefined ||
        reply.billingOutputTokens > outputBound
      ) {
        await stop();
        throw new AiProviderFailure({
          inputTokens: reply.inputTokens,
          outputTokens: reply.outputTokens,
          billingOutputTokens: reply.billingOutputTokens ?? null,
        });
      }
      return reply;
    } catch (error) {
      // A failed/unknown remote call is not a free call. Stop this authorization
      // until operator review rather than assuming an unreported token bound.
      if (active.invoked) await stop().catch(() => {});
      if (error instanceof AiProviderFailure) throw error;
      throw new AiProviderFailure({
        inputTokens: null,
        outputTokens: null,
        billingOutputTokens: null,
      });
    } finally {
      await this.store.db
        .$executeRaw`UPDATE beta_ai_reservations SET finished_at=now() WHERE id=${reserved.id}::uuid`.catch(
        () => {},
      );
    }
  }
}
