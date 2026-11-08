import type { ProblemStage } from "./display-preferences";

interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface ProblemDraft {
  schemaVersion: "c-local-problem-draft-v1";
  sessionId: string;
  baseRevision: number;
  answers: Partial<Record<ProblemStage, string>>;
  answer: string;
  unit: string;
}
export interface ProjectDraft {
  schemaVersion: "c-local-project-draft-v1";
  sessionId: string;
  baseRevision: number;
  notes: Record<string, string>;
  artifact: string;
  milestoneCode: string;
  isFinal: boolean;
}
type LocalDraft = ProblemDraft | ProjectDraft;
const stages: ProblemStage[] = [
  "frame",
  "plan",
  "investigate",
  "justify",
  "reflect",
];
export const draftKey = (
  kind: "problem" | "project",
  track: string,
  lesson: string,
  index: number,
) => `khotwa-path:c:draft:${kind}:${track}:${lesson}:${index}`;
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max)
    throw new Error("invalid_draft");
  return value;
}
function texts(
  value: unknown,
  maxCount: number,
  maxLength: number,
): Record<string, string> {
  if (!isObject(value) || Object.keys(value).length > maxCount)
    throw new Error("invalid_draft");
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      text(key, 80),
      text(item, maxLength),
    ]),
  );
}
/** Read only after the server has authorized the exact session ID. A cache is never evidence. */
export function readLocalDraft(
  storage: DraftStorage,
  key: string,
  sessionId: string,
): LocalDraft | null {
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > 196608) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isObject(parsed) ||
      parsed.sessionId !== sessionId ||
      !Number.isInteger(parsed.baseRevision) ||
      Number(parsed.baseRevision) < 0
    )
      return null;
    const common = { sessionId, baseRevision: Number(parsed.baseRevision) };
    if (parsed.schemaVersion === "c-local-problem-draft-v1") {
      const input = texts(parsed.answers, 5, 3000);
      if (
        Object.keys(input).some((key) => !stages.includes(key as ProblemStage))
      )
        return null;
      return {
        ...common,
        schemaVersion: "c-local-problem-draft-v1",
        answers: input,
        answer: text(parsed.answer, 16000),
        unit: text(parsed.unit, 20),
      };
    }
    if (
      parsed.schemaVersion === "c-local-project-draft-v1" &&
      typeof parsed.isFinal === "boolean"
    )
      return {
        ...common,
        schemaVersion: "c-local-project-draft-v1",
        notes: texts(parsed.notes, 16, 2000),
        artifact: text(parsed.artifact, 16000),
        milestoneCode: text(parsed.milestoneCode, 80),
        isFinal: parsed.isFinal,
      };
  } catch {
    /* A disabled/quota-limited cache never prevents server saving. */
  }
  return null;
}
export function writeLocalDraft(
  storage: DraftStorage,
  key: string,
  draft: LocalDraft | null,
): void {
  try {
    if (!key.startsWith("khotwa-path:c:draft:")) return;
    if (draft === null) storage.removeItem(key);
    else {
      // Project only the student's pending fields, even if a caller passes extra properties.
      const value =
        draft.schemaVersion === "c-local-problem-draft-v1"
          ? {
              schemaVersion: draft.schemaVersion,
              sessionId: draft.sessionId,
              baseRevision: draft.baseRevision,
              answers: Object.fromEntries(
                stages.flatMap((stage) =>
                  draft.answers[stage] === undefined
                    ? []
                    : [[stage, draft.answers[stage]]],
                ),
              ),
              answer: draft.answer,
              unit: draft.unit,
            }
          : {
              schemaVersion: draft.schemaVersion,
              sessionId: draft.sessionId,
              baseRevision: draft.baseRevision,
              notes: draft.notes,
              artifact: draft.artifact,
              milestoneCode: draft.milestoneCode,
              isFinal: draft.isFinal,
            };
      const raw = JSON.stringify(value);
      if (raw.length <= 196608) storage.setItem(key, raw);
    }
  } catch {
    /* Current in-memory input remains available if storage is unavailable. */
  }
}
