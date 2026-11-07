import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const require = createRequire(import.meta.url);
require("reflect-metadata");
const spec = parse(
  readFileSync(
    new URL("../../../docs/12-API-CONTRACT.yaml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
ajv.addFormat("int32", { type: "number", validate: Number.isInteger });
const check = (name, data) =>
  ajv.compile({
    components: spec.components,
    $ref: "#/components/schemas/" + name,
  })(data);
const controllers = [
  require("../dist/accounts.js").AccountsController,
  require("../dist/beta-operations.js").BetaController,
  require("../dist/content-studio.js").ContentStudioController,
  require("../dist/physics.js").PhysicsController,
  require("../dist/programming.js").ProgrammingController,
];
const normalize = (path) => path.replace(/\{[^}]+\}|:[^/]+/g, "{}");
test("all product NestJS operations and actual success codes occur in canonical OpenAPI", () => {
  const methods = { 0: "get", 1: "post", 2: "put", 3: "delete", 4: "patch" };
  for (const Controller of controllers) {
    const base = Reflect.getMetadata("path", Controller);
    for (const name of Object.getOwnPropertyNames(Controller.prototype)) {
      if (name === "constructor") continue;
      const handler = Controller.prototype[name],
        path =
          typeof handler === "function"
            ? Reflect.getMetadata("path", handler)
            : undefined;
      if (path === undefined) continue;
      const method = methods[Reflect.getMetadata("method", handler)];
      const target = "/" + [base, path].filter(Boolean).join("/");
      const key = Object.keys(spec.paths).find(
        (p) => normalize(p) === normalize(target),
      );
      assert.ok(key, `${Controller.name}.${name}: ${target}`);
      const operation = spec.paths[key][method];
      assert.ok(operation, `${method} ${target}`);
      const status =
        Reflect.getMetadata("__httpCode__", handler) ??
        (method === "post" ? 201 : 200);
      assert.ok(
        operation.responses[String(status)],
        `${method} ${target} returns ${status}`,
      );
    }
  }
});
test("every canonical component schema compiles and all referenced definitions resolve", () => {
  for (const name of Object.keys(spec.components.schemas))
    assert.doesNotThrow(
      () =>
        ajv.compile({
          components: spec.components,
          $ref: "#/components/schemas/" + name,
        }),
      name,
    );
});
test("programming responses allow service outage but reject a leaked hidden test field", () => {
  const data = {
    attemptId: "11111111-1111-4111-8111-111111111111",
    revision: 0,
    mode: "submit",
    status: "service_error",
    stdout: "",
    stderr: "الخدمة غير متاحة",
    passed: 0,
    total: 2,
    allPassed: false,
    independent: false,
    createdAt: new Date().toISOString(),
  };
  assert.equal(check("ProgrammingResult", data), true);
  assert.equal(
    check("ProgrammingResult", { ...data, hiddenTests: ["secret"] }),
    false,
  );
});
test("public product contract excludes answer keys and private code tests", () => {
  const p = {
    id: "11111111-1111-4111-8111-111111111111",
    itemId: "22222222-2222-4222-8222-222222222222",
    version: 1,
    subject: "programming",
    titleAr: "طباعة",
    statementAr: "اطبع كلمة",
    unitCode: "python_basics",
    lessonCode: "print",
    skillCodes: ["PY-PRINT"],
    difficulty: 1,
    kind: "main",
    programming: {
      starterCode: "",
      publicTests: [{ input: "", expectedOutput: "Hello" }],
    },
  };
  assert.equal(check("ProductPublicItem", p), true);
  assert.equal(
    check("ProductPublicItem", {
      ...p,
      programming: { ...p.programming, referenceCode: "private" },
    }),
    false,
  );
});
test("hint contracts require revision and bound source code; unknown fields are rejected", () => {
  assert.equal(check("ProgrammingHintInput", { level: 1 }), false);
  assert.equal(
    check("ProgrammingHintInput", { level: 1, expectedRevision: 0 }),
    true,
  );
  const p = {
    problemRevisionId: "11111111-1111-4111-8111-111111111111",
    sourceRaw: "print(1)",
    mode: "submit",
  };
  assert.equal(check("ProgrammingSubmitInput", p), true);
  assert.equal(
    check("ProgrammingSubmitInput", { ...p, sourceRaw: "a".repeat(12001) }),
    false,
  );
  assert.equal(
    check("ProgrammingSubmitInput", { ...p, userId: "someone" }),
    false,
  );
});
test("browser schema artifact contains no new private reference payloads or internal physics wire", () => {
  const client = JSON.parse(
    readFileSync(
      new URL("../../../apps/web/src/api-schemas.json", import.meta.url),
      "utf8",
    ),
  );
  for (const name of [
    "StudioContentPayload",
    "StudioProgrammingContent",
    "StudioPhysicsContent",
    "ProgrammingTestCase",
    "InternalPhysicsRequest",
  ])
    assert.equal(Object.hasOwn(client.components.schemas, name), false);
});
