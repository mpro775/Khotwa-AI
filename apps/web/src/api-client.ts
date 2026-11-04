import type { components } from "@khotwa/contracts";
import validators from "../../../packages/contracts/src/generated/api-validators.cjs";
export type Schema<K extends keyof components["schemas"]> =
  components["schemas"][K];
type EnvelopeName =
  | "BootstrapEnvelope"
  | "GuestEnvelope"
  | "GuestCurrentEnvelope"
  | "LearningSessionEnvelope"
  | "SkillListEnvelope"
  | "ProblemListEnvelope"
  | "ProblemEnvelope"
  | "AttemptEnvelope"
  | "StepMutationEnvelope"
  | "VerificationEnvelope"
  | "VerificationDetailEnvelope";
function validate<K extends keyof components["schemas"]>(
  name: K,
  value: unknown,
): Schema<K> {
  const check = validators[name];
  if (!check || !check(value))
    throw new ClientFault(
      0,
      "invalid_response",
      "تعذر قراءة رد موثوق من الخدمة. بقيت مسودتك كما هي.",
    );
  return value as Schema<K>;
}
export class ClientFault extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageAr: string,
    readonly currentRevision: number | null = null,
  ) {
    super(messageAr);
  }
}
export class ApiClient {
  private csrf: string | null = null;
  constructor(private readonly transport: typeof fetch = fetch) {}
  async request<K extends EnvelopeName>(
    path: string,
    schema: K,
    method = "GET",
    body?: unknown,
    key?: string,
  ): Promise<Schema<K>["data"]> {
    const headers: Record<string, string> = {};
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      if (this.csrf) headers["X-CSRF-Token"] = this.csrf;
      if (key) headers["Idempotency-Key"] = key;
    }
    let response: Response;
    try {
      response = await this.transport("/api/v1" + path, {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ClientFault(
        0,
        "network_error",
        "تعذر الاتصال. احتفظنا بمسودتك؛ أعد إرسال الطلب نفسه عند عودة الشبكة.",
      );
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new ClientFault(
        0,
        "invalid_response",
        "تعذر قراءة رد الخدمة. مسودتك باقية دون حكم رياضي.",
      );
    }
    if (!response.ok) {
      const error = validate("ErrorEnvelope", raw).error;
      throw new ClientFault(
        response.status,
        error.code,
        error.messageAr,
        error.currentRevision,
      );
    }
    return validate(schema, raw).data;
  }
  async start(): Promise<Schema<"GuestSession">> {
    const bootstrap = await this.request("/bootstrap", "BootstrapEnvelope");
    this.csrf = bootstrap.csrfToken;
    const created = await this.request(
      "/guest-sessions",
      "GuestEnvelope",
      "POST",
      {},
    );
    this.csrf = created.csrfToken;
    return created.session;
  }
}
