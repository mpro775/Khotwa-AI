import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  StemLabBlock,
  StemLabCapabilities,
  StemLabEventKind,
  StemLabResult,
  StemLabSession,
} from "../../../../packages/contracts/src/stem-labs";
import { Store } from "../store";
import { AccountService } from "../accounts";
import { LearningPathContentService } from "../learning-path-content";
import {
  ARecords,
  aMutation,
  aRead,
  aReplay,
  requireAFeature,
  type ARecord,
} from "../intelligent-learning-data";
import { ApiFault, type RequestContext } from "../http";
import { uuid } from "../contracts";
import {
  only,
  productEnvelope,
  productInvalid,
  record,
  revisionField,
  textField,
  type ProductOwner,
} from "../product-core";
import {
  LAB_POLICY,
  LAB_SCHEMA,
  labFeature,
  labMathSources,
  parseLabBlock,
  parsePhysicsActivity,
  publicLabActivity,
} from "./lab-registry";
import { normalizedLearningEquation } from "../learning-assessments";
import { applyLabEvent, validateLabAnswer, type LabData } from "./lab-state";
import {
  generateLinearGraph,
  revealMathActivity,
  validateMathLabSpec,
  verifyMathLabSubmission,
} from "./math-lab";
import { simulatePhysicsModel } from "./physics-inquiry";
import { gradeCodingSubmission, revealCodingTrace } from "./coding-lab";
import {
  mergeLabExposures,
  physicsLabContextKeys,
  readLabExposures,
} from "./lab-exposure";
import { physicsExposureKey } from "../physics-learning";
import type { ContentPayload } from "../../../../packages/contracts/src/product";
import type { MathPort } from "../math-gateway";

type Tx = Prisma.TransactionClient;
const missing = () => new ApiFault(404, "not_found", "النشاط غير متاح.");
const stale = (revision?: number) =>
  new ApiFault(
    409,
    "revision_conflict",
    "تغير النشاط أثناء الطلب؛ حدّثه وأعد المحاولة.",
    [],
    revision ?? null,
  );
const neutral = (reasonCode: string): StemLabResult => ({
  result: "cannot_determine",
  domainVerifier: "domain_unavailable",
  reasonCode,
  feedbackAr: "لم نتمكن من التحقق آليًا؛ إجابتك محفوظة، ولم نعتبرها خطأ.",
  evidenceClass: "learning_only",
});

