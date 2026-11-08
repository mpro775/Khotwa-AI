import { randomUUID } from "node:crypto";
import type { MathPort, TransitionResult } from "../math-gateway";
import { only, productInvalid, record, textField } from "../product-core";

export const MATH_LAB_KINDS = [
  "math_linear_graph_v1",
  "math_method_comparison_v1",
  "math_first_error_v1",
  "math_why_question_v1",
  "math_completion_v1",
  "math_equivalence_probe_v1",
] as const;
export type MathLabKind = (typeof MATH_LAB_KINDS)[number];
export interface LinearGraphModel {
  modelVersion: "linear_function_v1";
  a: number;
  b: number;
  xMin: number;
  xMax: number;
  step: number;
  targetY?: number;
}
type GraphSpec = { kind: "math_linear_graph_v1"; model: LinearGraphModel };
type MethodSpec = {
  kind: "math_method_comparison_v1";
  originalRaw: string;
  methods: {
    id: string;
    titleAr: string;
    steps: string[];
    mode: "solution" | "common_mistake";
  }[];
  privateValidation: { acceptedMethodIds: string[]; rubricAr: string };
};
type FirstErrorSpec = {
  kind: "math_first_error_v1";
  originalRaw: string;
  steps: string[];
  privateValidation: { expectedFirstInvalidStep: number; reasonAr: string };
};
type WhySpec = {
  kind: "math_why_question_v1";
  fromRaw: string;
  toRaw: string;
  choices: { id: string; textAr: string }[];
  privateValidation: { acceptedChoiceIds: string[]; reasonAr: string };
};
type CompletionSpec = {
  kind: "math_completion_v1";
  originalRaw: string;
  visibleSteps: string[];
  privateValidation: {
    completionRaw: string;
    workedSteps: string[];
    reasonAr: string;
  };
};
type EquivalenceSpec = {
  kind: "math_equivalence_probe_v1";
  fromRaw: string;
  toRaw: string;
};
export type MathLabSpec =
  | GraphSpec
  | MethodSpec
  | FirstErrorSpec
  | WhySpec
  | CompletionSpec
  | EquivalenceSpec;
