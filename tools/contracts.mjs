import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const pairs = [
  ["docs/12-API-CONTRACT.yaml", "packages/contracts/openapi.yaml"],
  ...[
    "math-internal-v1.schema.json",
    "golden-fixtures-v1.schema.json",
    "math-internal-v1.examples.json",
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
  "Canonical OpenAPI mirror, 3 JSON mirrors, and generated public types " +
    (check ? "verified." : "generated."),
);
