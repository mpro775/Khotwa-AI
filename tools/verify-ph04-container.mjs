import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
const suffix = randomBytes(6).toString("hex"),
  prefix = "khotwa-ph04-" + suffix;
const network = prefix,
  db = prefix + "-db",
  api = prefix + "-tests",
  runtime = prefix + "-api",
  password = randomBytes(32).toString("hex");
const envFile = path.resolve(".local", prefix + ".env"),
  checks = [];
mkdirSync(".local", { recursive: true });
mkdirSync("qa-reports", { recursive: true });
writeFileSync(
  envFile,
  `POSTGRES_USER=ph04\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=ph04_test\nDATABASE_URL=postgresql://ph04:${password}@${db}:5432/ph04_test\n`,
);
const runtimeKeys = Object.fromEntries(
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
writeFileSync(
  envFile,
  readFileSync(envFile, "utf8") +
    Object.entries({
      ...runtimeKeys,
      PH04_API_ENABLED: "true",
      PUBLIC_APP_ORIGIN: "https://khotwa.test",
      PH04_BOOTSTRAP_TTL_SECONDS: "120",
      PH04_RATE_LIMIT_MAX: "1000",
      PH04_RATE_LIMIT_WINDOW_SECONDS: "60",
      PH04_MATH_TIMEOUT_MS: "1000",
      MATH_ENGINE_BASE_URL: "http://unused-math:8001",
    })
      .map(([k, v]) => k + "=" + v)
      .join("\n") +
    "\n",
);
const redact = (text) =>
  [password, ...Object.values(runtimeKeys)].reduce(
    (value, secret) => value.replaceAll(secret, "[REDACTED]"),
    text,
  );
function run(args, record = true) {
  const start = Date.now(),
    r = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 6000000 });
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
        r.stderr.slice(-1800),
    );
  return r;
}
let failure = null,
  dbProof = null,
  httpProof = null,
  runtimeProof = null;
const created = [];
try {
  if (!process.argv.includes("--skip-build"))
    need(["build", "--target", "api-test", "-t", "khotwa-ph04-api-test", "."]);
  if (!process.argv.includes("--skip-build"))
    need(["build", "--target", "api", "-t", "khotwa-ph04-api", "."]);
  need([
    "network",
    "create",
    "--internal",
    "--label",
    "khotwa.task=ph04-test",
    network,
  ]);
  created.push(["network", network]);
  need([
    "run",
    "-d",
    "--name",
    db,
    "--label",
    "khotwa.task=ph04-test",
    "--network",
    network,
    "--env-file",
    envFile,
    "--memory",
    "512m",
    "--pids-limit",
    "64",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,noexec,nosuid,size=128m",
    "postgres:17.6-alpine3.22",
  ]);
  created.push(["container", db]);
  const databaseMounts = JSON.parse(
    need(["inspect", db, "--format", "{{json .Mounts}}"]).stdout,
  );
  if (databaseMounts.some((m) => m.Type !== "tmpfs"))
    throw new Error("Test database must use ephemeral tmpfs only");
  const until = Date.now() + 30000;
  let ready = false;
  while (Date.now() < until) {
    if (
      run(["exec", db, "pg_isready", "-U", "ph04", "-d", "ph04_test"], false)
        .exitCode === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error("Isolated PostgreSQL startup deadline exceeded");
  // Mount source QA only so --skip-build can repeat a targeted test edit.
  created.push(["container", api]);
  const result = run([
    "run",
    "--name",
    api,
    "--label",
    "khotwa.task=ph04-test",
    "--network",
    network,
    "--env-file",
    envFile,
    "--memory",
    "512m",
    "--pids-limit",
    "128",
    "--mount",
    "type=bind,source=" +
      path.resolve("apps/api/tests") +
      ",target=/app/apps/api/tests,readonly",
    "--mount",
    "type=bind,source=" + path.resolve("qa") + ",target=/app/qa,readonly",
    "--mount",
    "type=bind,source=" +
      path.resolve("apps/api/prisma") +
      ",target=/app/apps/api/prisma,readonly",
    "khotwa-ph04-api-test",
  ]);
  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("PH04_DB_RESULT "))
      dbProof = JSON.parse(line.slice(15));
    if (line.startsWith("PH04_HTTP_RESULT "))
      httpProof = JSON.parse(line.slice(17));
  }
  console.log(
    result.stdout
      .split("\n")
      .filter((l) => !l.startsWith("PH04_HTTP_RESULT "))
      .join("\n"),
  );
  if (result.exitCode !== 0)
    throw new Error(
      "PH-04 container checks failed: " + result.stderr.slice(-1800),
    );
  if (!dbProof || !httpProof) throw new Error("PH-04 evidence marker missing");
  need([
    "run",
    "-d",
    "--name",
    runtime,
    "--label",
    "khotwa.task=ph04-test",
    "--network",
    network,
    "--env-file",
    envFile,
    "--memory",
    "512m",
    "--pids-limit",
    "128",
    "--read-only",
    "--tmpfs",
    "/tmp",
    "--mount",
    "type=bind,source=" +
      path.resolve("qa/ph04-runtime-probe.mjs") +
      ",target=/probe.mjs,readonly",
    "khotwa-ph04-api",
  ]);
  created.push(["container", runtime]);
  const probe = need(["exec", runtime, "node", "/probe.mjs"]);
  const runtimeLine = probe.stdout
    .split("\n")
    .find((l) => l.startsWith("PH04_RUNTIME_RESULT "));
  if (!runtimeLine) throw new Error("Runtime packaging proof missing");
  runtimeProof = JSON.parse(runtimeLine.slice(20));
  console.log(
    "Production API image: " + runtimeProof.passed + " checks passed",
  );
} catch (error) {
  failure = error.message;
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
    if (inspected.exitCode === 0 && inspected.stdout.trim() === "ph04-test")
      run(
        kind === "network" ? ["network", "rm", name] : ["rm", "-f", "-v", name],
      );
  }
  unlinkSync(envFile);
  const report = {
    phase: "PH-04",
    recordedAt: new Date().toISOString(),
    hostNode: process.version,
    scope:
      "isolated Docker network and PostgreSQL; no real data or deployed migration",
    failure,
    checks,
    dbProof,
    httpProof,
    runtimeProof,
  };
  writeFileSync(
    "qa-reports/ph04-container.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (httpProof)
    writeFileSync(
      "qa-reports/ph04-http-contracts.json",
      JSON.stringify(httpProof, null, 2) + "\n",
    );
  if (failure) process.exitCode = 1;
}
