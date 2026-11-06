import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run with npm run verify:ph07");
const checks = [];
for (const script of [
  "contracts:check",
  "format:check",
  "lint",
  "typecheck",
  "build",
  "test:api",
  "test:diagnosis",
  "test:tutoring",
  "test:editor",
  "test:workspace",
  "smoke",
]) {
  const start = Date.now(),
    r = spawnSync(process.execPath, [npm, "run", script], {
      encoding: "utf8",
      maxBuffer: 4000000,
    });
  checks.push({
    command: "npm run " + script,
    exitCode: r.status,
    seconds: Math.round((Date.now() - start) / 100) / 10,
    stdout: r.stdout,
    stderr: r.stderr,
  });
  console.log(script + ": " + (r.status === 0 ? "PASS" : "FAIL"));
  if (r.status !== 0) break;
}
mkdirSync("qa-reports", { recursive: true });
writeFileSync(
  "qa-reports/ph07-checks.json",
  JSON.stringify(
    {
      phase: "PH-07",
      recordedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      checks,
      passed: checks.filter((c) => c.exitCode === 0).length,
      failed: checks.filter((c) => c.exitCode !== 0).length,
      scope:
        "targeted PH07 static, unit, client and state checks; real integration and draft Golden coverage reported separately; no heavy load, external provider, or PH08",
    },
    null,
    2,
  ) + "\n",
);
if (checks.some((c) => c.exitCode !== 0)) process.exitCode = 1;
