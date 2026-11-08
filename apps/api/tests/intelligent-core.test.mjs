import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  decideActivity,
  eligibleCandidates,
} = require("../dist/pedagogy-engine.js");
const { projectMastery } = require("../dist/mastery-model.js");
const {
  validateGraph,
  prerequisiteClosure,
  buildKnowledgeGraph,
} = require("../dist/knowledge-graph.js");
const {
  diagnosisProjection,
  diagnosisReviewBlocked,
} = require("../dist/deep-diagnosis.js");
const {
  IntelligentLearningService,
} = require("../dist/intelligent-learning.js");
const {
  LearningAssessmentService,
} = require("../dist/learning-assessments.js");
const skill = { skillCode: "SK-ALG-04", titleAr: "توزيع الأقواس" };
const observation = (id, outcome, extra = {}) => ({
  skillCode: skill.skillCode,
  problemId: id,
  difficulty: 2,
  evidenceId: "evidence-" + id,
  contentKey: id,
  outcome,
  time: "2026-11-08T10:00:00Z",
  verifiedCorrect: outcome === "correct",
  ...extra,
});
const candidate = (activityKind, extra = {}) => ({
  activityKind,
  lessonRevisionId: "lesson",
  skillCode: skill.skillCode,
  reasonCode: "introduction",
  published: true,
  mappingPending: false,
  questionCoverage: 2,
  novel: true,
  reviewed: true,
  subject: "algebra",
  ...extra,
});
const projection = (source, reviews = []) =>
  projectMastery(
    source,
    [skill],
    [],
    reviews,
    new Date("2026-11-08T12:00:00Z"),
  )[0];

