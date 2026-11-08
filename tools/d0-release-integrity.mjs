import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = "qa-reports/D0-RELEASE-MANIFEST.json";
const legacyPath = "qa-reports/C-ADVANCED-LEARNING/C-RELEASE-CANDIDATE.json";
const reports = [
  "D0-RELEASE-INTEGRITY.md",
  "D0-BLOCKERS-AND-OWNERS.md",
  "D0-REAL-LEARNING-DESIGN.md",
  "D0-MANUAL-ACCEPTANCE-PLAN.md",
  "D0-FINAL-READINESS.md",
].map((name) => "qa-reports/" + name);
const referenceEvidence = [
  "A-INTELLIGENT-LEARNING-FINAL-ACCEPTANCE.md",
  "A-CHECKS.json",
  "A-LEGACY-REGRESSION.json",
  "A-INTEGRATION.json",
  "B-FINAL-ACCEPTANCE.md",
  "B-FINAL-CHECKS.json",
  "B-INTEGRATION.json",
  "C-ADVANCED-LEARNING/C-FINAL-ACCEPTANCE.md",
  "C-ADVANCED-LEARNING/C-RELEASE-CANDIDATE.json",
  "C-ADVANCED-LEARNING/C-TESTS.json",
  "C-ADVANCED-LEARNING/C-INTEGRATION.json",
  "C-ADVANCED-LEARNING/B-REGRESSION.json",
  "V2.2-CONTENT-INVENTORY.md",
  "V2.2-MURAD-REVIEW-CHECKLIST.md",
  "MAIN-CONSOLIDATION-2026-11-08.md",
].map((name) => "qa-reports/" + name);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (name) => {
  validateInventoryPath(name);
  const absolute = path.join(root, name);
  assert.ok(lstatSync(absolute).isFile(), "regular file required: " + name);
  return readFileSync(absolute);
};
const git = (...args) =>
  execFileSync("git", args, { cwd: root, maxBuffer: 16000000 });
const gitText = (...args) =>
  git(...args)
    .toString("utf8")
    .trim();
const sorted = (values) => [...new Set(values)].sort();

export function validateInventoryPath(name) {
  assert.equal(typeof name, "string");
  assert.ok(name.length > 0 && !name.includes("\\"), "relative POSIX path");
  assert.ok(!path.posix.isAbsolute(name), "absolute path forbidden");
  assert.ok(!name.split("/").some((part) => ["", ".", ".."].includes(part)));
  assert.ok(!/^[A-Za-z]:/.test(name), "drive path forbidden");
  assert.ok(
    !name
      .split("/")
      .some((part) =>
        [".git", ".local", ".venv", "node_modules", "dist"].includes(part),
      ),
    "private/generated directory forbidden",
  );
  assert.ok(!/\.zip$/i.test(name), "archive forbidden");
  assert.ok(
    !name
      .split("/")
      .some((part) => /^\.env(?:\.|$)/.test(part) && part !== ".env.example"),
    "secret environment file forbidden",
  );
  return name;
}

export function snapshot(names, reader = read) {
  return sorted(names).map((name) => {
    validateInventoryPath(name);
    const bytes = reader(name);
    return { path: name, bytes: bytes.length, sha256: sha256(bytes) };
  });
}

export function verifySnapshot(expected, actual) {
  assert.deepEqual(actual, expected, "inventory or file bytes changed");
}

function sourcePaths() {
  return sorted(
    gitText("ls-files", "--cached", "--others", "--exclude-standard", "-z")
      .split("\0")
      .filter(
        (name) =>
          name &&
          !name.startsWith("qa-reports/") &&
          !name.startsWith("agent-reports/"),
      ),
  );
}

function evidencePaths(directory = "qa-reports/D0-evidence") {
  return readdirSync(path.join(root, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const name = directory + "/" + entry.name;
    return entry.isDirectory() ? evidencePaths(name) : [name];
  });
}

