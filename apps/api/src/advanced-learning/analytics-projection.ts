import { createHash } from "node:crypto";
import type { CMetric } from "../../../../packages/contracts/src/advanced-learning";
import type { AReview } from "../../../../packages/contracts/src/intelligent-learning";
import {
  summarizeSkillEvidence,
  type LearningObservation,
} from "../learning-assessments";

export const C_METRIC_VERSION = "c-metrics-1.0";
export interface CAnalyticsEvent {
  eventVersion: "c-analytics-event-v1";
  sourceTable: "canonical_assessment_context" | "intelligent_learning_records";
  sourceId: string;
  sourceRevision: number;
  eventType: "assessment_observed" | "problem_activity" | "project_activity";
  occurredAt: string;
  subject: string;
  skillCode: string | null;
  evidenceClass: "independent" | "assisted" | "learning_only" | "abstained";
  verifiedCorrect: boolean | null;
  transferEligible: boolean;
  retentionDelayDays: number | null;
  activityCompleted: boolean;
  synthetic: true;
  policyVersion: string;
  consentBasis: "synthetic_test_only";
}
export interface CActivityObservation {
  id: string;
  revision: number;
  kind: "problem_session" | "project_run";
  subject: string;
  completed: boolean;
  at: string;
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Take inclusion/dedup decisions from A2, never infer a verdict from C text.
 * Current canonical snapshot replaces a source's old classification atomically.
 * Plain equations, raw responses and reviewer notes never enter this projection. */
export function normalizeCEvents(
  observations: readonly LearningObservation[],
  subject: string,
  reviews: readonly AReview[] = [],
  activities: readonly CActivityObservation[] = [],
): CAnalyticsEvent[] {
  const skills = [...new Set(observations.map((o) => o.skillCode))].map(
    (skillCode) => ({ skillCode, titleAr: "" }),
  );
  const eligible = new Set(
    summarizeSkillEvidence([...observations], skills).flatMap(
      (s) => s.evidenceIds,
    ),
  );
  const result = new Map<string, CAnalyticsEvent>();
  for (const o of [...observations].sort((a, b) =>
    a.time.localeCompare(b.time),
  )) {
    if (!eligible.has(o.evidenceId) || !Number.isFinite(Date.parse(o.time)))
      continue;
    const sourceId = hash((o.attemptId ?? o.problemId) + ":" + o.skillCode);
    const review = reviews.find(
      (r) =>
        r.status === "completed" &&
        r.skillCode === o.skillCode &&
        r.assessmentId === o.assessmentId &&
        r.sourceEvidenceId !== o.evidenceId &&
        Number.isFinite(Date.parse(r.anchorAt)) &&
        Number.isFinite(Date.parse(r.dueAt)) &&
        Date.parse(r.dueAt) > Date.parse(r.anchorAt) &&
        Date.parse(o.time) >= Date.parse(r.dueAt) &&
        observations.some(
          (a) =>
            a.evidenceId === r.sourceEvidenceId &&
            a.outcome === "correct" &&
            a.problemId !== o.problemId,
        ),
    );
    result.set(sourceId, {
      eventVersion: "c-analytics-event-v1",
      sourceTable: "canonical_assessment_context",
      sourceId,
      sourceRevision: o.attemptRevision ?? 0,
      eventType: "assessment_observed",
      occurredAt: o.time,
      subject,
      skillCode: o.skillCode,
      evidenceClass:
        o.outcome === "correct" || o.outcome === "error"
          ? "independent"
          : o.outcome === "assisted"
            ? "assisted"
            : "abstained",
      verifiedCorrect:
        o.outcome === "correct"
          ? true
          : o.outcome === "error"
            ? false
            : o.outcome === "assisted"
              ? (o.verifiedCorrect ?? null)
              : null,
      transferEligible: o.transferEligible === true,
      retentionDelayDays: review
        ? (Date.parse(o.time) - Date.parse(review.anchorAt)) / 86400000
        : null,
      activityCompleted: false,
      synthetic: true,
      policyVersion: "canonical-a2-current",
      consentBasis: "synthetic_test_only",
    });
  }
  for (const activity of activities) {
    if (!Number.isFinite(Date.parse(activity.at))) continue;
    result.set(activity.id, {
      eventVersion: "c-analytics-event-v1",
      sourceTable: "intelligent_learning_records",
      sourceId: activity.id,
      sourceRevision: activity.revision,
      eventType:
        activity.kind === "problem_session"
          ? "problem_activity"
          : "project_activity",
      occurredAt: activity.at,
      subject: activity.subject,
      skillCode: null,
      evidenceClass: "learning_only",
      verifiedCorrect: null,
      transferEligible: false,
      retentionDelayDays: null,
      activityCompleted: activity.completed,
      synthetic: true,
      policyVersion: "c-learning-only-v1",
      consentBasis: "synthetic_test_only",
    });
  }
  return [...result.values()].sort((a, b) =>
    a.sourceId.localeCompare(b.sourceId),
  );
}

export function cMetric(
  metric: string,
  numerator: number,
  denominator: number,
  missingReason: string,
): CMetric {
  return {
    metric,
    metricVersion: C_METRIC_VERSION,
    n: denominator,
    numerator,
    denominator,
    value: denominator ? numerator / denominator : null,
    status: denominator ? "observed" : "not_measured",
    missingReason: denominator ? null : missingReason,
  };
}

/** Replay-safe by source identity. A newer revision supersedes technical abstain;
 * identical/lower revisions never add an extra denominator. */
export function replayCEvents(
  events: readonly CAnalyticsEvent[],
): CAnalyticsEvent[] {
  const latest = new Map<string, CAnalyticsEvent>();
  for (const e of events) {
    const key = e.sourceTable + ":" + e.sourceId + ":" + e.eventType;
    const old = latest.get(key);
    if (
      !old ||
      e.sourceRevision > old.sourceRevision ||
      (e.sourceRevision === old.sourceRevision && e.occurredAt > old.occurredAt)
    )
      latest.set(key, e);
    else if (
      old.sourceRevision === e.sourceRevision &&
      old.occurredAt === e.occurredAt &&
      (old.evidenceClass !== e.evidenceClass ||
        old.verifiedCorrect !== e.verifiedCorrect)
    )
      // Conflicting equal-version deliveries have no trustworthy ordering.
      // Reconciliation will supply canonical state; until then abstain.
      latest.set(key, {
        ...old,
        evidenceClass: "abstained",
        verifiedCorrect: null,
        transferEligible: false,
        retentionDelayDays: null,
      });
  }
  return [...latest.values()];
}

export function projectCMetrics(events: readonly CAnalyticsEvent[]) {
  const current = replayCEvents(events),
    independent = current.filter(
      (e) => e.evidenceClass === "independent" && e.verifiedCorrect !== null,
    ),
    assisted = current.filter(
      (e) => e.evidenceClass === "assisted" && e.verifiedCorrect !== null,
    ),
    transfer = independent.filter((e) => e.transferEligible),
    retention = independent.filter(
      (e) => e.retentionDelayDays !== null && e.retentionDelayDays > 0,
    );
  return {
    metrics: [
      cMetric(
        "independent_success_rate",
        independent.filter((e) => e.verifiedCorrect).length,
        independent.length,
        "no_eligible_independent_attempts",
      ),
      cMetric(
        "assistance_dependency",
        assisted.length,
        independent.length + assisted.length,
        "no_verified_attempts",
      ),
      cMetric(
        "delayed_retention",
        retention.filter((e) => e.verifiedCorrect).length,
        retention.length,
        "no_eligible_delayed_review",
      ),
      cMetric(
        "transfer_success",
        transfer.filter((e) => e.verifiedCorrect).length,
        transfer.length,
        "no_eligible_transfer",
      ),
      ...[
        ["pre_post_delta", "assessment_equating_not_reviewed"],
        ["remediation_effect", "no_comparable_intervention_baseline"],
        ["project_rubric_progress", "rubric_calibration_pending"],
        ["problem_strategy_diversity", "strategy_review_pending"],
        ["accessibility_barriers", "no_reviewed_aggregate_policy"],
        ["coverage_quality", "coverage_threshold_pending"],
      ].map(([metric, reason]) => cMetric(metric!, 0, 0, reason!)),
    ],
    activity: {
      problemCompleted: current.filter(
        (e) => e.eventType === "problem_activity" && e.activityCompleted,
      ).length,
      projectCompleted: current.filter(
        (e) => e.eventType === "project_activity" && e.activityCompleted,
      ).length,
    },
    missingCount: current.filter((e) => e.evidenceClass === "abstained").length,
  };
}
