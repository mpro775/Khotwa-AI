import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
const suffix = randomBytes(6).toString("hex"),
  prefix = "khotwa-ph08-" + suffix,
  network = prefix,
  db = prefix + "-db",
  math = prefix + "-math",
  tests = prefix + "-tests";
const password = randomBytes(32).toString("hex"),
  secrets = Object.fromEntries(
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
mkdirSync(".local", { recursive: true });
mkdirSync("qa-reports", { recursive: true });
const envFile = path.resolve(".local", prefix + ".env");
const dbEnv = path.resolve(".local", prefix + "-db.env"),
  mathEnv = path.resolve(".local", prefix + "-math.env");
writeFileSync(
  dbEnv,
  `POSTGRES_USER=ph08\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=ph08_test\n`,
);
writeFileSync(mathEnv, `MATH_INTERNAL_TOKEN=${secrets.MATH_INTERNAL_TOKEN}\n`);
writeFileSync(
  envFile,
  Object.entries({
    DATABASE_URL: `postgresql://ph08:${password}@${db}:5432/ph08_test`,
    ...secrets,
    PUBLIC_APP_ORIGIN: "https://localhost:8443",
    PH04_API_ENABLED: "true",
    PH05_API_ENABLED: "true",
    PH06_API_ENABLED: "true",
    PH07_API_ENABLED: "true",
    PH08_API_ENABLED: "true",
    PH08_MAX_REMEDIATION_ASSIGNMENTS: "2",
    PH08_MAX_TRANSFER_ASSIGNMENTS: "3",
    AI_ENABLED: "false",
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
    KHOTWA_SYNTHETIC_DATA: "true",
    PH04_BOOTSTRAP_TTL_SECONDS: "120",
    PH04_RATE_LIMIT_MAX: "10000",
    PH04_RATE_LIMIT_WINDOW_SECONDS: "60",
    PH04_MATH_TIMEOUT_MS: "1500",
    MATH_ENGINE_BASE_URL: `http://${math}:8001`,
  })
    .map(([k, v]) => k + "=" + v)
    .join("\n") + "\n",
);
const checks = [],
  created = [];
let failure = null,
  dbProof = null,
  liveProof = null,
  testSummary = null;
const redact = (s) =>
  [password, ...Object.values(secrets)].reduce(
    (text, secret) => text.replaceAll(secret, "[REDACTED]"),
    s,
  );
function run(args, record = true) {
  const start = Date.now(),
    r = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 8000000 });
  const result = {
    command: ["docker", ...args],
    exitCode: r.status,
    seconds: Math.round((Date.now() - start) / 100) / 10,
    stdout: redact(r.stdout ?? ""),
    stderr: redact(r.stderr ?? ""),
  };
  if (record) checks.push(result);
  return result;
}
function need(args) {
  const r = run(args);
  if (r.exitCode !== 0)
    throw new Error(
      "Docker step failed: " +
        args.slice(0, 3).join(" ") +
        "\n" +
        r.stderr.slice(-2000),
    );
  return r;
}
try {
  if (!process.argv.includes("--skip-build")) {
    console.log("Building PH-08 test image");
    need(["build", "--target", "ph08-test", "-t", "khotwa-ph08-test", "."]);
    console.log("Building private math image");
    need(["build", "--target", "math", "-t", "khotwa-ph08-math", "."]);
  }
  need([
    "network",
    "create",
    "--internal",
    "--label",
    "khotwa.task=ph08-test",
    network,
  ]);
  created.push(["network", network]);
  need([
    "run",
    "-d",
    "--name",
    db,
    "--label",
    "khotwa.task=ph08-test",
    "--network",
    network,
    "--env-file",
    dbEnv,
    "--memory",
    "512m",
    "--pids-limit",
    "64",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,noexec,nosuid,size=128m",
    "postgres:17.6-alpine3.22",
  ]);
  created.push(["container", db]);
  need([
    "run",
    "-d",
    "--name",
    math,
    "--label",
    "khotwa.task=ph08-test",
    "--network",
    network,
    "--env-file",
    mathEnv,
    "--memory",
    "256m",
    "--cpus",
    "1",
    "--pids-limit",
    "64",
    "--read-only",
    "--tmpfs",
    "/tmp",
    "khotwa-ph08-math",
  ]);
  created.push(["container", math]);
  need([
    "exec",
    math,
    "python",
    "-c",
    "import os; assert 'DATABASE_URL' not in os.environ; assert 'GUEST_DIGEST_KEY' not in os.environ; print('Math environment isolated from DB and guest-signing credentials')",
  ]);
  const end = Date.now() + 30000;
  let ready = false;
  while (Date.now() < end) {
    const pgReady =
      run(["exec", db, "pg_isready", "-U", "ph08", "-d", "ph08_test"], false)
        .exitCode === 0;
    const mathReady =
      run(
        [
          "exec",
          math,
          "python",
          "-c",
          "import os,urllib.request; r=urllib.request.Request('http://127.0.0.1:8001/internal/health',headers={'Authorization':'Bearer '+os.environ['MATH_INTERNAL_TOKEN']}); urllib.request.urlopen(r,timeout=2)",
        ],
        false,
      ).exitCode === 0;
    if (pgReady && mathReady) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready)
    throw new Error("Private test services startup deadline exceeded");
  created.push(["container", tests]);
  const r = run([
    "run",
    "--name",
    tests,
    "--label",
    "khotwa.task=ph08-test",
    "--network",
    network,
    "--env-file",
    envFile,
    "--memory",
    "768m",
    "--pids-limit",
    "128",
    "--mount",
    "type=bind,source=" + path.resolve("qa") + ",target=/app/qa,readonly",
    "--mount",
    "type=bind,source=" +
      path.resolve("apps/api/tests") +
      ",target=/app/apps/api/tests,readonly",
    "--mount",
    "type=bind,source=" +
      path.resolve("apps/api/prisma") +
      ",target=/app/apps/api/prisma,readonly",
    "khotwa-ph08-test",
  ]);
  for (const line of r.stdout.split("\n")) {
    if (line.startsWith("PH08_DB_RESULT "))
      dbProof = JSON.parse(line.slice(15));
    if (line.startsWith("PH08_LIVE_RESULT "))
      liveProof = JSON.parse(line.slice(17));
  }
  testSummary = {
    total: Number(r.stdout.match(/tests (\d+)/)?.[1] ?? 0),
    passed: Number(r.stdout.match(/pass (\d+)/)?.[1] ?? 0),
    failed: Number(r.stdout.match(/fail (\d+)/)?.[1] ?? 0),
  };
  console.log(
    r.stdout
      .split("\n")
      .filter((l) => !l.startsWith("PH08_LIVE_RESULT "))
      .join("\n"),
  );
  if (r.exitCode !== 0)
    throw new Error("Real integration checks failed: " + r.stderr.slice(-2000));
  if (!dbProof || !liveProof)
    throw new Error("Real integration evidence marker missing");
} catch (e) {
  failure = e.message;
  console.error(failure);
} finally {
  for (const [kind, name] of created.reverse()) {
    const inspected = run(
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
    if (inspected.exitCode === 0 && inspected.stdout.trim() === "ph08-test")
      run(
        kind === "network" ? ["network", "rm", name] : ["rm", "-f", "-v", name],
      );
  }
  unlinkSync(envFile);
  unlinkSync(dbEnv);
  unlinkSync(mathEnv);
  writeFileSync(
    "qa-reports/ph08-container.json",
    JSON.stringify(
      {
        phase: "PH-08",
        recordedAt: new Date().toISOString(),
        failure,
        checks,
        dbProof,
        liveProof,
        testSummary,
      },
      null,
      2,
    ) + "\n",
  );
  if (liveProof)
    writeFileSync(
      "qa-reports/ph08-live-results.json",
      JSON.stringify(liveProof, null, 2) + "\n",
    );
  if (failure) process.exitCode = 1;
}
