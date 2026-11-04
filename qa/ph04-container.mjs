import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
const url = new URL(process.env.DATABASE_URL);
assert.match(url.hostname, /^khotwa-ph04-[a-f0-9]{12}-db$/);
assert.equal(url.pathname, "/ph04_test");
const pool = new pg.Pool({
  connectionString: url.href,
  connectionTimeoutMillis: 3000,
});
const checks = [];
const cli = (args) => {
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
  if (r.status !== 0)
    throw new Error(
      "Prisma migration command failed: " + r.stderr.slice(-1500),
    );
  checks.push({ command: "prisma " + args.join(" "), exitCode: r.status });
};
try {
  const version = (
    await pool.query(
      "SELECT current_setting('server_version') AS version,current_database() AS database",
    )
  ).rows[0];
  assert.match(version.version, /^17\.6/);
  assert.equal(version.database, "ph04_test");
  cli(["migrate", "deploy"]);
  const tables = await pool.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'_prisma_migrations'",
  );
  assert.equal(tables.rows[0].n, 31);
  checks.push({
    name: "business_migrations_16_PH04_plus_1_PH05_plus_5_PH06_plus_4_PH07_plus_5_PH08_tables",
    passed: true,
  });
  await pool.query(readFileSync("qa/ph04-down.sql", "utf8"));
  const down = await pool.query(
    "SELECT to_regclass('public.attempts')::text AS attempts,to_regclass('public.guest_sessions')::text AS guests",
  );
  assert.equal(down.rows[0].attempts, null);
  assert.equal(down.rows[0].guests, null);
  checks.push({ name: "explicit_down_isolated_business_schema", passed: true });
  cli(["migrate", "reset", "--force"]);
  const [partial, deferred] = await Promise.all([
    pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname='active_step_position'",
    ),
    pool.query(
      "SELECT condeferrable,condeferred FROM pg_constraint WHERE conname='current_version_exists'",
    ),
  ]);
  assert.match(partial.rows[0].indexdef, /UNIQUE.*WHERE is_active/);
  assert.equal(deferred.rows[0].condeferrable, true);
  assert.equal(deferred.rows[0].condeferred, true);
  checks.push({
    name: "replay_retains_partial_unique_and_deferred_fk",
    passed: true,
  });
  console.log(
    "PH04_DB_RESULT " +
      JSON.stringify({
        checks,
        postgres: version.version,
        scope: "isolated synthetic database only",
      }),
  );
} finally {
  await pool.end();
}
const tests = spawnSync(
  process.execPath,
  [
    "--test",
    "apps/api/tests/security.test.mjs",
    "apps/api/tests/math-gateway.test.mjs",
    "apps/api/tests/integration.test.mjs",
  ],
  {
    encoding: "utf8",
    env: { ...process.env, PH04_INTEGRATION: "true" },
    maxBuffer: 4000000,
  },
);
console.log(tests.stdout);
if (tests.stderr) console.log(tests.stderr);
try {
  console.log(
    "PH04_HTTP_RESULT " +
      readFileSync("/tmp/ph04-http-contracts.json", "utf8").replaceAll(
        "\n",
        "",
      ),
  );
} catch {
  /* No HTTP result if startup failed. */
}
process.exitCode = tests.status ?? 1;
