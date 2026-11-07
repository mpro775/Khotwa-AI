import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  PhysicsLearningService,
  physicsExposureKey,
  physicsPracticeEligible,
  requirePhysicsHintAllowed,
  requirePhysicsAssignmentCurrent,
  finishPhysicsAssignment,
  invalidatePhysicsRootEpisodes,
} = require("../dist/physics-learning.js");
const {
  contextualHypothesis,
  observeTransition,
} = require("../dist/diagnosis-rules.js");
const mains = JSON.parse(
  readFileSync(
    new URL("../data/physics-kinematics.draft.v1.json", import.meta.url),
    "utf8",
  ),
);
const practice = JSON.parse(
  readFileSync(
    new URL("../data/physics-learning.draft.v1.json", import.meta.url),
    "utf8",
  ),
);
const reviewed = (p) => ({
  ...structuredClone(p),
  hints: p.hints.map((h) => ({ ...h, reviewed: true })),
});
test("all supplemental lessons have reviewed-gated distinct remedial/transfer candidates", () => {
  for (const lesson of new Set(mains.map((p) => p.lessonCode))) {
    const root = mains.find((p) => p.lessonCode === lesson),
      rem = practice.find(
        (p) => p.lessonCode === lesson && p.kind === "remediation",
      ),
      tr = practice.find(
        (p) => p.lessonCode === lesson && p.kind === "transfer",
      );
    assert.ok(root && rem && tr);
    assert.equal(physicsPracticeEligible(root, rem, "remediation"), false);
    assert.equal(
      physicsPracticeEligible(root, reviewed(rem), "remediation"),
      true,
    );
    assert.equal(
      physicsPracticeEligible(root, reviewed(tr), "transfer", rem),
      true,
    );
    assert.equal(
      physicsPracticeEligible(
        root,
        { ...reviewed(tr), familyCode: root.familyCode },
        "transfer",
        rem,
      ),
      false,
    );
    assert.ok(
      rem.hints.every((h) => !h.reviewed) && tr.hints.every((h) => !h.reviewed),
    );
  }
});
test("exposure identity normalizes eastern digits, decimals and fractions without issuing a verdict", () => {
  const p = structuredClone(mains[0]);
  const q = structuredClone(p);
  q.physics.givens.v = "٣.٠";
  q.physics.givens.t = "٨/٢";
  assert.equal(physicsExposureKey(p), physicsExposureKey(q));
  const same = { ...reviewed(practice[0]), physics: p.physics };
  assert.equal(physicsPracticeEligible(p, same, "remediation"), false);
});
const iv = (value) =>
  value < 0
    ? { type: "Negate", operand: { type: "Integer", value: String(-value) } }
    : { type: "Integer", value: String(value) };
const variable = { type: "Variable", name: "س" },
  mul = (left, right) => ({ type: "Multiply", left, right }),
  add = (left, right) => ({ type: "Add", left, right }),
  ast = (left, right) => ({
    schemaVersion: "math-ast-v1",
    root: { type: "Equation", left, right },
  });
