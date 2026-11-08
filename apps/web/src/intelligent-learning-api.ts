import type {
  AReview,
  AScaffoldSession,
  AGoal,
  AReflection,
  ATutorSession,
  ActivityKind,
  DeepDiagnosis,
  KnowledgeGraph,
  LearningActivity,
  MasteryResponse,
  NextActivityDecision,
} from "../../../packages/contracts/src/intelligent-learning";
import {
  arrayField,
  booleanField,
  numberField,
  optionalText,
  ProductFault,
  type ProductApi,
  messageOf,
  record,
  strings,
  subjectField,
  textField,
} from "./product-api";
import { enumField } from "./learning-path-api";
import validators from "../../../packages/contracts/src/generated/api-validators.cjs";
import type { Schema } from "./api-client";

export function probeData(value: unknown): Schema<"Probe"> {
  if (!validators.Probe?.(value)) throw new Error("invalid_response");
  return value as Schema<"Probe">;
}
export function probeEvaluationData(value: unknown): Schema<"ProbeEvaluation"> {
  if (!validators.ProbeEvaluation?.(value)) throw new Error("invalid_response");
  return value as Schema<"ProbeEvaluation">;
}
export function reflectionsData(value: unknown) {
  return { reflections: arrayField(record(value).reflections, reflectionData) };
}

