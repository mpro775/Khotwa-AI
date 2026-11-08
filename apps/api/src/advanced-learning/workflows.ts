import { createHash, randomUUID } from "node:crypto";
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
  CActivity,
  CProblemActivity,
  CProjectActivity,
} from "../../../../packages/contracts/src/advanced-learning";
import type {
  CActivityBrief,
  CProblemSession,
  CProjectReview,
  CProjectRun,
  CProjectSubmission,
} from "../../../../packages/contracts/src/advanced-learning-sessions";
import type { StemLabResult } from "../../../../packages/contracts/src/stem-labs";
import type { ContentPayload } from "../../../../packages/contracts/src/product";
import { Store } from "../store";
import { AccountService } from "../accounts";
import { LearningPathContentService } from "../learning-path-content";
import { StemLabService } from "../stem/lab-service";
import {
  ARecords,
  aRead,
  aMutation,
  aReplay,
  requireAFeature,
  type ARecord,
} from "../intelligent-learning-data";
import { ApiFault, type RequestContext } from "../http";
import { uuid } from "../contracts";
import {
  only,
  record,
  textField,
  revisionField,
  productEnvelope,
  productInvalid,
  type ProductOwner,
} from "../product-core";
import { parseCActivity, publicCActivity } from "./activity-payload";
import {
  C_POLICY,
  C_STAGES,
  applyProblemStep,
  cBudget,
  cState,
  validateProjectArtifact,
  type ProblemData,
  type ProjectData,
} from "./workflow-state";
import { recordExposure } from "../learning";
import {
  physicsExposureKey,
  recordPhysicsExposures,
} from "../physics-learning";
import type { IntelligentLearningExperiencesService } from "../intelligent-learning-experiences";
import type { LearningAssessmentService } from "../learning-assessments";
import { normalizedLearningEquation } from "../learning-assessments";

type Tx = Prisma.TransactionClient;
type Kind = "problem" | "project";
const flag = (kind: Kind) =>
  kind === "problem"
    ? "C_PROBLEM_LEARNING_ENABLED"
    : "C_PROJECT_LEARNING_ENABLED";
const missing = () => new ApiFault(404, "not_found", "النشاط غير متاح.");
const stale = (revision?: number) =>
  new ApiFault(
    409,
    "revision_conflict",
    "تغير النشاط؛ حدّثه وأعد المحاولة.",
    [],
    revision ?? null,
  );
const neutral = (reasonCode: string, needsReview = false): StemLabResult => ({
  result: needsReview ? "needs_review" : "cannot_determine",
  domainVerifier: needsReview ? "human_review_required" : "domain_unavailable",
  reasonCode,
  feedbackAr: needsReview
    ? "حُفظ عملك؛ الخطة والتفسير يحتاجان مراجعة بشرية ولا يمنحان إتقانًا مستقلاً."
    : "تعذر التحقق؛ إجابتك محفوظة دون حكم على فهمك.",
  evidenceClass: "learning_only",
});
interface SubmissionRow {
  id: string;
  project_run_id: string;
  revision: number;
  milestone_code: string;
  artifact_kind: "text" | "json";
  artifact_json: string | Record<string, unknown>;
  is_final: boolean;
  status: "awaiting_feedback";
  created_at: Date;
}
interface ReviewRow {
  id: string;
  submission_id: string;
  rubric_revision_id: string;
  reviewer_id: string;
  reviewer_role: string;
  rubric_results: CProjectReview["criteria"];
  feedback_ar: string;
  decision: "accepted" | "revision_requested";
  created_at: Date;
}

/** C is a facade over the existing owner, content, assessment and domain services.
 * Its records always describe learning, never independent mastery. */