const proof = {
  mathStatus: "verified_valid",
  engineVersion: "0.3.0",
  notationProfileVersion: "ar-mashriq-school-v1",
};
const current = {
  primary: "ERR-ALG-01",
  candidates: ["ERR-ALG-01"],
  family: "distribution",
  state: "needs_probe",
  observation: "هناك قرينة توزيع غير مكتمل.",
};
const evidence = {
  before: ast(mul(iv(2), add(variable, iv(3))), iv(10)),
  after: ast(add(mul(iv(2), variable), iv(6)), iv(10)),
  verdict: proof,
};
test("last-two proved same-concept successes change causal hypothesis conservatively, never math", () => {
  const input = structuredClone(current),
    p = structuredClone(proof),
    out = contextualHypothesis(input, [evidence], proof);
  assert.equal(out.hypothesis.state, "tentative");
  assert.match(out.hypothesis.observation, /السهو/);
  assert.deepEqual(out.supportingConcepts, ["distribution"]);
  assert.deepEqual(input, current);
  assert.deepEqual(p, proof);
  assert.equal(out.hypothesis.primary, current.primary);
});
test("stale engines, abstentions, identities and context outside two preceding edges provide no causal support", () => {
  for (const v of [
    { ...proof, engineVersion: "other" },
    { ...proof, notationProfileVersion: "other" },
    { ...proof, mathStatus: "unsupported" },
  ])
    assert.deepEqual(
      contextualHypothesis(current, [{ ...evidence, verdict: v }], proof)
        .hypothesis,
      current,
    );
  const noop = { ...evidence, after: evidence.before };
  assert.deepEqual(
    contextualHypothesis(current, [noop], proof).hypothesis,
    current,
  );
  assert.deepEqual(
    contextualHypothesis(current, [evidence, noop, noop], proof).hypothesis,
    current,
  );
  const identity = {
    before: ast(mul(iv(1), add(variable, iv(3))), iv(10)),
    after: ast(add(variable, iv(3)), iv(10)),
    verdict: proof,
  };
  assert.deepEqual(
    contextualHypothesis(current, [identity], proof).hypothesis,
    current,
  );
});
test("ordinary correct inverse step influences a later balance-error alternative without overriding its proof", () => {
  const before = ast(add(mul(iv(2), variable), iv(3)), iv(11)),
    after = ast(mul(iv(2), variable), iv(8));
  const error = {
    ...proof,
    mathStatus: "verified_invalid",
    evidence: {
      witness: {
        value: { numerator: "4", denominator: "1" },
        satisfiesPrevious: true,
        satisfiesNext: false,
      },
    },
  };
  const h = observeTransition(
    after,
    ast(mul(iv(2), variable), iv(4)),
    error,
    true,
  );
  assert.equal(h.primary, "ERR-ALG-03");
  const result = contextualHypothesis(
    h,
    [{ before, after, verdict: proof }],
    error,
  );
  assert.deepEqual(result.supportingConcepts, ["inverse_operation"]);
  assert.equal(result.hypothesis.state, "tentative");
  assert.match(result.hypothesis.observation, /السهو/);
  assert.equal(error.mathStatus, "verified_invalid");
});
function harness() {
  const owner = {
      ownerKey: "user:" + randomUUID(),
      userId: randomUUID(),
      guestId: null,
      role: "student",
      authSessionId: randomUUID(),
    },
    rootId = randomUUID();
  const refs = new Map(
    [mains[0], reviewed(practice[0]), reviewed(practice[1])].map((payload) => {
      const id = randomUUID();
      return [id, { id, item_id: randomUUID(), payload, code: "TEST-MOCK" }];
    }),
  );
  const rootRevision = [...refs.keys()][0],
    root = {
      id: rootId,
      owner_key: owner.ownerKey,
      problem_revision_id: rootRevision,
      revision: 0,
      verdict: { id: rootId, revision: 0, status: "wrong_value" },
      assistance_level: 0,
      independent: true,
    };
  const attempts = new Map([[rootId, root]]),
    episodes = new Map(),
    assignments = new Map(),
    exposures = [],
    cache = new Map();
  const query = async (strings, ...v) => {
    const sql = Array.isArray(strings) ? strings.join("?") : strings.sql;
    if (sql.includes("FROM auth_sessions"))
      return [{ id: owner.authSessionId }];
    if (sql.includes("SELECT u.is_internal FROM users u JOIN auth_sessions"))
      return [{ is_internal: true }];
    if (sql.includes("account_learning_consents"))
      return [{ is_internal: true }];
    if (sql.includes("FROM product_mutations")) {
      const item = cache.get(v[1] + ":" + v[2]);
      return item ? [item] : [];
    }
    if (sql.includes("SELECT * FROM subject_attempts")) {
      const row = attempts.get(v[0]);
      return row?.owner_key === v[1] ? [row] : [];
    }
    if (sql.includes("SELECT e.* FROM physics_learning_episodes"))
      return [...episodes.values()]
        .filter(
          (e) =>
            e.owner_key === v[0] &&
            (e.root_attempt_id === v[1] ||
              [...assignments.values()].some(
                (x) => x.episode_id === e.id && x.attempt_id === v[2],
              )),
        )
        .slice(-1);
    if (
      sql.includes("SELECT r.id,r.item_id,r.payload,i.code") &&
      sql.includes("r.status='published'")
    )
      return [...refs.values()].filter((r) => r.payload.kind === v[0]);
    if (sql.includes("SELECT r.id,r.item_id,r.payload,i.code")) {
      const r = refs.get(v[0]);
      return r ? [r] : [];
    }
    if (sql.includes("SELECT x.phase,x.invalidated_at")) {
      const x = [...assignments.values()].find((x) => x.attempt_id === v[0]),
        e = x ? episodes.get(x.episode_id) : null;
      return x && e?.owner_key === v[1]
        ? [
            {
              ...x,
              ...e,
              phase: x.phase,
              revision: attempts.get(e.root_attempt_id).revision,
            },
          ]
        : [];
    }
    if (sql.includes("SELECT x.id,x.episode_id,x.completed_at")) {
      const x = [...assignments.values()].find((x) => x.attempt_id === v[0]);
      return x
        ? [
            {
              ...x,
              has_transfer: [...assignments.values()].some(
                (t) => t.episode_id === x.episode_id && t.phase === "transfer",
              ),
            },
          ]
        : [];
    }
    if (sql.includes("SELECT t.id FROM physics_learning_assignments")) {
      const r = [...assignments.values()].find((x) => x.attempt_id === v[0]);
      return [...assignments.values()].filter(
        (x) =>
          x.episode_id === r?.episode_id &&
          x.phase === "transfer" &&
          !x.invalidated_at,
      );
    }
    if (sql.includes("SELECT x.*,a.independent"))
      return [...assignments.values()]
        .filter((x) => x.episode_id === v[0])
        .map((x) => ({
          ...x,
          independent: attempts.get(x.attempt_id).independent,
        }));
    if (sql.includes("SELECT id FROM physics_learning_assignments"))
      return [...assignments.values()].filter(
        (x) => x.episode_id === v[0] && x.phase === v[1],
      );
    if (sql.includes("SELECT problem_revision_id,completed_at"))
      return [...assignments.values()].filter(
        (x) =>
          x.episode_id === v[0] &&
          x.phase === "remediation" &&
          !x.invalidated_at,
      );
    if (sql.includes("SELECT family_code,context_key"))
      return exposures.filter((x) => x.owner_key === v[0]);
    if (sql.includes("SELECT DISTINCT r.payload->>'familyCode'"))
      return [...attempts.values()]
        .filter((a) => a.owner_key === v[0])
        .map((a) => refs.get(a.problem_revision_id))
        .filter(Boolean)
        .map((r) => ({
          family_code: r.payload.familyCode,
          physics: r.payload.physics,
        }));
    throw Error("Unhandled mock query " + sql);
  };
  const execute = async (strings, ...v) => {
    const sql = Array.isArray(strings) ? strings.join("?") : strings.sql;
    if (!Array.isArray(strings)) v = strings.values;
    if (
      sql.startsWith("SELECT pg_advisory") ||
      sql.startsWith("DELETE FROM product_mutations")
    )
      return 1;
    if (sql.startsWith("INSERT INTO physics_learning_episodes")) {
      episodes.set(v[0], {
        id: v[0],
        owner_key: v[1],
        root_attempt_id: v[3],
        root_revision: v[4],
        state: "remediating",
        created_at: new Date(),
      });
      return 1;
    }
    if (sql.startsWith("INSERT INTO subject_attempts")) {
      attempts.set(v[0], {
        id: v[0],
        owner_key: v[1],
        problem_revision_id: v[2],
        revision: 0,
        verdict: JSON.parse(v[4]),
        assistance_level: 0,
        independent: v[5],
      });
      return 1;
    }
    if (sql.startsWith("INSERT INTO physics_learning_assignments")) {
      assignments.set(v[0], {
        id: v[0],
        episode_id: v[1],
        phase: v[2],
        problem_revision_id: v[3],
        attempt_id: v[4],
        completed_at: null,
        invalidated_at: null,
      });
      return 1;
    }
    if (sql.startsWith("INSERT INTO physics_content_exposures")) {
      for (let i = 0; i < v.length; i += 6)
        exposures.push({
          owner_key: v[i + 1],
          family_code: v[i + 4],
          context_key: v[i + 5],
        });
      return 1;
    }
    if (sql.startsWith("INSERT INTO product_mutations")) {
      cache.set(v[2] + ":" + v[3], {
        fingerprint: v[4],
        response_cache: JSON.parse(v[5]),
      });
      return 1;
    }
    if (
      sql.startsWith("UPDATE physics_learning_assignments SET completed_at=")
    ) {
      const x = [...assignments.values()].find((x) => x.attempt_id === v[1]);
      if (x) x.completed_at = v[0];
      return 1;
    }
    if (
      sql.startsWith("UPDATE physics_learning_episodes SET state=") &&
      !sql.includes("state='cancelled'")
    ) {
      const e = sql.includes("SELECT episode_id")
        ? episodes.get(
            [...assignments.values()].find((x) => x.attempt_id === v[2])
              ?.episode_id,
          )
        : episodes.get(v[1]);
      if (e) e.state = v[0];
      return 1;
    }
    if (
      sql.startsWith("UPDATE physics_learning_assignments SET invalidated_at")
    ) {
      for (const e of episodes.values())
        if (e.owner_key === v[0] && e.root_attempt_id === v[1])
          for (const x of assignments.values())
            if (x.episode_id === e.id) x.invalidated_at = new Date();
      return 1;
    }
    if (
      sql.startsWith("UPDATE physics_learning_episodes SET state='cancelled'")
    ) {
      for (const e of episodes.values())
        if (e.owner_key === v[0] && e.root_attempt_id === v[1])
          e.state = "cancelled";
      return 1;
    }
    throw Error("Unhandled mock execute " + sql);
  };
  const tx = { $queryRaw: query, $executeRaw: execute },
    store = {
      syntheticData: true,
      security: { keyDigest: (k) => k, fingerprint: JSON.stringify },
      db: { $transaction: async (fn) => fn(tx) },
    };
  const service = new PhysicsLearningService(store, {
      actor: async () => owner,
      authorizeInTransaction: async () => {},
    }),
    request = () => ({ headers: { "idempotency-key": randomUUID() } });
  return {
    owner,
    root,
    rootId,
    attempts,
    episodes,
    assignments,
    exposures,
    service,
    request,
    tx,
  };
}
test("owned mocked learning flow assigns guided practice then a distinct independent transfer, with idempotent replay", async () => {
  const h = harness(),
    req = h.request();
  const rem = await h.service.assign(req, h.rootId, "remediation", {
    expectedRevision: 0,
  });
  assert.equal(rem.state, "remediating");
  assert.equal(rem.assignments.length, 1);
  const repeat = await h.service.assign(req, h.rootId, "remediation", {
    expectedRevision: 0,
  });
  assert.equal(repeat.assignments[0].attemptId, rem.assignments[0].attemptId);
  assert.equal(h.attempts.size, 2);
  const child = h.attempts.get(rem.assignments[0].attemptId);
  child.revision = 1;
  child.verdict = { ...child.verdict, status: "correct", revision: 1 };
  await finishPhysicsAssignment(h.tx, h.owner.ownerKey, child, child.verdict);
  const tr = await h.service.assign(h.request(), child.id, "transfer", {
    expectedRevision: 1,
  });
  assert.equal(tr.state, "awaiting_transfer");
  assert.equal(tr.assignments.length, 2);
  const target = tr.assignments.find((a) => a.phase === "transfer");
  assert.equal(target.independent, true);
  assert.notEqual(
    target.problem.revisionId,
    rem.assignments[0].problem.revisionId,
  );
  await assert.rejects(
    requirePhysicsHintAllowed(h.tx, h.owner.ownerKey, target.attemptId),
    (e) => e.status === 409,
  );
  const transfer = h.attempts.get(target.attemptId);
  transfer.revision = 1;
  transfer.verdict = { ...transfer.verdict, status: "correct", revision: 1 };
  await finishPhysicsAssignment(
    h.tx,
    h.owner.ownerKey,
    transfer,
    transfer.verdict,
  );
  assert.equal([...h.episodes.values()][0].state, "finished");
  await invalidatePhysicsRootEpisodes(h.tx, h.owner.ownerKey, h.rootId);
  assert.equal([...h.episodes.values()][0].state, "cancelled");
  await assert.rejects(
    requirePhysicsAssignmentCurrent(h.tx, h.owner.ownerKey, target.attemptId),
    (e) => e.status === 409,
  );
});
test("wrong ownership, stale revision and service abstention cannot begin a learning loop", async () => {
  const h = harness();
  await assert.rejects(
    h.service.current(h.request(), randomUUID()),
    (e) => e.status === 404,
  );
  await assert.rejects(
    h.service.assign(h.request(), h.rootId, "remediation", {
      expectedRevision: 5,
    }),
    (e) => e.status === 409,
  );
  h.root.verdict.status = "service_error";
  await assert.rejects(
    h.service.assign(h.request(), h.rootId, "remediation", {
      expectedRevision: 0,
    }),
    (e) => e.status === 409,
  );
  assert.equal(h.episodes.size, 0);
});
test("a disclosed equivalent context cannot be offered as fresh practice", async () => {
  const h = harness();
  h.exposures.push({
    owner_key: h.owner.ownerKey,
    family_code: "other-family",
    context_key: physicsExposureKey(practice[0]),
  });
  await assert.rejects(
    h.service.assign(h.request(), h.rootId, "remediation", {
      expectedRevision: 0,
    }),
    (e) => e.status === 409 && /لا يتوفر/.test(e.messageAr),
  );
});
