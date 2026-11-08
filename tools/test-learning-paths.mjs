import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTestContainers,
  integrationReportPath,
  syntheticIntegrationEnvironment,
} from "./integration-test-options.mjs";

// A single focused HTTP journey. Existing developer/production resources are
// never selected, migrated or stopped; all resource names are created here.
const suffix = randomBytes(6).toString("hex");
const prefix = `khotwa-v22-${suffix}`;
const database = `${prefix}-db`;
const math = `${prefix}-math`;
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
const checks = [];
const created = [];
const serve = process.argv.includes("--serve");
const intelligent = process.argv.includes("--intelligent-learning");
const reportFile = integrationReportPath(
  process.argv.slice(2),
  intelligent
    ? "qa-reports/A-INTEGRATION.json"
    : "qa-reports/V2.2-INTEGRATION.json",
);
function command(executable, args, env = process.env, timeout = 180000) {
  const started = Date.now();
  const result = spawnSync(executable, args, {
    env,
    encoding: "utf8",
    maxBuffer: 8000000,
    timeout,
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
    throw new Error("Scoped test infrastructure failed: " + result.stderr);
  return result.stdout.trim();
}
let failure = null;
try {
  const dockerReady = command("docker", [
    "info",
    "--format",
    "{{.ServerVersion}}",
  ]);
  checks.push({ command: "Docker readiness", ...dockerReady });
  if (dockerReady.exitCode !== 0)
    throw new Error("NOT_RUN: Docker unavailable");
  docker(["image", "inspect", "postgres:17.6-alpine3.22"]);
  docker(["image", "inspect", "khotwa-mvp-local-math:latest"]);
  docker([
    "run",
    "--pull=never",
    "-d",
    "--name",
    database,
    "--label",
    "khotwa.task=v22-test-only",
    "--memory",
    "512m",
    "--pids-limit",
    "64",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,noexec,nosuid,size=128m",
    "-p",
    "127.0.0.1::5432",
    "-e",
    "POSTGRES_USER=v22_test",
    "-e",
    "POSTGRES_DB=v22_test",
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
    "khotwa.task=v22-test-only",
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
  const dbPort = docker(["port", database, "5432/tcp"]).split(":").at(-1);
  const mathPort = docker(["port", math, "8001/tcp"]).split(":").at(-1);
  const env = {
    ...syntheticIntegrationEnvironment(),
    ...secrets,
    V22_INTEGRATION: "true",
    V22_TEST_CONTAINER: database,
    DATABASE_URL: `postgresql://v22_test:${password}@127.0.0.1:${dbPort}/v22_test`,
    MATH_ENGINE_BASE_URL: `http://127.0.0.1:${mathPort}`,
    PUBLIC_APP_ORIGIN: serve ? "https://127.0.0.1:8461" : "https://v22.test",
    V22_SERVE: String(serve),
    V22_SUBJECTS_ONLY: String(process.argv.includes("--subjects-only")),
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
    A_INTEGRATION: String(intelligent),
    A_TEST_HTTP_PORT: intelligent ? "18463" : "0",
    PEDAGOGY_ENGINE_ENABLED: String(intelligent),
    MASTERY_PROJECTION_ENABLED: String(intelligent),
    DEEP_DIAGNOSIS_ENABLED: String(intelligent),
    KNOWLEDGE_GRAPH_A_ENABLED: String(intelligent),
    SPACED_REVIEW_ENABLED: String(intelligent),
    FADING_SCAFFOLD_ENABLED: String(intelligent),
    SOCRATIC_TUTOR_ENABLED: String(intelligent),
    SOCRATIC_EXTERNAL_AI_ENABLED: "false",
    METACOGNITION_ENABLED: String(intelligent),
    PROGRAMMING_RUNNER_ENABLED: "false",
  };
  const until = Date.now() + 30000;
  let ready = false;
  while (Date.now() < until) {
    const pgReady = command("docker", [
      "exec",
      database,
      "pg_isready",
      "-U",
      "v22_test",
      "-d",
      "v22_test",
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
        ready = true;
        break;
      }
    } catch {
      // Startup readiness is bounded. No retry of learner submissions occurs.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Isolated test services did not become ready");
  for (const [name, args] of [
    [
      "isolated Prisma migrate deploy",
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "deploy",
        "--config",
        "apps/api/prisma.config.ts",
      ],
    ],
    [
      "focused V2.2 NestJS/PostgreSQL/SymPy HTTP journey",
      ["--test", "apps/api/tests/learning-paths-live.test.mjs"],
    ],
  ]) {
    const result = command(
      process.execPath,
      args,
      env,
      serve ? 960000 : 180000,
    );
    checks.push({ command: name, ...result });
    console.log(name + ": " + (result.exitCode === 0 ? "PASS" : "FAIL"));
    if (result.exitCode !== 0) {
      console.log(result.stdout, result.stderr);
      throw new Error(name + " failed");
    }
  }
} catch (error) {
  failure = redact(error instanceof Error ? error.message : String(error));
  console.error(failure);
  process.exitCode = 1;
} finally {
  // Remove only the unique containers successfully created in this invocation.
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
          "One focused synthetic HTTP journey; ephemeral test DB and real private math; no paid AI, runner, production or load tests. Test workflow actors do not constitute human content approval.",
        checks,
        failure,
        resourcesCreated: created,
        cleanup,
        resourcesCleanedUp: cleanup
          .filter((result) => result.exitCode === 0)
          .map((result) => result.name),
      },
      null,
      2,
    ) + "\n",
  );
}
