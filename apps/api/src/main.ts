import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { HealthController, HealthGuard, HealthService } from "./health";
import { ApiErrorFilter, RequestContext, ResponseContext } from "./http";
@Module({
  controllers: [HealthController],
  providers: [HealthGuard, HealthService],
})
class AppModule {}
async function bootstrap(): Promise<void> {
  if ((process.env.INTERNAL_HEALTH_TOKEN ?? "").length < 32)
    throw new Error(
      "INTERNAL_HEALTH_TOKEN must be configured with at least 32 characters",
    );
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use((req: RequestContext, res: ResponseContext, next: () => void) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.PORT ?? 3000),
    process.env.HOST ?? "127.0.0.1",
  );
  console.log(
    "Khotwa API foundation listening; health access requires an internal token.",
  );
}
bootstrap().catch(() => {
  console.error("API startup failed; check local configuration.");
  process.exitCode = 1;
});
