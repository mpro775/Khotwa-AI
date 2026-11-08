import type { SubjectCode } from "./product";

export interface StemLabBlock {
  schemaVersion: "subject-lab-v1";
  subject: SubjectCode;
  labKind: string;
  objectiveAr: string;
  familyCode: string;
  skillCodes: string[];
  /** Author-side only; omitted completely from public lesson DTOs. */
  domainSpec?: Record<string, unknown>;
}
export interface StemLabActivity extends StemLabBlock {
  activityRevisionId: string;
  blockIndex: number;
  domainSpec: Record<string, unknown>;
}
export interface StemLabCapabilities {
  schemaVersion: "subject-lab-v1";
  math: boolean;
  physics: boolean;
  codingNonExecuting: boolean;
  runnerBridge: false;
  phet: false;
  reasonCode: "synthetic_review_required";
}
export interface StemLabResult {
  result:
    | "correct_practice"
    | "incorrect_practice"
    | "needs_review"
    | "cannot_determine";
  domainVerifier: string;
  reasonCode: string;
  feedbackAr: string;
  evidenceClass: "learning_only";
  details?: Record<string, unknown>;
}
export type StemLabEventKind =
  | "prediction_submitted"
  | "simulation_revealed"
  | "simulation_parameter_changed"
  | "scaffold_revealed"
  | "trace_step_revealed"
  | "observation_saved"
  | "explanation_saved";
export interface StemLabSession {
  id: string;
  revision: number;
  trackRevisionId: string;
  lessonRevisionId: string;
  blockIndex: number;
  subject: SubjectCode;
  labKind: string;
  stage: "opened" | "prediction_saved" | "revealed" | "explained" | "submitted";
  activity: StemLabActivity;
  prediction: string | null;
  parameters: Record<string, number>;
  observation: string | null;
  explanation: string | null;
  assistanceLevel: number;
  resultRevealed: boolean;
  artifact: Record<string, unknown> | null;
  result: StemLabResult | null;
  answer: Record<string, unknown> | null;
  evidenceClass: "learning_only";
  transfer: { available: boolean; reasonCode: string };
}
