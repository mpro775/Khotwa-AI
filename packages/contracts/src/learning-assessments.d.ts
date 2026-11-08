import type { SubjectCode } from "./product";
import type { LearningBankProblem } from "./learning-paths";

export type AssessmentKind =
  | "diagnostic_pretest"
  | "lesson_check"
  | "post_remediation"
  | "independent_check"
  | "retrieval_review"
  | "practice";
export type LearningEvidenceState =
  | "not_assessed"
  | "needs_review"
  | "practicing_with_support"
  | "independent_evidence"
  | "insufficient_evidence";
export interface AssessmentQuestion {
  id: string;
  problem: LearningBankProblem;
  attemptId: string | null;
  steps: string[];
  value: string;
  unit: string;
  status: string | null;
  independent: boolean;
  supportLevel: number;
  completed: boolean;
}
export interface AssessmentSession {
  id: string;
  revision: number;
  subject: SubjectCode;
  kind: AssessmentKind;
  trackRevisionId: string;
  lessonRevisionId: string | null;
  status: "active" | "completed";
  mode: "independent" | "practice";
  questions: AssessmentQuestion[];
  coverage: {
    requested: number;
    available: number;
    partial: boolean;
    messageAr: string;
  };
  createdAt: string;
}
export interface LearningSkillEvidence {
  skillCode: string;
  titleAr: string;
  state: LearningEvidenceState;
  independentCorrect: number;
  independentErrors: number;
  assisted: number;
  evidenceIds: string[];
  source: string;
}
export interface LearningRecommendation {
  recommendedLessonId: string;
  targetSkillCode: string;
  reasonCode:
    | "repeated_independent_error"
    | "tentative_review"
    | "prerequisite_review"
    | "additional_evidence"
    | "introduction";
  reasonAr: string;
  confidence: "tentative";
  evidenceCount: number;
  evidenceIds: string[];
  ruleVersion: string;
  mappingPending: string[];
  nextAction: "study_lesson";
  alternatives: { lessonRevisionId: string; titleAr: string }[];
}
export interface AssessmentSummary {
  session: AssessmentSession;
  skills: LearningSkillEvidence[];
  recommendation: LearningRecommendation | null;
}
export interface LearningPathProgress {
  skills: LearningSkillEvidence[];
  recommendation: LearningRecommendation | null;
  lessons: {
    lessonRevisionId: string;
    state: "not_started" | "viewed" | "practiced" | "independent_evidence";
    viewedAt: string | null;
  }[];
  ruleVersion: string;
}
