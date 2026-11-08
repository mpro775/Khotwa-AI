import {
  arrayField,
  booleanField,
  numberField,
  record,
  strings,
  subjectField,
  textField,
  type Subject,
} from "./product-api";
import { enumField } from "./learning-path-api";

export interface LabChoice {
  id: string;
  textAr: string;
  code?: string;
}
export interface LabLine {
  id: string;
  code: string;
  indent: number;
}
export interface LabPublicSpec {
  schemaVersion: "subject-lab-v1";
  activityRevisionId: string;
  blockIndex: number;
  subject: Subject;
  labKind: string;
  objectiveAr: string;
  familyCode: string;
  skillCodes: string[];
  domainSpec: {
    kind: string;
    model?: Record<string, number | string>;
    originalRaw?: string;
    fromRaw?: string;
    toRaw?: string;
    steps?: string[];
    visibleSteps?: string[];
    methods?: { id: string; titleAr: string; steps: string[] }[];
    choices?: LabChoice[];
    sourceCode?: string;
    lineItems?: LabLine[];
    options?: LabChoice[];
    assumptionsAr?: string[];
    controlledVariables?: string[];
    allowedUnits?: string[];
    predictionPromptAr?: string;
    observationPromptAr?: string;
    explanationPromptAr?: string;
    traceStepCount?: number;
    quantity?: "distance" | "displacement" | "velocity";
  };
}
export interface LabResult {
  result:
    | "correct_practice"
    | "incorrect_practice"
    | "needs_review"
    | "cannot_determine";
  domainVerifier: string;
  reasonCode: string;
  feedbackAr: string;
  evidenceClass: "learning_only";
}
export interface LabArtifact {
  points?: { x: number; y: number }[];
  physicsPoints?: { t_s: number; x_m: number; v_mps: number }[];
  displacement_m?: number;
  distance_m?: number;
  finalVelocity_mps?: number;
  traceSteps?: {
    lineId: string;
    variablesDisplay: Record<string, string>;
    stdoutCumulative: string;
    explanationAr: string;
  }[];
  feedbackAr?: string;
  reasonAr?: string;
  workedSteps?: string[];
  completionRaw?: string;
}
export interface LabSession {
  id: string;
  revision: number;
  trackRevisionId: string;
  lessonRevisionId: string;
  blockIndex: number;
  subject: Subject;
  labKind: string;
  stage: "opened" | "prediction_saved" | "revealed" | "explained" | "submitted";
  activity: LabPublicSpec;
  prediction: string | null;
  observation: string | null;
  explanation: string | null;
  parameters: Record<string, number>;
  assistanceLevel: number;
  resultRevealed: boolean;
  artifact: LabArtifact | null;
  result: LabResult | null;
  answer?: Record<string, unknown> | null;
  evidenceClass: "learning_only";
  transfer: { available: boolean; reasonCode: string };
}
export function labCapabilities(value: unknown) {
  const r = record(value);
  if (
    r.schemaVersion !== "subject-lab-v1" ||
    r.runnerBridge !== false ||
    r.phet !== false
  )
    throw new Error("invalid_response");
  return {
    math: booleanField(r.math),
    physics: booleanField(r.physics),
    codingNonExecuting: booleanField(r.codingNonExecuting),
    runnerBridge: false as const,
    phet: false as const,
    reasonCode: textField(r.reasonCode),
  };
}
const optionalString = (r: Record<string, unknown>, key: string) =>
  r[key] === undefined ? {} : { [key]: textField(r[key]) };
