import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { HealthController, HealthGuard, HealthService } from "./health";
import { BusinessModule } from "./business";
import { ApiErrorFilter, RequestContext, ResponseContext } from "./http";

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
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.useBodyParser("json", { limit: "4kb", strict: true });
  app.useGlobalFilters(new ApiErrorFilter());
  return app;
}
