import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  scheduleForSkill,
  reviewIsDue,
  dueReviews,
  deferReview,
  retentionOutcome,
  reviewRetainedByCurrentEvidence,
  DAY_MS,
} = require("../dist/retrieval-scheduler.js");
const {
  revealScaffold,
  scaffoldStageEligible,
  workedSteps,
} = require("../dist/scaffolding.js");
const { ApiFault } = require("../dist/http.js");
const {
  advanceTutor,
  safeSocraticCandidate,
  offlineSocraticQuestion,
} = require("../dist/socratic-tutor.js");
const {
  goalEvidenceCount,
  reflectionMessage,
} = require("../dist/metacognition.js");
const {
  IntelligentLearningExperiencesService,
} = require("../dist/intelligent-learning-experiences.js");
const trackId = randomUUID(),
  lessonId = randomUUID();
const day0 = new Date("2026-11-08T09:00:00Z");
const observation = {
  evidenceId: randomUUID(),
  skillCode: "SK-ALG-04",
  problemId: randomUUID(),
  outcome: "correct",
  time: day0.toISOString(),
  kind: "independent_check",
};
const lessonPayload = {
  kind: "lesson",
  subject: "algebra",
  code: "ALG-L04",
  titleAr: "التوزيع",
  descriptionAr: "محتوى اصطناعي للاختبار فقط",
  objectives: ["توزيع المعامل"],
  skillCodes: ["SK-ALG-04"],
  prerequisiteSkillCodes: [],
  prerequisiteLessonIds: [],
  contentBlocks: [
    {
      type: "worked_steps",
      textAr: "مثال اصطناعي",
      raw: "٢(س + ٣) = ١٠",
      steps: [
        { raw: "٢س + ٦ = ١٠", explanationAr: "نوزع المعامل." },
        { raw: "٢س = ٤", explanationAr: "نطرح ستة من الطرفين." },
        { raw: "س = ٢", explanationAr: "نقسم الطرفين على اثنين." },
      ],
    },
  ],
  practiceProblemRevisionIds: [],
  assessmentProblemRevisionIds: [],
  errorCodes: ["ERR-ALG-01"],
  mappingPending: [],
};
const lesson = {
  id: lessonId,
  itemId: randomUUID(),
  version: 1,
  editRevision: 0,
  status: "published",
  payload: lessonPayload,
  contentHash: "synthetic-reviewed-for-test",
  validation: { valid: true, issues: [], examples: [] },
};

test("A5 fake clock day 0→1→3→7→14, experimental intervals and assisted evidence", () => {
  const review = scheduleForSkill(observation, trackId, lessonId);
  assert.equal(reviewIsDue(review, day0), false);
  assert.equal(reviewIsDue(review, new Date(+day0 + DAY_MS)), true);
  assert.equal(review.dueAt, "2026-11-09T09:00:00.000Z");
  for (const [step, days] of [1, 3, 7, 14, 30].entries())
    assert.equal(
      +new Date(scheduleForSkill(observation, trackId, lessonId, step).dueAt) -
        +day0,
      days * DAY_MS,
    );
  assert.equal(
    scheduleForSkill(
      { ...observation, outcome: "assisted" },
      trackId,
      lessonId,
    ),
    null,
  );
  assert.equal(
    scheduleForSkill(
      { ...observation, outcome: "unassessable" },
      trackId,
      lessonId,
    ),
    null,
  );
  const deferred = deferReview(
    review,
    new Date(+day0 + DAY_MS),
    3,
    "student_choice",
  );
  assert.equal(deferred.status, "deferred");
  assert.equal(deferred.retentionOutcome, "not_tested");
  assert.equal(dueReviews([deferred], new Date(+day0 + 3 * DAY_MS)).length, 0);
  assert.equal(
    retentionOutcome(review, [
      { ...observation, outcome: "assisted", time: review.dueAt },
    ]),
    "assisted",
  );
  assert.equal(
    retentionOutcome(review, [{ ...observation, time: review.dueAt }]),
    "independent",
  );
  assert.equal(
    retentionOutcome(review, [
      { ...observation, outcome: "unassessable", time: review.dueAt },
    ]),
    "unassessable",
  );
  const cached = {
    ...review,
    assessmentId: "review-assessment",
    retentionOutcome: "independent",
  };
  const reviewObservation = {
    ...observation,
    evidenceId: "later-review-report",
    assessmentId: "review-assessment",
    time: review.dueAt,
  };
  assert.equal(
    reviewRetainedByCurrentEvidence(cached, [observation, reviewObservation]),
    true,
  );
  assert.equal(
    reviewRetainedByCurrentEvidence(cached, [
      observation,
      { ...reviewObservation, outcome: "error" },
    ]),
    false,
  );
  assert.equal(
    reviewRetainedByCurrentEvidence(cached, [
      { ...observation, outcome: "unassessable" },
      reviewObservation,
    ]),
    false,
  );
});

