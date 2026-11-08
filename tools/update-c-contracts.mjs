// Source authoring helper: additive C schemas, retaining existing OpenAPI nodes.
import { readFileSync, writeFileSync } from "node:fs";
import { parseDocument, stringify } from "yaml";
const file = "docs/12-API-CONTRACT.yaml";
const original = readFileSync(file, "utf8")
  .replace(
    / {2}# BEGIN C ADVANCED PATHS[\s\S]*? {2}# END C ADVANCED PATHS\r?\n/g,
    "",
  )
  .replace(
    / {4}# BEGIN C ADVANCED SCHEMAS[\s\S]*? {4}# END C ADVANCED SCHEMAS\r?\n/g,
    "",
  );
const doc = parseDocument(original);
const schemas = {};
const paths = {};
const changedExisting = [
  "LPLessonBlock",
  "LPAuthorLessonBlock",
  "AccountExportEnvelope",
  "AActivityAlternative",
  "ANextActivityDecision",
  "ALearningActivity",
];
const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const str = (maxLength = 2000, minLength = 1) => ({
  type: "string",
  minLength,
  maxLength,
});
const en = (...values) => ({ type: "string", enum: values });
const lit = (value) => ({ type: typeof value, const: value });
const bool = { type: "boolean" };
const integer = { type: "integer", minimum: 0, maximum: 2147483647 };
const index = { type: "integer", minimum: 0, maximum: 49 };
const uuid = { type: "string", format: "uuid" };
const date = { type: "string", format: "date-time" };
const nullable = (value) => ({ anyOf: [value, { type: "null" }] });
const arr = (items, maxItems = 100, minItems = 0) => ({
  type: "array",
  items,
  minItems,
  maxItems,
});
const obj = (properties, optional = []) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties).filter((k) => !optional.includes(k)),
});
const put = (name, schema) => {
  schemas[name] = schema;
  return ref(name);
};
const envelope = (name, data) => put(name, obj({ data, meta: ref("Meta") }));
const skills = { ...arr(str(80), 8, 1), uniqueItems: true };
const subject = en("algebra", "physics", "programming");
put(
  "CRepresentation",
  obj(
    {
      code: str(80),
      kind: en("text", "table", "diagram", "stem_lab", "code"),
      titleAr: str(160),
      accessibleText: str(3000),
      learningObjective: str(500),
      targetSkillCodes: skills,
      sameConstruct: bool,
      assistanceExposure: bool,
      evaluationMode: lit("learning_only"),
      textAr: str(5000),
      altText: str(3000),
      columns: arr(str(160), 8, 1),
      rows: arr(arr(str(200), 8, 1), 40, 1),
      labBlockIndex: index,
      codeText: str(6000),
    },
    ["textAr", "altText", "columns", "rows", "labBlockIndex", "codeText"],
  ),
);
schemas.CRepresentation.allOf = Object.entries({
  text: ["textAr"],
  table: ["columns", "rows"],
  diagram: ["altText"],
  stem_lab: ["labBlockIndex"],
  code: ["codeText"],
}).map(([kind, required]) => ({
  if: { properties: { kind: lit(kind) }, required: ["kind"] },
  then: { required },
  else: { not: { anyOf: required.map((field) => ({ required: [field] })) } },
}));
put(
  "CRepresentationSet",
  obj({
    schemaVersion: lit("udl-representation-v1"),
    learningObjective: str(500),
    targetSkillCodes: skills,
    variants: arr(ref("CRepresentation"), 8, 1),
    responseModes: {
      ...arr(en("text", "choice", "equation", "code_text"), 4, 1),
      uniqueItems: true,
    },
  }),
);
put(
  "CRubricCriterion",
  obj({
    code: str(80),
    titleAr: str(160),
    descriptionAr: str(1000),
    levels: arr(
      obj({ code: str(80), labelAr: str(160), descriptionAr: str(500) }),
      5,
      2,
    ),
  }),
);
put(
  "CPrivateEvaluation",
  obj(
    {
      solutionKey: str(6000),
      privateRubric: arr(
        obj({ criterionCode: str(80), noteAr: str(1000) }),
        10,
      ),
      hints: arr(
        obj({ level: en("H0", "H1", "H2", "H3", "H4"), textAr: str(1600) }),
        5,
      ),
      referenceCode: str(6000),
      hiddenTests: arr(
        obj({ input: str(1000, 0), expectedOutput: str(1000, 0) }),
        10,
      ),
    },
    ["solutionKey", "privateRubric", "hints", "referenceCode", "hiddenTests"],
  ),
);
const activityCommon = {
  schemaVersion: lit("c-activity-v1"),
  subject,
  code: str(80),
  titleAr: str(160),
  objectives: arr(str(500), 8, 1),
  skillCodes: skills,
  prerequisiteSkillCodes: { ...skills, minItems: 0 },
  publicBriefAr: str(3000),
  familyCode: str(80),
  supportPolicy: obj({
    hintsAllowed: bool,
    revealMode: en("after_submit", "teacher_only"),
  }),
  representations: arr(ref("CRepresentation"), 8, 1),
  publicRubric: arr(ref("CRubricCriterion"), 10, 1),
};
const verification = {
  oneOf: [
    obj({ kind: lit("none") }),
    obj({ kind: lit("bank_problem"), problemRevisionId: uuid }),
    obj({ kind: lit("stem_lab"), blockIndex: index }),
  ],
};
const problemSpecific = {
  type: lit("problem_based"),
  scenarioAr: str(5000),
  constraints: arr(str(500), 10),
  stages: {
    ...arr(en("frame", "plan", "investigate", "justify", "reflect"), 5, 5),
    const: ["frame", "plan", "investigate", "justify", "reflect"],
    uniqueItems: true,
  },
  verification,
};
const projectSpecific = {
  type: lit("project_based"),
  projectLevel: en("micro", "multi_lesson"),
  drivingQuestionAr: str(2000),
  milestones: arr(
    obj({
      code: str(80),
      titleAr: str(160),
      descriptionAr: str(1000),
      requiredArtifactKind: en("text", "json"),
      required: bool,
    }),
    12,
    3,
  ),
  lessonRevisionIds: { ...arr(uuid, 20), uniqueItems: true },
};
for (const [name, extra] of [
  ["Problem", problemSpecific],
  ["Project", projectSpecific],
]) {
  put("CPublic" + name + "Activity", obj({ ...activityCommon, ...extra }));
  put(
    "CAuthor" + name + "Activity",
    obj(
      {
        ...activityCommon,
        ...extra,
        privateEvaluation: ref("CPrivateEvaluation"),
      },
      ["privateEvaluation"],
    ),
  );
}
put("CPublicActivity", {
  oneOf: [ref("CPublicProblemActivity"), ref("CPublicProjectActivity")],
});
put("CAuthorActivity", {
  oneOf: [ref("CAuthorProblemActivity"), ref("CAuthorProjectActivity")],
});
for (const name of [
  "AActivityAlternative",
  "ANextActivityDecision",
  "ALearningActivity",
]) {
  const value = doc.getIn(["components", "schemas", name]);
  const schema = value.toJSON?.() ?? value;
  schema.properties.advancedActivity = obj({
    kind: en("problem_based", "project_based"),
    blockIndex: index,
  });
  doc.setIn(["components", "schemas", name], schema);
}
for (const [name, author] of [
  ["LPLessonBlock", false],
  ["LPAuthorLessonBlock", true],
]) {
  const block = doc.getIn(["components", "schemas", name]).toJSON();
  for (const type of [
    "problem_activity",
    "project_activity",
    "representation_set",
  ])
    if (!block.properties.type.enum.includes(type))
      block.properties.type.enum.push(type);
  block.properties.activity = ref(
    author ? "CAuthorActivity" : "CPublicActivity",
  );
  block.properties.representation = ref("CRepresentationSet");
  block.allOf = block.allOf.filter(
    (entry) =>
      !["activity", "representation"].some((k) =>
        entry.then?.required?.includes(k),
      ),
  );
  block.allOf.push(
    {
      if: {
        properties: { type: en("problem_activity", "project_activity") },
        required: ["type"],
      },
      then: { required: ["activity"] },
      else: { not: { required: ["activity"] } },
    },
    {
      if: {
        properties: { type: lit("representation_set") },
        required: ["type"],
      },
      then: { required: ["representation"] },
      else: { not: { required: ["representation"] } },
    },
  );
  doc.setIn(["components", "schemas", name], block);
}
const brief = {
  lessonRevisionId: uuid,
  blockIndex: index,
  activity: ref("CPublicActivity"),
};
put("CActivityBrief", obj(brief));
envelope("CActivityEnvelope", ref("CActivityBrief"));
envelope(
  "CActivityListEnvelope",
  obj({
    items: arr(ref("CActivityBrief"), 500),
    evidenceClass: lit("learning_only"),
  }),
);
put(
  "CProblemSession",
  obj(
    {
      ...brief,
      id: uuid,
      revision: integer,
      trackRevisionId: uuid,
      stage: en("frame", "plan", "investigate", "justify", "reflect"),
      status: en("active", "paused", "abandoned", "completed"),
      answers: obj(
        Object.fromEntries(
          ["frame", "plan", "investigate", "justify", "reflect"].map((v) => [
            v,
            str(3000),
          ]),
        ),
        ["frame", "plan", "investigate", "justify", "reflect"],
      ),
      assistanceLevel: { type: "integer", minimum: 0, maximum: 4 },
      supportAr: nullable(str(6000)),
      result: nullable(ref("StemLabResult")),
      evidenceClass: lit("learning_only"),
      readOnly: bool,
      transfer: obj({
        available: lit(false),
        reasonCode: lit("assessment_service_rechecks_novelty"),
      }),
      supportLinks: arr(
        obj({ kind: en("scaffold", "tutor", "reflection"), id: uuid }),
        8,
      ),
      assessmentId: uuid,
    },
    ["supportLinks", "assessmentId"],
  ),
);
put(
  "CProjectReview",
  obj({
    id: uuid,
    rubricRevisionId: uuid,
    assessedSubmissionRevision: integer,
    reviewerRole: str(80),
    decision: en("revision_requested", "accepted"),
    criteria: arr(
      obj({ criterionCode: str(80), levelCode: str(80), reasonAr: str(1000) }),
      10,
      1,
    ),
    feedbackAr: str(2000),
    reviewedAt: date,
  }),
);
const artifact = {
  oneOf: [str(16000), { type: "object", additionalProperties: true }],
};
put(
  "CProjectSubmission",
  obj({
    id: uuid,
    revision: integer,
    milestoneCode: str(80),
    artifactKind: en("text", "json"),
    artifact,
    isFinal: bool,
    status: en("awaiting_feedback", "revision_requested", "accepted"),
    createdAt: date,
    review: nullable(ref("CProjectReview")),
  }),
);
put(
  "CProjectRun",
  obj(
    {
      ...brief,
      id: uuid,
      revision: integer,
      trackRevisionId: uuid,
      status: en(
        "active",
        "paused",
        "withdrawn",
        "awaiting_feedback",
        "revision_requested",
        "review_pending",
        "feedback_ready",
        "completed",
      ),
      milestones: {
        type: "object",
        additionalProperties: str(3000),
        maxProperties: 12,
      },
      submissions: arr(ref("CProjectSubmission"), 100),
      assistanceLevel: { type: "integer", minimum: 0, maximum: 4 },
      feedbackSeen: bool,
      evidenceClass: lit("learning_only"),
      readOnly: bool,
      assessmentId: uuid,
    },
    ["assessmentId"],
  ),
);
envelope("CProblemSessionEnvelope", ref("CProblemSession"));
envelope("CProjectRunEnvelope", ref("CProjectRun"));
put(
  "CActivityStartInput",
  obj({ trackRevisionId: uuid, lessonRevisionId: uuid, blockIndex: index }),
);
put("CRevisionInput", obj({ expectedRevision: integer }));
put(
  "CProblemStepInput",
  obj(
    {
      expectedRevision: integer,
      stage: en("frame", "plan", "investigate", "justify", "reflect"),
      textAr: str(3000, 0),
      action: en("save", "pause", "resume", "abandon", "hint", "reveal"),
    },
    ["action"],
  ),
);
put(
  "CProblemFeedbackInput",
  obj(
    {
      expectedRevision: integer,
      answer: { type: "object", additionalProperties: true },
      labSessionId: uuid,
    },
    ["answer", "labSessionId"],
  ),
);
put(
  "CProjectMilestoneInput",
  obj({ expectedRevision: integer, textAr: str(3000) }),
);
put(
  "CProjectSubmissionInput",
  obj({
    expectedRevision: integer,
    milestoneCode: str(80),
    artifactKind: en("text", "json"),
    artifact,
    isFinal: bool,
  }),
);
put(
  "CProjectReviewInput",
  obj({
    expectedRevision: integer,
    decision: en("revision_requested", "accepted"),
    criteria: arr(
      obj({ criterionCode: str(80), levelCode: str(80), reasonAr: str(1000) }),
      10,
      1,
    ),
    feedbackAr: str(2000),
  }),
);
put(
  "CProjectStateInput",
  obj({ expectedRevision: integer, action: en("pause", "resume", "withdraw") }),
);
put(
  "CProblemSupportInput",
  obj({
    expectedRevision: integer,
    kind: en("scaffold", "tutor", "reflection"),
  }),
);
envelope(
  "CProblemSupportEnvelope",
  obj({
    session: ref("CProblemSession"),
    support: obj({ kind: en("scaffold", "tutor", "reflection"), id: uuid }),
  }),
);
envelope(
  "CProblemAssessmentEnvelope",
  obj({
    session: ref("CProblemSession"),
    assessment: ref("LPAssessmentSession"),
  }),
);
envelope(
  "CProjectAssessmentEnvelope",
  obj({ session: ref("CProjectRun"), assessment: ref("LPAssessmentSession") }),
);
put(
  "CContentReview",
  obj({
    id: uuid,
    revisionId: uuid,
    reviewerId: uuid,
    reviewerRole: en("admin", "content_manager"),
    scope: en("subject", "pedagogy", "accessibility", "security"),
    contentHash: str(64),
    decision: en("approve", "changes_requested"),
    notesAr: str(2000),
    reviewMode: lit("TEST_ONLY"),
    reviewedAt: date,
  }),
);
put(
  "CContentReviewInput",
  obj({
    expectedRevision: integer,
    scope: en("subject", "pedagogy", "accessibility", "security"),
    decision: en("approve", "changes_requested"),
    notesAr: str(2000),
  }),
);
envelope(
  "CContentReviewListEnvelope",
  obj({ items: arr(ref("CContentReview"), 200) }),
);
envelope(
  "CContentReviewEnvelope",
  obj({
    review: ref("CContentReview"),
    content: ref("LPAuthorLearningContentRevision"),
  }),
);
put(
  "CMetric",
  obj({
    metric: str(100),
    metricVersion: str(100),
    n: integer,
    numerator: integer,
    denominator: integer,
    value: nullable({ type: "number" }),
    status: en("observed", "not_measured", "suppressed"),
    missingReason: nullable(str(200)),
  }),
);
put(
  "CAnalyticsDashboard",
  obj({
    schemaVersion: lit("learning-metrics-v1"),
    metricVersion: lit("c-metrics-1.0"),
    trackRevisionId: uuid,
    generatedAt: date,
    window: obj({
      from: date,
      to: date,
      days: { type: "integer", enum: [7, 14, 30] },
    }),
    synthetic: lit(true),
    metrics: arr(ref("CMetric"), 50),
    activity: obj({
      problemCompleted: integer,
      projectCompleted: integer,
      projectSubmitted: integer,
    }),
    provenance: arr(str(160), 30),
    missingCount: integer,
    notesAr: arr(str(1000), 30),
  }),
);
put(
  "CContentAnalytics",
  obj({
    schemaVersion: lit("learning-metrics-v1"),
    revisionId: uuid,
    synthetic: lit(true),
    status: lit("suppressed"),
    reasonCode: lit("privacy_threshold_pending"),
    metrics: arr({}, 0),
    quality: obj({
      problemActivities: integer,
      projectActivities: integer,
      representationSets: integer,
    }),
    generatedAt: date,
  }),
);
envelope("CAnalyticsDashboardEnvelope", ref("CAnalyticsDashboard"));
envelope("CContentAnalyticsEnvelope", ref("CContentAnalytics"));
envelope("CRepresentationSetEnvelope", ref("CRepresentationSet"));
put(
  "CAdvancedLearningExport",
  obj(
    {
      sessions: arr(
        obj({
          id: uuid,
          kind: en("problem_session", "project_run"),
          revision: integer,
          trackRevisionId: uuid,
          lessonRevisionId: uuid,
          blockIndex: index,
          status: str(80),
          assistanceLevel: integer,
          evidenceClass: lit("learning_only"),
          answers: { type: "object", additionalProperties: str(3000) },
          milestones: { type: "object", additionalProperties: str(3000) },
          updatedAt: date,
        }),
        501,
      ),
      submissions: arr(
        obj({
          id: uuid,
          projectRunId: uuid,
          revision: integer,
          milestoneCode: str(80),
          artifactKind: en("text", "json"),
          artifact,
          isFinal: bool,
          createdAt: date,
        }),
        501,
      ),
      reviews: arr(
        obj({
          submissionId: uuid,
          reviewerRole: en("admin", "content_manager"),
          rubricRevisionId: uuid,
          decision: en("accepted", "revision_requested"),
          criteria: arr(
            obj({
              criterionCode: str(80),
              levelCode: str(80),
              reasonAr: str(1000),
            }),
            10,
            1,
          ),
          feedbackAr: str(2000),
          reviewedAt: date,
        }),
        501,
      ),
      truncated: bool,
    },
    ["reviews"],
  ),
);
const exportNode = doc.getIn([
  "components",
  "schemas",
  "AccountExportEnvelope",
]);
const exportSchema = exportNode.toJSON?.() ?? exportNode;
exportSchema.properties.data.properties.advancedLearning = ref(
  "CAdvancedLearningExport",
);
doc.setIn(["components", "schemas", "AccountExportEnvelope"], exportSchema);
for (const [name, schema] of Object.entries(schemas))
  doc.setIn(["components", "schemas", name], schema);