test("A1 deterministic priorities and safe eligibility across twelve contexts", () => {
  const cases = [
    { c: [candidate("explanation")], expected: "explanation" },
    { c: [candidate("independent_check", { novel: false })], expected: null },
    { c: [candidate("explanation", { published: false })], expected: null },
    {
      c: [candidate("guided_practice", { mappingPending: true })],
      expected: null,
    },
    { c: [candidate("worked_example", { reviewed: false })], expected: null },
    {
      c: [
        candidate("explanation"),
        candidate("diagnostic_probe", { ambiguousDiagnosis: true }),
      ],
      expected: "diagnostic_probe",
    },
    {
      c: [
        candidate("explanation"),
        candidate("prerequisite_repair", { prerequisiteError: true }),
      ],
      expected: "prerequisite_repair",
    },
    {
      c: [
        candidate("explanation"),
        candidate("retrieval_review", { due: true }),
      ],
      expected: "retrieval_review",
    },
    {
      c: [
        candidate("explanation"),
        candidate("guided_practice", { supportedSuccess: true }),
      ],
      expected: "guided_practice",
    },
    {
      c: [
        candidate("explanation"),
        candidate("independent_check", { independentSuccess: true }),
      ],
      expected: "independent_check",
    },
    {
      c: [candidate("independent_check", { subject: "programming" })],
      expected: null,
    },
    {
      c: [candidate("explanation", { recentlyAccepted: true })],
      expected: null,
    },
  ];
  for (const row of cases) {
    const result = decideActivity(row.c);
    assert.equal(result.chosen?.activityKind ?? null, row.expected);
    assert.deepEqual(result, decideActivity([...row.c].reverse()));
  }
  assert.equal(
    eligibleCandidates([candidate("challenge", { questionCoverage: 0 })])[0]
      .rejection,
    "insufficient_question_coverage",
  );
});
test("A2 exposure and assisted correctness remain separate from independence", () => {
  const viewed = projectMastery([], [skill], [skill.skillCode])[0];
  assert.equal(viewed.dimensions.exposure, "seen");
  assert.equal(viewed.dimensions.independentPerformance, "none");
  const assisted = projection([
    observation("help", "assisted", { verifiedCorrect: true }),
  ]);
  assert.equal(assisted.dimensions.supportedPractice, "observed");
  assert.equal(assisted.counts.eligibleIndependent, 0);
  const assistedError = projection([
    observation("help", "assisted", { verifiedCorrect: false }),
  ]);
  assert.equal(assistedError.dimensions.supportedPractice, "none");
});
test("A2 distinct comparable current evidence, transfer and technical abstention", () => {
  const independent = projection([
    observation("one", "correct"),
    observation("two", "correct"),
    observation("technical", "unassessable"),
  ]);
  assert.equal(
    independent.dimensions.independentPerformance,
    "consistent_evidence",
  );
  assert.equal(independent.dimensions.retention, "not_due");
  assert.equal(independent.dimensions.transfer, "not_tested");
  assert.equal(
    projection([observation("same", "correct"), observation("same", "correct")])
      .dimensions.independentPerformance,
    "limited_evidence",
  );
  assert.equal(
    projection([
      observation("one", "correct"),
      observation("two", "correct", { difficulty: 3 }),
    ]).dimensions.independentPerformance,
    "limited_evidence",
  );
  assert.equal(
    projection([
      observation("transfer", "correct", {
        kind: "independent_check",
        transferEligible: true,
      }),
    ]).dimensions.transfer,
    "evidence",
  );
  assert.equal(
    projection([observation("technical", "unassessable")]).counts
      .independentErrors,
    0,
  );
});
test("A2 retention requires canonical evidence after a spaced anchor, not an overdue clock", () => {
  const source = [observation("later", "correct")],
    review = {
      skillCode: skill.skillCode,
      dueAt: "2026-11-08T09:00:00Z",
      state: "scheduled",
    };
  assert.equal(projection(source, [review]).dimensions.retention, "due");
  assert.equal(
    projection(source, [
      {
        ...review,
        state: "completed",
        evidenceId: "made-up",
        independent: true,
        outcome: "correct",
        verifiedAt: "2026-11-08T10:00:00Z",
        sourceVerifiedAt: "2026-11-07T10:00:00Z",
      },
    ]).dimensions.retention,
    "not_due",
  );
  assert.equal(
    projection(source, [
      {
        ...review,
        state: "completed",
        evidenceId: "evidence-later",
        independent: true,
        outcome: "correct",
        verifiedAt: "2026-11-08T10:00:00Z",
        sourceVerifiedAt: "2026-11-07T10:00:00Z",
      },
    ]).dimensions.retention,
    "observed_retained",
  );
});
test("A3 candidates remain possible and technical states never acquire a misconception", () => {
  const base = {
    attemptId: "a",
    attemptRevision: 1,
    status: "verified_invalid",
    evidenceId: "e",
    causes: [
      { errorCode: "ERR-ALG-01", skills: [skill.skillCode] },
      { errorCode: "ERR-ALG-06", skills: [skill.skillCode] },
    ],
    templateReviewed: true,
  };
  const possible = diagnosisProjection(base);
  assert.equal(
    diagnosisProjection({ ...base, templateReviewed: false }).nextIntervention,
    "no_safe_probe",
  );
  assert.equal(possible.candidateCauses.length, 2);
  assert.ok(
    possible.candidateCauses.every((c) => c.confidenceLabel === "possible"),
  );
  for (const status of [
    "unsupported",
    "syntax_error",
    "service_error",
    "inconclusive",
    "verified_valid",
  ]) {
    const result = diagnosisProjection({ ...base, status });
    assert.equal(result.state, "technical_abstain");
    assert.deepEqual(result.candidateCauses, []);
  }
  const blocked = diagnosisProjection({ ...base, mappingPending: true });
  assert.equal(blocked.state, "review_blocked");
  assert.equal(blocked.nextIntervention, "no_safe_probe");
  const physics = diagnosisProjection({
    ...base,
    causes: [],
    templateReviewed: false,
  });
  assert.equal(physics.nextIntervention, "no_safe_probe");
});
test("A3 answered probe can support a candidate only with the canonical supported result", () => {
  const base = {
    attemptId: "a",
    attemptRevision: 1,
    status: "verified_invalid",
    evidenceId: "e",
    causes: [
      { errorCode: "ERR-ALG-01", skills: [skill.skillCode], supported: true },
    ],
    templateReviewed: true,
  };
  assert.equal(
    diagnosisProjection(base).candidateCauses[0].confidenceLabel,
    "possible",
  );
  assert.equal(
    diagnosisProjection({ ...base, answered: true }).candidateCauses[0]
      .confidenceLabel,
    "supported",
  );
  assert.equal(
    diagnosisProjection({
      ...base,
      answered: true,
      causes: base.causes.map((c) => ({ ...c, supported: false })),
    }).candidateCauses[0].confidenceLabel,
    "unresolved",
  );
  assert.equal(
    diagnosisReviewBlocked("ERR-ALG-05", "calculation_divide"),
    true,
  );
  assert.equal(diagnosisReviewBlocked("ERR-ALG-03", "balance"), true);
  assert.equal(diagnosisReviewBlocked("ERR-ALG-01", "distribution"), false);
});
test("A4 required cycles are named, helpful and pending edges never create gates", () => {
  const nodes = [{ skillCode: "A" }, { skillCode: "B" }],
    edge = (fromSkill, toSkill, extra = {}) => ({
      fromSkill,
      toSkill,
      relationKind: "required",
      reviewState: "reviewed",
      rationaleAr: "تجريبي",
      ...extra,
    });
  assert.match(
    validateGraph(nodes, [edge("A", "B"), edge("B", "A")])[0],
    /cycle:A->B->A/,
  );
  assert.deepEqual(
    validateGraph(nodes, [
      edge("A", "B"),
      edge("B", "A", { relationKind: "helpful" }),
    ]),
    [],
  );
  assert.deepEqual(
    prerequisiteClosure(
      "A",
      { nodes, edges: [edge("A", "B", { reviewState: "pending" })] },
      2,
    ),
    [],
  );
  assert.equal(
    prerequisiteClosure("A", { nodes, edges: [edge("A", "B")] }, 1)[0].depth,
    1,
  );
});
test("A4 missing primary coverage stays explicit and graph snapshots are immutable values", () => {
  const map = {
      skills: [
        { ...skill, prerequisiteSkillCodes: [], lessonRevisionId: null },
      ],
      mappingPending: [],
      errors: [],
      ruleVersion: "test",
    },
    lesson = {
      id: "secondary",
      status: "published",
      contentHash: "first",
      payload: {
        kind: "lesson",
        skillCodes: ["SK-ALG-05", skill.skillCode],
        prerequisiteSkillCodes: [],
        mappingPending: [],
      },
    };
  const old = buildKnowledgeGraph("track", "algebra", map, [lesson]);
  assert.equal(old.nodes[0].reviewState, "missing_coverage");
  assert.equal(old.nodes[0].lessonRevisionId, null);
  const next = buildKnowledgeGraph("track", "algebra", map, [
    { ...lesson, contentHash: "second" },
  ]);
  assert.notEqual(old.mappingSnapshotHash, next.mappingSnapshotHash);
  assert.equal(old.nodes[0].lessonRevisionId, null);
});

