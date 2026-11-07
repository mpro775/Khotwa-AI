import { readFileSync, writeFileSync } from "node:fs";
import { parse, parseDocument } from "yaml";
const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const str = (maxLength = 2000, minLength = 1) => ({
  type: "string",
  minLength,
  maxLength,
});
const enumeration = (...values) => ({ type: "string", enum: values });
const num = (minimum = 0, maximum = 2147483647) => ({
  type: "integer",
  minimum,
  maximum,
});
const bool = { type: "boolean" },
  id = { type: "string", format: "uuid" },
  time = { type: "string", format: "date-time" };
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const arr = (items, maxItems = 1000) => ({ type: "array", items, maxItems });
const obj = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const env = (data) => obj({ data, meta: ref("Meta") });
const code = {
  type: "string",
  pattern: "^[A-Za-z][A-Za-z0-9_-]*$",
  maxLength: 80,
};
const subject = enumeration("algebra", "physics", "programming");
const schemas = {
  ProductContentHint: obj(
    {
      level: num(1, 4),
      textAr: str(1200),
      source: enumeration("manual", "ai_suggested"),
      reviewed: bool,
      errorCode: nullable(
        enumeration(
          "ERR-ALG-01",
          "ERR-ALG-02",
          "ERR-ALG-03",
          "ERR-ALG-04",
          "ERR-ALG-05",
          "ERR-ALG-06",
        ),
      ),
    },
    ["level", "textAr", "source", "reviewed"],
  ),
  StudioAlgebraContent: obj({
    equationRaw: str(256),
    answerRaw: str(256),
    validStepRaw: str(256),
    invalidStepRaw: str(256),
  }),
  StudioPhysicsContent: obj(
    {
      topic: { const: "kinematics_1d" },
      formula: enumeration(
        "constant_speed_distance",
        "constant_velocity_displacement",
        "average_speed",
        "average_velocity",
        "final_velocity",
        "displacement",
        "acceleration",
        "elapsed_time",
      ),
      quantity: enumeration(
        "distance",
        "displacement",
        "speed",
        "velocity",
        "acceleration",
        "time",
      ),
      expectedDimension: enumeration("length", "time", "speed", "acceleration"),
      expectedValueSI: str(48),
      expectedUnit: enumeration("m", "s", "m/s", "m/s²", "km/h"),
      tolerance: str(48),
      givens: {
        type: "object",
        additionalProperties: str(48),
        maxProperties: 6,
      },
      constraints: obj({ nonNegativeAnswer: bool }),
    },
    [
      "topic",
      "formula",
      "quantity",
      "expectedDimension",
      "expectedValueSI",
      "expectedUnit",
      "tolerance",
      "givens",
    ],
  ),
  ProgrammingTestCase: obj({
    input: str(4096, 0),
    expectedOutput: str(4096, 0),
    hidden: bool,
  }),
  StudioProgrammingContent: obj(
    {
      starterCode: str(12000, 0),
      referenceCode: str(12000),
      tests: { ...arr(ref("ProgrammingTestCase"), 12), minItems: 1 },
      functionName: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]{0,63}$" },
    },
    ["starterCode", "referenceCode", "tests"],
  ),
  StudioContentValidation: obj({
    valid: bool,
    issues: arr(str(2000), 50),
    checkedAt: time,
    engine: str(80),
  }),
  ProductPublicAlgebra: obj({ equationRaw: str(256) }),
  ProductPublicPhysics: obj({
    givens: { type: "object", additionalProperties: str(48) },
    quantity: str(40),
    units: arr(str(16), 5),
  }),
  ProductPublicProgramming: obj(
    {
      starterCode: str(12000, 0),
      publicTests: arr(
        obj({ input: str(4096, 0), expectedOutput: str(4096, 0) }),
        12,
      ),
      functionName: str(64),
    },
    ["starterCode", "publicTests"],
  ),
  ProgrammingSubmitInput: obj(
    {
      problemRevisionId: id,
      sourceRaw: str(12000),
      mode: enumeration("run", "submit"),
      attemptId: id,
      expectedRevision: num(),
    },
    ["problemRevisionId", "sourceRaw", "mode"],
  ),
  ProgrammingResult: obj({
    attemptId: id,
    revision: num(),
    mode: enumeration("run", "submit"),
    status: enumeration(
      "queued",
      "running",
      "succeeded",
      "compile_error",
      "runtime_error",
      "timeout",
      "resource_limit",
      "service_error",
    ),
    stdout: str(65536, 0),
    stderr: str(8192, 0),
    passed: num(0, 12),
    total: num(0, 12),
    allPassed: bool,
    independent: bool,
    createdAt: time,
  }),
  ProgrammingHintInput: obj(
    { level: num(1, 4), confirmFullSolution: bool, expectedRevision: num() },
    ["level", "expectedRevision"],
  ),
  ProgrammingHint: obj({
    attemptId: id,
    revision: num(),
    level: num(1, 4),
    textAr: str(1200),
    source: enumeration("reviewed_template", "llm_validated"),
    reasonAr: str(2000),
  }),
  TutoringPlan: obj({
    judgment: enumeration("error_verified", "no_error", "unknown"),
    interpretation: enumeration("misconception_candidate", "unknown"),
    recommendation: enumeration(
      "try_step",
      "hint_h1",
      "hint_h2",
      "hint_h3",
      "remediation",
    ),
    reasonAr: str(),
    recentVerifiedErrors: num(0, 3),
    previousHintLevel: num(0, 4),
  }),
};
schemas.ProgrammingValidation = obj({
  status: schemas.ProgrammingResult.properties.status,
  passed: num(0, 12),
  total: num(0, 12),
  allPassed: bool,
  public: obj({ passed: num(0, 12), total: num(0, 12) }),
  hidden: obj({ passed: num(0, 12), total: num(0, 12) }),
  cases: arr(
    obj({
      index: num(0, 11),
      visibility: enumeration("public", "hidden"),
      status: schemas.ProgrammingResult.properties.status,
      passed: bool,
      executed: bool,
    }),
    12,
  ),
});
schemas.StudioContentValidation.properties.programming = ref(
  "ProgrammingValidation",
);
schemas.StudioContentPayload = {
  ...obj(
    {
      titleAr: str(160),
      statementAr: str(3000),
      subject,
      unitCode: code,
      unitTitleAr: str(160),
      lessonCode: code,
      lessonTitleAr: str(160),
      skillCodes: { ...arr(code, 8), minItems: 1 },
      difficulty: num(1, 3),
      kind: enumeration("main", "remediation", "transfer"),
      familyCode: code,
      hints: arr(ref("ProductContentHint"), 28),
      algebra: ref("StudioAlgebraContent"),
      physics: ref("StudioPhysicsContent"),
      programming: ref("StudioProgrammingContent"),
    },
    [
      "titleAr",
      "statementAr",
      "subject",
      "unitCode",
      "unitTitleAr",
      "lessonCode",
      "lessonTitleAr",
      "skillCodes",
      "difficulty",
      "kind",
      "familyCode",
      "hints",
    ],
  ),
  oneOf: [
    {
      properties: { subject: { const: "algebra" } },
      required: ["algebra"],
      not: {
        anyOf: [{ required: ["physics"] }, { required: ["programming"] }],
      },
    },
    {
      properties: { subject: { const: "physics" } },
      required: ["physics"],
      not: {
        anyOf: [{ required: ["algebra"] }, { required: ["programming"] }],
      },
    },
    {
      properties: { subject: { const: "programming" } },
      required: ["programming"],
      not: { anyOf: [{ required: ["algebra"] }, { required: ["physics"] }] },
    },
  ],
};
schemas.StudioItem = obj({
  id,
  itemId: id,
  version: num(1),
  editRevision: num(),
  status: enumeration(
    "draft",
    "in_review",
    "approved",
    "published",
    "archived",
  ),
  payload: ref("StudioContentPayload"),
  contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
  validation: nullable(ref("StudioContentValidation")),
  createdAt: time,
  reviewedAt: nullable(time),
  publishedAt: nullable(time),
});
schemas.ProductPublicItem = obj(
  {
    id,
    itemId: id,
    version: num(1),
    subject,
    titleAr: str(160),
    statementAr: str(3000),
    unitCode: code,
    lessonCode: code,
    skillCodes: arr(code, 8),
    difficulty: num(1, 3),
    kind: enumeration("main", "remediation", "transfer"),
    algebra: ref("ProductPublicAlgebra"),
    physics: ref("ProductPublicPhysics"),
    programming: ref("ProductPublicProgramming"),
  },
  [
    "id",
    "itemId",
    "version",
    "subject",
    "titleAr",
    "statementAr",
    "unitCode",
    "lessonCode",
    "skillCodes",
    "difficulty",
    "kind",
  ],
);
schemas.ProductCatalog = obj({
  subjects: arr(
    obj({
      code: subject,
      titleAr: str(160),
      units: arr(
        obj({
          code,
          titleAr: str(160),
          lessons: arr(
            obj({
              code,
              titleAr: str(160),
              items: arr(ref("ProductPublicItem"), 500),
            }),
            100,
          ),
        }),
        100,
      ),
    }),
    3,
  ),
});
schemas.StudioImportInput = obj({
  items: arr(ref("StudioContentPayload"), 100),
});
schemas.StudioImportPreview = obj({
  accepted: num(0, 100),
  rejected: num(0, 100),
  results: arr(
    obj({ index: num(0, 99), valid: bool, issues: arr(str(), 20) }),
    100,
  ),
});
schemas.StudioEditInput = obj({
  expectedRevision: num(),
  payload: ref("StudioContentPayload"),
});
schemas.StudioTransitionInput = obj({
  expectedRevision: num(),
  action: enumeration(
    "submit",
    "approve",
    "publish",
    "archive",
    "revise",
    "rollback",
  ),
});
const envelopeSchemas = {
  StudioItemEnvelope: ref("StudioItem"),
  StudioItemsEnvelope: obj({ items: arr(ref("StudioItem"), 300) }),
  StudioPreviewEnvelope: ref("StudioImportPreview"),
  StudioExportEnvelope: obj({
    format: { const: "khotwa-content-v1" },
    items: arr(ref("StudioContentPayload"), 1000),
    revisionMetadata: arr(
      obj({
        itemIndex: num(0, 999),
        revisionId: id,
        itemId: id,
        version: num(1),
        status: enumeration(
          "draft",
          "in_review",
          "approved",
          "published",
          "archived",
        ),
        contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
      }),
      1000,
    ),
  }),
  ProductCatalogEnvelope: ref("ProductCatalog"),
  ProductPublicItemEnvelope: ref("ProductPublicItem"),
  ProductPublicItemListEnvelope: obj({
    items: arr(ref("ProductPublicItem"), 200),
  }),
  ProductStartEnvelope: obj({
    attemptId: id,
    problemId: id,
    learningSessionId: id,
  }),
  ProgrammingResultEnvelope: ref("ProgrammingResult"),
  ProgrammingHistoryEnvelope: obj({ items: arr(ref("ProgrammingResult"), 50) }),
  ProgrammingAttemptEnvelope: obj({
    problem: ref("ProductPublicItem"),
    result: ref("ProgrammingResult"),
    sourceRaw: str(12000),
    assistanceLevel: num(0, 4),
  }),
  ProgrammingHintEnvelope: ref("ProgrammingHint"),
  TutoringPlanEnvelope: ref("TutoringPlan"),
};
for (const [name, data] of Object.entries(envelopeSchemas))
  schemas[name] = env(data);
