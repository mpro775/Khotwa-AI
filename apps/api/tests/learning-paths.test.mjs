import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const require = createRequire(import.meta.url);
const {
  summarizeSkillEvidence,
  recommendLesson,
  temporalLearningExposure,
} = require("../dist/learning-assessments.js");
const {
  parseLearningPayload,
  ALGEBRA_ERROR_SKILLS,
  PENDING_MAPPINGS,
} = require("../dist/learning-path-payload.js");
const {
  LearningPathContentService,
} = require("../dist/learning-path-content.js");
const skillCode = "SK-ALG-04";
const skills = [{ skillCode, titleAr: "توزيع الأقواس" }];
const observation = (problemId, outcome, day, difficulty = 2) => ({
  skillCode,
  problemId,
  difficulty,
  evidenceId: `evidence-${day}`,
  outcome,
  time: new Date(Date.UTC(2026, 10, day)).toISOString(),
});
const summarize = (observations) =>
  summarizeSkillEvidence(observations, skills)[0];
const lesson = (id = "distribution", status = "published") => ({
  id,
  status,
  payload: {
    kind: "lesson",
    subject: "algebra",
    titleAr: "توزيع الأقواس",
    skillCodes: [skillCode],
    mappingPending: [],
  },
});
const map = {
  ruleVersion: "test-skill-map-v1",
  mappingPending: ["GOLD-DIAG-015", "ERR-ALG-05/calculation_divide"],
  skills: [
    {
      skillCode,
      titleAr: "توزيع الأقواس",
      prerequisiteSkillCodes: [],
      lessonRevisionId: "distribution",
    },
  ],
  errors: [],
};

test("only exposure before a verified submission affects that historical independent result", () => {
  const verifiedAt = new Date("2026-11-08T00:00:00Z");
  assert.equal(
    temporalLearningExposure(new Date("2026-11-07T23:00:00Z"), verifiedAt),
    true,
  );
  assert.equal(
    temporalLearningExposure(new Date("2026-11-08T01:00:00Z"), verifiedAt),
    false,
  );
  assert.equal(temporalLearningExposure(undefined, verifiedAt), false);
  assert.equal(temporalLearningExposure("2020-01-01T00:00:00Z"), true);
});

test("one error is tentative; repeated independent errors retain auditable evidence", () => {
  const one = summarize([observation("a", "error", 1)]);
  const repeated = summarize([
    observation("a", "error", 1),
    observation("b", "error", 2),
  ]);
  assert.equal(one.state, "needs_review");
  assert.equal(
    recommendLesson([one], map, [lesson()]).reasonCode,
    "tentative_review",
  );
  const recommendation = recommendLesson([repeated], map, [lesson()]);
  assert.equal(recommendation.reasonCode, "repeated_independent_error");
  assert.equal(recommendation.confidence, "tentative");
  assert.deepEqual(recommendation.evidenceIds, ["evidence-2", "evidence-1"]);
  assert.match(recommendation.reasonAr, /قد تفيدك/);
  assert.deepEqual(recommendation.mappingPending, map.mappingPending);
});

test("repeated steps and retries of one problem cannot supply two independent problems", () => {
  const result = summarize([
    observation("same", "correct", 1),
    observation("same", "correct", 2),
  ]);
  assert.equal(result.independentCorrect, 1);
  assert.equal(result.state, "insufficient_evidence");
  const copied = summarize([
    { ...observation("uuid-a", "correct", 1), contentKey: "same-equation" },
    { ...observation("uuid-b", "correct", 2), contentKey: "same-equation" },
  ]);
  assert.equal(copied.independentCorrect, 1);
  assert.equal(copied.state, "insufficient_evidence");
});

test("support never becomes independent evidence and outages do not become errors", () => {
  const assisted = summarize([
    observation("a", "assisted", 1),
    observation("b", "assisted", 2),
  ]);
  assert.equal(assisted.state, "practicing_with_support");
  assert.equal(assisted.independentCorrect, 0);
  const outage = summarize([observation("a", "unassessable", 1)]);
  assert.equal(outage.independentErrors, 0);
  assert.equal(outage.state, "insufficient_evidence");
  assert.equal(summarize([]).state, "not_assessed");
});