test("A-SEC-01 A1 activity reads are owner scoped even when an ID is known", async () => {
  process.env.PEDAGOGY_ENGINE_ENABLED = "true";
  const id = "11111111-1111-4111-8111-111111111111",
    queryOwners = [];
  const tx = {
    $queryRaw: async (_strings, ...values) => {
      queryOwners.push(values);
      return [];
    },
  };
  const owner = {
    ownerKey: "guest:b",
    userId: null,
    guestId: "b",
    role: "guest",
    guestAuth: {},
  };
  const store = {
    syntheticData: true,
    authenticate: async () => ({}),
    authorizeInTransaction: async () => {},
    db: { $transaction: async (work) => work(tx) },
  };
  const service = new IntelligentLearningService(
    store,
    { actor: async () => owner },
    {},
    {},
  );
  await assert.rejects(
    () => service.getActivity({ headers: {} }, id),
    (error) => error.status === 404 || error.statusCode === 404,
  );
  assert.ok(
    queryOwners.some(
      (values) => values.includes("guest:b") && values.includes(id),
    ),
  );
  delete process.env.PEDAGOGY_ENGINE_ENABLED;
});
test("A-SEC-03 exitMeasurement marks canonical attempt as assisted before any tutor reveal", async () => {
  const statements = [],
    item = {
      id: "22222222-2222-4222-8222-222222222222",
      attempt_id: "33333333-3333-4333-8333-333333333333",
    },
    session = "11111111-1111-4111-8111-111111111111";
  const tx = {
    $executeRaw: async (strings) => {
      statements.push(strings.join("?"));
      return 1;
    },
    $queryRaw: async (strings) => {
      const sql = (strings.strings ?? strings).join("?");
      if (sql.includes("product_mutations")) return [];
      if (sql.includes("learning_assessment_items")) return [item];
      if (sql.includes("learning_assessments"))
        return [{ id: session, revision: 0 }];
      return [];
    },
  };
  const owner = {
    ownerKey: "guest:test",
    userId: null,
    guestId: "test",
    role: "guest",
    guestAuth: {},
  };
  const store = {
    syntheticData: true,
    authenticate: async () => ({}),
    authorizeInTransaction: async () => {},
    readAttemptInTransaction: async () => ({ id: item.attempt_id }),
    security: { keyDigest: (x) => x, fingerprint: () => "fingerprint" },
    db: { $transaction: async (work) => work(tx) },
  };
  const service = new LearningAssessmentService(
    store,
    { actor: async () => owner, authorizeInTransaction: async () => {} },
    {},
    {},
    {},
    {},
  );
  service.get = async () => ({ id: session });
  await service.exitMeasurement(
    { headers: { "idempotency-key": "test-key-long-enough-123456" } },
    session,
    { expectedRevision: 0, questionId: item.id },
  );
  assert.ok(
    statements.some(
      (s) =>
        s.includes("independent_evidence_eligible=false") &&
        s.includes("assistance_revision=assistance_revision+1"),
    ),
  );
  assert.ok(
    statements.some((s) => s.includes("measurement_exited_at=COALESCE")),
  );
});