export type MathLabContext = Parameters<MathPort["verify"]>[0];
export interface MathLabResult {
  result:
    | "correct_practice"
    | "incorrect_practice"
    | "needs_review"
    | "cannot_determine";
  domainVerifier: string;
  reasonCode: string;
  feedbackAr: string;
  evidenceClass: "learning_only";
  domainStatus?: TransitionResult["status"];
  verificationReportIds?: string[];
}
export interface MathSequenceResult {
  outcome: "all_valid" | "first_invalid" | "cannot_determine";
  firstInvalidStep: number | null;
  reports: TransitionResult[];
}
const MAX_STEPS = 12;
const MAX_POINTS = 101;
const SCALE = 1000000n;
const raw = (value: unknown) => textField(value, 256);
function list<T>(value: unknown, parse: (v: unknown) => T, max = 12): T[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max)
    throw productInvalid("راجع عدد عناصر النشاط.");
  return value.map(parse);
}
function id(value: unknown): string {
  const result = textField(value, 48);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw productInvalid();
  return result;
}
function unique(values: string[]): string[] {
  if (new Set(values).size !== values.length) throw productInvalid();
  return values;
}
function keys(value: unknown, allowed: string[]): Record<string, unknown> {
  const result = record(value);
  only(result, allowed);
  return result;
}
function decimal(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > 1000 ||
    !/^-?\d+(?:\.\d{1,6})?$/.test(String(value))
  )
    throw productInvalid("استخدم معاملات عددية محدودة بست منازل عشرية.");
  return value;
}
function scaled(value: number): bigint {
  const [integer = "0", fraction = ""] = Math.abs(value).toString().split(".");
  const result = BigInt(integer) * SCALE + BigInt(fraction.padEnd(6, "0"));
  return value < 0 ? -result : result;
}
function fixedNumber(value: bigint, places: number): number {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value)
    .toString()
    .padStart(places + 1, "0");
  // Convert once from the exact decimal, avoiding double rounding of a large
  // intermediate BigInt through an IEEE-754 integer.
  return Number(sign + digits.slice(0, -places) + "." + digits.slice(-places));
}
export function validateLinearGraphModel(value: unknown): LinearGraphModel {
  const v = keys(value, [
    "modelVersion",
    "a",
    "b",
    "xMin",
    "xMax",
    "step",
    "targetY",
  ]);
  if (v.modelVersion !== "linear_function_v1") throw productInvalid();
  const model: LinearGraphModel = {
    modelVersion: "linear_function_v1",
    a: decimal(v.a),
    b: decimal(v.b),
    xMin: decimal(v.xMin),
    xMax: decimal(v.xMax),
    step: decimal(v.step),
    ...(v.targetY === undefined ? {} : { targetY: decimal(v.targetY) }),
  };
  const width = scaled(model.xMax) - scaled(model.xMin);
  const step = scaled(model.step);
  if (
    width <= 0n ||
    step <= 0n ||
    width % step !== 0n ||
    width / step + 1n > BigInt(MAX_POINTS)
  )
    throw productInvalid("مجال الرسم يجب أن ينتج من نقطتين إلى ١٠١ نقطة.");
  return model;
}
/** One exact fixed-point generator feeds both the graph and its text table. */
export function generateLinearGraph(value: unknown) {
  const model = validateLinearGraphModel(value);
  const a = scaled(model.a),
    b = scaled(model.b),
    start = scaled(model.xMin),
    end = scaled(model.xMax),
    step = scaled(model.step);
  const points: { x: number; y: number }[] = [];
  for (let x = start; x <= end; x += step)
    points.push({
      x: fixedNumber(x, 6),
      y: fixedNumber(a * x + b * SCALE, 12),
    });
  const intersection =
    model.targetY === undefined
      ? null
      : a === 0n
        ? { kind: model.b === model.targetY ? "all_reals" : "empty" }
        : {
            kind: "single",
            x: Number(scaled(model.targetY) - b) / Number(a),
            inWindow:
              a > 0n
                ? (scaled(model.targetY) - b) * SCALE >= a * start &&
                  (scaled(model.targetY) - b) * SCALE <= a * end
                : (scaled(model.targetY) - b) * SCALE <= a * start &&
                  (scaled(model.targetY) - b) * SCALE >= a * end,
          };
  return {
    model,
    points,
    intersection,
    axisLabels: { xAr: "س", yAr: "ص" },
    modelLabelAr: "الدالة الخطية ص = أ × س + ب",
    measurementMode: "learning_only" as const,
  };
}

