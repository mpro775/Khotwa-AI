import type { SubjectCode } from "./product";

export type CStage = "frame" | "plan" | "investigate" | "justify" | "reflect";
export interface CRepresentation {
  code: string;
  kind: "text" | "table" | "diagram" | "stem_lab" | "code";
  titleAr: string;
  accessibleText: string;
  learningObjective: string;
  targetSkillCodes: string[];
  sameConstruct: boolean;
  assistanceExposure: boolean;
  evaluationMode: "learning_only";
  textAr?: string;
  altText?: string;
  columns?: string[];
  rows?: string[][];
  labBlockIndex?: number;
  codeText?: string;
}
export interface CRepresentationSet {
  schemaVersion: "udl-representation-v1";
  learningObjective: string;
  targetSkillCodes: string[];
  variants: CRepresentation[];
  responseModes: ("text" | "choice" | "equation" | "code_text")[];
}
export interface CRubricCriterion {
  code: string;
  titleAr: string;
  descriptionAr: string;
  levels: { code: string; labelAr: string; descriptionAr: string }[];
}
export interface CPrivateEvaluation {
  solutionKey?: string;
  privateRubric?: { criterionCode: string; noteAr: string }[];
  hints?: { level: "H0" | "H1" | "H2" | "H3" | "H4"; textAr: string }[];
  referenceCode?: string;
  hiddenTests?: { input: string; expectedOutput: string }[];
}
export interface CActivityBase {
  schemaVersion: "c-activity-v1";
  subject: SubjectCode;
  code: string;
  titleAr: string;
  objectives: string[];
  skillCodes: string[];
  prerequisiteSkillCodes: string[];
  publicBriefAr: string;
  familyCode: string;
  supportPolicy: {
    hintsAllowed: boolean;
    revealMode: "after_submit" | "teacher_only";
  };
  representations: CRepresentation[];
  publicRubric: CRubricCriterion[];
  privateEvaluation?: CPrivateEvaluation;
}
export interface CProblemActivity extends CActivityBase {
  type: "problem_based";
  scenarioAr: string;
  constraints: string[];
  stages: CStage[];
  verification:
    | { kind: "none" }
    | { kind: "bank_problem"; problemRevisionId: string }
    | { kind: "stem_lab"; blockIndex: number };
}
export interface CProjectActivity extends CActivityBase {
  type: "project_based";
  projectLevel: "micro" | "multi_lesson";
  drivingQuestionAr: string;
  milestones: {
    code: string;
    titleAr: string;
    descriptionAr: string;
    requiredArtifactKind: "text" | "json";
    required: boolean;
  }[];
  lessonRevisionIds: string[];
}
export type CActivity = CProblemActivity | CProjectActivity;
export type CPublicActivity =
  | Omit<CProblemActivity, "privateEvaluation">
  | Omit<CProjectActivity, "privateEvaluation">;
export interface CContentReview {
  id: string;
  revisionId: string;
  reviewerId: string;
  reviewerRole: "admin" | "content_manager";
  scope: "subject" | "pedagogy" | "accessibility" | "security";
  contentHash: string;
  decision: "approve" | "changes_requested";
  notesAr: string;
  reviewMode: "TEST_ONLY";
  reviewedAt: string;
}
export interface CMetric {
  metric: string;
  metricVersion: string;
  n: number;
  numerator: number;
  denominator: number;
  value: number | null;
  status: "observed" | "not_measured" | "suppressed";
  missingReason: string | null;
}
export interface CAnalyticsDashboard {
  schemaVersion: "learning-metrics-v1";
  metricVersion: "c-metrics-1.0";
  trackRevisionId: string;
  generatedAt: string;
  window: { from: string; to: string; days: number };
  synthetic: true;
  metrics: CMetric[];
  activity: {
    problemCompleted: number;
    projectCompleted: number;
    projectSubmitted: number;
  };
  provenance: string[];
  missingCount: number;
  notesAr: string[];
}
export interface CContentAnalytics {
  schemaVersion: "learning-metrics-v1";
  revisionId: string;
  synthetic: true;
  status: "suppressed";
  reasonCode: "privacy_threshold_pending";
  metrics: [];
  quality: {
    problemActivities: number;
    projectActivities: number;
    representationSets: number;
  };
  generatedAt: string;
}
