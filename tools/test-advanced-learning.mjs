import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTestContainers,
  integrationReportPath,
  syntheticIntegrationEnvironment,
} from "./integration-test-options.mjs";

// Only resources created with this random invocation prefix can be migrated or
// removed. No existing developer or production database is selected.
const prefix = `khotwa-c-${randomBytes(6).toString("hex")}`;
const database = `${prefix}-db`,
  math = `${prefix}-math`;
const password = randomBytes(32).toString("hex");
const secrets = Object.fromEntries(
  [
    "GUEST_DIGEST_KEY",
    "BOOTSTRAP_SIGNING_KEY",
    "CSRF_SIGNING_KEY",
    "GUEST_ISSUE_KEY",
    "IDEMPOTENCY_DIGEST_KEY",
    "CURSOR_SIGNING_KEY",
    "INTERNAL_HEALTH_TOKEN",
    "MATH_INTERNAL_TOKEN",
    "ACCOUNT_OTP_DIGEST_KEY",
  ].map((name) => [name, randomBytes(32).toString("hex")]),
);
const redact = (value) =>
  [password, ...Object.values(secrets)].reduce(
    (text, secret) => text.replaceAll(secret, "[REDACTED]"),
    value ?? "",
  );
const checks = [],
  created = [];
const reportFile = integrationReportPath(
  process.argv.slice(2),
  "qa-reports/C-ADVANCED-LEARNING/C-INTEGRATION.json",
);
let failure = null;
function command(executable, args, env = process.env) {
  const started = Date.now();
  const result = spawnSync(executable, args, {
    env,
    encoding: "utf8",
    maxBuffer: 8000000,
    timeout: 180000,
    windowsHide: true,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
    seconds: (Date.now() - started) / 1000,
  };
}
function docker(args) {
  const result = command("docker", args);
  if (result.exitCode !== 0)
    throw new Error("Task-owned infrastructure failed: " + result.stderr);
  return result.stdout.trim();
}
try {
  const ready = command("docker", ["info", "--format", "{{.ServerVersion}}"]);
  checks.push({ command: "Docker readiness", ...ready });
  if (ready.exitCode !== 0) throw new Error("NOT_RUN: Docker unavailable");
  docker(["image", "inspect", "postgres:17.6-alpine3.22"]);
  docker(["image", "inspect", "khotwa-mvp-local-math:latest"]);
  docker([
    "run",
    "--pull=never",
    "-d",
    "--name",
    database,
    "--label",
    "khotwa.task=c-test-only",
    "--memory",
    "512m",
    "--pids-limit",
    "64",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,noexec,nosuid,size=128m",
    "-p",
    "127.0.0.1::5432",
    "-e",
    "POSTGRES_USER=c_test",
    "-e",
    "POSTGRES_DB=c_test",
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "postgres:17.6-alpine3.22",
  ]);
  created.push(database);
  docker([
    "run",
    "--pull=never",
    "-d",
    "--name",
    math,
    "--label",
    "khotwa.task=c-test-only",
    "--memory",
    "256m",
    "--cpus",
    "1",
    "--pids-limit",
    "64",
    "--read-only",
    "--tmpfs",
    "/tmp",
    "-p",
    "127.0.0.1::8001",
    "-e",
    `MATH_INTERNAL_TOKEN=${secrets.MATH_INTERNAL_TOKEN}`,
    "--mount",
    `type=bind,source=${path.resolve("services/math-engine/src")},target=/app/src,readonly`,
    "khotwa-mvp-local-math:latest",
  ]);
  created.push(math);
  const dbPort = docker(["port", database, "5432/tcp"]).split(":").at(-1),
    mathPort = docker(["port", math, "8001/tcp"]).split(":").at(-1);
  const env = {
    ...syntheticIntegrationEnvironment(),
    ...secrets,
    C_INTEGRATION: "true",
    C_TEST_CONTAINER: database,
    DATABASE_URL: `postgresql://c_test:${password}@127.0.0.1:${dbPort}/c_test`,
    MATH_ENGINE_BASE_URL: `http://127.0.0.1:${mathPort}`,
    PUBLIC_APP_ORIGIN: "https://advanced-c.test",
    KHOTWA_SYNTHETIC_DATA: "true",
    NODE_ENV: "test",
    ACCOUNTS_ENABLED: "true",
    ACCOUNT_MAIL_MODE: "disabled",
    BETA_ENABLED: "false",
    AI_ENABLED: "false",
    REAL_LEARNING_ENABLED: "false",
    PH04_API_ENABLED: "true",
    PH05_API_ENABLED: "true",
    PH06_API_ENABLED: "true",
    PH07_API_ENABLED: "true",
    PH08_API_ENABLED: "true",
    PH09_API_ENABLED: "true",
    PH04_BOOTSTRAP_TTL_SECONDS: "120",
    PH04_RATE_LIMIT_MAX: "10000",
    PH04_RATE_LIMIT_WINDOW_SECONDS: "60",
    PH04_MATH_TIMEOUT_MS: "5000",
    PH05_VERIFY_TIMEOUT_MS: "20000",
    PH08_MAX_REMEDIATION_ASSIGNMENTS: "2",
    PH08_MAX_TRANSFER_ASSIGNMENTS: "3",
    PH07_REQUEST_TIMEOUT_MS: "20000",
    PH07_AI_TIMEOUT_MS: "500",
    PH07_MAX_INPUT_BYTES: "8192",
    PH07_MAX_OUTPUT_TOKENS: "256",
    PH07_GUEST_CALLS: "100",
    PH07_GLOBAL_CALLS: "1000",
    PH07_GUEST_COST_UNITS: "1000",
    PH07_GLOBAL_COST_UNITS: "10000",
    PH07_MAX_PARALLEL: "2",
    MATH_LAB_ENABLED: "true",
    C_PROBLEM_LEARNING_ENABLED: "true",
    C_PROJECT_LEARNING_ENABLED: "true",
    C_UDL_CONTENT_ENABLED: "true",
    C_ADVANCED_STUDIO_ENABLED: "true",
    C_LEARNING_ANALYTICS_ENABLED: "true",
    PHYSICS_LAB_ENABLED: "false",
    CODING_LAB_NONEXEC_ENABLED: "false",
    CODING_LAB_RUNNER_BRIDGE_ENABLED: "false",
    PHET_INTEGRATION_ENABLED: "false",
    PROGRAMMING_RUNNER_ENABLED: "false",
    SOCRATIC_EXTERNAL_AI_ENABLED: "false",
  };
  const until = Date.now() + 30000;
  let available = false;
  while (Date.now() < until) {
    const pgReady = command("docker", [
      "exec",
      database,
      "pg_isready",
      "-U",
      "c_test",
      "-d",
      "c_test",
    ]);
    try {
      const response = await fetch(
        env.MATH_ENGINE_BASE_URL + "/internal/health",
        {
          headers: { authorization: "Bearer " + secrets.MATH_INTERNAL_TOKEN },
          signal: AbortSignal.timeout(1000),
        },
      );
      if (pgReady.exitCode === 0 && response.ok) {
        available = true;
        break;
      }
    } catch {
      /* Bounded readiness for task-owned services only. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!available)
    throw new Error("Task-owned test services did not become ready");
  for (const [name, args] of [
    [
      "isolated c_test migrate deploy",
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "deploy",
        "--config",
        "apps/api/prisma.config.ts",
      ],
    ],
    [
      "focused C synthetic real HTTP journey",
      ["--test", "apps/api/tests/advanced-learning-live.test.mjs"],
    ],
  ]) {
    const check = command(process.execPath, args, env);
    checks.push({ command: name, ...check });
    console.log(name + ": " + (check.exitCode === 0 ? "PASS" : "FAIL"));
    if (check.exitCode !== 0) {
      console.log(check.stdout, check.stderr);
      throw new Error(name + " failed");
    }
  }
  // Backup/restore is confined to this invocation's disposable cluster.
  const countSql =
    "SELECT (SELECT count(*) FROM intelligent_learning_records)::text||':'||(SELECT count(*) FROM learning_project_submissions)::text||':'||(SELECT count(*) FROM learning_analytics_events)::text";
  const beforeRestore = docker([
    "exec",
    database,
    "psql",
    "-U",
    "c_test",
    "-d",
    "c_test",
    "-Atc",
    countSql,
  ]);
  docker([
    "exec",
    database,
    "pg_dump",
    "-U",
    "c_test",
    "-d",
    "c_test",
    "-Fc",
    "-f",
    "/tmp/c-test-backup.dump",
  ]);
  docker(["exec", database, "createdb", "-U", "c_test", "c_restore"]);
  docker([
    "exec",
    database,
    "pg_restore",
    "-U",
    "c_test",
    "-d",
    "c_restore",
    "--exit-on-error",
    "/tmp/c-test-backup.dump",
  ]);
  const afterRestore = docker([
    "exec",
    database,
    "psql",
    "-U",
    "c_test",
    "-d",
    "c_restore",
    "-Atc",
    countSql,
  ]);
  if (beforeRestore !== afterRestore)
    throw new Error("C backup/restore count mismatch");
  checks.push({
    command: "task-owned c_test pg_dump/restore into new c_restore",
    exitCode: 0,
    counts: afterRestore,
  });
  console.log("isolated C backup/restore: PASS");
} catch (error) {
  failure = redact(error instanceof Error ? error.message : String(error));
  console.error(failure);
  process.exitCode = 1;
} finally {
  const cleanup = cleanupTestContainers(created, command);
  if (cleanup.some((result) => result.exitCode !== 0)) {
    failure ??= "Task-owned resource cleanup failed";
    process.exitCode = 1;
  }
  mkdirSync(path.dirname(reportFile), { recursive: true });
  writeFileSync(
    reportFile,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        node: process.version,
        platform: process.platform,
        scope:
          "Focused synthetic C HTTP acceptance on newly created disposable PostgreSQL and private real SymPy; no existing database, production, third party, paid AI, student-code execution or fabricated human approval.",
        checks,
        failure,
        cleanup,
      },
      null,
      2,
    ) + "\n",
  );
}
