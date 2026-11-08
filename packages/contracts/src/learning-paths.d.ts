import type { ContentStatus, PhysicsContent, SubjectCode } from "./product";

export interface LessonBlock {
  type:
    | "paragraph"
    | "heading"
    | "math_example"
    | "worked_steps"
    | "key_point"
    | "common_mistake"
    | "practice_link"
    | "code_example"
    | "physics_example"
    | "completion_step"
    | "worked_example_ref"
    | "self_check_prompt";
  textAr: string;
  raw?: string;
  steps?: { raw: string; explanationAr: string }[];
  code?: string;
  physics?: PhysicsContent;
  problemRevisionId?: string;
}
export interface LessonPayload {
  kind: "lesson";
  subject: SubjectCode;
  code: string;
  titleAr: string;
  descriptionAr: string;
  objectives: string[];
  skillCodes: string[];
  prerequisiteSkillCodes: string[];
  prerequisiteLessonIds: string[];
  contentBlocks: LessonBlock[];
  practiceProblemRevisionIds: string[];
  assessmentProblemRevisionIds: string[];
  errorCodes: string[];
  mappingPending: string[];
}
export interface TrackPayload {
  kind: "track";
  subject: SubjectCode;
  code: string;
  titleAr: string;
  descriptionAr: string;
  units: { code: string; titleAr: string; lessonRevisionIds: string[] }[];
}
export type LearningContentPayload = LessonPayload | TrackPayload;
export interface LearningContentValidation {
  valid: boolean;
  issues: string[];
  checkedAt: string;
  engine: string;
  examples: {
    blockIndex: number;
    normalizedText: string | null;
    displayAr: string | null;
    ast: Record<string, unknown> | null;
    status: string;
    stepStatuses: string[];
  }[];
}
export interface LearningContentRevision {
  id: string;
  itemId: string;
  version: number;
  editRevision: number;
  status: ContentStatus;
  payload: LearningContentPayload;
  contentHash: string;
  validation: LearningContentValidation | null;
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
}
export interface LearningBankProblem {
  revisionId: string;
  problemId: string;
  source: "algebra" | "studio";
  subject: SubjectCode;
  titleAr: string;
  statementAr: string;
  skillCodes: string[];
  primarySkillCode: string;
  difficulty: number;
  kind: "main" | "remediation" | "transfer" | "diagnostic";
  familyCode: string;
  equationRaw?: string;
  physics?: {
    quantity: string;
    givens: Record<string, string>;
    allowedUnits: string[];
  };
  programming?: {
    starterCode: string;
    publicTests: { input: string; expectedOutput: string }[];
  };
}
export interface LearningTrackDetail extends LearningContentRevision {
  lessons: LearningContentRevision[];
}
export interface LearningLessonDetail extends LearningContentRevision {
  practiceProblems: LearningBankProblem[];
  assessmentProblems: LearningBankProblem[];
}
export interface LearningSkillMap {
  ruleVersion: string;
  mappingPending: string[];
  skills: {
    skillCode: string;
    titleAr: string;
    prerequisiteSkillCodes: string[];
    lessonRevisionId: string | null;
  }[];
  errors: {
    errorCode: string;
    candidateSkills: string[];
    mappingPending: boolean;
  }[];
}
