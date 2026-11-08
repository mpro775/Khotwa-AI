import { createHash } from "node:crypto";
import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  AGoal,
  AReflection,
  AReview,
  AReviewList,
  AScaffoldSession,
  ATutorSession,
} from "../../../packages/contracts/src/intelligent-learning";
import type { AssessmentSession } from "../../../packages/contracts/src/learning-assessments";
import type {
  LessonPayload,
  LearningContentRevision,
} from "../../../packages/contracts/src/learning-paths";
import { AccountService, type ProductActor } from "./accounts";
import { uuid } from "./contracts";
import { ApiFault, type RequestContext } from "./http";
import {
  aMutation,
  aRead,
  aReplay,
  ARecords,
  requireAFeature,
  type ARecord,
} from "./intelligent-learning-data";
import { LearningAssessmentService } from "./learning-assessments";
import { LearningPathContentService } from "./learning-path-content";
import {
  goalEvidenceCount,
  reflectionMessage,
  type GoalData,
  type ReflectionData,
} from "./metacognition";
import {
  only,
  productEnvelope,
  productInvalid,
  record,
  revisionField,
  textField,
} from "./product-core";
import {
  deferReview,
  RETRIEVAL_POLICY,
  reviewIsDue,
  reviewRetainedByCurrentEvidence,
  scheduleForSkill,
  type ReviewData,
} from "./retrieval-scheduler";
import {
  nextScaffoldStage,
  revealScaffold,
  scaffoldStageEligible,
  SCAFFOLD_POLICY,
  workedSteps,
  workedExampleRaw,
  type ScaffoldData,
} from "./scaffolding";
import {
  advanceTutor,
  offlineSocraticQuestion,
  SOCRATIC_MAX_TURNS,
  SOCRATIC_POLICY,
  type TutorData,
} from "./socratic-tutor";
import { Store } from "./store";

const missing = () => new ApiFault(404, "not_found", "المورد غير متاح.");
const invalidState = (text: string) => new ApiFault(409, "invalid_state", text);
const idField = (value: unknown) => uuid(textField(value, 36));
const optionId = (value: unknown) =>
  value === undefined ? null : idField(value);
const derivedRequest = (r: RequestContext, suffix: string): RequestContext => ({
  ...r,
  headers: {
    ...r.headers,
    "idempotency-key": createHash("sha256")
      .update(String(r.headers["idempotency-key"]) + suffix)
      .digest("hex"),
  },
});
function ensureRevision(row: { revision: number }, expected: number) {
  if (row.revision !== expected)
    throw new ApiFault(
      409,
      "revision_conflict",
      "تغير النشاط؛ حدّثه ثم أعد المحاولة.",
      [],
      row.revision,
    );
}
function reviewDto(row: ARecord<ReviewData>): AReview {
  const { deferReason: _reason, ...data } = row.data;
  void _reason;
  return { ...data, id: row.id, revision: row.revision };
}
function scaffoldDto(row: ARecord<ScaffoldData>): AScaffoldSession {
  const d = row.data;
  return {
    id: row.id,
    revision: row.revision,
    trackRevisionId: d.trackRevisionId,
    lessonRevisionId: d.lessonRevisionId,
    skillCode: d.skillCode,
    stage: d.stage,
    status: d.status,
    contentVersion: d.contentVersion,
    problemRaw: workedExampleRaw(d.lessonSnapshot),
    supportCount: d.supportCount,
    assessmentId: d.assessmentId,
    independentEligible: d.independentEligible,
    visibleSteps: workedSteps(d.lessonSnapshot).slice(0, d.revealedCount),
    messageAr:
      ["S0", "S1"].includes(d.stage) && workedExampleRaw(d.lessonSnapshot)
        ? `${d.messageAr} مثال الدراسة: ${workedExampleRaw(d.lessonSnapshot)}`
        : d.messageAr,
  };
}
function tutorDto(row: ARecord<TutorData>): ATutorSession {
  const d = row.data;
  return {
    id: row.id,
    revision: row.revision,
    trackRevisionId: d.trackRevisionId,
    lessonRevisionId: d.lessonRevisionId,
    skillCode: d.skillCode,
    state: d.state,
    hintLevel: d.hintLevel as ATutorSession["hintLevel"],
    turnCount: d.turnCount,
    maxTurns: d.maxTurns,
    assistance: true,
    source: d.source,
    turns: d.turns,
    assessmentId: d.assessmentId,
    messageAr: d.messageAr,
  };
}
function goalDto(row: ARecord<GoalData>): AGoal {
  const {
    baselineEvidenceIds: _baseline,
    baselineProblemIds: _problems,
    ...data
  } = row.data;
  void _baseline;
  void _problems;
  return { id: row.id, revision: row.revision, ...data };
}
function assessmentResult(session: AssessmentSession) {
  const completed =
    session.questions.length > 0 && session.questions.every((q) => q.completed);
  const correct =
    completed &&
    session.questions.every((q) =>
      ["verified_valid", "correct"].includes(q.status ?? ""),
    );
  const independent =
    correct &&
    session.questions.every((q) => q.independent && q.supportLevel === 0);
  const technical = session.questions.some(
    (q) =>
      q.status !== null &&
      ![
        "verified_valid",
        "verified_invalid",
        "correct",
        "wrong_value",
        "wrong_unit",
      ].includes(q.status),
  );
  return { completed, correct, independent, technical };
}