const query = (name, schema, required = false) => ({
  name,
  in: "query",
  required,
  schema,
});
function route(
  path,
  method,
  operationId,
  output,
  input,
  queries = [],
  status = method === "post" ? "201" : "200",
) {
  const parameters = [
    ...[...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
      name,
      in: "path",
      required: true,
      schema: name === "code" ? str(80) : uuid,
    })),
    ...queries,
  ];
  if (input)
    parameters.push(
      { $ref: "#/components/parameters/Csrf" },
      { $ref: "#/components/parameters/Idempotency" },
    );
  const operation = {
    operationId,
    tags: ["التعلم المتقدم C"],
    description:
      "Synthetic-only C1–C5; feature flags default OFF. Owner/RBAC, Origin/CSRF, revision CAS, scoped idempotency and immutable content apply. C activity completion is learning_only. No external AI/Runner/PhET or human release approval is implied.",
    security: [{ GuestCookie: [] }, { AccountCookie: [] }],
    parameters,
    responses: Object.fromEntries([
      [
        status,
        {
          description: "Private response; TEST_ONLY synthetic data.",
          headers: { "Cache-Control": { schema: lit("no-store") } },
          content: { "application/json": { schema: ref(output) } },
        },
      ],
      ...[400, 401, 403, 404, 409, 422, 429, 500, 503].map((s) => [
        String(s),
        { $ref: "#/components/responses/E" + s },
      ]),
    ]),
  };
  if (input)
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: ref(input) } },
    };
  (paths[path] ??= {})[method] = operation;
}
const track = query("trackRevisionId", uuid, true),
  block = query("blockIndex", index, true);
