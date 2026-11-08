import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { RequestContext } from "./http";
import {
  LearningAssessmentService,
  normalizedLearningEquation,
} from "./learning-assessments";
import {
  buildKnowledgeGraph,
  prerequisiteClosure,
  type GraphEdge,
} from "./knowledge-graph";
import { projectMastery } from "./mastery-model";
import { ARecords } from "./intelligent-learning-data";
import type { ActivityCandidate, ActivityKind } from "./pedagogy-engine";
import type {
  AReview,
  LearningActivity,
} from "../../../packages/contracts/src/intelligent-learning";
import { physicsExposureKey } from "./physics-learning";
import type { ContentPayload } from "../../../packages/contracts/src/product";
import { diagnosisReviewBlocked } from "./deep-diagnosis";
import { labFeature, labMathSources } from "./stem/lab-registry";
import { readLabExposures } from "./stem/lab-exposure";
import { parseCActivity } from "./advanced-learning/activity-payload";

export class PedagogyContextResolver {
  constructor(readonly assessments: LearningAssessmentService) {}
  async resolve(
    request: RequestContext,
    trackId: string,
    existing?: Parameters<LearningAssessmentService["context"]>[2],
    now = new Date(),
  ) {
    const context = await this.assessments.context(request, trackId, existing);
    const work = async (tx: Prisma.TransactionClient) => {
      const relations = await tx.$queryRaw<
        {
          from_skill: string;
          to_skill: string;
          relation_kind: string;
          rationale_ar: string | null;
        }[]
      >`SELECT DISTINCT s.skill_code AS from_skill,p.skill_code AS to_skill,k.relation_kind,k.rationale_ar FROM skill_prerequisites k JOIN skills s ON s.id=k.skill_id JOIN skills p ON p.id=k.prerequisite_skill_id JOIN content_releases r ON r.id=s.release_id WHERE r.status='published' AND p.release_id=s.release_id AND s.status='active' AND p.status='active' ORDER BY from_skill,to_skill`;
      const edges: GraphEdge[] = relations.map((e) => ({
        fromSkill: e.from_skill,
        toSkill: e.to_skill,
        relationKind: ["helpful", "recommended"].includes(e.relation_kind)
          ? "helpful"
          : e.relation_kind === "cross_subject_support"
            ? "cross_subject_support"
            : "required",
        rationaleAr: e.rationale_ar ?? "علاقة في إصدار المحتوى المنشور.",
        reviewState: "reviewed",
      }));
      const graph = buildKnowledgeGraph(
        trackId,
        context.track.payload.subject,
        context.map,
        context.track.lessons,
        edges,
      );
      const records = new ARecords(tx, context.owner.ownerKey),
        reviews = (await records.list<AReview>("review", trackId)).map((r) => ({
          ...r.data,
          id: r.id,
          revision: r.revision,
        }));
      const exposedSkills = context.track.lessons
        .filter((l) => context.viewedLessonIds.includes(l.id))
        .flatMap((l) =>
          l.payload.kind === "lesson" ? l.payload.skillCodes : [],
        );
      const projection = projectMastery(
        context.observations,
        context.skills,
        exposedSkills,
        reviews.map((r) => {
          const result = context.observations
            .filter(
              (o) =>
                o.assessmentId === r.assessmentId &&
                o.skillCode === r.skillCode &&
                Date.parse(o.time) >= Date.parse(r.dueAt),
            )
            .sort((a, b) => b.time.localeCompare(a.time))[0];
          return {
            skillCode: r.skillCode,
            state: r.status === "started" ? "active" : r.status,
            dueAt: r.dueAt,
            evidenceId: result?.evidenceId,
            verifiedAt: result?.time,
            sourceVerifiedAt: r.anchorAt,
            independent:
              result?.outcome === "correct" || result?.outcome === "error",
            outcome: result?.outcome,
          };
        }),
        now,
      );
      const bank = await this.assessments.content.bank(
        context.track.payload.subject,
        undefined,
        tx,
      );
      const seen = await tx.$queryRaw<
        {
          problem_revision_id: string;
          problem_id: string;
          family: string | null;
          raw: string | null;
        }[]
      >`SELECT p.id AS problem_revision_id,p.problem_id,p.learning_family AS family,p.original_equation_raw AS raw FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id JOIN problem_revisions p ON p.id=a.problem_revision_id WHERE l.guest_session_id=${context.auth.row.id}::uuid UNION SELECT p.id,p.problem_id,p.learning_family,p.original_equation_raw FROM content_exposures e JOIN problem_revisions p ON p.id=e.problem_revision_id WHERE e.guest_session_id=${context.auth.row.id}::uuid`;
      const physicsSeen = await tx.$queryRaw<
        { family_code: string; context_key: string }[]
      >`SELECT family_code,context_key FROM physics_content_exposures WHERE owner_key=${context.owner.ownerKey}`;
      const physicsRefs =
        context.track.payload.subject === "physics"
          ? await tx.$queryRaw<
              { id: string; payload: ContentPayload }[]
            >`SELECT id,payload FROM studio_revisions WHERE status='published' AND payload->>'subject'='physics'`
          : [];
      const allBlocks = context.track.lessons.flatMap((l) =>
          l.payload.kind === "lesson" ? l.payload.contentBlocks : [],
        ),
        exampleKeys = new Set(
          allBlocks
            .flatMap((b) => [
              b.raw ?? "",
              ...(b.steps ?? []).map((s) => s.raw),
              ...labMathSources(b.lab),
            ])
            .filter(Boolean)
            .map(normalizedLearningEquation),
        );
      const physicsKeys = new Set(
        allBlocks
          .filter((b) => b.physics)
          .map((b) => physicsExposureKey({ physics: b.physics })),
      );
      const fresh = bank.filter(
        (p) =>
          !allBlocks.some((b) => b.lab?.familyCode === p.familyCode) &&
          !seen.some(
            (s) =>
              s.problem_revision_id === p.revisionId ||
              s.problem_id === p.problemId ||
              s.family === p.familyCode ||
              (s.raw &&
                p.equationRaw &&
                normalizedLearningEquation(s.raw) ===
                  normalizedLearningEquation(p.equationRaw)),
          ) &&
          (!p.equationRaw ||
            !exampleKeys.has(normalizedLearningEquation(p.equationRaw))) &&
          (!p.physics ||
            (() => {
              const ref = physicsRefs.find((r) => r.id === p.revisionId);
              if (!ref) return false;
              const key = physicsExposureKey(ref.payload);
              return (
                !physicsKeys.has(key) &&
                !physicsSeen.some(
                  (s) =>
                    s.family_code === p.familyCode || s.context_key === key,
                )
              );
            })()),
      );
      const labExposures = await readLabExposures(
        tx,
        context.owner.ownerKey,
        context.track.payload.subject,
      );
      const novelBank = fresh.filter(
        (p) =>
          !labExposures.some(
            (l) =>
              l.family === p.familyCode ||
              (p.physics &&
                (() => {
                  const ref = physicsRefs.find((r) => r.id === p.revisionId);
                  return ref
                    ? l.contexts.some(
                        (c) => c.key === physicsExposureKey(ref.payload),
                      )
                    : true;
                })()),
          ),
      );
      const diagnoses = await tx.$queryRaw<
        {
          attempt_id: string;
          candidate_json: { needsProbe?: boolean };
          basis_json: { candidates?: string[]; family?: string };
          skill_code: string;
          template_reviewed: boolean;
        }[]
      >`SELECT d.attempt_id,d.candidate_json,d.basis_json,s.skill_code,(t.enabled AND t.is_synthetic AND t.review_status='reviewed' AND t.reviewed_at IS NOT NULL AND t.reviewed_by_role IS NOT NULL AND c.enabled AND c.is_synthetic AND c.review_status='reviewed' AND c.reviewed_at IS NOT NULL AND c.reviewed_by_role IS NOT NULL) AS template_reviewed FROM current_diagnoses d JOIN attempts a ON a.id=d.attempt_id JOIN learning_sessions l ON l.id=a.learning_session_id JOIN misconception_catalog c ON c.release_id=d.release_id AND c.error_code=d.candidate_json->>'errorCode' JOIN skills s ON s.id=c.skill_id LEFT JOIN diagnostic_templates t ON t.id=d.template_id WHERE l.guest_session_id=${context.auth.row.id}::uuid AND a.revision=d.attempt_revision AND NOT EXISTS(SELECT 1 FROM diagnostic_probes p JOIN probe_responses response ON response.probe_id=p.id WHERE p.diagnosis_id=d.id)`;
      const recent = (
        await records.list<LearningActivity>("activity", trackId)
      ).filter(
        (a) => now.getTime() - new Date(a.created_at).getTime() < 60_000,
      );
      const candidates: ActivityCandidate[] = [];
      for (const lesson of context.track.lessons) {
        if (lesson.payload.kind !== "lesson") continue;
        const payload = lesson.payload,
          skillCode = payload.skillCodes[0];
        if (!skillCode) continue;
        const summary = projection.find((p) => p.skillCode === skillCode),
          questionCoverage = novelBank.filter(
            (p) =>
              payload.assessmentProblemRevisionIds.includes(p.revisionId) &&
              (payload.subject !== "physics" || p.kind === "main"),
          ).length,
          base = {
            lessonRevisionId: lesson.id,
            skillCode,
            published: lesson.status === "published",
            mappingPending: payload.mappingPending.length > 0,
            questionCoverage,
            novel: questionCoverage > 0,
            reviewed: !!lesson.reviewedAt,
            subject: payload.subject,
          };
        const add = (
          activityKind: ActivityKind,
          reasonCode: string,
          extra: Partial<ActivityCandidate> = {},
        ) =>
          candidates.push({
            ...base,
            activityKind,
            reasonCode,
            recentlyAccepted: recent.some(
              (a) =>
                a.data.lessonRevisionId === lesson.id &&
                a.data.activityKind === activityKind,
            ),
            ...extra,
          });
        add("explanation", "introduction");
        if (payload.contentBlocks.some((b) => b.steps?.length))
          add("worked_example", "introduction");
        const labBlockIndex =
          process.env[labFeature(payload.subject)] === "true"
            ? payload.contentBlocks.findIndex(
                (b) =>
                  b.type === "subject_lab_activity" &&
                  b.lab?.skillCodes.includes(skillCode),
              )
            : -1;
        if (labBlockIndex >= 0)
          add("guided_practice", "subject_lab_practice", {
            labBlockIndex,
            labKind: payload.contentBlocks[labBlockIndex]!.lab!.labKind,
          });
        else if (payload.practiceProblemRevisionIds.length)
          add(
            "guided_practice",
            summary?.dimensions.supportedPractice === "observed"
              ? "supported_practice"
              : "targeted_practice",
            {
              supportedSuccess:
                summary?.dimensions.supportedPractice === "observed",
            },
          );
        for (
          let blockIndex = 0;
          blockIndex < payload.contentBlocks.length;
          blockIndex++
        ) {
          const block = payload.contentBlocks[blockIndex]!;
          const advanced =
            block.type === "problem_activity"
              ? "problem_based"
              : block.type === "project_activity"
                ? "project_based"
                : null;
          if (
            !advanced ||
            process.env[
              advanced === "problem_based"
                ? "C_PROBLEM_LEARNING_ENABLED"
                : "C_PROJECT_LEARNING_ENABLED"
            ] !== "true"
          )
            continue;
          const activity = parseCActivity(block.activity, payload.subject);
          if (
            !activity.skillCodes.includes(skillCode) ||
            activity.prerequisiteSkillCodes.some(
              (code) =>
                !graph.nodes.some(
                  (n) => n.skillCode === code && n.reviewState === "reviewed",
                ),
            )
          )
            continue;
          add(
            "guided_practice",
            advanced === "problem_based"
              ? "problem_based_learning"
              : "project_based_learning",
            {
              advancedActivity: { kind: advanced, blockIndex },
              recentlyAccepted: recent.some(
                (r) =>
                  r.data.lessonRevisionId === lesson.id &&
                  r.data.advancedActivity?.kind === advanced &&
                  r.data.advancedActivity?.blockIndex === blockIndex,
              ),
            },
          );
        }
        if (questionCoverage)
          add("independent_check", "additional_evidence", {
            independentSuccess:
              summary?.counts.eligibleIndependent !== undefined &&
              summary.counts.eligibleIndependent > 0,
          });
        const diagnosis = diagnoses.find(
          (d) =>
            d.skill_code === skillCode &&
            d.candidate_json.needsProbe &&
            d.template_reviewed &&
            !d.basis_json.candidates?.some((code) =>
              diagnosisReviewBlocked(code, d.basis_json.family),
            ),
        );
        if (diagnosis)
          add("diagnostic_probe", "confirm_possible_misconception", {
            ambiguousDiagnosis: true,
            sourceAttemptId: diagnosis.attempt_id,
          });
        if (
          reviews.some(
            (r) =>
              r.skillCode === skillCode &&
              ["scheduled", "deferred"].includes(r.status) &&
              Date.parse(r.dueAt) <= now.getTime(),
          )
        )
          add("retrieval_review", "review_due", { due: true });
        for (const prerequisite of prerequisiteClosure(skillCode, graph).filter(
          (e) => e.relationKind === "required",
        )) {
          const node = graph.nodes.find(
              (n) => n.skillCode === prerequisite.skillCode,
            ),
            evidence = projection.find(
              (p) => p.skillCode === prerequisite.skillCode,
            );
          if (
            node?.lessonRevisionId &&
            node.reviewState === "reviewed" &&
            evidence?.dimensions.independentPerformance === "needs_review"
          )
            add("prerequisite_repair", "prerequisite_review", {
              lessonRevisionId: node.lessonRevisionId,
              skillCode: node.skillCode,
              prerequisiteError: true,
            });
        }
        add("reflection", "reflect_on_strategy");
      }
      const evidenceFingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            canonical: context.evidenceFingerprint,
            graph: graph.mappingSnapshotHash,
            exposures: seen
              .map((s) => [s.problem_revision_id, s.family, s.raw])
              .sort(),
            physicsExposures: physicsSeen
              .map((s) => [s.family_code, s.context_key])
              .sort(),
            labExposures,
            reviews: reviews.map((r) => ({
              id: r.id,
              revision: r.revision,
              due: r.dueAt,
              status: r.status,
            })),
            candidates: candidates.map((c) => ({
              kind: c.activityKind,
              lesson: c.lessonRevisionId,
              due: c.due,
              cooldown: c.recentlyAccepted,
              coverage: c.questionCoverage,
              novel: c.novel,
              sourceAttemptId: c.sourceAttemptId,
              labKind: c.labKind,
              labBlockIndex: c.labBlockIndex,
              advancedActivity: c.advancedActivity,
            })),
          }),
        )
        .digest("hex");
      return {
        ...context,
        evidenceFingerprint,
        graph,
        projection,
        candidates: graph.issues.some((i) => i.startsWith("cycle:"))
          ? candidates.filter((c) =>
              ["explanation", "reflection"].includes(c.activityKind),
            )
          : candidates,
        reviews,
      };
    };
    return existing
      ? work(existing.tx)
      : this.assessments.store.db.$transaction(work);
  }
}
