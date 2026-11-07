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
  /** Omitted/null keeps the legacy general-purpose hint. */
  errorCode?:
    | "ERR-ALG-01"
    | "ERR-ALG-02"
    | "ERR-ALG-03"
    | "ERR-ALG-04"
    | "ERR-ALG-05"
    | "ERR-ALG-06"
    | null;
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
  /** Author/admin-only projection; never part of ProgrammingResult. */
  programming?: ProgrammingValidation;
}
export interface ProgrammingValidation {
  status: RunnerStatus;
  passed: number;
  total: number;
  allPassed: boolean;
  public: { passed: number; total: number };
  hidden: { passed: number; total: number };
  cases: {
    index: number;
    visibility: "public" | "hidden";
    status: RunnerStatus;
    passed: boolean;
    executed: boolean;
  }[];
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
