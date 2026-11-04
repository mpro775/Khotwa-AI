import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
const files = [
  "apps/api/src/ai-tutor.ts",
  "apps/api/src/business.ts",
  "apps/api/src/tutoring.ts",
  "apps/api/src/gemini-adapter.ts",
  "apps/api/src/gemini-quota.ts",
  "apps/api/src/ph08-gemini.ts",
  "apps/api/tests/gemini.test.mjs",
  "apps/api/tests/gemini-live.test.mjs",
  "qa/ph08-gemini-container.mjs",
  "tools/verify-ph08-gemini.mjs",
  "tools/check-ph08-gemini.mjs",
];
const npm =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const commands = [
  ["lint", ["node_modules/eslint/bin/eslint.js", ...files]],
  ["format", ["node_modules/prettier/bin/prettier.cjs", "--check", ...files]],
  ["typecheck", [npm, "run", "typecheck", "--workspace", "@khotwa/api"]],
  ["build", [npm, "run", "build", "--workspace", "@khotwa/api"]],
  [
    "targeted-tests",
    [
      "--test",
      "apps/api/tests/gemini.test.mjs",
      "apps/api/tests/tutoring.test.mjs",
      "apps/api/tests/learning.test.mjs",
    ],
  ],
];
const results = [];
for (const [name, args] of commands) {
  const started = Date.now(),
    result = spawnSync(process.execPath, args, {
      encoding: "utf8",
      maxBuffer: 3000000,
    });
  results.push({
    name,
    command: [process.execPath, ...args],
    exitCode: result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  console.log(name + ": " + (result.status === 0 ? "PASS" : "FAIL"));
  if (result.status !== 0) break;
}
writeFileSync(
  "qa-reports/ph08-gemini-checks.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      checks: results,
    },
    null,
    2,
  ) + "\n",
);
if (results.some((r) => r.exitCode !== 0)) process.exitCode = 1;
