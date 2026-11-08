import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { parse } from "yaml";
const baseline = "6a4b6cb";
const checks = [],
  directory = "qa-reports/C-ADVANCED-LEARNING";
const npmCli =
  process.env.npm_execpath ??
  "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js";
const previous = parse(
  execFileSync("git", ["show", baseline + ":docs/12-API-CONTRACT.yaml"], {
    encoding: "utf8",
    maxBuffer: 4000000,
  }),
);
const current = parse(readFileSync("docs/12-API-CONTRACT.yaml", "utf8"));
for (const [path, definition] of Object.entries(previous.paths))
  assert.deepEqual(
    current.paths[path],
    definition,
    "legacy path drift " + path,
  );
const changed = [];
for (const [name, definition] of Object.entries(previous.components.schemas)) {
  try {
    assert.deepEqual(current.components.schemas[name], definition);
  } catch {
    changed.push(name);
  }
}
assert.deepEqual(
  changed.sort(),
  [
    "LPLessonBlock",
    "LPAuthorLessonBlock",
    "AccountExportEnvelope",
    "AActivityAlternative",
    "ANextActivityDecision",
    "ALearningActivity",
  ].sort(),
);
checks.push({
  command: "semantic OpenAPI comparison " + baseline,
  exitCode: 0,
  legacyPaths: Object.keys(previous.paths).length,
  changedSchemas: changed,
});
const tests = [
  "apps/api/tests/advanced-learning-analytics.test.mjs",
  "apps/api/tests/advanced-learning-studio.test.mjs",
  "apps/api/tests/advanced-learning-workflows.test.mjs",
  "apps/web/tests/advanced-learning.test.mjs",
  "apps/api/tests/intelligent-core.test.mjs",
  "apps/api/tests/intelligent-learning-experiences.test.mjs",
  "apps/api/tests/learning-paths.test.mjs",
  "apps/web/tests/intelligent-learning.test.mjs",
  "apps/web/tests/learning-paths.test.mjs",
  "apps/api/tests/stem-math-lab.test.mjs",
  "apps/api/tests/stem-models.test.mjs",
  "apps/api/tests/stem-lab-state.test.mjs",
  "apps/api/tests/stem-contracts.test.mjs",
  "apps/web/tests/stem-labs.test.mjs",
  "apps/api/tests/accounts-operations.test.mjs",
  "apps/api/tests/content-programming-review.test.mjs",
  "apps/api/tests/roadmap-contracts.test.mjs",
  "apps/api/tests/roadmap-tutoring-physics.test.mjs",
  "apps/api/tests/studio-pairings.test.mjs",
  "apps/web/tests/editor-model.test.mjs",
  "apps/web/tests/product-experience.test.mjs",
  "apps/api/tests/security.test.mjs",
  "apps/api/tests/math-gateway.test.mjs",
  "apps/api/tests/diagnosis.test.mjs",
  "apps/api/tests/tutoring.test.mjs",
];
const commands = [
  ["contracts", ["tools/contracts.mjs", "--check"]],
  ["format", [npmCli, "run", "format:check"]],
  ["lint", [npmCli, "run", "lint"]],
  ["typecheck", [npmCli, "run", "typecheck"]],
  ["build", [npmCli, "run", "build"]],
  ["C+A+B+V2.2 targeted regressions", ["--test", ...tests]],
];
try {
  for (const [label, args] of commands) {
    const started = Date.now(),
      result = spawnSync(process.execPath, args, {
        encoding: "utf8",
        maxBuffer: 12000000,
        windowsHide: true,
        timeout: 240000,
      });
    checks.push({
      label,
      command: "node " + args.join(" "),
      exitCode: result.status ?? 1,
      seconds: (Date.now() - started) / 1000,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    console.log(label + ": " + (result.status === 0 ? "PASS" : "FAIL"));
    if (result.status !== 0) {
      console.log(result.stdout, result.stderr);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    directory + "/C-TESTS.json",
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        baseline,
        node: process.version,
        platform: process.platform,
        checks,
      },
      null,
      2,
    ) + "\n",
  );
}
