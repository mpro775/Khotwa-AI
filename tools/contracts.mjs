import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";
import { parse } from "yaml";
import { format } from "prettier";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standalone from "ajv/dist/standalone/index.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const pairs = [
  ["docs/12-API-CONTRACT.yaml", "packages/contracts/openapi.yaml"],
  ...[
    "math-internal-v1.schema.json",
    "golden-fixtures-v1.schema.json",
    "math-internal-v1.examples.json",
    "physics-internal-v1.schema.json",
  ].map((n) => ["docs/contracts/" + n, "packages/contracts/schemas/" + n]),
];
for (const [source, target] of pairs) {
  const content = readFileSync(resolve(root, source));
  const out = resolve(root, target);
  if (check) {
    if (!content.equals(readFileSync(out)))
      throw new Error("Contract mirror drift: " + target);
  } else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, content);
  }
}
const declaration = astToString(
  await openapiTS(
    readFileSync(resolve(root, "docs/12-API-CONTRACT.yaml"), "utf8"),
  ),
);
const target = resolve(
  root,
  "packages/contracts/src/generated/public-api.d.ts",
);
if (check) {
  if (readFileSync(target, "utf8") !== declaration)
    throw new Error("Generated public API types are stale");
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, declaration);
}
console.log(
  "Canonical OpenAPI mirror, 4 JSON mirrors, and generated public types " +
    (check ? "verified." : "generated."),
);
// Browser validators contain public response schemas only: no internal wire,
// Golden fixtures, answer keys or server configuration are bundled.
const schemas = parse(
  readFileSync(resolve(root, "docs/12-API-CONTRACT.yaml"), "utf8"),
).components.schemas;
const pending = [
  "BootstrapEnvelope",
  "GuestEnvelope",
  "GuestCurrentEnvelope",
  "LearningSessionEnvelope",
  "SkillListEnvelope",
  "ProblemListEnvelope",
  "ProblemEnvelope",
  "AttemptEnvelope",
  "StepMutationEnvelope",
  "VerificationEnvelope",
  "VerificationDetailEnvelope",
  "ProbeEnvelope",
  "ProbeAnswerEnvelope",
  "HintEnvelope",
  "EpisodeEnvelope",
  "ProgressEnvelope",
  "SkillProgressEnvelope",
  "TeacherSummaryEnvelope",
  "TeacherExampleEnvelope",
  "AttemptListEnvelope",
  "ErrorEnvelope",
];
const selected = {};
function visit(value) {
  if (!value || typeof value !== "object") return;
  if (
    typeof value.$ref === "string" &&
    value.$ref.startsWith("#/components/schemas/")
  )
    pending.push(value.$ref.slice("#/components/schemas/".length));
  for (const child of Object.values(value)) visit(child);
}
while (pending.length) {
  const name = pending.pop();
  if (selected[name]) continue;
  if (!schemas[name]) throw new Error("Missing client schema");
  selected[name] = schemas[name];
  visit(schemas[name]);
}
const browser = await format(
  JSON.stringify({
    components: {
      schemas: Object.fromEntries(
        Object.entries(selected).sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      ),
    },
  }),
  { parser: "json" },
);
const browserPath = resolve(root, "apps/web/src/api-schemas.json");
if (check) {
  if (readFileSync(browserPath, "utf8") !== browser)
    throw new Error("Browser schema mirror drift");
} else writeFileSync(browserPath, browser);
// Compile validators in Node. Browser CSP stays script-src 'self', with no eval.
const compiler = new Ajv2020({
  strict: false,
  allErrors: false,
  code: { source: true },
  coerceTypes: false,
  removeAdditional: false,
});
addFormats(compiler);
compiler.addSchema({ $id: "khotwa:public", components: { schemas: selected } });
const roots = Object.keys(selected).filter((k) => k.endsWith("Envelope"));
const generated = await format(
  standalone(
    compiler,
    Object.fromEntries(
      roots.map((name) => [name, "khotwa:public#/components/schemas/" + name]),
    ),
  ),
  { parser: "babel" },
);
const generatedPath = resolve(
  root,
  "packages/contracts/src/generated/api-validators.cjs",
);
const typesPath = resolve(
  root,
  "packages/contracts/src/generated/api-validators.d.cts",
);
const types =
  "declare const validators: Record<string, (value: unknown) => boolean>;\nexport = validators;\n";
for (const [p, content] of [
  [generatedPath, generated],
  [typesPath, types],
]) {
  if (check) {
    if (readFileSync(p, "utf8") !== content)
      throw new Error("Browser validator drift");
  } else writeFileSync(p, content);
}
