import type { SubjectCode } from "./product";
import type { AssessmentSession } from "./learning-assessments";

export type ActivityKind =
  | "explanation"
  | "worked_example"
  | "diagnostic_probe"
  | "guided_practice"
  | "prerequisite_repair"
  | "independent_check"
  | "retrieval_review"
  | "challenge"
  | "reflection";
export interface ActivityAlternative {
  activityKind: ActivityKind;
  lessonRevisionId: string | null;
  skillCode: string | null;
  reasonCode: string;
}
export interface NextActivityDecision {
  id: string;
  decisionId: string;
  revision: number;
  trackRevisionId: string;
  policyVersion: string;
  evidenceFingerprint: string;
  sourceAttemptId: string | null;
  mappingSnapshotHash: string;
  activityKind: ActivityKind | "no_safe_activity";
  lessonRevisionId: string | null;
  skillCode: string | null;
  reasonCode: string;
  reasonAr: string;
  alternatives: ActivityAlternative[];
  expiresAt: string;
}
export interface LearningActivity {
  id: string;
  revision: number;
  decisionId: string;
  trackRevisionId: string;
  activityKind: ActivityKind;
  lessonRevisionId: string | null;
  skillCode: string | null;
  status: "active" | "completed";
  assessmentId: string | null;
  assistanceLevel: number;
  sourceAttemptId: string | null;
  createdAt: string;
}
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
export interface MasteryResponse {
  trackRevisionId: string;
  modelVersion: string;
  evidenceFingerprint: string;
  computedAt: string;
  skills: LearnerSkillProjection[];
}
export interface KnowledgeGraph {
  trackRevisionId: string;
  graphVersion: string;
  mappingSnapshotHash: string;
  nodes: {
    skillCode: string;
    titleAr: string;
    subject: SubjectCode;
    lessonRevisionId: string | null;
    reviewState: "reviewed" | "mapping_pending" | "missing_coverage";
  }[];
  edges: {
    fromSkill: string;
    toSkill: string;
    relationKind: "required" | "helpful" | "cross_subject_support";
    rationaleAr: string;
    reviewState: "reviewed" | "pending";
  }[];
  issues: string[];
}
export interface DeepDiagnosis {
  attemptId: string;
  attemptRevision: number;
  state:
    | "candidate"
    | "probe_offered"
    | "probe_answered"
    | "unresolved"
    | "technical_abstain"
    | "review_blocked";
  candidateCauses: {
    errorCode: string;
    candidateSkillCodes: string[];
    basisEvidenceIds: string[];
    confidenceLabel: "possible" | "supported" | "unresolved";
  }[];
  probeId: string | null;
  nextIntervention:
    | "clarifying_question"
    | "short_explanation"
    | "targeted_practice"
    | "no_safe_probe";
  policyVersion: string;
}
export interface AReview {
  id: string;
  revision: number;
  trackRevisionId: string;
  lessonRevisionId: string;
  skillCode: string;
  sourceEvidenceId: string;
  policyVersion: string;
  dueAt: string;
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
  anchorAt: string;
  stepIndex: number;
}
export interface AReviewList {
  policyVersion: string;
  reviews: AReview[];
}
export interface AScaffoldSession {
  id: string;
  revision: number;
  trackRevisionId: string;
  lessonRevisionId: string;
  skillCode: string;
  stage: "S0" | "S1" | "S2" | "S3" | "S4";
  status: "active" | "completed" | "unverified";
  contentVersion: number;
  problemRaw: string | null;
  visibleSteps: { raw: string; explanationAr: string }[];
  supportCount: number;
  assessmentId: string | null;
  independentEligible: boolean;
  messageAr: string;
}
export interface ATutorSession {
  id: string;
  revision: number;
  trackRevisionId: string;
  lessonRevisionId: string;
  skillCode: string;
  state: "awaiting_student" | "completed" | "safe_handoff" | "failed";
  hintLevel: 0 | 1 | 2 | 3 | 4;
  turnCount: number;
  maxTurns: number;
  assistance: true;
  source: "offline_reviewed_template" | "synthetic_template";
  turns: { role: "tutor" | "student"; textAr: string; hintLevel: number }[];
  assessmentId: string | null;
  messageAr: string;
}
export interface AGoal {
  id: string;
  revision: number;
  trackRevisionId: string;
  lessonRevisionId: string;
  skillCode: string;
  targetIndependentCount: number;
  textAr: string;
  status: "active" | "achieved" | "skipped";
  independentCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface AReflection {
  id: string;
  trackRevisionId: string;
  activityId: string | null;
  goalId: string | null;
  phase: "predict" | "monitor" | "reflect";
  confidence: number | null;
  textAr: string;
  skipped: boolean;
  verifiedOutcome:
    | "correct"
    | "error"
    | "assisted"
    | "unassessable"
    | "not_tested";
  messageAr: string;
  createdAt: string;
}
export interface AStartedActivity {
  activity: LearningActivity;
  assessment: AssessmentSession;
}
