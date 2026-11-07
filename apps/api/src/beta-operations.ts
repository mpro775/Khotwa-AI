import { randomUUID } from "node:crypto";
import { statfs } from "node:fs/promises";
import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { ApiFault, type RequestContext } from "./http";
import { AccountService, accountObject, type ProductActor } from "./accounts";
import { Store } from "./store";
import type { GuestAuth } from "./store";
import { uuid } from "./contracts";
import { productEnvelope, productMutation } from "./product-core";
import { estimateGeminiCost } from "./ai-cost";

type AiUsage = {
  billingOutputTokens?: number | null;
  model?: string;
  provider: string;
  source: "llm_validated" | "reviewed_template";
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostMicros: number | null;
  timeout?: boolean;
  invoked?: boolean;
};
/** Process-local request samples, aggregate counters only. No path, body,
 * address, identity, OTP, cookie, prompt or response is retained. */
class BetaTelemetry {
  private day = new Date().toISOString().slice(0, 10);
  private latency: number[] = [];
  private count = 0;
  private errors4xx = 0;
  private errors5xx = 0;
  private aiCalls = 0;
  private hintRequests = 0;
  private fallback = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private estimatedCostMicros = 0;
  private unknownCostCalls = 0;
  private aiTimeouts = 0;
  private mathTimeouts = 0;
  private estimatedCostCalls = 0;
  private reportedTokenCalls = 0;
  private unknownTokenCalls = 0;
  private pricingVersions = new Set<string>();
  private reset() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.latency = [];
      this.count = 0;
      this.errors4xx = 0;
      this.errors5xx = 0;
      this.aiCalls = 0;
      this.hintRequests = 0;
      this.fallback = 0;
      this.inputTokens = 0;
      this.outputTokens = 0;
      this.estimatedCostMicros = 0;
      this.unknownCostCalls = 0;
      this.aiTimeouts = 0;
      this.mathTimeouts = 0;
      this.estimatedCostCalls = 0;
      this.reportedTokenCalls = 0;
      this.unknownTokenCalls = 0;
      this.pricingVersions.clear();
    }
  }
  recordApi(status: number, durationMs: number) {
    this.reset();
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.count++;
    if (status >= 400 && status < 500) this.errors4xx++;
    if (status >= 500) this.errors5xx++;
    if (this.latency.length >= 1000) this.latency.shift();
    this.latency.push(Math.min(durationMs, 300000));
  }
  recordAi(usage: AiUsage) {
    this.reset();
    this.hintRequests++;
    if (usage.source === "reviewed_template") this.fallback++;
    const invoked =
      usage.invoked ??
      !["not_used", "disabled", "none"].includes(usage.provider);
    if (invoked) this.aiCalls++;
    const validTokens = (v: number | null) =>
      v !== null && Number.isSafeInteger(v) && v >= 0;
    this.inputTokens += validTokens(usage.inputTokens) ? usage.inputTokens! : 0;
    this.outputTokens += validTokens(usage.outputTokens)
      ? usage.outputTokens!
      : 0;
    if (invoked) {
      if (validTokens(usage.inputTokens) && validTokens(usage.outputTokens))
        this.reportedTokenCalls++;
      else this.unknownTokenCalls++;
    }
    const estimate =
      usage.provider === "gemini"
        ? estimateGeminiCost(
            usage.model,
            usage.inputTokens,
            usage.billingOutputTokens === undefined
              ? usage.outputTokens
              : usage.billingOutputTokens,
            undefined,
            invoked,
          )
        : null;
    const cost = !invoked
      ? null
      : estimate
        ? estimate.estimatedCostMicros
        : usage.estimatedCostMicros;
    if (cost === null && invoked) this.unknownCostCalls++;
    else if (cost !== null && Number.isSafeInteger(cost) && cost >= 0) {
      if (invoked) this.estimatedCostCalls++;
      this.estimatedCostMicros += Math.max(0, Math.floor(cost));
    }
    if (estimate?.pricingVersion)
      this.pricingVersions.add(estimate.pricingVersion);
    if (usage.timeout) this.aiTimeouts++;
  }
  recordMathTimeout() {
    this.reset();
    this.mathTimeouts++;
  }
  snapshot() {
    this.reset();
    const sorted = [...this.latency].sort((a, b) => a - b);
    const quantile = (p: number) =>
      sorted.length >= 20
        ? Math.round(sorted[Math.ceil(sorted.length * p) - 1]!)
        : null;
    return {
      day: this.day,
      api: {
        requestCount: this.count,
        sampleCount: sorted.length,
        status4xx: this.errors4xx,
        status5xx: this.errors5xx,
        p50Ms: quantile(0.5),
        p95Ms: quantile(0.95),
      },
      ai: {
        calls: this.aiCalls,
        hintRequests: this.hintRequests,
        fallback: this.fallback,
        fallbackRatio: this.hintRequests
          ? this.fallback / this.hintRequests
          : null,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        estimatedCostMicros: this.estimatedCostMicros,
        unknownCostCalls: this.unknownCostCalls,
        timeouts: this.aiTimeouts,
      },
      mathTimeouts: this.mathTimeouts,
      aiCost: {
        status: this.unknownCostCalls
          ? this.estimatedCostCalls
            ? "mixed"
            : "unknown"
          : this.estimatedCostCalls
            ? "estimated"
            : "not_invoked",
        currency: "USD",
        estimatedCalls: this.estimatedCostCalls,
        reportedTokenCalls: this.reportedTokenCalls,
        unknownTokenCalls: this.unknownTokenCalls,
        pricingVersions: [...this.pricingVersions].sort(),
        actualBilledCostMicros: null,
      },
      scope: "current-process-since-start-or-utc-day-boundary",
      percentileMinimumSamples: 20,
    };
  }
}
export const betaTelemetry = new BetaTelemetry();
export function sanitizeFeedback(value: string): string {
  const redacted = value
    .replace(/\bBearer\s+\S+/gi, "[محذوف]")
    .replace(/\b(?:sk-|AIza)[A-Za-z0-9_-]{16,}/g, "[محذوف]")
    .replace(
      /\b[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      "[بريد محذوف]",
    )
    .replace(
      /(?:kh_guest|kh_account|authorization|cookie|password|otp|api[_ -]?key)\s*[:=]\s*[^\s;,]+/gi,
      "[سر محذوف]",
    )
    .replace(/[A-Za-z0-9_-]{40,}/g, "[قيمة محذوفة]");
  return Array.from(redacted)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (code >= 32 && code !== 127) || [9, 10, 13].includes(code);
    })
    .join("");
}
const bounded = (name: string, fallback: number, max = 1000000000000) => {
  const value =
    process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new Error("INVALID_BETA_LIMIT");
  return value;
};

