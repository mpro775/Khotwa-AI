import { readFileSync, writeFileSync } from "node:fs";
import { parseDocument } from "yaml";
const file = "docs/contracts/physics-openapi.fragment.yaml",
  doc = parseDocument(readFileSync(file, "utf8"));
const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const object = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const id = { type: "string", format: "uuid" },
  revision = { type: "integer", minimum: 0, maximum: 2147483647 },
  text = { type: "string", minLength: 1, maxLength: 2000 };
const definitions = {
  PhysicsLearningInput: object({ expectedRevision: revision }),
  PhysicsLearningAssignment: object({
    id,
    phase: { enum: ["remediation", "transfer"] },
    attemptId: id,
    problem: ref("PhysicsProblem"),
    status: { enum: ["assigned", "completed", "invalidated"] },
    independent: { type: "boolean" },
  }),
  PhysicsLearningLoop: object({
    episodeId: { anyOf: [id, { type: "null" }] },
    rootAttemptId: id,
    rootRevision: revision,
    state: {
      enum: [
        "not_started",
        "remediating",
        "awaiting_transfer",
        "finished",
        "cancelled",
      ],
    },
    reasonAr: text,
    assignments: {
      type: "array",
      maxItems: 2,
      items: ref("PhysicsLearningAssignment"),
    },
  }),
  PhysicsLearningEnvelope: object({
    data: ref("PhysicsLearningLoop"),
    meta: ref("Meta"),
  }),
};
for (const [name, value] of Object.entries(definitions))
  doc.setIn(["components", "schemas", name], value);
doc.setIn(["components", "schemas", "PhysicsHint", "properties", "source"], {
  type: "string",
  enum: ["reviewed_template", "llm_validated"],
});
for (const [suffix, method, operationId] of [
  ["learning", "get", "getPhysicsLearningLoop"],
  ["remediation", "post", "startPhysicsRemediation"],
  ["transfer", "post", "startPhysicsTransfer"],
]) {
  const parameters = [{ name: "id", in: "path", required: true, schema: id }];
  if (method === "post")
    parameters.push(
      { $ref: "#/components/parameters/Csrf" },
      { $ref: "#/components/parameters/Idempotency" },
    );
  const operation = {
    operationId,
    tags: ["الفيزياء"],
    security: [{ GuestCookie: [] }, { AccountCookie: [] }],
    parameters,
    responses: {
      200: {
        description:
          "إسنادات فيزياء مملوكة مرتبطة بإصدار الأصل؛ النقل مستقل بلا تلميحات",
        content: {
          "application/json": { schema: ref("PhysicsLearningEnvelope") },
        },
      },
    },
  };
  if (method === "post")
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: ref("PhysicsLearningInput") } },
    };
  for (const code of [400, 401, 403, 404, 409, 422, 429, 500, 503])
    operation.responses[code] = { $ref: "#/components/responses/E" + code };
  doc.setIn(
    ["paths", "/api/v1/physics/attempts/{id}/" + suffix, method],
    operation,
  );
}
writeFileSync(file, doc.toString({ lineWidth: 0 }));
console.log(
  "Physics learning contract fragment updated; no services accessed.",
);
