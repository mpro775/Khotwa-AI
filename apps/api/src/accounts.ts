import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  ApiFault,
  metadata,
  type RequestContext,
  type ResponseContext,
} from "./http";
import { cookieValue, equal, hmac, secureCookie } from "./security";
import { idempotencyHeader, uuid } from "./contracts";
import { Store, type GuestAuth } from "./store";
import { summarizeSkill, type ProgressEvidence } from "./progress";
import { accountMailFromEnvironment, type AccountMail } from "./account-mail";

export type AccountRole = "student" | "teacher" | "content_manager" | "admin";
export interface ProductActor {
  ownerKey: string;
  userId: string | null;
  guestId: string | null;
  role: AccountRole;
  csrfToken: string;
  authSessionId?: string;
  guestAuth?: GuestAuth;
}
interface UserRow {
  id: string;
  email_normalized: string;
  role: AccountRole;
  status: string;
  is_internal: boolean;
  learning_guest_id: string | null;
  email_verified_at: Date;
  created_at: Date;
}
interface AccountRow extends UserRow {
  auth_session_id: string;
  expires_at: Date;
}
interface ChallengeRow {
  id: string;
  email_digest: Uint8Array;
  code_digest: Uint8Array;
  expires_at: Date;
  attempts: number;
  consumed_at: Date | null;
  delivery_state: string;
}
interface VerifiedLoginCache {
  sessionId: string;
  userId: string;
}
const bytes = (hex: string) => Buffer.from(hex, "hex");
const missing = () => new ApiFault(404, "not_found", "المورد غير متاح.");
const denied = () =>
  new ApiFault(401, "unauthenticated", "سجل الدخول للمتابعة.");
