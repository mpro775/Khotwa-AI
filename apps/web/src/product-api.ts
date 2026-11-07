import { ApiClient } from "./api-client";

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
export type Data = Record<string, unknown>;
export type Decoder<T> = (value: unknown) => T;
export function record(value: unknown): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_response");
  return value as Data;
}
export function textField(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid_response");
  return value;
}
export function numberField(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("invalid_response");
  return value;
}
export function booleanField(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("invalid_response");
  return value;
}
export function arrayField<T>(value: unknown, decode: Decoder<T>): T[] {
  if (!Array.isArray(value)) throw new Error("invalid_response");
  return value.map(decode);
}
export const strings = (value: unknown) => arrayField(value, textField);
export function optionalText(value: unknown): string | null {
  return value === undefined || value === null ? null : textField(value);
}
export function jsonValue(value: unknown): Json {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  const obj = record(value);
  return Object.fromEntries(
    Object.entries(obj).map(([key, item]) => [key, jsonValue(item)]),
  );
}
export interface ProductUser {
  id: string;
  email: string;
  role: string;
  status: string;
}
export interface Identity {
  user: ProductUser | null;
  csrfToken: string | null;
  guestAvailable: boolean;
}
export function identityData(value: unknown): Identity {
  const data = record(value);
  let user: ProductUser | null = null;
  if (data.user !== null) {
    const u = record(data.user);
    user = {
      id: textField(u.id),
      email: textField(u.email),
      role: textField(u.role),
      status: textField(u.status),
    };
  }
  return {
    user,
    csrfToken: optionalText(data.csrfToken),
    guestAvailable: booleanField(data.guestAvailable),
  };
}
export class ProductFault extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageAr: string,
    readonly requestId: string | null = null,
  ) {
    super(messageAr);
  }
}
export const messageOf = (error: unknown): string =>
  error instanceof ProductFault
    ? error.messageAr
    : "تعذرت العملية. بقيت البيانات التي كتبتها كما هي؛ أعد المحاولة.";

/** Same-origin public NestJS API only; credentials and CSRF never persist in browser storage. */
export class ProductApi {
  private csrf: string | null = null;
  private loginCsrf: string | null = null;
  private readonly retries = new Map<string, string>();
  constructor(private readonly transport: typeof fetch = fetch) {}
  async request<T>(
    path: string,
    decode: Decoder<T>,
    method = "GET",
    body?: unknown,
    key?: string,
    signal?: AbortSignal,
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new Error("invalid_api_path");
    const headers: Record<string, string> = {};
    const operation = method + ":" + path + ":" + JSON.stringify(body ?? null);
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      const csrf = path.startsWith("/auth/email/")
        ? (this.loginCsrf ?? this.csrf)
        : this.csrf;
      if (csrf) headers["X-CSRF-Token"] = csrf;
      if (!key && !this.retries.has(operation)) {
        if (this.retries.size >= 64) this.retries.clear();
        this.retries.set(operation, crypto.randomUUID());
      }
      headers["Idempotency-Key"] =
        key ?? this.retries.get(operation) ?? crypto.randomUUID();
    }
    let response: Response;
    try {
      response = await this.transport("/api/v1" + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000),
      });
    } catch {
      throw new ProductFault(
        0,
        "network_error",
        "تعذر الاتصال. مسودتك باقية؛ يمكنك إعادة إرسال الطلب عند عودة الشبكة.",
      );
    }
    if (response.status === 204) return decode(null);
    let raw: Data;
    try {
      raw = record(await response.json());
    } catch {
      throw new ProductFault(
        response.status,
        "invalid_response",
        "تعذر قراءة رد الخدمة. مسودتك باقية دون حكم جديد.",
      );
    }
    if (!response.ok) {
      const error = record(raw.error);
      if (
        response.status >= 400 &&
        response.status < 500 &&
        ![408, 429].includes(response.status) &&
        error.code !== "request_in_progress"
      )
        this.retries.delete(operation);
      const meta = raw.meta ? record(raw.meta) : {};
      throw new ProductFault(
        response.status,
        textField(error.code),
        textField(error.messageAr),
        optionalText(meta.requestId),
      );
    }
    try {
      const data = decode(raw.data);
      this.retries.delete(operation);
      if (raw.data && typeof raw.data === "object" && "csrfToken" in raw.data)
        this.csrf = optionalText(raw.data.csrfToken);
      if (
        raw.data &&
        typeof raw.data === "object" &&
        "loginCsrfToken" in raw.data
      )
        this.loginCsrf = optionalText(raw.data.loginCsrfToken);
      return data;
    } catch {
      throw new ProductFault(
        response.status,
        "invalid_response",
        "تعذر قراءة رد موثوق من الخدمة؛ لا نعتمد نتيجة غير واضحة.",
      );
    }
  }
  me(): Promise<Identity> {
    return this.request("/me", identityData);
  }
  async guest(): Promise<Identity> {
    await new ApiClient(this.transport).start();
    return this.me();
  }
}

