import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
const sha = (x) => createHash("sha256").update(x).digest("hex");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const git = (args) => execFileSync("git", args, { encoding: "utf8" });
const before = json(".local/ph08-final-before.json");
const allowed = [
  "apps/api/src/gemini-adapter.ts",
  "apps/api/src/gemini-quota.ts",
  "apps/api/src/ph08-gemini.ts",
  "docs/PROJECT-DECISIONS.md",
  "planning/ph08-review-decisions.md",
];
const protectedFiles = Object.entries(before)
  .filter(([p]) => !allowed.includes(p))
  .map(([p, hash]) => ({
    path: p,
    beforeSha256: hash,
    afterSha256: sha(readFileSync(p)),
  }));
const unexpected = protectedFiles.filter(
  (x) => x.beforeSha256 !== x.afterSha256,
);
const files = [
  ...new Set([
    ...git(["diff", "--name-only", "-z"]).split("\0"),
    ...git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"),
  ]),
].filter((p) => p && p !== "qa-reports/ph08-final-integrity.json");
const patterns = [
  /AQ\.[A-Za-z0-9_-]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /kh_guest=[A-Za-z0-9_-]{30,}/,
];
const secretMatches = files.flatMap((p) =>
  patterns.flatMap((re, i) =>
    re.test(readFileSync(p, "utf8")) ? [{ path: p, patternIndex: i }] : [],
  ),
);
const oldPath = ".local/ph08-gemini-first-round.json",
  newPath = ".local/ph08-generative-owner-20261106-live4.json";
const previous = json(oldPath),
  ledger = json(newPath),
  checks = json("qa-reports/ph08-final-checks.json"),
  live = json("qa-reports/ph08-generative-live-4-results.json"),
  fallback = json("qa-reports/ph08-reviewed-fallback-tests.json");
const units = Number(
  checks.checks
    .find((x) => x.name === "targeted-tests")
    .stdout.match(/tests (\d+)/)?.[1],
);
const pack = json("qa-reports/ph08-content-review-pack.json"),
  manifest = json("content/ph08-reviewed-2026-11-06.json");
const { packSha256, ...payload } = pack;
const report = {
  date: "2026-11-06",
  timezone: "Asia/Riyadh",
  branch: git(["branch", "--show-current"]).trim(),
  headCommit: git(["rev-parse", "HEAD"]).trim(),
  newCommitCreated: false,
  protectedFileCount: protectedFiles.length,
  allProtectedFilesUnchanged: unexpected.length === 0,
  unexpectedChanges: unexpected,
  protectedFiles,
  files: files.map((p) => ({ path: p, sha256: sha(readFileSync(p)) })),
  secretPatternMatches: secretMatches,
  oldLedger: {
    sha256: sha(readFileSync(oldPath)),
    reservations: previous.calls.length,
    unchanged: before[oldPath] === sha(readFileSync(oldPath)),
  },
  newRoundLedger: ledger,
  newRoundLedgerSha256: sha(readFileSync(newPath)),
  newRoundClosed: !existsSync(newPath + ".lock"),
  rollingWindowMaximum: Math.max(
    ...ledger.calls.map(
      (t) => ledger.calls.filter((x) => x <= t && t - x < 60000).length,
    ),
  ),
  dailyQuotaKnown: false,
  actualNewRequests: live.requestsSent,
  acceptedNewTexts: live.acceptedNewTexts,
  liveResult: live.status,
  localUnitTests: units,
  integrationTests: fallback.testHarness,
  allCodeChecksPassed:
    checks.checks.length === 5 && checks.checks.every((x) => x.exitCode === 0),
  packPayloadHashMatches: sha(JSON.stringify(payload)) === packSha256,
  sourceHashMatchesApproval:
    sha(readFileSync("apps/api/src/ph08-generative.ts")) ===
    manifest.generationSourceSha256,
  sharedPolicyHashMatchesApproval:
    sha(readFileSync("apps/api/src/tutoring-policy.ts")) ===
    manifest.sharedPolicySha256,
  manifestSha256: sha(readFileSync("content/ph08-reviewed-2026-11-06.json")),
  operationalCardCounts: {
    reviewedPrimary: 21,
    mappingFallbackOnly: 3,
    unpublishedFraction: 3,
  },
  gatesClosed: [],
  ph10Started: false,
  ph11Started: false,
};
if (
  unexpected.length ||
  secretMatches.length ||
  units !== 65 ||
  live.requestsSent !== 4 ||
  ledger.calls.length !== 4 ||
  previous.calls.length !== 10 ||
  !report.packPayloadHashMatches ||
  !report.sourceHashMatchesApproval ||
  !report.sharedPolicyHashMatchesApproval ||
  !report.newRoundClosed ||
  !report.allCodeChecksPassed
)
  throw Error("FINAL_INTEGRITY_FAILURE");
for (const file of [
  "qa-reports/ph08-final-delivery.md",
  "qa-reports/ph08-final-content-acceptance.md",
])
  for (const m of readFileSync(file, "utf8").matchAll(/\]\(([^)]+)\)/g)) {
    const target = path.resolve(path.dirname(file), m[1]);
    if (m[1] !== "ph08-final-integrity.json" && !existsSync(target))
      throw Error("MISSING_REPORT_LINK " + m[1]);
  }
writeFileSync(
  "qa-reports/ph08-final-integrity.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    protectedFiles: report.protectedFileCount,
    protectedUnchanged: report.allProtectedFilesUnchanged,
    secrets: secretMatches.length,
    oldCalls: previous.calls.length,
    newCalls: ledger.calls.length,
    units,
    integrationTests: fallback.testHarness.tests,
    live: live.status,
    accepted: live.acceptedNewTexts,
  }),
);