const paths = {};
function route(path, method, operationId, response, body, status = 200, roles) {
  const parameters = [];
  if (path.includes("{id}"))
    parameters.push({ name: "id", in: "path", required: true, schema: id });
  if (method !== "get")
    parameters.push(
      { $ref: "#/components/parameters/Csrf" },
      { $ref: "#/components/parameters/Idempotency" },
    );
  const operation = {
    operationId,
    tags: ["تطوير ما بعد الهاكثون"],
    security: [{ GuestCookie: [] }, { AccountCookie: [] }],
    parameters,
    responses: {
      [status]: {
        description:
          "استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل",
        content: { "application/json": { schema: ref(response) } },
      },
    },
  };
  if (body)
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: typeof body === "string" ? ref(body) : body,
        },
      },
    };
  for (const code of [400, 401, 403, 404, 409, 422, 429, 500, 503])
    operation.responses[code] = { $ref: "#/components/responses/E" + code };
  if (roles) operation["x-required-roles"] = roles;
  (paths[path] ??= {})[method] = operation;
}
route(
  "/api/v1/studio/items",
  "get",
  "listStudioItems",
  "StudioItemsEnvelope",
  undefined,
  200,
  ["teacher", "content_manager", "admin"],
);
paths["/api/v1/studio/items"].get.parameters.push(
  ...["subject", "status", "q"].map((name) => ({
    name,
    in: "query",
    schema: str(name === "q" ? 120 : 40, 0),
  })),
);
paths["/api/v1/studio/items"].get.parameters.push(
  { name: "skillCode", in: "query", schema: code },
  { name: "difficulty", in: "query", schema: enumeration("1", "2", "3") },
);
route(
  "/api/v1/studio/items",
  "post",
  "createStudioDraft",
  "StudioItemEnvelope",
  "StudioContentPayload",
  201,
  ["teacher", "content_manager", "admin"],
);
route(
  "/api/v1/studio/items/{id}",
  "get",
  "getStudioRevision",
  "StudioItemEnvelope",
  undefined,
  200,
  ["teacher", "content_manager", "admin"],
);
route(
  "/api/v1/studio/items/{id}",
  "put",
  "editStudioDraft",
  "StudioItemEnvelope",
  "StudioEditInput",
  200,
  ["teacher", "content_manager", "admin"],
);
route(
  "/api/v1/studio/items/{id}",
  "delete",
  "deleteStudioDraft",
  "StudioItemEnvelope",
  obj({ expectedRevision: num() }),
  200,
  ["teacher", "content_manager", "admin"],
);
route(
  "/api/v1/studio/items/{id}/validate",
  "post",
  "validateStudioRevision",
  "StudioItemEnvelope",
  obj({ expectedRevision: num() }),
  201,
  ["teacher", "content_manager", "admin"],
);
route(
  "/api/v1/studio/items/{id}/transition",
  "post",
  "transitionStudioRevision",
  "StudioItemEnvelope",
  "StudioTransitionInput",
  201,
  ["teacher", "content_manager", "admin"],
);
paths["/api/v1/studio/items/{id}/transition"].post.description =
  "submit/revise للمحرر؛ approve/publish/archive/rollback للمشرف. النسخ المنشورة ثابتة، ويستلزم النشر تحقق المحرك ومراجعة المستخدم المخول.";