const activityKinds: readonly ActivityKind[] = [
  "explanation",
  "worked_example",
  "diagnostic_probe",
  "guided_practice",
  "prerequisite_repair",
  "independent_check",
  "retrieval_review",
  "challenge",
  "reflection",
];
function labReference(r: Record<string, unknown>) {
  if (r.labKind === undefined && r.labBlockIndex === undefined) return {};
  const index = numberField(r.labBlockIndex);
  if (!Number.isInteger(index) || index < 0 || index >= 60)
    throw new Error("invalid_response");
  return { labKind: textField(r.labKind), labBlockIndex: index };
}
export function decisionData(value: unknown): NextActivityDecision {
  const r = record(value);
  return {
    ...labReference(r),
    id: textField(r.id),
    decisionId: textField(r.decisionId),
    revision: numberField(r.revision),
    trackRevisionId: textField(r.trackRevisionId),
    policyVersion: textField(r.policyVersion),
    evidenceFingerprint: textField(r.evidenceFingerprint),
    mappingSnapshotHash: textField(r.mappingSnapshotHash),
    activityKind: enumField(r.activityKind, [
      ...activityKinds,
      "no_safe_activity",
    ]),
    lessonRevisionId: optionalText(r.lessonRevisionId),
    sourceAttemptId: optionalText(r.sourceAttemptId),
    skillCode: optionalText(r.skillCode),
    reasonCode: textField(r.reasonCode),
    reasonAr: textField(r.reasonAr),
    alternatives: arrayField(r.alternatives, (value) => {
      const a = record(value);
      return {
        ...labReference(a),
        activityKind: enumField(a.activityKind, activityKinds),
        lessonRevisionId: optionalText(a.lessonRevisionId),
        skillCode: optionalText(a.skillCode),
        reasonCode: textField(a.reasonCode),
      };
    }),
    expiresAt: textField(r.expiresAt),
  };
}
export function activityData(value: unknown): LearningActivity {
  const r = record(value);
  return {
    ...labReference(r),
    id: textField(r.id),
    revision: numberField(r.revision),
    decisionId: textField(r.decisionId),
    trackRevisionId: textField(r.trackRevisionId),
    activityKind: enumField(r.activityKind, activityKinds),
    lessonRevisionId: optionalText(r.lessonRevisionId),
    sourceAttemptId: optionalText(r.sourceAttemptId),
    skillCode: optionalText(r.skillCode),
    status: enumField(r.status, ["active", "completed"]),
    assessmentId: optionalText(r.assessmentId),
    assistanceLevel: numberField(r.assistanceLevel),
    createdAt: textField(r.createdAt),
  };
}
export function masteryData(value: unknown): MasteryResponse {
  const r = record(value);
  return {
    trackRevisionId: textField(r.trackRevisionId),
    modelVersion: textField(r.modelVersion),
    evidenceFingerprint: textField(r.evidenceFingerprint),
    computedAt: textField(r.computedAt),
    skills: arrayField(r.skills, (value) => {
      const s = record(value),
        d = record(s.dimensions),
        c = record(s.counts);
      return {
        skillCode: textField(s.skillCode),
        titleAr: textField(s.titleAr),
        dimensions: {
          exposure: enumField(d.exposure, ["not_seen", "seen"]),
          supportedPractice: enumField(d.supportedPractice, [
            "none",
            "observed",
          ]),
          independentPerformance: enumField(d.independentPerformance, [
            "none",
            "limited_evidence",
            "consistent_evidence",
            "needs_review",
          ]),
          transfer: enumField(d.transfer, [
            "not_tested",
            "evidence",
            "needs_review",
          ]),
          retention: enumField(d.retention, [
            "not_due",
            "due",
            "observed_retained",
            "review_needed",
            "insufficient_data",
          ]),
          evidenceQuality: enumField(d.evidenceQuality, [
            "insufficient",
            "partial",
            "eligible",
          ]),
        },
        counts: {
          assisted: numberField(c.assisted),
          eligibleIndependent: numberField(c.eligibleIndependent),
          independentErrors: numberField(c.independentErrors),
        },
        evidenceIds: strings(s.evidenceIds),
        reasonCodes: strings(s.reasonCodes),
      };
    }),
  };
}
export function graphData(value: unknown): KnowledgeGraph {
  const r = record(value);
  return {
    trackRevisionId: textField(r.trackRevisionId),
    graphVersion: textField(r.graphVersion),
    mappingSnapshotHash: textField(r.mappingSnapshotHash),
    nodes: arrayField(r.nodes, (value) => {
      const n = record(value);
      return {
        skillCode: textField(n.skillCode),
        titleAr: textField(n.titleAr),
        subject: subjectField(n.subject),
        lessonRevisionId: optionalText(n.lessonRevisionId),
        reviewState: enumField(n.reviewState, [
          "reviewed",
          "mapping_pending",
          "missing_coverage",
        ]),
      };
    }),
    edges: arrayField(r.edges, (value) => {
      const e = record(value);
      return {
        fromSkill: textField(e.fromSkill),
        toSkill: textField(e.toSkill),
        relationKind: enumField(e.relationKind, [
          "required",
          "helpful",
          "cross_subject_support",
        ]),
        rationaleAr: textField(e.rationaleAr),
        reviewState: enumField(e.reviewState, ["reviewed", "pending"]),
      };
    }),
    issues: strings(r.issues),
  };
}
export function diagnosisData(value: unknown): DeepDiagnosis {
  const r = record(value);
  return {
    attemptId: textField(r.attemptId),
    attemptRevision: numberField(r.attemptRevision),
    state: enumField(r.state, [
      "candidate",
      "probe_offered",
      "probe_answered",
      "unresolved",
      "technical_abstain",
      "review_blocked",
    ]),
    candidateCauses: arrayField(r.candidateCauses, (value) => {
      const c = record(value);
      return {
        errorCode: textField(c.errorCode),
        candidateSkillCodes: strings(c.candidateSkillCodes),
        basisEvidenceIds: strings(c.basisEvidenceIds),
        confidenceLabel: enumField(c.confidenceLabel, [
          "possible",
          "supported",
          "unresolved",
        ]),
      };
    }),
    probeId: optionalText(r.probeId),
    nextIntervention: enumField(r.nextIntervention, [
      "clarifying_question",
      "short_explanation",
      "targeted_practice",
      "no_safe_probe",
    ]),
    policyVersion: textField(r.policyVersion),
  };
}

