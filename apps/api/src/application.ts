import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { HealthController, HealthGuard, HealthService } from "./health";
import { BusinessModule } from "./business";
import { ApiErrorFilter, RequestContext, ResponseContext } from "./http";
import { betaTelemetry } from "./beta-operations";

@Module({
  controllers: [HealthController],
  providers: [HealthGuard, HealthService],
})
class FoundationModule {}
export async function createApplication(
  business: boolean,
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    {
      module: class ApplicationModule {},
      imports: [FoundationModule, ...(business ? [BusinessModule] : [])],
    },
    { logger: false, bodyParser: false, abortOnError: false },
  );
  app.disable("x-powered-by");
  app.use((req: RequestContext, res: ResponseContext, next: () => void) => {
    const started = performance.now();
    const observed = res as ResponseContext & {
      statusCode: number;
      once(event: string, listener: () => void): void;
    };
    observed.once("finish", () =>
      betaTelemetry.recordApi(observed.statusCode, performance.now() - started),
    );
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.useBodyParser("json", {
    limit: "512kb",
    strict: true,
    verify: (request: { url?: string }, _response: unknown, buffer: Buffer) => {
      const path = request.url?.split("?")[0] ?? "";
      const product =
        /^\/api\/v1\/(studio|programming|physics|catalog|auth|me|beta)(\/|$)/.test(
          path,
        );
      const limit =
        path === "/api/v1/studio/import" ||
        path === "/api/v1/studio/import/preview"
          ? 524288
          : product
            ? 65536
            : 4096;
      if (buffer.length > limit)
        throw Object.assign(new Error("request_too_large"), { status: 400 });
    },
  });
  app.useGlobalFilters(new ApiErrorFilter());
  return app;
}