for (const [kind, singular] of [
  ["problems", "problem"],
  ["projects", "project"],
]) {
  route(
    `/api/v1/learning/${kind}/available`,
    "get",
    `availableC${singular}`,
    "CActivityListEnvelope",
    null,
    [track],
  );
  route(
    `/api/v1/learning/${kind}/{id}`,
    "get",
    `getC${singular}`,
    "CActivityEnvelope",
    null,
    [block],
  );
}
for (const [path, prefix, envelopeName] of [
  ["problem-sessions", "CProblem", "CProblemSessionEnvelope"],
  ["project-runs", "CProject", "CProjectRunEnvelope"],
]) {
  route(
    `/api/v1/learning/${path}`,
    "post",
    `start${prefix}`,
    envelopeName,
    "CActivityStartInput",
  );
  route(`/api/v1/learning/${path}/{id}`, "get", `get${prefix}`, envelopeName);
  route(
    `/api/v1/learning/${path}/{id}/finish`,
    "post",
    `finish${prefix}`,
    envelopeName,
    "CRevisionInput",
  );
}
route(
  "/api/v1/learning/problem-sessions/{id}/steps",
  "post",
  "stepCProblem",
  "CProblemSessionEnvelope",
  "CProblemStepInput",
);
route(
  "/api/v1/learning/problem-sessions/{id}/feedback",
  "post",
  "feedbackCProblem",
  "CProblemSessionEnvelope",
  "CProblemFeedbackInput",
);
route(
  "/api/v1/learning/problem-sessions/{id}/support",
  "post",
  "supportCProblem",
  "CProblemSupportEnvelope",
  "CProblemSupportInput",
);
route(
  "/api/v1/learning/problem-sessions/{id}/assessment",
  "post",
  "assessmentCProblem",
  "CProblemAssessmentEnvelope",
  "CRevisionInput",
);
route(
  "/api/v1/learning/project-runs/{id}/assessment",
  "post",
  "assessmentCProject",
  "CProjectAssessmentEnvelope",
  "CRevisionInput",
);
route(
  "/api/v1/learning/project-runs/{id}/milestones/{code}",
  "post",
  "milestoneCProject",
  "CProjectRunEnvelope",
  "CProjectMilestoneInput",
);
route(
  "/api/v1/learning/project-runs/{id}/submissions",
  "post",
  "submitCProject",
  "CProjectRunEnvelope",
  "CProjectSubmissionInput",
);
route(
  "/api/v1/learning/project-runs/{id}/state",
  "post",
  "stateCProject",
  "CProjectRunEnvelope",
  "CProjectStateInput",
);
route(
  "/api/v1/studio/project-submissions/{id}/feedback",
  "post",
  "reviewCProject",
  "CProjectRunEnvelope",
  "CProjectReviewInput",
);
route(
  "/api/v1/studio/learning-content/{id}/reviews",
  "get",
  "listCContentReviews",
  "CContentReviewListEnvelope",
);
route(
  "/api/v1/studio/learning-content/{id}/reviews",
  "post",
  "reviewCContent",
  "CContentReviewEnvelope",
  "CContentReviewInput",
);
route(
  "/api/v1/learning/analytics/me",
  "get",
  "getCAnalytics",
  "CAnalyticsDashboardEnvelope",
  null,
  [track, query("window", { type: "string", enum: ["7", "14", "30"] })],
);
route(
  "/api/v1/studio/learning-analytics/content",
  "get",
  "getCContentAnalytics",
  "CContentAnalyticsEnvelope",
  null,
  [query("revisionId", uuid, true)],
);
route(
  "/api/v1/learning/analytics/cohort/{id}",
  "get",
  "blockedCCohortAnalytics",
  "CAnalyticsDashboardEnvelope",
);
route(
  "/api/v1/studio/project-runs/{id}",
  "get",
  "inspectCProject",
  "CProjectRunEnvelope",
);
route(
  "/api/v1/learning/representations/{id}",
  "get",
  "getCRepresentations",
  "CRepresentationSetEnvelope",
  null,
  [block],
);
// NestJS workflow POSTs return 200; the existing Studio review endpoint uses 201.
for (const [path, value] of Object.entries(paths))
  if (value.post && !path.endsWith("/reviews")) {
    value.post.responses["200"] = value.post.responses["201"];
    delete value.post.responses["201"];
  }
