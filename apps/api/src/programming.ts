import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  ContentPayload,
  ProgrammingResult,
} from "../../../packages/contracts/src/product";
import { AccountService } from "./accounts";
import { ApiFault, RequestContext } from "./http";
import { uuid } from "./contracts";
import { Store } from "./store";
import { publicItem } from "./content-payload";
import { evaluateProgram, RunnerPort } from "./programming-runner";
import {
  only,
  productEnvelope,
  productInvalid,
  productMutation,
  record,
  revisionField,
  textField,
} from "./product-core";

interface Problem {
  id: string;
  item_id: string;
  version: number;
  status: string;
  payload: ContentPayload;
}
interface Attempt {
  id: string;
  problem_revision_id: string;
  revision: number;
  assistance_level: number;
  independent: boolean;
  source_raw: string;
  verdict: ProgrammingResult;
  created_at: Date;
  updated_at: Date;
}
const missing = () => new ApiFault(404, "not_found", "المورد غير متاح.");
export class ProgrammingService {
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly runner: RunnerPort,
  ) {}
  private async problem(
    tx: Prisma.TransactionClient,
    id: string,
    pinned = false,
  ): Promise<Problem> {
    const [r] = await tx.$queryRaw<
      Problem[]
    >`SELECT * FROM studio_revisions WHERE id=${uuid(id)}::uuid AND payload->>'subject'='programming' AND (status='published' OR (${pinned} AND status='archived'))`;
    if (!r?.payload.programming || (!pinned && r.payload.kind !== "main"))
      throw missing();
    return r;
  }
  async list(request: RequestContext) {
    await this.accounts.actor(request);
    const rows = await this.store.db.$queryRaw<
      Problem[]
    >`SELECT * FROM studio_revisions WHERE status='published' AND payload->>'subject'='programming' AND payload->>'kind'='main' ORDER BY payload->>'lessonCode',id LIMIT 200`;
    return {
      items: rows.map((r) => publicItem(r.id, r.item_id, r.version, r.payload)),
    };
  }
  async detail(request: RequestContext, id: string) {
    await this.accounts.actor(request);
    const r = await this.problem(this.store.db, id);
    return publicItem(r.id, r.item_id, r.version, r.payload);
  }
  async history(request: RequestContext) {
    const owner = await this.accounts.actor(request);
    await this.recover(owner.ownerKey);
    const rows = await this.store.db.$queryRaw<
      Attempt[]
    >`SELECT * FROM subject_attempts WHERE owner_key=${owner.ownerKey} AND subject_code='programming' ORDER BY created_at DESC,id LIMIT 50`;
    return { items: rows.map((r) => r.verdict) };
  }
  async attempt(request: RequestContext, id: string) {
    const owner = await this.accounts.actor(request);
    await this.recover(owner.ownerKey);
    const [row] = await this.store.db.$queryRaw<
      Attempt[]
    >`SELECT * FROM subject_attempts WHERE id=${uuid(id)}::uuid AND owner_key=${owner.ownerKey} AND subject_code='programming'`;
    if (!row) throw missing();
    const p = await this.problem(this.store.db, row.problem_revision_id, true);
    return {
      problem: publicItem(p.id, p.item_id, p.version, p.payload),
      result: row.verdict,
      sourceRaw: row.source_raw,
      assistanceLevel: row.assistance_level,
    };
  }
  private async recover(ownerKey: string) {
    await this.store.db
      .$executeRaw`UPDATE subject_attempts SET verdict=verdict||${JSON.stringify({ status: "service_error", allPassed: false, independent: false, stderr: "انقطع التنفيذ السابق؛ الكود محفوظ ويمكن إعادة الإرسال." })}::jsonb,updated_at=now() WHERE owner_key=${ownerKey} AND subject_code='programming' AND verdict->>'status' IN ('queued','running') AND updated_at<now()-interval '5 minutes'`;
  }
  async submit(
    request: RequestContext,
    raw: unknown,
  ): Promise<ProgrammingResult> {
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, [
      "problemRevisionId",
      "sourceRaw",
      "mode",
      "attemptId",
      "expectedRevision",
    ]);
    const revisionId = uuid(textField(b.problemRevisionId, 36)),
      sourceRaw = textField(b.sourceRaw, 12000),
      mode = b.mode;
    if (mode !== "run" && mode !== "submit") throw productInvalid();
    const id =
        b.attemptId === undefined
          ? randomUUID()
          : uuid(textField(b.attemptId, 36)),
      expected =
        b.attemptId === undefined ? 0 : revisionField(b.expectedRevision);
    if (
      b.attemptId === undefined &&
      b.expectedRevision !== undefined &&
      revisionField(b.expectedRevision) !== 0
    )
      throw productInvalid();
    const prepared = await productMutation(
      this.store,
      owner,
      request,
      "programming.prepare",
      b,
      async (tx) => {
        const [old] = await tx.$queryRaw<
          Attempt[]
        >`SELECT * FROM subject_attempts WHERE id=${id}::uuid AND owner_key=${owner.ownerKey} AND subject_code='programming' FOR UPDATE`;
        if (b.attemptId !== undefined && !old) throw missing();
        if (
          old &&
          (old.problem_revision_id !== revisionId || old.revision !== expected)
        )
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغيرت المحاولة. حدّث النتيجة قبل الإرسال.",
            [],
            old.revision,
          );
        const problem = await this.problem(tx, revisionId, !!old);
        const [rate] = await tx.$queryRaw<
          { minute: number; daily: number }[]
        >`SELECT count(*) FILTER(WHERE e.created_at>now()-interval '1 minute')::int AS minute,count(*)::int AS daily FROM subject_attempt_events e JOIN subject_attempts a ON a.id=e.attempt_id WHERE a.owner_key=${owner.ownerKey} AND a.subject_code='programming' AND e.event_kind='submission' AND e.created_at>now()-interval '1 day'`;
        const perMinute = Number(
            process.env.PROGRAMMING_RUNS_PER_MINUTE ?? "10",
          ),
          perDay = Number(process.env.PROGRAMMING_RUNS_PER_DAY ?? "100");
        if (
          !Number.isSafeInteger(perMinute) ||
          perMinute < 1 ||
          !Number.isSafeInteger(perDay) ||
          perDay < 1
        )
          throw new ApiFault(
            503,
            "internal_error",
            "حدود خدمة التنفيذ غير مهيأة.",
          );
        if ((rate?.minute ?? 0) >= perMinute || (rate?.daily ?? 0) >= perDay)
          throw new ApiFault(
            429,
            "rate_limited",
            "بلغت حد محاولات التنفيذ. احتفظ بالكود وحاول لاحقًا.",
            [],
            null,
            60,
          );
        const [exposure] = await tx.$queryRaw<
          { level: number }[]
        >`SELECT coalesce(max(assistance_level),0)::int AS level FROM subject_attempts WHERE owner_key=${owner.ownerKey} AND problem_revision_id=${revisionId}::uuid`;
        const assistance = Math.max(
            old?.assistance_level ?? 0,
            exposure?.level ?? 0,
          ),
          independent = (old?.independent ?? true) && assistance === 0,
          revision = old ? old.revision + 1 : 0;
        const result: ProgrammingResult = {
          attemptId: id,
          revision,
          mode,
          status: "queued",
          stdout: "",
          stderr: "",
          passed: 0,
          total:
            mode === "run"
              ? problem.payload.programming!.tests.filter((t) => !t.hidden)
                  .length
              : problem.payload.programming!.tests.length,
          allPassed: false,
          independent: false,
          createdAt: (old?.created_at ?? new Date()).toISOString(),
        };
        if (old)
          await tx.$executeRaw`UPDATE subject_attempts SET revision=${revision},source_raw=${sourceRaw},answer_json=${JSON.stringify({ mode })}::jsonb,verdict=${JSON.stringify(result)}::jsonb,assistance_level=${assistance},independent=${independent},updated_at=now() WHERE id=${id}::uuid`;
        else
          await tx.$executeRaw`INSERT INTO subject_attempts(id,owner_key,subject_code,problem_revision_id,source_raw,answer_json,verdict,assistance_level,independent) VALUES(${id}::uuid,${owner.ownerKey},'programming',${revisionId}::uuid,${sourceRaw},${JSON.stringify({ mode })}::jsonb,${JSON.stringify(result)}::jsonb,${assistance},${independent})`;
        await tx.$executeRaw`INSERT INTO subject_attempt_events(id,attempt_id,revision,event_kind,result) VALUES(${randomUUID()}::uuid,${id}::uuid,${revision},'submission',${JSON.stringify({ mode, status: "queued" })}::jsonb)`;
        return { id, revision, independent, result };
      },
    );
    // A fingerprinted replay never dispatches a second sandbox run.
    const running = { ...prepared.result, status: "running" as const };
    const dispatched = await this.store.db
      .$executeRaw`UPDATE subject_attempts SET verdict=${JSON.stringify(running)}::jsonb,updated_at=now() WHERE id=${prepared.id}::uuid AND owner_key=${owner.ownerKey} AND revision=${prepared.revision} AND verdict->>'status'='queued'`;
    if (dispatched !== 1) {
      const [row] = await this.store.db.$queryRaw<
        Attempt[]
      >`SELECT * FROM subject_attempts WHERE id=${prepared.id}::uuid AND owner_key=${owner.ownerKey}`;
      if (!row) throw missing();
      return row.verdict;
    }
    const problem = await this.problem(this.store.db, revisionId, true),
      p = problem.payload.programming!;
    const tests = mode === "run" ? p.tests.filter((t) => !t.hidden) : p.tests;
    const evaluated = await evaluateProgram(
      this.runner,
      sourceRaw,
      tests,
      p.functionName,
    );
    const result: ProgrammingResult = {
      ...prepared.result,
      ...evaluated,
      independent:
        mode === "submit" && evaluated.allPassed && prepared.independent,
    };
    return this.store.db.$transaction(async (tx) => {
      await this.accounts.authorizeInTransaction(tx, owner);
      const [row] = await tx.$queryRaw<
        Attempt[]
      >`SELECT * FROM subject_attempts WHERE id=${prepared.id}::uuid AND owner_key=${owner.ownerKey} FOR UPDATE`;
      if (!row) throw missing();
      if (row.revision !== prepared.revision)
        throw new ApiFault(
          409,
          "revision_conflict",
          "وصلت نتيجة لإصدار سابق؛ لم تغيّر محاولتك الجديدة.",
          [],
          row.revision,
        );
      result.independent =
        result.independent && row.independent && row.assistance_level === 0;
      await tx.$executeRaw`UPDATE subject_attempts SET verdict=${JSON.stringify(result)}::jsonb,updated_at=now() WHERE id=${row.id}::uuid`;
      await tx.$executeRaw`INSERT INTO subject_attempt_events(id,attempt_id,revision,event_kind,result) VALUES(${randomUUID()}::uuid,${row.id}::uuid,${row.revision},'result',${JSON.stringify(result)}::jsonb)`;
      return result;
    });
  }
  async hint(request: RequestContext, id: string, raw: unknown) {
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["level", "confirmFullSolution", "expectedRevision"]);
    const expected = revisionField(b.expectedRevision);
    if (
      typeof b.level !== "number" ||
      ![1, 2, 3, 4].includes(b.level) ||
      (b.confirmFullSolution !== undefined &&
        typeof b.confirmFullSolution !== "boolean")
    )
      throw productInvalid();
    const level = b.level;
    if (level === 4 && b.confirmFullSolution !== true)
      throw productInvalid("يتطلب عرض المساعدة الكاملة تأكيدًا صريحًا.");
    return productMutation(
      this.store,
      owner,
      request,
      "programming.hint:" + uuid(id),
      b,
      async (tx) => {
        const [a] = await tx.$queryRaw<
          Attempt[]
        >`SELECT * FROM subject_attempts WHERE id=${id}::uuid AND owner_key=${owner.ownerKey} AND subject_code='programming' FOR UPDATE`;
        if (!a) throw missing();
        if (a.revision !== expected)
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغيرت المحاولة؛ حدّثها قبل طلب التلميح.",
            [],
            a.revision,
          );
        const r = await this.problem(tx, a.problem_revision_id, true);
        if (r.payload.kind === "transfer")
          throw new ApiFault(
            409,
            "invalid_state",
            "هذه مسألة نقل مستقلة؛ التلميحات مغلقة أثناء التقييم.",
          );
        if (level < 4 && level > Math.min(3, a.assistance_level + 1))
          throw new ApiFault(
            409,
            "invalid_state",
            "اطلب التلميحات H1 إلى H3 بالترتيب.",
          );
        const h = r.payload.hints.find((h) => h.level === level && h.reviewed);
        if (!h)
          throw new ApiFault(
            503,
            "ai_unavailable",
            "لا يتوفر تلميح مراجع لهذا المستوى؛ محاولتك محفوظة.",
          );
        const result = {
          attemptId: a.id,
          revision: a.revision + 1,
          level,
          textAr: h.textAr,
          source: "reviewed_template" as const,
          reasonAr:
            "هذا التلميح يساعدك في المهارة المحددة؛ النجاح بعده يسجل مع مساعدة.",
        };
        const verdict = {
          ...a.verdict,
          revision: result.revision,
          independent: false,
        };
        await tx.$executeRaw`UPDATE subject_attempts SET revision=revision+1,assistance_level=greatest(assistance_level,${level}),independent=false,verdict=${JSON.stringify(verdict)}::jsonb,updated_at=now() WHERE id=${id}::uuid`;
        await tx.$executeRaw`INSERT INTO subject_attempt_events(id,attempt_id,revision,event_kind,result) VALUES(${randomUUID()}::uuid,${id}::uuid,${result.revision},'hint',${JSON.stringify(result)}::jsonb)`;
        return result;
      },
    );
  }
}
@Controller("api/v1/programming")
export class ProgrammingController {
  constructor(readonly programming: ProgrammingService) {}
  @Get("problems") list(@Req() r: RequestContext) {
    return this.programming.list(r).then((x) => productEnvelope(r, x));
  }
  @Get("problems/:id") detail(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.programming.detail(r, id).then((x) => productEnvelope(r, x));
  }
  @Get("attempts") history(@Req() r: RequestContext) {
    return this.programming.history(r).then((x) => productEnvelope(r, x));
  }
  @Get("attempts/:id") attempt(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.programming.attempt(r, id).then((x) => productEnvelope(r, x));
  }
  @Post("attempts") submit(@Req() r: RequestContext, @Body() b: unknown) {
    return this.programming.submit(r, b).then((x) => productEnvelope(r, x));
  }
  @Post("attempts/:id/hints") hint(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.programming.hint(r, id, b).then((x) => productEnvelope(r, x));
  }
}