/** A5–A8 orchestration keeps all scientific judgments in the existing assessments. */
export class IntelligentLearningExperiencesService {
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly content: LearningPathContentService,
    readonly assessments: LearningAssessmentService,
    readonly clock: () => Date = () => new Date(),
  ) {}
  private async actor(request: RequestContext, flag: string, write = false) {
    requireAFeature(flag);
    return this.accounts.actor(request, write);
  }
  private lesson(
    context: Awaited<ReturnType<LearningAssessmentService["context"]>>,
    id: string,
    skillCode: string,
  ): LearningContentRevision & { payload: LessonPayload } {
    const lesson = context.track.lessons.find(
      (l) =>
        l.id === id &&
        l.status === "published" &&
        l.payload.kind === "lesson" &&
        l.payload.skillCodes.includes(skillCode) &&
        !l.payload.mappingPending.length,
    );
    if (!lesson || lesson.payload.kind !== "lesson") throw missing();
    return lesson as LearningContentRevision & { payload: LessonPayload };
  }
  private async currentLesson(
    tx: Prisma.TransactionClient,
    lesson: LearningContentRevision,
  ) {
    const [current] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM learning_content_revisions WHERE id=${lesson.id}::uuid AND status='published' AND content_hash=${lesson.contentHash} FOR SHARE`;
    if (!current) throw invalidState("تغير المحتوى المنشور؛ حدّث الدرس.");
  }
  private async lockAssessment(
    tx: Prisma.TransactionClient,
    ownerKey: string,
    assessment: AssessmentSession,
  ) {
    const [row] = await tx.$queryRaw<
      { revision: number }[]
    >`SELECT revision FROM learning_assessments WHERE id=${assessment.id}::uuid AND owner_key=${ownerKey} FOR SHARE`;
    if (!row) throw missing();
    ensureRevision(row, assessment.revision);
  }
  private async transactionContext(
    tx: Prisma.TransactionClient,
    actor: ProductActor,
    request: RequestContext,
    before: Awaited<ReturnType<LearningAssessmentService["context"]>>,
  ) {
    await tx.$queryRaw`SELECT id FROM learning_assessments WHERE owner_key=${actor.ownerKey} AND track_revision_id=${before.track.id}::uuid ORDER BY id FOR SHARE`;
    const current = await this.assessments.context(request, before.track.id, {
      tx,
      owner: actor,
      auth: before.auth,
    });
    if (current.evidenceFingerprint !== before.evidenceFingerprint)
      throw invalidState("تغير دليل المحاولة؛ حدّث النشاط قبل حفظ النتيجة.");
    return current;
  }

  async schedule(request: RequestContext, raw: unknown): Promise<AReviewList> {
    const actor = await this.actor(request, "SPACED_REVIEW_ENABLED", true),
      b = record(raw);
    only(b, ["trackRevisionId"]);
    const trackId = idField(b.trackRevisionId),
      context = await this.assessments.context(request, trackId);
    return aMutation(
      this.store,
      actor,
      request,
      "reviews.schedule",
      b,
      async (tx) => {
        const currentContext = await this.transactionContext(
          tx,
          actor,
          request,
          context,
        );
        const records = new ARecords(tx, actor.ownerKey),
          existing = await records.list<ReviewData>("review", trackId);
        const rows: ARecord<ReviewData>[] = [];
        for (const row of existing) {
          const anchorCurrent = currentContext.observations.some(
            (o) =>
              o.evidenceId === row.data.sourceEvidenceId &&
              o.outcome === "correct",
          );
          rows.push(
            !anchorCurrent &&
              row.data.status !== "completed" &&
              row.data.status !== "coverage_limited"
              ? await records.update<ReviewData>(
                  row.id,
                  "review",
                  row.revision,
                  { ...row.data, status: "coverage_limited" },
                )
              : row,
          );
        }
        for (const skill of context.map.skills) {
          const observation = currentContext.observations
            .filter(
              (o) => o.skillCode === skill.skillCode && o.outcome === "correct",
            )
            .sort((a, z) => z.time.localeCompare(a.time))[0];
          if (!observation || !skill.lessonRevisionId) continue;
          const lesson = context.track.lessons.find(
            (l) =>
              l.id === skill.lessonRevisionId &&
              l.status === "published" &&
              l.payload.kind === "lesson" &&
              !l.payload.mappingPending.length,
          );
          if (!lesson) continue;
          const prior = existing.filter(
            (r) => r.data.skillCode === skill.skillCode,
          );
          if (
            prior.some(
              (r) => r.data.sourceEvidenceId === observation.evidenceId,
            ) ||
            prior.some(
              (r) =>
                [
                  "scheduled",
                  "deferred",
                  "started",
                  "coverage_limited",
                ].includes(r.data.status) &&
                currentContext.observations.some(
                  (o) =>
                    o.evidenceId === r.data.sourceEvidenceId &&
                    o.outcome === "correct",
                ),
            )
          )
            continue;
          const previous = prior
            .filter((r) => r.data.status === "completed")
            .sort((a, z) => z.created_at.getTime() - a.created_at.getTime())[0];
          const step =
            previous?.data.retentionOutcome === "independent" &&
            reviewRetainedByCurrentEvidence(
              previous.data,
              currentContext.observations,
            )
              ? Math.min(previous.data.stepIndex + 1, 4)
              : 0;
          const data = scheduleForSkill(observation, trackId, lesson.id, step);
          if (data) rows.push(await records.create("review", trackId, data));
        }
        return {
          policyVersion: RETRIEVAL_POLICY,
          reviews: rows.map(reviewDto),
        };
      },
    );
  }
  async reviews(
    request: RequestContext,
    trackId: string,
  ): Promise<AReviewList> {
    const actor = await this.actor(request, "SPACED_REVIEW_ENABLED");
    const context = await this.assessments.context(request, idField(trackId));
    return aRead(this.store, actor, async (tx) => ({
      policyVersion: RETRIEVAL_POLICY,
      reviews: (
        await new ARecords(tx, actor.ownerKey).list<ReviewData>(
          "review",
          trackId,
        )
      )
        .filter(
          (r) =>
            (r.data.status === "started" ||
              reviewIsDue(r.data, this.clock())) &&
            context.observations.some(
              (o) =>
                o.evidenceId === r.data.sourceEvidenceId &&
                o.outcome === "correct",
            ),
        )
        .sort((a, z) => a.data.dueAt.localeCompare(z.data.dueAt))
        .slice(0, 20)
        .map(reviewDto),
    }));
  }
  async defer(
    request: RequestContext,
    id: string,
    raw: unknown,
  ): Promise<AReview> {
    const actor = await this.actor(request, "SPACED_REVIEW_ENABLED", true),
      b = record(raw);
    only(b, ["expectedRevision", "days", "reason"]);
    const expected = revisionField(b.expectedRevision),
      days = revisionField(b.days);
    if (
      !["student_choice", "later"].includes(String(b.reason)) ||
      days < 1 ||
      days > 7
    )
      throw productInvalid();
    return aMutation(
      this.store,
      actor,
      request,
      "review.defer:" + idField(id),
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<ReviewData>(id, "review");
        ensureRevision(row, expected);
        if (!reviewIsDue(row.data, this.clock()))
          throw invalidState("هذه المراجعة ليست مستحقة للتأجيل.");
        return reviewDto(
          await records.update(
            id,
            "review",
            expected,
            deferReview(row.data, this.clock(), days, String(b.reason)),
          ),
        );
      },
    );
  }
  async startReview(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.actor(request, "SPACED_REVIEW_ENABLED", true),
      b = record(raw);
    only(b, ["expectedRevision"]);
    const expected = revisionField(b.expectedRevision);
    const replay = await aReplay<{
      review: AReview;
      assessment: AssessmentSession;
    }>(
      this.store,
      actor,
      derivedRequest(request, ":link"),
      "review.link:" + idField(id),
      b,
    );
    if (replay) return replay;
    const sourceReview = await aRead(this.store, actor, (tx) =>
      new ARecords(tx, actor.ownerKey).get<ReviewData>(id, "review"),
    );
    const context = await this.assessments.context(
      request,
      sourceReview.track_revision_id,
    );
    const prepared = await aMutation(
      this.store,
      actor,
      request,
      "review.prepare:" + idField(id),
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<ReviewData>(id, "review");
        ensureRevision(row, expected);
        const current = await this.transactionContext(
          tx,
          actor,
          request,
          context,
        );
        if (
          !current.observations.some(
            (o) =>
              o.evidenceId === row.data.sourceEvidenceId &&
              o.outcome === "correct",
          )
        )
          throw invalidState(
            "تغير الدليل الذي بُنيت عليه المراجعة؛ جهز خطة مراجعة جديدة.",
          );
        if (row.data.status === "started" && row.data.assessmentId) return row;
        if (row.data.status === "started" && !row.data.assessmentId) return row;
        if (!reviewIsDue(row.data, this.clock()))
          throw invalidState("موعد المراجعة لم يحن بعد.");
        return records.update(id, "review", expected, {
          ...row.data,
          status: "started" as const,
        });
      },
    );
    if (prepared.data.assessmentId)
      return {
        review: reviewDto(prepared),
        assessment: await this.assessments.get(
          request,
          prepared.data.assessmentId,
        ),
      };
    let assessment: AssessmentSession;
    try {
      assessment = await this.assessments.start(
        derivedRequest(
          {
            ...request,
            headers: { ...request.headers, "idempotency-key": actor.ownerKey },
          },
          ":review-assessment:" + id,
        ),
        {
          trackRevisionId: prepared.track_revision_id,
          lessonRevisionId: prepared.data.lessonRevisionId,
          kind: "retrieval_review",
        },
      );
    } catch (error) {
      if (error instanceof ApiFault && error.status === 409) {
        await aMutation(
          this.store,
          actor,
          derivedRequest(request, ":coverage"),
          "review.coverage:" + id,
          b,
          async (tx) => {
            const records = new ARecords(tx, actor.ownerKey),
              row = await records.get<ReviewData>(id, "review");
            return records.update(id, "review", row.revision, {
              ...row.data,
              status: "coverage_limited" as const,
            });
          },
        );
      }
      throw error;
    }
    return aMutation(
      this.store,
      actor,
      derivedRequest(request, ":link"),
      "review.link:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<ReviewData>(id, "review");
        if (row.data.assessmentId && row.data.assessmentId !== assessment.id)
          throw invalidState("المراجعة مرتبطة بنشاط آخر.");
        const linked = await records.update(id, "review", prepared.revision, {
          ...row.data,
          assessmentId: assessment.id,
        });
        return { review: reviewDto(linked), assessment };
      },
    );
  }
  async finishReview(
    request: RequestContext,
    id: string,
    raw: unknown,
  ): Promise<AReview> {
    const actor = await this.actor(request, "SPACED_REVIEW_ENABLED", true),
      b = record(raw);
    only(b, ["expectedRevision"]);
    const expected = revisionField(b.expectedRevision),
      row = await aRead(this.store, actor, (tx) =>
        new ARecords(tx, actor.ownerKey).get<ReviewData>(idField(id), "review"),
      );
    if (!row.data.assessmentId) throw invalidState("ابدأ المراجعة أولًا.");
    const assessment = await this.assessments.get(
        request,
        row.data.assessmentId,
      ),
      result = assessmentResult(assessment);
    const context = await this.assessments.context(
      request,
      row.track_revision_id,
    );
    return aMutation(
      this.store,
      actor,
      request,
      "review.finish:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          current = await records.get<ReviewData>(id, "review");
        ensureRevision(current, expected);
        await this.lockAssessment(tx, actor.ownerKey, assessment);
        const canonical = await this.transactionContext(
          tx,
          actor,
          request,
          context,
        );
        const anchorCurrent = canonical.observations.some(
          (o) =>
            o.evidenceId === current.data.sourceEvidenceId &&
            o.outcome === "correct",
        );
        const observations = canonical.observations.filter(
          (o) =>
            o.assessmentId === assessment.id &&
            o.skillCode === current.data.skillCode,
        );
        const qualified =
          observations.length > 0 &&
          observations.every(
            (o) =>
              o.outcome === "correct" &&
              Date.parse(o.time) >= Date.parse(current.data.dueAt),
          );
        const outcome: ReviewData["retentionOutcome"] =
          result.technical || !anchorCurrent
            ? "unassessable"
            : !result.completed
              ? "not_tested"
              : result.independent && qualified
                ? "independent"
                : result.correct && !result.independent
                  ? "assisted"
                  : result.correct
                    ? "unassessable"
                    : assessment.questions.some((q) => !q.independent)
                      ? "assisted"
                      : "needs_review";
        const updated = await records.update<ReviewData>(
          id,
          "review",
          expected,
          {
            ...current.data,
            status: result.completed ? "completed" : "started",
            retentionOutcome: outcome,
          },
        );
        return reviewDto(updated);
      },
    );
  }

  async startScaffold(
    request: RequestContext,
    raw: unknown,
  ): Promise<AScaffoldSession> {
    const actor = await this.actor(request, "FADING_SCAFFOLD_ENABLED", true),
      b = record(raw);
    only(b, ["trackRevisionId", "lessonRevisionId", "skillCode"]);
    const replay = await aReplay<AScaffoldSession>(
      this.store,
      actor,
      request,
      "scaffold.start",
      b,
    );
    if (replay) return replay;
    const trackId = idField(b.trackRevisionId),
      lessonId = idField(b.lessonRevisionId),
      skill = textField(b.skillCode, 80);
    const context = await this.assessments.context(request, trackId),
      lesson = this.lesson(context, lessonId, skill);
    if (!workedSteps(lesson.payload).length || !lesson.validation?.valid)
      throw invalidState("لا يتوفر مثال بخطوات متحققة لهذه النسخة.");
    // This explicit start is exposure; the preceding context read deliberately was not.
    await this.content.lesson(request, lessonId);
    return aMutation(
      this.store,
      actor,
      request,
      "scaffold.start",
      b,
      async (tx) => {
        await this.currentLesson(tx, lesson);
        const data: ScaffoldData = {
          trackRevisionId: trackId,
          lessonRevisionId: lessonId,
          skillCode: skill,
          stage: "S0",
          status: "active",
          contentVersion: lesson.version,
          contentHash: lesson.contentHash,
          lessonSnapshot: lesson.payload,
          revealedCount: 0,
          supportCount: 0,
          assessmentId: null,
          independentEligible: false,
          supportHistory: [],
          policyVersion: SCAFFOLD_POLICY,
          messageAr:
            "ابدأ بمثال متحقق ثم تمرين قصير؛ المشاهدة ليست دليلًا مستقلًا.",
        };
        return scaffoldDto(
          await new ARecords(tx, actor.ownerKey).create(
            "scaffold",
            trackId,
            data,
          ),
        );
      },
    );
  }
  async scaffold(request: RequestContext, id: string) {
    const actor = await this.actor(request, "FADING_SCAFFOLD_ENABLED");
    return aRead(this.store, actor, async (tx) =>
      scaffoldDto(
        await new ARecords(tx, actor.ownerKey).get<ScaffoldData>(
          idField(id),
          "scaffold",
        ),
      ),
    );
  }
  private async exitAssessment(
    request: RequestContext,
    assessment: AssessmentSession,
  ) {
    let current = assessment;
    for (const question of current.questions) {
      if (!question.independent) continue;
      current = await this.assessments.exitMeasurement(
        derivedRequest(request, ":exit:" + question.id),
        current.id,
        { expectedRevision: current.revision, questionId: question.id },
      );
    }
    return current;
  }
  async reveal(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.actor(request, "FADING_SCAFFOLD_ENABLED", true),
      b = record(raw);
    only(b, ["expectedRevision"]);
    const replay = await aReplay<AScaffoldSession>(
      this.store,
      actor,
      request,
      "scaffold.reveal:" + idField(id),
      b,
    );
    if (replay) return replay;
    const expected = revisionField(b.expectedRevision),
      before = await aMutation(
        this.store,
        actor,
        derivedRequest(request, ":reveal-prepare"),
        "scaffold.reveal-prepare:" + idField(id),
        b,
        async (tx) => {
          const row = await new ARecords(tx, actor.ownerKey).get<ScaffoldData>(
            id,
            "scaffold",
          );
          ensureRevision(row, expected);
          return row;
        },
      );
    const assistedAssessment = before.data.assessmentId
      ? await this.exitAssessment(
          request,
          await this.assessments.get(request, before.data.assessmentId),
        )
      : null;
    return aMutation(
      this.store,
      actor,
      request,
      "scaffold.reveal:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<ScaffoldData>(id, "scaffold");
        ensureRevision(row, expected);
        if (assistedAssessment)
          await this.lockAssessment(tx, actor.ownerKey, assistedAssessment);
        if (row.data.status !== "active")
          throw invalidState("انتهى هذا النشاط.");
        return scaffoldDto(
          await records.update(
            id,
            "scaffold",
            expected,
            revealScaffold(row.data, this.clock()),
          ),
        );
      },
    );
  }
  async advanceScaffold(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.actor(request, "FADING_SCAFFOLD_ENABLED", true),
      b = record(raw);
    only(b, ["expectedRevision", "assessmentId", "skipExample"]);
    const expected = revisionField(b.expectedRevision);
    const replay = await aReplay<{
      scaffold: AScaffoldSession;
      assessment: AssessmentSession | null;
    }>(
      this.store,
      actor,
      derivedRequest(request, ":scaffold-link:" + expected),
      "scaffold.link:" + idField(id),
      b,
    );
    if (replay) return replay;
    const prior = await aRead(this.store, actor, (tx) =>
      new ARecords(tx, actor.ownerKey).get<ScaffoldData>(
        idField(id),
        "scaffold",
      ),
    );
    const linkedId = optionId(b.assessmentId);
    if (linkedId && linkedId !== prior.data.assessmentId)
      throw productInvalid("اختر نشاط هذه الجلسة.");
    const current = prior.data.assessmentId
      ? await this.assessments.get(request, prior.data.assessmentId)
      : null;
    const result = current
      ? assessmentResult(current)
      : {
          completed: false,
          correct: false,
          independent: false,
          technical: false,
        };
    const prepared = await aMutation(
      this.store,
      actor,
      request,
      "scaffold.advance:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<ScaffoldData>(id, "scaffold");
        ensureRevision(row, expected);
        if (row.data.status !== "active")
          throw invalidState("انتهى هذا النشاط.");
        if (row.data.stage !== "S0" && !row.data.assessmentId) return row;
        if (current) await this.lockAssessment(tx, actor.ownerKey, current);
        const retryIndependent =
          row.data.stage === "S4" && result.correct && !result.independent;
        if (
          row.data.stage !== "S0" &&
          !retryIndependent &&
          !scaffoldStageEligible(
            row.data.stage,
            result.correct,
            result.independent,
          )
        )
          throw invalidState(
            result.technical
              ? "تعذر التحقق الفني؛ لا يعني ذلك خطأ إجابتك."
              : "أكمل النشاط المتحقق الحالي قبل تخفيف الدعم.",
          );
        const completed = row.data.stage === "S4" && !retryIndependent;
        const stage =
          b.skipExample === true && row.data.stage === "S0"
            ? "S4"
            : nextScaffoldStage(row.data.stage);
        const revealedCount =
          stage === "S1"
            ? Math.max(
                row.data.revealedCount,
                Math.max(0, workedSteps(row.data.lessonSnapshot).length - 1),
              )
            : row.data.revealedCount;
        const extraDisclosures = revealedCount - row.data.revealedCount;
        const next: ScaffoldData = {
          ...row.data,
          stage,
          assessmentId: completed ? row.data.assessmentId : null,
          assessmentGeneration: retryIndependent
            ? (row.data.assessmentGeneration ?? 0) + 1
            : (row.data.assessmentGeneration ?? 0),
          status: completed ? "completed" : "active",
          independentEligible: completed && result.independent,
          revealedCount,
          supportCount: row.data.supportCount + extraDisclosures,
          supportHistory: [
            ...row.data.supportHistory,
            ...Array.from({ length: extraDisclosures }, () => ({
              kind: "completion_step_prepared",
              occurredAt: this.clock().toISOString(),
              stage,
            })),
          ],
          messageAr: completed
            ? "سُجل دليل مستقل محدود في سؤال جديد، مع بقاء سجل المساعدة السابق."
            : stage === "S1"
              ? "أكمل خطوة في تدريب بمساعدة؛ لا تُحسب أداءً مستقلًا."
              : stage === "S4"
                ? "فحص جديد مستقل؛ طلب الدعم يحوّله إلى تدريب بمساعدة."
                : "نجرب سؤالًا جديدًا مع دعم أقل.",
        };
        return records.update(id, "scaffold", expected, next);
      },
    );
    if (prepared.data.status === "completed")
      return { scaffold: scaffoldDto(prepared), assessment: current };
    // Each stage has a distinct native session. The current question is never relabelled independent.
    const assessment = await this.assessments.start(
      derivedRequest(
        {
          ...request,
          headers: { ...request.headers, "idempotency-key": actor.ownerKey },
        },
        ":scaffold-native:" +
          id +
          ":" +
          prepared.data.stage +
          ":" +
          (prepared.data.assessmentGeneration ?? 0),
      ),
      {
        trackRevisionId: prepared.track_revision_id,
        lessonRevisionId: prepared.data.lessonRevisionId,
        kind:
          prepared.data.stage === "S4" || prepared.data.stage === "S3"
            ? "independent_check"
            : "practice",
      },
    );
    return aMutation(
      this.store,
      actor,
      derivedRequest(request, ":scaffold-link:" + expected),
      "scaffold.link:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<ScaffoldData>(id, "scaffold");
        const linked = await records.update(id, "scaffold", prepared.revision, {
          ...row.data,
          assessmentId: assessment.id,
          independentEligible:
            ["S3", "S4"].includes(row.data.stage) &&
            assessment.questions.length > 0 &&
            assessment.questions.every((q) => q.independent),
        });
        return { scaffold: scaffoldDto(linked), assessment };
      },
    );
  }

  async startTutor(
    request: RequestContext,
    raw: unknown,
  ): Promise<ATutorSession> {
    const actor = await this.actor(request, "SOCRATIC_TUTOR_ENABLED", true),
      b = record(raw);
    only(b, [
      "trackRevisionId",
      "lessonRevisionId",
      "skillCode",
      "assessmentId",
      "questionId",
      "expectedAssessmentRevision",
      "exitMeasurement",
    ]);
    const replay = await aReplay<ATutorSession>(
      this.store,
      actor,
      request,
      "tutor.start",
      b,
    );
    if (replay) return replay;
    const trackId = idField(b.trackRevisionId),
      lessonId = idField(b.lessonRevisionId),
      skill = textField(b.skillCode, 80);
    const context = await this.assessments.context(request, trackId),
      lesson = this.lesson(context, lessonId, skill);
    const assessmentId = optionId(b.assessmentId),
      questionId = optionId(b.questionId);
    let assessment: AssessmentSession | null = null;
    if (assessmentId) {
      assessment = await this.assessments.get(request, assessmentId);
      if (
        assessment.trackRevisionId !== trackId ||
        !questionId ||
        !assessment.questions.some((q) => q.id === questionId)
      )
        throw missing();
      const q = assessment.questions.find(
        (question) => question.id === questionId,
      )!;
      if (q.independent) {
        if (b.exitMeasurement !== true)
          throw invalidState(
            "بدء الحوار يحتاج خروجًا مقصودًا من القياس المستقل.",
          );
        assessment = await this.assessments.exitMeasurement(
          derivedRequest(request, ":tutor-exit"),
          assessmentId,
          {
            expectedRevision: revisionField(b.expectedAssessmentRevision),
            questionId,
          },
        );
      }
    } else if (questionId || b.expectedAssessmentRevision !== undefined)
      throw productInvalid();
    await this.content.lesson(request, lessonId);
    return aMutation(
      this.store,
      actor,
      request,
      "tutor.start",
      b,
      async (tx) => {
        await this.currentLesson(tx, lesson);
        if (assessment)
          await this.lockAssessment(tx, actor.ownerKey, assessment);
        const data: TutorData = {
          trackRevisionId: trackId,
          lessonRevisionId: lessonId,
          skillCode: skill,
          state: "awaiting_student",
          hintLevel: 1,
          turnCount: 1,
          maxTurns: SOCRATIC_MAX_TURNS,
          assistance: true,
          source: "synthetic_template",
          assessmentId,
          questionId,
          assessmentRevision: assessment?.revision ?? null,
          policyVersion: SOCRATIC_POLICY,
          fullSolution: assessmentId
            ? []
            : lesson.validation?.valid
              ? [
                  workedExampleRaw(lesson.payload),
                  ...workedSteps(lesson.payload).map((s) => s.raw),
                ].filter((raw): raw is string => raw !== null)
              : [],
          turns: [
            {
              role: "tutor",
              textAr: offlineSocraticQuestion(lesson.payload.subject, 1),
              hintLevel: 1,
            },
          ],
          messageAr:
            "حوار تجريبي محلي؛ لا يرسل نصك إلى نموذج خارجي ولا يحكم على صحة الحل.",
        };
        return tutorDto(
          await new ARecords(tx, actor.ownerKey).create("tutor", trackId, data),
        );
      },
    );
  }
  async tutor(request: RequestContext, id: string) {
    const actor = await this.actor(request, "SOCRATIC_TUTOR_ENABLED");
    return aRead(this.store, actor, async (tx) =>
      tutorDto(
        await new ARecords(tx, actor.ownerKey).get<TutorData>(
          idField(id),
          "tutor",
        ),
      ),
    );
  }
  async reply(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.actor(request, "SOCRATIC_TUTOR_ENABLED", true),
      b = record(raw);
    only(b, ["expectedRevision", "textAr", "action", "confirmFullSolution"]);
    const replay = await aReplay<ATutorSession>(
      this.store,
      actor,
      request,
      "tutor.reply:" + idField(id),
      b,
    );
    if (replay) return replay;
    const expected = revisionField(b.expectedRevision),
      text = b.textAr === undefined ? "" : textField(b.textAr, 1000, 0);
    if (
      ![
        "reply",
        "next_hint",
        "try_independent",
        "stop",
        "show_solution",
      ].includes(String(b.action))
    )
      throw productInvalid();
    if (b.action === "show_solution" && b.confirmFullSolution !== true)
      throw productInvalid("كشف الحل يحتاج تأكيدًا صريحًا.");
    const prior = await aRead(this.store, actor, (tx) =>
      new ARecords(tx, actor.ownerKey).get<TutorData>(idField(id), "tutor"),
    );
    const context = await this.assessments.context(
      request,
      prior.track_revision_id,
    );
    const subject = context.track.payload.subject;
    let linkedAssessment: AssessmentSession | null = null;
    if (prior.data.assessmentId) {
      linkedAssessment = await this.assessments.get(
        request,
        prior.data.assessmentId,
      );
      if (
        linkedAssessment.questions.some(
          (q) => q.id === prior.data.questionId && q.independent,
        )
      )
        throw invalidState("الحوار غير متاح أثناء القياس المستقل.");
    }
    return aMutation(
      this.store,
      actor,
      request,
      "tutor.reply:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<TutorData>(id, "tutor");
        ensureRevision(row, expected);
        if (linkedAssessment)
          await this.lockAssessment(tx, actor.ownerKey, linkedAssessment);
        if (row.data.state !== "awaiting_student")
          throw invalidState("انتهت هذه الجلسة.");
        const data = advanceTutor(
          {
            ...row.data,
            assessmentRevision:
              linkedAssessment?.revision ?? row.data.assessmentRevision,
          },
          subject,
          b.action as Parameters<typeof advanceTutor>[2],
          text,
          b.confirmFullSolution === true,
          linkedAssessment?.questions.find((q) => q.id === row.data.questionId)
            ?.status ?? null,
        );
        return tutorDto(await records.update(id, "tutor", expected, data));
      },
    );
  }

  async goals(request: RequestContext, trackId: string) {
    const actor = await this.actor(request, "METACOGNITION_ENABLED"),
      context = await this.assessments.context(request, idField(trackId));
    return aRead(this.store, actor, async (tx) => ({
      goals: (
        await new ARecords(tx, actor.ownerKey).list<GoalData>("goal", trackId)
      ).map((row) => {
        const count = goalEvidenceCount(row.data, context.observations);
        return goalDto({
          ...row,
          data: {
            ...row.data,
            independentCount: count,
            status:
              row.data.status === "skipped"
                ? "skipped"
                : count >= row.data.targetIndependentCount
                  ? "achieved"
                  : "active",
          },
        });
      }),
    }));
  }
  async createGoal(request: RequestContext, raw: unknown): Promise<AGoal> {
    const actor = await this.actor(request, "METACOGNITION_ENABLED", true),
      b = record(raw);
    only(b, [
      "trackRevisionId",
      "lessonRevisionId",
      "skillCode",
      "targetIndependentCount",
      "textAr",
    ]);
    const trackId = idField(b.trackRevisionId),
      lessonId = idField(b.lessonRevisionId),
      skill = textField(b.skillCode, 80);
    const target = revisionField(b.targetIndependentCount),
      text = textField(b.textAr, 240);
    if (target < 1 || target > 5) throw productInvalid();
    const context = await this.assessments.context(request, trackId),
      lesson = this.lesson(context, lessonId, skill);
    return aMutation(
      this.store,
      actor,
      request,
      "goal.create",
      b,
      async (tx) => {
        await this.currentLesson(tx, lesson);
        const at = this.clock().toISOString(),
          records = new ARecords(tx, actor.ownerKey);
        if (
          (await records.list<GoalData>("goal", trackId)).filter(
            (g) => g.data.status === "active",
          ).length >= 10
        )
          throw invalidState("أكمل أو تخطَّ هدفًا سابقًا قبل إضافة المزيد.");
        const data: GoalData = {
          trackRevisionId: trackId,
          lessonRevisionId: lessonId,
          skillCode: skill,
          targetIndependentCount: target,
          textAr: text,
          status: "active",
          independentCount: 0,
          baselineEvidenceIds: context.observations.map((o) => o.evidenceId),
          baselineProblemIds: context.observations.map((o) => o.problemId),
          createdAt: at,
          updatedAt: at,
        };
        return goalDto(await records.create("goal", trackId, data));
      },
    );
  }
  async checkin(
    request: RequestContext,
    id: string,
    raw: unknown,
  ): Promise<AGoal> {
    const actor = await this.actor(request, "METACOGNITION_ENABLED", true),
      b = record(raw);
    only(b, ["expectedRevision", "skipped"]);
    const expected = revisionField(b.expectedRevision);
    if (typeof b.skipped !== "boolean") throw productInvalid();
    const prior = await aRead(this.store, actor, (tx) =>
      new ARecords(tx, actor.ownerKey).get<GoalData>(idField(id), "goal"),
    );
    const context = await this.assessments.context(
      request,
      prior.track_revision_id,
    );
    return aMutation(
      this.store,
      actor,
      request,
      "goal.checkin:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<GoalData>(id, "goal");
        ensureRevision(row, expected);
        const canonical = await this.transactionContext(
          tx,
          actor,
          request,
          context,
        );
        const count = goalEvidenceCount(row.data, canonical.observations),
          data: GoalData = {
            ...row.data,
            independentCount: count,
            status: b.skipped
              ? "skipped"
              : count >= row.data.targetIndependentCount
                ? "achieved"
                : "active",
            updatedAt: this.clock().toISOString(),
          };
        return goalDto(await records.update(id, "goal", expected, data));
      },
    );
  }
  async updateGoal(
    request: RequestContext,
    id: string,
    raw: unknown,
  ): Promise<AGoal> {
    const actor = await this.actor(request, "METACOGNITION_ENABLED", true),
      b = record(raw);
    only(b, ["expectedRevision", "textAr", "targetIndependentCount"]);
    const expected = revisionField(b.expectedRevision);
    if (b.textAr === undefined && b.targetIndependentCount === undefined)
      throw productInvalid("اختر نص الهدف أو عدده لتعديله.");
    const text = b.textAr === undefined ? undefined : textField(b.textAr, 240);
    const target =
      b.targetIndependentCount === undefined
        ? undefined
        : revisionField(b.targetIndependentCount);
    if (target !== undefined && (target < 1 || target > 5))
      throw productInvalid();
    const prior = await aRead(this.store, actor, (tx) =>
      new ARecords(tx, actor.ownerKey).get<GoalData>(idField(id), "goal"),
    );
    const context = await this.assessments.context(
      request,
      prior.track_revision_id,
    );
    return aMutation(
      this.store,
      actor,
      request,
      "goal.update:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey),
          row = await records.get<GoalData>(id, "goal");
        ensureRevision(row, expected);
        const canonical = await this.transactionContext(
          tx,
          actor,
          request,
          context,
        );
        const count = goalEvidenceCount(row.data, canonical.observations),
          targetCount = target ?? row.data.targetIndependentCount;
        const data: GoalData = {
          ...row.data,
          textAr: text ?? row.data.textAr,
          targetIndependentCount: targetCount,
          independentCount: count,
          status:
            row.data.status === "skipped"
              ? "skipped"
              : count >= targetCount
                ? "achieved"
                : "active",
          updatedAt: this.clock().toISOString(),
        };
        return goalDto(await records.update(id, "goal", expected, data));
      },
    );
  }
  async reflection(
    request: RequestContext,
    raw: unknown,
  ): Promise<AReflection> {
    const actor = await this.actor(request, "METACOGNITION_ENABLED", true),
      b = record(raw);
    only(b, [
      "trackRevisionId",
      "activityId",
      "goalId",
      "phase",
      "confidence",
      "textAr",
      "skipped",
    ]);
    const trackId = idField(b.trackRevisionId),
      goalId = optionId(b.goalId),
      activityId = optionId(b.activityId);
    if (
      !["predict", "monitor", "reflect"].includes(String(b.phase)) ||
      typeof b.skipped !== "boolean"
    )
      throw productInvalid();
    const confidence =
      b.confidence === undefined ? null : revisionField(b.confidence);
    if (confidence !== null && confidence > 100) throw productInvalid();
    const text = b.textAr === undefined ? "" : textField(b.textAr, 1000, 0);
    const context = await this.assessments.context(request, trackId);
    return aMutation(
      this.store,
      actor,
      request,
      "reflection.create",
      b,
      async (tx) => {
        const records = new ARecords(tx, actor.ownerKey);
        const canonical = await this.transactionContext(
          tx,
          actor,
          request,
          context,
        );
        if (
          goalId &&
          (await records.get<GoalData>(goalId, "goal")).track_revision_id !==
            trackId
        )
          throw missing();
        let outcome: ReflectionData["verifiedOutcome"] = "not_tested";
        if (activityId) {
          const activity = await records.get<{ assessmentId: string | null }>(
            activityId,
            "activity",
          );
          if (activity.track_revision_id !== trackId) throw missing();
          // Only the canonical subject adapter can describe a verified observation.
          if (activity.data.assessmentId && b.phase === "reflect") {
            const observations = canonical.observations.filter(
              (o) => o.assessmentId === activity.data.assessmentId,
            );
            if (observations.length)
              outcome = observations.some((o) => o.outcome === "unassessable")
                ? "unassessable"
                : observations.some((o) => o.outcome === "error")
                  ? "error"
                  : observations.some((o) => o.outcome === "assisted")
                    ? "assisted"
                    : observations.every((o) => o.outcome === "correct")
                      ? "correct"
                      : "not_tested";
          }
        }
        const data: ReflectionData = {
          trackRevisionId: trackId,
          goalId,
          activityId,
          phase: b.phase as ReflectionData["phase"],
          confidence,
          textAr: text,
          skipped: b.skipped as boolean,
          verifiedOutcome: outcome,
          messageAr: reflectionMessage(confidence, outcome),
          createdAt: this.clock().toISOString(),
        };
        const row = await records.create(
          "reflection",
          trackId,
          data,
          goalId ?? activityId,
        );
        return { id: row.id, ...data };
      },
    );
  }
  async reflections(request: RequestContext, trackId: string) {
    const actor = await this.actor(request, "METACOGNITION_ENABLED");
    await this.assessments.context(request, idField(trackId));
    return aRead(this.store, actor, async (tx) => ({
      reflections: (
        await new ARecords(tx, actor.ownerKey).list<ReflectionData>(
          "reflection",
          trackId,
        )
      )
        .slice(-50)
        .map((row) => ({ id: row.id, ...row.data })),
    }));
  }
}

@Controller("api/v1/learning")
export class IntelligentLearningExperiencesController {
  constructor(readonly experiences: IntelligentLearningExperiencesService) {}
  @Post("reviews/schedule") schedule(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.experiences.schedule(r, b).then((d) => productEnvelope(r, d));
  }
  @Get("reviews/due") reviews(
    @Req() r: RequestContext,
    @Query("trackRevisionId") id: string,
  ) {
    return this.experiences.reviews(r, id).then((d) => productEnvelope(r, d));
  }
  @Post("reviews/:id/start") startReview(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.experiences
      .startReview(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("reviews/:id/defer") defer(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.experiences.defer(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Post("reviews/:id/finish") finish(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.experiences
      .finishReview(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("scaffolds") startScaffold(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.experiences
      .startScaffold(r, b)
      .then((d) => productEnvelope(r, d));
  }
  @Get("scaffolds/:id") scaffold(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.experiences.scaffold(r, id).then((d) => productEnvelope(r, d));
  }
  @Post("scaffolds/:id/reveal") reveal(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.experiences.reveal(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Post("scaffolds/:id/advance") advance(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.experiences
      .advanceScaffold(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("tutor-sessions") startTutor(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.experiences.startTutor(r, b).then((d) => productEnvelope(r, d));
  }
  @Get("tutor-sessions/:id") tutor(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.experiences.tutor(r, id).then((d) => productEnvelope(r, d));
  }
  @Post("tutor-sessions/:id/reply") reply(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.experiences.reply(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Get("goals") goals(
    @Req() r: RequestContext,
    @Query("trackRevisionId") id: string,
  ) {
    return this.experiences.goals(r, id).then((d) => productEnvelope(r, d));
  }
  @Post("goals") goal(@Req() r: RequestContext, @Body() b: unknown) {
    return this.experiences.createGoal(r, b).then((d) => productEnvelope(r, d));
  }
  @Post("goals/:id/checkin") checkin(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.experiences
      .checkin(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("reflections") reflection(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.experiences.reflection(r, b).then((d) => productEnvelope(r, d));
  }
  @Post("goals/:id/update") updateGoal(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.experiences
      .updateGoal(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Get("reflections") reflections(
    @Req() r: RequestContext,
    @Query("trackRevisionId") id: string,
  ) {
    return this.experiences
      .reflections(r, id)
      .then((d) => productEnvelope(r, d));
  }
}
