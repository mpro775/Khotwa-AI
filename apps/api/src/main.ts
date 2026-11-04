import "reflect-metadata";
import { createApplication } from "./application";
async function bootstrap(): Promise<void> {
  if ((process.env.INTERNAL_HEALTH_TOKEN ?? "").length < 32)
    throw new Error(
      "INTERNAL_HEALTH_TOKEN must be configured with at least 32 characters",
    );
  const app = await createApplication(process.env.PH04_API_ENABLED === "true");
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
