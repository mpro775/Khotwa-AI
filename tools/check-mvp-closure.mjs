import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const npm =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const checks = [],
  directory = process.env.PH10_EVIDENCE_DIR ?? "qa-reports/mvp-static";
mkdirSync(directory, { recursive: true });
const units = readdirSync("apps/api/tests")
  .filter((f) => f.endsWith(".test.mjs") && !/live|integration/.test(f))
  .map((f) => "apps/api/tests/" + f);
for (const [name, args] of [
  ...[
    "contracts:check",
    "format:check",
    "lint",
    "typecheck",
    "build",
    "test:editor",
    "test:workspace",
    "test:math",
  ].map((s) => [s, [npm, "run", s]]),
  ["all-api-units", ["--test", ...units]],
  [
    "closure-fixture-lint",
    [
      "node_modules/eslint/bin/eslint.js",
      "qa/ph10-container.mjs",
      "qa/ph10-golden-http.mjs",
      "qa/mvp-local-seed.mjs",
      "qa/ph08-reviewed-content.mjs",
      "apps/api/tests/retention-live.test.mjs",
    ],
  ],
  [
    "closure-fixture-format",
    [
      "node_modules/prettier/bin/prettier.cjs",
      "--check",
      "qa/ph10-container.mjs",
      "qa/ph10-golden-http.mjs",
      "qa/mvp-local-seed.mjs",
      "qa/ph08-reviewed-content.mjs",
      "apps/api/tests/retention-live.test.mjs",
      "compose.mvp.yaml",
    ],
  ],
]) {
  const env = { ...process.env };
  delete env.GEMINI_API_KEY;
  const start = Date.now(),
    r = spawnSync(process.execPath, args, {
      encoding: "utf8",
      maxBuffer: 8000000,
      env,
    });
  writeFileSync(
    path.join(directory, name.replace(":", "-") + ".log"),
    (r.stdout ?? "") + (r.stderr ?? ""),
  );
  checks.push({
    name,
    command: ["node", ...args],
    exitCode: r.status,
    elapsedMs: Date.now() - start,
  });
  console.log(name + ": " + (r.status === 0 ? "PASS" : "FAIL"));
}
writeFileSync(
  path.join(directory, "checks.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      commit: spawnSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).stdout.trim(),
      node: process.version,
      lockfileBytes: readFileSync("package-lock.json").length,
      actualGeminiCalls: 0,
      checks,
    },
    null,
    2,
  ) + "\n",
);
if (checks.some((c) => c.exitCode !== 0)) process.exitCode = 1;
