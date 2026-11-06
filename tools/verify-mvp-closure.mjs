import { spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  copyFileSync,
} from "node:fs";
import path from "node:path";
const suffix = randomBytes(6).toString("hex"),
  prefix = `khotwa-ph10-${suffix}`;
const runId =
  process.env.PH10_RUN_ID ??
  `closure-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const dir = path.resolve("qa-reports/mvp-closure", runId);
mkdirSync(dir, { recursive: true });
mkdirSync(".local", { recursive: true });
const commit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).stdout.trim();
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
  ].map((k) => [k, randomBytes(32).toString("hex")]),
);
const privateFiles = [],
  created = [],
  checks = [];
const redact = (s) =>
  [password, ...Object.values(secrets)].reduce(
    (t, k) => t.replaceAll(k, "[REDACTED]"),
    s,
  );
function run(args, required = true) {
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 16000000,
  });
  checks.push({
    command: ["docker", ...args],
    exitCode: r.status,
    stdout: redact(r.stdout ?? ""),
    stderr: redact(r.stderr ?? ""),
  });
  if (required && r.status !== 0)
    throw Error("Docker operation failed; see orchestration.json");
  return r;
}
function envFile(tag, values) {
  const file = path.resolve(".local", prefix + tag + ".env");
  writeFileSync(
    file,
    Object.entries(values)
      .map(([k, v]) => k + "=" + v)
      .join("\n") + "\n",
  );
  privateFiles.push(file);
  return file;
}
const db = prefix + "-db",
  math = prefix + "-math";
const appEnv = envFile("", {
  ...secrets,
  PH10_SUFFIX: suffix,
  PH10_RUN_ID: runId,
  PH10_COMMIT: commit,
  PH10_RETENTION_ONLY: String(process.argv.includes("--retention-only")),
  DATABASE_URL: `postgresql://ph10:${password}@${db}:5432/postgres`,
  PUBLIC_APP_ORIGIN: "https://localhost:8443",
  PH04_API_ENABLED: "true",
  AI_ENABLED: "false",
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
  PH04_MATH_TIMEOUT_MS: "15000",
  MATH_ENGINE_BASE_URL: `http://${math}:8001`,
});
try {
  const lock = createHash("sha256")
    .update(readFileSync("package-lock.json"))
    .digest("hex");
  if (
    run([
      "run",
      "--rm",
      "khotwa-ph09-test",
      "sha256sum",
      "/app/package-lock.json",
    ]).stdout.split(" ")[0] !== lock
  )
    throw Error("Dependency lock mismatch");
  run([
    "network",
    "create",
    "--internal",
    "--label",
    "khotwa.task=mvp-closure",
    prefix,
  ]);
  created.push(["network", prefix]);
  run([
    "run",
    "-d",
    "--name",
    db,
    "--network",
    prefix,
    ...[4, 5, 6, 7, 8, 9].flatMap((n) => [
      "--network-alias",
      `khotwa-ph0${n}-${suffix}-db`,
    ]),
    "--label",
    "khotwa.task=mvp-closure",
    "--env-file",
    envFile("-db", { POSTGRES_USER: "ph10", POSTGRES_PASSWORD: password }),
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
    "--network",
    prefix,
    "--network-alias",
    `khotwa-ph09-${suffix}-math`,
    "--label",
    "khotwa.task=mvp-closure",
    "--env-file",
    envFile("-math", { MATH_INTERNAL_TOKEN: secrets.MATH_INTERNAL_TOKEN }),
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
    if (run(["exec", db, "pg_isready", "-U", "ph10"], false).status === 0) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw Error("PostgreSQL startup timeout");
  copyFileSync(
    "qa-reports/ph08-content-review-pack.json",
    path.join(dir, "ph08-content-review-pack.json"),
  );
  const tests = prefix + "-tests";
  created.push(["container", tests]);
  const result = run(
    [
      "run",
      "--name",
      tests,
      "--network",
      prefix,
      "--label",
      "khotwa.task=mvp-closure",
      "--env-file",
      appEnv,
      "--memory",
      "1024m",
      "--pids-limit",
      "160",
      ...[
        "apps/api/src",
        "apps/api/tests",
        "apps/api/prisma",
        "qa",
        "content",
        "docs",
      ].flatMap((source) => [
        "--mount",
        `type=bind,source=${path.resolve(source)},target=/app/${source},readonly`,
      ]),
      "--mount",
      `type=bind,source=${dir},target=/evidence`,
      "--mount",
      `type=bind,source=${dir},target=/app/qa-reports`,
      "khotwa-ph09-test",
      "node",
      "qa/ph10-container.mjs",
    ],
    false,
  );
  console.log(redact(result.stdout ?? ""));
  process.exitCode = result.status ?? 1;
} catch (e) {
  checks.push({ error: e.message });
  process.exitCode = 1;
} finally {
  for (const [kind, name] of created.reverse()) {
    const inspect = run(
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
      false,
    );
    if (inspect.status === 0 && inspect.stdout.trim() === "mvp-closure")
      run(
        kind === "network" ? ["network", "rm", name] : ["rm", "-f", "-v", name],
        false,
      );
  }
  for (const file of privateFiles) unlinkSync(file);
  writeFileSync(
    path.join(dir, "orchestration.json"),
    JSON.stringify(
      { runId, commit, node: process.version, actualGeminiCalls: 0, checks },
      null,
      2,
    ) + "\n",
  );
  console.log("Evidence: " + dir);
}
