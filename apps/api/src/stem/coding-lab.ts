/** Static, reviewed teaching snapshots only. No source in this module is run. */
export type CodingLabKind =
  | "predict_output"
  | "code_trace"
  | "parsons_reorder"
  | "debug_select_fix";
export interface CodingTraceStep {
  lineId: string;
  sourceLine: number;
  event: "assignment" | "iteration" | "condition" | "return" | "output";
  variablesDisplay: Record<string, string | number | boolean | null>;
  stdoutCumulative: string;
  explanationAr: string;
}
export interface CodingLineItem {
  lineId: string;
  text: string;
  indentationLevel: number;
  isDistractor?: boolean;
}
export interface CodingActivitySpec {
  schemaVersion: "coding-lab-v1";
  kind: CodingLabKind;
  language: "python";
  sourceCode: string;
  lineItems?: CodingLineItem[];
  patchOptions?: {
    patchId: string;
    labelAr: string;
    replacementCode: string;
  }[];
  privateValidation: {
    rubricVersion: string;
    expectedOutput?: string;
    traceSteps?: CodingTraceStep[];
    validOrders?: string[][];
    precedence?: [string, string][];
    correctPatchIds?: string[];
  };
}
export interface CodingPracticeResult {
  status: "correct_practice" | "incorrect_practice";
  domainVerifier: "reviewed_static_rule_v1";
  evidenceClass: "conceptual_practice";
  independentEligible: false;
  reasonCode: string;
  feedbackAr: string;
}
function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("INVALID_CODING_ACTIVITY");
  return raw as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => ![...required, ...optional].includes(key))
  )
    throw new Error("INVALID_CODING_ACTIVITY");
}
function hasUnsafeControls(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return (
      (code < 32 && ![9, 10, 13].includes(code)) ||
      code === 127 ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    );
  });
}
function text(value: unknown, max = 1000, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && !value.trim()) ||
    value.length > max ||
    hasUnsafeControls(value)
  )
    throw new Error("INVALID_CODING_ACTIVITY");
  return value;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value))
    throw new Error("INVALID_CODING_ACTIVITY");
  return value;
}
function list(value: unknown, max: number, allowEmpty = false): unknown[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > max
  )
    throw new Error("INVALID_CODING_ACTIVITY");
  return value;
}
function source(value: unknown): string {
  const code = text(value, 8000);
  if (code.split("\n").length > 100) throw new Error("CODING_SOURCE_LIMIT");
  // Static v1 is limited to short pure examples. This is a publication scope
  // gate, not a Python sandbox or a promise that arbitrary code is safe to run.
  if (
    /\b(?:import|from|open|exec|eval|compile|input|globals|locals|while|async|await|yield|class|with|try|raise|del)\b|__|[;`]/u.test(
      code,
    )
  )
    throw new Error("UNSUPPORTED_STATIC_SOURCE");
  return code;
}
function uniqueIds(values: string[]) {
  if (new Set(values).size !== values.length)
    throw new Error("INVALID_CODING_ACTIVITY");
}
function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\n$/, "");
}
export function validateCodingActivity(raw: unknown): CodingActivitySpec {
  const spec = record(raw);
  keys(
    spec,
    ["schemaVersion", "kind", "language", "sourceCode", "privateValidation"],
    ["lineItems", "patchOptions"],
  );
  if (
    spec.schemaVersion !== "coding-lab-v1" ||
    spec.language !== "python" ||
    ![
      "predict_output",
      "code_trace",
      "parsons_reorder",
      "debug_select_fix",
    ].includes(String(spec.kind))
  )
    throw new Error("UNSUPPORTED_CODING_ACTIVITY");
  const code = source(spec.sourceCode);
  const rubric = record(spec.privateValidation);
  keys(
    rubric,
    ["rubricVersion"],
    [
      "expectedOutput",
      "traceSteps",
      "validOrders",
      "precedence",
      "correctPatchIds",
    ],
  );
  id(rubric.rubricVersion);
  const permitted =
    spec.kind === "predict_output"
      ? ["rubricVersion", "expectedOutput"]
      : spec.kind === "code_trace"
        ? ["rubricVersion", "expectedOutput", "traceSteps"]
        : spec.kind === "parsons_reorder"
          ? ["rubricVersion", "validOrders", "precedence"]
          : ["rubricVersion", "correctPatchIds"];
  if (Object.keys(rubric).some((key) => !permitted.includes(key)))
    throw new Error("INVALID_CODING_ACTIVITY");
  if (spec.kind === "predict_output" || spec.kind === "code_trace")
    text(rubric.expectedOutput, 2000, true);
  if (spec.kind === "code_trace") {
    const steps = list(rubric.traceSteps, 100);
    const lineCount = code.split("\n").length;
    const ids: string[] = [];
    for (const rawStep of steps) {
      const step = record(rawStep);
      keys(step, [
        "lineId",
        "sourceLine",
        "event",
        "variablesDisplay",
        "stdoutCumulative",
        "explanationAr",
      ]);
      ids.push(id(step.lineId));
      if (
        !Number.isInteger(step.sourceLine) ||
        (step.sourceLine as number) < 1 ||
        (step.sourceLine as number) > lineCount ||
        !["assignment", "iteration", "condition", "return", "output"].includes(
          String(step.event),
        )
      )
        throw new Error("INVALID_CODING_TRACE");
      const variables = record(step.variablesDisplay);
      if (Object.keys(variables).length > 20)
        throw new Error("CODING_TRACE_LIMIT");
      for (const [name, value] of Object.entries(variables)) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name))
          throw new Error("INVALID_CODING_TRACE");
        if (typeof value === "string") text(value, 240, true);
        else if (
          value !== null &&
          typeof value !== "boolean" &&
          !(typeof value === "number" && Number.isFinite(value))
        )
          throw new Error("INVALID_CODING_TRACE");
      }
      text(step.stdoutCumulative, 2000, true);
      text(step.explanationAr);
    }
    uniqueIds(ids);
    const last = record(steps[steps.length - 1]);
    if (
      normalizeOutput(last.stdoutCumulative as string) !==
      normalizeOutput(rubric.expectedOutput as string)
    )
      throw new Error("CODING_TRACE_OUTPUT_MISMATCH");
  }
  if (spec.kind === "parsons_reorder") {
    const lines = list(spec.lineItems, 40);
    const ids: string[] = [];
    const required: string[] = [];
    for (const rawLine of lines) {
      const line = record(rawLine);
      keys(line, ["lineId", "text", "indentationLevel"], ["isDistractor"]);
      ids.push(id(line.lineId));
      source(line.text);
      if (
        (line.text as string).includes("\n") ||
        !Number.isInteger(line.indentationLevel) ||
        (line.indentationLevel as number) < 0 ||
        (line.indentationLevel as number) > 8 ||
        (line.isDistractor !== undefined &&
          typeof line.isDistractor !== "boolean")
      )
        throw new Error("INVALID_PARSONS_LINES");
      if (!line.isDistractor) required.push(line.lineId as string);
    }
    uniqueIds(ids);
    if (!required.length) throw new Error("INVALID_PARSONS_RULE");
    if (rubric.validOrders === undefined && rubric.precedence === undefined)
      throw new Error("MISSING_PARSONS_RULE");
    if (rubric.validOrders !== undefined) {
      for (const rawOrder of list(rubric.validOrders, 16)) {
        const order = list(rawOrder, 40).map(id);
        uniqueIds(order);
        if (
          order.length !== required.length ||
          order.some((line) => !required.includes(line))
        )
          throw new Error("INVALID_PARSONS_RULE");
      }
    }
    if (rubric.precedence !== undefined) {
      const edges = list(rubric.precedence, 200, true).map((edge) => {
        if (!Array.isArray(edge) || edge.length !== 2)
          throw new Error("INVALID_PARSONS_RULE");
        const [before, after] = edge.map(id) as [string, string];
        if (
          before === after ||
          !required.includes(before) ||
          !required.includes(after)
        )
          throw new Error("INVALID_PARSONS_RULE");
        return [before, after] as [string, string];
      });
      const pending = new Set(required);
      while (pending.size) {
        const ready = [...pending].filter(
          (line) => !edges.some(([a, b]) => b === line && pending.has(a)),
        );
        if (!ready.length) throw new Error("CYCLIC_PARSONS_RULE");
        ready.forEach((line) => pending.delete(line));
      }
      if (rubric.validOrders !== undefined)
        for (const rawOrder of rubric.validOrders as string[][])
          if (
            edges.some(([a, b]) => rawOrder.indexOf(a) >= rawOrder.indexOf(b))
          )
            throw new Error("INCONSISTENT_PARSONS_RULE");
    }
  } else if (spec.lineItems !== undefined)
    throw new Error("INVALID_CODING_ACTIVITY");
  if (spec.kind === "debug_select_fix") {
    const patches = list(spec.patchOptions, 8);
    const patchIds: string[] = [];
    for (const rawPatch of patches) {
      const patch = record(rawPatch);
      keys(patch, ["patchId", "labelAr", "replacementCode"]);
      patchIds.push(id(patch.patchId));
      text(patch.labelAr);
      source(patch.replacementCode);
    }
    uniqueIds(patchIds);
    const correct = list(rubric.correctPatchIds, 8).map(id);
    uniqueIds(correct);
    if (correct.some((patchId) => !patchIds.includes(patchId)))
      throw new Error("INVALID_DEBUG_RULE");
  } else if (spec.patchOptions !== undefined)
    throw new Error("INVALID_CODING_ACTIVITY");
  return structuredClone(spec) as unknown as CodingActivitySpec;
}

export function publicCodingActivity(raw: unknown) {
  const spec = validateCodingActivity(raw);
  return {
    schemaVersion: spec.schemaVersion,
    kind: spec.kind,
    language: spec.language,
    // Parsons source contains the solved order. Only shuffled line items are
    // public, even when the author snapshot includes a complete reference.
    ...(spec.kind === "parsons_reorder" ? {} : { sourceCode: spec.sourceCode }),
    ...(spec.lineItems
      ? {
          lineItems: spec.lineItems.map((line) => ({
            lineId: line.lineId,
            text: line.text,
            indentationLevel: line.indentationLevel,
          })),
        }
      : {}),
    ...(spec.patchOptions ? { patchOptions: spec.patchOptions } : {}),
    traceStepCount: spec.privateValidation.traceSteps?.length ?? 0,
    measurementMode: "conceptual_practice" as const,
    independentEligible: false as const,
  };
}

/** The caller must record the support event before returning this step. */
export function revealCodingTrace(
  raw: unknown,
  index: number,
): CodingTraceStep {
  const spec = validateCodingActivity(raw);
  if (
    spec.kind !== "code_trace" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= (spec.privateValidation.traceSteps?.length ?? 0)
  )
    throw new Error("INVALID_TRACE_STEP");
  return structuredClone(spec.privateValidation.traceSteps![index]!);
}

export function gradeCodingSubmission(
  raw: unknown,
  rawSubmission: unknown,
): CodingPracticeResult {
  const spec = validateCodingActivity(raw);
  const submitted = record(rawSubmission);
  let correct: boolean;
  let reasonCode = "REVIEWED_RULE_MISMATCH";
  if (spec.kind === "predict_output" || spec.kind === "code_trace") {
    keys(submitted, ["output"]);
    const output = text(submitted.output, 2000, true);
    correct =
      normalizeOutput(output) ===
      normalizeOutput(spec.privateValidation.expectedOutput!);
  } else if (spec.kind === "parsons_reorder") {
    keys(submitted, ["lines"]);
    const lines = list(submitted.lines, 40).map((rawLine) => {
      const line = record(rawLine);
      keys(line, ["lineId", "indentationLevel"]);
      id(line.lineId);
      if (
        !Number.isInteger(line.indentationLevel) ||
        (line.indentationLevel as number) < 0 ||
        (line.indentationLevel as number) > 8
      )
        throw new Error("INVALID_PARSONS_SUBMISSION");
      return line as unknown as Pick<
        CodingLineItem,
        "lineId" | "indentationLevel"
      >;
    });
    const order = lines.map((line) => line.lineId);
    uniqueIds(order);
    const items = spec.lineItems!;
    if (order.some((lineId) => !items.some((line) => line.lineId === lineId)))
      throw new Error("INVALID_PARSONS_SUBMISSION");
    const required = items.filter((line) => !line.isDistractor);
    const complete =
      order.length === required.length &&
      required.every((line) => order.includes(line.lineId));
    const indented = lines.every(
      (line) =>
        items.find((item) => item.lineId === line.lineId)?.indentationLevel ===
        line.indentationLevel,
    );
    const validOrder =
      spec.privateValidation.validOrders === undefined ||
      spec.privateValidation.validOrders.some(
        (valid) => valid.join("\0") === order.join("\0"),
      );
    const ordered = (spec.privateValidation.precedence ?? []).every(
      ([before, after]) => order.indexOf(before) < order.indexOf(after),
    );
    correct = complete && indented && validOrder && ordered;
    if (!indented) reasonCode = "INDENTATION_NEEDS_REVIEW";
  } else {
    keys(submitted, ["patchId"]);
    const patchId = id(submitted.patchId);
    if (!spec.patchOptions!.some((patch) => patch.patchId === patchId))
      throw new Error("INVALID_DEBUG_SUBMISSION");
    correct = spec.privateValidation.correctPatchIds!.includes(patchId);
  }
  return {
    status: correct ? "correct_practice" : "incorrect_practice",
    domainVerifier: "reviewed_static_rule_v1",
    evidenceClass: "conceptual_practice",
    independentEligible: false,
    reasonCode: correct ? "CORRECT_UNDER_REVIEWED_RULE" : reasonCode,
    feedbackAr: correct
      ? "إجابتك مناسبة لهذا النشاط التدريبي؛ التحقق المستقل يحتاج مهمة جديدة."
      : "راجع النتيجة المتوقعة أو ترتيب الخطوات؛ هذه ملاحظة تدريب وليست تشخيصًا مؤكدًا.",
  };
}
