import { ApiFault } from "./http";
import type { Schema } from "./contracts";
export const TUTORING_POLICY = "tutoring-p0-0.7.0";
export const HINT_PROMPT_VERSION = "hint-rephrase-1.1.0";
export function matchesHintErrorCode(
  errorCode: string | null,
  pattern: string | null,
): boolean {
  return errorCode === null || (pattern !== null && errorCode === pattern);
}
export function nextHintLevel(
  input: Schema<"HintInput">,
  kind: Schema<"Attempt">["kind"],
  previous: number,
  assessable: boolean,
  openProbe: boolean,
): 1 | 2 | 3 | 4 {
  if (!assessable)
    throw new ApiFault(
      409,
      "invalid_state",
      "أصلح الصيغة أو أعد التحقق أولًا؛ التعذر لا يرفع مستوى المساعدة.",
    );
  if (kind === "transfer" || kind === "probe")
    throw new ApiFault(
      409,
      "invalid_state",
      "هذه محاولة مستقلة أو سؤال تأكيدي؛ لا يُكشف حلها ضمن هذه العملية.",
    );
  if (openProbe)
    throw new ApiFault(
      409,
      "invalid_state",
      "أجب عن السؤال التأكيدي المفتوح قبل طلب تلميح قد يؤثر في دليله.",
    );
  if (input.action === "show_full_solution") {
    if (input.confirmAssistedCompletion !== true)
      throw new ApiFault(
        422,
        "invalid_input",
        "أكد أنك تريد حلًا كاملًا بمساعدة.",
      );
    return 4;
  }
  if (previous >= 3)
    throw new ApiFault(
      409,
      "invalid_state",
      "وصلت إلى آخر التلميحات لهذا الموضع؛ يمكنك متابعة الحل أو طلب الحل الكامل بتأكيد مستقل.",
    );
  return (previous + 1) as 1 | 2 | 3;
}
export const hintLevel = (n: number): Schema<"HintLevel"> =>
  `H${n}` as Schema<"HintLevel">;
