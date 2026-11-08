import { createHash } from "node:crypto";
import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  ActivityAlternative,
  LearningActivity,
  NextActivityDecision,
  MasteryResponse,
} from "../../../packages/contracts/src/intelligent-learning";
import { AccountService } from "./accounts";
import { Store, type GuestAuth } from "./store";
import { DiagnosisService } from "./diagnosis";
import { ApiFault, type RequestContext } from "./http";
import { uuid, output } from "./contracts";
import {
  observeTransition,
  contextualHypothesis,
  type VerifiedContextTransition,
} from "./diagnosis-rules";
import {
  productEnvelope,
  productInvalid,
  record,
  only,
  textField,
  revisionField,
} from "./product-core";
import { LearningAssessmentService } from "./learning-assessments";
import {
  ARecords,
  aRead,
  aMutation,
  requireAFeature,
  type ARecord,
} from "./intelligent-learning-data";
import { PedagogyContextResolver } from "./pedagogy-context";
import {
  decideActivity,
  activityReason,
  PEDAGOGY_POLICY,
} from "./pedagogy-engine";
import { MASTERY_MODEL } from "./mastery-model";
import { diagnosisProjection, diagnosisReviewBlocked } from "./deep-diagnosis";

type DecisionData = Omit<
  NextActivityDecision,
  "id" | "decisionId" | "revision"
> & {
  acceptedActivityId: string | null;
  acceptedAlternativeIndex: number | null;
};
type ActivityData = Omit<LearningActivity, "id" | "revision">;
const decisionDto = (row: ARecord<DecisionData>): NextActivityDecision => {
  const {
    acceptedActivityId: _,
    acceptedAlternativeIndex: __,
    ...data
  } = row.data;
  void _;
  void __;
  return { ...data, id: row.id, decisionId: row.id, revision: row.revision };
};
const activityDto = (row: ARecord<ActivityData>): LearningActivity => ({
  ...row.data,
  id: row.id,
  revision: row.revision,
});
const notFound = () => new ApiFault(404, "not_found", "المورد غير متاح.");
const stale = () =>
  new ApiFault(
    409,
    "stale_decision",
    "تغيرت الأدلة أو المحتوى؛ اطلب نشاطًا جديدًا.",
  );
const childRequest = (request: RequestContext, id: string): RequestContext => ({
  ...request,
  headers: {
    ...request.headers,
    "idempotency-key": createHash("sha256")
      .update("intelligent-activity-assessment:" + id)
      .digest("hex"),
  },
});