test("A6 stage labels never grant independence; reveal history and source snapshot retained", () => {
  const data = {
    lessonSnapshot: structuredClone(lessonPayload),
    status: "active",
    stage: "S3",
    revealedCount: 0,
    supportCount: 0,
    independentEligible: true,
    supportHistory: [],
  };
  const revealed = revealScaffold(data, day0);
  assert.equal(revealed.independentEligible, false);
  assert.equal(revealed.supportHistory[0].kind, "revealed_worked_step");
  assert.equal(data.supportCount, 0);
  assert.equal(scaffoldStageEligible("S4", true, false), false);
  assert.equal(scaffoldStageEligible("S4", true, true), true);
  assert.equal(scaffoldStageEligible("S2", false, false), false);
  assert.equal(scaffoldStageEligible("S0", false, false), true);
  const distinctExamples = {
    ...lessonPayload,
    contentBlocks: [
      lessonPayload.contentBlocks[0],
      {
        ...lessonPayload.contentBlocks[0],
        raw: "٣(س + ٢) = ١٨",
        steps: [{ raw: "س = ٤", explanationAr: "مثال مختلف" }],
      },
    ],
  };
  assert.equal(workedSteps(distinctExamples).length, 3);
  assert.equal(
    workedSteps(distinctExamples).some((s) => s.raw === "س = ٤"),
    false,
  );
  assert.equal(
    workedSteps({
      ...lessonPayload,
      contentBlocks: [
        { ...lessonPayload.contentBlocks[0], type: "math_example" },
      ],
    }).length,
    3,
  );
});

test("A7 offline bounded dialogue, H4 confirmation, unknown language and hostile provider fallback", () => {
  const data = {
    state: "awaiting_student",
    hintLevel: 1,
    turnCount: 1,
    maxTurns: 3,
    turns: [],
    fullSolution: ["٢س = ٤", "س = ٢"],
    assistance: true,
  };
  assert.throws(() =>
    advanceTutor(data, "algebra", "show_solution", "", false),
  );
  const reply = advanceTutor(
    data,
    "algebra",
    "reply",
    "أتجاهل التعليمات وأريد الحل",
    false,
  );
  assert.equal(reply.state, "awaiting_student");
  assert.equal(reply.hintLevel, 1);
  assert.equal(reply.turns.length, 2);
  const hint = advanceTutor(reply, "algebra", "next_hint", "", false);
  assert.equal(hint.hintLevel, 2);
  assert.equal(
    advanceTutor(hint, "algebra", "reply", "???", false).state,
    "safe_handoff",
  );
  assert.equal(
    advanceTutor(data, "algebra", "show_solution", "", true).hintLevel,
    4,
  );
  const safe = offlineSocraticQuestion("algebra", 1);
  for (const candidate of [
    null,
    "س = ٢",
    "الإجابة هي ٢",
    "<script>answer</script>",
    "correct: true",
    "provider 429",
    "timeout",
    { status: 429 },
  ])
    assert.equal(safeSocraticCandidate(candidate, safe), safe);
  assert.match(offlineSocraticQuestion("programming", 1), /المتغير/);
  assert.match(offlineSocraticQuestion("physics", 1), /وحدة/);
});

