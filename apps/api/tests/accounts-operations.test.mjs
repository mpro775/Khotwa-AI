import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const {
  AccountService,
  normalizeAccountEmail,
  accountObject,
} = require("../dist/accounts.js");
const { Security, hmac } = require("../dist/security.js");
const {
  CapturedAccountMail,
  SmtpAccountMail,
} = require("../dist/account-mail.js");
const {
  sanitizeFeedback,
  betaTelemetry,
} = require("../dist/beta-operations.js");
const security = () =>
  new Security({
    origin: "https://khotwa.test",
    digestKey: randomBytes(32).toString("hex"),
    bootstrapKey: randomBytes(32).toString("hex"),
    csrfKey: randomBytes(32).toString("hex"),
    issueKey: randomBytes(32).toString("hex"),
    idempotencyKey: randomBytes(32).toString("hex"),
    cursorKey: randomBytes(32).toString("hex"),
    bootstrapSeconds: 120,
  });
test("email normalization rejects header injection and oversized addresses", () => {
  assert.equal(
    normalizeAccountEmail(" Student@Example.com "),
    "student@example.com",
  );
  for (const value of [
    "alice@example.com\r\nBcc: victim@example.com",
    "not-an-email",
    "a".repeat(65) + "@example.com",
    null,
  ])
    assert.throws(() => normalizeAccountEmail(value));
});
test("account DTO rejects caller-selected ownership and role fields", () => {
  assert.throws(() =>
    accountObject({ email: "student@example.com", role: "admin" }, ["email"]),
  );
  assert.throws(() =>
    accountObject({ consent: true, guestId: randomUUID() }, ["consent"]),
  );
  assert.deepEqual(accountObject({ consent: true }, ["consent"]), {
    consent: true,
  });
});
test("mail capture stays server-side and SMTP refuses non-local plaintext", async () => {
  const mail = new CapturedAccountMail();
  await mail.sendLogin({
    to: "student@example.com",
    code: "123456",
    expiresMinutes: 10,
  });
  assert.equal(mail.takeForTesting().code, "123456");
  assert.equal(mail.takeForTesting(), undefined);
  assert.throws(
    () =>
      new SmtpAccountMail({
        host: "smtp.example.com",
        port: 25,
        from: "noreply@example.com",
        implicitTls: false,
        allowLocalPlaintext: true,
      }),
  );
  assert.throws(
    () =>
      new SmtpAccountMail({
        host: "mailpit",
        port: 1025,
        from: "bad\r\nfrom@example.com",
        implicitTls: false,
        allowLocalPlaintext: true,
      }),
  );
});
test("wrong OTP increments committed attempts instead of rolling back the counter", async () => {
  const previous = {
    enabled: process.env.ACCOUNTS_ENABLED,
    key: process.env.ACCOUNT_OTP_DIGEST_KEY,
  };
  process.env.ACCOUNTS_ENABLED = "true";
  process.env.ACCOUNT_OTP_DIGEST_KEY = randomBytes(32).toString("hex");
  try {
    const sec = security(),
      challengeId = randomUUID(),
      email = "student@example.com";
    const row = {
      id: challengeId,
      email_digest: Buffer.from(
        hmac(process.env.ACCOUNT_OTP_DIGEST_KEY, "email:" + email),
        "hex",
      ),
      code_digest: Buffer.from(
        hmac(
          process.env.ACCOUNT_OTP_DIGEST_KEY,
          "otp:" + challengeId + ":" + email + ":123456",
        ),
        "hex",
      ),
      expires_at: new Date(Date.now() + 60000),
      attempts: 0,
      consumed_at: null,
      delivery_state: "sent",
    };
    let committed = 0;
    const tx = {
      $queryRaw: async (query) =>
        query.join("?").includes("account_request_keys") ? [] : [row],
      $executeRaw: async (query) => {
        if (query.join("?").includes("attempts=attempts+1")) {
          row.attempts++;
          if (row.attempts >= 5) row.consumed_at = new Date();
        }
        return 1;
      },
    };
    const store = {
      security: sec,
      db: {
        $transaction: async (callback) => {
          const result = await callback(tx);
          committed++;
          return result;
        },
      },
    };
    const accounts = new AccountService(store, new CapturedAccountMail());
    for (let index = 0; index < 5; index++) {
      const issued = sec.bootstrap();
      await assert.rejects(
        accounts.verifyCode(
          {
            headers: {
              origin: "https://khotwa.test",
              cookie: "kh_bootstrap=" + issued.cookie,
              "x-csrf-token": issued.csrf,
              "content-type": "application/json",
              "idempotency-key": "otp-attempt-" + index,
            },
          },
          { setHeader() {} },
          { email, challengeId, code: "999999" },
        ),
        (error) => error.status === 401 && !error.message.includes("999999"),
      );
    }
    assert.equal(row.attempts, 5);
    assert.ok(row.consumed_at);
    assert.equal(committed, 5);
  } finally {
    if (previous.enabled === undefined) delete process.env.ACCOUNTS_ENABLED;
    else process.env.ACCOUNTS_ENABLED = previous.enabled;
    if (previous.key === undefined) delete process.env.ACCOUNT_OTP_DIGEST_KEY;
    else process.env.ACCOUNT_OTP_DIGEST_KEY = previous.key;
  }
});
test("feedback redacts common secrets without discarding Arabic context", () => {
  const redacted = sanitizeFeedback(
    "تعذر الدخول student@example.com OTP=123456 Bearer abcdefg kh_account=secret sk-" +
      "a".repeat(40),
  );
  assert.match(redacted, /تعذر الدخول/);
  for (const secret of [
    "student@example.com",
    "123456",
    "abcdefg",
    "=secret",
    "sk-",
  ])
    assert.ok(!redacted.includes(secret));
});
test("telemetry excludes identities and suppresses percentiles for small samples", () => {
  betaTelemetry.recordApi(503, 10);
  betaTelemetry.recordAi({
    provider: "gemini",
    source: "reviewed_template",
    inputTokens: null,
    outputTokens: null,
    estimatedCostMicros: null,
  });
  const result = betaTelemetry.snapshot();
  assert.equal(result.api.p95Ms, null);
  assert.equal(result.api.status5xx, 1);
  assert.equal(result.ai.unknownCostCalls, 1);
  assert.ok(!JSON.stringify(result).includes("student@example.com"));
});
test("public Python runs never become independent submitted evidence", async () => {
  const sec = security(),
    actor = {
      ownerKey: "user:" + randomUUID(),
      userId: randomUUID(),
      guestId: null,
      role: "student",
      csrfToken: "",
    };
  const row = (verdict, extra = {}) => ({
    subject_code: "programming",
    payload: { skillCodes: ["python.loops"] },
    verdict,
    independent: true,
    assistance_level: 0,
    updated_at: new Date(),
    ...extra,
  });
  let evidence = [row({ mode: "run", allPassed: true, passed: 1, total: 1 })];
  const store = {
    security: sec,
    db: {
      $queryRaw: async (query) =>
        query.join("?").includes("to_regclass")
          ? [{ present: true }]
          : evidence,
    },
  };
  const accounts = new AccountService(store, new CapturedAccountMail());
  let result = await accounts.subjectEvidence(actor);
  assert.equal(result[0].skillCode, "python.loops");
  assert.equal(result[0].state, "not_assessed");
  assert.equal(result[0].independentCount, 0);
  evidence = [
    row({
      mode: "submit",
      status: "service_error",
      allPassed: false,
      passed: 0,
      total: 2,
    }),
    row({ mode: "submit", allPassed: true, passed: 0, total: 0 }),
  ];
  result = await accounts.subjectEvidence(actor);
  assert.equal(result[0].state, "not_assessed");
  assert.equal(result[0].evidenceCount, 0);
  assert.equal(result[0].independentCount, 0);
  evidence = [
    row(
      { mode: "submit", allPassed: true, passed: 2, total: 2 },
      { independent: false, assistance_level: 2 },
    ),
  ];
  result = await accounts.subjectEvidence(actor);
  assert.equal(result[0].assistedCount, 1);
  assert.equal(result[0].independentCount, 0);
  evidence.push(row({ mode: "submit", allPassed: true, passed: 2, total: 2 }));
  result = await accounts.subjectEvidence(actor);
  assert.equal(result[0].independentCount, 1);
  assert.equal(result[0].state, "new_independent_evidence");
});
test("physics abstentions and pending service calls do not create negative evidence", async () => {
  const evidence = [
    {
      subject_code: "physics",
      payload: { skillCodes: ["physics.speed"] },
      verdict: { status: "service_error" },
      independent: true,
      assistance_level: 0,
      updated_at: new Date(),
    },
  ];
  const store = {
    security: security(),
    db: {
      $queryRaw: async (query) =>
        query.join("?").includes("to_regclass")
          ? [{ present: true }]
          : evidence,
    },
  };
  const accounts = new AccountService(store, new CapturedAccountMail());
  const [result] = await accounts.subjectEvidence({
    ownerKey: "user:" + randomUUID(),
  });
  assert.equal(result.skillCode, "physics.speed");
  assert.equal(result.evidenceCount, 0);
  assert.equal(result.state, "not_assessed");
});
test("lost successful OTP response replays the same session only for the original proof and key", async () => {
  const previous = {
    enabled: process.env.ACCOUNTS_ENABLED,
    key: process.env.ACCOUNT_OTP_DIGEST_KEY,
  };
  process.env.ACCOUNTS_ENABLED = "true";
  process.env.ACCOUNT_OTP_DIGEST_KEY = randomBytes(32).toString("hex");
  try {
    const sec = security(),
      challengeId = randomUUID(),
      email = "student@example.com";
    const issued = sec.bootstrap(),
      requestKey = "lost-successful-otp-response";
    const user = {
      id: randomUUID(),
      email_normalized: email,
      role: "student",
      status: "active",
      is_internal: false,
      learning_guest_id: randomUUID(),
      email_verified_at: new Date(),
      created_at: new Date(),
    };
    const challenge = {
      id: challengeId,
      email_digest: Buffer.from(
        hmac(process.env.ACCOUNT_OTP_DIGEST_KEY, "email:" + email),
        "hex",
      ),
      code_digest: Buffer.from(
        hmac(
          process.env.ACCOUNT_OTP_DIGEST_KEY,
          "otp:" + challengeId + ":" + email + ":123456",
        ),
        "hex",
      ),
      expires_at: new Date(Date.now() + 60000),
      attempts: 0,
      consumed_at: null,
      delivery_state: "sent",
    };
    const caches = new Map();
    let session = null,
      issuedSessions = 0,
      consumed = 0;
    const tx = {
      $queryRaw: async (query, ...values) => {
        const sql = query.join("?");
        if (sql.includes("FROM account_request_keys")) {
          const cached = caches.get(
            values[0].toString("hex") + ":" + values[1].toString("hex"),
          );
          return cached ? [cached] : [];
        }
        if (sql.includes("FROM email_login_challenges")) return [challenge];
        if (sql.includes("FROM users u JOIN auth_sessions")) {
          if (
            !session ||
            session.revoked ||
            session.expires_at.getTime() <= Date.now() ||
            values[0] !== session.id ||
            values[1] !== user.id ||
            !Buffer.from(values[2]).equals(session.token_digest)
          )
            return [];
          return [
            {
              ...user,
              auth_session_id: session.id,
              expires_at: session.expires_at,
            },
          ];
        }
        if (sql.includes("SELECT * FROM users")) return [user];
        throw new Error("Unexpected unit-test SQL");
      },
      $executeRaw: async (query, ...values) => {
        const sql = query.join("?");
        if (sql.includes("attempts=attempts+1")) challenge.attempts++;
        else if (
          sql.includes(
            "UPDATE email_login_challenges SET consumed_at=now() WHERE id",
          )
        ) {
          challenge.consumed_at = new Date();
          consumed++;
        } else if (sql.includes("INSERT INTO auth_sessions")) {
          issuedSessions++;
          session = {
            id: values[0],
            token_digest: Buffer.from(values[2]),
            expires_at: values[3],
            revoked: false,
          };
        } else if (sql.includes("INSERT INTO account_request_keys"))
          caches.set(
            values[1].toString("hex") + ":" + values[2].toString("hex"),
            { fingerprint: values[3], response: JSON.parse(values[4]) },
          );
        return 1;
      },
    };
    const store = {
      security: sec,
      authenticate: async () => null,
      db: { $transaction: async (callback) => callback(tx) },
    };
    const accounts = new AccountService(store, new CapturedAccountMail());
    const request = (bootstrap = issued, key = requestKey) => ({
      headers: {
        origin: "https://khotwa.test",
        cookie: "kh_bootstrap=" + bootstrap.cookie,
        "x-csrf-token": bootstrap.csrf,
        "content-type": "application/json",
        "idempotency-key": key,
      },
    });
    const body = { email, challengeId, code: "123456" };
    const cookies = [];
    const response = {
      setHeader(name, value) {
        if (name === "Set-Cookie") cookies.push(value);
      },
    };
    const first = await accounts.verifyCode(request(), response, body);
    const replay = await accounts.verifyCode(request(), response, body);
    assert.deepEqual(replay, first);
    assert.equal(cookies[0].split(";")[0], cookies[1].split(";")[0]);
    assert.equal(issuedSessions, 1);
    assert.equal(consumed, 1);
    assert.equal(challenge.attempts, 1);
    const rawToken = cookies[0].split(";")[0].split("=")[1];
    assert.equal(
      session.token_digest.toString("hex"),
      sec.digest("account:" + rawToken),
    );
    assert.ok(!JSON.stringify([...caches.values()]).includes(rawToken));
    assert.ok(!JSON.stringify([...caches.values()]).includes("123456"));
    await assert.rejects(
      accounts.verifyCode(request(), response, { ...body, code: "999999" }),
      (error) => error.status === 409 && error.code === "idempotency_conflict",
    );
    await assert.rejects(
      accounts.verifyCode(request(sec.bootstrap()), response, body),
      (error) => error.status === 401,
    );
    await assert.rejects(
      accounts.verifyCode(
        request(issued, "another-idempotency-key"),
        response,
        body,
      ),
      (error) => error.status === 401,
    );
    session.revoked = true;
    await assert.rejects(
      accounts.verifyCode(request(), response, body),
      (error) => error.status === 401,
    );
    session.revoked = false;
    session.expires_at = new Date(0);
    await assert.rejects(
      accounts.verifyCode(request(), response, body),
      (error) => error.status === 401,
    );
    assert.equal(cookies.length, 2);
    assert.equal(issuedSessions, 1);
  } finally {
    if (previous.enabled === undefined) delete process.env.ACCOUNTS_ENABLED;
    else process.env.ACCOUNTS_ENABLED = previous.enabled;
    if (previous.key === undefined) delete process.env.ACCOUNT_OTP_DIGEST_KEY;
    else process.env.ACCOUNT_OTP_DIGEST_KEY = previous.key;
  }
});
test("identity refresh preserves a valid pending bootstrap proof", async () => {
  const sec = security(),
    issued = sec.bootstrap(),
    cookies = [];
  const accounts = new AccountService(
    { security: sec, authenticate: async () => null },
    new CapturedAccountMail(),
  );
  const response = {
    setHeader(_name, value) {
      cookies.push(value);
    },
  };
  const first = await accounts.current(
    { headers: { cookie: "kh_bootstrap=" + issued.cookie } },
    response,
  );
  const second = await accounts.current(
    { headers: { cookie: "kh_bootstrap=" + issued.cookie } },
    response,
  );
  assert.equal(first.loginCsrfToken, issued.csrf);
  assert.equal(second.loginCsrfToken, issued.csrf);
  assert.equal(cookies.length, 0);
});
test("failed or expired cached mail delivery never replays a false queued success", async () => {
  const previous = {
    enabled: process.env.ACCOUNTS_ENABLED,
    key: process.env.ACCOUNT_OTP_DIGEST_KEY,
  };
  process.env.ACCOUNTS_ENABLED = "true";
  process.env.ACCOUNT_OTP_DIGEST_KEY = randomBytes(32).toString("hex");
  try {
    const sec = security(),
      issued = sec.bootstrap(),
      email = "student@example.com",
      mail = new CapturedAccountMail();
    const cached = {
      fingerprint: Buffer.from(sec.fingerprint({ email }), "hex"),
      response: {
        challengeId: randomUUID(),
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
        delivery: "queued",
      },
      delivery_state: "failed",
      challenge_expires_at: new Date(Date.now() + 60000),
    };
    const tx = { $executeRaw: async () => 1, $queryRaw: async () => [cached] };
    const accounts = new AccountService(
      { security: sec, db: { $transaction: async (callback) => callback(tx) } },
      mail,
    );
    const request = {
      headers: {
        origin: "https://khotwa.test",
        cookie: "kh_bootstrap=" + issued.cookie,
        "x-csrf-token": issued.csrf,
        "content-type": "application/json",
        "idempotency-key": "failed-mail-retry-key",
      },
    };
    await assert.rejects(
      accounts.requestCode(request, { email }),
      (error) => error.status === 503,
    );
    cached.delivery_state = "sent";
    cached.challenge_expires_at = new Date(0);
    await assert.rejects(
      accounts.requestCode(request, { email }),
      (error) => error.status === 409,
    );
    assert.equal(mail.takeForTesting(), undefined);
  } finally {
    if (previous.enabled === undefined) delete process.env.ACCOUNTS_ENABLED;
    else process.env.ACCOUNTS_ENABLED = previous.enabled;
    if (previous.key === undefined) delete process.env.ACCOUNT_OTP_DIGEST_KEY;
    else process.env.ACCOUNT_OTP_DIGEST_KEY = previous.key;
  }
});
