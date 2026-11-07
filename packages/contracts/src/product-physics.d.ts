export type PhysicsStatus =
  | "correct"
  | "wrong_value"
  | "wrong_unit"
  | "unsupported"
  | "invalid_input"
  | "service_error";
export interface PhysicsProblem {
  id: string;
  problemId: string;
  revisionId: string;
  code: string;
  titleAr: string;
  statementAr: string;
  unitCode: string;
  lessonCode: string;
  lessonTitleAr: string;
  skillCodes: string[];
  difficulty: number;
  quantity: string;
  givens: Record<string, string>;
  allowedUnits: string[];
}
export interface PhysicsAttempt {
  id: string;
  problemRevisionId: string;
  revision: number;
  status: PhysicsStatus;
  valueCorrect: boolean | null;
  unitCorrect: boolean | null;
  messageAr: string;
  diagnosis: {
    state: "possible" | "unresolved";
    code: string | null;
    messageAr: string;
  };
  independentEvidence: boolean;
  assistanceLevel: number;
}
export interface PhysicsHint {
  attemptId: string;
  revision: number;
  level: 1 | 2 | 3 | 4;
  textAr: string;
  source: "reviewed_template";
  independentEvidence: false;
  reasonAr: string;
}
