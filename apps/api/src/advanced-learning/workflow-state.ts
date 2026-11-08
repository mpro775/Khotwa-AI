import type { CProblemStage } from "../../../../packages/contracts/src/advanced-learning-sessions";
import type { SubjectCode } from "../../../../packages/contracts/src/product";
import type { StemLabResult } from "../../../../packages/contracts/src/stem-labs";
import { ApiFault } from "../http";
import { productInvalid, record, textField } from "../product-core";

export const C_POLICY = "advanced-learning-workflow-1.0";
export const C_STAGES: CProblemStage[] = [
  "frame",
  "plan",
  "investigate",
  "justify",
  "reflect",
];
export interface CBaseData {
  trackRevisionId: string;
  lessonRevisionId: string;
  blockIndex: number;
  contentHash: string;
  policyVersion: typeof C_POLICY;
  familyCode: string;
  exposedFamilies?: string[];
  subject: SubjectCode;
  contextExposures: { key: string; at: string }[];
  assistanceLevel: number;
  eventCount: number;
  lastEvent: string;
  assessmentId?: string;
}
export interface ProblemData extends CBaseData {
  stage: CProblemStage;
  status: "active" | "paused" | "abandoned" | "completed";
  answers: Partial<Record<CProblemStage, string>>;
  supportAr: string | null;
  supportLinks?: { kind: "scaffold" | "tutor" | "reflection"; id: string }[];
  result: StemLabResult | null;
  answer: Record<string, unknown> | null;
  domainVerification: Record<string, unknown>[];
}
export interface ProjectData extends CBaseData {
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
  feedbackSeen: boolean;
  submissionCount: number;
}
export function cState(message = "لا يسمح وضع النشاط بهذه العملية."): never {
  throw new ApiFault(409, "invalid_state", message);
}
export function cBudget(data: CBaseData): void {
  if (data.eventCount >= 200)
    throw new ApiFault(
      429,
      "rate_limited",
      "بلغ النشاط حد التفاعلات؛ ابدأ نشاطًا جديدًا.",
    );
}
export function applyProblemStep(
  data: ProblemData,
  stage: unknown,
  text: unknown,
  action = "save",
): ProblemData {
  if (!C_STAGES.includes(stage as CProblemStage)) throw productInvalid();
  const next = structuredClone(data);
  cBudget(next);
  if (["completed", "abandoned"].includes(next.status)) cState();
  if (
    !["save", "pause", "resume", "abandon", "hint", "reveal"].includes(action)
  )
    throw productInvalid();
  if (next.status === "paused" && !["resume", "abandon"].includes(action))
    cState("استأنف النشاط قبل التعديل.");
  if (action === "pause") next.status = "paused";
  else if (action === "resume") {
    if (next.status !== "paused") cState();
    next.status = "active";
  } else if (action === "abandon") next.status = "abandoned";
  else if (action === "save") {
    next.answers[stage as CProblemStage] = textField(text, 3000);
    next.stage = stage as CProblemStage;
    // Revising any prior work invalidates feedback on that work immediately.
    next.result = null;
    next.domainVerification = [];
  }
  next.eventCount++;
  next.lastEvent =
    action === "save" ? "problem_stage_saved" : "problem_" + action;
  return next;
}
export function validateProjectArtifact(
  kind: unknown,
  value: unknown,
): string | Record<string, unknown> {
  if (kind === "text") {
    const result = textField(value, 16000);
    if (Buffer.byteLength(JSON.stringify(result)) > 32768)
      throw productInvalid("المنتج أكبر من الحد المسموح.");
    return result;
  }
  if (kind !== "json")
    throw productInvalid("نوع المنتج غير مدعوم؛ استخدم نصًا أو JSON.");
  const root = record(value);
  const visit = (input: unknown, depth: number): void => {
    if (depth > 6) throw productInvalid("بنية المنتج عميقة جدًا.");
    if (typeof input === "string") {
      textField(input, 16000, 0);
      return;
    }
    if (input === null || typeof input === "boolean") return;
    if (typeof input === "number" && Number.isFinite(input)) return;
    if (Array.isArray(input)) {
      if (input.length > 100) throw productInvalid();
      input.forEach((v) => visit(v, depth + 1));
      return;
    }
    const item = record(input),
      entries = Object.entries(item);
    if (entries.length > 40) throw productInvalid();
    for (const [key, v] of entries) {
      if (
        !/^[\p{L}\p{N}_ -]{1,80}$/u.test(key) ||
        [
          "__proto__",
          "constructor",
          "prototype",
          "privateRubric",
          "solutionKey",
          "hiddenTests",
          "referenceCode",
          "privateValidation",
        ].includes(key)
      )
        throw productInvalid("يتضمن المنتج مفتاحًا غير مسموح.");
      visit(v, depth + 1);
    }
  };
  visit(root, 0);
  if (Buffer.byteLength(JSON.stringify(root)) > 32768)
    throw productInvalid("المنتج أكبر من الحد المسموح.");
  return structuredClone(root);
}