export class BetaOperationsService {
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
  ) {}
  async feedback(request: RequestContext, raw: unknown) {
    const actor = await this.accounts.actor(request, true);
    const body = accountObject(raw, ["kind", "message", "requestId"]);
    if (
      typeof body.kind !== "string" ||
      !["bug", "content", "suggestion", "other"].includes(body.kind) ||
      typeof body.message !== "string" ||
      body.message.trim().length < 3 ||
      body.message.length > 2000
    )
      throw new ApiFault(
        422,
        "invalid_input",
        "اختر نوع الملاحظة واكتب رسالة من ٣ إلى ٢٠٠٠ حرف دون بيانات شخصية أو أسرار.",
      );
    const requestId =
      body.requestId === undefined
        ? null
        : typeof body.requestId === "string"
          ? uuid(body.requestId)
          : null;
    if (body.requestId !== undefined && requestId === null)
      throw new ApiFault(422, "invalid_input", "رقم الطلب غير صالح.");
    const message = sanitizeFeedback(body.message.trim());
    return productMutation(
      this.store,
      actor,
      request,
      "beta.feedback",
      raw,
      async (tx) => {
        const [count] = await tx.$queryRaw<
          { n: bigint }[]
        >`SELECT count(*) AS n FROM beta_feedback WHERE owner_key=${actor.ownerKey} AND created_at>now()-interval '1 hour'`;
        if (Number(count?.n) >= 5)
          throw new ApiFault(
            429,
            "rate_limited",
            "وصلت إلى الحد المؤقت للملاحظات. حاول لاحقًا.",
            [],
            null,
            3600,
          );
        const id = randomUUID();
        await tx.$executeRaw`INSERT INTO beta_feedback(id,owner_key,kind,message_redacted,request_id) VALUES(${id}::uuid,${actor.ownerKey},${body.kind as string},${message},${requestId}::uuid)`;
        return { id, status: "received" };
      },
    );
  }
  async metrics(request: RequestContext) {
    await this.accounts.actor(request, false, ["admin"]);
    const [counts] = await this.store.db.$queryRaw<
      { sessions: bigint; attempts: bigint; hints: bigint }[]
    >`
      SELECT (SELECT count(*) FROM auth_sessions WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS sessions,
      (SELECT count(*) FROM attempts WHERE opened_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS attempts,
      (SELECT count(*) FROM hint_requests WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS hints`;
    const feedback = await this.store.db.$queryRaw<
      {
        id: string;
        kind: string;
        message_redacted: string;
        request_id: string | null;
        created_at: Date;
      }[]
    >`
      SELECT id,kind,message_redacted,request_id,created_at FROM beta_feedback ORDER BY created_at DESC LIMIT 50`;
    const disk = await statfs(process.cwd())
      .then((fs) => ({
        availableBytes: fs.bavail * fs.bsize,
        totalBytes: fs.blocks * fs.bsize,
      }))
      .catch(() => null);
    const database = await this.store.db.$queryRaw<
      { ready: number }[]
    >`SELECT 1 AS ready`
      .then(() => "ready")
      .catch(() => "unavailable");
    const telemetry = betaTelemetry.snapshot();
    return {
      ...telemetry,
      usage: {
        sessionsToday: Number(counts?.sessions ?? 0),
        attemptsToday: Number(counts?.attempts ?? 0),
        hintsToday: Number(counts?.hints ?? 0),
      },
      database,
      disk,
      feedback: feedback.map((row) => ({
        id: row.id,
        kind: row.kind,
        message: row.message_redacted,
        requestId: row.request_id,
        createdAt: row.created_at.toISOString(),
      })),
      limits: {
        dailyCostMicros: bounded("BETA_AI_DAILY_COST_MICROS", 0),
        monthlyCostMicros: bounded("BETA_AI_MONTHLY_COST_MICROS", 0),
        userDailyCalls: bounded("BETA_AI_USER_DAILY_CALLS", 10, 1000),
      },
      noteAr:
        "مقاييس الطلبات لعامل الخدمة الحالي منذ بدء التشغيل؛ لا تُحسب المئينات قبل ٢٠ عينة. التكاليف تقديرية وقد تكون مجهولة. لا تحتوي هذه الصفحة على محاولات المتعلمين.",
    };
  }
  async revoke(request: RequestContext, raw: unknown) {
    const actor = await this.accounts.actor(request, true, ["admin"]),
      body = accountObject(raw, ["userId"]);
    if (typeof body.userId !== "string")
      throw new ApiFault(422, "invalid_input", "معرّف الحساب مطلوب.");
    const target = uuid(body.userId);
    return productMutation(
      this.store,
      actor,
      request,
      "beta.access.revoke",
      raw,
      async (tx) => {
        const [lock] = await tx.$queryRaw<
          { acquired: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(hashtextextended(${"user:" + target},0)) AS acquired`;
        if (!lock?.acquired)
          throw new ApiFault(
            409,
            "request_in_progress",
            "هناك عملية أخرى على الحساب. أعد المحاولة.",
          );
        const updated =
          await tx.$executeRaw`UPDATE users SET status='suspended' WHERE id=${target}::uuid AND status='active'`;
        if (!updated) throw new ApiFault(404, "not_found", "الحساب غير متاح.");
        await tx.$executeRaw`UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=${target}::uuid`;
        return { revoked: true };
      },
    );
  }
  /** Reserve conservatively before sending; unknown price/budget means no call.
   * A reservation is not released on provider failure, bounding retry abuse. */
  async reserveAiBudget(
    actor: ProductActor,
    maximumTokens: number,
    maximumCostMicros: number,
  ): Promise<string | null> {
    if (process.env.BETA_AI_ENABLED !== "true") return null;
    if (
      !Number.isSafeInteger(maximumTokens) ||
      maximumTokens < 1 ||
      !Number.isSafeInteger(maximumCostMicros) ||
      maximumCostMicros < 1
    )
      return null;
    const daily = bounded("BETA_AI_DAILY_COST_MICROS", 0),
      monthly = bounded("BETA_AI_MONTHLY_COST_MICROS", 0);
    if (!daily || !monthly) return null;
    return this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71941020261107)`;
      await this.accounts.authorizeInTransaction(tx, actor);
      const [usage] = await tx.$queryRaw<
        {
          daily_cost: bigint;
          monthly_cost: bigint;
          user_calls: bigint;
          user_tokens: bigint;
        }[]
      >`
        SELECT COALESCE(sum(maximum_cost_micros) FILTER(WHERE created_at>=date_trunc('day',now())),0) AS daily_cost,
        COALESCE(sum(maximum_cost_micros),0) AS monthly_cost,
        count(*) FILTER(WHERE owner_key=${actor.ownerKey} AND created_at>=date_trunc('day',now())) AS user_calls,
        COALESCE(sum(maximum_tokens) FILTER(WHERE owner_key=${actor.ownerKey} AND created_at>=date_trunc('day',now())),0) AS user_tokens
        FROM beta_ai_reservations WHERE created_at>=date_trunc('month',now())`;
      if (
        Number(usage?.daily_cost ?? 0) + maximumCostMicros > daily ||
        Number(usage?.monthly_cost ?? 0) + maximumCostMicros > monthly ||
        Number(usage?.user_calls ?? 0) >=
          bounded("BETA_AI_USER_DAILY_CALLS", 10, 1000) ||
        Number(usage?.user_tokens ?? 0) + maximumTokens >
          bounded("BETA_AI_USER_DAILY_TOKENS", 10000, 1000000)
      )
        return null;
      const id = randomUUID();
      await tx.$executeRaw`INSERT INTO beta_ai_reservations(id,owner_key,maximum_tokens,maximum_cost_micros) VALUES(${id}::uuid,${actor.ownerKey},${maximumTokens},${maximumCostMicros})`;
      return id;
    });
  }
}
/** Called before a tutoring provider dispatch. An account session is rechecked
 * by reserveAiBudget under its transaction; unknown pricing disables calls. */
