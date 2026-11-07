import type { PhysicsContent } from "../../../packages/contracts/src/product";
import type { PhysicsStatus } from "../../../packages/contracts/src/product-physics";
import { ApiFault } from "./http";

export interface PhysicsResult {
  contractVersion: "physics-internal-v1";
  engineVersion: "physics-1.0.0";
  problemRevisionId: string;
  status: PhysicsStatus;
  valueCorrect: boolean | null;
  unitCorrect: boolean | null;
  reasonCode: string;
  diagnosisCode: string | null;
}
const unavailable = () =>
  new ApiFault(
    503,
    "math_unavailable",
    "تعذر التحقق الفيزيائي الآن؛ احتفظنا بمحاولتك دون حكم على فهمك.",
  );
export class PhysicsGateway {
  constructor(
    readonly baseUrl = process.env.MATH_ENGINE_BASE_URL ?? "",
    readonly token = process.env.MATH_INTERNAL_TOKEN ?? "",
    readonly timeoutMs = Number(process.env.PHYSICS_TIMEOUT_MS ?? "3000"),
    readonly transport: typeof fetch = fetch,
  ) {}
  private async call(
    problemRevisionId: string,
    reference: PhysicsContent,
    answer?: { value: string; unit: string },
  ): Promise<PhysicsResult> {
    try {
      const base = new URL(this.baseUrl);
      if (
        !["http:", "https:"].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.pathname !== "/" ||
        base.search ||
        base.hash ||
        this.token.length < 32 ||
        !Number.isInteger(this.timeoutMs) ||
        this.timeoutMs < 100 ||
        this.timeoutMs > 30000
      )
        throw unavailable();
      const response = await this.transport(
        new URL("/internal/v1/physics/verify", base),
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            "content-type": "application/json",
            authorization: "Bearer " + this.token,
          },
          body: JSON.stringify({
            contractVersion: "physics-internal-v1",
            operation: answer ? "check_answer" : "validate_reference",
            problemRevisionId,
            reference,
            ...(answer ? { answer } : {}),
          }),
        },
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw unavailable();
      const reader = response.body?.getReader();
      if (!reader) throw unavailable();
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.length;
          if (size > 8192) throw unavailable();
          chunks.push(next.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const raw: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw unavailable();
      const r = raw as Record<string, unknown>;
      if (
        Object.keys(r).sort().join(",") !==
          "contractVersion,diagnosisCode,engineVersion,problemRevisionId,reasonCode,status,unitCorrect,valueCorrect" ||
        r.contractVersion !== "physics-internal-v1" ||
        r.engineVersion !== "physics-1.0.0" ||
        r.problemRevisionId !== problemRevisionId ||
        ![
          "correct",
          "wrong_value",
          "wrong_unit",
          "unsupported",
          "invalid_input",
          "service_error",
        ].includes(String(r.status)) ||
        ![true, false, null].includes(r.valueCorrect as boolean | null) ||
        ![true, false, null].includes(r.unitCorrect as boolean | null) ||
        typeof r.reasonCode !== "string" ||
        !/^[A-Z_]{1,80}$/.test(r.reasonCode) ||
        !(
          r.diagnosisCode === null ||
          [
            "speed_distance_confusion",
            "unit_conversion",
            "sign_or_acceleration",
            "formula_choice",
          ].includes(String(r.diagnosisCode))
        )
      )
        throw unavailable();
      if (
        r.status === "correct" &&
        (r.valueCorrect !== true || r.unitCorrect !== true)
      )
        throw unavailable();
      if (r.status === "wrong_unit" && r.unitCorrect !== false)
        throw unavailable();
      if (
        r.status === "wrong_value" &&
        (r.unitCorrect !== true || r.valueCorrect !== false)
      )
        throw unavailable();
      return r as unknown as PhysicsResult;
    } catch {
      throw unavailable();
    }
  }
  verify(
    id: string,
    reference: PhysicsContent,
    answer: { value: string; unit: string },
  ) {
    return this.call(id, reference, answer);
  }
  validateReference(id: string, reference: PhysicsContent) {
    return this.call(id, reference);
  }
}