test("two later successes at comparable difficulty can replace a previous review need", () => {
  const recovered = summarize([
    observation("old", "error", 1),
    observation("new-a", "correct", 2),
    observation("new-b", "correct", 3),
  ]);
  assert.equal(recovered.state, "independent_evidence");
  assert.equal(recovered.independentErrors, 1);
  assert.equal(recommendLesson([recovered], map, [lesson()]), null);
  const incomparable = summarize([
    observation("a", "correct", 1, 1),
    observation("b", "correct", 2, 3),
  ]);
  assert.notEqual(incomparable.state, "independent_evidence");
});

test("recommendations exclude unpublished lessons and pending mappings", () => {
  const evidence = summarize([observation("a", "error", 1)]);
  assert.equal(
    recommendLesson([evidence], map, [lesson("distribution", "draft")]),
    null,
  );
  const pending = lesson();
  pending.payload.mappingPending = ["ERR-ALG-05/calculation_divide"];
  assert.equal(recommendLesson([evidence], map, [pending]), null);
});

test("a reviewed prerequisite with negative evidence is offered before its dependent lesson", () => {
  const evidence = summarize([observation("a", "error", 1)]);
  const prerequisite = {
    ...evidence,
    skillCode: "SK-ALG-03",
    titleAr: "العمليات العكسية",
  };
  const connected = structuredClone(map);
  connected.skills[0].prerequisiteSkillCodes = [prerequisite.skillCode];
  connected.skills.push({
    skillCode: prerequisite.skillCode,
    titleAr: prerequisite.titleAr,
    prerequisiteSkillCodes: [],
    lessonRevisionId: "inverse",
  });
  const recommendation = recommendLesson([evidence, prerequisite], connected, [
    lesson(),
    lesson("inverse"),
  ]);
  assert.equal(recommendation.recommendedLessonId, "inverse");
  assert.equal(recommendation.reasonCode, "prerequisite_review");
});

test("lesson parsing rejects invented skills, blocked fractions and another subject's example", () => {
  const payload = {
    kind: "lesson",
    subject: "algebra",
    code: "TEST-LESSON",
    titleAr: "شرح",
    descriptionAr: "مسودة",
    objectives: ["هدف"],
    skillCodes: ["SK-ALG-04"],
    prerequisiteSkillCodes: [],
    prerequisiteLessonIds: [],
    contentBlocks: [
      {
        type: "math_example",
        textAr: "مثال",
        raw: "٢(س + ٣) = ١٠",
        steps: [{ raw: "٢س + ٦ = ١٠", explanationAr: "توزيع" }],
      },
    ],
    practiceProblemRevisionIds: [],
    assessmentProblemRevisionIds: [],
    errorCodes: ["ERR-ALG-01"],
    mappingPending: [],
  };
  assert.equal(parseLearningPayload(payload).kind, "lesson");
  assert.throws(() =>
    parseLearningPayload({ ...payload, skillCodes: ["SK-ALG-99"] }),
  );
  assert.throws(() =>
    parseLearningPayload({ ...payload, skillCodes: ["SK-ALG-08"] }),
  );
  const fraction = structuredClone(payload);
  fraction.contentBlocks[0].raw = "س/٢ = ٣";
  assert.throws(() => parseLearningPayload(fraction));
  assert.throws(() =>
    parseLearningPayload({
      ...payload,
      subject: "programming",
      skillCodes: ["PY-PRINT"],
    }),
  );
  assert.ok(PENDING_MAPPINGS.includes("GOLD-DIAG-015"));
  assert.ok(!ALGEBRA_ERROR_SKILLS["ERR-ALG-05"].includes("SK-ALG-06"));
});

