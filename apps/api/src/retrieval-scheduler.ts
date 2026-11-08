/** Experimental synthetic policy; intervals are configuration, not learning claims. */
export const RETRIEVAL_POLICY = "retrieval-a5-synthetic-v1";
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const DAY_MS = 86_400_000;
export type RetrievalObservation = {
  evidenceId: string;
  skillCode: string;
  problemId: string;
  outcome: "correct" | "error" | "assisted" | "unassessable";
  time: string;
  kind?: string;
  assessmentId?: string;
};
export type ReviewData = {
  trackRevisionId: string;
  lessonRevisionId: string;
  skillCode: string;
  sourceEvidenceId: string;
  policyVersion: string;
  dueAt: string;
  anchorAt: string;
  stepIndex: number;
  status:
    | "scheduled"
    | "deferred"
    | "started"
    | "completed"
    | "coverage_limited";
  assessmentId: string | null;
  retentionOutcome:
    | "not_tested"
    | "independent"
    | "assisted"
    | "needs_review"
    | "unassessable";
  deferReason?: string;
};
export function scheduleForSkill(
  observation: RetrievalObservation,
  trackRevisionId: string,
  lessonRevisionId: string,
  stepIndex = 0,
  intervals: readonly number[] = REVIEW_INTERVAL_DAYS,
): ReviewData | null {
  if (observation.outcome !== "correct") return null;
  const at = Date.parse(observation.time),
    days = intervals[stepIndex];
  if (
    !Number.isFinite(at) ||
    days === undefined ||
    !Number.isFinite(days) ||
    days < 1
  )
    return null;
  return {
    trackRevisionId,
    lessonRevisionId,
    skillCode: observation.skillCode,
    sourceEvidenceId: observation.evidenceId,
    policyVersion: RETRIEVAL_POLICY,
    dueAt: new Date(at + days * DAY_MS).toISOString(),
    anchorAt: observation.time,
    stepIndex,
    status: "scheduled",
    assessmentId: null,
    retentionOutcome: "not_tested",
  };
}
export function reviewIsDue(review: ReviewData, at: Date): boolean {
  return (
    ["scheduled", "deferred", "coverage_limited"].includes(review.status) &&
    Date.parse(review.dueAt) <= at.getTime()
  );
}
export function dueReviews<T extends ReviewData>(
  reviews: T[],
  at: Date,
  limit = 20,
): T[] {
  return reviews
    .filter((r) => reviewIsDue(r, at))
    .sort(
      (a, b) =>
        a.dueAt.localeCompare(b.dueAt) ||
        a.skillCode.localeCompare(b.skillCode),
    )
    .slice(0, Math.max(0, Math.min(limit, 50)));
}
export function deferReview(
  review: ReviewData,
  now: Date,
  days: number,
  reason: string,
): ReviewData {
  if (
    !reviewIsDue(review, now) ||
    !Number.isSafeInteger(days) ||
    days < 1 ||
    days > 7
  )
    throw new Error("Review is not due or delay is invalid");
  return {
    ...review,
    status: "deferred",
    deferReason: reason,
    dueAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
  };
}
export function retentionOutcome(
  review: ReviewData,
  observations: RetrievalObservation[],
): ReviewData["retentionOutcome"] {
  const eligible = observations.filter(
    (o) =>
      o.skillCode === review.skillCode &&
      Date.parse(o.time) >= Date.parse(review.dueAt),
  );
  if (!eligible.length) return "not_tested";
  if (eligible.some((o) => o.outcome === "assisted")) return "assisted";
  if (eligible.some((o) => o.outcome === "error")) return "needs_review";
  if (eligible.some((o) => o.outcome === "unassessable")) return "unassessable";
  return eligible.every((o) => o.outcome === "correct")
    ? "independent"
    : "not_tested";
}
/** Cached completion is never enough to expand spacing after an attempt edit. */
export function reviewRetainedByCurrentEvidence(
  review: ReviewData,
  observations: RetrievalObservation[],
): boolean {
  if (
    !review.assessmentId ||
    !observations.some(
      (o) =>
        o.evidenceId === review.sourceEvidenceId && o.outcome === "correct",
    )
  )
    return false;
  const current = observations.filter(
    (o) =>
      o.assessmentId === review.assessmentId &&
      o.skillCode === review.skillCode,
  );
  return (
    current.length > 0 &&
    current.every(
      (o) =>
        o.outcome === "correct" &&
        Date.parse(o.time) >= Date.parse(review.dueAt),
    )
  );
}