function compareLegacy() {
  const legacy = JSON.parse(read(legacyPath));
  return {
    path: legacyPath,
    sha256: sha256(read(legacyPath)),
    baseline: legacy.baseline,
    files: legacy.files.map((entry) => {
      validateInventoryPath(entry.path);
      const bytes = read(entry.path);
      const actualSha256 = sha256(bytes);
      const lfSha256 = sha256(bytes.toString("utf8").replaceAll("\r\n", "\n"));
      const headSha256 = sha256(git("show", "HEAD:" + entry.path));
      return {
        path: entry.path,
        expectedSha256: entry.sha256,
        actualSha256,
        lfSha256,
        headSha256,
        classification:
          actualSha256 === entry.sha256
            ? "EXACT_MATCH"
            : lfSha256 === entry.sha256
              ? "CRLF_ONLY_MATCHES_LEGACY_LF"
              : headSha256 === entry.sha256
                ? "D0_WORKING_TREE_CHANGE_REQUIRES_REVIEW"
                : "UNEXPLAINED_DRIFT",
      };
    }),
    historicalEvidence: legacy.checks.map((entry) => ({
      ...entry,
      actualSha256: sha256(read(entry.path)),
      matches: sha256(read(entry.path)) === entry.sha256,
    })),
  };
}

function dependencyBom() {
  const lock = JSON.parse(read("package-lock.json"));
  return {
    source: "package-lock.json",
    sha256: sha256(read("package-lock.json")),
    lockfileVersion: lock.lockfileVersion,
    kind: "LOCKFILE_INVENTORY_NOT_LICENSE_OR_VULNERABILITY_APPROVAL",
    packages: Object.entries(lock.packages)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([name, pkg]) => ({
        path: name,
        ...(pkg.name ? { name: pkg.name } : {}),
        version: pkg.version ?? null,
        license: pkg.license ?? null,
        integrity: pkg.integrity ?? null,
        link: pkg.link === true,
        dev: pkg.dev === true,
      })),
    pythonRequirements: snapshot([
      "services/math-engine/pyproject.toml",
      "services/math-engine/requirements.lock",
      "services/math-engine/requirements-dev.lock",
    ]),
  };
}

function main() {
  assert.ok(
    process.argv.length === 3 &&
      ["--record", "--check"].includes(process.argv[2]),
    "Usage: node tools/d0-release-integrity.mjs --record|--check",
  );
  const source = snapshot(sourcePaths());
  const evidence = snapshot([
    ...reports,
    ...referenceEvidence,
    ...evidencePaths(),
  ]);
  const head = gitText("rev-parse", "HEAD");
  if (process.argv[2] === "--check") {
    const saved = JSON.parse(read(manifestPath));
    assert.equal(
      saved.baseline.head,
      head,
      "HEAD changed; new review required",
    );
    assert.equal(saved.sourceSha256, sha256(JSON.stringify(source)));
    verifySnapshot(saved.files, source);
    verifySnapshot(saved.evidence, evidence);
    assert.deepEqual(saved.legacyComparison, compareLegacy());
    assert.deepEqual(saved.dependencyBom, dependencyBom());
    console.log(
      JSON.stringify({
        status: "PASS",
        sourceFiles: source.length,
        evidenceFiles: evidence.length,
      }),
    );
    return;
  }
  const legacyComparison = compareLegacy();
  assert.ok(
    legacyComparison.files.every(
      (file) => file.classification !== "UNEXPLAINED_DRIFT",
    ),
    "explain historical drift before recording a candidate",
  );
  assert.ok(
    legacyComparison.historicalEvidence.every((entry) => entry.matches),
  );
  const manifest = {
    schemaVersion: "d0-release-integrity-v1",
    recordedAt: new Date().toISOString(),
    baseline: {
      head,
      tree: gitText("rev-parse", "HEAD^{tree}"),
      branch: gitText("branch", "--show-current"),
      workingTree: gitText(
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      ).split("\n"),
    },
    status: "SOURCE_SNAPSHOT_READY_FOR_OWNER_REVIEW",
    freezeApproval: "PENDING_OWNER_REVIEW_NO_D0_COMMIT",
    realLearnerRelease: "BLOCKED",
    node: process.version,
    platform: process.platform,
    packageManagerDeclared: JSON.parse(read("package.json")).packageManager,
    inventoryRule:
      "git cached + unignored untracked files, excluding qa-reports/ and agent-reports/; exact raw bytes; no secrets, build output or archives; D0 reports/evidence inventoried separately; this manifest excluded to avoid a self reference",
    sourceSha256: sha256(JSON.stringify(source)),
    files: source,
    evidence,
    dependencyBom: dependencyBom(),
    legacyComparison,
  };
  writeFileSync(
    path.join(root, manifestPath),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: "RECORDED_NOT_APPROVED",
      sourceFiles: source.length,
      evidenceFiles: evidence.length,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
