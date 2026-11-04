import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run with npm run verify:ph02");
const commands = [
  [
    "exec",
    "--",
    "prettier",
    "--check",
    "package.json",
    ".github/workflows/ci.yml",
    "tools/verify-ph02.mjs",
    "apps/web/src",
    "apps/web/tests",
    "apps/web/tsconfig.json",
    "apps/web/package.json",
  ],
  ["exec", "--", "eslint", "apps/web", "tools/verify-ph02.mjs"],
  ["run", "typecheck", "--workspace", "@khotwa/web"],
  ["run", "build", "--workspace", "@khotwa/web"],
  ["run", "test:editor"],
];
const checks = [];
for (const args of commands) {
  const result = spawnSync(process.execPath, [npm, ...args], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  checks.push({
    command: "npm " + args.join(" "),
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  console.log(
    checks.at(-1).command + ": " + (result.status === 0 ? "PASS" : "FAIL"),
  );
  if (result.status !== 0) break;
}
const paths = [
  "apps/web/src/ArabicEditor.tsx",
  "apps/web/src/MathLiveProbe.tsx",
  "apps/web/src/FormulaPreview.tsx",
  "apps/web/src/editor-fixtures.ts",
  "apps/web/src/editor-model.ts",
  "apps/web/src/style.css",
  "apps/web/src/main.tsx",
  "apps/web/tests/editor-model.test.mjs",
  "package-lock.json",
];
writeFileSync(
  "qa-reports/ph02-checks.json",
  JSON.stringify(
    {
      phase: "PH-02",
      recordedAtRiyadh: new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Riyadh",
      }),
      node: process.version,
      platform: process.platform,
      checks,
      passed: checks.filter((c) => c.exitCode === 0).length,
      failed: checks.filter((c) => c.exitCode !== 0).length,
      sourceSha256: Object.fromEntries(
        paths.map((p) => [
          p,
          createHash("sha256").update(readFileSync(p)).digest("hex"),
        ]),
      ),
      productMathGoldenCasesRun: 0,
      physicalPhoneTest: "not_run_user_has_no_phone",
      scope:
        "Targeted frontend format/lint/types/build and editor data guards. No parser, math verdicts or PH-03/04. Browser evidence is separate.",
    },
    null,
    2,
  ) + "\n",
);
if (checks.some((c) => c.exitCode !== 0)) process.exitCode = 1;
