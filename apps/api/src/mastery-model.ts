import type { LearningObservation } from "./learning-assessments";
import { summarizeSkillEvidence } from "./learning-assessments";

export const MASTERY_MODEL = "mastery-a2-experimental-v1";
export interface LearnerSkillProjection {
  skillCode: string;
  titleAr: string;
  dimensions: {
    exposure: "not_seen" | "seen";
    supportedPractice: "none" | "observed";
    independentPerformance:
      | "none"
      | "limited_evidence"
      | "consistent_evidence"
      | "needs_review";
    transfer: "not_tested" | "evidence" | "needs_review";
    retention:
      | "not_due"
      | "due"
      | "observed_retained"
      | "review_needed"
      | "insufficient_data";
    evidenceQuality: "insufficient" | "partial" | "eligible";
  };
  counts: {
    assisted: number;
    eligibleIndependent: number;
    independentErrors: number;
  };
  evidenceIds: string[];
  reasonCodes: string[];
}

/** Projection only. Neither viewing, self-report nor technical abstention is performance. */
export function projectMastery(
  observations: readonly LearningObservation[],
  skills: { skillCode: string; titleAr: string }[],
  exposedSkills: readonly string[] = [],
  reviews: {
    skillCode: string;
    state: string;
    dueAt: string;
    evidenceId?: string;
    verifiedAt?: string;
    sourceVerifiedAt?: string;
    independent?: boolean;
    outcome?: string;
  }[] = [],
  now = new Date(),
): LearnerSkillProjection[] {
  return skills.map((skill) => {
    const source = observations.filter((o) => o.skillCode === skill.skillCode);
    // Keep the canonical V2.2 comparable/deduplicated independent rule intact.
    const summary = summarizeSkillEvidence(
      source.filter((o) => o.outcome !== "unassessable"),
      [skill],
    )[0]!;
    const successfulSupport = source.filter(
      (o) => o.outcome === "assisted" && o.verifiedCorrect === true,
    );
    const transfer = source.filter(
      (o) =>
        o.transferEligible === true && ["correct", "error"].includes(o.outcome),
    );
    const pendingReviews = reviews.filter(
      (r) =>
        r.skillCode === skill.skillCode &&
        ["scheduled", "deferred", "due", "active"].includes(r.state),
    );
    const reviewed = reviews.filter(
      (r) =>
        r.skillCode === skill.skillCode &&
        r.state === "completed" &&
        r.independent === true &&
        r.evidenceId &&
        source.some(
          (o) =>
            o.evidenceId === r.evidenceId &&
            ["correct", "error"].includes(o.outcome),
        ) &&
        r.verifiedAt &&
        r.sourceVerifiedAt &&
        Date.parse(r.verifiedAt) >= Date.parse(r.dueAt) &&
        Date.parse(r.verifiedAt) > Date.parse(r.sourceVerifiedAt),
    );
    const latestReview = reviewed.sort((a, b) =>
      String(b.verifiedAt).localeCompare(String(a.verifiedAt)),
    )[0];
    const due = pendingReviews.some(
      (r) => Date.parse(r.dueAt) <= now.getTime(),
    );
    const independent =
      summary.state === "independent_evidence"
        ? "consistent_evidence"
        : summary.independentErrors > 0
          ? "needs_review"
          : summary.independentCorrect > 0
            ? "limited_evidence"
            : "none";
    return {
      skillCode: skill.skillCode,
      titleAr: skill.titleAr,
      dimensions: {
        exposure: exposedSkills.includes(skill.skillCode) ? "seen" : "not_seen",
        supportedPractice: successfulSupport.length ? "observed" : "none",
        independentPerformance: independent,
        transfer: transfer.some((o) => o.outcome === "correct")
          ? "evidence"
          : transfer.some((o) => o.outcome === "error")
            ? "needs_review"
            : "not_tested",
        retention: latestReview
          ? latestReview.outcome === "correct"
            ? "observed_retained"
            : "review_needed"
          : due
            ? "due"
            : source.every((o) => o.outcome === "unassessable") && source.length
              ? "insufficient_data"
              : "not_due",
        evidenceQuality:
          independent === "consistent_evidence"
            ? "eligible"
            : summary.independentCorrect > 0 ||
                successfulSupport.length > 0 ||
                summary.independentErrors > 0
              ? "partial"
              : "insufficient",
      },
      counts: {
        assisted: successfulSupport.length,
        eligibleIndependent: summary.independentCorrect,
        independentErrors: summary.independentErrors,
      },
      evidenceIds: [...new Set(source.map((o) => o.evidenceId))],
      reasonCodes: [
        ...(source.some((o) => o.outcome === "unassessable")
          ? ["technical_abstention_excluded"]
          : []),
        ...(independent !== "consistent_evidence"
          ? ["more_independent_examples_needed"]
          : []),
        ...(!latestReview ? ["retention_not_yet_demonstrated"] : []),
      ],
    };
  });
}
