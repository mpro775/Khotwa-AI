import type { Schema } from "./api-client";
export interface VerificationTicket {
  attemptId: string;
  revision: number;
  problemRevisionId: string;
  editEpoch: number;
}
export function canAdoptVerification(
  ticket: VerificationTicket,
  attempt: Schema<"Attempt"> | null,
  epoch: number,
  report: Schema<"VerificationReport">,
): boolean {
  if (
    !attempt ||
    epoch !== ticket.editEpoch ||
    attempt.id !== ticket.attemptId ||
    attempt.revision !== ticket.revision ||
    attempt.problemRevisionId !== ticket.problemRevisionId ||
    !report.isCurrent ||
    report.attemptId !== attempt.id ||
    report.attemptRevision !== attempt.revision ||
    report.problemRevisionId !== attempt.problemRevisionId
  )
    return false;
  return (
    report.transitions.length > 0 &&
    report.transitions.every((t) => {
      const to = attempt.steps.find((s) => s.id === t.to.stepId),
        from =
          t.from.kind === "step"
            ? attempt.steps.find((s) => s.id === t.from.stepId)
            : null;
      return (
        !!to &&
        to.currentVersion === t.to.stepVersion &&
        (t.from.kind === "problem"
          ? t.from.stepId === null && t.from.stepVersion === null
          : !!from && from.currentVersion === t.from.stepVersion)
      );
    })
  );
}
export const statusLabels: Record<Schema<"MathStatus">, string> = {
  verified_valid: "الانتقال صحيح",
  verified_invalid: "هذا الانتقال يحتاج مراجعة",
  syntax_error: "لم أستطع قراءة هذه الصيغة",
  unsupported: "هذا النوع غير مدعوم حاليًا",
  inconclusive: "لا أستطيع تأكيد هذا الانتقال الآن",
  service_error: "تعذر التحقق الآن",
};
export const arabicNumber = (value: string | number): string =>
  String(value).replace(/[0-9-]/g, (c) =>
    c === "-" ? "−" : "٠١٢٣٤٥٦٧٨٩"[Number(c)]!,
  );

export function canAdoptProbe(
  report: Schema<"VerificationReport">,
  response: Schema<"Probe"> | Schema<"ProbeEvaluation">,
  expectedProbeId?: string,
): boolean {
  const diagnosisId =
    "diagnosisId" in response
      ? response.diagnosisId
      : response.diagnosis?.diagnosisId;
  const index = report.firstBlockingTransitionIndex;
  return (
    report.isCurrent &&
    report.scope === "current_sequence" &&
    index !== null &&
    report.transitions[index]?.mathStatus === "verified_invalid" &&
    response.attemptId === report.attemptId &&
    response.attemptRevision === report.attemptRevision &&
    !!diagnosisId &&
    diagnosisId === report.diagnosisCandidate?.diagnosisId &&
    (expectedProbeId === undefined ||
      ("probeId" in response && response.probeId === expectedProbeId))
  );
}

export function canAdoptHint(
  attempt: Schema<"Attempt"> | null,
  event: Schema<"TutoringEvent">,
): boolean {
  return (
    !!attempt &&
    attempt.id === event.attemptId &&
    attempt.revision === event.attemptRevision
  );
}
