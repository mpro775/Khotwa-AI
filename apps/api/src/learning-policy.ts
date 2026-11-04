import type { Schema } from "./contracts";
export const LEARNING_POLICY = "learning-p0-0.8.0";
/** Solution sets/witnesses may reveal the hidden answer. Internal proofs are retained unchanged. */
export function publicMathReport(
  kind: Schema<"AttemptKind">,
  report: Schema<"VerificationReport">,
): Schema<"VerificationReport"> {
  return kind === "transfer"
    ? {
        ...report,
        transitions: report.transitions.map((t) => ({ ...t, evidence: null })),
        diagnosisCandidate: null,
      }
    : report;
}
export type Observation =
  | "positive"
  | "assisted"
  | "needs_review"
  | "non_assessable";
export function learningObservation(
  report: Schema<"VerificationReport">,
  independent: boolean,
): Observation {
  if (!report.isCurrent || report.scope !== "current_sequence")
    return "non_assessable";
  if (
    report.transitions.some(
      (t) => !["verified_valid", "verified_invalid"].includes(t.mathStatus),
    )
  )
    return "non_assessable";
  if (
    report.completion.canMarkAttemptCompleted &&
    report.transitions.length > 0 &&
    report.transitions.every((t) => t.mathStatus === "verified_valid")
  )
    return independent ? "positive" : "assisted";
  return report.transitions.some((t) => t.mathStatus === "verified_invalid")
    ? "needs_review"
    : "non_assessable";
}
export function evidenceState(
  observations: { observation: Observation; event_kind: string }[],
): Schema<"ProgressState"> {
  if (
    observations.some(
      (e) =>
        e.observation === "positive" && e.event_kind === "transfer_observation",
    )
  )
    return "new_evidence_of_understanding";
  if (observations.some((e) => e.observation === "needs_review"))
    return "needs_followup";
  if (observations.some((e) => e.observation === "assisted"))
    return "practice_with_support";
  return "not_assessed";
}
