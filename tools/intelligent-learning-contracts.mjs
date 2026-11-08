// Additive contract installer. Type shapes are converted from the shared A DTOs;
// canonical public schema remains docs/12-API-CONTRACT.yaml after installation.
import fs from "node:fs";
import ts from "typescript";
import { parse, stringify } from "yaml";

const source = ts.createSourceFile(
  "intelligent-learning.d.ts",
  fs.readFileSync("packages/contracts/src/intelligent-learning.d.ts", "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const schemaName = (name) => (/^A[A-Z]/.test(name) ? name : "A" + name);
const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const str = { type: "string" };
const uuid = { type: "string", format: "uuid" };
const integer = { type: "integer", minimum: 0 };
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
function schema(node) {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return str;
    case ts.SyntaxKind.NumberKeyword:
      return { type: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { type: "boolean" };
    case ts.SyntaxKind.ArrayType:
      return { type: "array", items: schema(node.elementType) };
    case ts.SyntaxKind.UnionType:
      return { anyOf: node.types.map(schema) };
    case ts.SyntaxKind.LiteralType:
      if (node.literal.kind === ts.SyntaxKind.NullKeyword)
        return { type: "null" };
      if (node.literal.kind === ts.SyntaxKind.TrueKeyword)
        return { const: true };
      if (node.literal.kind === ts.SyntaxKind.FalseKeyword)
        return { const: false };
      return {
        const: ts.isNumericLiteral(node.literal)
          ? Number(node.literal.text)
          : node.literal.text,
      };
    case ts.SyntaxKind.TypeLiteral:
      return members(node.members);
    case ts.SyntaxKind.TypeReference: {
      const name = node.typeName.getText(source);
      if (name === "SubjectCode")
        return { type: "string", enum: ["algebra", "physics", "programming"] };
      if (name === "AssessmentSession") return ref("LPAssessmentSession");
      return ref(schemaName(name));
    }
    default:
      throw Error("Unsupported A schema syntax " + ts.SyntaxKind[node.kind]);
  }
}
function members(items) {
  return object(
    Object.fromEntries(
      items.map((m) => [m.name.getText(source), schema(m.type)]),
    ),
    items.filter((m) => !m.questionToken).map((m) => m.name.getText(source)),
  );
}
const schemas = {};
for (const item of source.statements) {
  if (ts.isInterfaceDeclaration(item))
    schemas[schemaName(item.name.text)] = members(item.members);
  if (ts.isTypeAliasDeclaration(item))
    schemas[schemaName(item.name.text)] = schema(item.type);
}
const revision = object({ expectedRevision: integer });
const nullableUuid = { anyOf: [uuid, { type: "null" }] };
const track = {
  name: "trackRevisionId",
  in: "query",
  required: true,
  schema: uuid,
};
const id = { name: "id", in: "path", required: true, schema: uuid };
const envelopes = {};
function envelope(name, data) {
  envelopes[name] = object({ data, meta: ref("Meta") });
  return ref(name);
}
const shape = (name) => ref(schemaName(name));
const paths = {};
function route(path, method, operationId, data, body, params = []) {
  const response = data.$ref?.endsWith("ProbeEnvelope")
    ? data
    : envelope(operationId + "Envelope", data);
  paths["/api/v1/learning/" + path] ??= {};
  paths["/api/v1/learning/" + path][method] = {
    operationId,
    tags: ["التعلم الذكي A"],
    description:
      "Synthetic-only A1–A8. Feature disabled returns 403; reads never reveal hidden answers. Writes require Origin/CSRF, owner-scoped idempotency and current revision. Existing V2.2 routes retain their meaning.",
    security: [{ GuestCookie: [] }, { AccountCookie: [] }],
    parameters: [
      ...params,
      ...(method === "post" ? [refParam("Csrf"), refParam("Idempotency")] : []),
    ],
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: body } },
          },
        }
      : {}),
    responses: {
      [method === "post" ? "201" : "200"]: {
        description: "Owner-scoped safe student response",
        content: { "application/json": { schema: response } },
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 422, 429, 500, 503].map((status) => [
          status,
          { $ref: "#/components/responses/E" + status },
        ]),
      ),
    },
  };
}
function refParam(name) {
  return { $ref: "#/components/parameters/" + name };
}
route(
  "next-activity",
  "get",
  "getANextActivity",
  shape("NextActivityDecision"),
  null,
  [track],
);
route(
  "activities/accept",
  "post",
  "acceptAActivity",
  shape("LearningActivity"),
  object(
    { decisionId: uuid, expectedRevision: integer, alternativeIndex: integer },
    ["decisionId", "expectedRevision"],
  ),
);
route(
  "activities/{id}",
  "get",
  "getAActivity",
  shape("LearningActivity"),
  null,
  [id],
);
route(
  "activities/{id}/start-assessment",
  "post",
  "startAActivityAssessment",
  shape("AStartedActivity"),
  revision,
  [id],
);
route("mastery", "get", "getAMastery", shape("MasteryResponse"), null, [track]);
route(
  "knowledge-graph",
  "get",
  "getAKnowledgeGraph",
  shape("KnowledgeGraph"),
  null,
  [track],
);
route(
  "deep-diagnosis",
  "get",
  "getADeepDiagnosis",
  shape("DeepDiagnosis"),
  null,
  [{ name: "attemptId", in: "query", required: true, schema: uuid }],
);
route(
  "deep-diagnosis/probe",
  "post",
  "offerADeepProbe",
  ref("ProbeEnvelope"),
  object({ attemptId: uuid, expectedRevision: integer }),
);
route(
  "reviews/schedule",
  "post",
  "scheduleAReviews",
  shape("AReviewList"),
  object({ trackRevisionId: uuid }),
);
route("reviews/due", "get", "getADueReviews", shape("AReviewList"), null, [
  track,
]);
route(
  "reviews/{id}/start",
  "post",
  "startAReview",
  object({ review: shape("AReview"), assessment: ref("LPAssessmentSession") }),
  revision,
  [id],
);
route(
  "reviews/{id}/defer",
  "post",
  "deferAReview",
  shape("AReview"),
  object({
    expectedRevision: integer,
    reason: { enum: ["student_choice", "later"] },
    days: { type: "integer", minimum: 1, maximum: 7 },
  }),
  [id],
);
route(
  "reviews/{id}/finish",
  "post",
  "finishAReview",
  shape("AReview"),
  revision,
  [id],
);
route(
  "scaffolds",
  "post",
  "startAScaffold",
  shape("AScaffoldSession"),
  object({ trackRevisionId: uuid, lessonRevisionId: uuid, skillCode: str }),
);
route(
  "scaffolds/{id}",
  "get",
  "getAScaffold",
  shape("AScaffoldSession"),
  null,
  [id],
);
route(
  "scaffolds/{id}/reveal",
  "post",
  "revealAScaffold",
  shape("AScaffoldSession"),
  revision,
  [id],
);
route(
  "scaffolds/{id}/advance",
  "post",
  "advanceAScaffold",
  object({
    scaffold: shape("AScaffoldSession"),
    assessment: { anyOf: [ref("LPAssessmentSession"), { type: "null" }] },
  }),
  object(
    {
      expectedRevision: integer,
      assessmentId: uuid,
      skipExample: { type: "boolean" },
    },
    ["expectedRevision"],
  ),
  [id],
);
route(
  "tutor-sessions",
  "post",
  "startATutor",
  shape("ATutorSession"),
  object(
    {
      trackRevisionId: uuid,
      lessonRevisionId: uuid,
      skillCode: str,
      assessmentId: uuid,
      questionId: uuid,
      expectedAssessmentRevision: integer,
      exitMeasurement: { type: "boolean" },
    },
    ["trackRevisionId", "lessonRevisionId", "skillCode"],
  ),
);
route("tutor-sessions/{id}", "get", "getATutor", shape("ATutorSession"), null, [
  id,
]);
route(
  "tutor-sessions/{id}/reply",
  "post",
  "replyATutor",
  shape("ATutorSession"),
  object(
    {
      expectedRevision: integer,
      textAr: { type: "string", maxLength: 1000 },
      action: {
        enum: [
          "reply",
          "next_hint",
          "try_independent",
          "stop",
          "show_solution",
        ],
      },
      confirmFullSolution: { type: "boolean" },
    },
    ["expectedRevision", "action"],
  ),
  [id],
);
route(
  "goals",
  "get",
  "getAGoals",
  object({ goals: { type: "array", items: shape("AGoal") } }),
  null,
  [track],
);
route(
  "goals",
  "post",
  "createAGoal",
  shape("AGoal"),
  object({
    trackRevisionId: uuid,
    lessonRevisionId: uuid,
    skillCode: str,
    targetIndependentCount: { type: "integer", minimum: 1, maximum: 5 },
    textAr: { type: "string", maxLength: 240 },
  }),
);
route(
  "goals/{id}/checkin",
  "post",
  "checkinAGoal",
  shape("AGoal"),
  object({ expectedRevision: integer, skipped: { type: "boolean" } }),
  [id],
);
route(
  "goals/{id}/update",
  "post",
  "updateAGoal",
  shape("AGoal"),
  object(
    {
      expectedRevision: integer,
      textAr: { type: "string", minLength: 1, maxLength: 240 },
      targetIndependentCount: { type: "integer", minimum: 1, maximum: 5 },
    },
    ["expectedRevision"],
  ),
  [id],
);
route(
  "reflections",
  "post",
  "createAReflection",
  shape("AReflection"),
  object(
    {
      trackRevisionId: uuid,
      activityId: nullableUuid,
      goalId: nullableUuid,
      phase: { enum: ["predict", "monitor", "reflect"] },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
      textAr: { type: "string", maxLength: 1000 },
      skipped: { type: "boolean" },
    },
    ["trackRevisionId", "phase", "skipped"],
  ),
);
route(
  "reflections",
  "get",
  "getAReflections",
  object({ reflections: { type: "array", items: shape("AReflection") } }),
  null,
  [track],
);

