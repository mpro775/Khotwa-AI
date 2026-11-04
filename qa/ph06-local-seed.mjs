import { spawnSync } from "node:child_process";
import pg from "pg";
import { seedIntegration } from "./ph06-fixtures.mjs";
const url = new URL(process.env.DATABASE_URL);
if (
  !/^khotwa-ph06-[a-f0-9]{12}-db$/.test(url.hostname) ||
  url.pathname !== "/ph06_test"
)
  throw new Error("Local seed restricted to isolated PH-06 test database");
const deployed = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--config",
    "apps/api/prisma.config.ts",
  ],
  { encoding: "utf8" },
);
if (deployed.status !== 0) throw new Error("Local test migrations failed");
const pool = new pg.Pool({ connectionString: url.href });
try {
  const existing = await pool.query(
    "SELECT id FROM content_releases WHERE release_code LIKE 'ph06-test-%' LIMIT 1",
  );
  if (!existing.rows.length) await seedIntegration(pool, { golden: false });
  console.log(
    "PH-06 local synthetic integration fixtures ready; no human content review claimed.",
  );
} finally {
  await pool.end();
}