export class IntelligentLearningService {
  readonly resolver: PedagogyContextResolver;
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly assessments: LearningAssessmentService,
    readonly diagnosis: DiagnosisService,
    readonly now: () => Date = () => new Date(),
  ) {
    this.resolver = new PedagogyContextResolver(assessments);
  }
  private async identity(request: RequestContext, write = false) {
    const owner = await this.accounts.actor(request, write),
      auth = await this.store.authenticate(request);
    if (!auth) throw notFound();
    return { owner, auth };
  }
  async nextActivity(
    request: RequestContext,
    trackId: string,
  ): Promise<NextActivityDecision> {
    requireAFeature("PEDAGOGY_ENGINE_ENABLED");
    const { owner, auth } = await this.identity(request),
      id = uuid(trackId),
      now = this.now();
    return aRead(this.store, owner, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      const context = await this.resolver.resolve(
          request,
          id,
          { tx, owner, auth },
          now,
        ),
        records = new ARecords(tx, owner.ownerKey),
        old = (await records.list<DecisionData>("decision", id)).find(
          (d) =>
            d.data.evidenceFingerprint === context.evidenceFingerprint &&
            d.data.policyVersion === PEDAGOGY_POLICY &&
            !d.data.acceptedActivityId &&
            Date.parse(d.data.expiresAt) > now.getTime(),
        );
      if (old) return decisionDto(old);
      const result = decideActivity(context.candidates),
        chosen = result.chosen,
        alternative = (c: NonNullable<typeof chosen>): ActivityAlternative => ({
          ...(c.advancedActivity
            ? { advancedActivity: c.advancedActivity }
            : {}),
          ...(c.labKind
            ? { labKind: c.labKind, labBlockIndex: c.labBlockIndex }
            : {}),
          activityKind: c.activityKind,
          lessonRevisionId: c.lessonRevisionId,
          skillCode: c.skillCode,
          reasonCode: c.reasonCode,
        });
      const data: DecisionData = {
        ...(chosen?.advancedActivity
          ? { advancedActivity: chosen.advancedActivity }
          : {}),
        ...(chosen?.labKind
          ? { labKind: chosen.labKind, labBlockIndex: chosen.labBlockIndex }
          : {}),
        trackRevisionId: id,
        policyVersion: PEDAGOGY_POLICY,
        evidenceFingerprint: context.evidenceFingerprint,
        mappingSnapshotHash: context.graph.mappingSnapshotHash,
        activityKind: chosen?.activityKind ?? "no_safe_activity",
        lessonRevisionId: chosen?.lessonRevisionId ?? null,
        skillCode: chosen?.skillCode ?? null,
        sourceAttemptId: chosen?.sourceAttemptId ?? null,
        reasonCode: chosen?.reasonCode ?? "no_safe_activity",
        reasonAr: activityReason(chosen?.reasonCode ?? "no_safe_activity"),
        alternatives: result.alternatives.slice(0, 12).map(alternative),
        expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
        acceptedActivityId: null,
        acceptedAlternativeIndex: null,
      };
      return decisionDto(await records.create("decision", id, data));
    });
  }
  async accept(
    request: RequestContext,
    raw: unknown,
  ): Promise<LearningActivity> {
    requireAFeature("PEDAGOGY_ENGINE_ENABLED");
    const { owner, auth } = await this.identity(request, true),
      body = record(raw);
    only(body, ["decisionId", "expectedRevision", "alternativeIndex"]);
    const id = uuid(textField(body.decisionId, 36)),
      expected = revisionField(body.expectedRevision),
      index =
        body.alternativeIndex === undefined
          ? null
          : revisionField(body.alternativeIndex);
    return aMutation(
      this.store,
      owner,
      request,
      "activity.accept",
      body,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<DecisionData>(id, "decision");
        if (row.data.acceptedActivityId) {
          if (row.data.acceptedAlternativeIndex !== index) throw stale();
          return activityDto(
            await records.get<ActivityData>(
              row.data.acceptedActivityId,
              "activity",
            ),
          );
        }
        if (
          row.revision !== expected ||
          Date.parse(row.data.expiresAt) <= this.now().getTime()
        )
          throw stale();
        const context = await this.resolver.resolve(
          request,
          row.track_revision_id,
          { tx, owner, auth },
          this.now(),
        );
        if (
          context.evidenceFingerprint !== row.data.evidenceFingerprint ||
          context.graph.mappingSnapshotHash !== row.data.mappingSnapshotHash
        )
          throw stale();
        const choice = index === null ? row.data : row.data.alternatives[index];
        if (
          !choice ||
          choice.activityKind === "no_safe_activity" ||
          !choice.lessonRevisionId ||
          !choice.skillCode
        )
          throw new ApiFault(
            409,
            "no_safe_activity",
            "لا يوجد نشاط آمن صالح للبدء.",
          );
        const eligible = decideActivity(context.candidates);
        const candidate = [eligible.chosen, ...eligible.alternatives].find(
          (c) =>
            c?.activityKind === choice.activityKind &&
            c.lessonRevisionId === choice.lessonRevisionId &&
            c.skillCode === choice.skillCode &&
            c.labKind === choice.labKind &&
            c.labBlockIndex === choice.labBlockIndex &&
            c.advancedActivity?.kind === choice.advancedActivity?.kind &&
            c.advancedActivity?.blockIndex ===
              choice.advancedActivity?.blockIndex,
        );
        if (!candidate) throw stale();
        const activity = await records.create<ActivityData>(
          "activity",
          row.track_revision_id,
          {
            ...(candidate.advancedActivity
              ? { advancedActivity: candidate.advancedActivity }
              : {}),
            ...(candidate.labKind
              ? {
                  labKind: candidate.labKind,
                  labBlockIndex: candidate.labBlockIndex,
                }
              : {}),
            decisionId: row.id,
            trackRevisionId: row.track_revision_id,
            activityKind: candidate.activityKind,
            lessonRevisionId: candidate.lessonRevisionId,
            skillCode: candidate.skillCode,
            sourceAttemptId: candidate.sourceAttemptId ?? null,
            status: "active",
            assessmentId: null,
            assistanceLevel: 0,
            createdAt: this.now().toISOString(),
          },
          row.id,
        );
        await records.update(row.id, "decision", row.revision, {
          ...row.data,
          acceptedActivityId: activity.id,
          acceptedAlternativeIndex: index,
        });
        return activityDto(activity);
      },
    );
  }
  async getActivity(request: RequestContext, id: string) {
    requireAFeature("PEDAGOGY_ENGINE_ENABLED");
    const { owner } = await this.identity(request);
    const activity = await aRead(this.store, owner, async (tx) =>
      activityDto(
        await new ARecords(tx, owner.ownerKey).get<ActivityData>(
          uuid(id),
          "activity",
        ),
      ),
    );
    if (!activity.assessmentId) return activity;
    // Native state is authoritative after answers/help, including help requested
    // from another UI surface; a stored activity is not a second grade ledger.
    const assessment = await this.assessments.get(
      request,
      activity.assessmentId,
    );
    return {
      ...activity,
      status:
        assessment.status === "completed"
          ? ("completed" as const)
          : ("active" as const),
      assistanceLevel: Math.max(
        0,
        ...assessment.questions.map((question) =>
          Math.max(question.supportLevel, question.independent ? 0 : 1),
        ),
      ),
    };
  }
  async startAssessment(request: RequestContext, id: string, raw: unknown) {
    requireAFeature("PEDAGOGY_ENGINE_ENABLED");
    const { owner } = await this.identity(request, true),
      body = record(raw);
    only(body, ["expectedRevision"]);
    const expected = revisionField(body.expectedRevision),
      activity = await this.getActivity(request, uuid(id));
    if (activity.assessmentId)
      return {
        activity,
        assessment: await this.assessments.get(request, activity.assessmentId),
      };
    if (activity.revision !== expected) throw stale();
    if (activity.labKind || activity.advancedActivity)
      throw productInvalid(
        "افتح المختبر من الدرس؛ القياس المستقل يبدأ بمهمة جديدة من خدمة التقييم.",
      );
    if (
      !activity.lessonRevisionId ||
      ![
        "guided_practice",
        "independent_check",
        "challenge",
        "retrieval_review",
      ].includes(activity.activityKind)
    )
      throw productInvalid(
        "هذا النشاط يفتح الدرس أو سؤال التشخيص، وليس تقييمًا.",
      );
    const assessment = await this.assessments.start(
      childRequest(request, activity.id),
      {
        trackRevisionId: activity.trackRevisionId,
        lessonRevisionId: activity.lessonRevisionId,
        kind:
          activity.activityKind === "guided_practice"
            ? "practice"
            : activity.activityKind === "retrieval_review"
              ? "retrieval_review"
              : "independent_check",
      },
    );
    const linked = await aMutation(
      this.store,
      owner,
      request,
      "activity.assessment:" + activity.id,
      body,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<ActivityData>(activity.id, "activity");
        if (row.data.assessmentId) {
          if (row.data.assessmentId !== assessment.id) throw stale();
          return activityDto(row);
        }
        return activityDto(
          await records.update(row.id, "activity", expected, {
            ...row.data,
            assessmentId: assessment.id,
          }),
        );
      },
    );
    return { activity: linked, assessment };
  }
  async mastery(
    request: RequestContext,
    trackId: string,
  ): Promise<MasteryResponse> {
    requireAFeature("MASTERY_PROJECTION_ENABLED");
    const { owner, auth } = await this.identity(request),
      now = this.now();
    return aRead(this.store, owner, async (tx) => {
      const c = await this.resolver.resolve(
        request,
        uuid(trackId),
        { tx, owner, auth },
        now,
      );
      return {
        trackRevisionId: c.track.id,
        modelVersion: MASTERY_MODEL,
        evidenceFingerprint: c.evidenceFingerprint,
        computedAt: now.toISOString(),
        skills: c.projection,
      };
    });
  }
  async knowledgeGraph(request: RequestContext, trackId: string) {
    requireAFeature("KNOWLEDGE_GRAPH_A_ENABLED");
    const { owner, auth } = await this.identity(request);
    return aRead(
      this.store,
      owner,
      async (tx) =>
        (
          await this.resolver.resolve(
            request,
            uuid(trackId),
            { tx, owner, auth },
            this.now(),
          )
        ).graph,
    );
  }
  private async diagnosisContext(
    tx: Prisma.TransactionClient,
    auth: GuestAuth,
    attemptId: string,
  ) {
    const attempt = await this.store.readAttemptInTransaction(
      tx,
      auth,
      uuid(attemptId),
    );
    const [row] = await tx.$queryRaw<
      {
        verification_result_id: string;
        candidate_json: { errorCode?: string; state?: string };
        basis_json: { candidates?: string[]; family?: string };
        probe_id: string | null;
        result_json: {
          diagnosis?: { errorCode?: string; state?: string };
        } | null;
        template_reviewed: boolean;
      }[]
    >`SELECT d.verification_result_id,d.candidate_json,d.basis_json,p.id AS probe_id,r.result_json,(t.enabled AND t.is_synthetic AND t.review_status='reviewed' AND t.reviewed_at IS NOT NULL AND t.reviewed_by_role IS NOT NULL AND EXISTS(SELECT 1 FROM misconception_catalog c WHERE c.release_id=d.release_id AND c.error_code=d.candidate_json->>'errorCode' AND c.enabled AND c.is_synthetic AND c.review_status='reviewed' AND c.reviewed_at IS NOT NULL AND c.reviewed_by_role IS NOT NULL)) AS template_reviewed FROM current_diagnoses d LEFT JOIN diagnostic_templates t ON t.id=d.template_id LEFT JOIN diagnostic_probes p ON p.diagnosis_id=d.id LEFT JOIN probe_responses r ON r.probe_id=p.id WHERE d.attempt_id=${attempt.id}::uuid AND d.attempt_revision=${attempt.revision} ORDER BY d.created_at DESC LIMIT 1`;
    const [report] = await tx.$queryRaw<
      { report_json: unknown }[]
    >`SELECT report_json FROM verification_reports WHERE attempt_id=${attempt.id}::uuid AND attempt_revision=${attempt.revision} AND scope='current_sequence' AND dispatch_status='finished' ORDER BY finished_at DESC,id DESC LIMIT 1`;
    const parsedReport = report
      ? output("VerificationReport", report.report_json)
      : null;
    const status =
      parsedReport?.transitions?.find((t) => t.mathStatus !== "verified_valid")
        ?.mathStatus ?? "inconclusive";
    const map = await this.assessments.content.skillMap(tx, true);
    return { attempt, row, status, map, report: parsedReport };
  }
  async deepDiagnosis(request: RequestContext, attemptId: string) {
    requireAFeature("DEEP_DIAGNOSIS_ENABLED");
    const { owner, auth } = await this.identity(request);
    const result = await aRead(this.store, owner, async (tx) => {
      const [subject] = await tx.$queryRaw<
        { id: string; revision: number; verdict: { status: string } }[]
      >`SELECT id,revision,verdict FROM subject_attempts WHERE id=${uuid(attemptId)}::uuid AND owner_key=${owner.ownerKey} AND subject_code='physics'`;
      if (subject)
        return {
          projection: diagnosisProjection({
            attemptId: subject.id,
            attemptRevision: subject.revision,
            status: ["wrong_unit", "wrong_value"].includes(
              subject.verdict.status,
            )
              ? "verified_invalid"
              : subject.verdict.status,
            evidenceId: subject.id,
            causes: [],
            templateReviewed: false,
          }),
          preview: null,
        };
      const { attempt, row, status, map, report } = await this.diagnosisContext(
        tx,
        auth,
        attemptId,
      );
      const projection = diagnosisProjection({
        attemptId: attempt.id,
        attemptRevision: Number(attempt.revision),
        status,
        evidenceId: row?.verification_result_id ?? "",
        causes: (row?.basis_json.candidates ?? []).map((errorCode) => ({
          errorCode,
          skills:
            map.errors.find((e) => e.errorCode === errorCode)
              ?.candidateSkills ?? [],
          supported:
            row?.result_json?.diagnosis?.errorCode === errorCode &&
            row?.result_json?.diagnosis?.state === "supported_by_probe",
        })),
        probeId: row?.probe_id,
        answered: !!row?.result_json,
        templateReviewed: row?.template_reviewed === true,
        mappingPending: diagnosisReviewBlocked(
          row?.candidate_json.errorCode,
          row?.basis_json.family,
        ),
      });
      if (
        !row &&
        status === "verified_invalid" &&
        report?.isCurrent &&
        report.firstBlockingTransitionIndex !== null
      ) {
        const [path] = await tx.$queryRaw<
          { id: string; original_equation_raw: string }[]
        >`SELECT i.id,p.original_equation_raw FROM learning_assessment_items i JOIN learning_assessments x ON x.id=i.assessment_id JOIN attempts a ON a.id=i.attempt_id JOIN learning_sessions l ON l.id=a.learning_session_id JOIN problem_revisions p ON p.id=a.problem_revision_id WHERE a.id=${attempt.id}::uuid AND x.owner_key=${owner.ownerKey} AND l.is_synthetic AND NOT EXISTS(SELECT 1 FROM learning_assignments native WHERE native.attempt_id=a.id)`;
        if (path)
          return {
            projection,
            preview: {
              attempt,
              report,
              map,
              originalRaw: path.original_equation_raw,
              steps: await this.store.readStepsInTransaction(tx, attempt.id),
            },
          };
      }
      return { projection, preview: null };
    });
    if (!result.preview) return result.projection;
    const preview = result.preview,
      index = preview.report.firstBlockingTransitionIndex!,
      verdict = preview.report.transitions[index];
    if (!verdict || verdict.mathStatus !== "verified_invalid")
      return result.projection;
    const context = {
      attemptId: preview.attempt.id,
      attemptRevision: Number(preview.attempt.revision),
      problemRevisionId: preview.attempt.problem_revision_id,
      notationProfile: preview.attempt.notation_profile,
      domain: "reals" as const,
    };
    const parsed = new Map<number, Record<string, unknown> | null>();
    try {
      for (
        let position = Math.max(-1, index - 3);
        position <= index;
        position++
      ) {
        const step = position < 0 ? null : preview.steps[position];
        if (position >= 0 && !step) return result.projection;
        const item = await this.assessments.verification.math.parse(
          context,
          {
            kind: step ? "step" : "problem",
            stepVersionId: step?.version_id ?? null,
          },
          step?.source_raw ?? preview.originalRaw,
        );
        if (
          item.parseStatus !== "parsed" ||
          item.engineVersion !== verdict.engineVersion ||
          item.notationProfileVersion !== verdict.notationProfileVersion
        )
          return result.projection;
        parsed.set(position, item.ast);
      }
    } catch {
      return result.projection;
    }
    const initial = observeTransition(
      parsed.get(index - 1) ?? null,
      parsed.get(index) ?? null,
      verdict,
      preview.report.transitions
        .slice(0, index)
        .every((v) => v.mathStatus === "verified_valid"),
    );
    if (!initial) return result.projection;
    const preceding: VerifiedContextTransition[] = preview.report.transitions
      .slice(Math.max(0, index - 2), index)
      .map((v, offset) => {
        const position = Math.max(0, index - 2) + offset;
        return {
          before: parsed.get(position - 1) ?? null,
          after: parsed.get(position) ?? null,
          verdict: v,
        };
      });
    const hypothesis = contextualHypothesis(
      initial,
      preceding,
      verdict,
    ).hypothesis;
    return aRead(this.store, owner, async (tx) => {
      const current = await this.store.readAttemptInTransaction(
        tx,
        auth,
        attemptId,
      );
      if (current.revision !== preview.attempt.revision) throw stale();
      const [reviewed] =
        hypothesis.family && hypothesis.primary
          ? await tx.$queryRaw<
              { id: string }[]
            >`SELECT t.id FROM diagnostic_templates t JOIN learning_sessions l ON l.id=${current.learning_session_id}::uuid JOIN misconception_catalog c ON c.release_id=l.release_id WHERE t.release_id=l.release_id AND t.family=${hypothesis.family} AND c.error_code=${hypothesis.primary} AND t.enabled AND t.is_synthetic AND t.review_status='reviewed' AND t.reviewed_at IS NOT NULL AND t.reviewed_by_role IS NOT NULL AND c.enabled AND c.is_synthetic AND c.review_status='reviewed' AND c.reviewed_at IS NOT NULL AND c.reviewed_by_role IS NOT NULL LIMIT 1`
          : [];
      return diagnosisProjection({
        attemptId: current.id,
        attemptRevision: Number(current.revision),
        status: "verified_invalid",
        evidenceId: verdict.verificationResultId,
        causes: hypothesis.candidates.map((errorCode) => ({
          errorCode,
          skills:
            preview.map.errors.find((e) => e.errorCode === errorCode)
              ?.candidateSkills ?? [],
        })),
        templateReviewed: !!reviewed,
        mappingPending: diagnosisReviewBlocked(
          hypothesis.primary ?? undefined,
          hypothesis.family ?? undefined,
        ),
      });
    });
  }
  async offerProbe(request: RequestContext, raw: unknown) {
    requireAFeature("DEEP_DIAGNOSIS_ENABLED");
    const { owner, auth } = await this.identity(request, true),
      body = record(raw);
    only(body, ["attemptId", "expectedRevision"]);
    const id = uuid(textField(body.attemptId, 36)),
      expected = revisionField(body.expectedRevision);
    let target = await aRead(this.store, owner, async (tx) =>
      this.diagnosisContext(tx, auth, id),
    );
    if (Number(target.attempt.revision) !== expected) throw stale();
    const preview = await this.deepDiagnosis(request, id);
    if (
      target.status !== "verified_invalid" ||
      preview.nextIntervention === "no_safe_probe" ||
      preview.state === "review_blocked"
    )
      throw new ApiFault(
        409,
        "no_safe_activity",
        "لا يتوفر سؤال تشخيص مراجع وآمن لهذه الحالة.",
      );
    // A diagnostic item remains H0 for the canonical probe rules, but its
    // disclosure ends the original path measurement before it reaches React.
    await aMutation(
      this.store,
      owner,
      request,
      "diagnosis.exposure:" + id,
      body,
      async (tx) => {
        const current = await this.store.readAttemptInTransaction(tx, auth, id);
        if (Number(current.revision) !== expected) throw stale();
        const linked = await tx.$queryRaw<
          { id: string; assessment_id: string }[]
        >`SELECT i.id,i.assessment_id FROM learning_assessment_items i JOIN learning_assessments x ON x.id=i.assessment_id WHERE i.attempt_id=${id}::uuid AND x.owner_key=${owner.ownerKey} AND i.measurement_exited_at IS NULL FOR UPDATE OF i,x`;
        for (const item of linked) {
          await tx.$executeRaw`UPDATE learning_assessment_items SET measurement_exited_at=now() WHERE id=${item.id}::uuid`;
          await tx.$executeRaw`UPDATE learning_assessments SET revision=revision+1 WHERE id=${item.assessment_id}::uuid`;
        }
        return true;
      },
    );
    if (target.attempt.attempt_kind === "transfer") {
      await this.assessments.verification.verify(
        auth,
        id,
        createHash("sha256")
          .update("intelligent-a3-after-exit:" + id + ":" + expected)
          .digest("hex"),
        {
          expectedRevision: expected,
          scope: "current_sequence",
          targetStepId: null,
        },
      );
      target = await aRead(this.store, owner, (tx) =>
        this.diagnosisContext(tx, auth, id),
      );
    }
    if (
      !target.row?.template_reviewed ||
      diagnosisReviewBlocked(
        target.row?.candidate_json.errorCode,
        target.row?.basis_json.family,
      )
    )
      throw new ApiFault(
        409,
        "no_safe_activity",
        "لا يتوفر سؤال مراجع بعد إعادة التحقق؛ بقيت المحاولة محفوظة.",
      );
    return (
      await this.diagnosis.createProbe(
        auth,
        id,
        String(request.headers["idempotency-key"]),
        {
          expectedRevision: expected,
          verificationResultId: target.row.verification_result_id,
        },
      )
    ).data;
  }
}

