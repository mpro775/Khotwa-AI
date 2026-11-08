export const SOCRATIC_POLICY = "socratic-a7-offline-synthetic-v1";
export const SOCRATIC_MAX_TURNS = 8;
export type TutorState =
  | "awaiting_student"
  | "completed"
  | "safe_handoff"
  | "failed";
export type TutorData = {
  trackRevisionId: string;
  lessonRevisionId: string;
  skillCode: string;
  state: TutorState;
  hintLevel: number;
  turnCount: number;
  maxTurns: number;
  assistance: true;
  source: "offline_reviewed_template" | "synthetic_template";
  turns: { role: "tutor" | "student"; textAr: string; hintLevel: number }[];
  assessmentId: string | null;
  questionId: string | null;
  assessmentRevision: number | null;
  policyVersion: string;
  fullSolution: string[];
  messageAr: string;
};
/** Cautious questions do not assert that a response is mathematically right. */
export function offlineSocraticQuestion(
  subject: string,
  level: number,
): string {
  const questions =
    subject === "physics"
      ? [
          "ما الكمية المطلوبة، وما وحدة قياسها؟",
          "كيف تربط المعطيات بالكمية المطلوبة؟",
          "هل تتوافق وحدة الناتج مع وحدة الكمية المطلوبة؟",
        ]
      : subject === "programming"
        ? [
            "أي قيمة يحملها المتغير قبل سطر الطباعة؟",
            "هل يمكنك تتبع الأسطر بالترتيب دون تنفيذها؟",
            "أي سطر يغيّر قيمة المتغير؟",
          ]
        : [
            "أي جزء من الخطوة ترغب في مراجعته أولًا؟",
            "ما العملية التي تحافظ على المساواة في الطرفين؟",
            "هل يمكنك تفسير أثر العملية على كل حد؟",
          ];
  return questions[Math.min(Math.max(level - 1, 0), questions.length - 1)]!;
}
/** Optional provider candidates only rephrase a reviewed question. Default is always offline. */
export function safeSocraticCandidate(
  candidate: unknown,
  reviewedQuestion: string,
  forbidden: string[] = [],
): string {
  if (
    typeof candidate !== "string" ||
    candidate.length > 500 ||
    candidate.length < 5 ||
    /<[^>]*>|```|https?:|\b(correct|incorrect|mastery|verdict)\b/iu.test(
      candidate,
    ) ||
    /(?:س|x)\s*=\s*[٠-٩0-9]|الإجابة\s+(?:هي|الصحيحة)|الحل\s+(?:هو|النهائي)/u.test(
      candidate,
    ) ||
    forbidden.some((answer) => answer.length > 2 && candidate.includes(answer))
  )
    return reviewedQuestion;
  // A candidate outside the reviewed, bounded vocabulary is not trusted.
  return candidate === reviewedQuestion ? candidate : reviewedQuestion;
}
export function advanceTutor(
  data: TutorData,
  subject: string,
  action: "reply" | "next_hint" | "try_independent" | "stop" | "show_solution",
  textAr: string,
  confirmFullSolution: boolean,
  canonicalStatus: string | null = null,
): TutorData {
  if (data.state !== "awaiting_student")
    throw new Error("Tutor session has ended");
  const turns = [...data.turns];
  if (textAr)
    turns.push({ role: "student", textAr, hintLevel: data.hintLevel });
  if (action === "stop" || action === "try_independent")
    return {
      ...data,
      turns,
      state: "completed",
      messageAr:
        action === "try_independent"
          ? "يمكنك بدء مسألة جديدة لقياس مستقل؛ تبقى المساعدة السابقة محفوظة."
          : "أوقفت الجلسة مع حفظ ما سبق.",
    };
  if (data.turnCount >= data.maxTurns)
    return {
      ...data,
      turns,
      state: "safe_handoff",
      messageAr: "بلغنا حد الحوار التجريبي؛ يمكنك مراجعة الدرس أو سؤال المعلم.",
    };
  if (action === "show_solution") {
    if (!confirmFullSolution)
      throw new Error("Full solution requires explicit confirmation");
    if (!data.fullSolution.length)
      return {
        ...data,
        turns,
        state: "safe_handoff",
        messageAr:
          "لا يتوفر حل مراجع لهذا السؤال؛ يمكنك مراجعة مثال الدرس المختلف.",
      };
    turns.push({
      role: "tutor",
      textAr: data.fullSolution.join(" ← "),
      hintLevel: 4,
    });
    return {
      ...data,
      turns,
      hintLevel: 4,
      turnCount: data.turnCount + 1,
      state: "completed",
      messageAr: "عُرض الحل بمساعدة كاملة؛ هذه المسألة غير مؤهلة لقياس مستقل.",
    };
  }
  const hintLevel =
    action === "next_hint"
      ? Math.min(data.hintLevel + 1, 3)
      : Math.max(data.hintLevel, 1);
  turns.push({
    role: "tutor",
    textAr:
      canonicalStatus === "wrong_unit"
        ? "القيمة والوحدة شيئان مختلفان؛ ما وحدة الكمية المطلوبة في هذا السؤال؟"
        : [
              "syntax_error",
              "unsupported",
              "inconclusive",
              "service_error",
              "unavailable",
              "unverified",
            ].includes(canonicalStatus ?? "")
          ? "التحقق الفني لا يسمح بالحكم على هذه الإجابة الآن؛ هل تريد توضيح المدخل أو إعادة التحقق؟"
          : ["verified_valid", "correct"].includes(canonicalStatus ?? "")
            ? "الخطوة الحالية متحققة من محرك المادة؛ كيف تفسر سبب صحتها؟"
            : canonicalStatus === "verified_invalid" ||
                canonicalStatus === "wrong_value"
              ? "المحرك حدد انتقالًا يحتاج مراجعة؛ أي جزء من العملية ستفحص أولًا؟"
              : offlineSocraticQuestion(subject, hintLevel),
    hintLevel,
  });
  return {
    ...data,
    turns,
    hintLevel,
    turnCount: data.turnCount + 1,
    messageAr: "هذه مساعدة حوارية؛ صحة الحل يحددها متحقق المادة، لا نص الحوار.",
  };
}
