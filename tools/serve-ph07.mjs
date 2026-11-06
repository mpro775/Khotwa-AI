import { spawnSync } from "node:child_process";
import { randomBytes, X509Certificate } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createServer } from "node:net";
const envFile = ".local/ph07-local.env",
  metadataFile = ".local/ph07-local.json",
  tls = ".local/ph07-tls";
mkdirSync(tls, { recursive: true });
mkdirSync("qa-reports", { recursive: true });
const checks = [];
if (
  !existsSync(tls + "/cert.pem") ||
  new Date(
    new X509Certificate(readFileSync(tls + "/cert.pem")).validTo,
  ).getTime() < Date.now()
) {
  const executable =
    process.platform === "win32"
      ? "C:/Program Files/Git/usr/bin/openssl.exe"
      : "openssl";
  const args = [
    "req",
    "-x509",
    "-nodes",
    "-newkey",
    "rsa:2048",
    "-keyout",
    tls + "/key.pem",
    "-out",
    tls + "/cert.pem",
    "-days",
    "7",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ];
  const r = spawnSync(executable, args, { encoding: "utf8" });
  checks.push({
    command:
      "openssl localhost self-signed test certificate (no trust-store changes)",
    exitCode: r.status,
  });
  if (r.status !== 0) throw new Error("Local test certificate creation failed");
}
if (!existsSync(envFile)) {
  const requested = Number(
    process.argv.find((a) => a.startsWith("--port="))?.slice(7) ?? 8445,
  );
  const probe = createServer();
  let port;
  try {
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(requested, "127.0.0.1", resolve);
    });
    port = probe.address().port;
  } catch {
    await new Promise((resolve) => {
      probe.listen(0, "127.0.0.1", resolve);
    });
    port = probe.address().port;
  }
  await new Promise((resolve) => probe.close(resolve));
  const prefix = "khotwa-ph07-" + randomBytes(6).toString("hex"),
    password = randomBytes(32).toString("hex");
  const values = {
    PH07_PREFIX: prefix,
    PH07_PORT: String(port),
    POSTGRES_PASSWORD: password,
    DATABASE_URL: `postgresql://ph07:${password}@${prefix}-db:5432/ph07_test`,
    PUBLIC_APP_ORIGIN: `https://localhost:${port}`,
  };
  for (const key of [
    "GUEST_DIGEST_KEY",
    "BOOTSTRAP_SIGNING_KEY",
    "CSRF_SIGNING_KEY",
    "GUEST_ISSUE_KEY",
    "IDEMPOTENCY_DIGEST_KEY",
    "CURSOR_SIGNING_KEY",
    "INTERNAL_HEALTH_TOKEN",
    "MATH_INTERNAL_TOKEN",
  ])
    values[key] = randomBytes(32).toString("hex");
  writeFileSync(
    envFile,
    Object.entries(values)
      .map(([k, v]) => k + "=" + v)
      .join("\n") + "\n",
  );
  writeFileSync(
    metadataFile,
    JSON.stringify(
      {
        prefix,
        url: values.PUBLIC_APP_ORIGIN,
        envFile,
        composeFile: "compose.ph07.yaml",
        scope:
          "loopback synthetic test only; untrusted local certificate; no trust-store change",
      },
      null,
      2,
    ) + "\n",
  );
}
const values = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const redact = (text) =>
  Object.entries(values)
    .filter(([k]) => /KEY|TOKEN|PASSWORD|DATABASE_URL/.test(k))
    .reduce((s, [, v]) => s.replaceAll(v, "[REDACTED]"), text);
for (const args of [
  [
    "compose",
    "-f",
    "compose.ph07.yaml",
    "--env-file",
    envFile,
    "config",
    "--quiet",
  ],
  [
    "compose",
    "-f",
    "compose.ph07.yaml",
    "--env-file",
    envFile,
    "up",
    ...(process.argv.includes("--skip-build") ? [] : ["--build"]),
    "-d",
    "--wait",
    "--wait-timeout",
    "90",
  ],
]) {
  console.log(
    args.includes("up")
      ? "Starting isolated local HTTPS integration profile"
      : "Checking local Compose configuration",
  );
  const r = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 8000000 });
  checks.push({
    command: ["docker", ...args],
    exitCode: r.status,
    stdout: redact(r.stdout ?? ""),
    stderr: redact(r.stderr ?? ""),
  });
  if (r.status !== 0) {
    writeFileSync(
      "qa-reports/ph07-local-run.json",
      JSON.stringify({ checks, failed: true }, null, 2),
    );
    throw new Error(
      "Local profile failed; inspect redacted ph07-local-run.json",
    );
  }
}
const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
writeFileSync(
  "qa-reports/ph07-local-run.json",
  JSON.stringify(
    {
      phase: "PH-07",
      recordedAt: new Date().toISOString(),
      checks,
      metadata,
      trustStoreModified: false,
      certificateValidationDisabled: false,
    },
    null,
    2,
  ) + "\n",
);
console.log("Local integration ready: " + metadata.url);
