export interface PathSelection {
  subject: "algebra" | "physics" | "programming";
  trackId: string | null;
  lessonId: string | null;
  assessmentId: string | null;
}
export interface AnswerDraft {
  steps: string[];
  value: string;
  unit: string;
}
interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export const pathSelectionKey = "khotwa-path:active";
export function readPathSelection(
  storage: DraftStorage,
  key = pathSelectionKey,
): PathSelection | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
    if (
      !value ||
      typeof value !== "object" ||
      !("subject" in value) ||
      !["algebra", "physics", "programming"].includes(String(value.subject))
    )
      return null;
    const p = value as Record<string, unknown>;
    for (const field of ["trackId", "lessonId", "assessmentId"])
      if (p[field] !== null && typeof p[field] !== "string") return null;
    return {
      subject: p.subject as PathSelection["subject"],
      trackId: p.trackId as string | null,
      lessonId: p.lessonId as string | null,
      assessmentId: p.assessmentId as string | null,
    };
  } catch {
    return null;
  }
}
export function readAnswerDraft(
  storage: DraftStorage,
  assessmentId: string,
  questionId: string,
): AnswerDraft | null {
  try {
    const value: unknown = JSON.parse(
      storage.getItem(`khotwa-path:draft:${assessmentId}:${questionId}`) ??
        "null",
    );
    if (!value || typeof value !== "object") return null;
    const p = value as Record<string, unknown>;
    if (
      !Array.isArray(p.steps) ||
      p.steps.length > 24 ||
      p.steps.some((step) => typeof step !== "string" || step.length > 20000) ||
      typeof p.value !== "string" ||
      typeof p.unit !== "string"
    )
      return null;
    return { steps: p.steps as string[], value: p.value, unit: p.unit };
  } catch {
    return null;
  }
}
/** Tab-scoped drafts contain no credentials; identity switches clear the khotwa-path namespace. */
export function writeAnswerDraft(
  storage: DraftStorage,
  assessmentId: string,
  questionId: string,
  draft: AnswerDraft,
): void {
  try {
    storage.setItem(
      `khotwa-path:draft:${assessmentId}:${questionId}`,
      JSON.stringify(draft),
    );
  } catch {
    /* In-memory state remains usable when browser storage is unavailable. */
  }
}
