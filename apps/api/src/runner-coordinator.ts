import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { idempotencyHeader } from "./contracts";
import { ApiFault, RequestContext } from "./http";
import { ProductOwner } from "./product-core";
import { Store } from "./store";

interface StoredFault {
  status: number;
  code: ApiFault["code"];
  messageAr: string;
  issues: ApiFault["issues"];
  currentRevision: number | null;
  retryAfterSeconds: number | null;
}
interface WorkRow<R> {
  id: string;
  fingerprint: string;
  state: "running" | "completed" | "failed" | "interrupted";
  response_cache: R | null;
  fault_cache: StoredFault | null;
}
export interface RunnerPlan<S> {
  snapshot: S;
  /** Reserved maximum executions, including private reference tests. */
  runs: number;
  attemptId?: string;
  attemptRevision?: number;
}
export interface RunnerWork<S, E, R> {
  prepare(tx: Prisma.TransactionClient): Promise<RunnerPlan<S>>;
  execute(
    snapshot: S,
    execution: {
      accepted(token: string): Promise<void>;
      beforeDispatch(): Promise<void>;
    },
  ): Promise<E>;
  finish(tx: Prisma.TransactionClient, snapshot: S, evaluated: E): Promise<R>;
  uncertain?(evaluated: E): boolean;
  replay?(tx: Prisma.TransactionClient, result: R): Promise<R>;
}
const interrupted = () =>
  new ApiFault(
    503,
    "internal_error",
    "انقطع طلب التنفيذ السابق. بقي العمل محفوظًا؛ يلزم التحقق من مهمته المعزولة قبل إعادة التشغيل.",
  );
const storedFault = (fault: ApiFault): StoredFault => ({
  status: fault.status,
  code: fault.code,
  messageAr: fault.messageAr,
  issues: fault.issues,
  currentRevision: fault.currentRevision,
  retryAfterSeconds: fault.retryAfterSeconds,
});
const restoreFault = (fault: StoredFault) =>
  new ApiFault(
    fault.status,
    fault.code,
    fault.messageAr,
    fault.issues,
    fault.currentRevision,
    fault.retryAfterSeconds,
  );
const setting = (name: string, fallback: number, max: number): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new ApiFault(503, "internal_error", "حدود خدمة التنفيذ غير مهيأة.");
  return value;
};

/** A durable request ledger shared by learner and author Runner work.
 * Only reservation/finalization hold transactions. A lease is never redispatched:
 * an expired/ambiguous job quarantines its capacity until operator reconciliation.
 */