@Controller("api/v1/learning")
export class IntelligentLearningController {
  constructor(readonly learning: IntelligentLearningService) {}
  @Get("next-activity") next(
    @Req() r: RequestContext,
    @Query("trackRevisionId") id: string,
  ) {
    return this.learning.nextActivity(r, id).then((d) => productEnvelope(r, d));
  }
  @Post("activities/accept") accept(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.learning.accept(r, b).then((d) => productEnvelope(r, d));
  }
  @Get("activities/:id") activity(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.learning.getActivity(r, id).then((d) => productEnvelope(r, d));
  }
  @Post("activities/:id/start-assessment") start(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning
      .startAssessment(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Get("mastery") mastery(
    @Req() r: RequestContext,
    @Query("trackRevisionId") id: string,
  ) {
    return this.learning.mastery(r, id).then((d) => productEnvelope(r, d));
  }
  @Get("knowledge-graph") graph(
    @Req() r: RequestContext,
    @Query("trackRevisionId") id: string,
  ) {
    return this.learning
      .knowledgeGraph(r, id)
      .then((d) => productEnvelope(r, d));
  }
  @Get("deep-diagnosis") diagnosis(
    @Req() r: RequestContext,
    @Query("attemptId") id: string,
  ) {
    return this.learning
      .deepDiagnosis(r, id)
      .then((d) => productEnvelope(r, d));
  }
  @Post("deep-diagnosis/probe") probe(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.learning.offerProbe(r, b).then((d) => productEnvelope(r, d));
  }
}
