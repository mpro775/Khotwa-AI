import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const access = require("../dist/learning-access.js");
const external = require("../dist/external-ai-access.js");
const { AccountService } = require("../dist/accounts.js");
const { Store } = require("../dist/store.js");
const { BetaGeminiPort } = require("../dist/beta-gemini.js");
const { composeSubjectHint } = require("../dist/subject-ai.js");
const { betaTelemetry } = require("../dist/beta-operations.js");
const owner = {
  ownerKey: "user:owner",
  userId: "owner",
  authSessionId: "session",
  guestId: "guest",
  role: "student",
};
const auth = {
  row: { id: "guest" },
  accountUserId: "owner",
  accountSessionId: "session",
  accountIsInternal: false,
};
async function configured(work, overrides = {}) {
  const values = {
    BETA_ENABLED: "true",
    BETA_ACCESS_PAUSED: "false",
    BETA_GEMINI_ENABLED: "true",
    AI_ENABLED: "true",
    BETA_AI_ENABLED: "true",
    BETA_GEMINI_AUTHORIZATION_ID: "OWNER-BETA-NEW-2026-11-08",
    BETA_GEMINI_AUTHORIZATION_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
    BETA_GEMINI_MODEL: "gemini-test",
    GEMINI_API_KEY: "mock-key-never-used-for-network",
    BETA_GEMINI_KNOWN_DAILY_REMAINING: "20",
    BETA_GEMINI_OUTPUT_CAP_POLICY: "total_generation",
    REAL_LEARNING_ENABLED: "true",
    REAL_LEARNING_POLICY_VERSION: "real-learning-v1",
    REAL_LEARNING_APPROVAL_REFERENCE: "OWNER-REAL-LEARNING-2026-11-08",
    ...overrides,
  };
  const previous = Object.fromEntries(
    Object.keys(values).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, values);
  try {
    return await work();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
test("real learning requires fresh configuration, verified account proof and current consent", async () =>
  configured(async () => {
    let calls = 0;
    const tx = {
      $queryRaw: async () => {
        calls++;
        return [{ id: "owner" }];
      },
    };
    await access.requireLearningAccess(tx, auth, false);
    assert.equal(calls, 1);
    await assert.rejects(
      access.requireLearningAccess(tx, { row: { id: "guest" } }, false),
      (e) => e.status === 403,
    );
    await assert.rejects(
      access.requireLearningAccess({ $queryRaw: async () => [] }, auth, false),
      (e) => e.status === 403,
    );
    await assert.rejects(
      access.requireLearningAccess(tx, auth, true),
      (e) => e.status === 403,
    );
    process.env.REAL_LEARNING_APPROVAL_REFERENCE =
      "PH08-CONTENT-OWNER-ATTESTATION-2026-11-06";
    await assert.rejects(
      access.requireLearningAccess(tx, auth, false),
      (e) => e.status === 403,
    );
  }));
test("product learning cannot treat anonymous real-mode attempts as synthetic", async () => {
  const guest = {
    ownerKey: "guest:g",
    userId: null,
    guestAuth: { row: { id: "g" } },
    role: "student",
  };
  await access.requireProductLearningAccess({}, guest, true);
  await assert.rejects(
    access.requireProductLearningAccess({}, guest, false),
    (e) => e.status === 403,
  );
  assert.equal(access.learningSessionIsSynthetic(auth, true), false);
  assert.equal(
    access.learningSessionIsSynthetic(
      { ...auth, accountIsInternal: true },
      false,
    ),
    true,
  );
});
test("Beta AI is off for paused, disabled, expired, unknown-quota or historical authorization", async () =>
  configured(async () => {
    assert.equal(external.betaAiConfigured(), true);
    for (const [key, value] of Object.entries({
      BETA_ENABLED: "false",
      BETA_ACCESS_PAUSED: "true",
      BETA_GEMINI_AUTHORIZATION_EXPIRES_AT: "2000-01-01",
      BETA_GEMINI_KNOWN_DAILY_REMAINING: "unknown",
      BETA_GEMINI_AUTHORIZATION_ID: "PH08-LIVE4-2026-11-06",
    })) {
      const prior = process.env[key];
      process.env[key] = value;
      assert.equal(external.betaAiConfigured(), false, key);
      process.env[key] = prior;
    }
  }));
test("AI delivery requires both current learning and separate AI consent", async () =>
  configured(async () => {
    const queries = [];
    const tx = {
      $queryRaw: async (parts) => {
        const sql = parts.join("?");
        queries.push(sql);
        if (sql.includes("FROM users u JOIN auth_sessions"))
          return [
            {
              is_internal: false,
              enabled: true,
              policy_version: "real-learning-v1",
            },
          ];
        if (sql.includes("account_learning_consents"))
          return [{ enabled: true, policy_version: "real-learning-v1" }];
        if (sql.includes("account_ai_consents"))
          return [{ enabled: true, policy_version: "external-ai-v1" }];
        throw Error(sql);
      },
    };
    assert.equal(await external.canDeliverExternalAi(tx, owner), true);
    assert.ok(queries.some((q) => q.includes("FOR SHARE OF c,u,s")));
    assert.equal(
      await external.canDeliverExternalAi(tx, {
        ...owner,
        authSessionId: undefined,
      }),
      false,
    );
    tx.$queryRaw = async (parts) =>
      parts.join("?").includes("account_ai_consents")
        ? []
        : [
            {
              is_internal: false,
              enabled: true,
              policy_version: "real-learning-v1",
            },
          ];
    assert.equal(await external.canDeliverExternalAi(tx, owner), false);
  }));
test("consent writes require explicit current version to enable and permit versionless revocation", async () => {
  const writes = [];
  const tx = {
    $executeRaw: async (q, ...v) => {
      writes.push({ sql: q.join("?"), values: v });
      return 1;
    },
    $queryRaw: async (q, ...v) => {
      const sql = q.join("?");
      if (sql.includes("FROM auth_sessions")) return [{ id: "session" }];
      if (sql.includes("FROM product_mutations")) return [];
      if (sql.includes("INSERT INTO account_")) {
        writes.push({ sql, values: v });
        return [
          { enabled: v[1], updated_at: new Date("2026-11-08T00:00:00Z") },
        ];
      }
      throw Error(sql);
    },
  };
  const service = Object.create(AccountService.prototype);
  service.store = {
    db: { $transaction: (work) => work(tx) },
    security: { keyDigest: (v) => v, fingerprint: (v) => JSON.stringify(v) },
  };
  service.actor = async () => owner;
  const request = {
    headers: { "idempotency-key": "12345678-1234-4123-8123-123456789012" },
  };
  await assert.rejects(
    service.setConsent(request, "ai", { enabled: true }),
    (e) => e.status === 422,
  );
  await assert.rejects(
    service.setConsent(request, "learning", {
      enabled: true,
      policyVersion: "old-policy",
    }),
    (e) => e.status === 422,
  );
  assert.equal(writes.length, 0);
  assert.equal(
    (
      await service.setConsent(request, "ai", {
        enabled: true,
        policyVersion: "external-ai-v1",
      })
    ).enabled,
    true,
  );
  assert.equal(
    (await service.setConsent(request, "learning", { enabled: false })).enabled,
    false,
  );
  assert.ok(
    writes.some(
      (w) =>
        w.sql.includes("account_learning_consents") && w.values[1] === false,
    ),
  );
});
test("subject composer sends a minimized context and meters consumed usage before delivery recheck", async (t) =>
  configured(async () => {
    let checks = 0,
      context;
    const metered = [];
    t.mock.method(external, "canDeliverExternalAi", async () => ++checks === 1);
    t.mock.method(BetaGeminiPort.prototype, "invocationStarted", () => true);
    t.mock.method(BetaGeminiPort.prototype, "adaptHint", async (c) => {
      context = c;
      return {
        rawJson: JSON.stringify({
          schemaVersion: "ai-draft-v1",
          task: "hint_rephrase",
          decision: "usable",
          messageAr: c.reviewedHintTextAr,
          reasonCode: "APPROVED_HINT_REPHRASE",
          sourceTemplateId: c.sourceTemplateId,
          isAnswerRevealed: false,
        }),
        finish: "complete",
        contentVersion: c.contentVersion,
        policyVersion: c.policyVersion,
        promptVersion: c.promptVersion,
        inputTokens: 20,
        outputTokens: 10,
        billingOutputTokens: 15,
      };
    });
    t.mock.method(betaTelemetry, "recordAi", (usage) => metered.push(usage));
    const result = await composeSubjectHint({
      store: { db: { $transaction: (work) => work({}) } },
      owner,
      subject: "programming",
      level: 1,
      reviewedTextAr: "راجع ترتيب الخطوات قبل المحاولة التالية.",
      skillCodes: ["PRIVATE_IDENTIFIER"],
      observationCode: "runtime_error",
      previousHintLevel: 0,
    });
    assert.equal(result.source, "reviewed_template");
    assert.equal(result.reasonCode, "BETA_AI_DELIVERY_NOT_AUTHORIZED");
    assert.equal(metered.length, 1);
    assert.equal(metered[0].invoked, true);
    assert.equal(metered[0].billingOutputTokens, 15);
    assert.equal(JSON.stringify(context).includes("PRIVATE_"), false);
    assert.equal(JSON.stringify(context).includes(owner.ownerKey), false);
  }));

function claimFixture(running = false, guestProduct = false) {
  const writes = [];
  const tx = {
    $executeRaw: async (q, ...values) => {
      writes.push({ sql: q.join("?"), values });
      return 1;
    },
    $queryRaw: async (q) => {
      const sql = q.join("?");
      if (sql.includes("to_regclass")) return [{ present: true }];
      if (sql.includes("FROM runner_work_requests"))
        return running ? [{ id: "pending" }] : [];
      if (sql.includes("FROM guest_account_claims")) return [];
      if (sql.includes("FROM subject_attempts"))
        return guestProduct ? [{ id: "synthetic-guest-attempt" }] : [];
      if (sql.includes("FROM users")) return [{ is_internal: false }];
      if (sql.includes("FROM learning_sessions"))
        return guestProduct ? [] : [{ id: "learning", is_synthetic: false }];
      throw Error(sql);
    },
  };
  const service = Object.create(AccountService.prototype);
  service.store = {
    db: { $transaction: (work) => work(tx) },
    authenticate: async () => ({ row: { id: "source-guest" } }),
    authorizeInTransaction: async () => {},
  };
  service.actor = async () => owner;
  service.authorizeInTransaction = async () => {};
  return { service, writes };
}
test("claim rejects unresolved external work under global-before-owner lock order", async () => {
  const { service, writes } = claimFixture(true);
  await assert.rejects(
    service.claimGuest({}, { consent: true }),
    (e) => e.status === 409 && e.code === "request_in_progress",
  );
  assert.ok(writes[0].sql.includes("71941020261118"));
  assert.ok(writes[1].sql.includes("hashtextextended"));
  assert.equal(
    writes.some((w) => w.sql.includes("UPDATE subject_attempts")),
    false,
  );
});
test("completed guest claim preserves Runner quota namespace and physics exposure provenance", async () => {
  const { service, writes } = claimFixture();
  assert.equal((await service.claimGuest({}, { consent: true })).claimed, true);
  const runner = writes.find((w) =>
    w.sql.includes("UPDATE runner_work_requests"),
  );
  assert.ok(runner.values.includes("source-guest:"));
  assert.ok(
    writes.some((w) => w.sql.includes("UPDATE physics_learning_episodes")),
  );
  const exposures = writes.find((w) =>
    w.sql.includes("INSERT INTO physics_content_exposures"),
  );
  assert.ok(exposures.sql.includes("origin_owner_key"));
  assert.ok(exposures.sql.includes("context_key,created_at"));
  assert.ok(
    exposures.sql.includes(
      "ON CONFLICT(owner_key,problem_revision_id) DO NOTHING",
    ),
  );
});
test("a subject-only synthetic guest cannot be relabeled into a real account by an empty algebra history", async () => {
  const { service, writes } = claimFixture(false, true);
  await assert.rejects(
    service.claimGuest({}, { consent: true }),
    (e) => e.status === 409 && e.code === "invalid_state",
  );
  assert.equal(
    writes.some(
      (w) =>
        w.sql.includes("UPDATE learning_sessions") ||
        w.sql.includes("UPDATE subject_attempts"),
    ),
    false,
  );
});
test("account physics progress excludes stale assignments and never calls guided practice independent", async () => {
  let evidenceSql;
  const service = Object.create(AccountService.prototype);
  service.store = {
    db: {
      $queryRaw: async (q) => {
        const sql = q.join("?");
        if (sql.includes("to_regclass")) return [{ present: true }];
        evidenceSql = sql;
        return [
          {
            subject_code: "physics",
            payload: { skillCodes: ["PHYS-ACCELERATION"] },
            verdict: { status: "correct" },
            independent: true,
            assistance_level: 0,
            updated_at: new Date("2026-11-08T00:00:00Z"),
            learning_phase: "remediation",
          },
        ];
      },
    },
  };
  const [result] = await service.subjectEvidence(owner);
  assert.equal(result.independentCount, 0);
  assert.equal(result.assistedCount, 1);
  for (const guard of [
    "x.invalidated_at IS NULL",
    "e.state<>'cancelled'",
    "e.root_revision=root.revision",
    "e.owner_key=",
  ])
    assert.ok(evidenceSql.includes(guard));
});
test("Store's common attempt boundary enforces current real-learning consent before downstream step or verification work", async () =>
  configured(async () => {
    const store = Object.create(Store.prototype);
    let consenting = false;
    const row = {
      id: "attempt",
      learning_session_id: "learning",
      learning_is_synthetic: false,
    };
    const tx = {
      $queryRaw: async (query) => {
        const sql = Array.isArray(query) ? query.join("?") : query.sql;
        if (sql.includes("FROM attempts a JOIN learning_sessions"))
          return query.values[0] === "attempt" &&
            query.values[1] === auth.row.id
            ? [row]
            : [];
        if (sql.includes("JOIN account_learning_consents"))
          return consenting ? [{ id: auth.accountUserId }] : [];
        throw new Error("Unexpected store boundary query");
      },
    };
    await assert.rejects(
      store.readAttemptInTransaction(tx, auth, "attempt"),
      (error) => error.code === "forbidden",
    );
    consenting = true;
    assert.equal(
      (await store.readAttemptInTransaction(tx, auth, "attempt"))
        .learning_is_synthetic,
      false,
    );
    await assert.rejects(
      store.readAttemptInTransaction(
        tx,
        { ...auth, row: { id: "foreign" } },
        "attempt",
      ),
      (error) => error.code === "not_found",
    );
  }));
