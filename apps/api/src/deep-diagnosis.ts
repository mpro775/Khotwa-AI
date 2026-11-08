export const DEEP_DIAGNOSIS_POLICY = "diagnosis-a3-v1";
export function diagnosisReviewBlocked(
  errorCode: string | undefined,
  family: string | undefined,
): boolean {
  return (
    (errorCode === "ERR-ALG-05" && family === "calculation_divide") ||
    (errorCode === "ERR-ALG-03" && family === "balance")
  );
}
export interface DiagnosisCause {
  errorCode: string;
  candidateSkillCodes: string[];
  basisEvidenceIds: string[];
  confidenceLabel: "possible" | "supported" | "unresolved";
}
export interface DeepDiagnosis {
  attemptId: string;
  attemptRevision: number;
  state:
    | "candidate"
    | "probe_offered"
    | "probe_answered"
    | "unresolved"
    | "technical_abstain"
    | "review_blocked";
  candidateCauses: DiagnosisCause[];
  probeId: string | null;
  nextIntervention:
    | "clarifying_question"
    | "short_explanation"
    | "targeted_practice"
    | "no_safe_probe";
  policyVersion: string;
}
/** The math result is already canonical. This never guesses a scientific verdict. */
export function diagnosisProjection(input: {
  attemptId: string;
  attemptRevision: number;
  status: string;
  evidenceId: string;
  causes: { errorCode: string; skills: string[]; supported?: boolean }[];
  probeId?: string | null;
  answered?: boolean;
  templateReviewed: boolean;
  mappingPending?: boolean;
}): DeepDiagnosis {
  const technical = input.status !== "verified_invalid",
    blocked = input.mappingPending === true;
  const candidateCauses: DiagnosisCause[] = technical
    ? []
    : input.causes.map((c) => ({
        errorCode: c.errorCode,
        candidateSkillCodes: c.skills,
        basisEvidenceIds: [input.evidenceId],
        confidenceLabel:
          c.supported && input.answered
            ? "supported"
            : input.answered
              ? "unresolved"
              : "possible",
      }));
  return {
    attemptId: input.attemptId,
    attemptRevision: input.attemptRevision,
    state: technical
      ? "technical_abstain"
      : blocked
        ? "review_blocked"
        : input.answered
          ? "probe_answered"
          : input.probeId
            ? "probe_offered"
            : candidateCauses.length
              ? "candidate"
              : "unresolved",
    candidateCauses,
    probeId: technical || blocked ? null : (input.probeId ?? null),
    nextIntervention:
      technical || blocked || !input.templateReviewed
        ? "no_safe_probe"
        : input.answered
          ? input.causes.some((c) => c.supported)
            ? "targeted_practice"
            : "short_explanation"
          : "clarifying_question",
    policyVersion: DEEP_DIAGNOSIS_POLICY,
  };
}