let output = original.replace(
  / {2}version: 1\.[\d.]+-development/,
  "  version: 1.6.0-development",
);
const indented = (value, count) =>
  stringify(value, { lineWidth: 0 })
    .split("\n")
    .filter((v, i, a) => i < a.length - 1 || v)
    .map((line) => " ".repeat(count) + line)
    .join("\n") + "\n";
for (const name of changedExisting) {
  const schema = doc.getIn(["components", "schemas", name]);
  const content = indented({ [name]: schema.toJSON?.() ?? schema }, 4);
  const matcher = new RegExp(
    "^    " + name + ":[\\s\\S]*?(?=^    [A-Za-z]|^  [A-Za-z]|^\\S)",
    "m",
  );
  if (!matcher.test(output))
    throw new Error("Existing schema missing: " + name);
  output = output.replace(matcher, content);
}
output = output.replace(
  /^components:/m,
  "  # BEGIN C ADVANCED PATHS\n" +
    indented(paths, 2) +
    "  # END C ADVANCED PATHS\ncomponents:",
);
output = output.replace(
  /^ {2}examples:/m,
  "    # BEGIN C ADVANCED SCHEMAS\n" +
    indented(schemas, 4) +
    "    # END C ADVANCED SCHEMAS\n  examples:",
);
writeFileSync(file, output);
console.log("C author/public schemas and additive routes written.");
