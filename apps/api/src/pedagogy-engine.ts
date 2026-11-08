export const PEDAGOGY_POLICY = "pedagogy-a1-experimental-v1";
export type ActivityKind =
  | "explanation"
  | "worked_example"
  | "diagnostic_probe"
  | "guided_practice"
  | "prerequisite_repair"
  | "independent_check"
  | "retrieval_review"
  | "challenge"
  | "reflection";
export interface ActivityCandidate {
  labBlockIndex?: number;
  labKind?: string;
  activityKind: ActivityKind;
  lessonRevisionId: string;
  skillCode: string;
  reasonCode: string;
  published: boolean;
  mappingPending: boolean;
  questionCoverage: number;
  novel: boolean;
  reviewed: boolean;
  subject: "algebra" | "physics" | "programming";
  due?: boolean;
  independentError?: boolean;
  ambiguousDiagnosis?: boolean;
  prerequisiteError?: boolean;
  supportedSuccess?: boolean;
  independentSuccess?: boolean;
  recentlyAccepted?: boolean;
  sourceAttemptId?: string | null;
}
const measured = new Set<ActivityKind>([
  "independent_check",
  "retrieval_review",
  "challenge",
]);
export function eligibleCandidates(candidates: readonly ActivityCandidate[]) {
  return candidates.map((candidate) => ({
    candidate,
    rejection: !candidate.published
      ? "unpublished_content"
      : candidate.mappingPending
        ? "mapping_pending"
        : !candidate.reviewed
          ? "unreviewed_content"
          : candidate.subject === "programming" &&
              !(
                candidate.activityKind === "guided_practice" &&
                candidate.labKind &&
                Number.isInteger(candidate.labBlockIndex)
              ) &&
              !["explanation", "worked_example", "reflection"].includes(
                candidate.activityKind,
              )
            ? "runner_read_only"
            : measured.has(candidate.activityKind) &&
                (!candidate.novel || candidate.questionCoverage < 1)
              ? "insufficient_question_coverage"
              : candidate.recentlyAccepted
                ? "activity_cooldown"
                : null,
  }));
}
function priority(c: ActivityCandidate) {
  return c.activityKind === "diagnostic_probe" && c.ambiguousDiagnosis
    ? 0
    : c.activityKind === "prerequisite_repair" && c.prerequisiteError
      ? 1
      : c.activityKind === "retrieval_review" && c.due
        ? 2
        : c.activityKind === "guided_practice" && c.supportedSuccess
          ? 3
          : c.activityKind === "independent_check" && c.independentSuccess
            ? 4
            : c.activityKind === "explanation"
              ? 5
              : c.activityKind === "worked_example"
                ? 6
                : c.activityKind === "guided_practice"
                  ? 7
                  : c.activityKind === "independent_check"
                    ? 8
                    : c.activityKind === "reflection"
                      ? 9
                      : 10;
}
export function decideActivity(candidates: readonly ActivityCandidate[]) {
  const checks = eligibleCandidates(candidates),
    eligible = checks
      .filter((c) => !c.rejection)
      .map((c) => c.candidate)
      .sort(
        (a, b) =>
          priority(a) - priority(b) ||
          a.skillCode.localeCompare(b.skillCode) ||
          a.lessonRevisionId.localeCompare(b.lessonRevisionId) ||
          a.activityKind.localeCompare(b.activityKind),
      );
  return {
    chosen: eligible[0] ?? null,
    alternatives: eligible.slice(1),
    rejected: checks
      .filter((c) => c.rejection)
      .map((c) => ({
        activityKind: c.candidate.activityKind,
        reasonCode: c.rejection!,
      })),
    policyVersion: PEDAGOGY_POLICY,
  };
}
export function activityReason(code: string): string {
  return (
    (
      {
        confirm_possible_misconception:
          "قد يكون للخطأ أكثر من سبب؛ لنجرب سؤالًا قصيرًا قبل اختيار الدعم.",
        prerequisite_review:
          "قد تفيد مراجعة هذه المقدمة بناءً على أدلة مستقلة مسجلة.",
        review_due: "حان موعد مراجعة تجريبية؛ التأخر وحده لا يعني النسيان.",
        supported_practice: "نجاحك السابق كان بمساعدة؛ نجرب الآن دعمًا أقل.",
        additional_evidence:
          "نجمع دليلًا جديدًا مستقلًا دون افتراض إتقان دائم.",
        introduction: "الأدلة محدودة؛ يمكنك البدء بشرح منشور.",
        subject_lab_practice:
          "جرّب نشاطًا تخصصيًا منشورًا للفهم؛ نتيجته تدريب وليست قياسًا مستقلًا.",
        no_safe_activity: "لا يوجد نشاط منشور آمن متاح لهذه الحالة حاليًا.",
      } as Record<string, string>
    )[code] ?? "اقتراح تعليمي مبني على الأدلة الحالية، ويمكنك اختيار بديل آمن."
  );
}
