import type {
  StemLabEventKind,
  StemLabResult,
  StemLabSession,
} from "../../../../packages/contracts/src/stem-labs";
import { ApiFault } from "../http";
import { only, record, productInvalid, textField } from "../product-core";
import type { LabContextExposure } from "./lab-exposure";

export interface LabData {
  trackRevisionId: string;
  lessonRevisionId: string;
  blockIndex: number;
  contentHash: string;
  policyVersion: string;
  familyCode: string;
  contextExposures: LabContextExposure[];
  subject: StemLabSession["subject"];
  labKind: string;
  stage: StemLabSession["stage"];
  prediction: string | null;
  parameters: Record<string, number>;
  observation: string | null;
  explanation: string | null;
  assistanceLevel: number;
  resultRevealed: boolean;
  traceRevealedCount: number;
  eventCount: number;
  lastEvent: string;
  answer: Record<string, unknown> | null;
  result: StemLabResult | null;
  domainVerification: Record<string, unknown>[];
}
const stateFault = () =>
  new ApiFault(
    409,
    "invalid_state",
    "أكمل مرحلة النشاط السابقة أولًا؛ بقي إدخالك محفوظًا.",
  );
export function applyLabEvent(
  data: LabData,
  kind: StemLabEventKind,
  raw: unknown,
): LabData {
  const p = record(raw),
    next = structuredClone(data);
  if (data.eventCount >= 200)
    throw new ApiFault(
      429,
      "rate_limited",
      "بلغ النشاط حد التفاعلات؛ ابدأ نشاطًا جديدًا.",
    );
  if (kind === "prediction_submitted") {
    only(p, ["textAr"]);
    if (
      data.prediction !== null ||
      data.resultRevealed ||
      data.stage !== "opened"
    )
      throw stateFault();
    next.prediction = textField(p.textAr, 1000);
    next.stage = "prediction_saved";
  } else if (kind === "simulation_revealed") {
    only(p, []);
    if (
      data.subject !== "physics" ||
      data.prediction === null ||
      data.resultRevealed
    )
      throw stateFault();
    next.resultRevealed = true;
    next.assistanceLevel = Math.max(1, data.assistanceLevel);
    next.stage = "revealed";
  } else if (kind === "simulation_parameter_changed") {
    only(p, ["parameters"]);
    if (
      !(data.subject === "physics" || data.labKind === "math_linear_graph_v1")
    )
      throw productInvalid();
    if (data.subject === "physics" && !data.resultRevealed) throw stateFault();
    const parameters = record(p.parameters);
    if (
      Object.keys(parameters).length < 1 ||
      Object.keys(parameters).length > 5 ||
      Object.entries(parameters).some(
        ([k, v]) =>
          !Object.hasOwn(data.parameters, k) ||
          typeof v !== "number" ||
          !Number.isFinite(v),
      )
    )
      throw productInvalid();
    next.parameters = { ...data.parameters, ...parameters } as Record<
      string,
      number
    >;
    next.result = null;
    next.domainVerification = [];
    next.answer = null;
    next.stage = data.resultRevealed ? "revealed" : "opened";
    next.observation = null;
    next.explanation = null;
  } else if (kind === "scaffold_revealed") {
    only(p, []);
    if (data.subject === "physics") throw stateFault();
    next.resultRevealed = true;
    next.assistanceLevel = Math.max(1, data.assistanceLevel);
    next.stage = "revealed";
  } else if (kind === "trace_step_revealed") {
    only(p, ["index"]);
    if (
      data.labKind !== "code_trace" ||
      data.prediction === null ||
      p.index !== data.traceRevealedCount
    )
      throw stateFault();
    next.traceRevealedCount++;
    next.assistanceLevel = Math.max(1, data.assistanceLevel);
    next.resultRevealed = true;
    next.stage = "revealed";
  } else if (kind === "observation_saved" || kind === "explanation_saved") {
    only(p, ["textAr"]);
    if (data.subject === "physics" && !data.resultRevealed) throw stateFault();
    const text = textField(p.textAr, 1000);
    if (kind === "observation_saved") next.observation = text;
    else {
      next.explanation = text;
      next.stage = "explained";
    }
  } else throw productInvalid("نوع الحدث غير مدعوم.");
  next.eventCount++;
  next.lastEvent = kind;
  return next;
}

export function validateLabAnswer(raw: unknown): Record<string, unknown> {
  const answer = record(raw);
  if (Buffer.byteLength(JSON.stringify(answer)) > 8192)
    throw productInvalid("الإجابة تتجاوز حدود النشاط.");
  // Exact per-kind fields are validated by the domain verifier as well.
  const banned = new Set([
    "status",
    "verdict",
    "evidenceClass",
    "independent",
    "expectedOutput",
    "privateValidation",
    "hiddenTests",
  ]);
  if (Object.keys(answer).some((key) => banned.has(key)))
    throw productInvalid();
  return structuredClone(answer);
}
