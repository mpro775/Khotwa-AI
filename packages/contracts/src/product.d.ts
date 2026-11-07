/** Post-hackathon product DTOs. Private answer keys never occur in PublicItem. */
export type SubjectCode = "algebra" | "physics" | "programming";
export type ContentStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "archived";
export interface ContentHint {
  level: 1 | 2 | 3 | 4;
  textAr: string;
  source: "manual" | "ai_suggested";
  reviewed: boolean;
}
export interface PhysicsContent {
  topic: "kinematics_1d";
  formula:
    | "constant_speed_distance"
    | "constant_velocity_displacement"
    | "average_speed"
    | "average_velocity"
    | "final_velocity"
    | "displacement"
    | "acceleration"
    | "elapsed_time";
  quantity:
    | "distance"
    | "displacement"
    | "speed"
    | "velocity"
    | "acceleration"
    | "time";
  expectedDimension: "length" | "time" | "speed" | "acceleration";
  expectedValueSI: string;
  expectedUnit: "m" | "s" | "m/s" | "m/s²" | "km/h";
  tolerance: string;
  givens: Record<string, string>;
  constraints?: { nonNegativeAnswer?: boolean };
}
export interface ProgrammingTest {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}
export interface ContentPayload {
  titleAr: string;
  statementAr: string;
  subject: SubjectCode;
  unitCode: string;
  unitTitleAr: string;
  lessonCode: string;
  lessonTitleAr: string;
  skillCodes: string[];
  difficulty: 1 | 2 | 3;
  kind: "main" | "remediation" | "transfer";
  familyCode: string;
  hints: ContentHint[];
  algebra?: {
    equationRaw: string;
    answerRaw: string;
    validStepRaw: string;
    invalidStepRaw: string;
  };
  physics?: PhysicsContent;
  programming?: {
    starterCode: string;
    referenceCode: string;
    tests: ProgrammingTest[];
    functionName?: string;
  };
}
export interface ContentValidation {
  valid: boolean;
  issues: string[];
  checkedAt: string;
  engine: string;
}
export interface StudioItem {
  id: string;
  itemId: string;
  version: number;
  editRevision: number;
  status: ContentStatus;
  payload: ContentPayload;
  contentHash: string;
  validation: ContentValidation | null;
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
}
export interface PublicItem {
  id: string;
  itemId: string;
  version: number;
  subject: SubjectCode;
  titleAr: string;
  statementAr: string;
  unitCode: string;
  lessonCode: string;
  skillCodes: string[];
  difficulty: number;
  kind: "main" | "remediation" | "transfer";
  algebra?: { equationRaw: string };
  physics?: {
    givens: Record<string, string>;
    quantity: string;
    units: string[];
  };
  programming?: {
    starterCode: string;
    publicTests: { input: string; expectedOutput: string }[];
    functionName?: string;
  };
}
export interface ProductCatalog {
  subjects: {
    code: SubjectCode;
    titleAr: string;
    units: {
      code: string;
      titleAr: string;
      lessons: { code: string; titleAr: string; items: PublicItem[] }[];
    }[];
  }[];
}
export type RunnerStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "compile_error"
  | "runtime_error"
  | "timeout"
  | "resource_limit"
  | "service_error";
export interface ProgrammingResult {
  attemptId: string;
  revision: number;
  mode: "run" | "submit";
  status: RunnerStatus;
  stdout: string;
  stderr: string;
  passed: number;
  total: number;
  allPassed: boolean;
  independent: boolean;
  createdAt: string;
}