export function accountObject(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new ApiFault(422, "invalid_input", "راجع الحقول المطلوبة للطلب.");
  return value as Record<string, unknown>;
}
export function normalizeAccountEmail(value: unknown): string {
  if (typeof value !== "string")
    throw new ApiFault(422, "invalid_input", "أدخل بريدًا إلكترونيًا صالحًا.");
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9.-]{0,188}[a-z0-9])?\.[a-z]{2,63}$/.test(
      email,
    )
  )
    throw new ApiFault(422, "invalid_input", "أدخل بريدًا إلكترونيًا صالحًا.");
  return email;
}
const envList = (name: string) =>
  (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
const numberOption = (
  name: string,
  fallback: number,
  maximum: number,
): number => {
  const value =
    process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw new Error("INVALID_ACCOUNT_LIMIT");
  return value;
};
const userDto = (user: UserRow) => ({
  id: user.id,
  email: user.email_normalized,
  role: user.role,
  status: user.status,
  isInternal: user.is_internal,
});

export class AccountService {
  readonly mail: AccountMail;
  readonly enabled: boolean;
  readonly otpSeconds: number;
  readonly sessionSeconds: number;
  private readonly otpKey: string;
  constructor(
    readonly store: Store,
    mail?: AccountMail,
  ) {
    this.enabled = process.env.ACCOUNTS_ENABLED === "true";
    this.otpSeconds = numberOption("ACCOUNT_OTP_TTL_SECONDS", 600, 1800);
    this.sessionSeconds = numberOption(
      "ACCOUNT_SESSION_TTL_SECONDS",
      604800,
      2592000,
    );
    this.otpKey = process.env.ACCOUNT_OTP_DIGEST_KEY ?? "";
    if (
      this.enabled &&
      (this.otpKey.length < 43 ||
        this.otpKey === store.security.settings.digestKey)
    )
      throw new Error("DISTINCT_ACCOUNT_OTP_DIGEST_KEY_REQUIRED");
    this.mail =
      mail ??
      (this.enabled
        ? accountMailFromEnvironment()
        : { sendLogin: async () => {} });
  }
  private available(): void {
    if (!this.enabled) throw missing();
  }
  private digestEmail(email: string): Buffer {
    return bytes(hmac(this.otpKey, "email:" + email));
  }
  private codeDigest(id: string, email: string, code: string): Buffer {
    return bytes(hmac(this.otpKey, "otp:" + id + ":" + email + ":" + code));
  }
  private async account(
    request: RequestContext,
    optional = false,
  ): Promise<{ row: AccountRow; token: string } | null> {
    const token = cookieValue(request, "kh_account");
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      if (optional) return null;
      throw denied();
    }
    const [row] = await this.store.db.$queryRaw<AccountRow[]>`
      SELECT u.*,s.id AS auth_session_id,s.expires_at FROM users u JOIN auth_sessions s ON s.user_id=u.id
      WHERE s.token_digest=${bytes(this.store.security.digest("account:" + token))} AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active'`;
    if (!row) {
      if (optional) return null;
      throw denied();
    }
    this.checkBeta(row.email_normalized);
    return { row, token };
  }
  private checkBeta(email: string): void {
    if (process.env.BETA_ENABLED !== "true") return;
    if (
      process.env.BETA_ACCESS_PAUSED === "true" ||
      !envList("BETA_EMAIL_ALLOWLIST").includes(email)
    )
      throw new ApiFault(
        403,
        "forbidden",
        "هذه النسخة متاحة حاليًا للحسابات المدعوة فقط.",
      );
  }
  private write(request: RequestContext, csrf: string): string {
    this.store.security.checkOrigin(request);
    if (
      typeof request.headers["content-type"] !== "string" ||
      request.headers["content-type"].split(";")[0]?.trim() !==
        "application/json"
    )
      throw new ApiFault(400, "invalid_input", "أرسل الطلب بصيغة JSON.");
    const provided = request.headers["x-csrf-token"];
    if (typeof provided !== "string" || !equal(provided, csrf))
      throw new ApiFault(403, "csrf_invalid", "رمز حماية الجلسة غير صالح.");
    return idempotencyHeader(request.headers["idempotency-key"]);
  }
  private preAuth(request: RequestContext): { scope: string; key: string } {
    // A request/verification always uses a bootstrap nonce, even when signed in.
    // This keeps login CSRF separate from existing guest and account identities.
    const nonce = this.store.security.bootstrapNonce(request);
    if (
      typeof request.headers["content-type"] !== "string" ||
      !request.headers["content-type"].startsWith("application/json")
    )
      throw new ApiFault(400, "invalid_input", "أرسل الطلب بصيغة JSON.");
    return {
      scope: hmac(this.otpKey, "bootstrap:" + nonce),
      key: idempotencyHeader(request.headers["idempotency-key"]),
    };
  }
  async actor(
    request: RequestContext,
    write = false,
    roles?: string[],
  ): Promise<ProductActor> {
    const account = this.enabled ? await this.account(request, true) : null;
    let actor: ProductActor;
    if (account) {
      actor = {
        ownerKey: "user:" + account.row.id,
        userId: account.row.id,
        guestId: account.row.learning_guest_id,
        role: account.row.role,
        csrfToken: this.store.security.guestCsrf(account.token),
        authSessionId: account.row.auth_session_id,
      };
    } else {
      if (process.env.BETA_ENABLED === "true") throw denied();
      const guest = await this.store.authenticate(request, { guestOnly: true });
      if (!guest) throw denied();
      actor = {
        ownerKey: "guest:" + guest.row.id,
        userId: null,
        guestId: guest.row.id,
        role: "student",
        csrfToken: this.store.security.guestCsrf(guest.token),
        guestAuth: guest,
      };
    }
    if (roles && (!actor.userId || !roles.includes(actor.role)))
      throw new ApiFault(403, "forbidden", "هذا الإجراء يتطلب صلاحية معتمدة.");
    if (write) this.write(request, actor.csrfToken);
    return actor;
  }
  async authorizeInTransaction(
    tx: Prisma.TransactionClient,
    actor: ProductActor,
  ): Promise<void> {
    if (actor.userId && actor.authSessionId) {
      const [current] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT u.id FROM users u JOIN auth_sessions s ON s.user_id=u.id
        WHERE u.id=${actor.userId}::uuid AND s.id=${actor.authSessionId}::uuid AND u.status='active' AND s.revoked_at IS NULL AND s.expires_at>now() FOR SHARE OF u,s`;
      if (!current) throw denied();
    } else if (actor.guestAuth)
      await this.store.authorizeInTransaction(tx, actor.guestAuth);
    else throw denied();
  }
  async current(request: RequestContext, response: ResponseContext) {
    const account = this.enabled ? await this.account(request, true) : null;
    const guest = await this.store.authenticate(request, {
      optional: true,
      guestOnly: true,
    });
    const previousBootstrap = cookieValue(request, "kh_bootstrap");
    let bootstrap: { cookie: string; csrf: string } | null = null;
    if (previousBootstrap) {
      const csrf = this.store.security.bootstrapCsrf(previousBootstrap);
      try {
        // Verify the existing signed bootstrap without extending its lifetime.
        // Repeated identity reads must not rotate a pending login's replay scope.
        this.store.security.bootstrapNonce({
          headers: {
            cookie: "kh_bootstrap=" + previousBootstrap,
            origin: this.store.security.settings.origin,
            "sec-fetch-site": "same-origin",
            "x-csrf-token": csrf,
          },
        });
        bootstrap = { cookie: previousBootstrap, csrf };
      } catch {
        /* Expired or malformed bootstrap gets a fresh signed value. */
      }
    }
    if (!bootstrap) {
      bootstrap = this.store.security.bootstrap();
      response.setHeader(
        "Set-Cookie",
        secureCookie(
          "kh_bootstrap",
          bootstrap.cookie,
          this.store.security.settings.bootstrapSeconds,
        ),
      );
    }
    return {
      user: account ? userDto(account.row) : null,
      csrfToken: account
        ? this.store.security.guestCsrf(account.token)
        : guest
          ? this.store.security.guestCsrf(guest.token)
          : bootstrap.csrf,
      loginCsrfToken: bootstrap.csrf,
      guestAvailable:
        !!guest && account?.row.learning_guest_id !== guest.row.id,
    };
  }
  async requestCode(request: RequestContext, raw: unknown) {
    this.available();
    const body = accountObject(raw, ["email"]),
      email = normalizeAccountEmail(body.email);
    const { scope, key } = this.preAuth(request),
      keyDigest = bytes(this.store.security.keyDigest(key));
    const fingerprint = bytes(this.store.security.fingerprint({ email }));
    const id = randomUUID(),
      code = String(randomInt(0, 1000000)).padStart(6, "0"),
      emailDigest = this.digestEmail(email);
    // Do not expose allowlist membership or existence of an account.
    let permitted = true;
    try {
      this.checkBeta(email);
    } catch {
      permitted = false;
    }
    const result = await this.store.db.$transaction(async (tx) => {
      // Serialize the shared hourly ceiling across different email addresses
      // and API instances before counting and reserving a send.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71941020261109)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"otp:" + emailDigest.toString("hex")},0))`;
      const [cached] = await tx.$queryRaw<
        {
          fingerprint: Uint8Array;
          response: {
            challengeId: string;
            expiresInSeconds: number;
            resendAfterSeconds: number;
            delivery: string;
          };
          delivery_state: string | null;
          challenge_expires_at: Date | null;
        }[]
      >`
        SELECT k.fingerprint,k.response,c.delivery_state,c.expires_at AS challenge_expires_at FROM account_request_keys k
        LEFT JOIN email_login_challenges c ON c.id=(k.response->>'challengeId')::uuid
        WHERE k.scope_digest=${bytes(scope)} AND k.operation='email.request' AND k.key_digest=${keyDigest}`;
      if (cached) {
        if (!Buffer.from(cached.fingerprint).equals(fingerprint))
          throw new ApiFault(
            409,
            "idempotency_conflict",
            "استُخدم مفتاح الإرسال مع طلب مختلف.",
          );
        if (cached.delivery_state === "failed")
          throw new ApiFault(
            503,
            "internal_error",
            "تعذر إرسال رمز الدخول الآن. اطلب رمزًا جديدًا لاحقًا.",
            [],
            null,
            60,
          );
        if (
          !cached.challenge_expires_at ||
          cached.challenge_expires_at.getTime() <= Date.now()
        )
          throw new ApiFault(
            409,
            "invalid_state",
            "انتهى طلب الرمز السابق. اطلب رمزًا جديدًا.",
          );
        return { data: cached.response, send: false };
      }
      const [counts] = await tx.$queryRaw<
        { recent: bigint; hour: bigint; global_hour: bigint }[]
      >`
        SELECT count(*) FILTER(WHERE created_at>now()-interval '60 seconds' AND email_digest=${emailDigest}) AS recent,
          count(*) FILTER(WHERE created_at>now()-interval '1 hour' AND email_digest=${emailDigest}) AS hour,
          count(*) FILTER(WHERE created_at>now()-interval '1 hour') AS global_hour FROM email_login_challenges WHERE created_at>now()-interval '1 hour'`;
      if (
        Number(counts?.recent) > 0 ||
        Number(counts?.hour) >= 5 ||
        Number(counts?.global_hour) >=
          numberOption("ACCOUNT_GLOBAL_OTP_PER_HOUR", 200, 10000)
      )
        throw new ApiFault(
          429,
          "rate_limited",
          "انتظر قبل طلب رمز جديد.",
          [],
          null,
          60,
        );
      await tx.$executeRaw`UPDATE email_login_challenges SET consumed_at=now() WHERE email_digest=${emailDigest} AND consumed_at IS NULL`;
      await tx.$executeRaw`INSERT INTO email_login_challenges(id,email_digest,code_digest,expires_at,delivery_state)
        VALUES(${id}::uuid,${emailDigest},${this.codeDigest(id, email, code)},${new Date(Date.now() + this.otpSeconds * 1000)},${permitted ? "pending" : "suppressed"})`;
      const data = {
        challengeId: id,
        expiresInSeconds: this.otpSeconds,
        resendAfterSeconds: 60,
        delivery: "queued",
      };
      await tx.$executeRaw`INSERT INTO account_request_keys(id,scope_digest,operation,key_digest,fingerprint,response,expires_at)
        VALUES(${randomUUID()}::uuid,${bytes(scope)},'email.request',${keyDigest},${fingerprint},${JSON.stringify(data)}::jsonb,now()+interval '1 day')`;
      return { data, send: permitted };
    });
    if (result.send) {
      try {
        await this.mail.sendLogin({
          to: email,
          code,
          expiresMinutes: Math.ceil(this.otpSeconds / 60),
        });
        await this.store.db
          .$executeRaw`UPDATE email_login_challenges SET delivery_state='sent' WHERE id=${id}::uuid`;
      } catch {
        await this.store.db
          .$executeRaw`UPDATE email_login_challenges SET delivery_state='failed',consumed_at=now() WHERE id=${id}::uuid`;
        throw new ApiFault(
          503,
          "internal_error",
          "تعذر إرسال رمز الدخول الآن. حاول لاحقًا.",
        );
      }
    }
    return result.data;
  }
  async verifyCode(
    request: RequestContext,
    response: ResponseContext,
    raw: unknown,
  ) {
    this.available();
    const body = accountObject(raw, ["email", "challengeId", "code"]),
      email = normalizeAccountEmail(body.email);
    if (
      typeof body.code !== "string" ||
      !/^\d{6}$/.test(body.code) ||
      typeof body.challengeId !== "string"
    )
      throw new ApiFault(
        422,
        "invalid_input",
        "أدخل رمز التحقق المكوّن من ستة أرقام.",
      );
    const id = uuid(body.challengeId),
      code = body.code;
    const { scope, key } = this.preAuth(request);
    const keyDigest = bytes(this.store.security.keyDigest(key));
    const fingerprint = bytes(
      this.store.security.fingerprint({ email, challengeId: id, code }),
    );
    // A PRF binds the opaque token to this exact bootstrap proof and request
    // key. Only its digest and non-secret replay references reach PostgreSQL.
    const token = Buffer.from(
        hmac(
          this.store.security.settings.issueKey,
          "account-login-replay-v1:" +
            scope +
            ":" +
            id +
            ":" +
            keyDigest.toString("hex"),
        ),
        "hex",
      ).toString("base64url"),
      sessionId = randomUUID();
    const result = await this.store.db.$transaction(async (tx) => {
      const emailDigest = this.digestEmail(email);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"login-verify:" + scope + ":" + keyDigest.toString("hex")},0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"otp:" + emailDigest.toString("hex")},0))`;
      const [cached] = await tx.$queryRaw<
        { fingerprint: Uint8Array; response: VerifiedLoginCache }[]
      >`
        SELECT fingerprint,response FROM account_request_keys WHERE scope_digest=${bytes(scope)} AND operation='email.verify' AND key_digest=${keyDigest} AND expires_at>now()`;
      if (cached) {
        if (!Buffer.from(cached.fingerprint).equals(fingerprint))
          throw new ApiFault(
            409,
            "idempotency_conflict",
            "استُخدم مفتاح الإرسال مع طلب مختلف.",
          );
        const [active] = await tx.$queryRaw<
          AccountRow[]
        >`SELECT u.*,s.id AS auth_session_id,s.expires_at
          FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.id=${cached.response.sessionId}::uuid
          AND u.id=${cached.response.userId}::uuid AND s.token_digest=${bytes(this.store.security.digest("account:" + token))}
          AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active' FOR SHARE OF u,s`;
        if (!active) return null;
        this.checkBeta(active.email_normalized);
        return { user: active, expiresAt: active.expires_at };
      }
      const [challenge] = await tx.$queryRaw<
        ChallengeRow[]
      >`SELECT * FROM email_login_challenges WHERE id=${id}::uuid AND email_digest=${emailDigest} FOR UPDATE`;
      if (
        !challenge ||
        challenge.consumed_at ||
        challenge.expires_at.getTime() <= Date.now() ||
        challenge.attempts >= 5 ||
        challenge.delivery_state !== "sent"
      )
        return null;
      // Commit unsuccessful attempts; throwing inside this transaction would undo the counter.
      await tx.$executeRaw`UPDATE email_login_challenges SET attempts=attempts+1,consumed_at=CASE WHEN attempts+1>=5 THEN now() ELSE consumed_at END WHERE id=${id}::uuid`;
      if (
        !equal(
          Buffer.from(challenge.code_digest).toString("hex"),
          this.codeDigest(id, email, code).toString("hex"),
        )
      )
        return null;
      this.checkBeta(email);
      await tx.$executeRaw`UPDATE email_login_challenges SET consumed_at=now() WHERE id=${id}::uuid`;
      const isInternal = envList("ACCOUNT_INTERNAL_ALLOWLIST").includes(email);
      const role: AccountRole = envList("ACCOUNT_ADMIN_ALLOWLIST").includes(
        email,
      )
        ? "admin"
        : envList("ACCOUNT_CONTENT_MANAGER_ALLOWLIST").includes(email)
          ? "content_manager"
          : "student";
      await tx.$executeRaw`INSERT INTO users(id,email_normalized,email_verified_at,role,status,is_internal) VALUES(${randomUUID()}::uuid,${email},now(),${role},'active',${isInternal}) ON CONFLICT(email_normalized) DO NOTHING`;
      const [user] = await tx.$queryRaw<
        UserRow[]
      >`SELECT * FROM users WHERE email_normalized=${email} FOR UPDATE`;
      if (!user || user.status !== "active") return null;
      if (!user.learning_guest_id) {
        const guestId = randomUUID(),
          opaque = randomBytes(32).toString("base64url");
        await tx.$executeRaw`INSERT INTO guest_sessions(id,token_digest,status,expires_at) VALUES(${guestId}::uuid,${bytes(this.store.security.digest(opaque))},'active',${new Date(Date.now() + this.sessionSeconds * 1000)})`;
        await tx.$executeRaw`UPDATE users SET learning_guest_id=${guestId}::uuid WHERE id=${user.id}::uuid`;
        user.learning_guest_id = guestId;
      }
      await tx.$executeRaw`UPDATE guest_sessions SET status='active',revoked_at=NULL,last_seen_at=now(),expires_at=GREATEST(expires_at,${new Date(Date.now() + this.sessionSeconds * 1000)}) WHERE id=${user.learning_guest_id}::uuid`;
      const expiresAt = new Date(Date.now() + this.sessionSeconds * 1000);
      await tx.$executeRaw`INSERT INTO auth_sessions(id,user_id,token_digest,expires_at) VALUES(${sessionId}::uuid,${user.id}::uuid,${bytes(this.store.security.digest("account:" + token))},${expiresAt})`;
      const replay: VerifiedLoginCache = { sessionId, userId: user.id };
      await tx.$executeRaw`INSERT INTO account_request_keys(id,scope_digest,operation,key_digest,fingerprint,response,expires_at)
        VALUES(${randomUUID()}::uuid,${bytes(scope)},'email.verify',${keyDigest},${fingerprint},${JSON.stringify(replay)}::jsonb,${expiresAt})`;
      return { user, expiresAt };
    });
    if (!result)
      throw new ApiFault(
        401,
        "unauthenticated",
        "الرمز غير صالح أو انتهت صلاحيته. اطلب رمزًا جديدًا عند الحاجة.",
      );
    response.setHeader(
      "Set-Cookie",
      secureCookie(
        "kh_account",
        token,
        (result.expiresAt.getTime() - Date.now()) / 1000,
      ),
    );
    const guest = await this.store.authenticate(request, {
      optional: true,
      guestOnly: true,
    });
    return {
      user: userDto(result.user),
      csrfToken: this.store.security.guestCsrf(token),
      guestAvailable: !!guest,
    };
  }
  async claimGuest(request: RequestContext, raw: unknown) {
    const body = accountObject(raw, ["consent"]);
    if (body.consent !== true)
      throw new ApiFault(
        422,
        "invalid_input",
        "يلزم اختيار ربط بيانات الضيف صراحة.",
      );
    const actor = await this.actor(request, true);
    if (!actor.userId || !actor.guestId) throw denied();
    const guest = await this.store.authenticate(request, {
      guestOnly: true,
      logout: true,
    });
    if (!guest || guest.accountSessionId || guest.row.id === actor.guestId)
      throw new ApiFault(
        409,
        "invalid_state",
        "لا توجد جلسة ضيف مستقلة صالحة للربط.",
      );
    return this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.ownerKey},0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"guest:" + guest.row.id},0))`;
      await this.authorizeInTransaction(tx, actor);
      const [previous] = await tx.$queryRaw<
        { user_id: string; learning_session_count: number }[]
      >`SELECT user_id,learning_session_count FROM guest_account_claims WHERE guest_session_id=${guest.row.id}::uuid FOR UPDATE`;
      if (previous) {
        if (previous.user_id !== actor.userId) throw missing();
        return {
          claimed: true,
          learningSessionCount: previous.learning_session_count,
        };
      }
      await this.store.authorizeInTransaction(tx, guest);
      const [user] = await tx.$queryRaw<
        UserRow[]
      >`SELECT * FROM users WHERE id=${actor.userId}::uuid FOR UPDATE`;
      const sessions = await tx.$queryRaw<
        { id: string; is_synthetic: boolean }[]
      >`SELECT id,is_synthetic FROM learning_sessions WHERE guest_session_id=${guest.row.id}::uuid FOR UPDATE`;
      if (!user || sessions.some((s) => s.is_synthetic !== user.is_internal))
        throw new ApiFault(
          409,
          "invalid_state",
          "لا يمكن خلط البيانات الاصطناعية مع حسابات المتعلمين.",
        );
      await tx.$executeRaw`UPDATE learning_sessions SET guest_session_id=${actor.guestId}::uuid WHERE guest_session_id=${guest.row.id}::uuid`;
      await tx.$executeRaw`INSERT INTO content_exposures(id,guest_session_id,problem_revision_id,learning_family,equation_hash,exposure_kind,created_at)
        SELECT gen_random_uuid(),${actor.guestId}::uuid,problem_revision_id,learning_family,equation_hash,exposure_kind,created_at FROM content_exposures WHERE guest_session_id=${guest.row.id}::uuid ON CONFLICT(guest_session_id,problem_revision_id) DO NOTHING`;
      // The table is added by the next independent roadmap migration.
      const [product] = await tx.$queryRaw<
        { present: boolean }[]
      >`SELECT to_regclass('public.subject_attempts') IS NOT NULL AS present`;
      if (product?.present)
        await tx.$executeRaw`UPDATE subject_attempts SET owner_key=${actor.ownerKey} WHERE owner_key=${"guest:" + guest.row.id}`;
      await tx.$executeRaw`INSERT INTO guest_account_claims(id,guest_session_id,user_id,target_guest_id,learning_session_count,consent_version) VALUES(${randomUUID()}::uuid,${guest.row.id}::uuid,${actor.userId}::uuid,${actor.guestId}::uuid,${sessions.length},'explicit-account-link-v1')`;
      await tx.$executeRaw`UPDATE guest_sessions SET status='revoked',revoked_at=now() WHERE id=${guest.row.id}::uuid`;
      return { claimed: true, learningSessionCount: sessions.length };
    });
  }
  async attempts(request: RequestContext) {
    const actor = await this.actor(request);
    if (!actor.userId || !actor.guestId) throw denied();
    const rows = await this.store.db.$queryRaw<
      {
        id: string;
        learning_session_id: string;
        problem_revision_id: string;
        problem_id: string;
        revision: bigint;
        status: string;
        completion_verdict: string | null;
        updated_at: Date;
      }[]
    >`
      SELECT a.id,a.learning_session_id,a.problem_revision_id,r.problem_id,a.revision,a.status,a.completion_verdict,a.updated_at
      FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id JOIN problem_revisions r ON r.id=a.problem_revision_id
      WHERE l.guest_session_id=${actor.guestId}::uuid ORDER BY a.updated_at DESC,a.id LIMIT 50`;
    return {
      attempts: rows.map((row) => ({
        id: row.id,
        learningSessionId: row.learning_session_id,
        problemRevisionId: row.problem_revision_id,
        problemId: row.problem_id,
        revision: Number(row.revision),
        status: row.status,
        completionVerdict: row.completion_verdict,
        updatedAt: row.updated_at.toISOString(),
      })),
      subjectAttempts: await this.subjectAttempts(actor, 50),
      nextCursor: null,
    };
  }
  private async subjectAttempts(actor: ProductActor, limit: number) {
    const [relation] = await this.store.db.$queryRaw<
      { present: boolean }[]
    >`SELECT to_regclass('public.subject_attempts') IS NOT NULL AS present`;
    if (!relation?.present) return [];
    const rows = await this.store.db.$queryRaw<
      {
        id: string;
        subject_code: string;
        problem_revision_id: string;
        revision: number;
        source_raw: string;
        answer_json: unknown;
        verdict: unknown;
        assistance_level: number;
        independent: boolean;
        updated_at: Date;
      }[]
    >`
      SELECT id,subject_code,problem_revision_id,revision,source_raw,answer_json,verdict,assistance_level,independent,updated_at FROM subject_attempts
      WHERE owner_key=${actor.ownerKey} ORDER BY updated_at DESC,id LIMIT ${limit}`;
    return rows.map((row) => ({
      id: row.id,
      subjectCode: row.subject_code,
      problemRevisionId: row.problem_revision_id,
      revision: row.revision,
      sourceRaw: row.source_raw,
      answer: row.answer_json,
      verdict: row.verdict,
      assistanceLevel: row.assistance_level,
      independent: row.independent,
      updatedAt: row.updated_at.toISOString(),
    }));
  }
  async progress(request: RequestContext) {
    const actor = await this.actor(request);
    if (!actor.userId || !actor.guestId) throw denied();
    const [skills, evidence] = await Promise.all([
      this.store.db.$queryRaw<
        { id: string; skill_code: string; name_ar: string }[]
      >`SELECT DISTINCT s.id,s.skill_code,s.name_ar FROM skills s JOIN learning_sessions l ON l.release_id=s.release_id WHERE l.guest_session_id=${actor.guestId}::uuid AND s.status='active'`,
      this.store.db.$queryRaw<
        ProgressEvidence[]
      >`SELECT e.skill_id,e.event_kind,e.observation,e.created_at FROM current_skill_evidence e JOIN learning_sessions l ON l.id=e.learning_session_id WHERE l.guest_session_id=${actor.guestId}::uuid ORDER BY e.created_at DESC`,
    ]);
    const subjects = await this.subjectEvidence(actor);
    return {
      skills: skills.map((skill) => summarizeSkill(skill, evidence)),
      subjects,
      noteAr:
        "أدلة من محاولاتك الحالية؛ النجاح مع مساعدة يختلف عن دليل مستقل، ولا تمثل هذه البيانات إتقانًا دائمًا.",
    };
  }
  private async subjectEvidence(actor: ProductActor) {
    const [relation] = await this.store.db.$queryRaw<
      { present: boolean }[]
    >`SELECT to_regclass('public.subject_attempts') IS NOT NULL AS present`;
    if (!relation?.present) return [];
    const rows = await this.store.db.$queryRaw<
      {
        subject_code: string;
        payload: unknown;
        verdict: unknown;
        independent: boolean;
        assistance_level: number;
        updated_at: Date;
      }[]
    >`
      SELECT a.subject_code,r.payload,a.verdict,a.independent,a.assistance_level,a.updated_at FROM subject_attempts a JOIN studio_revisions r ON r.id=a.problem_revision_id
      WHERE a.owner_key=${actor.ownerKey} ORDER BY a.updated_at DESC LIMIT 1000`;
    const groups = new Map<
      string,
      {
        subjectCode: string;
        skillCode: string;
        evidenceCount: number;
        independentCount: number;
        assistedCount: number;
        state: string;
        updatedAt: string;
      }
    >();
    for (const row of rows) {
      const payload =
        row.payload && typeof row.payload === "object"
          ? (row.payload as Record<string, unknown>)
          : {};
      const verdict =
        row.verdict && typeof row.verdict === "object"
          ? (row.verdict as Record<string, unknown>)
          : {};
      const codes = Array.isArray(payload.skillCodes)
        ? payload.skillCodes.filter(
            (code): code is string => typeof code === "string",
          )
        : [];
      for (const skillCode of codes.length ? codes : [row.subject_code]) {
        const key = row.subject_code + ":" + skillCode;
        const group = groups.get(key) ?? {
          subjectCode: row.subject_code,
          skillCode,
          evidenceCount: 0,
          independentCount: 0,
          assistedCount: 0,
          state: "not_assessed",
          updatedAt: row.updated_at.toISOString(),
        };
        const assessable =
          row.subject_code === "physics"
            ? ["correct", "wrong_value", "wrong_unit"].includes(
                String(verdict.status),
              )
            : verdict.mode === "submit" &&
              typeof verdict.passed === "number" &&
              typeof verdict.total === "number" &&
              verdict.total > 0 &&
              !["service_error", "queued", "running", "unsupported"].includes(
                String(verdict.status),
              );
        const success =
          assessable &&
          (row.subject_code === "physics"
            ? verdict.status === "correct"
            : verdict.allPassed === true && verdict.passed === verdict.total);
        if (assessable) group.evidenceCount++;
        if (success && row.independent && row.assistance_level === 0)
          group.independentCount++;
        if (success && (!row.independent || row.assistance_level > 0))
          group.assistedCount++;
        group.state = group.independentCount
          ? "new_independent_evidence"
          : group.assistedCount
            ? "assisted_evidence"
            : group.evidenceCount
              ? "needs_review"
              : "not_assessed";
        groups.set(key, group);
      }
    }
    return [...groups.values()];
  }
  async logout(request: RequestContext, response: ResponseContext) {
    const actor = await this.actor(request, true);
    if (!actor.userId || !actor.authSessionId) throw denied();
    await this.store.db
      .$executeRaw`UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE id=${actor.authSessionId}::uuid AND user_id=${actor.userId}::uuid`;
    response.setHeader("Set-Cookie", secureCookie("kh_account", "", 0));
    return { loggedOut: true };
  }
  async requestDeletion(
    request: RequestContext,
    response: ResponseContext,
    raw: unknown,
  ) {
    const body = accountObject(raw, ["confirm"]);
    if (body.confirm !== true)
      throw new ApiFault(422, "invalid_input", "يلزم تأكيد طلب محو الحساب.");
    const actor = await this.actor(request, true);
    if (!actor.userId) throw denied();
    await this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.ownerKey},0))`;
      await this.authorizeInTransaction(tx, actor);
      await tx.$executeRaw`INSERT INTO account_deletion_requests(id,user_id,status) VALUES(${randomUUID()}::uuid,${actor.userId}::uuid,'requested') ON CONFLICT(user_id) DO NOTHING`;
      await tx.$executeRaw`UPDATE users SET status='deletion_requested' WHERE id=${actor.userId}::uuid`;
      await tx.$executeRaw`UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=${actor.userId}::uuid`;
      await tx.$executeRaw`UPDATE guest_sessions SET status='revoked',revoked_at=now() WHERE id=${actor.guestId}::uuid`;
    });
    response.setHeader("Set-Cookie", secureCookie("kh_account", "", 0));
    return {
      status: "deletion_requested",
      accessRevoked: true,
      noteAr:
        "سُجل طلب المحو وأُوقف الوصول. تسجيل الطلب لا يعني اكتمال المحو من قاعدة البيانات أو النسخ الاحتياطية.",
    };
  }
  async export(request: RequestContext) {
    const actor = await this.actor(request);
    if (!actor.userId || !actor.guestId) throw denied();
    const [user] = await this.store.db.$queryRaw<
      UserRow[]
    >`SELECT * FROM users WHERE id=${actor.userId}::uuid`;
    const [attempts, progress, steps, subjectAttempts] = await Promise.all([
      this.attempts(request),
      this.progress(request),
      this.store.db.$queryRaw<
        {
          attempt_id: string;
          position: number;
          version_number: number;
          source_raw: string;
          created_at: Date;
        }[]
      >`
        SELECT s.attempt_id,s.position,v.version_number,v.source_raw,v.created_at FROM step_versions v JOIN step_slots s ON s.id=v.step_slot_id
        JOIN attempts a ON a.id=s.attempt_id JOIN learning_sessions l ON l.id=a.learning_session_id WHERE l.guest_session_id=${actor.guestId}::uuid ORDER BY v.created_at LIMIT 5000`,
      this.subjectAttempts(actor, 1000),
    ]);
    return {
      user: user ? userDto(user) : null,
      attempts: attempts.attempts,
      subjectAttempts,
      progress,
      steps: steps.map((s) => ({
        attemptId: s.attempt_id,
        position: s.position,
        version: s.version_number,
        sourceRaw: s.source_raw,
        createdAt: s.created_at.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
      limits: { attempts: 50, stepVersions: 5000, subjectAttempts: 1000 },
      noteAr:
        "يتضمن التصدير بيانات حسابك فقط، مع الحدود المذكورة. لا يتضمن أسرار الجلسات أو مفاتيح الحلول.",
    };
  }
}

const envelope = (request: RequestContext, data: unknown) => ({
  data,
  meta: metadata(request),
});
@Controller("api/v1")
export class AccountsController {
  constructor(private readonly accounts: AccountService) {}
  @Get("me") async me(
    @Req() req: RequestContext,
    @Res({ passthrough: true }) res: ResponseContext,
  ) {
    return envelope(req, await this.accounts.current(req, res));
  }
  @Post("auth/email/request") @HttpCode(200) async request(
    @Req() req: RequestContext,
    @Body() body: unknown,
  ) {
    return envelope(req, await this.accounts.requestCode(req, body));
  }
  @Post("auth/email/verify") @HttpCode(200) async verify(
    @Req() req: RequestContext,
    @Res({ passthrough: true }) res: ResponseContext,
    @Body() body: unknown,
  ) {
    return envelope(req, await this.accounts.verifyCode(req, res, body));
  }
  @Post("auth/logout") @HttpCode(200) async logout(
    @Req() req: RequestContext,
    @Res({ passthrough: true }) res: ResponseContext,
    @Body() body: unknown,
  ) {
    accountObject(body, []);
    return envelope(req, await this.accounts.logout(req, res));
  }
  @Post("me/claim-guest") @HttpCode(200) async claim(
    @Req() req: RequestContext,
    @Body() body: unknown,
  ) {
    return envelope(req, await this.accounts.claimGuest(req, body));
  }
  @Get("me/attempts") async attempts(@Req() req: RequestContext) {
    return envelope(req, await this.accounts.attempts(req));
  }
  @Get("me/progress") async progress(@Req() req: RequestContext) {
    return envelope(req, await this.accounts.progress(req));
  }
  @Get("me/export") async export(@Req() req: RequestContext) {
    return envelope(req, await this.accounts.export(req));
  }
  @Delete("me") @HttpCode(202) async deletion(
    @Req() req: RequestContext,
    @Res({ passthrough: true }) res: ResponseContext,
    @Body() body: unknown,
  ) {
    return envelope(req, await this.accounts.requestDeletion(req, res, body));
  }
}