export class StemLabService {
  private readonly buckets = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly content: LearningPathContentService,
  ) {}
  private async owner(request: RequestContext, write = false) {
    const owner = await this.accounts.actor(request, write);
    return owner;
  }
  private limit(owner: ProductOwner) {
    const now = Date.now();
    for (const [key, b] of this.buckets)
      if (b.until <= now) this.buckets.delete(key);
    let b = this.buckets.get(owner.ownerKey);
    if (!b) {
      if (this.buckets.size >= 10000)
        throw new ApiFault(429, "rate_limited", "أعد المحاولة لاحقًا.");
      b = { count: 0, until: now + 60000 };
      this.buckets.set(owner.ownerKey, b);
    }
    if (++b.count > 120)
      throw new ApiFault(429, "rate_limited", "انتظر قليلًا ثم أعد المحاولة.");
  }
  async capabilities(request: RequestContext): Promise<StemLabCapabilities> {
    const owner = await this.owner(request);
    return aRead(this.store, owner, async () => ({
      schemaVersion: LAB_SCHEMA,
      math: process.env.MATH_LAB_ENABLED === "true",
      physics: process.env.PHYSICS_LAB_ENABLED === "true",
      codingNonExecuting: process.env.CODING_LAB_NONEXEC_ENABLED === "true",
      runnerBridge: false,
      phet: false,
      reasonCode: "synthetic_review_required",
    }));
  }
  private async specification(
    tx: Tx,
    lessonId: string,
    blockIndex: number,
    pinned = false,
    expectedHash?: string,
  ) {
    const row = await this.content.row(lessonId, tx);
    if (
      row.payload.kind !== "lesson" ||
      !row.reviewed_at ||
      !row.published_at ||
      !(row.status === "published" || (pinned && row.status === "archived"))
    )
      throw missing();
    if (expectedHash && row.content_hash !== expectedHash) throw stale();
    const block = row.payload.contentBlocks[blockIndex];
    if (block?.type !== "subject_lab_activity") throw missing();
    const lab = parseLabBlock(block.lab, row.payload.subject);
    requireAFeature(labFeature(lab.subject));
    return { row, lab };
  }
  private async exposure(
    tx: Tx,
    owner: ProductOwner,
    lessonId: string,
    lab: StemLabBlock,
    parameters?: Record<string, number>,
  ) {
    await tx.$executeRaw`INSERT INTO learning_lesson_events(id,owner_key,lesson_revision_id,event_kind) SELECT ${randomUUID()}::uuid,${owner.ownerKey},${lessonId}::uuid,'lesson_started' WHERE NOT EXISTS(SELECT 1 FROM learning_lesson_events WHERE owner_key=${owner.ownerKey} AND lesson_revision_id=${lessonId}::uuid AND event_kind='lesson_started')`;
    const sources = new Set(
      labMathSources(lab).map(normalizedLearningEquation),
    );
    const contexts = new Set(physicsLabContextKeys(lab, parameters));
    const pending = await tx.$queryRaw<
      {
        id: string;
        assessment_id: string;
        family: string;
        raw: string | null;
        physics: ContentPayload["physics"] | null;
        attempt_id: string | null;
        subject_attempt_id: string | null;
      }[]
    >`SELECT i.id,i.assessment_id,i.attempt_id,i.subject_attempt_id,i.problem_snapshot->>'familyCode' AS family,i.problem_snapshot->>'equationRaw' AS raw,sr.payload->'physics' AS physics FROM learning_assessment_items i JOIN learning_assessments a ON a.id=i.assessment_id LEFT JOIN studio_revisions sr ON sr.id=i.problem_revision_id WHERE a.owner_key=${owner.ownerKey} AND a.subject_code=${lab.subject} AND i.measurement_exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM attempts att JOIN verification_reports vr ON vr.attempt_id=att.id AND vr.attempt_revision=att.revision WHERE att.id=i.attempt_id AND vr.scope='current_sequence' AND vr.dispatch_status='finished' AND vr.report_json->>'isCurrent'='true' AND ((vr.report_json->'completion'->>'canMarkAttemptCompleted')='true' OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(vr.report_json->'transitions','[]'::jsonb)) t WHERE t->>'mathStatus'='verified_invalid'))) AND NOT EXISTS(SELECT 1 FROM subject_attempts sa WHERE sa.id=i.subject_attempt_id AND sa.verdict->>'status' IN ('correct','wrong_value','wrong_unit')) FOR UPDATE OF i,a`;
    const affected = new Set<string>();
    for (const item of pending)
      if (
        item.family === lab.familyCode ||
        (item.raw && sources.has(normalizedLearningEquation(item.raw))) ||
        (item.physics &&
          contexts.has(physicsExposureKey({ physics: item.physics })))
      ) {
        await tx.$executeRaw`UPDATE learning_assessment_items SET measurement_exited_at=now() WHERE id=${item.id}::uuid`;
        if (item.attempt_id)
          await tx.$executeRaw`UPDATE attempts SET independent_evidence_eligible=false,assistance_revision=assistance_revision+1 WHERE id=${item.attempt_id}::uuid`;
        if (item.subject_attempt_id)
          await tx.$executeRaw`UPDATE subject_attempts SET independent=false,assistance_level=GREATEST(assistance_level,1) WHERE id=${item.subject_attempt_id}::uuid AND owner_key=${owner.ownerKey}`;
        affected.add(item.assessment_id);
      }
    for (const id of affected)
      await tx.$executeRaw`UPDATE learning_assessments SET revision=revision+1 WHERE id=${id}::uuid`;
  }
  async activity(request: RequestContext, rawId: string, rawIndex: string) {
    const owner = await this.owner(request);
    const id = uuid(rawId);
    if (!/^\d{1,2}$/.test(rawIndex ?? "")) throw productInvalid();
    const index = Number(rawIndex);
    return aRead(this.store, owner, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      const { lab } = await this.specification(tx, id, index);
      await this.exposure(tx, owner, id, lab);
      return publicLabActivity(lab, id, index);
    });
  }
  private parameters(lab: StemLabBlock): Record<string, number> {
    if (lab.subject === "physics")
      return {
        ...parsePhysicsActivity(lab.domainSpec).model.parameters,
      } as Record<string, number>;
    const s =
      lab.subject === "algebra" ? validateMathLabSpec(lab.domainSpec) : null;
    return s?.kind === "math_linear_graph_v1"
      ? { a: s.model.a, b: s.model.b }
      : {};
  }
  private artifact(
    lab: StemLabBlock,
    data: LabData,
  ): Record<string, unknown> | null {
    if (lab.subject === "physics")
      return data.resultRevealed
        ? (simulatePhysicsModel({
            ...parsePhysicsActivity(lab.domainSpec).model,
            parameters: data.parameters,
          }) as unknown as Record<string, unknown>)
        : null;
    if (lab.subject === "algebra") {
      const spec = validateMathLabSpec(lab.domainSpec);
      if (spec.kind === "math_linear_graph_v1")
        return generateLinearGraph({ ...spec.model, ...data.parameters });
      return data.resultRevealed ? revealMathActivity(spec) : null;
    }
    if (data.traceRevealedCount)
      return {
        traceSteps: Array.from({ length: data.traceRevealedCount }, (_, i) =>
          revealCodingTrace(lab.domainSpec, i),
        ),
      };
    // Closed rubrics stay server-only even after a generic support request.
    return null;
  }
  private async dto(tx: Tx, row: ARecord<LabData>): Promise<StemLabSession> {
    const d = row.data;
    const { lab, row: lesson } = await this.specification(
      tx,
      d.lessonRevisionId,
      d.blockIndex,
      true,
      d.contentHash,
    );
    let available = false;
    if (
      d.subject !== "programming" &&
      lesson.status === "published" &&
      lesson.payload.kind === "lesson" &&
      lesson.payload.assessmentProblemRevisionIds.length
    ) {
      const refs = await this.content.bank(
          d.subject,
          lesson.payload.assessmentProblemRevisionIds,
          tx,
        ),
        labs = await readLabExposures(tx, row.owner_key, d.subject),
        prior = await tx.$queryRaw<
          {
            problem_snapshot: {
              familyCode: string;
              revisionId: string;
              equationRaw?: string;
            };
          }[]
        >`SELECT i.problem_snapshot FROM learning_assessment_items i JOIN learning_assessments a ON a.id=i.assessment_id WHERE a.owner_key=${row.owner_key}`;
      const sources = new Set(
        lesson.payload.contentBlocks
          .flatMap((b) => [
            b.raw ?? "",
            ...(b.steps ?? []).map((s) => s.raw),
            ...labMathSources(b.lab),
          ])
          .filter(Boolean)
          .map(normalizedLearningEquation),
      );
      const physics =
        d.subject === "physics"
          ? await tx.$queryRaw<
              { id: string; payload: ContentPayload }[]
            >`SELECT id,payload FROM studio_revisions WHERE status='published' AND payload->>'subject'='physics'`
          : [];
      available = refs.some(
        (p) =>
          p.kind === "main" &&
          !labs.some((l) => l.family === p.familyCode) &&
          !prior.some(
            (v) =>
              v.problem_snapshot.revisionId === p.revisionId ||
              v.problem_snapshot.familyCode === p.familyCode,
          ) &&
          (!p.equationRaw ||
            !sources.has(normalizedLearningEquation(p.equationRaw))) &&
          (d.subject !== "physics" ||
            (() => {
              const reference = physics.find((v) => v.id === p.revisionId);
              return (
                !!reference &&
                !labs.some((l) =>
                  l.contexts.some(
                    (c) => c.key === physicsExposureKey(reference.payload),
                  ),
                )
              );
            })()),
      );
    }
    return {
      id: row.id,
      revision: row.revision,
      trackRevisionId: d.trackRevisionId,
      lessonRevisionId: d.lessonRevisionId,
      blockIndex: d.blockIndex,
      subject: d.subject,
      labKind: d.labKind,
      stage: d.stage,
      activity: publicLabActivity(lab, d.lessonRevisionId, d.blockIndex),
      prediction: d.prediction,
      parameters: d.parameters,
      observation: d.observation,
      explanation: d.explanation,
      assistanceLevel: d.assistanceLevel,
      resultRevealed: d.resultRevealed,
      artifact: this.artifact(lab, d),
      result: d.result,
      answer: d.answer,
      evidenceClass: "learning_only",
      transfer: {
        available,
        reasonCode:
          d.subject === "programming"
            ? "runner_gate_blocked"
            : available
              ? "assessment_service_rechecks_novelty"
              : "insufficient_novel_bank",
      },
    };
  }
  async start(request: RequestContext, raw: unknown) {
    const owner = await this.owner(request, true),
      b = record(raw);
    only(b, ["trackRevisionId", "lessonRevisionId", "blockIndex"]);
    const trackId = uuid(textField(b.trackRevisionId, 36)),
      lessonId = uuid(textField(b.lessonRevisionId, 36)),
      index = revisionField(b.blockIndex);
    if (index > 49) throw productInvalid();
    await aRead(this.store, owner, (tx) =>
      this.specification(tx, lessonId, index),
    );
    this.limit(owner);
    return aMutation(this.store, owner, request, "lab.start", b, async (tx) => {
      const track = await this.content.row(trackId, tx);
      if (
        track.status !== "published" ||
        track.payload.kind !== "track" ||
        !track.payload.units.some((u) => u.lessonRevisionIds.includes(lessonId))
      )
        throw missing();
      const { row, lab } = await this.specification(tx, lessonId, index);
      if (track.payload.subject !== lab.subject) throw missing();
      await this.exposure(tx, owner, lessonId, lab);
      const data: LabData = {
        trackRevisionId: trackId,
        lessonRevisionId: lessonId,
        blockIndex: index,
        contentHash: row.content_hash,
        policyVersion: LAB_POLICY,
        familyCode: lab.familyCode,
        contextExposures: mergeLabExposures(
          [],
          physicsLabContextKeys(lab, this.parameters(lab)),
        ),
        subject: lab.subject,
        labKind: lab.labKind,
        stage: "opened",
        prediction: null,
        parameters: this.parameters(lab),
        observation: null,
        explanation: null,
        assistanceLevel: lab.labKind === "math_completion_v1" ? 1 : 0,
        resultRevealed: false,
        traceRevealedCount: 0,
        eventCount: 0,
        lastEvent: "lab_opened",
        answer: null,
        result: null,
        domainVerification: [],
      };
      return this.dto(
        tx,
        await new ARecords(tx, owner.ownerKey).create("lab", trackId, data),
      );
    });
  }
  async get(request: RequestContext, id: string) {
    const owner = await this.owner(request);
    return aRead(this.store, owner, async (tx) =>
      this.dto(
        tx,
        await new ARecords(tx, owner.ownerKey).get<LabData>(uuid(id), "lab"),
      ),
    );
  }
  async event(request: RequestContext, id: string, raw: unknown) {
    const owner = await this.owner(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "eventKind", "payload"]);
    const expected = revisionField(b.expectedRevision),
      kind = textField(b.eventKind, 60) as StemLabEventKind;
    uuid(id);
    await aRead(this.store, owner, async (tx) => {
      const row = await new ARecords(tx, owner.ownerKey).get<LabData>(
        id,
        "lab",
      );
      await this.specification(
        tx,
        row.data.lessonRevisionId,
        row.data.blockIndex,
        true,
        row.data.contentHash,
      );
    });
    this.limit(owner);
    return aMutation(
      this.store,
      owner,
      request,
      "lab.event:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<LabData>(id, "lab");
        if (row.revision !== expected) throw stale(row.revision);
        const { lab } = await this.specification(
          tx,
          row.data.lessonRevisionId,
          row.data.blockIndex,
          true,
          row.data.contentHash,
        );
        if (
          kind === "simulation_parameter_changed" &&
          lab.subject === "physics" &&
          parsePhysicsActivity(lab.domainSpec).privateValidation
        )
          throw productInvalid(
            "سؤال القيمة والوحدة ثابت؛ افتح تجربة المعاملات لتغييرها.",
          );
        const next = applyLabEvent(row.data, kind, b.payload);
        this.artifact(lab, next); // Validate bounded parameters/trace before saving.
        next.contextExposures = mergeLabExposures(
          next.contextExposures,
          physicsLabContextKeys(lab, next.parameters),
        );
        if (kind === "simulation_parameter_changed")
          await this.exposure(
            tx,
            owner,
            row.data.lessonRevisionId,
            lab,
            next.parameters,
          );
        return this.dto(tx, await records.update(id, "lab", expected, next));
      },
    );
  }
  private async verify(
    data: LabData,
    lab: StemLabBlock,
    id: string,
    revision: number,
    capture: (report: Record<string, unknown>) => void,
  ): Promise<StemLabResult> {
    if (lab.subject === "algebra") {
      const traced: MathPort = {
        parse: (...args) => this.content.math.parse(...args),
        verify: async (...args) => {
          const report = await this.content.math.verify(...args);
          capture(report as unknown as Record<string, unknown>);
          return report;
        },
        checkFinal: async (...args) => {
          const report = await this.content.math.checkFinal(...args);
          capture(report as unknown as Record<string, unknown>);
          return report;
        },
      };
      return verifyMathLabSubmission(
        validateMathLabSpec(lab.domainSpec),
        data.answer,
        traced,
        {
          attemptId: id,
          attemptRevision: revision,
          problemRevisionId: data.lessonRevisionId,
          notationProfile: "ar-mashriq-school-v1",
          domain: "reals",
        },
      );
    }
    if (lab.subject === "programming") {
      const checked = gradeCodingSubmission(lab.domainSpec, data.answer);
      return {
        result: checked.status,
        domainVerifier: checked.domainVerifier,
        reasonCode: checked.reasonCode,
        feedbackAr: checked.feedbackAr,
        evidenceClass: "learning_only",
      };
    }
    const spec = parsePhysicsActivity(lab.domainSpec),
      answer = record(data.answer);
    if (spec.privateValidation) {
      only(answer, ["value", "unit"]);
      const result = await this.content.physics.verify(
        data.lessonRevisionId,
        spec.privateValidation.reference,
        {
          value: textField(answer.value, 80),
          unit: textField(answer.unit, 16),
        },
      );
      capture(result as unknown as Record<string, unknown>);
      return {
        result:
          result.status === "correct"
            ? "correct_practice"
            : ["wrong_value", "wrong_unit"].includes(result.status)
              ? "incorrect_practice"
              : "cannot_determine",
        domainVerifier: result.engineVersion,
        reasonCode: result.reasonCode,
        feedbackAr:
          result.status === "correct"
            ? "القيمة والوحدة مناسبتان لهذا السؤال التدريبي؛ القياس المستقل يحتاج مهمة جديدة."
            : ["wrong_value", "wrong_unit"].includes(result.status)
              ? "راجع القيمة والوحدة؛ لا نستنتج سبب الخطأ من إجابة واحدة."
              : "تعذر التحقق؛ إجابتك محفوظة دون حكم على فهمك.",
        evidenceClass: "learning_only",
      };
    }
    only(answer, ["observationAr", "explanationAr"]);
    if (
      answer.observationAr === undefined &&
      answer.explanationAr === undefined
    )
      throw productInvalid();
    for (const value of Object.values(answer)) textField(value, 1000);
    return {
      result: "needs_review",
      domainVerifier: "reflection_not_graded_v1",
      reasonCode: "OPEN_EXPLANATION_REQUIRES_REVIEW",
      feedbackAr:
        "حُفظ تفسيرك للمقارنة مع التجربة؛ النص الحر لا يمنح حكم صحة أو إتقانًا مستقلًا.",
      evidenceClass: "learning_only",
    };
  }
  async submit(request: RequestContext, id: string, raw: unknown) {
    const owner = await this.owner(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "answer"]);
    uuid(id);
    const expected = revisionField(b.expectedRevision),
      answer = validateLabAnswer(b.answer);
    await aRead(this.store, owner, async (tx) => {
      const row = await new ARecords(tx, owner.ownerKey).get<LabData>(
        id,
        "lab",
      );
      await this.specification(
        tx,
        row.data.lessonRevisionId,
        row.data.blockIndex,
        true,
        row.data.contentHash,
      );
    });
    const replay = await aReplay<StemLabSession>(
      this.store,
      owner,
      request,
      "lab.submit:" + id,
      b,
    );
    if (replay) return replay;
    this.limit(owner);
    // Persist the draft in a short transaction. Domain services never run while holding DB locks.
    const saved = await aMutation(
      this.store,
      owner,
      request,
      "lab.prepare-submit:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<LabData>(id, "lab");
        if (row.revision !== expected) throw stale(row.revision);
        await this.specification(
          tx,
          row.data.lessonRevisionId,
          row.data.blockIndex,
          true,
          row.data.contentHash,
        );
        if (row.data.subject === "physics" && !row.data.resultRevealed)
          throw new ApiFault(
            409,
            "invalid_state",
            "سجل توقعك وراقب التجربة قبل التسليم.",
          );
        if (row.data.eventCount >= 200)
          throw new ApiFault(429, "rate_limited", "بلغ النشاط حد التفاعلات.");
        return records.update(id, "lab", expected, {
          ...row.data,
          answer,
          result: null,
          domainVerification: [],
          lastEvent: "submission_saved",
          eventCount: row.data.eventCount + 1,
        });
      },
    );
    const { lab } = await aRead(this.store, owner, (tx) =>
      this.specification(
        tx,
        saved.data.lessonRevisionId,
        saved.data.blockIndex,
        true,
        saved.data.contentHash,
      ),
    );
    let result: StemLabResult;
    let domainVerification: Record<string, unknown>[] = [];
    try {
      result = await this.verify(
        saved.data,
        lab,
        id,
        saved.revision,
        (report) => domainVerification.push(report),
      );
      if (Buffer.byteLength(JSON.stringify(domainVerification)) > 24000) {
        domainVerification = [];
        result = neutral("VERIFICATION_EVIDENCE_LIMIT");
      }
    } catch (e) {
      if (e instanceof ApiFault && e.status < 500) throw e;
      if (lab.subject === "programming")
        throw productInvalid("راجع حقول إجابة النشاط.");
      result = neutral("DOMAIN_SERVICE_UNAVAILABLE");
    }
    return aMutation(
      this.store,
      owner,
      request,
      "lab.submit:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<LabData>(id, "lab");
        if (
          row.revision !== saved.revision ||
          row.data.contentHash !== saved.data.contentHash
        )
          throw stale(row.revision);
        await this.specification(
          tx,
          row.data.lessonRevisionId,
          row.data.blockIndex,
          true,
          row.data.contentHash,
        );
        return this.dto(
          tx,
          await records.update(id, "lab", row.revision, {
            ...row.data,
            result,
            domainVerification,
            stage: "submitted",
            lastEvent:
              result.result === "cannot_determine"
                ? "domain_abstained"
                : "submission_verified",
          }),
        );
      },
    );
  }
}

@Controller("api/v1/learning/labs")
export class StemLabController {
  constructor(readonly labs: StemLabService) {}
  @Get("capabilities") capabilities(@Req() r: RequestContext) {
    return this.labs.capabilities(r).then((d) => productEnvelope(r, d));
  }
  @Get("activities/:id") activity(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Query("blockIndex") i: string,
  ) {
    return this.labs.activity(r, id, i).then((d) => productEnvelope(r, d));
  }
  @Post("sessions") @HttpCode(200) start(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.labs.start(r, b).then((d) => productEnvelope(r, d));
  }
  @Get("sessions/:id") session(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.labs.get(r, id).then((d) => productEnvelope(r, d));
  }
  @Post("sessions/:id/events") @HttpCode(200) event(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.labs.event(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Post("sessions/:id/submit") @HttpCode(200) submit(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.labs.submit(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Get("sessions/:id/result") result(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.labs.get(r, id).then((d) => productEnvelope(r, d));
  }
}
