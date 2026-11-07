import type { Schema } from "./contracts";

export interface TutoringPlan {
  judgment: "error_verified" | "no_error" | "unknown";
  interpretation: "misconception_candidate" | "unknown";
  recommendation:
    | "try_step"
    | "hint_h1"
    | "hint_h2"
    | "hint_h3"
    | "remediation";
  reasonAr: string;
  recentVerifiedErrors: number;
  previousHintLevel: number;
}
/** Historical observations affect help selection, never the current verdict or
 * a claim of permanent weakness. Technical abstentions provide no error count. */
export function adaptiveTutoring(
  current: Schema<"VerificationReport"> | null,
  recent: Pick<Schema<"VerificationReport">, "transitions">[],
  previousHintLevel: number,
): TutoringPlan {
  const blocking = current?.transitions.find(
    (t) => t.mathStatus !== "verified_valid",
  );
  const judge =
    !current ||
    !current.transitions.length ||
    (blocking && blocking.mathStatus !== "verified_invalid")
      ? "unknown"
      : blocking
        ? "error_verified"
        : "no_error";
  const recentVerifiedErrors = recent
    .slice(0, 3)
    .filter(
      (r) =>
        r.transitions.find((t) => t.mathStatus !== "verified_valid")
          ?.mathStatus === "verified_invalid",
    ).length;
  const candidate =
    judge === "error_verified" &&
    !!current?.diagnosisCandidate?.errorCode &&
    !["unresolved", "rejected"].includes(current.diagnosisCandidate.state);
  const previous = Math.max(0, Math.min(4, Math.trunc(previousHintLevel)));
  let recommendation: TutoringPlan["recommendation"] = "try_step";
  let reasonAr =
    judge === "unknown"
      ? "أكمل خطوة قابلة للتحقق أولًا؛ تعذر الخدمة أو الصيغة لا يدل على تعثر مفاهيمي."
      : "واصل بخطوة جديدة؛ صحة خطوة واحدة دليل محدود على هذه المحاولة.";
  if (judge === "error_verified") {
    recommendation =
      recentVerifiedErrors >= 2 && previous >= 2
        ? "remediation"
        : previous === 0
          ? "hint_h1"
          : previous === 1
            ? "hint_h2"
            : previous === 2
              ? "hint_h3"
              : "remediation";
    reasonAr =
      recommendation === "remediation"
        ? "تكررت الحاجة إلى المراجعة بعد المساعدة؛ قد يفيد تمرين أقصر على المهارة نفسها."
        : candidate
          ? "هناك قرينة محتملة في هذا الانتقال؛ لنراجع الفكرة تدريجيًا دون الجزم بسبب الخطأ."
          : "ثبت اختلاف الانتقال، لكن السبب غير واضح؛ نبدأ بتوجيه عام قصير.";
  }
  return {
    judgment: judge,
    interpretation: candidate ? "misconception_candidate" : "unknown",
    recommendation,
    reasonAr,
    recentVerifiedErrors,
    previousHintLevel: previous,
  };
}