test("A1 stale evidence is rejected inside the owner mutation while an accepted decision resumes one activity", async () => {
  process.env.PEDAGOGY_ENGINE_ENABLED = "true";
  const id = "11111111-1111-4111-8111-111111111111",
    activityId = "22222222-2222-4222-8222-222222222222",
    trackId = "33333333-3333-4333-8333-333333333333",
    owner = {
      ownerKey: "guest:owner",
      userId: null,
      guestAuth: {},
      role: "guest",
    };
  const decision = {
    id,
    owner_key: owner.ownerKey,
    kind: "decision",
    track_revision_id: trackId,
    revision: 0,
    data: {
      evidenceFingerprint: "old",
      mappingSnapshotHash: "graph",
      expiresAt: "2026-11-08T11:00:00Z",
      acceptedActivityId: null,
      acceptedAlternativeIndex: null,
    },
  };
  const activity = {
    id: activityId,
    owner_key: owner.ownerKey,
    kind: "activity",
    track_revision_id: trackId,
    revision: 0,
    data: { status: "active", assessmentId: null },
  };
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async (strings, ...values) => {
      const sql = (strings.strings ?? strings).join("?");
      if (sql.includes("product_mutations")) return [];
      if (sql.includes("intelligent_learning_records"))
        return values[0] === id
          ? [decision]
          : values[0] === activityId
            ? [activity]
            : [];
      return [];
    },
  };
  const store = {
    syntheticData: true,
    authenticate: async () => ({}),
    authorizeInTransaction: async () => {},
    security: { keyDigest: (x) => x, fingerprint: () => "digest" },
    db: { $transaction: async (work) => work(tx) },
  };
  const service = new IntelligentLearningService(
    store,
    { actor: async () => owner },
    {},
    {},
    () => new Date("2026-11-08T10:00:00Z"),
  );
  service.resolver.resolve = async () => ({
    evidenceFingerprint: "new",
    graph: { mappingSnapshotHash: "graph" },
  });
  const request = {
    headers: { "idempotency-key": "accept-decision-key-123456" },
  };
  await assert.rejects(
    () => service.accept(request, { decisionId: id, expectedRevision: 0 }),
    (error) => error.code === "stale_decision",
  );
  decision.data.acceptedActivityId = activityId;
  const resumed = await service.accept(request, {
    decisionId: id,
    expectedRevision: 0,
  });
  assert.equal(resumed.id, activityId);
  delete process.env.PEDAGOGY_ENGINE_ENABLED;
});

