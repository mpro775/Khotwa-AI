import type {
  LearningBankProblem,
  LearningContentPayload,
  LearningContentRevision,
  LearningContentValidation,
  LearningLessonDetail,
  LearningSkillMap,
  LearningTrackDetail,
  LessonBlock,
} from "../../../packages/contracts/src/learning-paths";
import type { PhysicsContent } from "../../../packages/contracts/src/product";
import type {
  AssessmentQuestion,
  AssessmentSession,
  AssessmentSummary,
  LearningPathProgress,
  LearningRecommendation,
  LearningSkillEvidence,
} from "../../../packages/contracts/src/learning-assessments";
import {
  arrayField,
  booleanField,
  numberField,
  optionalText,
  record,
  strings,
  subjectField,
  textField,
} from "./product-api";

export function enumField<T extends string>(
  value: unknown,
  values: readonly T[],
): T {
  const result = values.find((item) => item === textField(value));
  if (!result) throw new Error("invalid_response");
  return result;
}
function textRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record(value)).map(([key, item]) => [key, textField(item)]),
  );
}
export function physicsExample(value: unknown): PhysicsContent {
  const p = record(value);
  return {
    topic: enumField(p.topic, ["kinematics_1d"]),
    formula: enumField(p.formula, [
      "constant_speed_distance",
      "constant_velocity_displacement",
      "average_speed",
      "average_velocity",
      "final_velocity",
      "displacement",
      "acceleration",
      "elapsed_time",
    ]),
    quantity: enumField(p.quantity, [
      "distance",
      "displacement",
      "speed",
      "velocity",
      "acceleration",
      "time",
    ]),
    expectedDimension: enumField(p.expectedDimension, [
      "length",
      "time",
      "speed",
      "acceleration",
    ]),
    expectedValueSI: textField(p.expectedValueSI),
    expectedUnit: enumField(p.expectedUnit, ["m", "s", "m/s", "m/s²", "km/h"]),
    tolerance: textField(p.tolerance),
    givens: textRecord(p.givens),
    ...(p.constraints
      ? {
          constraints: {
            nonNegativeAnswer: booleanField(
              record(p.constraints).nonNegativeAnswer,
            ),
          },
        }
      : {}),
  };
}
export function lessonBlock(value: unknown): LessonBlock {
  const b = record(value);
  return {
    type: enumField(b.type, [
      "paragraph",
      "heading",
      "math_example",
      "worked_steps",
      "key_point",
      "common_mistake",
      "practice_link",
      "code_example",
      "physics_example",
      "completion_step",
      "worked_example_ref",
      "self_check_prompt",
    ]),
    textAr: textField(b.textAr),
    ...(b.raw === undefined ? {} : { raw: textField(b.raw) }),
    ...(b.steps === undefined
      ? {}
      : {
          steps: arrayField(b.steps, (value) => {
            const step = record(value);
            return {
              raw: textField(step.raw),
              explanationAr: textField(step.explanationAr),
            };
          }),
        }),
    ...(b.code === undefined ? {} : { code: textField(b.code) }),
    ...(b.physics === undefined ? {} : { physics: physicsExample(b.physics) }),
    ...(b.problemRevisionId === undefined
      ? {}
      : { problemRevisionId: textField(b.problemRevisionId) }),
  };
}
export function learningPayload(value: unknown): LearningContentPayload {
  const p = record(value);
  const common = {
    subject: subjectField(p.subject),
    code: textField(p.code),
    titleAr: textField(p.titleAr),
    descriptionAr: textField(p.descriptionAr),
  };
  if (p.kind === "track")
    return {
      ...common,
      kind: "track",
      units: arrayField(p.units, (value) => {
        const u = record(value);
        return {
          code: textField(u.code),
          titleAr: textField(u.titleAr),
          lessonRevisionIds: strings(u.lessonRevisionIds),
        };
      }),
    };
  if (p.kind !== "lesson") throw new Error("invalid_response");
  return {
    ...common,
    kind: "lesson",
    objectives: strings(p.objectives),
    skillCodes: strings(p.skillCodes),
    prerequisiteSkillCodes: strings(p.prerequisiteSkillCodes),
    prerequisiteLessonIds: strings(p.prerequisiteLessonIds),
    contentBlocks: arrayField(p.contentBlocks, lessonBlock),
    practiceProblemRevisionIds: strings(p.practiceProblemRevisionIds),
    assessmentProblemRevisionIds: strings(p.assessmentProblemRevisionIds),
    errorCodes: strings(p.errorCodes),
    mappingPending: strings(p.mappingPending),
  };
}
export function contentValidation(value: unknown): LearningContentValidation {
  const v = record(value);
  return {
    valid: booleanField(v.valid),
    issues: strings(v.issues),
    checkedAt: textField(v.checkedAt),
    engine: textField(v.engine),
    examples: arrayField(v.examples, (value) => {
      const e = record(value);
      return {
        blockIndex: numberField(e.blockIndex),
        normalizedText: optionalText(e.normalizedText),
        displayAr: optionalText(e.displayAr),
        ast: e.ast === null ? null : record(e.ast),
        status: textField(e.status),
        stepStatuses: strings(e.stepStatuses),
      };
    }),
  };
}
export function learningRevision(value: unknown): LearningContentRevision {
  const r = record(value);
  return {
    id: textField(r.id),
    itemId: textField(r.itemId),
    version: numberField(r.version),
    editRevision: numberField(r.editRevision),
    status: enumField(r.status, [
      "draft",
      "in_review",
      "approved",
      "published",
      "archived",
    ]),
    payload: learningPayload(r.payload),
    contentHash: textField(r.contentHash),
    validation: r.validation === null ? null : contentValidation(r.validation),
    createdAt: textField(r.createdAt),
    reviewedAt: optionalText(r.reviewedAt),
    publishedAt: optionalText(r.publishedAt),
  };
}
export function bankProblem(value: unknown): LearningBankProblem {
  const p = record(value);
  return {
    revisionId: textField(p.revisionId),
    problemId: textField(p.problemId),
    source: enumField(p.source, ["algebra", "studio"]),
    subject: subjectField(p.subject),
    titleAr: textField(p.titleAr),
    statementAr: textField(p.statementAr),
    skillCodes: strings(p.skillCodes),
    primarySkillCode: textField(p.primarySkillCode),
    difficulty: numberField(p.difficulty),
    kind: enumField(p.kind, ["main", "remediation", "transfer", "diagnostic"]),
    familyCode: textField(p.familyCode),
    ...(p.equationRaw === undefined
      ? {}
      : { equationRaw: textField(p.equationRaw) }),
    ...(p.physics === undefined
      ? {}
      : {
          physics: {
            quantity: textField(record(p.physics).quantity),
            givens: textRecord(record(p.physics).givens),
            allowedUnits: strings(record(p.physics).allowedUnits),
          },
        }),
    ...(p.programming === undefined
      ? {}
      : {
          programming: {
            starterCode: textField(record(p.programming).starterCode),
            publicTests: arrayField(
              record(p.programming).publicTests,
              (value) => {
                const t = record(value);
                return {
                  input: textField(t.input),
                  expectedOutput: textField(t.expectedOutput),
                };
              },
            ),
          },
        }),
  };
}
export function trackDetail(value: unknown): LearningTrackDetail {
  const r = record(value),
    revision = learningRevision(r);
  if (revision.payload.kind !== "track") throw new Error("invalid_response");
  return { ...revision, lessons: arrayField(r.lessons, learningRevision) };
}
export function lessonDetail(value: unknown): LearningLessonDetail {
  const r = record(value),
    revision = learningRevision(r);
  if (revision.payload.kind !== "lesson") throw new Error("invalid_response");
  return {
    ...revision,
    practiceProblems: arrayField(r.practiceProblems, bankProblem),
    assessmentProblems: arrayField(r.assessmentProblems, bankProblem),
  };
}
export function skillMapData(value: unknown): LearningSkillMap {
  const r = record(value);
  return {
    ruleVersion: textField(r.ruleVersion),
    mappingPending: strings(r.mappingPending),
    skills: arrayField(r.skills, (value) => {
      const s = record(value);
      return {
        skillCode: textField(s.skillCode),
        titleAr: textField(s.titleAr),
        prerequisiteSkillCodes: strings(s.prerequisiteSkillCodes),
        lessonRevisionId: optionalText(s.lessonRevisionId),
      };
    }),
    errors: arrayField(r.errors, (value) => {
      const e = record(value);
      return {
        errorCode: textField(e.errorCode),
        candidateSkills: strings(e.candidateSkills),
        mappingPending: booleanField(e.mappingPending),
      };
    }),
  };
}

