import { spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { seedManualRuntime } from "../qa/v22-manual-seed.mjs";

const root = path.resolve("."),
  local = path.join(root, ".local/v22-manual"),
  configFile = path.join(local, "private-config.json"),
  metadataFile = path.join(local, "runtime.json");
mkdirSync(local, { recursive: true });
const label = createHash("sha256")
  .update(root.toLowerCase())
  .digest("hex")
  .slice(0, 12);
let config;
if (existsSync(configFile))
  config = JSON.parse(readFileSync(configFile, "utf8"));
else {
  const prefix = `khotwa-v22-manual-${randomBytes(5).toString("hex")}`;
  config = {
    version: 1,
    workspace: root,
    prefix,
    database: `${prefix}-db`,
    math: `${prefix}-math`,
    volume: `${prefix}-data`,
    password: randomBytes(32).toString("hex"),
    actors: {},
    secrets: Object.fromEntries(
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
      ].map((k) => [k, randomBytes(32).toString("hex")]),
    ),
  };
}
if (
  config.workspace !== root ||
  !/^khotwa-v22-manual-[a-f0-9]{10}$/.test(config.prefix) ||
  config.database !== config.prefix + "-db" ||
  config.math !== config.prefix + "-math" ||
  config.volume !== config.prefix + "-data"
)
  throw Error("Manual runtime state does not match this workspace");
