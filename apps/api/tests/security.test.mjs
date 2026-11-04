import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { Security, secureCookie, cookieValue } = require("../dist/security.js");
const { input, uuid, idempotencyHeader } = require("../dist/contracts.js");
const { DisabledAiAdapter } = require("../dist/ai-port.js");
const { RequestLimits } = require("../dist/business.js");
const settings = () => ({
  origin: "https://khotwa.test",
  digestKey: randomBytes(32).toString("hex"),
  bootstrapKey: randomBytes(32).toString("hex"),
  csrfKey: randomBytes(32).toString("hex"),
  issueKey: randomBytes(32).toString("hex"),
  idempotencyKey: randomBytes(32).toString("hex"),
  cursorKey: randomBytes(32).toString("hex"),
  bootstrapSeconds: 120,
});
const fault = (status, code) => (e) =>
  e.status === status && e.code === code && !e.message.includes("secret");
test("bootstrap signature, expiry, Origin and CSRF form one binding", () => {
  const security = new Security(settings()),
    now = 1000000;
  const issued = security.bootstrap(now);
  const request = {
    headers: {
      origin: "https://khotwa.test",
      cookie: "kh_bootstrap=" + issued.cookie,
      "x-csrf-token": issued.csrf,
      "sec-fetch-site": "same-origin",
    },
  };
  const nonce = security.bootstrapNonce(request, now);
  assert.match(nonce, /^[\w-]{43}$/);
  for (const headers of [
    { ...request.headers, origin: "https://attacker.test" },
    { ...request.headers, "sec-fetch-site": "cross-site" },
    { ...request.headers, "x-csrf-token": "wrong" },
    { ...request.headers, "x-csrf-token": [issued.csrf] },
    { ...request.headers, cookie: request.headers.cookie + "x" },
    {
      ...request.headers,
      cookie: request.headers.cookie + "; " + request.headers.cookie,
    },
  ])
    assert.throws(
      () => security.bootstrapNonce({ headers }, now),
      fault(403, "csrf_invalid"),
    );
  assert.throws(
    () => security.bootstrapNonce(request, now + 121000),
    fault(403, "csrf_invalid"),
  );
  assert.throws(
    () => security.bootstrapNonce(request, now - 2000),
    fault(403, "csrf_invalid"),
  );
  assert.equal(security.issueGuest(nonce), security.issueGuest(nonce));
  const other = security.bootstrap(now);
  assert.notEqual(
    security.issueGuest(nonce),
    security.issueGuest(
      security.bootstrapNonce(
        {
          headers: {
            ...request.headers,
            cookie: "kh_bootstrap=" + other.cookie,
            "x-csrf-token": other.csrf,
          },
        },
        now,
      ),
    ),
  );
});
test("opaque guest digest and CSRF use distinct keys and contexts", () => {
  const security = new Security(settings()),
    token = security.issueGuest(randomBytes(32).toString("base64url"));
  assert.match(token, /^[\w-]{43}$/);
  assert.notEqual(security.digest(token), token);
  assert.notEqual(security.digest(token), security.guestCsrf(token));
  const request = {
    headers: {
      origin: "https://khotwa.test",
      "x-csrf-token": security.guestCsrf(token),
    },
  };
  security.checkGuestCsrf(request, token);
  assert.throws(
    () => security.checkGuestCsrf(request, "different"),
    fault(403, "csrf_invalid"),
  );
  assert.throws(
    () =>
      security.checkGuestCsrf(
        { headers: { "x-csrf-token": security.guestCsrf(token) } },
        token,
      ),
    fault(403, "csrf_invalid"),
  );
});
test("cookies retain mandatory security flags and reject duplicates", () => {
  const value = secureCookie("kh_guest", "opaque", 86400);
  for (const flag of [
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=86400",
  ])
    assert.ok(value.includes(flag));
  assert.equal(value.includes("Domain="), false);
  assert.ok(secureCookie("kh_guest", "", 0).includes("Max-Age=0"));
  assert.equal(
    cookieValue({ headers: { cookie: "kh_guest=a; kh_guest=b" } }, "kh_guest"),
    null,
  );
});
test("security fails closed for insecure origin or reused/weak keys", () => {
  assert.throws(
    () => new Security({ ...settings(), origin: "http://localhost" }),
  );
  assert.throws(
    () => new Security({ ...settings(), origin: "https://khotwa.test/" }),
  );
  const config = settings();
  assert.throws(() => new Security({ ...config, csrfKey: config.digestKey }));
  assert.throws(() => new Security({ ...settings(), issueKey: "short" }));
});
test("signed cursors cannot cross an owner/filter boundary", () => {
  const security = new Security(settings()),
    id = randomUUID();
  const value = security.cursor("owner-A:skill-1", id);
  assert.ok(value.length <= 256);
  assert.equal(security.readCursor(value, "owner-A:skill-1"), id);
  for (const scope of ["owner-B:skill-1", "owner-A:skill-2"])
    assert.throws(
      () => security.readCursor(value, scope),
      fault(400, "invalid_input"),
    );
  assert.throws(
    () => security.readCursor(value + "x", "owner-A:skill-1"),
    fault(400, "invalid_input"),
  );
});
test("fingerprints ignore JSON key order while retaining scope and raw meaning", () => {
  const security = new Security(settings());
  assert.equal(
    security.fingerprint({ a: 1, b: { raw: "س = ٢" } }),
    security.fingerprint({ b: { raw: "س = ٢" }, a: 1 }),
  );
  assert.notEqual(
    security.fingerprint({ raw: "س = ٢" }),
    security.fingerprint({ raw: "س = -٢" }),
  );
  assert.notEqual(
    security.fingerprint({ id: "a", body: {} }),
    security.fingerprint({ id: "b", body: {} }),
  );
});
test("OpenAPI DTO rejects browser AST, unexpected fields, invalid revisions and long raw input", () => {
  const body = {
    expectedRevision: 0,
    position: 1,
    sourceRaw: "٢(س + ٣) = ١٠",
    inputOrigin: "math_editor",
  };
  assert.deepEqual(input("CreateStepInput", body), body);
  for (const invalid of [
    { ...body, ast: {} },
    { ...body, expectedRevision: -1 },
    { ...body, expectedRevision: 2147483648 },
    { ...body, sourceRaw: "س".repeat(257) },
    { ...body, inputOrigin: "ai" },
    { ...body, position: 0 },
  ])
    assert.throws(
      () => input("CreateStepInput", invalid),
      fault(422, "invalid_input"),
    );
  assert.equal(
    input("CreateStepInput", { ...body, sourceRaw: "😀".repeat(256) }).sourceRaw
      .length,
    512,
  );
  assert.throws(
    () => input("CreateGuestInput", { name: "secret" }),
    fault(422, "invalid_input"),
  );
  assert.throws(() => uuid("not-a-uuid"), fault(400, "invalid_input"));
  assert.equal(uuid(randomUUID()).length, 36);
  assert.throws(() => idempotencyHeader("short"), fault(400, "invalid_input"));
  assert.throws(
    () => idempotencyHeader(["valid_key_123"]),
    fault(400, "invalid_input"),
  );
  assert.equal(idempotencyHeader("valid_key_123"), "valid_key_123");
});
test("AI boundary cannot invent a verdict or disclose provider output", async () => {
  await assert.rejects(
    new DisabledAiAdapter().rephraseReviewedTemplate("unreviewed"),
    fault(503, "ai_unavailable"),
  );
});
test("experimental limiter separates guests and resets its bounded time window", () => {
  const limits = new RequestLimits(2, 60);
  limits.take("A", 1000);
  limits.take("A", 1000);
  limits.take("B", 1000);
  assert.throws(
    () => limits.take("A", 1000),
    (e) => e.status === 429 && e.retryAfterSeconds === 60,
  );
  limits.take("A", 61001);
});
