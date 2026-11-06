import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
const real = process.env.PH08_FINAL_LIVE === "true";
if (real && !process.env.GEMINI_API_KEY)
  throw Error("GEMINI_SECRET_RUNTIME_REQUIRED");
const prefix = "khotwa-ph08-" + randomBytes(6).toString("hex"),
  db = prefix + "-db",
  math = prefix + "-math",
  tests = prefix + "-gemini";
const dir = path.resolve(".local"),
  evidence = path.resolve("qa-reports"),
  created = [],
  report = {
    at: new Date().toISOString(),
    realProvider: real,
    checks: [],
    error: null,
  };
mkdirSync(dir, { recursive: true });
mkdirSync(evidence, { recursive: true });
const previousLedger = path.join(dir, "ph08-gemini-first-round.json");
const previousBytes = readFileSync(previousLedger);
const previous = JSON.parse(previousBytes.toString("utf8"));
if (previous.calls.length !== 10)
  throw Error("PREVIOUS_ROUND_EVIDENCE_REQUIRED");
report.previousLedgerSha256 = createHash("sha256")
  .update(previousBytes)
  .digest("hex");
if (real) {
  const offline = JSON.parse(
    readFileSync(
      path.join(evidence, "ph08-reviewed-fallback-tests.json"),
      "utf8",
    ),
  );
  if (
    offline.error ||
    offline.checks.length < 15 ||
    offline.checks.some((c) => c.status !== "PASS")
  )
    throw Error("LOCAL_FALLBACK_CHECKS_REQUIRED_BEFORE_LIVE");
  const local = JSON.parse(
    readFileSync(path.join(evidence, "ph08-final-checks.json"), "utf8"),
  );
  if (local.checks.some((c) => c.exitCode !== 0))
    throw Error("LOCAL_CODE_CHECKS_REQUIRED_BEFORE_LIVE");
  if (previous.calls.filter((t) => Date.now() - t < 60000).length + 4 > 10)
    throw Error("CROSS_ROUND_ROLLING_LIMIT");
}
if (
  real &&
  existsSync(path.join(dir, "ph08-generative-owner-20261106-live4.json"))
) {
  const prior = JSON.parse(
    readFileSync(
      path.join(dir, "ph08-generative-owner-20261106-live4.json"),
      "utf8",
    ),
  );
  if (prior.calls.length > 0)
    throw Error("LIVE4_ALREADY_STARTED_NO_AUTOMATIC_RESUME");
}
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
  ].map((k) => [k, randomBytes(32).toString("hex")]),
);
const password = randomBytes(32).toString("hex");
const environment = {
  ...process.env,
  GEMINI_API_KEY: real
    ? process.env.GEMINI_API_KEY
    : "synthetic-controlled-only",
};
const redact = (s) =>
  [password, ...Object.values(secrets), environment.GEMINI_API_KEY]
    .filter(Boolean)
    .reduce((v, k) => v.replaceAll(k, "[REDACTED]"), s);