function labChoice(value: unknown): LabChoice {
  const r = record(value);
  return { id: textField(r.id), textAr: textField(r.textAr) };
}
export function labActivity(value: unknown): LabPublicSpec {
  const r = record(value),
    d = record(r.domainSpec),
    subject = subjectField(r.subject);
  if (r.schemaVersion !== "subject-lab-v1") throw new Error("invalid_response");
  const kind = textField(d.kind);
  const validKinds =
    subject === "algebra"
      ? [
          "math_linear_graph_v1",
          "math_method_comparison_v1",
          "math_first_error_v1",
          "math_why_question_v1",
          "math_completion_v1",
          "math_equivalence_probe_v1",
        ]
      : subject === "physics"
        ? [
            "physics_prediction_experiment_v1",
            "physics_parameter_simulation_v1",
            "physics_graph_to_physics_v1",
            "physics_units_v1",
            "physics_misconception_contrast_v1",
          ]
        : [
            "predict_output",
            "code_trace",
            "parsons_reorder",
            "debug_select_fix",
          ];
  if (!validKinds.includes(kind)) throw new Error("invalid_response");
  const model: Record<string, number | string> = {};
  if (d.model !== undefined) {
    const m = record(d.model);
    for (const key of [
      "modelVersion",
      "modelCode",
      "schemaVersion",
      "unitSystem",
      "domain",
    ])
      if (m[key] !== undefined) model[key] = textField(m[key]);
    for (const key of [
      "a",
      "b",
      "xMin",
      "xMax",
      "step",
      "targetY",
      "sampleCount",
    ])
      if (m[key] !== undefined) model[key] = numberField(m[key]);
  }
  return {
    schemaVersion: "subject-lab-v1",
    activityRevisionId: textField(r.activityRevisionId),
    blockIndex: numberField(r.blockIndex),
    subject,
    labKind: textField(r.labKind),
    objectiveAr: textField(r.objectiveAr),
    familyCode: textField(r.familyCode),
    skillCodes: strings(r.skillCodes),
    domainSpec: {
      kind,
      ...(d.model === undefined ? {} : { model }),
      ...optionalString(d, "originalRaw"),
      ...optionalString(d, "fromRaw"),
      ...optionalString(d, "toRaw"),
      ...optionalString(d, "sourceCode"),
      ...optionalString(d, "predictionPromptAr"),
      ...optionalString(d, "observationPromptAr"),
      ...optionalString(d, "explanationPromptAr"),
      ...(d.steps === undefined ? {} : { steps: strings(d.steps) }),
      ...(d.visibleSteps === undefined
        ? {}
        : { visibleSteps: strings(d.visibleSteps) }),
      ...(d.assumptionsAr === undefined
        ? {}
        : { assumptionsAr: strings(d.assumptionsAr) }),
      ...(d.controlledVariables === undefined
        ? {}
        : { controlledVariables: strings(d.controlledVariables) }),
      ...(d.allowedUnits === undefined
        ? {}
        : { allowedUnits: strings(d.allowedUnits) }),
      ...(d.traceStepCount === undefined
        ? {}
        : { traceStepCount: numberField(d.traceStepCount) }),
      ...(d.quantity === undefined
        ? {}
        : {
            quantity: enumField(d.quantity, [
              "distance",
              "displacement",
              "velocity",
            ] as const),
          }),
      ...(d.methods === undefined
        ? {}
        : {
            methods: arrayField(d.methods, (value) => {
              const m = record(value);
              return {
                id: textField(m.id),
                titleAr: textField(m.titleAr),
                steps: strings(m.steps),
              };
            }),
          }),
      ...(d.choices === undefined
        ? {}
        : { choices: arrayField(d.choices, labChoice) }),
      ...(d.patchOptions === undefined
        ? {}
        : {
            options: arrayField(d.patchOptions, (value) => {
              const p = record(value);
              return {
                id: textField(p.patchId),
                textAr: textField(p.labelAr),
                code: textField(p.replacementCode),
              };
            }),
          }),
      ...(d.lineItems === undefined
        ? {}
        : {
            lineItems: arrayField(d.lineItems, (value) => {
              const l = record(value);
              return {
                id: textField(l.lineId),
                code: textField(l.text),
                indent: numberField(l.indentationLevel),
              };
            }),
          }),
    },
  };
}
export function labResult(value: unknown): LabResult {
  const r = record(value);
  if (r.evidenceClass !== "learning_only") throw new Error("invalid_response");
  return {
    result: enumField(r.result, [
      "correct_practice",
      "incorrect_practice",
      "needs_review",
      "cannot_determine",
    ]),
    domainVerifier: textField(r.domainVerifier),
    reasonCode: textField(r.reasonCode),
    feedbackAr: textField(r.feedbackAr),
    evidenceClass: "learning_only",
  };
}
function labArtifact(value: unknown): LabArtifact {
  const r = record(value),
    points = r.points;
  const artifact: LabArtifact = {};
  if (Array.isArray(points) && points.length && "t_s" in record(points[0]))
    artifact.physicsPoints = arrayField(points, (value) => {
      const p = record(value);
      return {
        t_s: numberField(p.t_s),
        x_m: numberField(p.x_m),
        v_mps: numberField(p.v_mps),
      };
    });
  else if (points !== undefined)
    artifact.points = arrayField(points, (value) => {
      const p = record(value);
      return { x: numberField(p.x), y: numberField(p.y) };
    });
  for (const key of [
    "displacement_m",
    "distance_m",
    "finalVelocity_mps",
  ] as const)
    if (r[key] !== undefined) artifact[key] = numberField(r[key]);
  if (r.traceSteps !== undefined)
    artifact.traceSteps = arrayField(r.traceSteps, (value) => {
      const t = record(value);
      return {
        lineId: textField(t.lineId),
        variablesDisplay: Object.fromEntries(
          Object.entries(record(t.variablesDisplay)).map(([k, v]) => {
            if (
              v !== null &&
              !["string", "number", "boolean"].includes(typeof v)
            )
              throw new Error("invalid_response");
            return [k, String(v)];
          }),
        ),
        stdoutCumulative: textField(t.stdoutCumulative),
        explanationAr: textField(t.explanationAr),
      };
    });
  if (r.feedbackAr !== undefined) artifact.feedbackAr = textField(r.feedbackAr);
  if (r.revealedSupport !== undefined) {
    const s = record(r.revealedSupport);
    if (s.reasonAr !== undefined) artifact.reasonAr = textField(s.reasonAr);
    if (s.workedSteps !== undefined)
      artifact.workedSteps = strings(s.workedSteps);
    if (s.completionRaw !== undefined)
      artifact.completionRaw = textField(s.completionRaw);
    if (s.rubricAr !== undefined) artifact.reasonAr = textField(s.rubricAr);
  }
  return artifact;
}
export function labSession(value: unknown): LabSession {
  const r = record(value),
    transfer = record(r.transfer),
    revealed = booleanField(r.resultRevealed);
  if (r.evidenceClass !== "learning_only") throw new Error("invalid_response");
  const nullableText = (value: unknown) =>
    value === null ? null : textField(value);
  return {
    id: textField(r.id),
    revision: numberField(r.revision),
    trackRevisionId: textField(r.trackRevisionId),
    lessonRevisionId: textField(r.lessonRevisionId),
    blockIndex: numberField(r.blockIndex),
    subject: subjectField(r.subject),
    labKind: textField(r.labKind),
    stage: enumField(r.stage, [
      "opened",
      "prediction_saved",
      "revealed",
      "explained",
      "submitted",
    ]),
    activity: labActivity(r.activity),
    prediction: nullableText(r.prediction),
    observation: nullableText(r.observation),
    explanation: nullableText(r.explanation),
    parameters: Object.fromEntries(
      Object.entries(record(r.parameters)).map(([k, v]) => [k, numberField(v)]),
    ),
    assistanceLevel: numberField(r.assistanceLevel),
    resultRevealed: revealed,
    // Never display a premature outcome, even if a malformed response includes one.
    artifact:
      ((r.subject === "physics" || r.subject === "programming") && !revealed) ||
      r.artifact === null
        ? null
        : labArtifact(r.artifact),
    result: r.result === null ? null : labResult(r.result),
    answer:
      r.answer === undefined || r.answer === null
        ? null
        : savedLabAnswer(r.answer),
    evidenceClass: "learning_only",
    transfer: {
      available: booleanField(transfer.available),
      reasonCode: textField(transfer.reasonCode),
    },
  };
}
function savedLabAnswer(raw: unknown): Record<string, unknown> {
  const r = record(raw),
    answer: Record<string, unknown> = {};
  for (const key of [
    "raw",
    "output",
    "observationAr",
    "explanationAr",
    "patchId",
    "value",
    "unit",
  ])
    if (r[key] !== undefined) answer[key] = textField(r[key]);
  for (const key of ["choiceIds", "methodIds"])
    if (r[key] !== undefined) answer[key] = strings(r[key]);
  if (r.transitionIndex !== undefined)
    answer.transitionIndex = numberField(r.transitionIndex);
  if (r.equivalent !== undefined)
    answer.equivalent = booleanField(r.equivalent);
  if (r.lines !== undefined)
    answer.lines = arrayField(r.lines, (value) => {
      const l = record(value);
      return {
        lineId: textField(l.lineId),
        indentationLevel: numberField(l.indentationLevel),
      };
    });
  return answer;
}