export async function reserveBetaAiBudget(
  store: Store,
  auth: GuestAuth,
  maximumTokens: number,
): Promise<boolean> {
  if (process.env.BETA_ENABLED !== "true") return true;
  if (
    !auth.accountUserId ||
    !auth.accountSessionId ||
    process.env.BETA_AI_ENABLED !== "true"
  )
    return false;
  const maximumCost = bounded("BETA_AI_MAX_CALL_COST_MICROS", 0);
  if (!maximumCost) return false;
  const actor: ProductActor = {
    ownerKey: "user:" + auth.accountUserId,
    userId: auth.accountUserId,
    guestId: auth.row.id,
    role: "student",
    csrfToken: "",
    authSessionId: auth.accountSessionId,
  };
  const accounts = new AccountService(store);
  const beta = new BetaOperationsService(store, accounts);
  return (
    (await beta.reserveAiBudget(actor, maximumTokens, maximumCost)) !== null
  );
}
@Controller("api/v1/beta")
export class BetaController {
  constructor(private readonly beta: BetaOperationsService) {}
  @Post("feedback") @HttpCode(201) async feedback(
    @Req() req: RequestContext,
    @Body() body: unknown,
  ) {
    return productEnvelope(req, await this.beta.feedback(req, body));
  }
  @Get("metrics") async metrics(@Req() req: RequestContext) {
    return productEnvelope(req, await this.beta.metrics(req));
  }
  @Post("access/revoke") @HttpCode(200) async revoke(
    @Req() req: RequestContext,
    @Body() body: unknown,
  ) {
    return productEnvelope(req, await this.beta.revoke(req, body));
  }
}
