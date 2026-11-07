import pg from "pg";
import { randomUUID } from "node:crypto";

// Separate maintenance connection. Never imported by NestJS or exposed as HTTP.
const connectionString = process.env.RETENTION_DATABASE_URL;
if (!connectionString) throw Error("RETENTION_DATABASE_URL is required");
const apply = process.argv.includes("--apply");
const authCleanup = process.argv.includes("--auth-cleanup");
const interval = Number(
  process.argv
    .find((a) => a.startsWith("--interval-seconds="))
    ?.split("=")[1] ?? 0,
);
if (!Number.isSafeInteger(interval) || (interval !== 0 && interval < 60))
  throw Error("Interval must be zero or at least 60 seconds");
const pool = new pg.Pool({ connectionString, max: 1 });
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
  });
try {
  do {
    const jobId = randomUUID();
    try {
      const result = await pool.query(
        "SELECT public.purge_expired_guests($1,100) AS result",
        [!apply],
      );
      console.log(JSON.stringify({ jobId, ...result.rows[0].result }));
      if (authCleanup) {
        const auth = await pool.query(
          "SELECT public.cleanup_expired_account_auth($1) AS result",
          [!apply],
        );
        console.log(
          JSON.stringify({
            jobId,
            operation: "expired_auth_cleanup",
            ...auth.rows[0].result,
          }),
        );
      }
    } catch {
      // Database errors may contain a URL, text, or SQL detail. Log none of it.
      console.error(
        JSON.stringify({
          jobId,
          error: "RETENTION_JOB_FAILED",
          retryable: true,
        }),
      );
      if (!interval) process.exitCode = 1;
    }
    if (!interval) break;
    const until = Date.now() + interval * 1000;
    while (!stopping && Date.now() < until)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000, until - Date.now())),
      );
  } while (!stopping);
} finally {
  await pool.end();
}
