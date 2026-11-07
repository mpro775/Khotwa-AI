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
import { RunnerCoordinator } from "./runner-coordinator";
import { composeSubjectHint, canDeliverSubjectAi } from "./subject-ai";
import { requireProductLearningAccess } from "./learning-access";
import {
  only,
  productEnvelope,
  productInvalid,
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
    await new RunnerCoordinator(this.store).recover(owner);
    const rows = await this.store.db.$queryRaw<
      Attempt[]
    >`SELECT * FROM subject_attempts WHERE owner_key=${owner.ownerKey} AND subject_code='programming' ORDER BY created_at DESC,id LIMIT 50`;
    return { items: rows.map((r) => r.verdict) };
  }
  async attempt(request: RequestContext, id: string) {
    const owner = await this.accounts.actor(request);
    await new RunnerCoordinator(this.store).recover(owner);
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
    return new RunnerCoordinator(this.store).run(
      owner,
      request,
      "programming.submit",
      b,
      {
        replay: async (tx, result) => {
          const [row] = await tx.$queryRaw<
            Attempt[]
          >`SELECT * FROM subject_attempts WHERE id=${result.attemptId}::uuid AND owner_key=${owner.ownerKey} AND subject_code='programming'`;
          if (!row) throw missing();
          if (row.revision !== result.revision)
            throw new ApiFault(
              409,
              "revision_conflict",
              "تغيرت المحاولة منذ هذا الإرسال؛ حدّثها قبل عرض النتيجة.",
              [],
              row.revision,
            );
          return result;
        },
        prepare: async (tx) => {
          await requireProductLearningAccess(
            tx,
            owner,
            this.store.syntheticData,
          );
          const [old] = await tx.$queryRaw<
            Attempt[]
          >`SELECT * FROM subject_attempts WHERE id=${id}::uuid AND owner_key=${owner.ownerKey} AND subject_code='programming' FOR UPDATE`;
          if (b.attemptId !== undefined && !old) throw missing();
          if (
            old &&
            (old.problem_revision_id !== revisionId ||
              old.revision !== expected)
          )
            throw new ApiFault(
              409,
              "revision_conflict",
              "تغيرت المحاولة. حدّث النتيجة قبل الإرسال.",
              [],
              old.revision,
            );
          const problem = await this.problem(tx, revisionId, !!old),
            p = problem.payload.programming!;
          const tests =
            mode === "run" ? p.tests.filter((t) => !t.hidden) : p.tests;
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
            total: tests.length,
            allPassed: false,
            independent: false,
            createdAt: (old?.created_at ?? new Date()).toISOString(),
          };
          if (old)
            await tx.$executeRaw`UPDATE subject_attempts SET revision=${revision},source_raw=${sourceRaw},answer_json=${JSON.stringify({ mode })}::jsonb,verdict=${JSON.stringify(result)}::jsonb,assistance_level=${assistance},independent=${independent},updated_at=now() WHERE id=${id}::uuid`;
          else
            await tx.$executeRaw`INSERT INTO subject_attempts(id,owner_key,subject_code,problem_revision_id,source_raw,answer_json,verdict,assistance_level,independent) VALUES(${id}::uuid,${owner.ownerKey},'programming',${revisionId}::uuid,${sourceRaw},${JSON.stringify({ mode })}::jsonb,${JSON.stringify(result)}::jsonb,${assistance},${independent})`;
          await tx.$executeRaw`INSERT INTO subject_attempt_events(id,attempt_id,revision,event_kind,result) VALUES(${randomUUID()}::uuid,${id}::uuid,${revision},'submission',${JSON.stringify({ mode, status: "queued" })}::jsonb)`;
          return {
            snapshot: {
              result,
              tests,
              functionName: p.functionName,
              independent,
            },
            runs: tests.length,
            attemptId: id,
            attemptRevision: revision,
          };
        },
        execute: async (snapshot, execution) => {
          const running = { ...snapshot.result, status: "running" as const };
          const started = await this.store.db
            .$executeRaw`UPDATE subject_attempts SET verdict=${JSON.stringify(running)}::jsonb,updated_at=now() WHERE id=${snapshot.result.attemptId}::uuid AND owner_key=${owner.ownerKey} AND revision=${snapshot.result.revision} AND verdict->>'status'='queued'`;
          if (started !== 1)
            throw new ApiFault(
              409,
              "revision_conflict",
              "تغيرت المحاولة قبل بدء التنفيذ؛ لم يُرسل كود قديم.",
            );
          return evaluateProgram(
            this.runner,
            sourceRaw,
            snapshot.tests,
            snapshot.functionName,
            {
              onAccepted: execution.accepted,
              beforeDispatch: execution.beforeDispatch,
            },
          );
        },
        uncertain: (evaluated) => evaluated.uncertain,
        finish: async (tx, snapshot, evaluated) => {
          await requireProductLearningAccess(
            tx,
            owner,
            this.store.syntheticData,
          );
          const [row] = await tx.$queryRaw<
            Attempt[]
          >`SELECT * FROM subject_attempts WHERE id=${snapshot.result.attemptId}::uuid AND owner_key=${owner.ownerKey} AND subject_code='programming' FOR UPDATE`;
          if (!row) throw missing();
          if (row.revision !== snapshot.result.revision)
            throw new ApiFault(
              409,
              "revision_conflict",
              "وصلت نتيجة لإصدار سابق؛ لم تغيّر محاولتك الجديدة.",
              [],
              row.revision,
            );
          // Explicit public projection: teacher case details and uncertainty metadata
          // must never be persisted or returned through a student result endpoint.
          const result: ProgrammingResult = {
            ...snapshot.result,
            status: evaluated.status,
            stdout: evaluated.stdout,
            stderr: evaluated.stderr,
            passed: evaluated.passed,
            total: evaluated.total,
            allPassed: evaluated.allPassed,
            independent:
              mode === "submit" &&
              evaluated.allPassed &&
              snapshot.independent &&
              row.independent &&
              row.assistance_level === 0,
          };
          await tx.$executeRaw`UPDATE subject_attempts SET verdict=${JSON.stringify(result)}::jsonb,updated_at=now() WHERE id=${row.id}::uuid`;
          await tx.$executeRaw`INSERT INTO subject_attempt_events(id,attempt_id,revision,event_kind,result) VALUES(${randomUUID()}::uuid,${row.id}::uuid,${row.revision},'result',${JSON.stringify(result)}::jsonb)`;
          return result;
        },
      },
    );
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
    const currentAttempt = async (tx: Prisma.TransactionClient) => {
      await requireProductLearningAccess(tx, owner, this.store.syntheticData);
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
      return a;
    };
    return new RunnerCoordinator(this.store).run(
      owner,
      request,
      "programming.hint:" + uuid(id),
      b,
      {
        prepare: async (tx) => {
          const a = await currentAttempt(tx);
          if (["queued", "running"].includes(a.verdict.status))
            throw new ApiFault(
              409,
              "request_in_progress",
              "انتظر نتيجة التنفيذ الحالية قبل طلب التلميح.",
              [],
              null,
              2,
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
          const h = r.payload.hints.find(
            (h) => h.level === level && h.reviewed,
          );
          if (!h)
            throw new ApiFault(
              503,
              "ai_unavailable",
              "لا يتوفر تلميح مراجع لهذا المستوى؛ محاولتك محفوظة.",
            );
          return {
            runs: 0,
            snapshot: {
              attemptId: a.id,
              problemRevisionId: a.problem_revision_id,
              reviewedTextAr: h.textAr,
              skillCodes: r.payload.skillCodes,
              previousHintLevel: a.assistance_level,
              observationCode: [
                "compile_error",
                "runtime_error",
                "timeout",
              ].includes(a.verdict.status)
                ? a.verdict.status
                : a.verdict.status === "succeeded"
                  ? a.verdict.allPassed
                    ? "tests_passed"
                    : "tests_not_passed"
                  : "unavailable",
            },
          };
        },
        execute: async (snapshot) =>
          level < 4 && snapshot.observationCode !== "unavailable"
            ? composeSubjectHint({
                store: this.store,
                owner,
                subject: "programming",
                level: level as 1 | 2 | 3,
                reviewedTextAr: snapshot.reviewedTextAr,
                skillCodes: snapshot.skillCodes,
                previousHintLevel: snapshot.previousHintLevel,
                observationCode: snapshot.observationCode,
              })
            : {
                textAr: snapshot.reviewedTextAr,
                source: "reviewed_template" as const,
                reasonCode: "REVIEWED_ONLY",
              },
        finish: async (tx, snapshot, composed) => {
          const a = await currentAttempt(tx);
          if (a.problem_revision_id !== snapshot.problemRevisionId)
            throw missing();
          const generated =
            composed.source === "llm_validated" &&
            (await canDeliverSubjectAi(tx, owner));
          const result = {
            attemptId: a.id,
            revision: a.revision + 1,
            level,
            textAr: generated ? composed.textAr : snapshot.reviewedTextAr,
            source: generated
              ? ("llm_validated" as const)
              : ("reviewed_template" as const),
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
