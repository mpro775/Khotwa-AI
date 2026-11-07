import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { DiagnosisService, projectDiagnosis } = require("../dist/diagnosis.js");
const { LearningService } = require("../dist/learning.js");
const { ProgressService } = require("../dist/progress.js");
const { TutoringService } = require("../dist/tutoring.js");
const guestId = "00000000-0000-4000-8000-000000000001";
const attemptId = "00000000-0000-4000-8000-000000000002";
const learningId = "00000000-0000-4000-8000-000000000003";
const auth = {
  row: { id: guestId },
  accountUserId: "00000000-0000-4000-8000-000000000004",
  accountSessionId: "00000000-0000-4000-8000-000000000005",
  accountIsInternal: false,
};
const limits = {
  requestTimeoutMs: 1000,
  aiTimeoutMs: 100,
  maxInputBytes: 1000,
  maxOutputTokens: 100,
  guestCalls: 1,
  globalCalls: 1,
  guestCostUnits: 1,
  globalCostUnits: 1,
  maxParallel: 1,
};
const forbidden = (error) => error.status === 403;
async function configured(work) {
  const settings = {
    REAL_LEARNING_ENABLED: "true",
    REAL_LEARNING_POLICY_VERSION: "real-learning-v1",
    REAL_LEARNING_APPROVAL_REFERENCE: "OWNER-REAL-LEARNING-2026-11-08",
    PH06_API_ENABLED: "true",
    PH07_API_ENABLED: "false",
    PH08_API_ENABLED: "true",
    PH09_API_ENABLED: "true",
    KHOTWA_SYNTHETIC_DATA: "false",
  };
  const previous = Object.fromEntries(
    Object.keys(settings).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, settings);
  try {
    return await work();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
function fixture() {
  const state = {
    consent: true,
    synthetic: false,
    foreign: false,
    queries: [],
  };
  const attempt = {
    id: attemptId,
    learning_session_id: learningId,
    problem_revision_id: "00000000-0000-4000-8000-000000000006",
    revision: 0n,
    attempt_kind: "main",
    status: "editing",
    notation_profile: "ar-mashriq-school-v1",
  };
  const tx = {
    $queryRaw: async (parts, ...values) => {
      const query = parts.join("?");
      state.queries.push(query);
      if (query.includes("account_learning_consents"))
        return state.consent ? [{ id: auth.accountUserId }] : [];
      if (query.startsWith("SELECT d.*,l.is_synthetic")) {
        assert.ok(query.includes("l.guest_session_id="));
        assert.ok(values.includes(guestId));
        return state.foreign
          ? []
          : [
              {
                id: "diagnosis",
                attempt_id: attemptId,
                attempt_revision: 0n,
                release_id: "release",
                template_id: null,
                basis_json: { catalogVersions: {} },
                learning_is_synthetic: state.synthetic,
              },
            ];
      }
      if (query.includes("FROM misconception_catalog"))
        return [{ error_code: "ERR-ALG-01", catalog_version: "v1" }];
      if (query.startsWith("SELECT e.*,l.is_synthetic"))
        return [
          {
            id: "episode",
            is_synthetic: state.synthetic,
            learning_is_synthetic: state.synthetic,
          },
        ];
      if (query.includes("FROM learning_sessions"))
        return state.foreign
          ? []
          : [
              {
                release_id: "release",
                is_synthetic: state.synthetic,
                status: "active",
              },
            ];
      if (query.startsWith("SELECT p.original_equation_raw"))
        return [
          {
            original_equation_raw: "س = ٢",
            release_id: "release",
            is_synthetic: state.synthetic,
          },
        ];
      if (
        query.includes("FROM verification_reports") ||
        query.includes("FROM diagnostic_probes") ||
        query.includes("FROM learning_assignments")
      )
        return [];
      if (
        query.includes("FROM skills") ||
        query.includes("current_skill_evidence") ||
        query.includes("FROM skill_evidence")
      )
        return [];
      throw new Error("Unexpected query: " + query);
    },
    $executeRaw: async () => 1,
  };
  const store = {
    syntheticData: false,
    authorizeInTransaction: async () => {},
    readAttemptInTransaction: async (_tx, owner) => {
      assert.equal(owner.row.id, guestId);
      if (state.foreign)
        throw Object.assign(new Error("not_found"), { status: 404 });
      return attempt;
    },
    readStepsInTransaction: async () => [],
    db: { $transaction: async (work) => work(tx) },
  };
  return { state, tx, store, attempt };
}
test("real journey services require explicit startup configuration, then admit the owned consented session", () =>
  configured(async () => {
    const { store, tx } = fixture();
    const diagnosis = new DiagnosisService(store, true),
      learning = new LearningService(store, true),
      progress = new ProgressService(store, true),
      tutoring = new TutoringService(
        store,
        {},
        { enabled: false },
        limits,
        true,
      );
    assert.equal(
      (await diagnosis.current(tx, auth, attemptId, 0)).id,
      attemptId,
    );
    assert.equal(
      (await learning.attempt(tx, auth, attemptId)).learning_is_synthetic,
      false,
    );
    assert.equal(
      (await learning.episode(tx, auth, "episode")).is_synthetic,
      false,
    );
    assert.equal((await tutoring.current(tx, auth, attemptId)).a.id, attemptId);
    const summary = await progress.progress(auth, learningId);
    assert.equal(summary.isSynthetic, false);
    assert.ok(!summary.noteAr.includes("اصطناعية"));
    assert.equal(
      (await learning.progress(auth, learningId)).isSynthetic,
      false,
    );
    process.env.REAL_LEARNING_ENABLED = "false";
    for (const create of [
      () => new DiagnosisService(store, true),
      () => new LearningService(store, true),
      () => new ProgressService(store, true),
      () => new TutoringService(store, {}, { enabled: false }, limits, true),
    ])
      assert.throws(create, /configured real learning/);
  }));
test("withdrawn consent blocks diagnosis, tutoring, assignments and both progress projections", () =>
  configured(async () => {
    const { state, tx, store } = fixture();
    state.consent = false;
    const diagnosis = new DiagnosisService(store, true),
      learning = new LearningService(store, true),
      progress = new ProgressService(store, true),
      tutoring = new TutoringService(
        store,
        {},
        { enabled: false },
        limits,
        true,
      );
    for (const run of [
      () => diagnosis.current(tx, auth, attemptId, 0),
      () => learning.attempt(tx, auth, attemptId),
      () => learning.episode(tx, auth, "episode"),
      () => tutoring.current(tx, auth, attemptId),
      () => progress.progress(auth, learningId),
      () => learning.progress(auth, learningId),
    ])
      await assert.rejects(run(), forbidden);
    assert.ok(
      !state.queries.some(
        (q) =>
          q.includes("FROM skill_evidence") ||
          q.includes("current_skill_evidence") ||
          q.includes("FROM verification_reports"),
      ),
    );
  }));
test("real accounts cannot reinterpret synthetic learner data and guessed session IDs remain private", () =>
  configured(async () => {
    const { state, tx, store } = fixture();
    state.synthetic = true;
    const learning = new LearningService(store, true),
      progress = new ProgressService(store, true);
    await assert.rejects(learning.attempt(tx, auth, attemptId), forbidden);
    await assert.rejects(progress.progress(auth, learningId), forbidden);
    state.synthetic = false;
    state.foreign = true;
    await assert.rejects(
      progress.progress(auth, learningId),
      (error) => error.status === 404,
    );
    await assert.rejects(
      learning.attempt(tx, auth, attemptId),
      (error) => error.status === 404,
    );
  }));
test("diagnosis projection requires authenticated ownership and current real-learning consent", () =>
  configured(async () => {
    const { state, tx } = fixture();
    const report = {
      attemptId,
      attemptRevision: 0,
      isCurrent: true,
      diagnosisCandidate: { diagnosisId: "diagnosis" },
    };
    assert.equal(await projectDiagnosis(tx, report, auth, false), report);
    state.consent = false;
    await assert.rejects(projectDiagnosis(tx, report, auth, false), forbidden);
    state.foreign = true;
    assert.equal(
      (await projectDiagnosis(tx, report, auth, false)).diagnosisCandidate,
      null,
    );
    state.foreign = false;
    assert.equal(
      (await projectDiagnosis(tx, report, undefined, false)).diagnosisCandidate,
      null,
    );
  }));
test("new learning episodes inherit the owned session flag instead of claiming synthetic data", () =>
  configured(async () => {
    const { tx, store } = fixture(),
      writes = [];
    const query = tx.$queryRaw;
    tx.$queryRaw = async (parts, ...values) => {
      const sql = parts.join("?");
      if (sql.startsWith("SELECT * FROM learning_episodes")) return [];
      if (sql.startsWith("SELECT ps.skill_id"))
        return [{ skill_id: "skill", release_id: "release" }];
      return query(parts, ...values);
    };
    tx.$executeRaw = async (parts, ...values) => {
      writes.push({ sql: parts.join("?"), values });
      return 1;
    };
    store.mutate = async (_auth, _operation, _key, _body, work) => work(tx);
    const learning = new LearningService(store, true);
    learning.report = async () => ({ diagnosisCandidate: null });
    learning.pairs = async () => [{ remediation_revision_id: "new-problem" }];
    learning.fresh = async () => true;
    learning.assign = async () => {};
    learning.dto = async (_tx, episode) => episode;
    const result = await learning.startRemediation(
      auth,
      attemptId,
      "new-learning-episode-key",
      { expectedRevision: 0 },
    );
    assert.equal(result.data.is_synthetic, false);
    const inserted = writes.find((write) =>
      write.sql.startsWith("INSERT INTO learning_episodes"),
    );
    assert.equal(inserted.values.at(-1), false);
  }));