const target = "docs/12-API-CONTRACT.yaml";
let canonical = fs.readFileSync(target, "utf8");
canonical = canonical.replace(
  /\n {2}# BEGIN INTELLIGENT A PATHS[\s\S]*? {2}# END INTELLIGENT A PATHS\n/,
  "\n",
);
canonical = canonical.replace(
  /\n {4}# BEGIN INTELLIGENT A SCHEMAS[\s\S]*? {4}# END INTELLIGENT A SCHEMAS\n/,
  "\n",
);
const indent = (value, spaces) =>
  stringify(JSON.parse(JSON.stringify(value)), { lineWidth: 0 })
    .trimEnd()
    .split("\n")
    .map((line) => " ".repeat(spaces) + line)
    .join("\n");
canonical = canonical.replace(
  /^components:/m,
  "  # BEGIN INTELLIGENT A PATHS\n" +
    indent(paths, 2) +
    "\n  # END INTELLIGENT A PATHS\ncomponents:",
);
canonical = canonical.replace(
  /^ {2}schemas:/m,
  "  schemas:\n    # BEGIN INTELLIGENT A SCHEMAS\n" +
    indent({ ...schemas, ...envelopes }, 4) +
    "\n    # END INTELLIGENT A SCHEMAS",
);
canonical = canonical.replace(
  "version: 1.3.0-development",
  "version: 1.4.0-development",
);
canonical = canonical.replace(
  / {12}- physics_example\r?\n(?: {12}- (?:completion_step|worked_example_ref|self_check_prompt)\r?\n)*/,
  "            - physics_example\n            - completion_step\n            - worked_example_ref\n            - self_check_prompt\n",
);
canonical = canonical.replace(
  / {8}- post_remediation\r?\n {8}- practice\r?\n(?: {8}- (?:independent_check|retrieval_review)\r?\n)*/,
  "        - post_remediation\n        - practice\n        - independent_check\n        - retrieval_review\n",
);
const parsed = parse(canonical);
for (const [name, value] of Object.entries(schemas)) {
  if (JSON.stringify(parsed.components.schemas[name]) !== JSON.stringify(value))
    throw Error("A contract installation mismatch " + name);
}
fs.writeFileSync(target, canonical);
fs.writeFileSync(
  "docs/contracts/intelligent-learning-a.fragment.json",
  JSON.stringify({ paths, schemas: { ...schemas, ...envelopes } }, null, 2) +
    "\n",
);
console.log(
  "Installed A1–A8 paths and strict DTO schemas without rewriting legacy sections.",
);
