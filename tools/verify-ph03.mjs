import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run with npm run verify:ph03");
const python = (args) => [
  process.execPath,
  ["tools/python-task.mjs", "-X", "utf8", ...args],
];
const viaNpm = (args) => [process.execPath, [npm, ...args]];
const commands = [
  [
    "format_python",
    ...python([
      "-m",
      "black",
      "--check",
      "services/math-engine/src",
      "services/math-engine/tests",
      "qa/run_ph03_golden.py",
      "qa/ph03_container_smoke.py",
    ]),
  ],
  [
    "format_js_config",
    ...viaNpm([
      "exec",
      "--",
      "prettier",
      "--check",
      "package.json",
      "compose.yaml",
      ".github/workflows/ci.yml",
      "tools/verify-ph03.mjs",
      "tools/verify-ph03-contracts.mjs",
      "tools/verify-ph03-container.mjs",
      "tools/test-math.mjs",
      "tools/smoke.mjs",
      "tools/compose-smoke.mjs",
    ]),
  ],
  [
    "lint_python",
    ...python([
      "-m",
      "pycodestyle",
      "--max-line-length=88",
      "--ignore=E203,W503",
      "services/math-engine/src",
      "services/math-engine/tests",
      "qa/run_ph03_golden.py",
      "qa/ph03_container_smoke.py",
    ]),
  ],
  [
    "lint_js",
    ...viaNpm([
      "exec",
      "--",
      "eslint",
      "tools/verify-ph03.mjs",
      "tools/verify-ph03-contracts.mjs",
      "tools/verify-ph03-container.mjs",
      "tools/test-math.mjs",
      "tools/smoke.mjs",
      "tools/compose-smoke.mjs",
    ]),
  ],
  [
    "typecheck",
    ...viaNpm(["exec", "--", "pyright", "services/math-engine/src"]),
  ],
  ["build", ...python(["-m", "compileall", "-q", "services/math-engine/src"])],
  [
    "unit_security_worker",
    ...python([
      "-m",
      "unittest",
      "discover",
      "-s",
      "services/math-engine/tests",
      "-v",
    ]),
  ],
  ["draft_golden", ...python(["qa/run_ph03_golden.py"])],
  [
    "internal_schema_http",
    process.execPath,
    ["tools/verify-ph03-contracts.mjs"],
  ],
  ["foundation_smoke", process.execPath, ["tools/smoke.mjs"]],
];
const checks = [];
for (const [name, executable, args] of commands) {
  const started = Date.now();
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONPATH: path.resolve("services/math-engine/src"),
      PYTHONIOENCODING: "utf-8",
    },
  });
  checks.push({
    name,
    command: [
      executable === process.execPath ? "node" : executable,
      ...args,
    ].join(" "),
    exitCode: result.status,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  console.log(name + ": " + (result.status === 0 ? "PASS" : "FAIL"));
  if (result.status !== 0) break;
}
const sourceSha256 = {};
for (const dir of [
  "services/math-engine/src/khotwa_math",
  "services/math-engine/tests",
])
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".py"))) {
    const p = dir + "/" + file;
    sourceSha256[p] = createHash("sha256")
      .update(readFileSync(p))
      .digest("hex");
  }
for (const p of [
  "qa/run_ph03_golden.py",
  "qa/ph03_container_smoke.py",
  "services/math-engine/pyproject.toml",
])
  sourceSha256[p] = createHash("sha256").update(readFileSync(p)).digest("hex");
writeFileSync(
  "qa-reports/ph03-checks.json",
  JSON.stringify(
    {
      phase: "PH-03",
      recordedAtRiyadh: new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Riyadh",
      }),
      node: process.version,
      platform: process.platform,
      checks,
      passed: checks.filter((c) => c.exitCode === 0).length,
      failed: checks.filter((c) => c.exitCode !== 0).length,
      sourceSha256,
      scope:
        "Math engine targeted checks and foundational smoke; not PH-04/05, live DB integration or GATE-1",
      gate1: "not_approved",
    },
    null,
    2,
  ) + "\n",
);
if (checks.some((c) => c.exitCode !== 0)) process.exitCode = 1;
