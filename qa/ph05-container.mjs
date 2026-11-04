import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
const url = new URL(process.env.DATABASE_URL);
assert.match(url.hostname, /^khotwa-ph05-[a-f0-9]{12}-db$/);
assert.equal(url.pathname, "/ph05_test");
const pool = new pg.Pool({ connectionString: url.href }),
  checks = [];
function cli(args) {
  const r = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      ...args,
      "--config",
      "apps/api/prisma.config.ts",
    ],
    { encoding: "utf8", maxBuffer: 1000000 },
  );
  if (r.status !== 0) throw new Error(r.stderr.slice(-1600));
  checks.push({ command: "prisma " + args.join(" "), exitCode: r.status });
}
try {
  cli(["migrate", "deploy"]);
  const tables = await pool.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'_prisma_migrations'",
  );
  assert.equal(tables.rows[0].n, 31);
  await pool.query(readFileSync("qa/ph09-down.sql", "utf8"));
  await pool.query(readFileSync("qa/ph08-down.sql", "utf8"));
  await pool.query(readFileSync("qa/ph07-down.sql", "utf8"));
  await pool.query(readFileSync("qa/ph06-down.sql", "utf8"));
  await pool.query(
    "ALTER TABLE verification_runs DROP COLUMN report_id; DROP TABLE verification_reports; DROP FUNCTION protect_finished_report();",
  );
  const down = await pool.query(
    "SELECT to_regclass('verification_reports')::text AS report,to_regclass('attempts')::text AS attempt",
  );
  assert.equal(down.rows[0].report, null);
  assert.equal(down.rows[0].attempt, "attempts");
  checks.push({ name: "PH05_delta_down_preserves_PH04_tables", passed: true });
  cli(["migrate", "reset", "--force"]);
  const version = await pool.query(
    "SELECT current_setting('server_version') AS version",
  );
  assert.match(version.rows[0].version, /^17\.6/);
  console.log(
    "PH05_DB_RESULT " +
      JSON.stringify({
        checks,
        postgres: version.rows[0].version,
        tables: 31,
        scope: "isolated tmpfs; delta rollback and full replay",
      }),
  );
} finally {
  await pool.end();
}
const tests = spawnSync(
  process.execPath,
  ["--test", "apps/api/tests/verification-live.test.mjs"],
  {
    encoding: "utf8",
    env: { ...process.env, PH05_INTEGRATION: "true" },
    maxBuffer: 5000000,
  },
);
console.log(tests.stdout, tests.stderr);
try {
  console.log(
    "PH05_LIVE_RESULT " +
      readFileSync("/tmp/ph05-live-results.json", "utf8").replaceAll("\n", ""),
  );
} catch {
  /* no result if startup failed */
}
process.exitCode = tests.status ?? 1;