route(
  "/api/v1/studio/import/preview",
  "post",
  "previewStudioImport",
  "StudioPreviewEnvelope",
  "StudioImportInput",
  201,
  ["teacher", "content_manager", "admin"],
);
route(
  "/api/v1/studio/import",
  "post",
  "importStudioDrafts",
  "StudioItemsEnvelope",
  "StudioImportInput",
  201,
  ["teacher", "content_manager", "admin"],
);
route(
  "/api/v1/studio/export",
  "get",
  "exportStudioContent",
  "StudioExportEnvelope",
  undefined,
  200,
  ["teacher", "content_manager", "admin"],
);
route("/api/v1/catalog", "get", "getProductCatalog", "ProductCatalogEnvelope");
paths["/api/v1/catalog"].get.parameters.push({
  name: "subject",
  in: "query",
  schema: subject,
});
route(
  "/api/v1/catalog/problems/{id}",
  "get",
  "getPublishedProductProblem",
  "ProductPublicItemEnvelope",
);
route(
  "/api/v1/catalog/problems/{id}/start",
  "post",
  "startPublishedStudioAlgebra",
  "ProductStartEnvelope",
  obj({}),
  201,
);
route(
  "/api/v1/programming/problems",
  "get",
  "listProgrammingProblems",
  "ProductPublicItemListEnvelope",
);
route(
  "/api/v1/programming/problems/{id}",
  "get",
  "getProgrammingProblem",
  "ProductPublicItemEnvelope",
);
route(
  "/api/v1/programming/attempts",
  "get",
  "listProgrammingAttempts",
  "ProgrammingHistoryEnvelope",
);
route(
  "/api/v1/programming/attempts/{id}",
  "get",
  "getProgrammingAttempt",
  "ProgrammingAttemptEnvelope",
);
route(
  "/api/v1/programming/attempts",
  "post",
  "submitProgrammingCode",
  "ProgrammingResultEnvelope",
  "ProgrammingSubmitInput",
  201,
);
route(
  "/api/v1/programming/attempts/{id}/hints",
  "post",
  "getProgrammingHint",
  "ProgrammingHintEnvelope",
  "ProgrammingHintInput",
  201,
);
route(
  "/api/v1/attempts/{id}/tutoring-plan",
  "get",
  "getAdaptiveTutoringPlan",
  "TutoringPlanEnvelope",
);
route(
  "/api/v1/attempts/{id}/problem",
  "get",
  "getAttemptPinnedProblem",
  "ProblemEnvelope",
);
const fragment = { paths, components: { schemas } };
writeFileSync(
  "docs/contracts/product-openapi.fragment.json",
  JSON.stringify(fragment, null, 2) + "\n",
);
const file = "docs/12-API-CONTRACT.yaml",
  doc = parseDocument(readFileSync(file, "utf8"));