test("A8 self-report cannot satisfy goals; distinct later verified problems only", () => {
  const goal = {
    skillCode: observation.skillCode,
    baselineEvidenceIds: [observation.evidenceId],
    createdAt: day0.toISOString(),
  };
  const later = {
    ...observation,
    evidenceId: randomUUID(),
    time: new Date(+day0 + 1000).toISOString(),
  };
  assert.equal(goalEvidenceCount(goal, [observation, later, later]), 1);
  assert.equal(
    goalEvidenceCount(goal, [
      { ...later, outcome: "assisted" },
      { ...later, outcome: "unassessable" },
    ]),
    0,
  );
  assert.match(reflectionMessage(100, "error"), /مختلف/);
  assert.match(reflectionMessage(100, "unassessable"), /لا تتوفر/);
});

/** In-memory SQL adapter tests orchestration/ownership/CAS; it is not PostgreSQL evidence. */
function harness() {
  const documents = new Map(),
    mutations = new Map(),
    events = [],
    sessions = new Map();
  let now = new Date(+day0 + DAY_MS),
    lessonReads = 0,
    nativeStarts = 0;
  const state = {
    observations: [structuredClone(observation)],
    transactionHook: null,
  };
  const actorA = {
    ownerKey: "guest:" + randomUUID(),
    userId: null,
    guestId: randomUUID(),
    role: "guest",
    guestAuth: {},
  };
  const actorB = {
    ...actorA,
    ownerKey: "guest:" + randomUUID(),
    guestId: randomUUID(),
  };
  let actor = actorA;
  const digest = (s) => createHash("sha256").update(s).digest("hex");
  const tx = {
    async $queryRaw(strings, ...values) {
      const sql = strings.join("?");
      if (sql.includes("SELECT fingerprint,response_cache")) {
        const old = mutations.get(values.slice(0, 3).join("|"));
        return old ? [structuredClone(old)] : [];
      }
      if (sql.includes("SELECT revision FROM learning_assessments")) {
        const session = sessions.get(values[0]);
        return session && session.ownerKey === values[1]
          ? [{ revision: session.session.revision }]
          : [];
      }
      if (sql.includes("SELECT id FROM learning_assessments"))
        return [...sessions.keys()].map((id) => ({ id }));
      if (sql.includes("INSERT INTO intelligent_learning_records")) {
        const [id, ownerKey, kind, track, parent, json] = values;
        const row = {
          id,
          owner_key: ownerKey,
          kind,
          track_revision_id: track,
          parent_id: parent,
          revision: 0,
          data: JSON.parse(json),
          created_at: new Date(now),
          updated_at: new Date(now),
        };
        documents.set(id, row);
        return [structuredClone(row)];
      }
      if (sql.includes("UPDATE intelligent_learning_records")) {
        const [json, id, ownerKey, kind, revision] = values,
          row = documents.get(id);
        if (
          !row ||
          row.owner_key !== ownerKey ||
          row.kind !== kind ||
          row.revision !== revision
        )
          return [];
        row.data = JSON.parse(json);
        row.revision++;
        row.updated_at = new Date(now);
        return [structuredClone(row)];
      }
      if (sql.includes("FROM intelligent_learning_records")) {
        if (sql.includes("WHERE id=")) {
          const [id, ownerKey, kind] = values,
            row = documents.get(id);
          return row && row.owner_key === ownerKey && row.kind === kind
            ? [structuredClone(row)]
            : [];
        }
        const [ownerKey, kind, track] = values;
        return [...documents.values()]
          .filter(
            (r) =>
              r.owner_key === ownerKey &&
              r.kind === kind &&
              (!track || r.track_revision_id === track),
          )
          .map((r) => structuredClone(r));
      }
      if (sql.includes("FROM learning_content_revisions"))
        return values[0] === lesson.id && values[1] === lesson.contentHash
          ? [{ id: lesson.id }]
          : [];
      throw Error("Unexpected query: " + sql);
    },
    async $executeRaw(strings, ...values) {
      const sql = strings.join("?");
      if (sql.includes("INSERT INTO product_mutations"))
        mutations.set(values.slice(1, 4).join("|"), {
          fingerprint: values[4],
          response_cache: JSON.parse(values[5]),
        });
      if (sql.includes("INSERT INTO intelligent_learning_events"))
        events.push(values);
      return 1;
    },
  };
  const store = {
    syntheticData: true,
    security: {
      keyDigest: digest,
      fingerprint: (b) => digest(JSON.stringify(b)),
    },
    db: { $transaction: async (work) => work(tx) },
    authorizeInTransaction: async () => {},
  };
  const context = () => ({
    owner: actor,
    auth: {},
    track: {
      id: trackId,
      payload: { kind: "track", subject: "algebra" },
      lessons: [structuredClone(lesson)],
    },
    map: {
      skills: [
        { skillCode: observation.skillCode, lessonRevisionId: lessonId },
      ],
    },
    observations: structuredClone(state.observations),
    skills: [],
    viewedLessonIds: [],
    evidenceFingerprint: digest(JSON.stringify(state.observations)),
  });
  const assessmentService = {
    context: async (_request, _id, existing) => {
      if (existing && state.transactionHook) {
        const hook = state.transactionHook;
        state.transactionHook = null;
        hook();
      }
      return context();
    },
    async start(request, body) {
      const key = request.headers["idempotency-key"];
      const existing = [...sessions.values()].find(
        (s) => s.key === key && s.ownerKey === actor.ownerKey,
      );
      if (existing) return structuredClone(existing.session);
      nativeStarts++;
      const session = {
        id: randomUUID(),
        revision: 0,
        trackRevisionId: trackId,
        lessonRevisionId: lessonId,
        subject: "algebra",
        kind: body.kind,
        status: "active",
        mode: body.kind === "practice" ? "practice" : "independent",
        questions: [
          {
            id: randomUUID(),
            problem: { problemId: randomUUID() },
            completed: false,
            status: null,
            independent: body.kind !== "practice",
            supportLevel: 0,
          },
        ],
        coverage: { requested: 1, available: 1, partial: false },
        createdAt: now.toISOString(),
      };
      sessions.set(session.id, { key, ownerKey: actor.ownerKey, session });
      return structuredClone(session);
    },
    async get(_request, id) {
      const row = sessions.get(id);
      if (!row || row.ownerKey !== actor.ownerKey)
        throw Object.assign(Error("not found"), { status: 404 });
      return structuredClone(row.session);
    },
    async exitMeasurement(_request, id, body) {
      const row = sessions.get(id);
      assert.equal(row.session.revision, body.expectedRevision);
      const q = row.session.questions.find((q) => q.id === body.questionId);
      q.independent = false;
      q.supportLevel = 1;
      row.session.revision++;
      row.session.mode = "practice";
      return structuredClone(row.session);
    },
  };
  const service = new IntelligentLearningExperiencesService(
    store,
    { actor: async () => actor },
    {
      lesson: async () => {
        lessonReads++;
        return structuredClone(lesson);
      },
    },
    assessmentService,
    () => new Date(now),
  );
  for (const flag of [
    "SPACED_REVIEW_ENABLED",
    "FADING_SCAFFOLD_ENABLED",
    "SOCRATIC_TUTOR_ENABLED",
    "METACOGNITION_ENABLED",
  ])
    process.env[flag] = "true";
  return {
    service,
    store,
    state,
    documents,
    events,
    sessions,
    context,
    request: () => ({ headers: { "idempotency-key": randomUUID() } }),
    switchOwner: () => {
      actor = actor === actorA ? actorB : actorA;
    },
    at: (date) => {
      now = new Date(date);
    },
    counts: () => ({ lessonReads, nativeStarts }),
    native: assessmentService,
  };
}