export function validateMathLabSpec(value: unknown): MathLabSpec {
  const v = record(value);
  switch (v.kind) {
    case "math_linear_graph_v1":
      only(v, ["kind", "model"]);
      return { kind: v.kind, model: validateLinearGraphModel(v.model) };
    case "math_method_comparison_v1": {
      only(v, ["kind", "originalRaw", "methods", "privateValidation"]);
      const methods = list(
        v.methods,
        (value) => {
          const m = keys(value, ["id", "titleAr", "steps", "mode"]);
          if (m.mode !== "solution" && m.mode !== "common_mistake")
            throw productInvalid();
          return {
            id: id(m.id),
            titleAr: textField(m.titleAr, 200),
            steps: list(m.steps, raw, MAX_STEPS),
            mode: m.mode as "solution" | "common_mistake",
          };
        },
        2,
      );
      if (methods.length !== 2) throw productInvalid();
      unique(methods.map((m) => m.id));
      const p = keys(v.privateValidation, ["acceptedMethodIds", "rubricAr"]);
      const accepted = unique(list(p.acceptedMethodIds, id, 2));
      if (accepted.some((choice) => !methods.some((m) => m.id === choice)))
        throw productInvalid();
      return {
        kind: v.kind,
        originalRaw: raw(v.originalRaw),
        methods,
        privateValidation: {
          acceptedMethodIds: accepted,
          rubricAr: textField(p.rubricAr, 2000),
        },
      };
    }
    case "math_first_error_v1": {
      only(v, ["kind", "originalRaw", "steps", "privateValidation"]);
      const steps = list(v.steps, raw, MAX_STEPS);
      const p = keys(v.privateValidation, [
        "expectedFirstInvalidStep",
        "reasonAr",
      ]);
      if (
        !Number.isInteger(p.expectedFirstInvalidStep) ||
        Number(p.expectedFirstInvalidStep) < 1 ||
        Number(p.expectedFirstInvalidStep) > steps.length
      )
        throw productInvalid();
      return {
        kind: v.kind,
        originalRaw: raw(v.originalRaw),
        steps,
        privateValidation: {
          expectedFirstInvalidStep: Number(p.expectedFirstInvalidStep),
          reasonAr: textField(p.reasonAr, 2000),
        },
      };
    }
    case "math_why_question_v1": {
      only(v, ["kind", "fromRaw", "toRaw", "choices", "privateValidation"]);
      const choices = list(
        v.choices,
        (value) => {
          const choice = keys(value, ["id", "textAr"]);
          return { id: id(choice.id), textAr: textField(choice.textAr, 400) };
        },
        6,
      );
      unique(choices.map((c) => c.id));
      const p = keys(v.privateValidation, ["acceptedChoiceIds", "reasonAr"]);
      const accepted = unique(list(p.acceptedChoiceIds, id, 6));
      if (accepted.some((choice) => !choices.some((c) => c.id === choice)))
        throw productInvalid();
      return {
        kind: v.kind,
        fromRaw: raw(v.fromRaw),
        toRaw: raw(v.toRaw),
        choices,
        privateValidation: {
          acceptedChoiceIds: accepted,
          reasonAr: textField(p.reasonAr, 2000),
        },
      };
    }
    case "math_completion_v1": {
      only(v, ["kind", "originalRaw", "visibleSteps", "privateValidation"]);
      if (!Array.isArray(v.visibleSteps) || v.visibleSteps.length > MAX_STEPS)
        throw productInvalid();
      const p = keys(v.privateValidation, [
        "completionRaw",
        "workedSteps",
        "reasonAr",
      ]);
      return {
        kind: v.kind,
        originalRaw: raw(v.originalRaw),
        visibleSteps: v.visibleSteps.map(raw),
        privateValidation: {
          completionRaw: raw(p.completionRaw),
          workedSteps: list(p.workedSteps, raw, MAX_STEPS),
          reasonAr: textField(p.reasonAr, 2000),
        },
      };
    }
    case "math_equivalence_probe_v1":
      only(v, ["kind", "fromRaw", "toRaw"]);
      return { kind: v.kind, fromRaw: raw(v.fromRaw), toRaw: raw(v.toRaw) };
    default:
      throw productInvalid("نوع نشاط الرياضيات غير مدعوم.");
  }
}

