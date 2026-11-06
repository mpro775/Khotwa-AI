import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run with npm run verify:ph04");
const checks = [];
for (const script of [
  "contracts:check",
  "format:check",
  "lint",
  "typecheck",
  "build",
  "test:api",
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
  "qa-reports/ph04-checks.json",
  JSON.stringify(
    {
      phase: "PH-04",
      recordedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      checks,
      passed: checks.filter((c) => c.exitCode === 0).length,
      failed: checks.filter((c) => c.exitCode !== 0).length,
      scope:
        "static checks, API units, foundation health smoke; real DB integration recorded separately; no heavy Golden/load suite",
    },
    null,
    2,
  ) + "\n",
);
if (checks.some((c) => c.exitCode !== 0)) process.exitCode = 1;