export class RunnerCoordinator {
  constructor(readonly store: Store) {}
  private async authorize(tx: Prisma.TransactionClient, owner: ProductOwner) {
    if (owner.userId) {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT s.id FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=${owner.authSessionId ?? "00000000-0000-0000-0000-000000000000"}::uuid AND s.user_id=${owner.userId}::uuid AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active' AND u.role=${owner.role} FOR SHARE OF s,u`;
      if (rows.length !== 1)
        throw new ApiFault(401, "unauthenticated", "انتهت جلسة الحساب.");
    } else if (owner.guestAuth)
      await this.store.authorizeInTransaction(tx, owner.guestAuth);
    else throw new ApiFault(401, "unauthenticated", "ابدأ جلسة للمتابعة.");
  }
  private async lock(tx: Prisma.TransactionClient, owner: ProductOwner) {
    // One lock order on every API instance makes global and owner reservations atomic.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71941020261118)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
  }
  private async expire(tx: Prisma.TransactionClient) {
    await tx.$executeRaw`UPDATE runner_work_requests SET state='interrupted',fault_cache=${JSON.stringify(storedFault(interrupted()))}::jsonb,updated_at=now() WHERE state='running' AND lease_until<=now()`;
  }
  async recover(owner: ProductOwner) {
    await this.store.db.$transaction(
      async (tx) => {
        await this.lock(tx, owner);
        await this.authorize(tx, owner);
        await this.expire(tx);
        // Preserve raw source and newer revisions. Legacy work predating the ledger
        // retains the old five-minute recovery, without reviving any dispatch.
        await tx.$executeRaw`UPDATE subject_attempts a SET verdict=a.verdict||${JSON.stringify({ status: "service_error", allPassed: false, independent: false, stderr: "انقطع التنفيذ السابق؛ الكود محفوظ. راجع حالة الخدمة قبل إعادة التشغيل." })}::jsonb,independent=false,updated_at=now() WHERE a.owner_key=${owner.ownerKey} AND a.subject_code='programming' AND a.verdict->>'status' IN ('queued','running') AND (EXISTS(SELECT 1 FROM runner_work_requests w WHERE w.attempt_id=a.id AND w.attempt_revision=a.revision AND w.state IN ('interrupted','failed')) OR (a.updated_at<now()-interval '5 minutes' AND NOT EXISTS(SELECT 1 FROM runner_work_requests w WHERE w.attempt_id=a.id AND w.attempt_revision=a.revision)))`;
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async run<S, E, R>(
    owner: ProductOwner,
    request: RequestContext,
    operation: string,
    body: unknown,
    work: RunnerWork<S, E, R>,
  ): Promise<R> {
    const digest = this.store.security.keyDigest(
      idempotencyHeader(request.headers["idempotency-key"]),
    );
    const fingerprint = this.store.security.fingerprint(body);
    const id = randomUUID(),
      lease = randomUUID();
    const reserved = await this.store.db.$transaction(
      async (tx) => {
        await this.lock(tx, owner);
        await this.authorize(tx, owner);
        await this.expire(tx);
        const [old] = await tx.$queryRaw<
          WorkRow<R>[]
        >`SELECT id,fingerprint,state,response_cache,fault_cache FROM runner_work_requests WHERE owner_key=${owner.ownerKey} AND operation=${operation} AND key_digest=${digest} AND (expires_at>now() OR state IN ('running','interrupted'))`;
        if (old) {
          if (old.fingerprint !== fingerprint)
            throw new ApiFault(
              409,
              "idempotency_conflict",
              "استُخدم مفتاح الإرسال مع طلب مختلف.",
            );
          if (old.response_cache !== null && !old.fault_cache && work.replay)
            old.response_cache = await work.replay(tx, old.response_cache);
          return { replay: old } as const;
        }
        // Existing successful studio keys survive the migration to this coordinator.
        const [legacy] = await tx.$queryRaw<
          { fingerprint: string; response_cache: R }[]
        >`SELECT fingerprint,response_cache FROM product_mutations WHERE owner_key=${owner.ownerKey} AND operation=${operation} AND key_digest=${digest} AND expires_at>now()`;
        if (legacy) {
          if (legacy.fingerprint !== fingerprint)
            throw new ApiFault(
              409,
              "idempotency_conflict",
              "استُخدم مفتاح الإرسال مع طلب مختلف.",
            );
          return {
            replay: {
              state: "completed",
              response_cache: legacy.response_cache,
              fault_cache: null,
            },
          } as const;
        }
        const plan = await work.prepare(tx);
        if (!Number.isSafeInteger(plan.runs) || plan.runs < 0 || plan.runs > 20)
          throw new ApiFault(
            503,
            "internal_error",
            "تعذر حجز اختبارات التنفيذ.",
          );
        if (plan.runs > 0) {
          const perMinute = setting("PROGRAMMING_RUNS_PER_MINUTE", 10, 1000);
          const perDay = setting("PROGRAMMING_RUNS_PER_DAY", 100, 100000);
          const casesMinute = setting(
            "PROGRAMMING_CASES_PER_MINUTE",
            200,
            20000,
          );
          const casesDay = setting("PROGRAMMING_CASES_PER_DAY", 2000, 2000000);
          const ownerParallel = setting("RUNNER_OWNER_CONCURRENCY", 1, 4);
          const globalParallel = setting("RUNNER_GLOBAL_CONCURRENCY", 4, 32);
          const [usage] = await tx.$queryRaw<
            {
              minute: number;
              daily: number;
              cases_minute: number;
              cases_daily: number;
              owner_active: number;
              global_active: number;
            }[]
          >`SELECT count(*) FILTER(WHERE owner_key=${owner.ownerKey} AND created_at>now()-interval '1 minute')::int AS minute,count(*) FILTER(WHERE owner_key=${owner.ownerKey} AND created_at>now()-interval '1 day')::int AS daily,coalesce(sum(reserved_runs) FILTER(WHERE owner_key=${owner.ownerKey} AND created_at>now()-interval '1 minute'),0)::int AS cases_minute,coalesce(sum(reserved_runs) FILTER(WHERE owner_key=${owner.ownerKey} AND created_at>now()-interval '1 day'),0)::int AS cases_daily,count(*) FILTER(WHERE owner_key=${owner.ownerKey} AND state IN ('running','interrupted'))::int AS owner_active,count(*) FILTER(WHERE state IN ('running','interrupted'))::int AS global_active FROM runner_work_requests WHERE reserved_runs>0 AND ((owner_key=${owner.ownerKey} AND created_at>now()-interval '1 day') OR state IN ('running','interrupted'))`;
          if (
            (usage?.minute ?? 0) >= perMinute ||
            (usage?.daily ?? 0) >= perDay ||
            (usage?.cases_minute ?? 0) + plan.runs > casesMinute ||
            (usage?.cases_daily ?? 0) + plan.runs > casesDay ||
            (usage?.owner_active ?? 0) >= ownerParallel ||
            (usage?.global_active ?? 0) >= globalParallel
          )
            throw new ApiFault(
              429,
              "rate_limited",
              "بلغت حصة التنفيذ أو توجد مهمة قيد التنفيذ أو المراجعة. بقي عملك محفوظًا.",
              [],
              null,
              60,
            );
        }
        await tx.$executeRaw`DELETE FROM runner_work_requests WHERE owner_key=${owner.ownerKey} AND operation=${operation} AND key_digest=${digest} AND expires_at<=now() AND state NOT IN ('running','interrupted')`;
        const leaseSeconds = plan.runs > 0 ? 60 : 180;
        await tx.$executeRaw`INSERT INTO runner_work_requests(id,owner_key,operation,key_digest,fingerprint,state,lease_token,lease_until,reserved_runs,attempt_id,attempt_revision,expires_at) VALUES(${id}::uuid,${owner.ownerKey},${operation},${digest},${fingerprint},'running',${lease}::uuid,now()+${leaseSeconds}*interval '1 second',${plan.runs},${plan.attemptId ?? null}::uuid,${plan.attemptRevision ?? null},now()+interval '24 hours')`;
        return { plan } as const;
      },
      { maxWait: 5000, timeout: 15000 },
    );
    if ("replay" in reserved && reserved.replay !== undefined) {
      const old = reserved.replay;
      if (old.fault_cache) throw restoreFault(old.fault_cache);
      if (old.response_cache !== null) return old.response_cache;
      throw new ApiFault(
        409,
        "request_in_progress",
        "طلب التنفيذ نفسه قيد المعالجة؛ أعد الاستعلام بالمفتاح نفسه.",
        [],
        null,
        2,
      );
    }
    let uncertain = false;
    try {
      const evaluated = await work.execute(reserved.plan.snapshot, {
        beforeDispatch: async () => {
          await this.store.db.$transaction(
            async (tx) => {
              await this.lock(tx, owner);
              await this.authorize(tx, owner);
              const [active] = await tx.$queryRaw<
                { id: string }[]
              >`SELECT id FROM runner_work_requests WHERE id=${id}::uuid AND owner_key=${owner.ownerKey} AND lease_token=${lease}::uuid AND state='running' AND lease_until>now() AND (attempt_id IS NULL OR EXISTS(SELECT 1 FROM subject_attempts a WHERE a.id=runner_work_requests.attempt_id AND a.owner_key=${owner.ownerKey} AND a.revision=runner_work_requests.attempt_revision)) FOR UPDATE`;
              if (!active) throw interrupted();
            },
            { maxWait: 5000, timeout: 15000 },
          );
        },
        accepted: async (token) => {
          if (!/^[a-zA-Z0-9-]{1,80}$/.test(token))
            throw new Error("invalid_runner_receipt");
          const saved = await this.store.db
            .$executeRaw`UPDATE runner_work_requests SET remote_tokens=remote_tokens||${JSON.stringify([token])}::jsonb,updated_at=now() WHERE id=${id}::uuid AND owner_key=${owner.ownerKey} AND lease_token=${lease}::uuid AND state='running' AND lease_until>now() AND jsonb_array_length(remote_tokens)<reserved_runs`;
          if (saved !== 1) throw new Error("runner_receipt_not_saved");
        },
      });
      uncertain = work.uncertain?.(evaluated) ?? false;
      return await this.store.db.$transaction(
        async (tx) => {
          await this.lock(tx, owner);
          await this.authorize(tx, owner);
          const [active] = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM runner_work_requests WHERE id=${id}::uuid AND owner_key=${owner.ownerKey} AND lease_token=${lease}::uuid AND state='running' AND lease_until>now() FOR UPDATE`;
          if (!active) {
            uncertain = true;
            throw interrupted();
          }
          const result = await work.finish(
            tx,
            reserved.plan.snapshot,
            evaluated,
          );
          const serialized = JSON.stringify(result);
          if (Buffer.byteLength(serialized) > 512000)
            throw new ApiFault(503, "internal_error", "نتيجة التنفيذ كبيرة.");
          await tx.$executeRaw`UPDATE runner_work_requests SET state=${uncertain ? "interrupted" : "completed"},response_cache=${serialized}::jsonb,updated_at=now(),finished_at=now() WHERE id=${id}::uuid AND lease_token=${lease}::uuid`;
          return result;
        },
        { maxWait: 5000, timeout: 15000 },
      );
    } catch (error) {
      // Unknown failures may occur after remote acceptance: never release their
      // capacity or redispatch them merely because the HTTP caller retries.
      uncertain ||= !(error instanceof ApiFault);
      const fault = error instanceof ApiFault ? error : interrupted();
      await this.store.db.$transaction(
        async (tx) => {
          await this.lock(tx, owner);
          await tx.$executeRaw`UPDATE runner_work_requests SET state=${uncertain ? "interrupted" : "failed"},fault_cache=${JSON.stringify(storedFault(fault))}::jsonb,updated_at=now(),finished_at=now() WHERE id=${id}::uuid AND lease_token=${lease}::uuid AND state='running'`;
        },
        { maxWait: 5000, timeout: 15000 },
      );
      throw fault;
    }
  }
}