test("A5 orchestration schedules/deduplicates without content exposure, and rejects another owner", async () => {
  const h = harness(),
    request = h.request();
  const first = await h.service.schedule(request, { trackRevisionId: trackId });
  assert.equal(first.reviews.length, 1);
  assert.equal(
    (await h.service.schedule(request, { trackRevisionId: trackId })).reviews[0]
      .id,
    first.reviews[0].id,
  );
  assert.equal(
    (await h.service.schedule(h.request(), { trackRevisionId: trackId }))
      .reviews.length,
    1,
  );
  assert.equal(h.counts().lessonReads, 0);
  h.switchOwner();
  assert.equal(
    (await h.service.reviews(h.request(), trackId)).reviews.length,
    0,
  );
  await assert.rejects(
    h.service.startReview(h.request(), first.reviews[0].id, {
      expectedRevision: 0,
    }),
    (e) => e.status === 404,
  );
  assert.equal(h.counts().nativeStarts, 0);
});

test("A5 start replay creates one native measurement; finish uses canonical independent status", async () => {
  const h = harness(),
    review = (
      await h.service.schedule(h.request(), { trackRevisionId: trackId })
    ).reviews[0],
    request = h.request();
  const started = await h.service.startReview(request, review.id, {
    expectedRevision: 0,
  });
  const replay = await h.service.startReview(request, review.id, {
    expectedRevision: 0,
  });
  assert.equal(replay.assessment.id, started.assessment.id);
  assert.equal(h.counts().nativeStarts, 1);
  const q = h.sessions.get(started.assessment.id).session.questions[0];
  q.status = "verified_valid";
  q.completed = true;
  h.state.observations.push({
    ...observation,
    evidenceId: randomUUID(),
    problemId: q.problem.problemId,
    time: "2026-11-09T09:00:00.000Z",
    assessmentId: started.assessment.id,
    kind: "retrieval_review",
  });
  const finished = await h.service.finishReview(h.request(), review.id, {
    expectedRevision: started.review.revision,
  });
  assert.equal(finished.retentionOutcome, "independent");
  assert.equal(finished.status, "completed");
});

