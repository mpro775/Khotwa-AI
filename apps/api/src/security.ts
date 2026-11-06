import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiFault, RequestContext } from "./http";

export interface SecuritySettings {
  origin: string;
  digestKey: string;
  bootstrapKey: string;
  csrfKey: string;
  issueKey: string;
  idempotencyKey: string;
  cursorKey: string;
  bootstrapSeconds: number;
}
export const hmac = (key: string, value: string): string =>
  createHmac("sha256", key).update(value).digest("hex");
export function equal(a: string, b: string): boolean {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function cookieValue(
  request: RequestContext,
  name: string,
): string | null {
  const cookie = request.headers.cookie;
  if (typeof cookie !== "string") return null;
  const values = cookie
    .split(";")
    .map((p) => p.trim().split("="))
    .filter((p) => p[0] === name);
  if (values.length !== 1 || values[0]?.length !== 2) return null;
  return values[0]?.[1] ?? null;
}
export function secureCookie(
  name: string,
  value: string,
  seconds: number,
): string {
  return (
    name +
    "=" +
    value +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
    Math.max(0, Math.floor(seconds))
  );
}
export class Security {
  constructor(readonly settings: SecuritySettings) {
    const origin = new URL(settings.origin);
    if (
      origin.protocol !== "https:" ||
      origin.origin !== settings.origin ||
      origin.username ||
      origin.password
    )
      throw new Error("PUBLIC_APP_ORIGIN must be an exact HTTPS origin");
    const keys = [
      settings.digestKey,
      settings.bootstrapKey,
      settings.csrfKey,
      settings.issueKey,
      settings.idempotencyKey,
      settings.cursorKey,
    ];
    if (keys.some((k) => k.length < 43) || new Set(keys).size !== keys.length)
      throw new Error("Distinct strong security keys are required");
    if (
      !Number.isSafeInteger(settings.bootstrapSeconds) ||
      settings.bootstrapSeconds <= 0
    )
      throw new Error("Explicit bootstrap TTL required");
  }
  checkOrigin(request: RequestContext): void {
    const site = request.headers["sec-fetch-site"];
    if (
      request.headers.origin !== this.settings.origin ||
      (site !== undefined && site !== "same-origin" && site !== "none")
    )
      throw new ApiFault(403, "csrf_invalid", "تعذر التحقق من أصل الطلب.");
  }
  bootstrap(now = Date.now()): { cookie: string; csrf: string } {
    const body =
      "v1." +
      Math.floor(now / 1000 + this.settings.bootstrapSeconds) +
      "." +
      randomBytes(32).toString("base64url");
    const cookie = body + "." + hmac(this.settings.bootstrapKey, body);
    return { cookie, csrf: this.bootstrapCsrf(cookie) };
  }
  bootstrapCsrf(cookie: string): string {
    return hmac(this.settings.csrfKey, "bootstrap:" + cookie);
  }
  bootstrapNonce(request: RequestContext, now = Date.now()): string {
    this.checkOrigin(request);
    const cookie = cookieValue(request, "kh_bootstrap") ?? "";
    const parts = cookie.split(".");
    const [version, expiry, nonce, signature] = parts;
    const body = parts.slice(0, 3).join(".");
    if (
      parts.length !== 4 ||
      version !== "v1" ||
      !expiry ||
      !/^\d{1,12}$/.test(expiry) ||
      !nonce ||
      !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
      !signature ||
      typeof request.headers["x-csrf-token"] !== "string" ||
      !equal(signature, hmac(this.settings.bootstrapKey, body)) ||
      Number(expiry) <= now / 1000 ||
      Number(expiry) > now / 1000 + this.settings.bootstrapSeconds + 1 ||
      !equal(
        request.headers["x-csrf-token"] as string,
        this.bootstrapCsrf(cookie),
      )
    )
      throw new ApiFault(
        403,
        "csrf_invalid",
        "رمز التهيئة غير صالح أو انتهت صلاحيته.",
      );
    return nonce;
  }
  issueGuest(nonce: string): string {
    // PRF over a fresh 256-bit bootstrap nonce: replay yields the same opaque token.
    return createHmac("sha256", this.settings.issueKey)
      .update("guest:" + nonce)
      .digest("base64url");
  }
  digest(token: string): string {
    return hmac(this.settings.digestKey, "guest:" + token);
  }
  guestCsrf(token: string): string {
    return hmac(this.settings.csrfKey, "guest:" + token);
  }
  checkGuestCsrf(request: RequestContext, token: string): void {
    this.checkOrigin(request);
    const provided = request.headers["x-csrf-token"];
    if (typeof provided !== "string" || !equal(provided, this.guestCsrf(token)))
      throw new ApiFault(403, "csrf_invalid", "رمز حماية الجلسة غير صالح.");
  }
  keyDigest(key: string): string {
    return hmac(this.settings.idempotencyKey, "operation-key:" + key);
  }
  fingerprint(value: unknown): string {
    const canonical = (v: unknown): string => {
      if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
      if (v && typeof v === "object")
        return (
          "{" +
          Object.entries(v)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, x]) => JSON.stringify(k) + ":" + canonical(x))
            .join(",") +
          "}"
        );
      return JSON.stringify(v) ?? "null";
    };
    return hmac(this.settings.idempotencyKey, "request:" + canonical(value));
  }
  cursor(scope: string, id: string): string {
    const scopeDigest = hmac(this.settings.cursorKey, "scope:" + scope).slice(
      0,
      32,
    );
    const body = Buffer.from(
      JSON.stringify({ scope: scopeDigest, id }),
    ).toString("base64url");
    return body + "." + hmac(this.settings.cursorKey, body);
  }
  readCursor(value: unknown, scope: string): string | null {
    if (value === undefined) return null;
    if (typeof value !== "string" || value.length > 256)
      throw new ApiFault(400, "invalid_input", "مؤشر الصفحة غير صالح.");
    const [body, signature, extra] = value.split(".");
    if (
      !body ||
      !signature ||
      extra !== undefined ||
      !equal(signature, hmac(this.settings.cursorKey, body))
    )
      throw new ApiFault(400, "invalid_input", "مؤشر الصفحة غير صالح.");
    try {
      const data: unknown = JSON.parse(
        Buffer.from(body, "base64url").toString("utf8"),
      );
      if (
        !data ||
        typeof data !== "object" ||
        !("scope" in data) ||
        !("id" in data) ||
        data.scope !==
          hmac(this.settings.cursorKey, "scope:" + scope).slice(0, 32) ||
        typeof data.id !== "string"
      )
        throw new Error();
      return data.id;
    } catch {
      throw new ApiFault(
        400,
        "invalid_input",
        "مؤشر الصفحة لا يطابق هذا الطلب.",
      );
    }
  }
}
