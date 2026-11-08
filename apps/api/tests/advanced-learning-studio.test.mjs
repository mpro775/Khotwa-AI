import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const require = createRequire(import.meta.url);
const {
  parseCActivity,
  publicCActivity,
  parseRepresentationSet,
} = require("../dist/advanced-learning/activity-payload.js");
const { parseLearningPayload } = require("../dist/learning-path-payload.js");
const {
  learningStudentContentDto,
  assertAdvancedReviewGate,
  LearningPathContentService,
} = require("../dist/learning-path-content.js");
const skill = "SK-ALG-07";
const variant = () => ({
  code: "plain",
  kind: "text",
  titleAr: "النص",
  accessibleText: "قارن عرضين للتسعير مع بيان افتراضاتك.",
  learningObjective: "نمذجة موقف خطي",
  targetSkillCodes: [skill],
  sameConstruct: true,
  assistanceExposure: false,
  evaluationMode: "learning_only",
  textAr: "الأول رسومه ١٢ ثم ٣ لكل وحدة، والثاني رسومه ٦ ثم ٥ لكل وحدة.",
});
const criterion = () => ({
  code: "reasoning",
  titleAr: "تفسير",
  descriptionAr: "اربط نموذجك بالمعطيات.",
  levels: [
    {
      code: "revise",
      labelAr: "يحتاج توضيحًا",
      descriptionAr: "أكمل تفسير النموذج.",
    },
    { code: "clear", labelAr: "واضح", descriptionAr: "تفسير مدعوم بالمعطيات." },
  ],
});
const activity = () => ({
  schemaVersion: "c-activity-v1",
  type: "problem_based",
  subject: "algebra",
  code: "PRICE",
  titleAr: "مقارنة عرضين",
  objectives: ["نمذجة موقف خطي"],
  skillCodes: [skill],
  prerequisiteSkillCodes: [],
  publicBriefAr: "قرر متى تتساوى التكلفة.",
  familyCode: "C-PRICE",
  supportPolicy: { hintsAllowed: true, revealMode: "after_submit" },
  representations: [variant()],
  publicRubric: [criterion()],
  privateEvaluation: {
    solutionKey: "PRIVATE-SOLUTION-٣",
    privateRubric: [{ criterionCode: "reasoning", noteAr: "PRIVATE-RUBRIC" }],
    hints: [{ level: "H2", textAr: "قارن التكلفتين لنفس العدد." }],
  },
  scenarioAr: "تختار أسرة عرضًا حسب عدد الوحدات.",
  constraints: ["عدد الوحدات غير سالب."],
  stages: ["frame", "plan", "investigate", "justify", "reflect"],
  verification: { kind: "none" },
});
const lesson = () => ({
  kind: "lesson",
  subject: "algebra",
  code: "C-LESSON",
  titleAr: "مشكلة واقعية",
  descriptionAr: "TEST_ONLY",
  objectives: ["هدف"],
  skillCodes: [skill],
  prerequisiteSkillCodes: [],
  prerequisiteLessonIds: [],
  contentBlocks: [
    { type: "problem_activity", textAr: "مشكلة", activity: activity() },
  ],
  practiceProblemRevisionIds: [],
  assessmentProblemRevisionIds: [],
  errorCodes: [],
  mappingPending: [],
});
const id = "11111111-1111-4111-8111-111111111111";
const spec = parse(
  readFileSync(
    new URL("../../../docs/12-API-CONTRACT.yaml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const check = (name, data) =>
  ajv.compile({
    components: spec.components,
    $ref: "#/components/schemas/" + name,
  })(data);

test("C author and public views roundtrip with strict, separate private boundaries", () => {
  const authored = parseCActivity(activity(), "algebra"),
    visible = publicCActivity(authored);
  assert.equal(check("CAuthorActivity", authored), true);
  assert.equal(check("CPublicActivity", visible), true);
  assert.equal(check("CPublicActivity", authored), false);
  assert.equal(JSON.stringify(visible).includes("PRIVATE-"), false);
  assert.equal(visible.privateEvaluation, undefined);
  visible.representations[0].textAr = "modified";
  assert.notEqual(authored.representations[0].textAr, "modified");
});
test("learner lesson DTO cannot reveal C solutions or private evaluation hints", () => {
  const payload = parseLearningPayload(lesson());
  const dto = learningStudentContentDto({
    id,
    item_id: id,
    version: 1,
    edit_revision: 0,
    status: "published",
    payload,
    content_hash: "a".repeat(64),
    validation: null,
    created_at: new Date(),
    reviewed_at: new Date(),
    published_at: new Date(),
  });
  assert.equal(JSON.stringify(dto).includes("PRIVATE-"), false);
  assert.equal(
    dto.payload.contentBlocks[0].activity.privateEvaluation,
    undefined,
  );
  assert.equal(
    payload.contentBlocks[0].activity.privateEvaluation.solutionKey,
    "PRIVATE-SOLUTION-٣",
  );
  assert.equal(check("LPLearningContentRevision", dto), true);
});
test("C strict parser rejects injected verdicts, URLs, hidden key fields and unsupported skills", () => {
  for (const override of [
    { verifiedValid: true },
    { publicBriefAr: "<script>alert(1)</script>" },
    { publicBriefAr: "javascript:alert(1)" },
    { scenarioAr: "https://external.invalid/api/private" },
    { skillCodes: ["SK-ALG-08"] },
    { subject: "physics" },
    { stages: ["frame", "plan", "reflect"] },
    { privateEvaluation: { secret: "bypass" } },
    { verification: { kind: "none", privateRubric: "key" } },
  ])
    assert.throws(() =>
      parseCActivity({ ...activity(), ...override }, "algebra"),
    );
});
test("all C references stay inside lesson subject, skill coverage and B lab registry", () => {
  const wrongSkills = lesson();
  wrongSkills.skillCodes = ["SK-ALG-04"];
  assert.throws(() => parseLearningPayload(wrongSkills));
  const wrongLab = lesson();
  wrongLab.contentBlocks[0].activity.verification = {
    kind: "stem_lab",
    blockIndex: 1,
  };
  assert.throws(() => parseLearningPayload(wrongLab));
  const wrongType = lesson();
  wrongType.contentBlocks[0].type = "project_activity";
  assert.throws(() => parseLearningPayload(wrongType));
  const invalidRef = activity();
  invalidRef.verification = {
    kind: "bank_problem",
    problemRevisionId: "another-owner-secret",
  };
  assert.throws(() => parseCActivity(invalidRef, "algebra"));
});
test("UDL requires a full text fallback and preserves construct and objective across variants", () => {
  const set = {
    schemaVersion: "udl-representation-v1",
    learningObjective: "نمذجة موقف خطي",
    targetSkillCodes: [skill],
    variants: [variant()],
    responseModes: ["text", "equation"],
  };
  assert.equal(parseRepresentationSet(set, "algebra").variants.length, 1);
  const visual = {
    ...variant(),
    code: "graph",
    kind: "diagram",
    altText: "وصف للرسم",
  };
  delete visual.textAr;
  assert.throws(() =>
    parseRepresentationSet({ ...set, variants: [visual] }, "algebra"),
  );
  assert.throws(() =>
    parseRepresentationSet(
      {
        ...set,
        variants: [
          variant(),
          { ...variant(), code: "other", learningObjective: "هدف آخر" },
        ],
      },
      "algebra",
    ),
  );
  assert.throws(() =>
    parseRepresentationSet(
      { ...set, responseModes: ["visual_learner"] },
      "algebra",
    ),
  );
  const table = {
    ...variant(),
    code: "table",
    kind: "table",
    columns: ["وحدات", "تكلفة"],
    rows: [["١"]],
  };
  delete table.textAr;
  assert.throws(() =>
    parseRepresentationSet({ ...set, variants: [variant(), table] }, "algebra"),
  );
});
test("project milestones and open rubric preserve review rather than inventing an autonomous grade", () => {
  const p = activity();
  delete p.scenarioAr;
  delete p.constraints;
  delete p.stages;
  delete p.verification;
  Object.assign(p, {
    type: "project_based",
    projectLevel: "micro",
    drivingQuestionAr: "كيف توثق مقارنة التسعير؟",
    lessonRevisionIds: [],
    milestones: ["goal", "model", "present"].map((code) => ({
      code,
      titleAr: "مرحلة",
      descriptionAr: "وصف المنتج",
      requiredArtifactKind: "text",
      required: true,
    })),
  });
  assert.equal(parseCActivity(p, "algebra").publicRubric[0].levels.length, 2);
  assert.throws(() =>
    parseCActivity({ ...p, projectLevel: "cross_subject" }, "algebra"),
  );
  assert.throws(() => parseCActivity({ ...p, publicRubric: [] }, "algebra"));
  assert.throws(() =>
    parseCActivity(
      {
        ...p,
        milestones: p.milestones.map((m) => ({
          ...m,
          requiredArtifactKind: "upload",
        })),
      },
      "algebra",
    ),
  );
  assert.throws(() =>
    parseCActivity(
      { ...p, projectLevel: "multi_lesson", lessonRevisionIds: [id] },
      "algebra",
    ),
  );
});
const review = (scope, extra = {}) => ({
  id,
  revisionId: id,
  reviewerId: "reviewer",
  reviewerRole: "admin",
  scope,
  contentHash: "hash",
  decision: "approve",
  notesAr: "اختبار مصدر اصطناعي",
  reviewMode: "TEST_ONLY",
  reviewedAt: "2026-11-08T08:00:00Z",
  ...extra,
});
test("publishing C requires independent, current-hash approvals for all four scopes", () => {
  const reviews = ["subject", "pedagogy", "accessibility", "security"].map(
    (s) => review(s),
  );
  assert.doesNotThrow(() =>
    assertAdvancedReviewGate("hash", "author", "approver", reviews),
  );
  assert.throws(() =>
    assertAdvancedReviewGate("hash", "author", "author", reviews),
  );
  assert.throws(() =>
    assertAdvancedReviewGate("new-hash", "author", "approver", reviews),
  );
  assert.throws(() =>
    assertAdvancedReviewGate("hash", "author", "approver", reviews.slice(1)),
  );
  assert.throws(() =>
    assertAdvancedReviewGate(
      "hash",
      "author",
      "approver",
      reviews.map((r) => ({ ...r, reviewerId: "author" })),
    ),
  );
});
test("a later change request blocks publish even if an earlier review approved it", () => {
  const reviews = ["subject", "pedagogy", "accessibility", "security"].map(
    (s) => review(s),
  );
  reviews.push(
    review("security", {
      decision: "changes_requested",
      reviewedAt: "2026-11-08T09:00:00Z",
    }),
  );
  assert.throws(() =>
    assertAdvancedReviewGate("hash", "author", "approver", reviews),
  );
});
test("Studio validates C verification references and refuses exposure of independent family", async () => {
  const p = parseLearningPayload(lesson());
  p.contentBlocks[0].activity.verification = {
    kind: "bank_problem",
    problemRevisionId: id,
  };
  p.assessmentProblemRevisionIds = [id];
  const service = new LearningPathContentService({}, {}, {}, {});
  service.bank = async () => [
    {
      revisionId: id,
      familyCode: "C-PRICE",
      skillCodes: [skill],
      primarySkillCode: skill,
    },
  ];
  const result = await service.validatePayload(p);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((v) => v.includes("عائلة القياس")));
});
test("viewing a C lesson records canonical bank exposure before starting any session", async () => {
  const p = lesson();
  p.contentBlocks[0].activity.verification = {
    kind: "bank_problem",
    problemRevisionId: id,
  };
  const writes = [],
    reads = [];
  const tx = {
    $executeRaw: async (parts, ...values) => {
      writes.push({ sql: parts.join("?"), values });
      return 1;
    },
    $queryRaw: async (parts, ...values) => {
      reads.push({ sql: parts.join("?"), values });
      return [
        {
          learning_family: "bank-price-family",
          original_equation_raw: "٣س + ١٢ = ٥س + ٦",
        },
      ];
    },
  };
  const service = new LearningPathContentService(
    { syntheticData: true, db: { $transaction: async (work) => work(tx) } },
    {},
    {},
    {},
  );
  service.row = async () => ({ id, payload: p });
  await service.recordReadExposure(
    { ownerKey: "guest:" + id, guestId: id, guestAuth: {} },
    [id],
  );
  assert.ok(
    reads.some(
      (r) => r.sql.includes("FROM problem_revisions") && r.values.includes(id),
    ),
  );
  assert.ok(
    writes.some(
      (r) =>
        r.sql.includes("INSERT INTO content_exposures") &&
        r.values.includes("bank-price-family"),
    ),
  );
});
test("C authoring feature is closed by default and synthetic-only without modifying legacy lessons", async () => {
  const oldStudio = process.env.C_ADVANCED_STUDIO_ENABLED,
    oldUdl = process.env.C_UDL_CONTENT_ENABLED;
  try {
    delete process.env.C_ADVANCED_STUDIO_ENABLED;
    delete process.env.C_UDL_CONTENT_ENABLED;
    const actor = { userId: id, role: "teacher" };
    const service = new LearningPathContentService(
      { syntheticData: true },
      { actor: async () => actor },
      {},
      {},
    );
    await assert.rejects(service.create({}, lesson()), (e) => e.status === 403);
    process.env.C_ADVANCED_STUDIO_ENABLED = "true";
    process.env.C_UDL_CONTENT_ENABLED = "true";
    service.store.syntheticData = false;
    await assert.rejects(service.create({}, lesson()), (e) => e.status === 403);
  } finally {
    if (oldStudio === undefined) delete process.env.C_ADVANCED_STUDIO_ENABLED;
    else process.env.C_ADVANCED_STUDIO_ENABLED = oldStudio;
    if (oldUdl === undefined) delete process.env.C_UDL_CONTENT_ENABLED;
    else process.env.C_UDL_CONTENT_ENABLED = oldUdl;
  }
});
test("C4 rejects a real author even when global synthetic and real-learning gates are enabled", async () => {
  const names = [
      "C_ADVANCED_STUDIO_ENABLED",
      "C_UDL_CONTENT_ENABLED",
      "REAL_LEARNING_ENABLED",
    ],
    old = names.map((name) => process.env[name]);
  try {
    for (const name of names) process.env[name] = "true";
    const author = {
      ownerKey: "user:" + id,
      userId: id,
      authSessionId: id,
      role: "admin",
    };
    const service = new LearningPathContentService(
      { syntheticData: true },
      {},
      {},
      {},
    );
    let query = "";
    const external = {
      $queryRaw: async (parts) => {
        query = parts.join("?");
        return [];
      },
    };
    await assert.rejects(
      service.requireAdvancedActor(external, author, lesson()),
      (e) => e.status === 403,
    );
    assert.match(query, /u\.is_internal=true/);
    await assert.doesNotReject(
      service.requireAdvancedActor(
        { $queryRaw: async () => [{ id }] },
        author,
        lesson(),
      ),
    );
    await assert.rejects(
      service.requireAdvancedIdentity(external, author, true),
      (e) => e.status === 403,
    );
    await assert.doesNotReject(
      service.requireAdvancedIdentity(
        {},
        { userId: null, guestAuth: {} },
        true,
      ),
    );
    const plain = lesson();
    plain.contentBlocks = [{ type: "paragraph", textAr: "درس عادي" }];
    await assert.doesNotReject(
      service.requireAdvancedActor(external, author, plain),
    );
  } finally {
    names.forEach((name, index) => {
      if (old[index] === undefined) delete process.env[name];
      else process.env[name] = old[index];
    });
  }
});
test("every additive C schema compiles and writes reject forged identity or private fields", () => {
  for (const name of Object.keys(spec.components.schemas).filter((n) =>
    /^C(?:Activity|Author|Public|Representation|Project|Problem|Content|Metric|Analytics|Revision|Advanced)/.test(
      n,
    ),
  ))
    assert.doesNotThrow(() => check(name, {}), name);
  assert.equal(
    check("CProblemStepInput", {
      expectedRevision: 0,
      stage: "frame",
      textAr: "معطيات",
      ownerKey: "foreign",
    }),
    false,
  );
  assert.equal(
    check("CProjectReviewInput", {
      expectedRevision: 0,
      decision: "accepted",
      criteria: [],
      feedbackAr: "جيد",
      reviewerId: "forged",
    }),
    false,
  );
  assert.equal(
    check("CContentReviewInput", {
      expectedRevision: 0,
      scope: "subject",
      decision: "approve",
      notesAr: "اختبار",
      reviewMode: "HUMAN_REVIEW",
    }),
    false,
  );
});
test("browser schema closure has public C data and contains no author evaluation schemas", () => {
  const browser = JSON.parse(
    readFileSync(
      new URL("../../web/src/api-schemas.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(browser.components.schemas.CProblemSessionEnvelope);
  for (const name of Object.keys(browser.components.schemas))
    assert.ok(!/^CAuthor|^CPrivate/.test(name), name);
});