const save = () => {
  writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  if (process.platform === "win32") {
    const account = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
    const secured = spawnSync(
      "icacls",
      [
        configFile,
        "/inheritance:r",
        "/grant:r",
        `${account}:(F)`,
        "SYSTEM:(F)",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    if (secured.status !== 0)
      throw Error("Could not restrict local runtime secret file ACL");
  }
};
save();
const redact = (s) =>
  [
    config.password,
    ...Object.values(config.secrets),
    ...Object.values(config.actors).map((a) => a.token),
  ].reduce((text, value) => text.replaceAll(value, "[REDACTED]"), s ?? "");
function command(exe, args, env = process.env) {
  const result = spawnSync(exe, args, {
    env,
    encoding: "utf8",
    maxBuffer: 8000000,
    windowsHide: true,
  });
  if (result.status !== 0)
    throw Error(`${exe} failed: ${redact(result.stderr ?? result.stdout)}`);
  return result.stdout.trim();
}
function inspect(name) {
  const result = spawnSync("docker", ["inspect", name], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  return JSON.parse(result.stdout)[0];
}
function ownContainer(name) {
  const item = inspect(name);
  if (item && item.Config.Labels?.["khotwa.workspace"] !== label)
    throw Error("Refusing another workspace's container");
  return item;
}
if (process.argv.includes("--status")) {
  console.log(
    JSON.stringify(
      {
        url: "https://localhost:8462",
        databaseRunning: ownContainer(config.database)?.State.Running ?? false,
        mathRunning: ownContainer(config.math)?.State.Running ?? false,
        dataRetained: true,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (process.argv.includes("--stop")) {
  writeFileSync(path.join(local, "stop"), "stop\n");
  console.log(
    "Stop requested. Content revisions, attempts and the database volume are retained.",
  );
  process.exit(0);
}
if (process.argv.includes("--evidence")) {
  if (!ownContainer(config.database)?.State.Running)
    throw Error(
      "Start the dedicated manual database before collecting evidence",
    );
  const port = command("docker", ["port", config.database, "5432/tcp"])
    .split(":")
    .at(-1);
  const evidencePool = new pg.Pool({
    connectionString: `postgresql://v22_manual:${config.password}@127.0.0.1:${port}/v22_manual`,
  });
  try {
    const counts = {};
    for (const table of [
      "learning_content_revisions",
      "learning_content_events",
      "learning_assessments",
      "learning_assessment_items",
      "learning_lesson_events",
      "learning_recommendation_events",
      "attempts",
      "step_versions",
      "verification_reports",
      "subject_attempts",
    ])
      counts[table] = Number(
        (await evidencePool.query(`SELECT count(*) AS count FROM ${table}`))
          .rows[0].count,
      );
    const content = (
      await evidencePool.query(
        "SELECT id,item_id,version,status,payload->>'code' AS code,payload->>'subject' AS subject,payload->>'titleAr' AS title_ar,reviewed_at,published_at FROM learning_content_revisions ORDER BY created_at,id",
      )
    ).rows;
    const assessments = (
      await evidencePool.query(
        "SELECT id,subject_code,kind,revision,track_revision_id,lesson_revision_id,created_at FROM learning_assessments ORDER BY created_at,id",
      )
    ).rows;
    const reports = (
      await evidencePool.query(
        "SELECT id,attempt_id,attempt_revision,engine_version,scope,dispatch_status,finished_at,report_json->'completion' AS completion,ARRAY(SELECT t->>'mathStatus' FROM jsonb_array_elements(COALESCE(report_json->'transitions','[]'::jsonb)) t) AS math_statuses FROM verification_reports ORDER BY created_at,id",
      )
    ).rows;
    const assessmentItems = (
      await evidencePool.query(
        "SELECT id,assessment_id,position,problem_revision_id,attempt_id,subject_attempt_id,measurement_exited_at FROM learning_assessment_items ORDER BY assessment_id,position",
      )
    ).rows;
    const attempts = (
      await evidencePool.query(
        "SELECT id,problem_revision_id,learning_session_id,revision,attempt_kind,status,highest_hint_level_seen,full_solution_seen,independent_evidence_eligible,assistance_revision FROM attempts ORDER BY opened_at,id",
      )
    ).rows;
    const recommendations = (
      await evidencePool.query(
        "SELECT id,assessment_id,track_revision_id,rule_version,recommendation->>'recommendedLessonId' AS lesson_revision_id,recommendation->>'targetSkillCode' AS skill_code,recommendation->>'reasonCode' AS reason_code,recommendation->'evidenceIds' AS evidence_ids,created_at FROM learning_recommendation_events ORDER BY created_at,id",
      )
    ).rows;
    const subjectAttempts = (
      await evidencePool.query(
        "SELECT id,subject_code,problem_revision_id,revision,verdict->>'status' AS status,independent,assistance_level,updated_at FROM subject_attempts ORDER BY created_at,id",
      )
    ).rows;
    const evidence = {
      recordedAt: new Date().toISOString(),
      scope:
        "Persisted synthetic local manual test data only; no raw answers, tokens, passwords or learner identities exported",
      source: "Real dedicated PostgreSQL queried directly, not a UI mock",
      counts,
      content,
      assessments,
      assessmentItems,
      attempts,
      recommendations,
      reports,
      subjectAttempts,
      databaseVolume: config.volume,
      dataRetained: true,
      httpRequests: existsSync(path.join(local, "requests.ndjson"))
        ? readFileSync(path.join(local, "requests.ndjson"), "utf8")
            .trim()
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : [],
    };
    writeFileSync(
      path.join(root, "qa-reports/V2.2-MANUAL-RUNTIME-EVIDENCE.json"),
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          recordedAt: evidence.recordedAt,
          counts,
          file: "qa-reports/V2.2-MANUAL-RUNTIME-EVIDENCE.json",
        },
        null,
        2,
      ),
    );
  } finally {
    await evidencePool.end();
  }
  process.exit(0);
}
const cert = path.join(root, ".local/v22-tls/cert.pem"),
  key = path.join(root, ".local/v22-tls/key.pem");
if (!existsSync(cert) || !existsSync(key))
  throw Error(
    "Prepare the scoped localhost TLS certificate at .local/v22-tls/cert.pem and key.pem first",
  );
const stopFile = path.join(local, "stop");
if (existsSync(stopFile)) {
  const { unlinkSync } = await import("node:fs");
  unlinkSync(stopFile);
}
let db = ownContainer(config.database);
if (!db) {
  command("docker", [
    "volume",
    "create",
    "--label",
    "khotwa.task=v22-manual",
    "--label",
    `khotwa.workspace=${label}`,
    config.volume,
  ]);
  command("docker", [
    "run",
    "-d",
    "--name",
    config.database,
    "--label",
    "khotwa.task=v22-manual",
    "--label",
    `khotwa.workspace=${label}`,
    "--memory",
    "512m",
    "--pids-limit",
    "64",
    "-p",
    "127.0.0.1::5432",
    "-v",
    `${config.volume}:/var/lib/postgresql/data`,
    "-e",
    "POSTGRES_USER=v22_manual",
    "-e",
    "POSTGRES_DB=v22_manual",
    "-e",
    `POSTGRES_PASSWORD=${config.password}`,
    "postgres:17.6-alpine3.22",
  ]);
} else if (!db.State.Running) command("docker", ["start", config.database]);
let mathContainer = ownContainer(config.math);
if (!mathContainer)
  command("docker", [
    "run",
    "-d",
    "--name",
    config.math,
    "--label",
    "khotwa.task=v22-manual",
    "--label",
    `khotwa.workspace=${label}`,
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
    `MATH_INTERNAL_TOKEN=${config.secrets.MATH_INTERNAL_TOKEN}`,
    "--mount",
    `type=bind,source=${path.join(root, "services/math-engine/src")},target=/app/src,readonly`,
    "khotwa-mvp-local-math:latest",
  ]);
else if (!mathContainer.State.Running)
  command("docker", ["start", config.math]);
const dbPort = command("docker", ["port", config.database, "5432/tcp"])
    .split(":")
    .at(-1),
  mathPort = command("docker", ["port", config.math, "8001/tcp"])
    .split(":")
    .at(-1);
const env = {
  ...process.env,
  ...config.secrets,
  DATABASE_URL: `postgresql://v22_manual:${config.password}@127.0.0.1:${dbPort}/v22_manual`,
  MATH_ENGINE_BASE_URL: `http://127.0.0.1:${mathPort}`,
  PUBLIC_APP_ORIGIN: "https://localhost:8462",
  KHOTWA_SYNTHETIC_DATA: "true",
  NODE_ENV: "test",
  ACCOUNTS_ENABLED: "true",
  ACCOUNT_MAIL_MODE: "disabled",
  BETA_ENABLED: "false",
  AI_ENABLED: "false",
  REAL_LEARNING_ENABLED: "false",
  PROGRAMMING_RUNNER_ENABLED: "false",
  PH08_GEMINI_LIVE_ENABLED: "false",
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
  PH08_MAX_REMEDIATION_ASSIGNMENTS: "3",
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
};
Object.assign(process.env, env);
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  const postgres = spawnSync(
    "docker",
    [
      "exec",
      config.database,
      "pg_isready",
      "-U",
      "v22_manual",
      "-d",
      "v22_manual",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  try {
    const response = await fetch(
      env.MATH_ENGINE_BASE_URL + "/internal/health",
      {
        headers: { authorization: "Bearer " + env.MATH_INTERNAL_TOKEN },
        signal: AbortSignal.timeout(1000),
      },
    );
    if (postgres.status === 0 && response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* bounded startup readiness only */
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!ready)
  throw Error(
    "Dedicated test database/math did not become ready; retained resources were not removed",
  );
command(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--config",
    "apps/api/prisma.config.ts",
  ],
  env,
);
const require = createRequire(import.meta.url);
const { createApplication } = require("../apps/api/dist/application.js"),
  { Store } = require("../apps/api/dist/store.js"),
  { MathGateway } = require("../apps/api/dist/math-gateway.js");
const app = await createApplication(true);
await app.listen(0, "127.0.0.1");
const base = await app.getUrl(),
  pool = new pg.Pool({ connectionString: env.DATABASE_URL }),
  store = app.get(Store);
const manifest = await seedManualRuntime({
  pool,
  store,
  math: app.get(MathGateway),
  base,
  actors: config.actors,
  saveActors: save,
});
const { createManualHttpServer } = await import("../qa/v22-manual-http.mjs");
const preview = createManualHttpServer({
  root,
  local,
  cert,
  key,
  base,
  actors: config.actors,
});
await preview.listen();
const metadata = {
  pid: process.pid,
  version: 1,
  scope:
    "Dedicated local synthetic manual-test environment; no real learner data, AI, Runner, Beta or human content approval",
  url: env.PUBLIC_APP_ORIGIN,
  teacherUrl: env.PUBLIC_APP_ORIGIN + "/__v22/teacher",
  studentUrl: env.PUBLIC_APP_ORIGIN + "/__v22/student-a",
  otherStudentUrl: env.PUBLIC_APP_ORIGIN + "/__v22/student-b",
  freshStudentUrl: env.PUBLIC_APP_ORIGIN + "/__v22/student-c",
  databaseContainer: config.database,
  mathContainer: config.math,
  databaseVolume: config.volume,
  dbPort: Number(dbPort),
  apiUrl: base,
  stopFile,
  manifest,
  startedAt: new Date().toISOString(),
  dataRetainedOnStop: true,
};
writeFileSync(metadataFile, JSON.stringify(metadata, null, 2) + "\n");
console.log("V2.2 manual test environment ready: " + env.PUBLIC_APP_ORIGIN);
console.log(
  "Student: " +
    metadata.studentUrl +
    "\nTeacher: " +
    metadata.teacherUrl +
    "\nOther student: " +
    metadata.otherStudentUrl,
);
console.log(
  "Dedicated PostgreSQL named volume retains all versions and attempts across stops/restarts.",
);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await preview.close();
  await app.close();
  await pool.end();
  for (const name of [config.math, config.database]) {
    if (ownContainer(name)?.State.Running) command("docker", ["stop", name]);
  }
};
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
while (!stopping && !existsSync(stopFile))
  await new Promise((resolve) => setTimeout(resolve, 500));
await stop();
console.log(
  "Stopped; database volume, content versions and attempts retained.",
);