/** Closed projection: private answers, hidden tests and owner keys never survive decoding. */
export function reviewData(value: unknown): AReview {
  const r = record(value);
  return {
    id: textField(r.id),
    revision: numberField(r.revision),
    trackRevisionId: textField(r.trackRevisionId),
    lessonRevisionId: textField(r.lessonRevisionId),
    skillCode: textField(r.skillCode),
    sourceEvidenceId: textField(r.sourceEvidenceId),
    policyVersion: textField(r.policyVersion),
    dueAt: textField(r.dueAt),
    status: enumField(r.status, [
      "scheduled",
      "deferred",
      "started",
      "completed",
      "coverage_limited",
    ]),
    assessmentId: optionalText(r.assessmentId),
    retentionOutcome: enumField(r.retentionOutcome, [
      "not_tested",
      "independent",
      "assisted",
      "needs_review",
      "unassessable",
    ]),
    anchorAt: textField(r.anchorAt),
    stepIndex: numberField(r.stepIndex),
  };
}
export function reviewListData(value: unknown) {
  const r = record(value);
  return {
    policyVersion: textField(r.policyVersion),
    reviews: arrayField(r.reviews, reviewData),
  };
}
export function scaffoldData(value: unknown): AScaffoldSession {
  const r = record(value);
  return {
    id: textField(r.id),
    revision: numberField(r.revision),
    trackRevisionId: textField(r.trackRevisionId),
    lessonRevisionId: textField(r.lessonRevisionId),
    skillCode: textField(r.skillCode),
    stage: enumField(r.stage, ["S0", "S1", "S2", "S3", "S4"]),
    status: enumField(r.status, ["active", "completed", "unverified"]),
    contentVersion: numberField(r.contentVersion),
    problemRaw: optionalText(r.problemRaw),
    visibleSteps: arrayField(r.visibleSteps, (value) => {
      const step = record(value);
      return {
        raw: textField(step.raw),
        explanationAr: textField(step.explanationAr),
      };
    }),
    supportCount: numberField(r.supportCount),
    assessmentId: optionalText(r.assessmentId),
    independentEligible: booleanField(r.independentEligible),
    messageAr: textField(r.messageAr),
  };
}
export function featureUnavailable(error: unknown): boolean {
  return error instanceof ProductFault && [403, 404].includes(error.status);
}

/** Feature flags are independent: a closed A1 never hides enabled A2/A4/A5/A8. */
export async function loadIntelligentFeatures(
  api: Pick<ProductApi, "request">,
  trackRevisionId: string,
) {
  const errors: string[] = [],
    query = `?trackRevisionId=${encodeURIComponent(trackRevisionId)}`;
  async function optional<T>(
    path: string,
    decode: (value: unknown) => T,
  ): Promise<T | null> {
    try {
      return await api.request(path + query, decode);
    } catch (failure) {
      if (!featureUnavailable(failure)) errors.push(messageOf(failure));
      return null;
    }
  }
  const [decision, mastery, graph, reviews, goals, reflections] =
    await Promise.all([
      optional("/learning/next-activity", decisionData),
      optional("/learning/mastery", masteryData),
      optional("/learning/knowledge-graph", graphData),
      optional("/learning/reviews/due", reviewListData),
      optional("/learning/goals", goalsData),
      optional("/learning/reflections", reflectionsData),
    ]);
  return { decision, mastery, graph, reviews, goals, reflections, errors };
}

