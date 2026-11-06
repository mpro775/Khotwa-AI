import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const compose = parse(readFileSync("compose.yaml", "utf8"));
assert.equal(compose.networks.backend.internal, true);
for (const name of ["api", "math-engine", "database"])
  assert.equal(compose.services[name].ports, undefined);
assert.deepEqual(compose.services.web.ports, ["127.0.0.1:8080:8080"]);
assert.deepEqual(compose.services["math-engine"].networks, ["backend"]);
assert.equal(compose.services.api.environment.AI_ENABLED, "false");
const source = readFileSync("docs/12-API-CONTRACT.yaml");
assert.ok(source.equals(readFileSync("packages/contracts/openapi.yaml")));
const spec = parse(source.toString("utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat("int32", {
  type: "number",
  validate: (v) => Number.isInteger(v) && v >= -2147483648 && v <= 2147483647,
});
for (const name of [
  "math-internal-v1.schema.json",
  "golden-fixtures-v1.schema.json",
]) {
  const schema = json("packages/contracts/schemas/" + name);
  assert.equal(ajv.validateSchema(schema), true);
}
const golden = json("docs/14-GOLDEN-DATASET.cases.json");
const validate = ajv.compile(
  json("packages/contracts/schemas/golden-fixtures-v1.schema.json"),
);
assert.equal(validate(golden), true, JSON.stringify(validate.errors));
for (const key of [
  "POSTGRES_PASSWORD",
  "MATH_INTERNAL_TOKEN",
  "INTERNAL_HEALTH_TOKEN",
])
  assert.ok(
    readFileSync(".env.example", "utf8")
      .split(/\r?\n/)
      .includes(key + "="),
  );
for (let i = 0; i < 2; i++) {
  const r = spawnSync(
    process.execPath,
    ["tools/python-task.mjs", "tools/seed_demo.py"],
    { encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  if (i === 0)
    globalThis.seedBytes = readFileSync(".local/synthetic-seed.json");
}
assert.ok(
  globalThis.seedBytes.equals(readFileSync(".local/synthetic-seed.json")),
);
const seed = json(".local/synthetic-seed.json");
assert.equal(seed.syntheticOnly, true);
assert.equal(seed.publishedProblems.length, 0);
assert.equal(seed.draftProblems.length, 18);
assert.ok(
  seed.draftProblems.every(
    (p) => p.published === false && p.reviewStatus === "unreviewed",
  ),
);
const ignored = spawnSync(
  "git",
  ["check-ignore", ".local/synthetic-seed.json", ".local/compose.env"],
  { encoding: "utf8" },
);
assert.equal(ignored.status, 0);
const gate = json("planning/gate0-closure.json");
assert.equal(gate.decision, "APPROVED");
assert.equal(gate.approvalBasis, "OWNER_DELEGATED_AGENT_DESIGN_APPROVAL");
assert.equal(gate.directReviewerSignaturesClaimed, false);
const closure = spawnSync(
  process.execPath,
  [
    "tools/python-task.mjs",
    "tools/verify_gate0_evidence.py",
    "--repo",
    ".",
    "--approval-basis",
    "owner-delegated",
    "--owner-delegation",
    "planning/gate0-owner-delegation.json",
    "--manifest",
    "planning/gate0-current-contract-inventory.json",
    "--math-approval",
    "planning/approvals/MATH-SCOPE-OWNER-DELEGATED-APPROVAL.md",
    "--engineering-approval",
    "planning/approvals/ENGINEERING-QA-SECURITY-OWNER-DELEGATED-APPROVAL.md",
    "--out",
    ".local/gate-preflight.json",
  ],
  { encoding: "utf8" },
);
assert.equal(closure.status, 0, closure.stderr + closure.stdout);
let checked = 0;
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (["node_modules", "dist", "generated", "__pycache__"].includes(name))
      continue;
    if (statSync(p).isDirectory()) scan(p);
    else {
      const text = readFileSync(p, "utf8");
      assert.ok(
        !/(?:sk-[A-Za-z0-9]{25,}|ghp_[A-Za-z0-9]{25,})/.test(text),
        "Potential secret in " + p,
      );
      checked++;
    }
  }
}
for (const dir of ["apps", "services", "packages/contracts/src"]) scan(dir);
assert.equal(Object.keys(spec.paths).length, 27);
console.log(
  "Foundation checks passed: private topology, canonical contracts/Golden schema, idempotent unpublished synthetic seed, owner-authorized gate, " +
    checked +
    " source files scanned.",
);
