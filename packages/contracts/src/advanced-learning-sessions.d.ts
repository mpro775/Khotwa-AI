import type { CPublicActivity } from "./advanced-learning";
import type { StemLabResult } from "./stem-labs";

export type CProblemStage =
  | "frame"
  | "plan"
  | "investigate"
  | "justify"
  | "reflect";
export interface CActivityBrief {
  lessonRevisionId: string;
  blockIndex: number;
  activity: CPublicActivity;
}
export interface CProblemSession extends CActivityBrief {
  id: string;
  revision: number;
  trackRevisionId: string;
  stage: CProblemStage;
  status: "active" | "paused" | "abandoned" | "completed";
  answers: Partial<Record<CProblemStage, string>>;
  assistanceLevel: number;
  supportAr: string | null;
  supportLinks?: { kind: "scaffold" | "tutor" | "reflection"; id: string }[];
  assessmentId?: string;
  result: StemLabResult | null;
  evidenceClass: "learning_only";
  readOnly: boolean;
  transfer: {
    available: false;
    reasonCode: "assessment_service_rechecks_novelty";
  };
}
export interface CProjectSubmission {
  id: string;
  revision: number;
  milestoneCode: string;
  artifactKind: "text" | "json";
  artifact: string | Record<string, unknown>;
  isFinal: boolean;
  status: "awaiting_feedback" | "revision_requested" | "accepted";
  createdAt: string;
  review: CProjectReview | null;
}
export interface CProjectReview {
  id: string;
  rubricRevisionId: string;
  assessedSubmissionRevision: number;
  reviewerRole: string;
  decision: "revision_requested" | "accepted";
  criteria: { criterionCode: string; levelCode: string; reasonAr: string }[];
  feedbackAr: string;
  reviewedAt: string;
}
export interface CProjectRun extends CActivityBrief {
  id: string;
  revision: number;
  trackRevisionId: string;
  status:
    | "active"
    | "paused"
    | "withdrawn"
    | "awaiting_feedback"
    | "revision_requested"
    | "review_pending"
    | "feedback_ready"
    | "completed";
  milestones: Record<string, string>;
  submissions: CProjectSubmission[];
  assistanceLevel: number;
  feedbackSeen: boolean;
  assessmentId?: string;
  evidenceClass: "learning_only";
  readOnly: boolean;
}