export const learningItems = (value: unknown) =>
  arrayField(record(value).items, learningRevision);
export const bankItems = (value: unknown) =>
  arrayField(record(value).items, bankProblem);

export function assessmentQuestion(value: unknown): AssessmentQuestion {
  const q = record(value);
  return {
    id: textField(q.id),
    problem: bankProblem(q.problem),
    attemptId: optionalText(q.attemptId),
    steps: strings(q.steps),
    value: textField(q.value),
    unit: textField(q.unit),
    status: optionalText(q.status),
    independent: booleanField(q.independent),
    supportLevel: numberField(q.supportLevel),
    completed: booleanField(q.completed),
  };
}
export function assessmentSession(value: unknown): AssessmentSession {
  const s = record(value),
    coverage = record(s.coverage);
  const subject = subjectField(s.subject),
    questions = arrayField(s.questions, assessmentQuestion);
  for (const question of questions) {
    const statuses =
      subject === "algebra"
        ? [
            "verified_valid",
            "verified_invalid",
            "syntax_error",
            "unsupported",
            "inconclusive",
            "service_error",
          ]
        : subject === "physics"
          ? [
              "correct",
              "wrong_value",
              "wrong_unit",
              "unsupported",
              "inconclusive",
              "service_error",
            ]
          : [];
    if (
      question.problem.subject !== subject ||
      (question.status !== null && !statuses.includes(question.status))
    )
      throw new Error("invalid_response");
  }
  return {
    id: textField(s.id),
    revision: numberField(s.revision),
    subject,
    kind: enumField(s.kind, [
      "diagnostic_pretest",
      "lesson_check",
      "post_remediation",
      "practice",
    ]),
    trackRevisionId: textField(s.trackRevisionId),
    lessonRevisionId: optionalText(s.lessonRevisionId),
    status: enumField(s.status, ["active", "completed"]),
    mode: enumField(s.mode, ["independent", "practice"]),
    questions,
    coverage: {
      requested: numberField(coverage.requested),
      available: numberField(coverage.available),
      partial: booleanField(coverage.partial),
      messageAr: textField(coverage.messageAr),
    },
    createdAt: textField(s.createdAt),
  };
}
export function skillEvidence(value: unknown): LearningSkillEvidence {
  const s = record(value);
  return {
    skillCode: textField(s.skillCode),
    titleAr: textField(s.titleAr),
    state: enumField(s.state, [
      "not_assessed",
      "needs_review",
      "practicing_with_support",
      "independent_evidence",
      "insufficient_evidence",
    ]),
    independentCorrect: numberField(s.independentCorrect),
    independentErrors: numberField(s.independentErrors),
    assisted: numberField(s.assisted),
    evidenceIds: strings(s.evidenceIds),
    source: textField(s.source),
  };
}
export function recommendation(value: unknown): LearningRecommendation {
  const r = record(value);
  return {
    recommendedLessonId: textField(r.recommendedLessonId),
    targetSkillCode: textField(r.targetSkillCode),
    reasonCode: enumField(r.reasonCode, [
      "repeated_independent_error",
      "tentative_review",
      "prerequisite_review",
      "additional_evidence",
      "introduction",
    ]),
    reasonAr: textField(r.reasonAr),
    confidence: enumField(r.confidence, ["tentative"]),
    evidenceCount: numberField(r.evidenceCount),
    evidenceIds: strings(r.evidenceIds),
    ruleVersion: textField(r.ruleVersion),
    mappingPending: strings(r.mappingPending),
    nextAction: enumField(r.nextAction, ["study_lesson"]),
    alternatives: arrayField(r.alternatives, (value) => {
      const a = record(value);
      return {
        lessonRevisionId: textField(a.lessonRevisionId),
        titleAr: textField(a.titleAr),
      };
    }),
  };
}
export function assessmentSummary(value: unknown): AssessmentSummary {
  const r = record(value);
  return {
    session: assessmentSession(r.session),
    skills: arrayField(r.skills, skillEvidence),
    recommendation:
      r.recommendation === null ? null : recommendation(r.recommendation),
  };
}
export function pathProgress(value: unknown): LearningPathProgress {
  const r = record(value);
  return {
    skills: arrayField(r.skills, skillEvidence),
    recommendation:
      r.recommendation === null ? null : recommendation(r.recommendation),
    ruleVersion: textField(r.ruleVersion),
    lessons: arrayField(r.lessons, (value) => {
      const l = record(value);
      return {
        lessonRevisionId: textField(l.lessonRevisionId),
        state: enumField(l.state, [
          "not_started",
          "viewed",
          "practiced",
          "independent_evidence",
        ]),
        viewedAt: optionalText(l.viewedAt),
      };
    }),
  };
}
