import type { Prisma } from "@prisma/client";
import type { ProblemData, ProjectData } from "./workflow-state";

/** Export the owner's writing and immutable artifacts, never evaluator snapshots.
 * This path works with flags OFF so disabling a feature cannot remove data rights. */
export async function exportAdvancedLearning(
  tx: Prisma.TransactionClient,
  ownerKey: string,
) {
  const [present] = await tx.$queryRaw<
    { present: boolean }[]
  >`SELECT to_regclass('public.learning_project_submissions') IS NOT NULL AS present`;
  if (!present?.present)
    return { sessions: [], submissions: [], reviews: [], truncated: false };
  const rows = await tx.$queryRaw<
    {
      id: string;
      kind: "problem_session" | "project_run";
      revision: number;
      data: ProblemData | ProjectData;
      updated_at: Date;
    }[]
  >`SELECT id,kind,revision,data,updated_at FROM intelligent_learning_records WHERE owner_key=${ownerKey} AND kind IN ('problem_session','project_run') ORDER BY created_at,id LIMIT 501`;
  const submissions = await tx.$queryRaw<
    {
      id: string;
      project_run_id: string;
      revision: number;
      milestone_code: string;
      artifact_kind: string;
      artifact_json: unknown;
      is_final: boolean;
      created_at: Date;
    }[]
  >`SELECT s.id,s.project_run_id,s.revision,s.milestone_code,s.artifact_kind,s.artifact_json,s.is_final,s.created_at FROM learning_project_submissions s JOIN intelligent_learning_records r ON r.id=s.project_run_id WHERE r.owner_key=${ownerKey} ORDER BY s.created_at,s.id LIMIT 501`;
  const reviews = await tx.$queryRaw<
    {
      submission_id: string;
      reviewer_role: string;
      rubric_revision_id: string;
      decision: "accepted" | "revision_requested";
      rubric_results: {
        criterionCode: string;
        levelCode: string;
        reasonAr: string;
      }[];
      feedback_ar: string;
      created_at: Date;
    }[]
  >`SELECT v.submission_id,v.reviewer_role,v.rubric_revision_id,v.decision,v.rubric_results,v.feedback_ar,v.created_at FROM learning_project_reviews v JOIN learning_project_submissions s ON s.id=v.submission_id JOIN intelligent_learning_records r ON r.id=s.project_run_id WHERE r.owner_key=${ownerKey} ORDER BY v.created_at,v.id LIMIT 501`;
  return {
    sessions: rows.slice(0, 500).map((r) => ({
      id: r.id,
      kind: r.kind,
      revision: r.revision,
      trackRevisionId: r.data.trackRevisionId,
      lessonRevisionId: r.data.lessonRevisionId,
      blockIndex: r.data.blockIndex,
      status: r.data.status,
      assistanceLevel: r.data.assistanceLevel,
      evidenceClass: "learning_only" as const,
      answers:
        r.kind === "problem_session" ? (r.data as ProblemData).answers : {},
      milestones:
        r.kind === "project_run" ? (r.data as ProjectData).milestones : {},
      updatedAt: r.updated_at.toISOString(),
    })),
    submissions: submissions.slice(0, 500).map((s) => ({
      id: s.id,
      projectRunId: s.project_run_id,
      revision: s.revision,
      milestoneCode: s.milestone_code,
      artifactKind: s.artifact_kind,
      artifact: s.artifact_json,
      isFinal: s.is_final,
      createdAt: s.created_at.toISOString(),
    })),
    reviews: reviews.slice(0, 500).map((v) => ({
      submissionId: v.submission_id,
      reviewerRole: v.reviewer_role,
      rubricRevisionId: v.rubric_revision_id,
      decision: v.decision,
      criteria: v.rubric_results,
      feedbackAr: v.feedback_ar,
      reviewedAt: v.created_at.toISOString(),
    })),
    truncated:
      rows.length > 500 || submissions.length > 500 || reviews.length > 500,
  };
}
