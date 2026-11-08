import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

// The source baseline recorded before C, not a moving current working tree.
const baseline = process.argv[2] ?? "6a4b6cb";
const source = "docs/12-API-CONTRACT.yaml";
const before = parse(
  execFileSync("git", ["show", `${baseline}:${source}`], { encoding: "utf8" }),
);
const after = parse(readFileSync(source, "utf8"));
let paths = 0,
  schemas = 0;
for (const [name, operation] of Object.entries(before.paths)) {
  assert.deepEqual(after.paths[name], operation, name);
  paths++;
}
for (const [name, schema] of Object.entries(before.components.schemas)) {
  const current = structuredClone(after.components.schemas[name]);
  if (name === "AccountExportEnvelope")
    delete current.properties.data.properties.advancedLearning;
  if (
    [
      "AActivityAlternative",
      "ANextActivityDecision",
      "ALearningActivity",
    ].includes(name)
  )
    delete current.properties.advancedActivity;
  if (["LPLessonBlock", "LPAuthorLessonBlock"].includes(name)) {
    current.properties.type.enum = current.properties.type.enum.filter(
      (value) =>
        ![
          "problem_activity",
          "project_activity",
          "representation_set",
        ].includes(value),
    );
    delete current.properties.activity;
    delete current.properties.representation;
    current.allOf = current.allOf.slice(0, schema.allOf.length);
  }
  assert.deepEqual(current, schema, name);
  schemas++;
}
console.log(
  JSON.stringify(
    {
      baseline,
      status: "PASS_TESTED",
      existingPathObjectsPreserved: paths,
      existingSchemasPreservedExceptAuthorizedAdditions: schemas,
      newPaths: Object.keys(after.paths).length - paths,
      newSchemas: Object.keys(after.components.schemas).length - schemas,
    },
    null,
    2,
  ),
);