test("A5 timing and current anchor are checked against canonical verification, not browser clock", async () => {
  const h = harness(),
    review = (
      await h.service.schedule(h.request(), { trackRevisionId: trackId })
    ).reviews[0];
  const started = await h.service.startReview(h.request(), review.id, {
    expectedRevision: 0,
  });
  const q = h.sessions.get(started.assessment.id).session.questions[0];
  q.status = "verified_valid";
  q.completed = true;
  h.state.observations.push({
    ...observation,
    evidenceId: randomUUID(),
    time: day0.toISOString(),
    assessmentId: started.assessment.id,
    kind: "retrieval_review",
  });
  const finished = await h.service.finishReview(h.request(), review.id, {
    expectedRevision: started.review.revision,
  });
  assert.equal(finished.retentionOutcome, "unassessable");
});

test("A8 concurrent evidence edit rejects checkin rather than persisting stale achievement", async () => {
  const h = harness(),
    goal = await h.service.createGoal(h.request(), {
      trackRevisionId: trackId,
      lessonRevisionId: lessonId,
      skillCode: observation.skillCode,
      targetIndependentCount: 1,
      textAr: "سؤال جديد مستقل",
    });
  h.state.transactionHook = () => {
    h.state.observations[0].outcome = "unassessable";
  };
  await assert.rejects(
    h.service.checkin(h.request(), goal.id, {
      expectedRevision: 0,
      skipped: false,
    }),
    (e) => e.status === 409,
  );
  assert.equal(
    (await h.service.goals(h.request(), trackId)).goals[0].status,
    "active",
  );
});

