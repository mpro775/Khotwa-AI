export type GoalData = {
  trackRevisionId: string;
  lessonRevisionId: string;
  skillCode: string;
  targetIndependentCount: number;
  textAr: string;
  status: "active" | "achieved" | "skipped";
  baselineEvidenceIds: string[];
  baselineProblemIds?: string[];
  independentCount: number;
  createdAt: string;
  updatedAt: string;
};
export type ReflectionData = {
  trackRevisionId: string;
  goalId: string | null;
  activityId: string | null;
  phase: "predict" | "monitor" | "reflect";
  confidence: number | null;
  textAr: string;
  skipped: boolean;
  verifiedOutcome:
    | "correct"
    | "error"
    | "assisted"
    | "unassessable"
    | "not_tested";
  messageAr: string;
  createdAt: string;
};
export function goalEvidenceCount(
  goal: GoalData,
  observations: {
    evidenceId: string;
    skillCode: string;
    problemId: string;
    outcome: string;
    time: string;
  }[],
): number {
  return new Set(
    observations
      .filter(
        (o) =>
          o.skillCode === goal.skillCode &&
          o.outcome === "correct" &&
          !goal.baselineEvidenceIds.includes(o.evidenceId) &&
          !goal.baselineProblemIds?.includes(o.problemId) &&
          Date.parse(o.time) >= Date.parse(goal.createdAt),
      )
      .map((o) => o.problemId),
  ).size;
}
export function reflectionMessage(
  confidence: number | null,
  outcome: ReflectionData["verifiedOutcome"],
): string {
  if (outcome === "not_tested" || outcome === "unassessable")
    return "توقعك وصف شخصي؛ لا تتوفر نتيجة متحققة للمقارنة الآن.";
  if (confidence !== null && confidence >= 75 && outcome === "error")
    return "توقعك مختلف عن نتيجة السؤال المتحققة؛ ما الخطوة التي ستراجعها؟";
  if (outcome === "assisted")
    return "سُجلت مساعدة في هذا النشاط؛ يمكن تجربة سؤال جديد مستقل لاحقًا.";
  return "قارن توقعك بنتيجة السؤال المتحققة؛ التقدير الذاتي لا يغير صحة الحل.";
}