/** Explicit projection, so author keys cannot leak through a shallow copy. */
export function publicMathActivity(spec: MathLabSpec): Record<string, unknown> {
  switch (spec.kind) {
    case "math_linear_graph_v1":
      return { kind: spec.kind, ...generateLinearGraph(spec.model) };
    case "math_method_comparison_v1":
      return {
        kind: spec.kind,
        originalRaw: spec.originalRaw,
        methods: spec.methods.map(({ id, titleAr, steps }) => ({
          id,
          titleAr,
          steps,
        })),
      };
    case "math_first_error_v1":
      return {
        kind: spec.kind,
        originalRaw: spec.originalRaw,
        steps: spec.steps,
      };
    case "math_why_question_v1":
      return {
        kind: spec.kind,
        fromRaw: spec.fromRaw,
        toRaw: spec.toRaw,
        choices: spec.choices,
      };
    case "math_completion_v1":
      return {
        kind: spec.kind,
        originalRaw: spec.originalRaw,
        visibleSteps: spec.visibleSteps,
        scaffoldActivity: "completion_step",
      };
    case "math_equivalence_probe_v1":
      return { kind: spec.kind, fromRaw: spec.fromRaw, toRaw: spec.toRaw };
  }
}
/** Call only AFTER a durable assistance/exposure event has been accepted. */
export function revealMathActivity(spec: MathLabSpec): Record<string, unknown> {
  if ("privateValidation" in spec)
    return {
      ...publicMathActivity(spec),
      revealedSupport: spec.privateValidation,
    };
  return publicMathActivity(spec);
}
function blockedNotation(raw: string): boolean {
  return raw.includes("/") || /\\frac|جا|جتا/.test(raw);
}
export async function verifyMathSequence(
  originalRaw: string,
  steps: string[],
  math: MathPort,
  context: MathLabContext,
): Promise<MathSequenceResult> {
  if (steps.length < 1 || steps.length > MAX_STEPS) throw productInvalid();
  const reports: TransitionResult[] = [];
  let previous = originalRaw,
    previousId: string | null = null;
  for (const [index, next] of steps.entries()) {
    if (blockedNotation(previous) || blockedNotation(next))
      return { outcome: "cannot_determine", firstInvalidStep: null, reports };
    const stepId = randomUUID();
    let report: TransitionResult;
    try {
      report = await math.verify(context, {
        fromKind: previousId === null ? "problem" : "step",
        fromStepVersionId: previousId,
        toStepVersionId: stepId,
        fromRaw: previous,
        toRaw: next,
      });
    } catch {
      return { outcome: "cannot_determine", firstInvalidStep: null, reports };
    }
    reports.push(report);
    if (report.status === "verified_invalid")
      return { outcome: "first_invalid", firstInvalidStep: index + 1, reports };
    if (report.status !== "verified_valid")
      return { outcome: "cannot_determine", firstInvalidStep: null, reports };
    previous = next;
    previousId = stepId;
  }
  return { outcome: "all_valid", firstInvalidStep: null, reports };
}
const result = (
  outcome: MathLabResult["result"],
  reasonCode: string,
  reports: TransitionResult[] = [],
): MathLabResult => ({
  result: outcome,
  domainVerifier: reports.length ? "math-internal-v1" : "reviewed_rule_v1",
  reasonCode,
  feedbackAr:
    outcome === "cannot_determine"
      ? "لم نتمكن من التحقق آليًا؛ إجابتك محفوظة، ولم نعتبرها خطأ."
      : outcome === "correct_practice"
        ? "اختيارك مناسب لهذا النشاط التدريبي؛ سنقيس الاستقلال في سؤال جديد."
        : outcome === "incorrect_practice"
          ? "راجع اختيارك في ضوء المعطيات؛ يمكنك طلب مساعدة مسجلة."
          : "حُفظ تفسيرك للتأمل والمراجعة؛ لا يُعد قياس إتقان مستقلًا.",
  evidenceClass: "learning_only",
  ...(reports.length
    ? {
        domainStatus: reports[reports.length - 1]!.status,
        verificationReportIds: reports.map((r) => r.requestId),
      }
    : {}),
});
function selected(value: unknown, allowed: string[]): string[] {
  const values = unique(list(value, id, 6));
  if (values.some((v) => !allowed.includes(v))) throw productInvalid();
  return values;
}
const sameSelection = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v) => b.includes(v));

export async function verifyMathLabSubmission(
  spec: MathLabSpec,
  answer: unknown,
  math: MathPort,
  context: MathLabContext,
): Promise<MathLabResult> {
  const value = record(answer);
  if (spec.kind === "math_linear_graph_v1") {
    only(value, ["observationAr"]);
    textField(value.observationAr, 2000);
    return result("needs_review", "EXPLORATION_RECORDED");
  }
  if (spec.kind === "math_method_comparison_v1") {
    only(value, ["methodIds", "explanationAr"]);
    const selection = selected(
      value.methodIds,
      spec.methods.map((m) => m.id),
    );
    if (value.explanationAr !== undefined)
      textField(value.explanationAr, 2000, 0);
    const validation = await validateMathLabContent(spec, math, context);
    if (!validation.valid)
      return result("cannot_determine", "CONTENT_VERIFICATION_UNAVAILABLE");
    return result(
      sameSelection(selection, spec.privateValidation.acceptedMethodIds)
        ? "correct_practice"
        : "incorrect_practice",
      "METHOD_SELECTION_REVIEWED",
    );
  }
  if (spec.kind === "math_first_error_v1") {
    only(value, ["transitionIndex"]);
    if (
      !Number.isInteger(value.transitionIndex) ||
      Number(value.transitionIndex) < 1 ||
      Number(value.transitionIndex) > spec.steps.length
    )
      throw productInvalid();
    const sequence = await verifyMathSequence(
      spec.originalRaw,
      spec.steps,
      math,
      context,
    );
    if (sequence.outcome === "cannot_determine")
      return result(
        "cannot_determine",
        "FIRST_ERROR_UNDETERMINED",
        sequence.reports,
      );
    return result(
      sequence.outcome === "first_invalid" &&
        value.transitionIndex === sequence.firstInvalidStep
        ? "correct_practice"
        : "incorrect_practice",
      "FIRST_ERROR_SELECTION",
      sequence.reports,
    );
  }
  if (spec.kind === "math_why_question_v1") {
    only(value, ["choiceIds", "explanationAr"]);
    const choices = selected(
      value.choiceIds,
      spec.choices.map((c) => c.id),
    );
    if (value.explanationAr !== undefined)
      textField(value.explanationAr, 2000, 0);
    const sequence = await verifyMathSequence(
      spec.fromRaw,
      [spec.toRaw],
      math,
      context,
    );
    if (sequence.outcome !== "all_valid")
      return result(
        "cannot_determine",
        "JUSTIFICATION_TRANSITION_UNVERIFIED",
        sequence.reports,
      );
    return result(
      sameSelection(choices, spec.privateValidation.acceptedChoiceIds)
        ? "correct_practice"
        : "incorrect_practice",
      "REVIEWED_PRINCIPLE_SELECTION",
      sequence.reports,
    );
  }
  if (spec.kind === "math_completion_v1") {
    only(value, ["raw"]);
    const entered = raw(value.raw);
    const sequence = await verifyMathSequence(
      spec.originalRaw,
      [...spec.visibleSteps, entered],
      math,
      context,
    );
    if (sequence.outcome === "cannot_determine")
      return result(
        "cannot_determine",
        "COMPLETION_UNVERIFIED",
        sequence.reports,
      );
    return result(
      sequence.outcome === "all_valid"
        ? "correct_practice"
        : "incorrect_practice",
      "ASSISTED_COMPLETION",
      sequence.reports,
    );
  }
  only(value, ["equivalent"]);
  if (typeof value.equivalent !== "boolean") throw productInvalid();
  const sequence = await verifyMathSequence(
    spec.fromRaw,
    [spec.toRaw],
    math,
    context,
  );
  if (sequence.outcome === "cannot_determine")
    return result(
      "cannot_determine",
      "EQUIVALENCE_UNDETERMINED",
      sequence.reports,
    );
  return result(
    value.equivalent === (sequence.outcome === "all_valid")
      ? "correct_practice"
      : "incorrect_practice",
    "EQUIVALENCE_SELECTION",
    sequence.reports,
  );
}