test("A6 full stage lifecycle keeps S0/S1 assisted and uses distinct native S4 check", async () => {
  const h = harness();
  let scaffold = await h.service.startScaffold(h.request(), {
    trackRevisionId: trackId,
    lessonRevisionId: lessonId,
    skillCode: observation.skillCode,
  });
  assert.equal(scaffold.independentEligible, false);
  assert.equal(scaffold.visibleSteps.length, 0);
  scaffold = await h.service.reveal(h.request(), scaffold.id, {
    expectedRevision: scaffold.revision,
  });
  assert.equal(scaffold.supportCount, 1);
  assert.equal(scaffold.visibleSteps.length, 1);
  const ids = [];
  for (let stage = 1; stage <= 4; stage++) {
    const advanced = await h.service.advanceScaffold(h.request(), scaffold.id, {
      expectedRevision: scaffold.revision,
    });
    scaffold = advanced.scaffold;
    assert.equal(scaffold.stage, "S" + stage);
    ids.push(advanced.assessment.id);
    const q = h.sessions.get(advanced.assessment.id).session.questions[0];
    q.status = "verified_valid";
    q.completed = true;
  }
  const done = await h.service.advanceScaffold(h.request(), scaffold.id, {
    expectedRevision: scaffold.revision,
  });
  assert.equal(done.scaffold.status, "completed");
  assert.equal(done.scaffold.independentEligible, true);
  assert.equal(new Set(ids).size, 4);
});

test("A7 independent tutor requires explicit exit; resume safe H4 and owner checks", async () => {
  const h = harness(),
    assessment = await h.native.start(h.request(), {
      kind: "independent_check",
    });
  const body = {
    trackRevisionId: trackId,
    lessonRevisionId: lessonId,
    skillCode: observation.skillCode,
    assessmentId: assessment.id,
    questionId: assessment.questions[0].id,
  };
  await assert.rejects(
    h.service.startTutor(h.request(), body),
    (e) => e.status === 409,
  );
  const tutor = await h.service.startTutor(h.request(), {
    ...body,
    exitMeasurement: true,
    expectedAssessmentRevision: 0,
  });
  assert.equal(
    h.sessions.get(assessment.id).session.questions[0].independent,
    false,
  );
  assert.equal(tutor.source, "synthetic_template");
  assert.equal((await h.service.tutor(h.request(), tutor.id)).turnCount, 1);
  const noSolution = await h.service.reply(h.request(), tutor.id, {
    expectedRevision: 0,
    action: "show_solution",
    confirmFullSolution: true,
    textAr: "أريد الحل",
  });
  assert.equal(noSolution.state, "safe_handoff");
  assert.equal(noSolution.hintLevel, 1);
  h.switchOwner();
  await assert.rejects(
    h.service.tutor(h.request(), tutor.id),
    (e) => e.status === 404,
  );
});

test("A5 invalidated source never leaves started/null and is excluded from actionable due reviews", async () => {
  const h = harness(),
    review = (
      await h.service.schedule(h.request(), { trackRevisionId: trackId })
    ).reviews[0];
  h.state.observations[0].outcome = "unassessable";
  await assert.rejects(
    h.service.startReview(h.request(), review.id, { expectedRevision: 0 }),
    (e) => e.status === 409,
  );
  assert.equal(h.documents.get(review.id).data.status, "scheduled");
  assert.equal(h.documents.get(review.id).data.assessmentId, null);
  assert.equal(h.counts().nativeStarts, 0);
  assert.equal(
    (await h.service.reviews(h.request(), trackId)).reviews.length,
    0,
  );
  const replacement = await h.service.schedule(h.request(), {
    trackRevisionId: trackId,
  });
  assert.equal(replacement.reviews[0].status, "coverage_limited");
  assert.equal(replacement.reviews[0].retentionOutcome, "not_tested");
});

