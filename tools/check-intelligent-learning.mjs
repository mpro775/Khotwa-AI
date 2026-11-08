import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { parse } from "yaml";

const checks = [];
const baseline = "51435ef863745a7145ee0c80927a56817cda7e67";
const previous = parse(
  execFileSync("git", ["show", baseline + ":docs/12-API-CONTRACT.yaml"], {
    encoding: "utf8",
    maxBuffer: 2000000,
  }),
);
const current = parse(readFileSync("docs/12-API-CONTRACT.yaml", "utf8"));
const changed = [];
for (const [path, operation] of Object.entries(previous.paths))
  assert.deepEqual(
    current.paths[path],
    operation,
    "Legacy path drift: " + path,
  );
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
    "AccountExportEnvelope",
    "ErrorDetail",
    "LPAssessmentKind",
    "LPLessonBlock",
  ].sort(),
);
checks.push({
  command: "legacy semantic API comparison against " + baseline,
  exitCode: 0,
  legacyPaths: Object.keys(previous.paths).length,
  changedSchemas: changed,
});
console.log(
  "Legacy paths preserved; four explicit additive schema changes verified.",
);
const npmCli =
  process.env.npm_execpath ??
  "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js";
const commands = [
  ["contracts", ["tools/contracts.mjs", "--check"]],
  ["format", [npmCli, "run", "format:check"]],
  ["lint", [npmCli, "run", "lint"]],
  ["typecheck", [npmCli, "run", "typecheck"]],
  ["build", [npmCli, "run", "build"]],
  [
    "targeted A + V2.2 regressions",
    [
      "--test",
      "apps/api/tests/intelligent-core.test.mjs",
      "apps/api/tests/intelligent-learning-experiences.test.mjs",
      "apps/api/tests/learning-paths.test.mjs",
      "apps/web/tests/intelligent-learning.test.mjs",
      "apps/web/tests/learning-paths.test.mjs",
    ],
  ],
];
try {
  for (const [name, args] of commands) {
    const start = Date.now();
    const result = spawnSync(process.execPath, args, {
      encoding: "utf8",
      maxBuffer: 8000000,
      windowsHide: true,
    });
    checks.push({
      command: process.execPath + " " + args.join(" "),
      label: name,
      exitCode: result.status,
      seconds: (Date.now() - start) / 1000,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    console.log(name + ": " + (result.status === 0 ? "PASS" : "FAIL"));
    if (result.status !== 0) {
      console.log(result.stdout, result.stderr);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  mkdirSync("qa-reports", { recursive: true });
  writeFileSync(
    "qa-reports/A-CHECKS.json",
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
