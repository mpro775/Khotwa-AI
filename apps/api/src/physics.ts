import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ContentPayload } from "../../../packages/contracts/src/product";
import type {
  PhysicsAttempt,
  PhysicsHint,
  PhysicsProblem,
} from "../../../packages/contracts/src/product-physics";
import { AccountService } from "./accounts";
import { ApiFault, RequestContext } from "./http";
import { uuid } from "./contracts";
import { PhysicsGateway, PhysicsResult } from "./physics-gateway";
import {
  only,
  productEnvelope,
  productInvalid,
  productMutation,
  record,
  revisionField,
  textField,
} from "./product-core";
import { Store } from "./store";
import { RunnerCoordinator } from "./runner-coordinator";
import { composeSubjectHint, canDeliverSubjectAi } from "./subject-ai";
import { requireProductLearningAccess } from "./learning-access";
import {
  requirePhysicsHintAllowed,
  invalidatePhysicsRootEpisodes,
  PhysicsLearningService,
  requirePhysicsAssignmentCurrent,
  preparePhysicsAssignmentUpdate,
  recordPhysicsExposure,
  recordPhysicsExposures,
  finishPhysicsAssignment,
} from "./physics-learning";

type RevisionRow = {
  id: string;
  item_id: string;
  code: string;
  payload: ContentPayload;
  status: string;
};
type AttemptRow = {
  id: string;
  problem_revision_id: string;
  revision: number;
  assistance_level: number;
  independent: boolean;
  verdict: PhysicsAttempt;
  answer_json: { value: string; unit: string };
};
const missing = () => new ApiFault(404, "not_found", "المورد غير متاح.");
const messages: Record<PhysicsResult["status"], string> = {
  correct: "القيمة والوحدة صحيحتان ضمن دقة المسألة.",
  wrong_value: "راجع القيمة العددية والعلاقة بين المعطيات؛ الوحدة مناسبة.",
  wrong_unit: "راجع الوحدة المطلوبة؛ العدد وحده لا يكفي للتحقق الفيزيائي.",
  unsupported: "هذه الصيغة أو الوحدة خارج نطاق الحركة الخطية المدعوم.",
  invalid_input: "اكتب قيمة عددية واضحة ووحدة من القائمة دون تعبير برمجي.",
  service_error: "تعذر التحقق الآن. محاولتك محفوظة دون حكم على فهمك.",
};
const diagnosisMessages: Record<string, string> = {
  speed_distance_confusion:
    "الوحدة المدخلة تخص كمية مختلفة؛ قد يفيد التمييز بين المسافة والسرعة.",
  unit_conversion: "قد تحتاج إلى تحويل وحدة السرعة قبل مقارنة القيمة.",
  sign_or_acceleration:
    "تختلف إشارة الإجابة؛ راجع اتجاه المحور وإشارة التسارع.",
};
function publicProblem(r: RevisionRow): PhysicsProblem {
  if (!r.payload.physics) throw missing();
  const p = r.payload;
  return {
    id: r.id,
    problemId: r.item_id,
    revisionId: r.id,
    code: r.code,
    titleAr: p.titleAr,
    statementAr: p.statementAr,
    unitCode: p.unitCode,
    lessonCode: p.lessonCode,
    lessonTitleAr: p.lessonTitleAr,
    skillCodes: p.skillCodes,
    difficulty: p.difficulty,
    quantity: p.physics!.quantity,
    givens: p.physics!.givens,
    allowedUnits: ["m", "s", "m/s", "m/s²", "km/h"],
  };
}
export class PhysicsService {
  readonly gateway = new PhysicsGateway();
  readonly learning: PhysicsLearningService;
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
  ) {
    this.learning = new PhysicsLearningService(store, accounts);
  }
  private async problem(
    tx: Prisma.TransactionClient,
    id: string,
    pinned = false,
  ): Promise<RevisionRow> {
    const [r] = await tx.$queryRaw<
      RevisionRow[]
    >`SELECT r.id,r.item_id,r.payload,r.status,i.code FROM studio_revisions r JOIN studio_items i ON i.id=r.item_id WHERE r.id=${id}::uuid AND i.subject_code='physics' AND (r.status='published' OR (${pinned} AND r.status='archived' AND r.published_at IS NOT NULL))`;
    if (!r?.payload.physics) throw missing();
    return r;
  }
  async list(request: RequestContext) {
    const owner = await this.accounts.actor(request);
    return this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      await this.accounts.authorizeInTransaction(tx, owner);
      await requireProductLearningAccess(tx, owner, this.store.syntheticData);
      const rows = await tx.$queryRaw<
        RevisionRow[]
      >`SELECT DISTINCT ON (i.id) r.id,r.item_id,r.payload,r.status,i.code FROM studio_revisions r JOIN studio_items i ON i.id=r.item_id WHERE i.subject_code='physics' AND r.status='published' AND r.payload->>'kind'='main' ORDER BY i.id,r.version DESC LIMIT 200`;
      await recordPhysicsExposures(tx, owner.ownerKey, rows);
      return { items: rows.map(publicProblem) };
    });
  }
  async detail(request: RequestContext, id: string) {
    const owner = await this.accounts.actor(request);
    return this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      await this.accounts.authorizeInTransaction(tx, owner);
      await requireProductLearningAccess(tx, owner, this.store.syntheticData);
      const problem = await this.problem(tx, uuid(id));
      if (problem.payload.kind !== "main") throw missing();
      await recordPhysicsExposure(tx, owner.ownerKey, problem);
      return publicProblem(problem);
    });
  }
  async resume(request: RequestContext, id: string) {
    const owner = await this.accounts.actor(request);
    return this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      await this.accounts.authorizeInTransaction(tx, owner);
      const [a] = await tx.$queryRaw<
        AttemptRow[]
      >`SELECT * FROM subject_attempts WHERE id=${uuid(id)}::uuid AND owner_key=${owner.ownerKey} AND subject_code='physics'`;
      if (!a) throw missing();
      await requirePhysicsAssignmentCurrent(tx, owner.ownerKey, a.id);
      const problem = publicProblem(
        await this.problem(tx, a.problem_revision_id, true),
      );
      return {
        problem,
        result: {
          ...a.verdict,
          revision: a.revision,
          assistanceLevel: a.assistance_level,
          independentEvidence:
            a.verdict.status === "correct" &&
            a.independent &&
            a.assistance_level === 0,
        },
        value: a.answer_json.value,
        unit: a.answer_json.unit,
      };
    });
  }
  async submit(request: RequestContext, raw: unknown): Promise<PhysicsAttempt> {
    const owner = await this.accounts.actor(request, true);
    const b = record(raw);
    only(b, [
      "problemRevisionId",
      "value",
      "unit",
      "attemptId",
      "expectedRevision",
    ]);
    const problemId = uuid(textField(b.problemRevisionId, 36));
    const value = textField(b.value, 28),
      unit = textField(b.unit, 16, 0);
    const id =
      b.attemptId === undefined
        ? randomUUID()
        : uuid(textField(b.attemptId, 36));
    const expected =
      b.attemptId === undefined ? 0 : revisionField(b.expectedRevision);
    if (
      b.attemptId === undefined &&
      b.expectedRevision !== undefined &&
      revisionField(b.expectedRevision) !== 0
    )
      throw productInvalid();
    // Persist first, then call the private verifier outside the transaction.
    // An engine outage must not discard the learner's submitted value/unit.
    const prepared = await productMutation(
      this.store,
      owner,
      request,
      "physics.prepare",
      b,
      async (tx) => {
        await this.accounts.authorizeInTransaction(tx, owner);
        await requireProductLearningAccess(tx, owner, this.store.syntheticData);
        const [prior] = await tx.$queryRaw<
          AttemptRow[]
        >`SELECT * FROM subject_attempts WHERE id=${id}::uuid AND owner_key=${owner.ownerKey} AND subject_code='physics' FOR UPDATE`;
        if (b.attemptId !== undefined && !prior) throw missing();
        if (
          prior &&
          (prior.problem_revision_id !== problemId ||
            prior.revision !== expected)
        )
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغيّرت المحاولة؛ حدّثها قبل إعادة الإرسال.",
            [],
            prior.revision,
          );
        const problem = await this.problem(tx, problemId, !!prior);
        const phase = prior
          ? await preparePhysicsAssignmentUpdate(tx, owner.ownerKey, prior.id)
          : "main";
        if (problem.payload.kind !== "main" && phase === "main")
          throw new ApiFault(
            409,
            "invalid_state",
            "يبدأ العلاج والنقل بإسناد مملوك من الحلقة التعليمية فقط.",
          );
        if (prior && phase === "main")
          await invalidatePhysicsRootEpisodes(tx, owner.ownerKey, prior.id);
        await recordPhysicsExposure(tx, owner.ownerKey, problem);
        const revision = prior ? prior.revision + 1 : 0;
        const [history] = await tx.$queryRaw<
          { level: number | null; assisted: boolean | null }[]
        >`SELECT max(assistance_level)::int AS level,bool_or(NOT independent) AS assisted FROM subject_attempts WHERE owner_key=${owner.ownerKey} AND problem_revision_id=${problemId}::uuid AND subject_code='physics'`;
        const assistance = Math.max(
          prior?.assistance_level ?? 0,
          history?.level ?? 0,
        );
        const independent =
          (prior?.independent ?? true) &&
          !history?.assisted &&
          assistance === 0;
        const pending: PhysicsAttempt = {
          id,
          problemRevisionId: problemId,
          revision,
          status: "service_error",
          valueCorrect: null,
          unitCorrect: null,
          messageAr: messages.service_error,
          diagnosis: {
            state: "unresolved",
            code: null,
            messageAr: "لا يكفي دليل لتحديد سبب محتمل.",
          },
          independentEvidence: false,
          assistanceLevel: assistance,
        };
        if (prior)
          await tx.$executeRaw`UPDATE subject_attempts SET revision=${revision},source_raw=${value + " " + unit},answer_json=${JSON.stringify({ value, unit })}::jsonb,verdict=${JSON.stringify(pending)}::jsonb,assistance_level=${assistance},independent=${independent},updated_at=now() WHERE id=${id}::uuid`;
        else
          await tx.$executeRaw`INSERT INTO subject_attempts(id,owner_key,subject_code,problem_revision_id,source_raw,answer_json,verdict,independent,assistance_level) VALUES(${id}::uuid,${owner.ownerKey},'physics',${problemId}::uuid,${value + " " + unit},${JSON.stringify({ value, unit })}::jsonb,${JSON.stringify(pending)}::jsonb,${independent},${assistance})`;
        await tx.$executeRaw`INSERT INTO subject_attempt_events(id,attempt_id,revision,event_kind,result) VALUES(${randomUUID()}::uuid,${id}::uuid,${revision},'answer_submitted',${JSON.stringify({ sourceRaw: value + " " + unit, answer: { value, unit }, status: "pending" })}::jsonb)`;
        return {
          id,
          revision,
          assistance,
          independent,
          reference: problem.payload.physics!,
          pending,
        };
      },
    );
    const currentSubmission = async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      await this.accounts.authorizeInTransaction(tx, owner);
      await requireProductLearningAccess(tx, owner, this.store.syntheticData);
      await requirePhysicsAssignmentCurrent(tx, owner.ownerKey, prepared.id);
      const [current] = await tx.$queryRaw<
        AttemptRow[]
      >`SELECT * FROM subject_attempts WHERE id=${prepared.id}::uuid AND owner_key=${owner.ownerKey} AND subject_code='physics' FOR UPDATE`;
      if (!current || current.revision !== prepared.revision)
        throw new ApiFault(
          409,
          "revision_conflict",
          "تغيّرت المحاولة أثناء التحقق؛ أعد تحميل النتيجة الحالية.",
          [],
          current?.revision ?? null,
        );
      // Read after acquiring the row lock, with a fresh READ COMMITTED snapshot.
      // A completed service_error is distinct from the initial pending verdict.
      const [completion] = await tx.$queryRaw<
        { completed: boolean }[]
      >`SELECT EXISTS(SELECT 1 FROM subject_attempt_events WHERE attempt_id=${prepared.id}::uuid AND revision=${prepared.revision} AND event_kind='verified') AS completed`;
      return {
        ...current,
        verification_completed: completion?.completed === true,
      };
    };
    const completed = await this.store.db.$transaction(async (tx) => {
      const current = await currentSubmission(tx);
      return current.verification_completed ||
        current.verdict.status !== "service_error"
        ? current.verdict
        : null;
    });
    if (completed) return completed;
    let engine: PhysicsResult;
    try {
      engine = await this.gateway.verify(problemId, prepared.reference, {
        value,
        unit,
      });
    } catch {
      return this.store.db.$transaction(async (tx) => {
        const current = await currentSubmission(tx);
        return current.verification_completed
          ? current.verdict
          : prepared.pending;
      });
    }
    return this.store.db.$transaction(async (tx) => {
      const current = await currentSubmission(tx);
      if (
        current.verification_completed ||
        current.verdict.status !== "service_error"
      )
        return current.verdict;
      const result: PhysicsAttempt = {
        ...prepared.pending,
        status: engine.status,
        valueCorrect: engine.valueCorrect,
        unitCorrect: engine.unitCorrect,
        messageAr:
          engine.status === "wrong_unit" && engine.valueCorrect
            ? "القيمة العددية صحيحة، لكن الوحدة تخص كمية أخرى."
            : messages[engine.status],
        diagnosis: {
          state: engine.diagnosisCode ? "possible" : "unresolved",
          code: engine.diagnosisCode,
          messageAr: engine.diagnosisCode
            ? (diagnosisMessages[engine.diagnosisCode] ??
              "السبب المحتمل يحتاج إلى سؤال إضافي.")
            : "لا نستنتج سببًا مفاهيميًا من قيمة خاطئة وحدها.",
        },
        independentEvidence:
          engine.status === "correct" &&
          current.independent &&
          current.assistance_level === 0,
        assistanceLevel: current.assistance_level,
      };
      await tx.$executeRaw`UPDATE subject_attempts SET verdict=${JSON.stringify(result)}::jsonb,updated_at=now() WHERE id=${prepared.id}::uuid AND revision=${prepared.revision}`;
      await tx.$executeRaw`INSERT INTO subject_attempt_events(id,attempt_id,revision,event_kind,result) VALUES(${randomUUID()}::uuid,${prepared.id}::uuid,${prepared.revision},'verified',${JSON.stringify(result)}::jsonb)`;
      await finishPhysicsAssignment(tx, owner.ownerKey, current, result);
      return result;
    });
  }
  async hint(
    request: RequestContext,
    id: string,
    raw: unknown,
  ): Promise<PhysicsHint> {
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["level", "confirmFullSolution", "expectedRevision"]);
    const revision = revisionField(b.expectedRevision),
      level = Number(b.level);
    if (
      typeof b.level !== "number" ||
      ![1, 2, 3, 4].includes(level) ||
      (b.confirmFullSolution !== undefined &&
        typeof b.confirmFullSolution !== "boolean")
    )
      throw productInvalid();
    const currentAttempt = async (tx: Prisma.TransactionClient) => {
      await this.accounts.authorizeInTransaction(tx, owner);
      await requireProductLearningAccess(tx, owner, this.store.syntheticData);
      await requirePhysicsHintAllowed(tx, owner.ownerKey, id);
      const [a] = await tx.$queryRaw<
        AttemptRow[]
      >`SELECT * FROM subject_attempts WHERE id=${id}::uuid AND owner_key=${owner.ownerKey} AND subject_code='physics' FOR UPDATE`;
      if (!a) throw missing();
      if (a.revision !== revision)
        throw new ApiFault(
          409,
          "revision_conflict",
          "تغيّرت المحاولة؛ حدّثها أولًا.",
          [],
          a.revision,
        );
      return a;
    };
    return new RunnerCoordinator(this.store).run(
      owner,
      request,
      "physics.hint:" + uuid(id),
      b,
      {
        prepare: async (tx) => {
          const a = await currentAttempt(tx);
          const p = await this.problem(tx, a.problem_revision_id, true);
          if (p.payload.kind === "transfer")
            throw new ApiFault(
              409,
              "invalid_state",
              "هذا سؤال نقل مستقل؛ أكمل محاولتك دون تلميح.",
            );
          if (
            level === 4
              ? b.confirmFullSolution !== true
              : level > Math.min(a.assistance_level + 1, 3)
          )
            throw new ApiFault(
              409,
              "invalid_state",
              "ابدأ بالتلميح التالي؛ كشف الحل الكامل يحتاج تأكيدًا صريحًا.",
            );
          const hint = p.payload.hints.find(
            (h) => h.level === level && h.reviewed,
          );
          if (!hint)
            throw new ApiFault(
              503,
              "ai_unavailable",
              "لا يتوفر تلميح مراجع بهذا المستوى الآن. بقيت محاولتك محفوظة.",
            );
          return {
            runs: 0,
            snapshot: {
              problemRevisionId: a.problem_revision_id,
              reviewedTextAr: hint.textAr,
              skillCodes: p.payload.skillCodes,
              previousHintLevel: a.assistance_level,
              observationCode: [
                "wrong_value",
                "wrong_unit",
                "correct",
              ].includes(a.verdict.status)
                ? a.verdict.status
                : "unavailable",
            },
          };
        },
        execute: async (snapshot) =>
          level < 4 && snapshot.observationCode !== "unavailable"
            ? composeSubjectHint({
                store: this.store,
                owner,
                subject: "physics",
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
          const next = revision + 1,
            highest = Math.max(a.assistance_level, level);
          const result: PhysicsHint = {
            attemptId: id,
            revision: next,
            level: level as 1 | 2 | 3 | 4,
            textAr: generated ? composed.textAr : snapshot.reviewedTextAr,
            source: generated ? "llm_validated" : "reviewed_template",
            independentEvidence: false,
            reasonAr:
              "لنراجع العلاقة والوحدة تدريجيًا؛ السبب المحتمل ليس حكمًا على فهمك.",
          };
          await tx.$executeRaw`UPDATE subject_attempts SET revision=${next},assistance_level=${highest},independent=false,verdict=jsonb_set(jsonb_set(jsonb_set(verdict,'{independentEvidence}','false'::jsonb),'{assistanceLevel}',${JSON.stringify(highest)}::jsonb),'{revision}',${JSON.stringify(next)}::jsonb),updated_at=now() WHERE id=${id}::uuid`;
          await invalidatePhysicsRootEpisodes(tx, owner.ownerKey, id);
          await tx.$executeRaw`INSERT INTO subject_attempt_events(id,attempt_id,revision,event_kind,result) VALUES(${randomUUID()}::uuid,${id}::uuid,${next},'hint',${JSON.stringify(result)}::jsonb)`;
          return result;
        },
      },
    );
  }
}
@Controller("api/v1/physics")
export class PhysicsController {
  constructor(readonly service: PhysicsService) {}
  @Get("problems") async list(@Req() r: RequestContext) {
    return productEnvelope(r, await this.service.list(r));
  }
  @Get("problems/:id") async detail(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return productEnvelope(r, await this.service.detail(r, id));
  }
  @Get("attempts/:id") async resume(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return productEnvelope(r, await this.service.resume(r, id));
  }
  @Get("attempts/:id/learning") async learning(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return productEnvelope(r, await this.service.learning.current(r, id));
  }
  @Post("attempts/:id/remediation") @HttpCode(200) async remediation(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return productEnvelope(
      r,
      await this.service.learning.assign(r, id, "remediation", b),
    );
  }
  @Post("attempts/:id/transfer") @HttpCode(200) async transfer(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return productEnvelope(
      r,
      await this.service.learning.assign(r, id, "transfer", b),
    );
  }
  @Post("attempts") @HttpCode(200) async submit(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return productEnvelope(r, await this.service.submit(r, b));
  }
  @Post("attempts/:id/hints") @HttpCode(200) async hint(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return productEnvelope(r, await this.service.hint(r, id, b));
  }
}