export type Subject = "algebra" | "physics" | "programming";
export interface PublicItem {
  id: string;
  itemId: string;
  version: number;
  subject: Subject;
  titleAr: string;
  statementAr: string;
  unitCode: string;
  lessonCode: string;
  skillCodes: string[];
  difficulty: number;
  kind: string;
  algebra?: { equationRaw: string };
  physics?: {
    givens: Record<string, string>;
    quantity: string;
    units: string[];
  };
  programming?: {
    starterCode: string;
    publicTests: { input: string; expectedOutput: string }[];
    functionName?: string;
  };
}
export function subjectField(value: unknown): Subject {
  if (value !== "algebra" && value !== "physics" && value !== "programming")
    throw new Error("invalid_response");
  return value;
}
export function publicItem(value: unknown): PublicItem {
  const r = record(value);
  const item: PublicItem = {
    id: textField(r.id),
    itemId: textField(r.itemId),
    version: numberField(r.version),
    subject: subjectField(r.subject),
    titleAr: textField(r.titleAr),
    statementAr: textField(r.statementAr),
    unitCode: textField(r.unitCode),
    lessonCode: textField(r.lessonCode),
    skillCodes: strings(r.skillCodes),
    difficulty: numberField(r.difficulty),
    kind: textField(r.kind),
  };
  if (r.algebra)
    item.algebra = { equationRaw: textField(record(r.algebra).equationRaw) };
  if (r.physics) {
    const p = record(r.physics);
    item.physics = {
      givens: Object.fromEntries(
        Object.entries(record(p.givens)).map(([key, x]) => [key, textField(x)]),
      ),
      quantity: textField(p.quantity),
      units: strings(p.units),
    };
  }
  if (r.programming) {
    const p = record(r.programming);
    item.programming = {
      starterCode: textField(p.starterCode),
      publicTests: arrayField(p.publicTests, (x) => {
        const t = record(x);
        return {
          input: textField(t.input),
          expectedOutput: textField(t.expectedOutput),
        };
      }),
      ...(typeof p.functionName === "string"
        ? { functionName: p.functionName }
        : {}),
    };
  }
  return item;
}
export interface Catalog {
  subjects: {
    code: Subject;
    titleAr: string;
    units: {
      code: string;
      titleAr: string;
      lessons: { code: string; titleAr: string; items: PublicItem[] }[];
    }[];
  }[];
}
export function catalogData(value: unknown): Catalog {
  return {
    subjects: arrayField(record(value).subjects, (value) => {
      const s = record(value);
      return {
        code: subjectField(s.code),
        titleAr: textField(s.titleAr),
        units: arrayField(s.units, (value) => {
          const u = record(value);
          return {
            code: textField(u.code),
            titleAr: textField(u.titleAr),
            lessons: arrayField(u.lessons, (value) => {
              const l = record(value);
              return {
                code: textField(l.code),
                titleAr: textField(l.titleAr),
                items: arrayField(l.items, publicItem),
              };
            }),
          };
        }),
      };
    }),
  };
}
