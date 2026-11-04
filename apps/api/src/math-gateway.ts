import { randomUUID } from "node:crypto";
import { ApiFault } from "./http";
import { internalValue, Schema } from "./contracts";

type Context = Schema<"InternalMathContext">;
type TransitionRequest = Schema<"InternalMathTransitionRequest">;
export type TransitionResult = Schema<"InternalMathTransitionResult">;
export interface ParseResult {
  schemaVersion: "math-internal-v1";
  requestId: string;
  context: Context;
  engineVersion: string;
  notationProfileVersion: string;
  operation: "parse";
  source: { kind: "problem" | "step"; stepVersionId: string | null };
  astSchemaVersion: "math-ast-v1";
  parseStatus:
    | "parsed"
    | "syntax_error"
    | "unsupported"
    | "inconclusive"
    | "service_error";
  normalizedText: string | null;
  displayAr: string | null;
  ast: Record<string, unknown> | null;
  reasonCode: string | null;
  issue: Schema<"MathIssue"> | null;
}
export interface FinalResult {
  schemaVersion: "math-internal-v1";
  requestId: string;
  context: Context;
  engineVersion: string;
  notationProfileVersion: string;
  operation: "check-final";
  finalStepVersionId: string;
  status: Schema<"MathStatus">;
  isIsolated: boolean | null;
  substitutionValid: boolean | null;
  solution: Schema<"Rational"> | null;
  originalSolution: Schema<"SolutionSet"> | null;
  finalSolution: Schema<"SolutionSet"> | null;
  reasonCode: string | null;
  evidence: Schema<"InternalMathEvidence"> | null;
  issue: Schema<"MathIssue"> | null;
}
export interface MathGatewaySettings {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  expectedEngine: string;
}
export interface MathPort {
  parse(
    context: Context,
    source: ParseResult["source"],
    raw: string,
    signal?: AbortSignal,
  ): Promise<ParseResult>;
  verify(
    context: Context,
    transition: TransitionRequest["transition"],
    signal?: AbortSignal,
  ): Promise<TransitionResult>;
  checkFinal(
    context: Context,
    originalRaw: string,
    finalStep: { stepVersionId: string; raw: string },
    signal?: AbortSignal,
  ): Promise<FinalResult>;
}
export class MathGateway implements MathPort {
  private readonly base: URL;
  constructor(readonly settings: MathGatewaySettings) {
    this.base = new URL(settings.baseUrl);
    if (
      !["http:", "https:"].includes(this.base.protocol) ||
      this.base.username ||
      this.base.password ||
      this.base.pathname !== "/" ||
      this.base.search ||
      this.base.hash ||
      settings.token.length < 32 ||
      !Number.isInteger(settings.timeoutMs) ||
      settings.timeoutMs <= 0
    )
      throw new Error("Invalid private math endpoint configuration");
  }
  private unavailable(): ApiFault {
    return new ApiFault(
      503,
      "math_unavailable",
      "تعذر التحقق الآن. بقيت الخطوة محفوظة دون حكم على فهمك.",
    );
  }
  private async call<T>(
    operation: string,
    requestSchema: string,
    responseSchema: string,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    internalValue(requestSchema, request);
    try {
      const response = await fetch(
        new URL("/internal/v1/math/" + operation, this.base),
        {
          method: "POST",
          headers: {
            authorization: "Bearer " + this.settings.token,
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
          redirect: "error",
          signal: signal
            ? AbortSignal.any([
                signal,
                AbortSignal.timeout(this.settings.timeoutMs),
              ])
            : AbortSignal.timeout(this.settings.timeoutMs),
        },
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw this.unavailable();
      const reader = response.body?.getReader();
      if (!reader) throw this.unavailable();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.length;
          if (size > 65536) throw this.unavailable();
          chunks.push(next.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const value: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
      return internalValue<T>(responseSchema, value);
    } catch {
      throw this.unavailable();
    }
  }
  private version(
    value: { engineVersion: string; notationProfileVersion: string },
    context: Context,
  ): void {
    if (
      value.engineVersion !== this.settings.expectedEngine ||
      value.notationProfileVersion !== context.notationProfile
    )
      throw this.unavailable();
  }
  private context(actual: Context, expected: Context): void {
    for (const key of [
      "attemptId",
      "attemptRevision",
      "problemRevisionId",
      "notationProfile",
      "domain",
    ] as const)
      if (actual[key] !== expected[key]) throw this.unavailable();
  }
  async parse(
    context: Context,
    source: ParseResult["source"],
    raw: string,
    signal?: AbortSignal,
  ): Promise<ParseResult> {
    const requestId = randomUUID();
    const result = await this.call<ParseResult>(
      "parse",
      "InternalMathParseRequest",
      "InternalMathParseResult",
      {
        schemaVersion: "math-internal-v1",
        requestId,
        context,
        operation: "parse",
        source,
        raw,
      },
      signal,
    );
    this.version(result, context);
    this.context(result.context, context);
    if (
      result.requestId !== requestId ||
      result.source.kind !== source.kind ||
      result.source.stepVersionId !== source.stepVersionId ||
      (result.ast &&
        (result.ast.sourceRaw !== raw ||
          result.ast.notationProfileVersion !== context.notationProfile))
    )
      throw this.unavailable();
    return result;
  }
  async verify(
    context: Context,
    transition: TransitionRequest["transition"],
    signal?: AbortSignal,
  ): Promise<TransitionResult> {
    if (
      (transition.fromKind === "problem") !==
      (transition.fromStepVersionId === null)
    )
      throw this.unavailable();
    const requestId = randomUUID();
    const result = await this.call<TransitionResult>(
      "verify-transition",
      "InternalMathTransitionRequest",
      "InternalMathTransitionResult",
      { schemaVersion: "math-internal-v1", requestId, context, transition },
      signal,
    );
    this.version(result, context);
    if (
      result.requestId !== requestId ||
      result.attemptRevision !== context.attemptRevision
    )
      throw this.unavailable();
    if (
      result.status === "verified_invalid" &&
      (!result.evidence || result.evidence.type === "none")
    )
      throw this.unavailable();
    return result;
  }
  async checkFinal(
    context: Context,
    originalRaw: string,
    finalStep: { stepVersionId: string; raw: string },
    signal?: AbortSignal,
  ): Promise<FinalResult> {
    const requestId = randomUUID();
    const result = await this.call<FinalResult>(
      "check-final",
      "InternalMathCheckFinalRequest",
      "InternalMathCheckFinalResult",
      {
        schemaVersion: "math-internal-v1",
        requestId,
        context,
        operation: "check-final",
        originalRaw,
        finalStep,
      },
      signal,
    );
    this.version(result, context);
    this.context(result.context, context);
    if (
      result.requestId !== requestId ||
      result.finalStepVersionId !== finalStep.stepVersionId
    )
      throw this.unavailable();
    return result;
  }
}
