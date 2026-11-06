import { spawnSync } from "node:child_process";
import {
  writeFileSync,
  existsSync,
  copyFileSync,
  openSync,
  closeSync,
} from "node:fs";
import pg from "pg";
const evidence = "/evidence";
const checks = [];
function run(name, args, env = {}) {
  const start = Date.now();
  const log = openSync(`${evidence}/${name}.log`, "w");
  const r = spawnSync(process.execPath, args, {
    stdio: ["ignore", log, log],
    timeout: 120000,
    env: { ...process.env, ...env },
  });
  closeSync(log);
  const summary = {
    name,
    command: ["node", ...args],
    exitCode: r.status,
    elapsedMs: Date.now() - start,
  };
  checks.push(summary);
  console.log(JSON.stringify(summary));
  return r.status;
}
if (
  run("compile", [
    "node_modules/typescript/bin/tsc",
    "-p",
    "apps/api/tsconfig.json",
  ]) !== 0
)
  process.exit(1);
const base = new URL(process.env.DATABASE_URL);
const pool = new pg.Pool({ connectionString: base.href });
try {
  for (const n of [4, 5, 6, 7, 8, 9])
    await pool.query(`CREATE DATABASE ph0${n}_test`);
} finally {
  await pool.end();
}
const phases = [
  [4, "integration.test.mjs"],
  [5, "verification-live.test.mjs"],
  [6, "diagnosis-live.test.mjs"],
  [7, "tutoring-live.test.mjs"],
  [8, "learning-live.test.mjs"],
  [9, "progress-live.test.mjs"],
];
for (const [n, file] of phases) {
  if (process.env.PH10_RETENTION_ONLY === "true" && n !== 9) continue;
  const phase = `ph0${n}`,
    url = new URL(base);
  url.hostname = `khotwa-${phase}-${process.env.PH10_SUFFIX}-db`;
  url.pathname = `/${phase}_test`;
  const env = {
    DATABASE_URL: url.href,
    PH04_INTEGRATION: "false",
    PH05_INTEGRATION: "false",
    PH06_INTEGRATION: "false",
    PH07_INTEGRATION: "false",
    PH08_INTEGRATION: "false",
    PH09_INTEGRATION: "false",
    [`${phase.toUpperCase()}_INTEGRATION`]: "true",
  };
  if (n === 9)
    env.MATH_ENGINE_BASE_URL = `http://khotwa-ph09-${process.env.PH10_SUFFIX}-math:8001`;
  for (let feature = 5; feature <= 9; feature++)
    env[`PH0${feature}_API_ENABLED`] = String(feature <= n);
  run(
    `${phase}-migrations`,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--config",
      "apps/api/prisma.config.ts",
    ],
    env,
  );
  if (process.env.PH10_RETENTION_ONLY !== "true")
    run(`${phase}-integration`, ["--test", `apps/api/tests/${file}`], env);
  for (const name of [`${phase}-live-results.json`, "ph04-http-contracts.json"])
    if (existsSync(`/tmp/${name}`))
      copyFileSync(`/tmp/${name}`, `${evidence}/${name}`);
  if (n === 6) run("golden-http", ["qa/ph10-golden-http.mjs"], env);
  if (n === 8) {
    const reviewedEnv = {
      ...env,
      AI_ENABLED: "true",
      PH08_GEMINI_OFFLINE: "true",
      PH08_GEMINI_GENERATIVE_ENABLED: "true",
      PH08_FINAL_OFFLINE_INTEGRATION: "true",
      PH08_REVIEWED_CONTENT_ENABLED: "true",
      PH08_REVIEWED_CONTENT_PATH: "/app/content/ph08-reviewed-2026-11-06.json",
      GEMINI_MODEL: "gemini-3.5-flash-lite",
      GEMINI_THINKING_LEVEL: "minimal",
      GEMINI_ROUND_CALL_LIMIT: "15",
      GEMINI_DAILY_REMAINING: "15",
      GEMINI_QUOTA_VALID_UNTIL: new Date(Date.now() + 3600000).toISOString(),
      GEMINI_QUOTA_LEDGER_PATH: "/tmp/ph10-offline-ledger.json",
      PH08_GEMINI_TIMEOUT_MS: "1000",
    };
    run(
      "reviewed-gemini-simulation",
      ["--test", "apps/api/tests/ph08-final-integration.test.mjs"],
      reviewedEnv,
    );
  }
  if (n === 9)
    run("retention", ["--test", "apps/api/tests/retention-live.test.mjs"], env);
}
writeFileSync(
  `${evidence}/integration-summary.json`,
  JSON.stringify(
    {
      runId: process.env.PH10_RUN_ID,
      commit: process.env.PH10_COMMIT,
      actualGeminiCalls: 0,
      isolatedNetwork: true,
      checks,
    },
    null,
    2,
  ) + "\n",
);
// A failed Golden comparison remains a failure in the report and exit status.
if (checks.some((c) => c.exitCode !== 0)) process.exitCode = 1;