export class AdvancedLearningService {
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly content: LearningPathContentService,
    readonly labs: StemLabService,
    readonly experiences?: IntelligentLearningExperiencesService,
    readonly assessments?: LearningAssessmentService,
  ) {}

  private async spec(
    tx: Tx,
    lessonId: string,
    blockIndex: number,
    kind: Kind,
    pinned = false,
    hash?: string,
  ) {
    const row = await this.content.row(uuid(lessonId), tx);
    if (
      row.payload.kind !== "lesson" ||
      !row.reviewed_at ||
      !row.published_at ||
      !(row.status === "published" || (pinned && row.status === "archived"))
    )
      throw missing();
    if (hash && row.content_hash !== hash) throw stale();
    const block = row.payload.contentBlocks[blockIndex];
    if (
      block?.type !==
      (kind === "problem" ? "problem_activity" : "project_activity")
    )
      throw missing();
    const activity = parseCActivity(block.activity, row.payload.subject);
    if (
      activity.type !== (kind === "problem" ? "problem_based" : "project_based")
    )
      throw missing();
    return { row, activity };
  }
  private index(raw: unknown): number {
    const value = revisionField(raw);
    if (value > 49) throw productInvalid();
    return value;
  }
  private async track(tx: Tx, trackId: string, lessonId: string) {
    const track = await this.content.row(uuid(trackId), tx);
    if (
      track.status !== "published" ||
      track.payload.kind !== "track" ||
      !track.payload.units.some((u) => u.lessonRevisionIds.includes(lessonId))
    )
      throw missing();
    return track;
  }
  private brief(
    activity: CActivity,
    lessonRevisionId: string,
    blockIndex: number,
  ): CActivityBrief {
    return {
      lessonRevisionId,
      blockIndex,
      activity: publicCActivity(activity),
    };
  }
  async available(request: RequestContext, kind: Kind, rawTrack: string) {
    requireAFeature(flag(kind));
    const owner = await this.accounts.actor(request),
      trackId = uuid(rawTrack);
    return aRead(this.store, owner, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      const track = await this.content.row(trackId, tx);
      if (track.status !== "published" || track.payload.kind !== "track")
        throw missing();
      const items: CActivityBrief[] = [];
      for (const lessonId of track.payload.units.flatMap(
        (u) => u.lessonRevisionIds,
      )) {
        const lesson = await this.content.row(lessonId, tx);
        if (
          lesson.status !== "published" ||
          lesson.payload.kind !== "lesson" ||
          !lesson.reviewed_at ||
          !lesson.published_at
        )
          continue;
        for (let i = 0; i < lesson.payload.contentBlocks.length; i++) {
          const block = lesson.payload.contentBlocks[i]!;
          if (
            block.type !==
            (kind === "problem" ? "problem_activity" : "project_activity")
          )
            continue;
          const a = parseCActivity(block.activity, lesson.payload.subject);
          await this.exposure(tx, owner, lessonId, a);
          items.push(this.brief(a, lessonId, i));
        }
      }
      return { items, evidenceClass: "learning_only" as const };
    });
  }
  async activity(
    request: RequestContext,
    kind: Kind,
    lessonId: string,
    rawIndex: string,
  ) {
    requireAFeature(flag(kind));
    if (!/^\d{1,2}$/.test(rawIndex ?? "")) throw productInvalid();
    const owner = await this.accounts.actor(request);
    return aRead(this.store, owner, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      const { activity } = await this.spec(
        tx,
        lessonId,
        this.index(Number(rawIndex)),
        kind,
      );
      await this.exposure(tx, owner, lessonId, activity);
      return this.brief(activity, lessonId, Number(rawIndex));
    });
  }
  private async exposure(
    tx: Tx,
    owner: ProductOwner,
    lessonId: string,
    activity: CActivity,
  ) {
    // The lesson event joins existing novelty logic; family identities also remain
    // on C records for A2/B readLabExposures. Never rewrite completed evidence.
    await tx.$executeRaw`INSERT INTO learning_lesson_events(id,owner_key,lesson_revision_id,event_kind) SELECT ${randomUUID()}::uuid,${owner.ownerKey},${lessonId}::uuid,'lesson_started' WHERE NOT EXISTS(SELECT 1 FROM learning_lesson_events WHERE owner_key=${owner.ownerKey} AND lesson_revision_id=${lessonId}::uuid AND event_kind='lesson_started')`;
    const families = [activity.familyCode],
      contexts: string[] = [],
      sources: string[] = [];
    if (
      activity.type === "problem_based" &&
      activity.verification.kind === "bank_problem"
    ) {
      const refs = await this.content.bank(
        activity.subject,
        [activity.verification.problemRevisionId],
        tx,
        true,
      );
      if (refs.length !== 1) throw missing();
      families.push(refs[0]!.familyCode);
      if (refs[0]!.equationRaw)
        sources.push(normalizedLearningEquation(refs[0]!.equationRaw));
      if (activity.subject === "physics") {
        const [reference] = await tx.$queryRaw<
          { payload: ContentPayload }[]
        >`SELECT payload FROM studio_revisions WHERE id=${activity.verification.problemRevisionId}::uuid AND status IN ('published','archived') AND reviewed_at IS NOT NULL AND published_at IS NOT NULL`;
        if (!reference?.payload.physics) throw missing();
        contexts.push(physicsExposureKey(reference.payload));
        await recordPhysicsExposures(tx, owner.ownerKey, [
          {
            id: activity.verification.problemRevisionId,
            payload: reference.payload,
          },
        ]);
      }
      if (activity.subject === "algebra" && owner.guestId)
        await recordExposure(
          tx,
          owner.guestId,
          activity.verification.problemRevisionId,
          "c_problem_training",
        );
    }
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
    >`SELECT i.id,i.assessment_id,i.attempt_id,i.subject_attempt_id,i.problem_snapshot->>'familyCode' AS family,i.problem_snapshot->>'equationRaw' AS raw,sr.payload->'physics' AS physics FROM learning_assessment_items i JOIN learning_assessments a ON a.id=i.assessment_id LEFT JOIN studio_revisions sr ON sr.id=i.problem_revision_id WHERE a.owner_key=${owner.ownerKey} AND a.subject_code=${activity.subject} AND i.measurement_exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM attempts att JOIN verification_reports vr ON vr.attempt_id=att.id AND vr.attempt_revision=att.revision WHERE att.id=i.attempt_id AND vr.scope='current_sequence' AND vr.dispatch_status='finished' AND vr.report_json->>'isCurrent'='true' AND ((vr.report_json->'completion'->>'canMarkAttemptCompleted')='true' OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(vr.report_json->'transitions','[]'::jsonb)) t WHERE t->>'mathStatus'='verified_invalid'))) AND NOT EXISTS(SELECT 1 FROM subject_attempts sa WHERE sa.id=i.subject_attempt_id AND sa.verdict->>'status' IN ('correct','wrong_value','wrong_unit')) FOR UPDATE OF i,a`;
    const affected = new Set<string>();
    for (const item of pending)
      if (
        families.includes(item.family) ||
        (item.raw && sources.includes(normalizedLearningEquation(item.raw))) ||
        (item.physics &&
          contexts.includes(physicsExposureKey({ physics: item.physics })))
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
    return {
      exposedFamilies: [...new Set(families)],
      contextExposures: contexts.map((key) => ({
        key,
        at: new Date().toISOString(),
      })),
    };
  }
  private async problemDto(
    tx: Tx,
    row: ARecord<ProblemData>,
  ): Promise<CProblemSession> {
    const d = row.data,
      { activity } = await this.spec(
        tx,
        d.lessonRevisionId,
        d.blockIndex,
        "problem",
        true,
        d.contentHash,
      );
    return {
      ...this.brief(activity, d.lessonRevisionId, d.blockIndex),
      id: row.id,
      revision: row.revision,
      trackRevisionId: d.trackRevisionId,
      stage: d.stage,
      status: d.status,
      answers: d.answers,
      assistanceLevel: d.assistanceLevel,
      supportAr: d.supportAr,
      ...(d.supportLinks ? { supportLinks: d.supportLinks } : {}),
      ...(d.assessmentId ? { assessmentId: d.assessmentId } : {}),
      result: d.result,
      evidenceClass: "learning_only",
      readOnly: process.env[flag("problem")] !== "true",
      transfer: {
        available: false,
        reasonCode: "assessment_service_rechecks_novelty",
      },
    };
  }
  private async projectDto(
    tx: Tx,
    row: ARecord<ProjectData>,
  ): Promise<CProjectRun> {
    const d = row.data,
      { activity } = await this.spec(
        tx,
        d.lessonRevisionId,
        d.blockIndex,
        "project",
        true,
        d.contentHash,
      );
    const submissions = await tx.$queryRaw<
      SubmissionRow[]
    >`SELECT s.* FROM learning_project_submissions s JOIN intelligent_learning_records r ON r.id=s.project_run_id WHERE s.project_run_id=${row.id}::uuid AND r.owner_key=${row.owner_key} ORDER BY s.revision`;
    const reviews = await tx.$queryRaw<
      ReviewRow[]
    >`SELECT v.* FROM learning_project_reviews v JOIN learning_project_submissions s ON s.id=v.submission_id JOIN intelligent_learning_records r ON r.id=s.project_run_id WHERE r.id=${row.id}::uuid AND r.owner_key=${row.owner_key} ORDER BY v.created_at,v.id`;
    const dtos: CProjectSubmission[] = submissions.map((s) => {
      const v = reviews.find((v) => v.submission_id === s.id);
      return {
        id: s.id,
        revision: s.revision,
        milestoneCode: s.milestone_code,
        artifactKind: s.artifact_kind,
        artifact: s.artifact_json,
        isFinal: s.is_final,
        status: v?.decision ?? s.status,
        createdAt: s.created_at.toISOString(),
        review: v
          ? {
              id: v.id,
              rubricRevisionId: v.rubric_revision_id,
              assessedSubmissionRevision: s.revision,
              reviewerRole: v.reviewer_role,
              decision: v.decision,
              criteria: v.rubric_results,
              feedbackAr: v.feedback_ar,
              reviewedAt: v.created_at.toISOString(),
            }
          : null,
      };
    });
    return {
      ...this.brief(activity, d.lessonRevisionId, d.blockIndex),
      id: row.id,
      revision: row.revision,
      trackRevisionId: d.trackRevisionId,
      status: d.status,
      milestones: d.milestones,
      submissions: dtos,
      assistanceLevel: d.assistanceLevel,
      feedbackSeen: d.feedbackSeen,
      ...(d.assessmentId ? { assessmentId: d.assessmentId } : {}),
      evidenceClass: "learning_only",
      readOnly: process.env[flag("project")] !== "true",
    };
  }
  async start(request: RequestContext, kind: Kind, raw: unknown) {
    requireAFeature(flag(kind));
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["trackRevisionId", "lessonRevisionId", "blockIndex"]);
    const trackId = uuid(textField(b.trackRevisionId, 36)),
      lessonId = uuid(textField(b.lessonRevisionId, 36)),
      index = this.index(b.blockIndex);
    return aMutation(
      this.store,
      owner,
      request,
      "c." + kind + ".start",
      b,
      async (tx) => {
        const track = await this.track(tx, trackId, lessonId),
          { row, activity } = await this.spec(tx, lessonId, index, kind);
        if (track.payload.subject !== activity.subject) throw missing();
        if (
          activity.type === "project_based" &&
          activity.lessonRevisionIds.some(
            (id) =>
              track.payload.kind !== "track" ||
              !track.payload.units.some((u) =>
                u.lessonRevisionIds.includes(id),
              ),
          )
        )
          throw missing();
        const exposure = await this.exposure(tx, owner, lessonId, activity);
        const common = {
          trackRevisionId: trackId,
          lessonRevisionId: lessonId,
          blockIndex: index,
          contentHash: row.content_hash,
          policyVersion: C_POLICY as typeof C_POLICY,
          familyCode: activity.familyCode,
          subject: activity.subject,
          ...exposure,
          assistanceLevel: 0,
          eventCount: 0,
          lastEvent: kind + "_started",
        };
        const records = new ARecords(tx, owner.ownerKey);
        if (kind === "problem")
          return this.problemDto(
            tx,
            await records.create<ProblemData>("problem_session", trackId, {
              ...common,
              stage: "frame",
              status: "active",
              answers: {},
              supportAr: null,
              result: null,
              answer: null,
              domainVerification: [],
            }),
          );
        return this.projectDto(
          tx,
          await records.create<ProjectData>("project_run", trackId, {
            ...common,
            status: "active",
            milestones: {},
            feedbackSeen: false,
            submissionCount: 0,
          }),
        );
      },
    );
  }
  async get(request: RequestContext, kind: Kind, id: string) {
    const owner = await this.accounts.actor(request);
    return aRead(this.store, owner, async (tx) => {
      const records = new ARecords(tx, owner.ownerKey);
      if (kind === "problem")
        return this.problemDto(
          tx,
          await records.get<ProblemData>(uuid(id), "problem_session"),
        );
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      let row = await records.get<ProjectData>(uuid(id), "project_run");
      if (
        !row.data.feedbackSeen &&
        ["revision_requested", "feedback_ready"].includes(row.data.status)
      ) {
        row = await records.update(id, "project_run", row.revision, {
          ...row.data,
          feedbackSeen: true,
          assistanceLevel: Math.max(1, row.data.assistanceLevel),
          eventCount: row.data.eventCount + 1,
          lastEvent: "project_feedback_seen",
        });
      }
      return this.projectDto(tx, row);
    });
  }
  async inspectProject(request: RequestContext, id: string) {
    const actor = await this.accounts.actor(request, false, [
      "admin",
      "content_manager",
    ]);
    return aRead(this.store, actor, async (tx) => {
      await this.accounts.authorizeInTransaction(tx, actor);
      const [record] = await tx.$queryRaw<
        { owner_key: string }[]
      >`SELECT owner_key FROM intelligent_learning_records WHERE id=${uuid(id)}::uuid AND kind='project_run'`;
      if (!record) throw missing();
      return this.projectDto(
        tx,
        await new ARecords(tx, record.owner_key).get<ProjectData>(
          id,
          "project_run",
        ),
      );
    });
  }
  async step(request: RequestContext, id: string, raw: unknown) {
    requireAFeature(flag("problem"));
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "stage", "textAr", "action"]);
    const expected = revisionField(b.expectedRevision),
      action = b.action === undefined ? "save" : textField(b.action, 20);
    uuid(id);
    return aMutation(
      this.store,
      owner,
      request,
      "c.problem.step:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<ProblemData>(id, "problem_session");
        if (row.revision !== expected) throw stale(row.revision);
        const { activity } = await this.spec(
          tx,
          row.data.lessonRevisionId,
          row.data.blockIndex,
          "problem",
          true,
          row.data.contentHash,
        );
        const next = applyProblemStep(row.data, b.stage, b.textAr, action);
        if (["hint", "reveal"].includes(action)) {
          if (!activity.supportPolicy.hintsAllowed)
            cState("المساعدة غير متاحة لهذا النشاط.");
          const hints = activity.privateEvaluation?.hints ?? [];
          if (action === "reveal") {
            if (
              activity.supportPolicy.revealMode !== "after_submit" ||
              !row.data.answer ||
              !activity.privateEvaluation?.solutionKey
            )
              cState("الحل غير متاح قبل التسليم والموافقة المقررة.");
            next.supportAr = activity.privateEvaluation.solutionKey;
            next.assistanceLevel = 4;
          } else {
            const level = Math.min(3, row.data.assistanceLevel + 1);
            const hint = hints.find((v) => v.level === "H" + level);
            if (!hint) cState("لا يتوفر تلميح مراجَع لهذا المستوى.");
            next.supportAr = hint.textAr;
            next.assistanceLevel = level;
          }
          await this.exposure(tx, owner, row.data.lessonRevisionId, activity);
        }
        return this.problemDto(
          tx,
          await records.update(id, "problem_session", expected, next),
        );
      },
    );
  }
  private async verify(
    request: RequestContext,
    row: ARecord<ProblemData>,
    spec: CProblemActivity,
    answer: Record<string, unknown> | null,
    labSessionId: string | null,
  ): Promise<{ result: StemLabResult; reports: Record<string, unknown>[] }> {
    if (spec.verification.kind === "none")
      return {
        result: neutral("OPEN_REASONING_REQUIRES_HUMAN_REVIEW", true),
        reports: [],
      };
    if (spec.verification.kind === "stem_lab") {
      if (!labSessionId)
        throw productInvalid("اختر جلسة المختبر المرتبطة بهذه المشكلة.");
      const lab = await this.labs.get(request, labSessionId);
      if (
        lab.trackRevisionId !== row.data.trackRevisionId ||
        lab.lessonRevisionId !== row.data.lessonRevisionId ||
        lab.blockIndex !== spec.verification.blockIndex ||
        lab.subject !== spec.subject
      )
        throw missing();
      return {
        result: lab.result ?? neutral("LAB_SUBMISSION_REQUIRED"),
        reports: [],
      };
    }
    const problemId = spec.verification.problemRevisionId;
    const bank = await this.content.bank(
        spec.subject,
        [problemId],
        undefined,
        true,
      ),
      problem = bank[0];
    if (!problem) throw missing();
    if (!answer) throw productInvalid("أضف إجابة الجزء القابل للتحقق.");
    if (spec.subject === "algebra") {
      only(answer, ["raw"]);
      const report = await this.content.math.checkFinal(
        {
          attemptId: row.id,
          attemptRevision: row.revision,
          problemRevisionId: problemId,
          notationProfile: "ar-mashriq-school-v1",
          domain: "reals",
        },
        problem.equationRaw!,
        { stepVersionId: randomUUID(), raw: textField(answer.raw, 256) },
      );
      return {
        result: {
          result:
            report.status === "verified_valid" &&
            report.isIsolated &&
            report.substitutionValid
              ? "correct_practice"
              : report.status === "verified_invalid"
                ? "incorrect_practice"
                : "cannot_determine",
          domainVerifier: report.engineVersion,
          reasonCode: report.reasonCode ?? report.status,
          feedbackAr:
            "هذا حكم الجزء الجبري فقط؛ الخطة والتفسير يحتاجان مراجعة. النشاط تعلم دون إتقان مستقل.",
          evidenceClass: "learning_only",
        },
        reports: [report as unknown as Record<string, unknown>],
      };
    }
    if (spec.subject === "physics") {
      only(answer, ["value", "unit"]);
      const [reference] = await this.store.db.$queryRaw<
        { payload: ContentPayload }[]
      >`SELECT payload FROM studio_revisions WHERE id=${problemId}::uuid AND status IN ('published','archived') AND reviewed_at IS NOT NULL AND published_at IS NOT NULL`;
      if (!reference?.payload.physics) throw missing();
      const report = await this.content.physics.verify(
        problemId,
        reference.payload.physics,
        {
          value: textField(answer.value, 80),
          unit: textField(answer.unit, 16),
        },
      );
      return {
        result: {
          result:
            report.status === "correct"
              ? "correct_practice"
              : ["wrong_value", "wrong_unit"].includes(report.status)
                ? "incorrect_practice"
                : "cannot_determine",
          domainVerifier: report.engineVersion,
          reasonCode: report.reasonCode,
          feedbackAr:
            "تم فحص القيمة والوحدة ضمن النموذج المحدود؛ تفسير السياق يحتاج مراجعة مستقلة.",
          evidenceClass: "learning_only",
        },
        reports: [report as unknown as Record<string, unknown>],
      };
    }
    return {
      result: neutral("RUNNER_GATE_BLOCKED_USE_LINKED_NONEXEC_LAB", true),
      reports: [],
    };
  }
  async feedback(request: RequestContext, id: string, raw: unknown) {
    requireAFeature(flag("problem"));
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "answer", "labSessionId"]);
    const expected = revisionField(b.expectedRevision),
      answer = b.answer === undefined ? null : record(b.answer),
      labId =
        b.labSessionId === undefined
          ? null
          : uuid(textField(b.labSessionId, 36));
    if (answer && Buffer.byteLength(JSON.stringify(answer)) > 4096)
      throw productInvalid();
    uuid(id);
    const replay = await aReplay<CProblemSession>(
      this.store,
      owner,
      request,
      "c.problem.feedback:" + id,
      b,
    );
    if (replay) return replay;
    const saved = await aMutation(
      this.store,
      owner,
      request,
      "c.problem.prepare-feedback:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<ProblemData>(id, "problem_session");
        if (row.revision !== expected) throw stale(row.revision);
        if (row.data.status !== "active") cState();
        cBudget(row.data);
        await this.spec(
          tx,
          row.data.lessonRevisionId,
          row.data.blockIndex,
          "problem",
          true,
          row.data.contentHash,
        );
        return records.update(id, "problem_session", expected, {
          ...row.data,
          answer,
          result: null,
          domainVerification: [],
          eventCount: row.data.eventCount + 1,
          lastEvent: "domain_feedback_requested",
        });
      },
    );
    const spec = await aRead(this.store, owner, (tx) =>
      this.spec(
        tx,
        saved.data.lessonRevisionId,
        saved.data.blockIndex,
        "problem",
        true,
        saved.data.contentHash,
      ),
    );
    let outcome: { result: StemLabResult; reports: Record<string, unknown>[] };
    try {
      outcome = await this.verify(
        request,
        saved,
        spec.activity as CProblemActivity,
        answer,
        labId,
      );
    } catch (e) {
      if (e instanceof ApiFault && e.status < 500) throw e;
      outcome = { result: neutral("DOMAIN_SERVICE_UNAVAILABLE"), reports: [] };
    }
    if (Buffer.byteLength(JSON.stringify(outcome.reports)) > 24000)
      outcome = { result: neutral("VERIFICATION_EVIDENCE_LIMIT"), reports: [] };
    return aMutation(
      this.store,
      owner,
      request,
      "c.problem.feedback:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          current = await records.get<ProblemData>(id, "problem_session");
        if (
          current.revision !== saved.revision ||
          current.data.contentHash !== saved.data.contentHash
        )
          throw stale(current.revision);
        return this.problemDto(
          tx,
          await records.update(id, "problem_session", saved.revision, {
            ...current.data,
            result: outcome.result,
            domainVerification: outcome.reports,
            lastEvent:
              outcome.result.result === "cannot_determine"
                ? "validator_abstained"
                : "domain_result_verified",
          }),
        );
      },
    );
  }
  private nativeRequest(
    request: RequestContext,
    operation: string,
  ): RequestContext {
    return {
      ...request,
      headers: {
        ...request.headers,
        "idempotency-key": createHash("sha256")
          .update(
            String(request.headers["idempotency-key"]) +
              ":c-native:" +
              operation,
          )
          .digest("hex"),
      },
    };
  }
  async support(request: RequestContext, id: string, raw: unknown) {
    requireAFeature(flag("problem"));
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "kind"]);
    const expected = revisionField(b.expectedRevision),
      kind = textField(b.kind, 20);
    if (!["scaffold", "tutor", "reflection"].includes(kind))
      throw productInvalid();
    requireAFeature(
      kind === "scaffold"
        ? "FADING_SCAFFOLD_ENABLED"
        : kind === "tutor"
          ? "SOCRATIC_TUTOR_ENABLED"
          : "METACOGNITION_ENABLED",
    );
    if (!this.experiences)
      throw new ApiFault(403, "forbidden", "محول الدعم الأصلي غير متاح.");
    uuid(id);
    const operation = "c.problem.support:" + id;
    const replay = await aReplay<{
      session: CProblemSession;
      support: { kind: string; id: string };
    }>(this.store, owner, request, operation, b);
    if (replay) return replay;
    const saved = await aMutation(
      this.store,
      owner,
      request,
      operation + ":prepare",
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<ProblemData>(id, "problem_session");
        if (row.revision !== expected) throw stale(row.revision);
        if (
          row.data.status !== "active" ||
          (row.data.supportLinks?.length ?? 0) >= 8
        )
          cState();
        cBudget(row.data);
        const { activity } = await this.spec(
          tx,
          row.data.lessonRevisionId,
          row.data.blockIndex,
          "problem",
          true,
          row.data.contentHash,
        );
        if (kind !== "reflection" && !activity.supportPolicy.hintsAllowed)
          cState();
        if (kind === "reflection") textField(row.data.answers.reflect, 1000);
        return records.update(id, "problem_session", expected, {
          ...row.data,
          eventCount: row.data.eventCount + 1,
          lastEvent: "native_" + kind + "_requested",
        });
      },
    );
    const { activity } = await aRead(this.store, owner, (tx) =>
      this.spec(
        tx,
        saved.data.lessonRevisionId,
        saved.data.blockIndex,
        "problem",
        true,
        saved.data.contentHash,
      ),
    );
    const native = this.nativeRequest(request, kind + ":" + id),
      context = {
        trackRevisionId: saved.data.trackRevisionId,
        lessonRevisionId: saved.data.lessonRevisionId,
        skillCode: activity.skillCodes[0]!,
      };
    const link =
      kind === "scaffold"
        ? await this.experiences.startScaffold(native, context)
        : kind === "tutor"
          ? await this.experiences.startTutor(native, context)
          : await this.experiences.reflection(native, {
              trackRevisionId: saved.data.trackRevisionId,
              phase: "reflect",
              skipped: false,
              textAr: saved.data.answers.reflect,
            });
    return aMutation(this.store, owner, request, operation, b, async (tx) => {
      const records = new ARecords(tx, owner.ownerKey),
        row = await records.get<ProblemData>(id, "problem_session");
      if (
        row.revision !== saved.revision ||
        row.data.contentHash !== saved.data.contentHash
      )
        throw stale(row.revision);
      const next = await records.update(id, "problem_session", saved.revision, {
        ...row.data,
        assistanceLevel:
          kind === "reflection"
            ? row.data.assistanceLevel
            : Math.max(1, row.data.assistanceLevel),
        supportLinks: [
          ...(row.data.supportLinks ?? []),
          { kind: kind as "scaffold" | "tutor" | "reflection", id: link.id },
        ],
        lastEvent: "native_" + kind + "_linked",
      });
      return {
        session: await this.problemDto(tx, next),
        support: { kind, id: link.id },
      };
    });
  }
  async independentAssessment(
    request: RequestContext,
    kind: Kind,
    id: string,
    raw: unknown,
  ) {
    requireAFeature(flag(kind));
    if (!this.assessments)
      throw new ApiFault(403, "forbidden", "خدمة التقييم المستقل غير متاحة.");
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["expectedRevision"]);
    const expected = revisionField(b.expectedRevision);
    uuid(id);
    const operation = "c." + kind + ".assessment:" + id;
    const replay = await aReplay<unknown>(
      this.store,
      owner,
      request,
      operation,
      b,
    );
    if (replay) return replay;
    const saved = await aMutation(
      this.store,
      owner,
      request,
      operation + ":prepare",
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row =
            kind === "problem"
              ? await records.get<ProblemData>(id, "problem_session")
              : await records.get<ProjectData>(id, "project_run");
        if (row.revision !== expected) throw stale(row.revision);
        if (row.data.status !== "completed")
          cState("أكمل نشاط التعلم قبل طلب مهمة مستقلة جديدة.");
        await this.spec(
          tx,
          row.data.lessonRevisionId,
          row.data.blockIndex,
          kind,
          true,
          row.data.contentHash,
        );
        cBudget(row.data);
        return records.update<ProblemData | ProjectData>(
          id,
          kind === "problem" ? "problem_session" : "project_run",
          expected,
          {
            ...row.data,
            eventCount: row.data.eventCount + 1,
            lastEvent: "independent_assessment_requested",
          },
        );
      },
    );
    // A2 alone rechecks publication, novelty, exposure and capability.
    const assessment = saved.data.assessmentId
      ? await this.assessments.get(request, saved.data.assessmentId)
      : await this.assessments.start(
          this.nativeRequest(request, "assessment:" + id),
          {
            trackRevisionId: saved.data.trackRevisionId,
            lessonRevisionId: saved.data.lessonRevisionId,
            kind: "independent_check",
          },
        );
    return aMutation(this.store, owner, request, operation, b, async (tx) => {
      const records = new ARecords(tx, owner.ownerKey);
      if (kind === "problem") {
        const row = await records.get<ProblemData>(id, "problem_session");
        if (row.revision !== saved.revision) throw stale(row.revision);
        const next = await records.update(
          id,
          "problem_session",
          saved.revision,
          {
            ...row.data,
            assessmentId: assessment.id,
            lastEvent: "independent_assessment_linked",
          },
        );
        return { session: await this.problemDto(tx, next), assessment };
      }
      const row = await records.get<ProjectData>(id, "project_run");
      if (row.revision !== saved.revision) throw stale(row.revision);
      const next = await records.update(id, "project_run", saved.revision, {
        ...row.data,
        assessmentId: assessment.id,
        lastEvent: "independent_assessment_linked",
      });
      return { session: await this.projectDto(tx, next), assessment };
    });
  }
  async projectState(request: RequestContext, id: string, raw: unknown) {
    requireAFeature(flag("project"));
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "action"]);
    const expected = revisionField(b.expectedRevision),
      action = textField(b.action, 20);
    if (!["pause", "resume", "withdraw"].includes(action))
      throw productInvalid();
    uuid(id);
    return aMutation(
      this.store,
      owner,
      request,
      "c.project.state:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<ProjectData>(id, "project_run");
        if (row.revision !== expected) throw stale(row.revision);
        cBudget(row.data);
        if (
          ["completed", "withdrawn"].includes(row.data.status) ||
          (["awaiting_feedback", "review_pending"].includes(row.data.status) &&
            action !== "withdraw")
        )
          cState();
        if (action === "resume" && row.data.status !== "paused") cState();
        if (action === "pause" && row.data.status === "paused") cState();
        await this.spec(
          tx,
          row.data.lessonRevisionId,
          row.data.blockIndex,
          "project",
          true,
          row.data.contentHash,
        );
        return this.projectDto(
          tx,
          await records.update(id, "project_run", expected, {
            ...row.data,
            status:
              action === "pause"
                ? "paused"
                : action === "withdraw"
                  ? "withdrawn"
                  : "active",
            eventCount: row.data.eventCount + 1,
            lastEvent: "project_" + action,
          }),
        );
      },
    );
  }
  async milestone(
    request: RequestContext,
    id: string,
    code: string,
    raw: unknown,
  ) {
    requireAFeature(flag("project"));
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "textAr"]);
    const expected = revisionField(b.expectedRevision),
      text = textField(b.textAr, 2000);
    uuid(id);
    return aMutation(
      this.store,
      owner,
      request,
      "c.project.milestone:" + id + ":" + code,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<ProjectData>(id, "project_run");
        if (row.revision !== expected) throw stale(row.revision);
        if (
          !["active", "revision_requested", "feedback_ready"].includes(
            row.data.status,
          )
        )
          cState();
        cBudget(row.data);
        const { activity } = await this.spec(
            tx,
            row.data.lessonRevisionId,
            row.data.blockIndex,
            "project",
            true,
            row.data.contentHash,
          ),
          project = activity as CProjectActivity;
        if (!project.milestones.some((m) => m.code === code)) throw missing();
        return this.projectDto(
          tx,
          await records.update(id, "project_run", expected, {
            ...row.data,
            status: "active",
            milestones: { ...row.data.milestones, [code]: text },
            eventCount: row.data.eventCount + 1,
            lastEvent: "milestone_saved",
          }),
        );
      },
    );
  }
  async submit(request: RequestContext, id: string, raw: unknown) {
    requireAFeature(flag("project"));
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, [
      "expectedRevision",
      "milestoneCode",
      "artifactKind",
      "artifact",
      "isFinal",
    ]);
    const expected = revisionField(b.expectedRevision),
      code = textField(b.milestoneCode, 80),
      artifact = validateProjectArtifact(b.artifactKind, b.artifact);
    if (typeof b.isFinal !== "boolean") throw productInvalid();
    uuid(id);
    return aMutation(
      this.store,
      owner,
      request,
      "c.project.submit:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey),
          row = await records.get<ProjectData>(id, "project_run");
        if (row.revision !== expected) throw stale(row.revision);
        if (
          !["active", "revision_requested", "feedback_ready"].includes(
            row.data.status,
          )
        )
          cState();
        cBudget(row.data);
        // The response cache remains below productMutation's 512KiB ceiling.
        if (row.data.submissionCount >= 12)
          throw new ApiFault(
            429,
            "rate_limited",
            "بلغ المشروع حد نسخ التسليم.",
          );
        if (
          Buffer.byteLength(JSON.stringify(await this.projectDto(tx, row))) +
            Buffer.byteLength(JSON.stringify(artifact)) >
          400000
        )
          throw productInvalid(
            "بلغ المشروع حد الحجم التراكمي؛ قلل المنتج أو ابدأ مشروعًا جديدًا.",
          );
        const { activity } = await this.spec(
            tx,
            row.data.lessonRevisionId,
            row.data.blockIndex,
            "project",
            true,
            row.data.contentHash,
          ),
          project = activity as CProjectActivity,
          milestone = project.milestones.find((m) => m.code === code);
        if (!milestone) throw missing();
        if (milestone.requiredArtifactKind !== b.artifactKind)
          throw productInvalid("نوع المنتج لا يطابق متطلبات المرحلة.");
        if (
          b.isFinal &&
          project.milestones.some(
            (m) => m.required && !row.data.milestones[m.code],
          )
        )
          cState("أكمل وصف المعالم المطلوبة قبل التسليم النهائي.");
        const revision = row.data.submissionCount + 1;
        await tx.$executeRaw`INSERT INTO learning_project_submissions(id,project_run_id,revision,milestone_code,artifact_kind,artifact_json,status,is_final) VALUES(${randomUUID()}::uuid,${id}::uuid,${revision},${code},${String(b.artifactKind)},${JSON.stringify(artifact)}::jsonb,'awaiting_feedback',${b.isFinal})`;
        return this.projectDto(
          tx,
          await records.update(id, "project_run", expected, {
            ...row.data,
            status: b.isFinal ? "review_pending" : "awaiting_feedback",
            submissionCount: revision,
            eventCount: row.data.eventCount + 1,
            lastEvent: b.isFinal
              ? "project_submitted_final"
              : "project_submitted",
          }),
        );
      },
    );
  }
  async review(request: RequestContext, submissionId: string, raw: unknown) {
    requireAFeature(flag("project"));
    const actor = await this.accounts.actor(request, true, [
        "admin",
        "content_manager",
      ]),
      b = record(raw);
    only(b, ["expectedRevision", "decision", "criteria", "feedbackAr"]);
    const expected = revisionField(b.expectedRevision),
      feedback = textField(b.feedbackAr, 2000);
    if (
      !["accepted", "revision_requested"].includes(String(b.decision)) ||
      !Array.isArray(b.criteria) ||
      b.criteria.length > 12
    )
      throw productInvalid();
    const criteria = b.criteria.map((v) => {
      const c = record(v);
      only(c, ["criterionCode", "levelCode", "reasonAr"]);
      return {
        criterionCode: textField(c.criterionCode, 80),
        levelCode: textField(c.levelCode, 80),
        reasonAr: textField(c.reasonAr, 1000),
      };
    });
    uuid(submissionId);
    return aMutation(
      this.store,
      actor,
      request,
      "c.project.review:" + submissionId,
      b,
      async (tx) => {
        // A content-manager/admin has the explicit synthetic project-review role;
        // teacher has no cohort relationship and cannot access this queue.
        await this.accounts.authorizeInTransaction(tx, actor);
        const [submission] = await tx.$queryRaw<
          (SubmissionRow & { owner_key: string })[]
        >`SELECT s.*,r.owner_key FROM learning_project_submissions s JOIN intelligent_learning_records r ON r.id=s.project_run_id WHERE s.id=${submissionId}::uuid AND r.kind='project_run'`;
        if (!submission) throw missing();
        const records = new ARecords(tx, submission.owner_key),
          row = await records.get<ProjectData>(
            submission.project_run_id,
            "project_run",
          );
        if (row.revision !== expected) throw stale(row.revision);
        if (
          submission.revision !== row.data.submissionCount ||
          !["awaiting_feedback", "review_pending"].includes(row.data.status)
        )
          cState();
        if (actor.ownerKey === submission.owner_key)
          throw new ApiFault(403, "forbidden", "لا يمكنك اعتماد تسليمك بنفسك.");
        const { activity } = await this.spec(
            tx,
            row.data.lessonRevisionId,
            row.data.blockIndex,
            "project",
            true,
            row.data.contentHash,
          ),
          project = activity as CProjectActivity;
        if (
          new Set(criteria.map((c) => c.criterionCode)).size !==
            criteria.length ||
          criteria.length !== project.publicRubric.length ||
          criteria.some(
            (c) =>
              !project.publicRubric.some(
                (r) =>
                  r.code === c.criterionCode &&
                  r.levels.some((l) => l.code === c.levelCode),
              ),
          )
        )
          throw productInvalid(
            "يجب توثيق حكم لكل معيار من نسخة التقييم المثبتة.",
          );
        const [old] = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM learning_project_reviews WHERE submission_id=${submissionId}::uuid`;
        if (old) cState("هذا التسليم مراجع؛ أنشئ نسخة تسليم جديدة.");
        await tx.$executeRaw`INSERT INTO learning_project_reviews(id,submission_id,rubric_revision_id,reviewer_id,reviewer_role,rubric_results,feedback_ar,decision) VALUES(${randomUUID()}::uuid,${submissionId}::uuid,${row.data.lessonRevisionId}::uuid,${actor.userId}::uuid,${actor.role},${JSON.stringify(criteria)}::jsonb,${feedback},${String(b.decision)})`;
        const next = await records.update(row.id, "project_run", expected, {
          ...row.data,
          status:
            b.decision === "revision_requested"
              ? ("revision_requested" as const)
              : ("feedback_ready" as const),
          feedbackSeen: false,
          eventCount: row.data.eventCount + 1,
          lastEvent: "project_feedback_ready",
        });
        return this.projectDto(tx, next);
      },
    );
  }
  async finish(request: RequestContext, kind: Kind, id: string, raw: unknown) {
    requireAFeature(flag(kind));
    const owner = await this.accounts.actor(request, true),
      b = record(raw);
    only(b, ["expectedRevision"]);
    const expected = revisionField(b.expectedRevision);
    uuid(id);
    return aMutation(
      this.store,
      owner,
      request,
      "c." + kind + ".finish:" + id,
      b,
      async (tx) => {
        const records = new ARecords(tx, owner.ownerKey);
        if (kind === "problem") {
          const row = await records.get<ProblemData>(id, "problem_session");
          if (row.revision !== expected) throw stale(row.revision);
          if (
            row.data.status !== "active" ||
            C_STAGES.some((s) => !row.data.answers[s]) ||
            !row.data.result
          )
            cState(
              "احفظ مراحل الفهم والخطة والتجربة والتفسير والتأمل واطلب التغذية الراجعة أولاً.",
            );
          return this.problemDto(
            tx,
            await records.update(id, "problem_session", expected, {
              ...row.data,
              status: "completed",
              lastEvent: "problem_completed",
              eventCount: row.data.eventCount + 1,
            }),
          );
        }
        const row = await records.get<ProjectData>(id, "project_run");
        if (row.revision !== expected) throw stale(row.revision);
        if (row.data.status !== "feedback_ready")
          cState("التسليم ينتظر المراجعة؛ لم نمنح درجة تلقائية.");
        const [accepted] = await tx.$queryRaw<
          { id: string }[]
        >`SELECT s.id FROM learning_project_submissions s JOIN learning_project_reviews v ON v.submission_id=s.id WHERE s.project_run_id=${id}::uuid AND s.revision=${row.data.submissionCount} AND s.is_final=true AND v.decision='accepted'`;
        if (!accepted) cState("يلزم تسليم نهائي مقبول من مراجع مخول.");
        return this.projectDto(
          tx,
          await records.update(id, "project_run", expected, {
            ...row.data,
            status: "completed",
            lastEvent: "project_completed",
            eventCount: row.data.eventCount + 1,
          }),
        );
      },
    );
  }
}

@Controller("api/v1/learning")
export class AdvancedLearningController {
  constructor(readonly learning: AdvancedLearningService) {}
  @Post("problem-sessions/:id/support") @HttpCode(200) support(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning.support(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Post("problem-sessions/:id/assessment") @HttpCode(200) problemAssessment(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning
      .independentAssessment(r, "problem", id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("project-runs/:id/assessment") @HttpCode(200) projectAssessment(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning
      .independentAssessment(r, "project", id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("project-runs/:id/state") @HttpCode(200) projectState(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning
      .projectState(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Get("problems/available") problems(
    @Req() r: RequestContext,
    @Query("trackRevisionId") t: string,
  ) {
    return this.learning
      .available(r, "problem", t)
      .then((d) => productEnvelope(r, d));
  }
  @Get("projects/available") projects(
    @Req() r: RequestContext,
    @Query("trackRevisionId") t: string,
  ) {
    return this.learning
      .available(r, "project", t)
      .then((d) => productEnvelope(r, d));
  }
  @Get("problems/:id") problem(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Query("blockIndex") i: string,
  ) {
    return this.learning
      .activity(r, "problem", id, i)
      .then((d) => productEnvelope(r, d));
  }
  @Get("projects/:id") project(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Query("blockIndex") i: string,
  ) {
    return this.learning
      .activity(r, "project", id, i)
      .then((d) => productEnvelope(r, d));
  }
  @Post("problem-sessions") @HttpCode(200) startProblem(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.learning
      .start(r, "problem", b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("project-runs") @HttpCode(200) startProject(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.learning
      .start(r, "project", b)
      .then((d) => productEnvelope(r, d));
  }
  @Get("problem-sessions/:id") problemSession(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.learning
      .get(r, "problem", id)
      .then((d) => productEnvelope(r, d));
  }
  @Get("project-runs/:id") projectRun(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.learning
      .get(r, "project", id)
      .then((d) => productEnvelope(r, d));
  }
  @Post("problem-sessions/:id/steps") @HttpCode(200) steps(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning.step(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Post("problem-sessions/:id/feedback") @HttpCode(200) feedback(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning.feedback(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Post("problem-sessions/:id/finish") @HttpCode(200) finishProblem(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning
      .finish(r, "problem", id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("project-runs/:id/milestones/:code") @HttpCode(200) milestones(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Param("code") code: string,
    @Body() b: unknown,
  ) {
    return this.learning
      .milestone(r, id, code, b)
      .then((d) => productEnvelope(r, d));
  }
  @Post("project-runs/:id/submissions") @HttpCode(200) submissions(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning.submit(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Post("project-runs/:id/finish") @HttpCode(200) finishProject(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning
      .finish(r, "project", id, b)
      .then((d) => productEnvelope(r, d));
  }
}
@Controller("api/v1/studio/project-submissions")
export class AdvancedProjectReviewController {
  constructor(readonly learning: AdvancedLearningService) {}
  @Post(":id/feedback") @HttpCode(200) feedback(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.learning.review(r, id, b).then((d) => productEnvelope(r, d));
  }
}
@Controller("api/v1/studio/project-runs")
export class AdvancedProjectInspectorController {
  constructor(readonly learning: AdvancedLearningService) {}
  @Get(":id") inspect(@Req() r: RequestContext, @Param("id") id: string) {
    return this.learning
      .inspectProject(r, id)
      .then((d) => productEnvelope(r, d));
  }
}