test("A4 track publication validates a required cycle without changing its existing published revision", async () => {
  const {
      LearningPathContentService,
    } = require("../dist/learning-path-content.js"),
    service = new LearningPathContentService({}, {}, {}, {});
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  service.row = async (id) => ({
    id,
    status: "published",
    payload: {
      kind: "lesson",
      subject: "algebra",
      skillCodes: [id === ids[0] ? "SK-ALG-04" : "SK-ALG-05"],
      prerequisiteSkillCodes: [id === ids[0] ? "SK-ALG-05" : "SK-ALG-04"],
    },
  });
  const result = await service.validatePayload({
    kind: "track",
    subject: "algebra",
    units: [{ lessonRevisionIds: ids }],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes("cycle:")));
});

test("A flags cannot be bypassed through the existing assessment start route", async () => {
  const owner = {
      ownerKey: "guest:test",
      userId: null,
      guestAuth: {},
      role: "guest",
    },
    store = {
      syntheticData: true,
      authenticate: async () => ({}),
      db: { $transaction: async (work) => work({}) },
    },
    service = new LearningAssessmentService(
      store,
      { actor: async () => owner },
      {
        track: async () => {
          throw new Error("must not expose lesson");
        },
      },
      {},
      {},
      {},
    );
  delete process.env.SPACED_REVIEW_ENABLED;
  delete process.env.PEDAGOGY_ENGINE_ENABLED;
  delete process.env.FADING_SCAFFOLD_ENABLED;
  for (const kind of ["retrieval_review", "independent_check"])
    await assert.rejects(
      () =>
        service.start(
          { headers: {} },
          {
            trackRevisionId: "11111111-1111-4111-8111-111111111111",
            lessonRevisionId: "22222222-2222-4222-8222-222222222222",
            kind,
          },
        ),
      (error) => error.status === 403,
    );
  store.syntheticData = false;
  process.env.SPACED_REVIEW_ENABLED = "true";
  await assert.rejects(
    () =>
      service.start(
        { headers: {} },
        {
          trackRevisionId: "11111111-1111-4111-8111-111111111111",
          lessonRevisionId: "22222222-2222-4222-8222-222222222222",
          kind: "retrieval_review",
        },
      ),
    (error) => error.status === 403,
  );
  delete process.env.SPACED_REVIEW_ENABLED;
});

test("explicit lesson read exposes only returned practice and inline worked references, never hidden assessment refs", async () => {
  const {
    LearningPathContentService,
  } = require("../dist/learning-path-content.js");
  const guest = "11111111-1111-4111-8111-111111111111",
    lesson = "22222222-2222-4222-8222-222222222222",
    practice = "33333333-3333-4333-8333-333333333333",
    inline = "44444444-4444-4444-8444-444444444444",
    hidden = "55555555-5555-4555-8555-555555555555",
    writes = [];
  const tx = {
      $executeRaw: async (strings, ...values) => {
        writes.push({ sql: (strings.strings ?? strings).join("?"), values });
        return 1;
      },
      $queryRaw: async () => [
        { learning_family: "family", original_equation_raw: "٢س=٨" },
      ],
    },
    service = new LearningPathContentService(
      { syntheticData: true, db: { $transaction: async (work) => work(tx) } },
      {},
      {},
      {},
    );
  service.row = async () => ({
    payload: {
      kind: "lesson",
      subject: "algebra",
      practiceProblemRevisionIds: [practice],
      assessmentProblemRevisionIds: [hidden],
      contentBlocks: [
        { type: "worked_example_ref", problemRevisionId: inline },
      ],
    },
  });
  await service.recordReadExposure(
    { ownerKey: "guest:" + guest, guestId: guest, userId: null, guestAuth: {} },
    [lesson],
    true,
  );
  const exposures = writes.filter((w) =>
    w.sql.includes("INSERT INTO content_exposures"),
  );
  assert.equal(exposures.length, 2);
  assert.ok(exposures.some((w) => w.values.includes(practice)));
  assert.ok(exposures.some((w) => w.values.includes(inline)));
  assert.ok(exposures.every((w) => !w.values.includes(hidden)));
  assert.ok(writes.some((w) => w.sql.includes("'lesson_viewed'")));
  writes.length = 0;
  await service.recordReadExposure(
    { ownerKey: "guest:" + guest, guestId: guest, userId: null, guestAuth: {} },
    [lesson],
  );
  const trackExposures = writes.filter((w) =>
    w.sql.includes("INSERT INTO content_exposures"),
  );
  assert.equal(trackExposures.length, 1);
  assert.ok(trackExposures[0].values.includes(inline));
  assert.ok(!writes.some((w) => w.sql.includes("'lesson_viewed'")));
});

