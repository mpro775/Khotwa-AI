import { randomUUID } from "node:crypto";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { ErrorEnvelope, HealthEnvelope } from "@khotwa/contracts";
export interface RequestContext {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
  method?: string;
  url?: string;
}
export interface ResponseContext {
  setHeader(name: string, value: string): this;
  status(code: number): this;
  json(body: unknown): this;
}
export type ApiErrorCode = ErrorEnvelope["error"]["code"];
export class ApiFault extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly messageAr: string,
    readonly issues: ErrorEnvelope["error"]["issues"] = [],
    readonly currentRevision: number | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
  }
}
export function metadata(request: RequestContext): HealthEnvelope["meta"] {
  return {
    requestId: request.requestId ?? randomUUID(),
    serverTime: new Date().toISOString(),
    apiVersion: "1",
  };
}
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestContext>();
    const response = http.getResponse<ResponseContext>();
    const rawStatus =
      error instanceof ApiFault
        ? error.status
        : error instanceof HttpException
          ? error.getStatus()
          : error instanceof Error &&
              "status" in error &&
              [400, 413, 415].includes(Number(error.status))
            ? Number(error.status)
            : 500;
    const status = rawStatus === 413 || rawStatus === 415 ? 400 : rawStatus;
    const code: ErrorEnvelope["error"]["code"] =
      error instanceof ApiFault
        ? error.code
        : status === 400
          ? "invalid_input"
          : status === 401
            ? "unauthenticated"
            : status === 422
              ? "invalid_input"
              : status === 429
                ? "rate_limited"
                : status === 403
                  ? "forbidden"
                  : status === 404
                    ? "not_found"
                    : status === 503
                      ? "internal_error"
                      : "internal_error";
    const body: ErrorEnvelope = {
      error: {
        code,
        messageAr:
          error instanceof ApiFault
            ? error.messageAr
            : status === 400
              ? "تعذر قراءة الطلب. راجع صيغة JSON وحجمه."
              : status === 401
                ? "جلسة الضيف غير صالحة."
                : status === 403
                  ? "الوصول غير مسموح."
                  : status === 404
                    ? "المسار غير متاح في هذه النسخة."
                    : "تعذرت الخدمة مؤقتًا.",
        issues: error instanceof ApiFault ? error.issues : [],
        currentRevision:
          error instanceof ApiFault ? error.currentRevision : null,
        retryable:
          status >= 500 || status === 429 || code === "request_in_progress",
        retryAfterSeconds:
          error instanceof ApiFault ? error.retryAfterSeconds : null,
      },
      meta: metadata(request),
    };
    if (body.error.retryAfterSeconds !== null)
      response.setHeader("Retry-After", String(body.error.retryAfterSeconds));
    response.status(status).json(body);
  }
}