test("A5 no fresh coverage preserves schedule with no false failure or success", async () => {
  const h = harness(),
    review = (
      await h.service.schedule(h.request(), { trackRevisionId: trackId })
    ).reviews[0];
  h.native.start = async () => {
    throw new ApiFault(409, "invalid_state", "لا توجد أسئلة جديدة.");
  };
  await assert.rejects(
    h.service.startReview(h.request(), review.id, { expectedRevision: 0 }),
    (e) => e.status === 409,
  );
  const due = (await h.service.reviews(h.request(), trackId)).reviews[0];
  assert.equal(due.status, "coverage_limited");
  assert.equal(due.retentionOutcome, "not_tested");
});

test("A features remain inaccessible outside the synthetic boundary and when flags are off", async () => {
  const h = harness();
  h.store.syntheticData = false;
  await assert.rejects(
    h.service.goals(h.request(), trackId),
    (e) => e.status === 403,
  );
  h.store.syntheticData = true;
  process.env.METACOGNITION_ENABLED = "false";
  try {
    await assert.rejects(
      h.service.goals(h.request(), trackId),
      (e) => e.status === 403,
    );
  } finally {
    process.env.METACOGNITION_ENABLED = "true";
  }
});

test("A7 standalone H4 uses validated source examples and confirmation; replay survives ended state", async () => {
  const h = harness(),
    tutor = await h.service.startTutor(h.request(), {
      trackRevisionId: trackId,
      lessonRevisionId: lessonId,
      skillCode: observation.skillCode,
    });
  assert.equal("fullSolution" in tutor, false);
  assert.equal("lessonSnapshot" in tutor, false);
  await assert.rejects(
    h.service.reply(h.request(), tutor.id, {
      expectedRevision: 0,
      action: "show_solution",
    }),
    (e) => e.status === 422,
  );
  const request = h.request(),
    body = {
      expectedRevision: 0,
      action: "show_solution",
      confirmFullSolution: true,
    };
  const solution = await h.service.reply(request, tutor.id, body);
  assert.equal(solution.hintLevel, 4);
  assert.equal(solution.state, "completed");
  assert.deepEqual(await h.service.reply(request, tutor.id, body), solution);
});

test("A8 confidence 100 and reflection do not increase goal count; replay/CAS/owner bounded", async () => {
  const h = harness(),
    request = h.request();
  const goal = await h.service.createGoal(request, {
    trackRevisionId: trackId,
    lessonRevisionId: lessonId,
    skillCode: observation.skillCode,
    targetIndependentCount: 2,
    textAr: "أحل سؤالين جديدين دون مساعدة",
  });
  const reflection = await h.service.reflection(h.request(), {
    trackRevisionId: trackId,
    goalId: goal.id,
    phase: "reflect",
    confidence: 100,
    textAr: "أنا متأكد تمامًا",
    skipped: false,
  });
  assert.equal(reflection.verifiedOutcome, "not_tested");
  assert.equal(
    (await h.service.goals(h.request(), trackId)).goals[0].independentCount,
    0,
  );
  assert.equal(
    (await h.service.reflections(h.request(), trackId)).reflections.length,
    1,
  );
  const checkin = await h.service.checkin(h.request(), goal.id, {
    expectedRevision: 0,
    skipped: false,
  });
  assert.equal(checkin.status, "active");
  await assert.rejects(
    h.service.checkin(h.request(), goal.id, {
      expectedRevision: 0,
      skipped: false,
    }),
    (e) => e.status === 409,
  );
  h.switchOwner();
  await assert.rejects(
    h.service.reflection(h.request(), {
      trackRevisionId: trackId,
      goalId: goal.id,
      phase: "reflect",
      skipped: true,
    }),
    (e) => e.status === 404,
  );
  h.switchOwner();
  await assert.rejects(
    h.service.reflection(h.request(), {
      trackRevisionId: trackId,
      phase: "reflect",
      skipped: false,
      textAr: "a".repeat(1001),
    }),
    (e) => e.status === 422,
  );
});