test("practice disclosure contaminates identity, family and equation only at or after the disclosure time", async () => {
  const disclosedAt = new Date("2026-11-08T11:00:00Z"),
    service = new LearningAssessmentService({}, {}, {}, {}, {}, {}),
    tx = {
      $queryRaw: async (strings) => {
        const sql = (strings.strings ?? strings).join("?");
        return sql.includes("FROM learning_lesson_events e JOIN")
          ? [
              {
                problem_id: "practice-id",
                learning_family: "shared-family",
                original_equation_raw: "٢س = ٨",
                exposed_at: disclosedAt,
              },
            ]
          : [];
      },
    };
  const contamination = await service.algebraContamination(
      tx,
      "guest:owner",
      "guest",
    ),
    { temporalLearningExposure } = require("../dist/learning-assessments.js");
  for (const time of [
    contamination.problems.get("practice-id"),
    contamination.families.get("shared-family"),
    contamination.equations.get("2س=8"),
  ]) {
    assert.equal(temporalLearningExposure(time, "2026-11-08T10:00:00Z"), false);
    assert.equal(temporalLearningExposure(time, "2026-11-08T12:00:00Z"), true);
  }
});

test("A3 transfer exception requires a synthetic path exit and keeps native transfer and hinted attempts sealed", async () => {
  const {
      exitedSyntheticPathProbe,
      requireUnassistedProbe,
    } = require("../dist/assistance.js"),
    beforeA3 = process.env.DEEP_DIAGNOSIS_ENABLED,
    beforeSynthetic = process.env.KHOTWA_SYNTHETIC_DATA,
    attempt = {
      id: "attempt",
      learning_session_id: "learning",
      attempt_kind: "transfer",
      independent_evidence_eligible: true,
      highest_hint_level_seen: 0,
      full_solution_seen: false,
    },
    queries = [];
  let exited = false;
  const tx = {
    $queryRaw: async (strings) => {
      const sql = (strings.strings ?? strings).join("?");
      queries.push(sql);
      return exited ? [{ id: "path-item" }] : [];
    },
  };
  try {
    delete process.env.DEEP_DIAGNOSIS_ENABLED;
    process.env.KHOTWA_SYNTHETIC_DATA = "true";
    assert.equal(await exitedSyntheticPathProbe(tx, attempt), false);
    process.env.DEEP_DIAGNOSIS_ENABLED = "true";
    await assert.rejects(
      () => requireUnassistedProbe(tx, attempt),
      (error) => error.code === "invalid_state",
    );
    exited = true;
    await requireUnassistedProbe(tx, attempt);
    assert.ok(
      queries.some(
        (sql) =>
          sql.includes("measurement_exited_at IS NOT NULL") &&
          sql.includes("l.is_synthetic") &&
          sql.includes("NOT EXISTS(SELECT 1 FROM learning_assignments"),
      ),
    );
    await assert.rejects(
      () =>
        requireUnassistedProbe(tx, { ...attempt, highest_hint_level_seen: 1 }),
      (error) => error.code === "invalid_state",
    );
    process.env.KHOTWA_SYNTHETIC_DATA = "false";
    await assert.rejects(
      () => requireUnassistedProbe(tx, attempt),
      (error) => error.code === "invalid_state",
    );
  } finally {
    if (beforeA3 === undefined) delete process.env.DEEP_DIAGNOSIS_ENABLED;
    else process.env.DEEP_DIAGNOSIS_ENABLED = beforeA3;
    if (beforeSynthetic === undefined) delete process.env.KHOTWA_SYNTHETIC_DATA;
    else process.env.KHOTWA_SYNTHETIC_DATA = beforeSynthetic;
  }
});
