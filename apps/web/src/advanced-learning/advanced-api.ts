import type {
  CActivity,
  CAnalyticsDashboard,
  CContentAnalytics,
  CPrivateEvaluation,
  CRepresentation,
  CRepresentationSet,
  CRubricCriterion,
} from "../../../../packages/contracts/src/advanced-learning";
import type {
  CProblemSession,
  CProjectRun,
  CProjectReview,
  CProjectSubmission,
} from "../../../../packages/contracts/src/advanced-learning-sessions";
import {
  arrayField,
  booleanField,
  jsonValue,
  numberField,
  record,
  strings,
  subjectField,
  textField,
} from "../product-api";
import { enumField } from "../learning-path-api";
import { labResult } from "../stem-lab-api";

const nullableText = (value: unknown) =>
  value === null ? null : textField(value);
const textRecord = (value: unknown) =>
  Object.fromEntries(
    Object.entries(record(value)).map(([key, item]) => [key, textField(item)]),
  );
export function representation(value: unknown): CRepresentation {
  const r = record(value);
  if (r.evaluationMode !== "learning_only") throw new Error("invalid_response");
  return {
    code: textField(r.code),
    kind: enumField(r.kind, ["text", "table", "diagram", "stem_lab", "code"]),
    titleAr: textField(r.titleAr),
    accessibleText: textField(r.accessibleText),
    learningObjective: textField(r.learningObjective),
    targetSkillCodes: strings(r.targetSkillCodes),
    sameConstruct: booleanField(r.sameConstruct),
    assistanceExposure: booleanField(r.assistanceExposure),
    evaluationMode: "learning_only",
    ...(r.textAr === undefined ? {} : { textAr: textField(r.textAr) }),
    ...(r.altText === undefined ? {} : { altText: textField(r.altText) }),
    ...(r.columns === undefined ? {} : { columns: strings(r.columns) }),
    ...(r.rows === undefined ? {} : { rows: arrayField(r.rows, strings) }),
    ...(r.labBlockIndex === undefined
      ? {}
      : { labBlockIndex: numberField(r.labBlockIndex) }),
    ...(r.codeText === undefined ? {} : { codeText: textField(r.codeText) }),
  };
}
export function representationSet(value: unknown): CRepresentationSet {
  const r = record(value);
  if (r.schemaVersion !== "udl-representation-v1")
    throw new Error("invalid_response");
  return {
    schemaVersion: "udl-representation-v1",
    learningObjective: textField(r.learningObjective),
    targetSkillCodes: strings(r.targetSkillCodes),
    variants: arrayField(r.variants, representation),
    responseModes: arrayField(r.responseModes, (mode) =>
      enumField(mode, ["text", "choice", "equation", "code_text"]),
    ),
  };
}
function rubric(value: unknown): CRubricCriterion {
  const r = record(value);
  return {
    code: textField(r.code),
    titleAr: textField(r.titleAr),
    descriptionAr: textField(r.descriptionAr),
    levels: arrayField(r.levels, (value) => {
      const l = record(value);
      return {
        code: textField(l.code),
        labelAr: textField(l.labelAr),
        descriptionAr: textField(l.descriptionAr),
      };
    }),
  };
}
function privateEvaluation(value: unknown): CPrivateEvaluation {
  const r = record(value);
  return {
    ...(r.solutionKey === undefined
      ? {}
      : { solutionKey: textField(r.solutionKey) }),
    ...(r.referenceCode === undefined
      ? {}
      : { referenceCode: textField(r.referenceCode) }),
    ...(r.privateRubric === undefined
      ? {}
      : {
          privateRubric: arrayField(r.privateRubric, (value) => {
            const p = record(value);
            return {
              criterionCode: textField(p.criterionCode),
              noteAr: textField(p.noteAr),
            };
          }),
        }),
    ...(r.hints === undefined
      ? {}
      : {
          hints: arrayField(r.hints, (value) => {
            const h = record(value);
            return {
              level: enumField(h.level, ["H0", "H1", "H2", "H3", "H4"]),
              textAr: textField(h.textAr),
            };
          }),
        }),
    ...(r.hiddenTests === undefined
      ? {}
      : {
          hiddenTests: arrayField(r.hiddenTests, (value) => {
            const t = record(value);
            return {
              input: textField(t.input),
              expectedOutput: textField(t.expectedOutput),
            };
          }),
        }),
  };
}
/** Construct a public allowlist; an unexpected answer key never reaches student UI state. */
export function activity(value: unknown, author = false): CActivity {
  const a = record(value),
    policy = record(a.supportPolicy);
  if (a.schemaVersion !== "c-activity-v1") throw new Error("invalid_response");
  const common = {
    schemaVersion: "c-activity-v1" as const,
    subject: subjectField(a.subject),
    code: textField(a.code),
    titleAr: textField(a.titleAr),
    objectives: strings(a.objectives),
    skillCodes: strings(a.skillCodes),
    prerequisiteSkillCodes: strings(a.prerequisiteSkillCodes),
    publicBriefAr: textField(a.publicBriefAr),
    familyCode: textField(a.familyCode),
    supportPolicy: {
      hintsAllowed: booleanField(policy.hintsAllowed),
      revealMode: enumField(policy.revealMode, [
        "after_submit",
        "teacher_only",
      ]),
    },
    representations: arrayField(a.representations, representation),
    publicRubric: arrayField(a.publicRubric, rubric),
    ...(author && a.privateEvaluation !== undefined
      ? { privateEvaluation: privateEvaluation(a.privateEvaluation) }
      : {}),
  };
  if (a.type === "problem_based") {
    const v = record(a.verification),
      kind = enumField(v.kind, ["none", "bank_problem", "stem_lab"]);
    return {
      ...common,
      type: "problem_based",
      scenarioAr: textField(a.scenarioAr),
      constraints: strings(a.constraints),
      stages: arrayField(a.stages, (s) =>
        enumField(s, ["frame", "plan", "investigate", "justify", "reflect"]),
      ),
      verification:
        kind === "none"
          ? { kind }
          : kind === "bank_problem"
            ? { kind, problemRevisionId: textField(v.problemRevisionId) }
            : { kind, blockIndex: numberField(v.blockIndex) },
    };
  }
  if (a.type !== "project_based") throw new Error("invalid_response");
  return {
    ...common,
    type: "project_based",
    projectLevel: enumField(a.projectLevel, ["micro", "multi_lesson"]),
    drivingQuestionAr: textField(a.drivingQuestionAr),
    milestones: arrayField(a.milestones, (value) => {
      const m = record(value);
      return {
        code: textField(m.code),
        titleAr: textField(m.titleAr),
        descriptionAr: textField(m.descriptionAr),
        requiredArtifactKind: enumField(m.requiredArtifactKind, [
          "text",
          "json",
        ]),
        required: booleanField(m.required),
      };
    }),
    lessonRevisionIds: strings(a.lessonRevisionIds),
  };
}
export function problemSession(value: unknown): CProblemSession {
  const s = record(value),
    t = record(s.transfer),
    answers = record(s.answers);
  if (
    s.evidenceClass !== "learning_only" ||
    t.available !== false ||
    t.reasonCode !== "assessment_service_rechecks_novelty"
  )
    throw new Error("invalid_response");
  const selectedAnswers: CProblemSession["answers"] = {};
  for (const key of [
    "frame",
    "plan",
    "investigate",
    "justify",
    "reflect",
  ] as const)
    if (answers[key] !== undefined)
      selectedAnswers[key] = textField(answers[key]);
  return {
    id: textField(s.id),
    revision: numberField(s.revision),
    trackRevisionId: textField(s.trackRevisionId),
    lessonRevisionId: textField(s.lessonRevisionId),
    blockIndex: numberField(s.blockIndex),
    activity: activity(s.activity),
    stage: enumField(s.stage, [
      "frame",
      "plan",
      "investigate",
      "justify",
      "reflect",
    ]),
    status: enumField(s.status, ["active", "paused", "abandoned", "completed"]),
    answers: selectedAnswers,
    assistanceLevel: numberField(s.assistanceLevel),
    supportAr: nullableText(s.supportAr),
    result: s.result === null ? null : labResult(s.result),
    evidenceClass: "learning_only",
    readOnly: booleanField(s.readOnly),
    transfer: {
      available: false,
      reasonCode: "assessment_service_rechecks_novelty",
    },
  };
}
export function projectReview(value: unknown): CProjectReview {
  const r = record(value);
  return {
    id: textField(r.id),
    rubricRevisionId: textField(r.rubricRevisionId),
    assessedSubmissionRevision: numberField(r.assessedSubmissionRevision),
    reviewerRole: textField(r.reviewerRole),
    decision: enumField(r.decision, ["revision_requested", "accepted"]),
    criteria: arrayField(r.criteria, (value) => {
      const c = record(value);
      return {
        criterionCode: textField(c.criterionCode),
        levelCode: textField(c.levelCode),
        reasonAr: textField(c.reasonAr),
      };
    }),
    feedbackAr: textField(r.feedbackAr),
    reviewedAt: textField(r.reviewedAt),
  };
}
export function projectSubmission(value: unknown): CProjectSubmission {
  const s = record(value),
    kind = enumField(s.artifactKind, ["text", "json"]);
  return {
    id: textField(s.id),
    revision: numberField(s.revision),
    milestoneCode: textField(s.milestoneCode),
    artifactKind: kind,
    artifact:
      kind === "text" ? textField(s.artifact) : record(jsonValue(s.artifact)),
    isFinal: booleanField(s.isFinal),
    status: enumField(s.status, [
      "awaiting_feedback",
      "revision_requested",
      "accepted",
    ]),
    createdAt: textField(s.createdAt),
    review: s.review === null ? null : projectReview(s.review),
  };
}
export function projectRun(value: unknown): CProjectRun {
  const r = record(value);
  if (r.evidenceClass !== "learning_only") throw new Error("invalid_response");
  return {
    id: textField(r.id),
    revision: numberField(r.revision),
    trackRevisionId: textField(r.trackRevisionId),
    lessonRevisionId: textField(r.lessonRevisionId),
    blockIndex: numberField(r.blockIndex),
    activity: activity(r.activity),
    status: enumField(r.status, [
      "active",
      "paused",
      "withdrawn",
      "awaiting_feedback",
      "revision_requested",
      "review_pending",
      "feedback_ready",
      "completed",
    ]),
    milestones: textRecord(r.milestones),
    submissions: arrayField(r.submissions, projectSubmission),
    assistanceLevel: numberField(r.assistanceLevel),
    feedbackSeen: booleanField(r.feedbackSeen),
    evidenceClass: "learning_only",
    readOnly: booleanField(r.readOnly),
  };
}
export function analyticsDashboard(value: unknown): CAnalyticsDashboard {
  const d = record(value),
    w = record(d.window),
    a = record(d.activity);
  if (
    d.schemaVersion !== "learning-metrics-v1" ||
    d.metricVersion !== "c-metrics-1.0" ||
    d.synthetic !== true
  )
    throw new Error("invalid_response");
  return {
    schemaVersion: "learning-metrics-v1",
    metricVersion: "c-metrics-1.0",
    trackRevisionId: textField(d.trackRevisionId),
    generatedAt: textField(d.generatedAt),
    synthetic: true,
    window: {
      from: textField(w.from),
      to: textField(w.to),
      days: numberField(w.days),
    },
    metrics: arrayField(d.metrics, (value) => {
      const m = record(value);
      const status = enumField(m.status, [
          "observed",
          "not_measured",
          "suppressed",
        ]),
        denominator = numberField(m.denominator);
      return {
        metric: textField(m.metric),
        metricVersion: textField(m.metricVersion),
        n: numberField(m.n),
        numerator: numberField(m.numerator),
        denominator,
        value:
          status === "observed" && denominator > 0 && m.value !== null
            ? numberField(m.value)
            : null,
        status,
        missingReason: nullableText(m.missingReason),
      };
    }),
    activity: {
      problemCompleted: numberField(a.problemCompleted),
      projectCompleted: numberField(a.projectCompleted),
      projectSubmitted: numberField(a.projectSubmitted),
    },
    provenance: strings(d.provenance),
    missingCount: numberField(d.missingCount),
    notesAr: strings(d.notesAr),
  };
}
export function contentAnalytics(value: unknown): CContentAnalytics {
  const r = record(value),
    q = record(r.quality);
  if (
    r.schemaVersion !== "learning-metrics-v1" ||
    r.synthetic !== true ||
    r.status !== "suppressed" ||
    r.reasonCode !== "privacy_threshold_pending"
  )
    throw new Error("invalid_response");
  return {
    schemaVersion: "learning-metrics-v1",
    revisionId: textField(r.revisionId),
    synthetic: true,
    status: "suppressed",
    reasonCode: "privacy_threshold_pending",
    metrics: [],
    quality: {
      problemActivities: numberField(q.problemActivities),
      projectActivities: numberField(q.projectActivities),
      representationSets: numberField(q.representationSets),
    },
    generatedAt: textField(r.generatedAt),
  };
}