test("A7 current canonical unit error and technical abstention guide dialogue without judging student text", async () => {
  const h = harness(),
    assessment = await h.native.start(h.request(), { kind: "practice" });
  const tutor = await h.service.startTutor(h.request(), {
    trackRevisionId: trackId,
    lessonRevisionId: lessonId,
    skillCode: observation.skillCode,
    assessmentId: assessment.id,
    questionId: assessment.questions[0].id,
  });
  const native = h.sessions.get(assessment.id).session;
  native.questions[0].status = "wrong_unit";
  native.revision++;
  const unit = await h.service.reply(h.request(), tutor.id, {
    expectedRevision: tutor.revision,
    action: "reply",
    textAr: "أنا متأكد أنني صحيح",
  });
  assert.match(unit.turns.at(-1).textAr, /وحدة الكمية/);
  native.questions[0].status = "service_error";
  native.revision++;
  const technical = await h.service.reply(h.request(), tutor.id, {
    expectedRevision: unit.revision,
    action: "reply",
    textAr: "؟؟؟",
  });
  assert.match(technical.turns.at(-1).textAr, /التحقق الفني/);
  assert.equal(h.state.observations.length, 1);
});

test("A8 goal edits preserve the starting evidence baseline and reject empty changes", async () => {
  const h = harness(),
    goal = await h.service.createGoal(h.request(), {
      trackRevisionId: trackId,
      lessonRevisionId: lessonId,
      skillCode: observation.skillCode,
      targetIndependentCount: 2,
      textAr: "هدف أول",
    });
  const before = structuredClone(
    h.documents.get(goal.id).data.baselineEvidenceIds,
  );
  const updated = await h.service.updateGoal(h.request(), goal.id, {
    expectedRevision: 0,
    textAr: "سؤال جديد واحد",
    targetIndependentCount: 1,
  });
  assert.equal(updated.targetIndependentCount, 1);
  assert.equal(updated.status, "active");
  assert.equal("baselineEvidenceIds" in updated, false);
  assert.deepEqual(h.documents.get(goal.id).data.baselineEvidenceIds, before);
  await assert.rejects(
    h.service.updateGoal(h.request(), goal.id, {
      expectedRevision: updated.revision,
    }),
    (e) => e.status === 422,
  );
});

test("A8 reflection refuses stale verification snapshot at persistence time", async () => {
  const h = harness();
  h.state.transactionHook = () => {
    h.state.observations[0].outcome = "error";
  };
  await assert.rejects(
    h.service.reflection(h.request(), {
      trackRevisionId: trackId,
      phase: "reflect",
      confidence: 100,
      textAr: "فهمت",
      skipped: false,
    }),
    (e) => e.status === 409,
  );
  assert.equal(
    (await h.service.reflections(h.request(), trackId)).reflections.length,
    0,
  );
});

test("A6 support during S4 exits measurement and requires a fresh native question generation", async () => {
  const h = harness();
  let scaffold = await h.service.startScaffold(h.request(), {
    trackRevisionId: trackId,
    lessonRevisionId: lessonId,
    skillCode: observation.skillCode,
  });
  let advanced = await h.service.advanceScaffold(h.request(), scaffold.id, {
    expectedRevision: scaffold.revision,
    skipExample: true,
  });
  scaffold = advanced.scaffold;
  assert.equal(scaffold.stage, "S4");
  assert.equal(scaffold.independentEligible, true);
  const originalId = advanced.assessment.id;
  scaffold = await h.service.reveal(h.request(), scaffold.id, {
    expectedRevision: scaffold.revision,
  });
  assert.equal(scaffold.independentEligible, false);
  const q = h.sessions.get(originalId).session.questions[0];
  q.status = "verified_valid";
  q.completed = true;
  assert.equal(q.independent, false);
  advanced = await h.service.advanceScaffold(h.request(), scaffold.id, {
    expectedRevision: scaffold.revision,
  });
  assert.equal(advanced.scaffold.stage, "S4");
  assert.equal(advanced.scaffold.status, "active");
  assert.notEqual(advanced.assessment.id, originalId);
  assert.equal(advanced.scaffold.supportCount, 1);
});
