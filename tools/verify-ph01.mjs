import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this tool with npm run verify");
const checks = [];
for (const script of [
  "contracts:check",
  "format:check",
  "lint",
  "typecheck",
  "build",
  "check:foundation",
  "smoke",
]) {
  const start = Date.now();
  const result = spawnSync(process.execPath, [npm, "run", script], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  checks.push({
    command: "npm run " + script,
    exitCode: result.status,
    seconds: Math.round((Date.now() - start) / 100) / 10,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  console.log(script + ": " + (result.status === 0 ? "PASS" : "FAIL"));
  if (result.status !== 0) break;
}
const report = {
  phase: "PH-01",
  recordedAtRiyadh: new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Riyadh",
  }),
  node: process.version,
  platform: process.platform,
  npmUserAgent: process.env.npm_config_user_agent,
  checks,
  passed: checks.filter((c) => c.exitCode === 0).length,
  failed: checks.filter((c) => c.exitCode !== 0).length,
  productMathGoldenCasesRun: 0,
  scope:
    "Build/type/format/contracts, private synthetic seed and foundational health smoke; no tutoring/editor/parser acceptance",
};
mkdirSync("qa-reports", { recursive: true });
writeFileSync(
  "qa-reports/ph01-checks.json",
  JSON.stringify(report, null, 2) + "\n",
);
if (report.failed) process.exitCode = 1;