for (const name of [
  "accounts-openapi.fragment.yaml",
  "physics-openapi.fragment.yaml",
]) {
  const f = parse(readFileSync("docs/contracts/" + name, "utf8"));
  for (const [path, value] of Object.entries(f.paths ?? {})) {
    for (const [method, operation] of Object.entries(value))
      doc.setIn(["paths", path, method], operation);
  }
  for (const [section, values] of Object.entries(f.components ?? {}))
    for (const [name, value] of Object.entries(values))
      doc.setIn(["components", section, name], value);
}
for (const [path, value] of Object.entries(paths))
  for (const [method, operation] of Object.entries(value))
    doc.setIn(["paths", path, method], operation);
for (const [name, value] of Object.entries(schemas))
  doc.setIn(["components", "schemas", name], value);
doc.setIn(["info", "version"], "1.2.0-development");
const suffix =
  "\n\nامتداد تطوير 2026-11-07: الحسابات واستوديو المحتوى والحركة الخطية وPython عبر NestJS، وفق planning/roadmap/EXECUTION.md. وصف P0 أعلاه تاريخي ولا يعني اعتماد تشغيل Beta أو اجتياز الاختبارات المؤجلة. تشغيل الكود خلف Runner معزول، وجميع المراجع والاختبارات المخفية محجوبة عن استجابات الطالب.";
const description = String(doc.getIn(["info", "description"]));
if (!description.includes("امتداد تطوير 2026-11-07"))
  doc.setIn(["info", "description"], description + suffix);
const original = doc.toJS();
for (const [path, methods] of Object.entries(original.paths))
  if (path.startsWith("/api/v1/") && !path.includes("bootstrap"))
    for (const [method, operation] of Object.entries(methods)) {
      if (
        operation?.security?.some((s) => "GuestCookie" in s) &&
        !operation.security.some((s) => "AccountCookie" in s)
      )
        doc.setIn(
          ["paths", path, method, "security"],
          [...operation.security, { AccountCookie: [] }],
        );
    }
writeFileSync(file, doc.toString({ lineWidth: 0 }));
console.log(
  "Merged reviewed implementation contracts for all roadmap modules; no services accessed.",
);
