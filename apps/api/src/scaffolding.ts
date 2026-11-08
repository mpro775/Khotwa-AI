import type { LessonPayload } from "../../../packages/contracts/src/learning-paths";
export const SCAFFOLD_POLICY = "scaffold-a6-synthetic-v1";
export type ScaffoldStage = "S0" | "S1" | "S2" | "S3" | "S4";
export type ScaffoldData = {
  trackRevisionId: string;
  lessonRevisionId: string;
  skillCode: string;
  stage: ScaffoldStage;
  status: "active" | "completed" | "unverified";
  contentVersion: number;
  contentHash: string;
  lessonSnapshot: LessonPayload;
  revealedCount: number;
  supportCount: number;
  assessmentId: string | null;
  assessmentGeneration?: number;
  independentEligible: boolean;
  messageAr: string;
  policyVersion: string;
  supportHistory: { kind: string; occurredAt: string; stage: ScaffoldStage }[];
};
export function workedSteps(
  lesson: LessonPayload,
): { raw: string; explanationAr: string }[] {
  return (
    lesson.contentBlocks.find(
      (b) =>
        ["worked_steps", "math_example", "completion_step"].includes(b.type) &&
        b.steps?.length,
    )?.steps ?? []
  );
}
export function workedExampleRaw(lesson: LessonPayload): string | null {
  return (
    lesson.contentBlocks.find(
      (b) =>
        ["worked_steps", "math_example", "completion_step"].includes(b.type) &&
        b.steps?.length,
    )?.raw ?? null
  );
}
export function revealScaffold(data: ScaffoldData, at: Date): ScaffoldData {
  if (data.status !== "active") throw new Error("Scaffold is not active");
  const total = workedSteps(data.lessonSnapshot).length;
  if (data.revealedCount >= total) return data;
  return {
    ...data,
    revealedCount: data.revealedCount + 1,
    supportCount: data.supportCount + 1,
    independentEligible: false,
    supportHistory: [
      ...data.supportHistory,
      {
        kind: "revealed_worked_step",
        occurredAt: at.toISOString(),
        stage: data.stage,
      },
    ],
    messageAr: "هذه خطوة معروضة للمساعدة؛ لا تُحسب أداءً مستقلًا.",
  };
}
export function scaffoldStageEligible(
  stage: ScaffoldStage,
  correct: boolean,
  independent: boolean,
): boolean {
  if (stage === "S0") return true;
  if (!correct) return false;
  return stage !== "S4" || independent;
}
export function nextScaffoldStage(stage: ScaffoldStage): ScaffoldStage {
  const stages: ScaffoldStage[] = ["S0", "S1", "S2", "S3", "S4"];
  return stages[Math.min(stages.indexOf(stage) + 1, 4)]!;
}