test("lesson validation cannot approve an invalid transformation or unpublished problem link", async () => {
  const service = new LearningPathContentService(
    {},
    {},
    {
      parse: async () => ({
        parseStatus: "parsed",
        normalizedText: "equation",
        displayAr: "معادلة",
        ast: {},
      }),
      verify: async () => ({ status: "verified_invalid" }),
    },
    {},
  );
  service.bank = async () => [];
  const result = await service.validatePayload({
    kind: "lesson",
    subject: "algebra",
    code: "TEST-INVALID",
    titleAr: "شرح",
    descriptionAr: "مسودة",
    objectives: ["هدف"],
    skillCodes: ["SK-ALG-04"],
    prerequisiteSkillCodes: [],
    prerequisiteLessonIds: [],
    contentBlocks: [
      {
        type: "math_example",
        textAr: "مثال",
        raw: "٢(س + ٣) = ١٠",
        steps: [{ raw: "٢س + ٣ = ١٠", explanationAr: "تحويل غير صحيح" }],
      },
    ],
    practiceProblemRevisionIds: ["11111111-1111-4111-8111-111111111111"],
    assessmentProblemRevisionIds: ["22222222-2222-4222-8222-222222222222"],
    errorCodes: [],
    mappingPending: [],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes("غير منشور")));
  assert.ok(result.issues.some((issue) => issue.includes("غير متحقق")));
});

const spec = parse(
  readFileSync(
    new URL("../../../docs/12-API-CONTRACT.yaml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validate = (name, value) =>
  ajv.compile({
    components: spec.components,
    $ref: "#/components/schemas/" + name,
  })(value);

test("assessment requests reject client verdicts, extra owner keys and missing revisions", () => {
  const answer = {
    expectedRevision: 0,
    questionId: "11111111-1111-4111-8111-111111111111",
    steps: ["٢س + ٣ = ١٠"],
  };
  assert.equal(validate("LPAssessmentAnswerInput", answer), true);
  assert.equal(
    validate("LPAssessmentAnswerInput", {
      ...answer,
      mathVerdict: "verified_valid",
    }),
    false,
  );
  assert.equal(
    validate("LPAssessmentAnswerInput", { ...answer, ownerKey: "other" }),
    false,
  );
  delete answer.expectedRevision;
  assert.equal(validate("LPAssessmentAnswerInput", answer), false);
});

test("all V2.2 schemas compile without unresolved references", () => {
  for (const name of Object.keys(spec.components.schemas).filter((name) =>
    name.startsWith("LP"),
  ))
    assert.doesNotThrow(
      () =>
        ajv.compile({
          components: spec.components,
          $ref: "#/components/schemas/" + name,
        }),
      name,
    );
});

test("V2.2 NestJS routes and success codes are documented in canonical OpenAPI", () => {
  const modules = [
    require("../dist/learning-path-content.js"),
    require("../dist/learning-assessments.js"),
  ];
  const methods = { 0: "get", 1: "post", 2: "put", 3: "delete", 4: "patch" };
  const normalize = (path) => path.replace(/\{[^}]+\}|:[^/]+/g, "{}");
  let count = 0;
  for (const module of modules)
    for (const Controller of Object.values(module).filter(
      (value) =>
        typeof value === "function" && value.name.endsWith("Controller"),
    )) {
      const base = Reflect.getMetadata("path", Controller);
      for (const name of Object.getOwnPropertyNames(Controller.prototype)) {
        if (name === "constructor") continue;
        const handler = Controller.prototype[name];
        const path =
          typeof handler === "function"
            ? Reflect.getMetadata("path", handler)
            : undefined;
        if (path === undefined) continue;
        const method = methods[Reflect.getMetadata("method", handler)];
        const target = "/" + [base, path].filter(Boolean).join("/");
        const match = Object.keys(spec.paths).find(
          (key) => normalize(key) === normalize(target),
        );
        assert.ok(match, `${Controller.name}.${name}: ${target}`);
        const operation = spec.paths[match][method];
        assert.ok(operation);
        const status =
          Reflect.getMetadata("__httpCode__", handler) ??
          (method === "post" ? 201 : 200);
        assert.ok(
          operation.responses[String(status)],
          `${method} ${target} returns ${status}`,
        );
        count++;
      }
    }
  assert.ok(count >= 20, "content and assessment routes must both be covered");
});