/** Author validation is technical; it never grants human review/publication. */
export async function validateMathLabContent(
  spec: MathLabSpec,
  math: MathPort,
  context: MathLabContext,
): Promise<{ valid: boolean; issues: string[] }> {
  if (spec.kind === "math_linear_graph_v1") {
    generateLinearGraph(spec.model);
    return { valid: true, issues: [] };
  }
  if (spec.kind === "math_method_comparison_v1") {
    const issues: string[] = [];
    for (const method of spec.methods) {
      const sequence = await verifyMathSequence(
        spec.originalRaw,
        method.steps,
        math,
        context,
      );
      const claimedCorrect = method.mode === "solution";
      if (
        sequence.outcome === "cannot_determine" ||
        claimedCorrect !== (sequence.outcome === "all_valid") ||
        claimedCorrect !==
          spec.privateValidation.acceptedMethodIds.includes(method.id)
      )
        issues.push("method_claim_unverified:" + method.id);
      if (claimedCorrect && sequence.outcome === "all_valid") {
        try {
          const final = await math.checkFinal(context, spec.originalRaw, {
            stepVersionId: randomUUID(),
            raw: method.steps[method.steps.length - 1]!,
          });
          if (
            final.status !== "verified_valid" ||
            final.isIsolated !== true ||
            final.substitutionValid !== true
          )
            issues.push("method_not_complete:" + method.id);
        } catch {
          issues.push("method_final_unavailable:" + method.id);
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }
  const sequence =
    spec.kind === "math_first_error_v1"
      ? await verifyMathSequence(spec.originalRaw, spec.steps, math, context)
      : spec.kind === "math_completion_v1"
        ? await verifyMathSequence(
            spec.originalRaw,
            [
              ...spec.visibleSteps,
              spec.privateValidation.completionRaw,
              ...spec.privateValidation.workedSteps,
            ],
            math,
            context,
          )
        : await verifyMathSequence(spec.fromRaw, [spec.toRaw], math, context);
  const valid =
    spec.kind === "math_first_error_v1"
      ? sequence.outcome === "first_invalid" &&
        sequence.firstInvalidStep ===
          spec.privateValidation.expectedFirstInvalidStep
      : spec.kind === "math_equivalence_probe_v1"
        ? sequence.outcome !== "cannot_determine"
        : sequence.outcome === "all_valid";
  return { valid, issues: valid ? [] : ["math_activity_claim_unverified"] };
}