export function goalData(value: unknown): AGoal {
  const r = record(value);
  return {
    id: textField(r.id),
    revision: numberField(r.revision),
    trackRevisionId: textField(r.trackRevisionId),
    lessonRevisionId: textField(r.lessonRevisionId),
    skillCode: textField(r.skillCode),
    targetIndependentCount: numberField(r.targetIndependentCount),
    textAr: textField(r.textAr),
    status: enumField(r.status, ["active", "achieved", "skipped"]),
    independentCount: numberField(r.independentCount),
    createdAt: textField(r.createdAt),
    updatedAt: textField(r.updatedAt),
  };
}
export function goalsData(value: unknown) {
  return { goals: arrayField(record(value).goals, goalData) };
}
export function updateLearningGoal(
  api: Pick<ProductApi, "request">,
  goal: Pick<AGoal, "id" | "revision">,
  textAr: string,
  targetIndependentCount: number,
): Promise<AGoal> {
  return api.request(
    `/learning/goals/${encodeURIComponent(goal.id)}/update`,
    goalData,
    "POST",
    {
      expectedRevision: goal.revision,
      textAr,
      targetIndependentCount,
    },
  );
}
export function reflectionData(value: unknown): AReflection {
  const r = record(value);
  return {
    id: textField(r.id),
    trackRevisionId: textField(r.trackRevisionId),
    goalId: optionalText(r.goalId),
    activityId: optionalText(r.activityId),
    phase: enumField(r.phase, ["predict", "monitor", "reflect"]),
    confidence: r.confidence === null ? null : numberField(r.confidence),
    textAr: textField(r.textAr),
    skipped: booleanField(r.skipped),
    verifiedOutcome: enumField(r.verifiedOutcome, [
      "correct",
      "error",
      "assisted",
      "unassessable",
      "not_tested",
    ]),
    messageAr: textField(r.messageAr),
    createdAt: textField(r.createdAt),
  };
}
export function tutorData(value: unknown): ATutorSession {
  const r = record(value);
  const hintLevel = numberField(r.hintLevel);
  if (![0, 1, 2, 3, 4].includes(hintLevel)) throw new Error("invalid_response");
  if (r.assistance !== true) throw new Error("invalid_response");
  return {
    id: textField(r.id),
    revision: numberField(r.revision),
    trackRevisionId: textField(r.trackRevisionId),
    lessonRevisionId: textField(r.lessonRevisionId),
    skillCode: textField(r.skillCode),
    state: enumField(r.state, [
      "awaiting_student",
      "completed",
      "safe_handoff",
      "failed",
    ]),
    hintLevel: hintLevel as ATutorSession["hintLevel"],
    turnCount: numberField(r.turnCount),
    maxTurns: numberField(r.maxTurns),
    assistance: true,
    source: enumField(r.source, [
      "offline_reviewed_template",
      "synthetic_template",
    ]),
    turns: arrayField(r.turns, (value) => {
      const turn = record(value);
      return {
        role: enumField(turn.role, ["tutor", "student"]),
        textAr: textField(turn.textAr),
        hintLevel: numberField(turn.hintLevel),
      };
    }),
    assessmentId: optionalText(r.assessmentId),
    messageAr: textField(r.messageAr),
  };
}

export interface IntelligentResume {
  activityId?: string;
  scaffoldId?: string;
  tutorId?: string;
}
const resumePrefix = "khotwa-path:a:";
export function readIntelligentResume(
  storage: Pick<Storage, "getItem">,
  trackRevisionId: string,
): IntelligentResume {
  try {
    const value = storage.getItem(resumePrefix + trackRevisionId);
    if (!value) return {};
    const r = record(JSON.parse(value));
    return {
      ...(r.activityId === undefined
        ? {}
        : { activityId: textField(r.activityId) }),
      ...(r.scaffoldId === undefined
        ? {}
        : { scaffoldId: textField(r.scaffoldId) }),
      ...(r.tutorId === undefined ? {} : { tutorId: textField(r.tutorId) }),
    };
  } catch {
    return {};
  }
}
export function writeIntelligentResume(
  storage: Pick<Storage, "setItem">,
  trackRevisionId: string,
  resume: IntelligentResume,
): void {
  storage.setItem(resumePrefix + trackRevisionId, JSON.stringify(resume));
}
