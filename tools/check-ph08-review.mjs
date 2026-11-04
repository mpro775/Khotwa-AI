import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
const files = [
  "apps/api/src/gemini-quota.ts",
  "apps/api/src/ph08-generative.ts",
  "tools/prepare-ph08-review.mjs",
  "tools/check-ph08-review.mjs",
  "apps/api/tests/ph08-review-followup.test.mjs",
];
const npm =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const checks = [];
for (const [name, args] of [
  ["lint", ["node_modules/eslint/bin/eslint.js", ...files]],
  ["format", ["node_modules/prettier/bin/prettier.cjs", "--check", ...files]],
  ["typecheck", [npm, "run", "typecheck", "--workspace", "@khotwa/api"]],
  ["build", [npm, "run", "build", "--workspace", "@khotwa/api"]],
  ["prepare-review-pack", ["tools/prepare-ph08-review.mjs"]],
  [
    "targeted-tests",
    [
      "--test",
      "apps/api/tests/ph08-review-followup.test.mjs",
      "apps/api/tests/gemini.test.mjs",
      "apps/api/tests/ph08-generative.test.mjs",
    ],
  ],
]) {
  const start = Date.now(),
    r = spawnSync(process.execPath, args, {
      encoding: "utf8",
      maxBuffer: 3000000,
    });
  checks.push({
    name,
    command: [process.execPath, ...args],
    exitCode: r.status,
    elapsedMs: Date.now() - start,
    stdout: r.stdout,
    stderr: r.stderr,
  });
  console.log(name + ": " + (r.status === 0 ? "PASS" : "FAIL"));
  if (r.status !== 0) break;
}
writeFileSync(
  "qa-reports/ph08-review-followup-checks.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      node: process.version,
      actualGeminiCalls: 0,
      checks,
    },
    null,
    2,
  ) + "\n",
);
if (checks.some((c) => c.exitCode !== 0)) process.exitCode = 1;