function run(args, { record = true, allowFailure = false } = {}) {
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 4000000,
    env: environment,
  });
  const result = {
    command: ["docker", ...args],
    exitCode: r.status,
    stdout: redact(r.stdout ?? ""),
    stderr: redact(r.stderr ?? ""),
  };
  if (record) report.checks.push(result);
  if (r.status !== 0 && !allowFailure)
    throw Error(
      "Docker operation failed: " +
        args.slice(0, 3).join(" ") +
        " " +
        result.stderr.slice(-1000),
    );
  return result;
}
const envFiles = [];
function envFile(suffix, values) {
  const file = path.join(dir, prefix + suffix + ".env");
  writeFileSync(
    file,
    Object.entries(values)
      .map(([k, v]) => k + "=" + v)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  envFiles.push(file);
  return file;
}
const ledger = real
  ? "ph08-generative-owner-20261106-live4.json"
  : prefix + "-controlled-quota.json";
const expires = real
  ? (process.env.GEMINI_QUOTA_VALID_UNTIL ??
    (existsSync(path.join(dir, ledger))
      ? new Date(
          JSON.parse(readFileSync(path.join(dir, ledger), "utf8")).validUntil,
        ).toISOString()
      : undefined) ??
    new Date(Date.now() + 3600000).toISOString())
  : new Date(Date.now() + 3600000).toISOString();
const appEnv = envFile("", {
  ...secrets,
  DATABASE_URL: `postgresql://ph08:${password}@${db}:5432/ph08_test`,
  PUBLIC_APP_ORIGIN: "https://localhost:8443",
  PH04_API_ENABLED: "true",
  PH05_API_ENABLED: "true",
  PH06_API_ENABLED: "true",
  PH07_API_ENABLED: "true",
  PH08_API_ENABLED: "true",
  PH09_API_ENABLED: "false",
  AI_ENABLED: "true",
  KHOTWA_SYNTHETIC_DATA: "true",
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
  PH05_VERIFY_TIMEOUT_MS: "20000",
  PH04_BOOTSTRAP_TTL_SECONDS: "120",
  PH04_RATE_LIMIT_MAX: "10000",
  PH04_RATE_LIMIT_WINDOW_SECONDS: "60",
  PH04_MATH_TIMEOUT_MS: "1500",
  MATH_ENGINE_BASE_URL: `http://${math}:8001`,
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  GEMINI_THINKING_LEVEL: process.env.GEMINI_THINKING_LEVEL ?? "minimal",
  PH08_GEMINI_TIMEOUT_MS: real ? "15000" : "1000",
  PH08_GEMINI_OFFLINE: String(!real),
  PH08_GEMINI_GENERATIVE_ENABLED: "true",
  PH08_FINAL_OFFLINE_INTEGRATION: String(!real),
  PH08_FINAL_LIVE_INTEGRATION: String(real),
  PH08_REVIEWED_CONTENT_ENABLED: "true",
  PH08_REVIEWED_CONTENT_PATH: "/app/content/ph08-reviewed-2026-11-06.json",
  GEMINI_LIVE_AUTHORIZATION_ID: "PH08-OWNER-2026-11-06-LIVE4",
  GEMINI_DAILY_QUOTA_POLICY: "owner_authorized_unknown_rpd_live4",
  GEMINI_ROUND_CALL_LIMIT: real ? "4" : "15",
  GEMINI_DAILY_REMAINING: real ? "unknown" : "15",
  GEMINI_QUOTA_VALID_UNTIL: expires,
  GEMINI_QUOTA_LEDGER_PATH: "/quota/" + ledger,
  PH08_GEMINI_INTEGRATION: "true",
  PH08_GEMINI_LIVE: String(real),
  PH08_GEMINI_RESUME_TRANSFER_ONLY:
    process.env.PH08_GEMINI_RESUME_TRANSFER_ONLY ?? "false",
});
const dbEnv = envFile("-db", {
    POSTGRES_USER: "ph08",
    POSTGRES_PASSWORD: password,
    POSTGRES_DB: "ph08_test",
  }),
  mathEnv = envFile("-math", {
    MATH_INTERNAL_TOKEN: secrets.MATH_INTERNAL_TOKEN,
  });
try {
  // Exact lockfile match before using cached dependencies. Compile current
  // mounted sources, never test a stale dist or modify previous phase images.
  const lockHash = createHash("sha256")
    .update(readFileSync("package-lock.json"))
    .digest("hex");
  const cached = run([
    "run",
    "--rm",
    "khotwa-ph09-test",
    "sha256sum",
    "/app/package-lock.json",
  ]);
  if (cached.stdout.split(" ")[0] !== lockHash)
    throw Error("Cached dependency lockfile mismatch");
  run([
    "network",
    "create",
    ...(real ? [] : ["--internal"]),
    "--label",
    "khotwa.task=ph08-gemini",
    prefix,
  ]);
  created.push(["network", prefix]);
  run([
    "run",
    "-d",
    "--name",
    db,
    "--label",
    "khotwa.task=ph08-gemini",
    "--network",
    prefix,
    "--env-file",
    dbEnv,
    "--tmpfs",
    "/var/lib/postgresql/data",
    "postgres:17.6-alpine3.22",
  ]);
  created.push(["container", db]);
  run([
    "run",
    "-d",
    "--name",
    math,
    "--label",
    "khotwa.task=ph08-gemini",
    "--network",
    prefix,
    "--env-file",
    mathEnv,
    "--read-only",
    "--tmpfs",
    "/tmp",
    "--memory",
    "256m",
    "--cpus",
    "1",
    "--pids-limit",
    "64",
    "khotwa-ph08-math",
  ]);
  created.push(["container", math]);
  let ready = false;
  for (let n = 0; n < 40; n++) {
    if (
      run(["exec", db, "pg_isready", "-U", "ph08", "-d", "ph08_test"], {
        record: false,
        allowFailure: true,
      }).exitCode === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw Error("Private PostgreSQL startup deadline exceeded");
  created.push(["container", tests]);
  const result = run(
    [
      "run",
      "--name",
      tests,
      "--label",
      "khotwa.task=ph08-gemini",
      "--network",
      prefix,
      "--env-file",
      appEnv,
      "-e",
      "GEMINI_API_KEY",
      "--memory",
      "768m",
      "--pids-limit",
      "128",
      ...[
        "apps/api/src",
        "apps/api/tests",
        "apps/api/prisma",
        "qa",
        "content",
      ].flatMap((source) => [
        "--mount",
        `type=bind,source=${path.resolve(source)},target=/app/${source},readonly`,
      ]),
      "--mount",
      `type=bind,source=${dir},target=/quota`,
      "--mount",
      `type=bind,source=${evidence},target=/evidence`,
      "khotwa-ph09-test",
      "node",
      "qa/ph08-final-container.mjs",
    ],
    { allowFailure: true },
  );
  console.log(result.stdout);
  console.error(result.stderr);
  if (result.exitCode !== 0)
    throw Error("PH08 Gemini integration checks failed");
} catch (error) {
  report.error = redact(error.message);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  for (const [kind, name] of created.reverse()) {
    const check = run(
      kind === "network"
        ? [
            "network",
            "inspect",
            name,
            "--format",
            '{{ index .Labels "khotwa.task" }}',
          ]
        : [
            "inspect",
            name,
            "--format",
            '{{ index .Config.Labels "khotwa.task" }}',
          ],
      { record: false, allowFailure: true },
    );
    if (check.exitCode === 0 && check.stdout.trim() === "ph08-gemini")
      run(
        kind === "network" ? ["network", "rm", name] : ["rm", "-f", "-v", name],
        { allowFailure: true },
      );
  }
  for (const file of envFiles) unlinkSync(file);
  report.previousLedgerUnchanged =
    readFileSync(previousLedger).equals(previousBytes);
  if (!report.previousLedgerUnchanged) {
    report.error = "PREVIOUS_LEDGER_CHANGED";
    process.exitCode = 1;
  }
  writeFileSync(
    path.join(
      evidence,
      real
        ? "ph08-generative-live-4-run.json"
        : "ph08-final-offline-container.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
}
