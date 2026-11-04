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
}
export interface ResponseContext {
  setHeader(name: string, value: string): this;
  status(code: number): this;
  json(body: unknown): this;
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
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const code: ErrorEnvelope["error"]["code"] =
      status === 403
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
          status === 403
            ? "الوصول غير مسموح."
            : status === 404
              ? "المسار غير متاح في هذه النسخة."
              : "تعذرت الخدمة مؤقتًا.",
        issues: [],
        currentRevision: null,
        retryable: status >= 500,
        retryAfterSeconds: null,
      },
      meta: metadata(request),
    };
    response.status(status).json(body);
  }
}
