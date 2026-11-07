import { publicMathReport } from "./learning-policy";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { OnModuleDestroy } from "@nestjs/common";
import { Schema, internalValue, output } from "./contracts";
import { ApiFault, RequestContext } from "./http";
import { Security, cookieValue } from "./security";
import { TransitionResult } from "./math-gateway";
import { projectDiagnosis } from "./diagnosis";
import {
  ph08Active,
  recordExposure,
  requireAssignmentCurrent,
} from "./learning";

type Tx = Prisma.TransactionClient;
type GuestRow = {
  id: string;
  status: Schema<"GuestSession">["status"];
  expires_at: Date;
  created_at: Date;
  last_seen_at: Date;
};
export interface GuestAuth {
  row: GuestRow;
  token: string;
  accountSessionId?: string;
  accountUserId?: string;
}
type LearningRow = {
  id: string;
  guest_session_id: string;
  release_id: string;
  status: Schema<"LearningSession">["status"];
  started_at: Date;
  ended_at: Date | null;
  is_synthetic: boolean;
};
export type AttemptRow = {
  id: string;
  learning_session_id: string;
  problem_revision_id: string;
  attempt_kind: Schema<"Attempt">["kind"];
  revision: bigint;
  status: Schema<"Attempt">["status"];
  completion_verdict: Schema<"Attempt">["completionVerdict"];
  notation_profile: "ar-mashriq-school-v1";
  opened_at: Date;
  updated_at: Date;
  highest_hint_level_seen?: number;
  independent_evidence_eligible?: boolean;
  full_solution_seen?: boolean;
  assistance_revision?: number;
};
export type StepRow = {
  id: string;
  position: number;
  current_version: number;
  is_active: boolean;
  updated_at: Date;
  version_id: string;
  source_raw: string;
  parse_status?: Schema<"MathSource">["parseStatus"] | "service_error";
  display_text?: string | null;
};
type ProblemRow = {
  id: string;
  problem_id: string;
  version_number: number;
  statement_ar: string;
  original_equation_raw: string;
  item_kind: Schema<"ProblemDetail">["kind"];
  skill_id: string;
  difficulty_band: number;
  notation_profile: "ar-mashriq-school-v1";
  release_id: string;
};
export interface MutationResult<T> {
  status: number;
  data: T;
}
export interface VerificationSnapshot {
  runId: string;
  attemptId: string;
  revision: number;
  problemRevisionId: string;
  notationProfile: string;
  engineVersion: string;
  fromVersionId: string | null;
  toVersionId: string;
  fromRaw: string;
  toRaw: string;
}
const missing = () => new ApiFault(404, "not_found", "المورد غير متاح.");
const invalidState = () =>
  new ApiFault(409, "invalid_state", "العملية غير متاحة في الحالة الحالية.");
const bytes = (hex: string) => Buffer.from(hex, "hex");
export const guestDto = (g: GuestRow): Schema<"GuestSession"> => ({
  id: g.id,
  status: g.status,
  expiresAt: g.expires_at.toISOString(),
  createdAt: g.created_at.toISOString(),
});
const learningDto = (l: LearningRow): Schema<"LearningSession"> => ({
  id: l.id,
  status: l.status,
  releaseId: l.release_id,
  startedAt: l.started_at.toISOString(),
  endedAt: l.ended_at?.toISOString() ?? null,
  isSynthetic: l.is_synthetic,
});
const stepDto = (s: StepRow): Schema<"Step"> => ({
  id: s.id,
  position: s.position,
  currentVersion: s.current_version,
  source: {
    sourceRaw: s.source_raw,
    displayAr: s.parse_status === "parsed" ? (s.display_text ?? null) : null,
    parseStatus:
      s.parse_status === "service_error"
        ? "not_checked"
        : (s.parse_status ?? "not_checked"),
  },
  isActive: s.is_active,
  updatedAt: s.updated_at.toISOString(),
});

export class Store implements OnModuleDestroy {
  readonly db: PrismaClient;
  constructor(
    readonly security: Security,
    url: string,
    readonly syntheticData = false,
  ) {
    const parsed = new URL(url);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error("PostgreSQL URL required");
    this.db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: url,
        max: 8,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
      }),
      log: [],
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }
  async authorizeInTransaction(
    tx: Prisma.TransactionClient,
    auth: GuestAuth,
  ): Promise<void> {
    this.active(await this.lockGuest(tx, auth));
  }
  readAttemptInTransaction(
    tx: Prisma.TransactionClient,
    auth: GuestAuth,
    id: string,
  ): Promise<AttemptRow> {
    return this.attempt(tx, auth, id, true);
  }
  readStepsInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<StepRow[]> {
    return this.steps(tx, id);
  }
  private active(row: GuestRow, status = 401): void {
    if (
      row.status !== "active" ||
      row.expires_at.getTime() <= Date.now() ||
      row.last_seen_at.getTime() + 7200000 <= Date.now()
    )
      throw new ApiFault(
        status,
        "session_expired",
        "انتهت جلسة الضيف. ابدأ جلسة جديدة.",
      );
  }
  async authenticate(
    request: RequestContext,
    options: {
      optional?: boolean;
      current?: boolean;
      logout?: boolean;
      guestOnly?: boolean;
    } = {},
  ): Promise<GuestAuth | null> {
    const accountToken =
      !options.guestOnly && process.env.ACCOUNTS_ENABLED === "true"
        ? cookieValue(request, "kh_account")
        : null;
    if (accountToken) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(accountToken)) {
        if (options.optional) return null;
        throw new ApiFault(401, "unauthenticated", "جلسة الحساب غير صالحة.");
      }
      const [account] = await this.db.$queryRaw<
        (GuestRow & {
          account_session_id: string;
          account_user_id: string;
          email_normalized: string;
        })[]
      >`
        SELECT g.*,s.id AS account_session_id,u.id AS account_user_id,u.email_normalized
        FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN guest_sessions g ON g.id=u.learning_guest_id
        WHERE s.token_digest=${bytes(this.security.digest("account:" + accountToken))} AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active' AND g.status='active'`;
      if (!account) {
        if (options.optional) return null;
        throw new ApiFault(
          401,
          "session_expired",
          "انتهت جلسة الحساب. سجل الدخول مجددًا.",
        );
      }
      if (
        process.env.BETA_ENABLED === "true" &&
        (process.env.BETA_ACCESS_PAUSED === "true" ||
          !(process.env.BETA_EMAIL_ALLOWLIST ?? "")
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .includes(account.email_normalized))
      )
        throw new ApiFault(
          403,
          "forbidden",
          "هذه النسخة متاحة للحسابات المدعوة فقط.",
        );
      // Canonical learning ownership is bridged only by a verified account
      // session. Its opaque guest digest is never issued to a browser.
      await this.db
        .$executeRaw`UPDATE guest_sessions SET last_seen_at=now() WHERE id=${account.id}::uuid AND status='active'`;
      return {
        row: { ...account, last_seen_at: new Date() },
        token: accountToken,
        accountSessionId: account.account_session_id,
        accountUserId: account.account_user_id,
      };
    }
    if (!options.guestOnly && process.env.BETA_ENABLED === "true") {
      if (options.optional) return null;
      throw new ApiFault(
        401,
        "unauthenticated",
        "سجل الدخول بالحساب المدعو للنسخة التجريبية.",
      );
    }
    const token = cookieValue(request, "kh_guest");
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      if (options.optional) return null;
      throw new ApiFault(401, "unauthenticated", "ابدأ جلسة ضيف للمتابعة.");
    }
    const rows = await this.db.$queryRaw<
      GuestRow[]
    >`SELECT id,status,expires_at,created_at,last_seen_at FROM guest_sessions WHERE token_digest=${bytes(this.security.digest(token))}`;
    const row = rows[0];
    if (!row) {
      if (options.optional) return null;
      throw new ApiFault(401, "unauthenticated", "جلسة الضيف غير صالحة.");
    }
    if (options.logout) return { row, token };
    try {
      this.active(row, options.current ? 410 : 401);
    } catch (error) {
      if (options.optional) return null;
      throw error;
    }
    // Conditional touch cannot revive a concurrently revoked or expired session.
    const touched = await this.db
      .$executeRaw`UPDATE guest_sessions SET last_seen_at=now() WHERE id=${row.id}::uuid AND status='active' AND expires_at>now() AND last_seen_at>now()-interval '2 hours'`;
    if (touched !== 1) {
      if (options.optional) return null;
      throw new ApiFault(
        options.current ? 410 : 401,
        "session_expired",
        "انتهت جلسة الضيف.",
      );
    }
    return { row: { ...row, last_seen_at: new Date() }, token };
  }
  async createGuest(
    nonce: string,
  ): Promise<{ auth: GuestAuth; created: boolean }> {
    const token = this.security.issueGuest(nonce),
      digest = bytes(this.security.digest(token));
    return this.db.$transaction(async (tx) => {
      const inserted =
        await tx.$executeRaw`INSERT INTO guest_sessions(id,token_digest,status,expires_at) VALUES(${randomUUID()}::uuid,${digest},'active',now()+interval '24 hours') ON CONFLICT(token_digest) DO NOTHING`;
      const [row] = await tx.$queryRaw<
        GuestRow[]
      >`SELECT id,status,expires_at,created_at,last_seen_at FROM guest_sessions WHERE token_digest=${digest} FOR UPDATE`;
      if (!row) throw invalidState();
      // Replaying an old bootstrap must never resurrect a revoked/expired token.
      this.active(row, 403);
      return { auth: { row, token }, created: inserted === 1 };
    });
  }
  private async lockGuest(tx: Tx, auth: GuestAuth): Promise<GuestRow> {
    if (auth.accountSessionId && auth.accountUserId) {
      const [row] = await tx.$queryRaw<
        GuestRow[]
      >`SELECT g.* FROM guest_sessions g
        JOIN users u ON u.learning_guest_id=g.id JOIN auth_sessions s ON s.user_id=u.id
        WHERE g.id=${auth.row.id}::uuid AND u.id=${auth.accountUserId}::uuid AND u.status='active'
        AND s.id=${auth.accountSessionId}::uuid AND s.token_digest=${bytes(this.security.digest("account:" + auth.token))}
        AND s.revoked_at IS NULL AND s.expires_at>now() FOR UPDATE OF g FOR SHARE OF u,s`;
      if (!row)
        throw new ApiFault(401, "session_expired", "انتهت جلسة الحساب.");
      return { ...row, last_seen_at: new Date() };
    }
    const [row] = await tx.$queryRaw<
      GuestRow[]
    >`SELECT id,status,expires_at,created_at,last_seen_at FROM guest_sessions WHERE id=${auth.row.id}::uuid AND token_digest=${bytes(this.security.digest(auth.token))} FOR UPDATE`;
    if (!row)
      throw new ApiFault(401, "unauthenticated", "جلسة الضيف غير صالحة.");
    return row;
  }
  async mutate<T>(
    auth: GuestAuth,
    operation: string,
    key: string,
    body: unknown,
    work: (tx: Tx) => Promise<MutationResult<T>>,
    logout = false,
    replay?: (tx: Tx, cached: T) => Promise<T>,
  ): Promise<MutationResult<T>> {
    const keyHash = bytes(this.security.keyDigest(key)),
      fingerprint = bytes(this.security.fingerprint(body));
    return this.db.$transaction(
      async (tx) => {
        const guest = await this.lockGuest(tx, auth);
        if (!logout) this.active(guest);
        const [existing] = await tx.$queryRaw<
          {
            fingerprint: Uint8Array;
            state: string;
            response_code: number;
            response_cache: T;
          }[]
        >`SELECT fingerprint,state,response_code,response_cache FROM idempotency_records WHERE guest_session_id=${guest.id}::uuid AND operation=${operation} AND key_digest=${keyHash}`;
        if (existing) {
          if (!Buffer.from(existing.fingerprint).equals(fingerprint))
            throw new ApiFault(
              409,
              "idempotency_conflict",
              "استُخدم مفتاح الإرسال مع طلب مختلف.",
            );
          if (existing.state !== "completed")
            throw new ApiFault(
              409,
              "request_in_progress",
              "الطلب قيد التنفيذ.",
            );
          return {
            status: existing.response_code,
            data: replay
              ? await replay(tx, existing.response_cache)
              : existing.response_cache,
          };
        }
        this.active(guest);
        const id = randomUUID();
        await tx.$executeRaw`INSERT INTO idempotency_records(id,guest_session_id,operation,key_digest,fingerprint,state,expires_at) VALUES(${id}::uuid,${guest.id}::uuid,${operation},${keyHash},${fingerprint},'processing',${guest.expires_at})`;
        const result = await work(tx);
        const cache = JSON.stringify(result.data);
        if (Buffer.byteLength(cache) > 60000)
          throw new Error("Idempotency response bound exceeded");
        await tx.$executeRaw`UPDATE idempotency_records SET state='completed',response_code=${result.status},response_cache=${cache}::jsonb WHERE id=${id}::uuid`;
        await tx.$executeRaw`INSERT INTO audit_events(id,correlation_id,entity_kind,entity_id,event_code) VALUES(${randomUUID()}::uuid,${randomUUID()}::uuid,'guest',${guest.id}::uuid,${operation})`;
        return result;
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }
  async revoke(auth: GuestAuth, key: string): Promise<MutationResult<null>> {
    if (auth.accountSessionId)
      throw new ApiFault(
        409,
        "invalid_state",
        "استخدم تسجيل خروج الحساب؛ إنهاء الضيف لا يلغي بيانات حسابك.",
      );
    return this.mutate(
      auth,
      "guest.revoke",
      key,
      {},
      async (tx) => {
        await tx.$executeRaw`UPDATE guest_sessions SET status='revoked',revoked_at=now() WHERE id=${auth.row.id}::uuid`;
        return { status: 204, data: null };
      },
      true,
    );
  }
  private async learning(
    tx: Tx,
    auth: GuestAuth,
    id: string,
  ): Promise<LearningRow> {
    const [row] = await tx.$queryRaw<
      LearningRow[]
    >`SELECT l.* FROM learning_sessions l WHERE l.id=${id}::uuid AND l.guest_session_id=${auth.row.id}::uuid`;
    if (!row) throw missing();
    return row;
  }
  async createLearning(
    auth: GuestAuth,
    key: string,
    body: Schema<"CreateLearningSessionInput">,
  ): Promise<MutationResult<Schema<"LearningSession">>> {
    return this.mutate(auth, "learning.create", key, body, async (tx) => {
      const [release] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM content_releases WHERE status='published' AND release_code NOT LIKE 'studio-%' ORDER BY published_at DESC,id LIMIT 1 FOR SHARE`;
      if (!release)
        throw new ApiFault(
          409,
          "invalid_state",
          "لا تتوفر حزمة محتوى منشورة بعد المراجعة.",
        );
      const [row] = await tx.$queryRaw<
        LearningRow[]
      >`INSERT INTO learning_sessions(id,guest_session_id,release_id,status,session_policy_version,is_synthetic) VALUES(${randomUUID()}::uuid,${auth.row.id}::uuid,${release.id}::uuid,'active','p0-policy-draft-1',${this.syntheticData}) RETURNING *`;
      if (!row) throw invalidState();
      return { status: 201, data: learningDto(row) };
    });
  }
  async getLearning(
    auth: GuestAuth,
    id: string,
  ): Promise<Schema<"LearningSession">> {
    return learningDto(await this.learning(this.db, auth, id));
  }
  private async problemRows(tx: Tx, where: Prisma.Sql): Promise<ProblemRow[]> {
    const studioGate =
      process.env.ACCOUNTS_ENABLED === "true"
        ? Prisma.sql`AND (c.release_code NOT LIKE 'studio-%' OR EXISTS(SELECT 1 FROM studio_algebra_links sl JOIN studio_revisions sr ON sr.id=sl.studio_revision_id WHERE sl.problem_revision_id=r.id AND sr.status='published'))`
        : Prisma.empty;
    return tx.$queryRaw<
      ProblemRow[]
    >(Prisma.sql`SELECT r.id,r.problem_id,r.version_number,r.statement_ar,r.original_equation_raw,r.item_kind,ps.skill_id,r.difficulty_band,r.notation_profile,r.release_id
      FROM problem_revisions r JOIN problems p ON p.id=r.problem_id JOIN content_releases c ON c.id=r.release_id
      JOIN problem_skills ps ON ps.problem_revision_id=r.id AND ps.coverage_kind='primary' JOIN skills s ON s.id=ps.skill_id
      WHERE c.status='published' AND r.review_status='published' AND r.item_kind='main' AND p.archived_at IS NULL AND s.status='active'
      ${studioGate} AND ${where}`);
  }
  private problemDto(p: ProblemRow): Schema<"ProblemDetail"> {
    return {
      id: p.problem_id,
      revisionId: p.id,
      versionNumber: p.version_number,
      statementAr: p.statement_ar,
      originalEquation: p.original_equation_raw,
      kind: p.item_kind,
      primarySkillId: p.skill_id,
      notationProfile: p.notation_profile,
      difficultyBand: p.difficulty_band,
      contentReleaseId: p.release_id,
    };
  }
  async getAttemptProblem(
    auth: GuestAuth,
    id: string,
  ): Promise<Schema<"ProblemDetail">> {
    return this.db.$transaction(async (tx) => {
      await this.authorizeInTransaction(tx, auth);
      const attempt = await this.attempt(tx, auth, id);
      const [problem] = await tx.$queryRaw<
        ProblemRow[]
      >`SELECT r.*,ps.skill_id FROM problem_revisions r JOIN problem_skills ps ON ps.problem_revision_id=r.id AND ps.coverage_kind='primary' WHERE r.id=${attempt.problem_revision_id}::uuid`;
      if (!problem) throw missing();
      return this.problemDto(problem);
    });
  }
  async getProblem(
    id: string,
    auth?: GuestAuth,
  ): Promise<Schema<"ProblemDetail">> {
    const rows = await this.problemRows(
      this.db,
      Prisma.sql`r.problem_id=${id}::uuid ORDER BY r.version_number DESC LIMIT 1`,
    );
    if (!rows[0] && ph08Active() && auth) {
      const assigned = await this.db.$queryRaw<
        ProblemRow[]
      >`SELECT r.*,ps.skill_id FROM problem_revisions r JOIN learning_assignments x ON x.problem_revision_id=r.id JOIN learning_episodes e ON e.id=x.episode_id JOIN attempts a ON a.id=e.root_attempt_id JOIN learning_sessions l ON l.id=a.learning_session_id JOIN problem_skills ps ON ps.problem_revision_id=r.id AND ps.coverage_kind='primary' JOIN content_pairings p ON p.id=x.pairing_id JOIN content_releases c ON c.id=r.release_id WHERE r.problem_id=${id}::uuid AND l.guest_session_id=${auth.row.id}::uuid AND l.is_synthetic AND e.root_revision=a.revision AND e.state<>'cancelled' AND x.invalidated_at IS NULL AND p.enabled AND c.status='published' AND r.review_status='published' ORDER BY x.assigned_at DESC LIMIT 1`;
      if (assigned[0]) return this.problemDto(assigned[0]);
    }
    if (!rows[0]) throw missing();
    if (ph08Active() && auth)
      await this.db.$transaction(async (tx) => {
        await this.authorizeInTransaction(tx, auth);
        await recordExposure(tx, auth.row.id, rows[0]!.id, "catalog_read");
      });
    return this.problemDto(rows[0]);
  }
  async listProblems(
    skillId: string,
    limit: number,
    cursor: string | null,
  ): Promise<Schema<"ListProblems">> {
    try {
      await this.getSkill(skillId);
    } catch (error) {
      if (error instanceof ApiFault && error.status === 404)
        throw new ApiFault(
          422,
          "invalid_input",
          "المهارة غير متاحة في الكتالوج المنشور.",
        );
      throw error;
    }
    const rows = await this.problemRows(
      this.db,
      Prisma.sql`ps.skill_id=${skillId}::uuid AND (${cursor}::uuid IS NULL OR r.id>${cursor}::uuid) ORDER BY r.id LIMIT ${limit + 1}`,
    );
    const items = rows.slice(0, limit).map((p) => ({
      id: p.problem_id,
      revisionId: p.id,
      titleAr: p.statement_ar,
      kind: p.item_kind,
      skillId: p.skill_id,
      difficultyBand: p.difficulty_band,
      notationProfile: p.notation_profile,
      contentReleaseId: p.release_id,
    }));
    return {
      items,
      nextCursor:
        rows.length > limit
          ? this.security.cursor("problems:" + skillId, rows[limit - 1]!.id)
          : null,
    };
  }
  private async skillRows(id: string | null): Promise<Schema<"Skill">[]> {
    type SkillRow = {
      id: string;
      skill_code: Schema<"Skill">["code"];
      name_ar: string;
      learning_objective_ar: string;
      prerequisites: string[];
      count: bigint;
    };
    const rows = await this.db.$queryRaw<
      SkillRow[]
    >`SELECT s.id,s.skill_code,s.name_ar,s.learning_objective_ar,
      ARRAY(SELECT prerequisite_skill_id FROM skill_prerequisites WHERE skill_id=s.id ORDER BY prerequisite_skill_id) AS prerequisites,
      (SELECT count(*) FROM problem_skills ps JOIN problem_revisions p ON p.id=ps.problem_revision_id JOIN problems base ON base.id=p.problem_id
       WHERE ps.skill_id=s.id AND ps.coverage_kind='primary' AND p.review_status='published' AND p.item_kind='main' AND base.archived_at IS NULL) AS count
      FROM skills s JOIN content_releases c ON c.id=s.release_id WHERE c.status='published' AND s.status='active'
      AND (${id}::uuid IS NULL OR s.id=${id}::uuid) AND (${id}::uuid IS NOT NULL OR c.id=(SELECT id FROM content_releases WHERE status='published' AND release_code NOT LIKE 'studio-%' ORDER BY published_at DESC,id LIMIT 1)) ORDER BY s.sort_order,s.id`;
    return rows.map((s) => ({
      id: s.id,
      code: s.skill_code,
      titleAr: s.name_ar,
      objectiveAr: s.learning_objective_ar,
      prerequisiteSkillIds: s.prerequisites,
      availableProblemCount: Number(s.count),
      availability: Number(s.count) > 0 ? "available" : "unavailable",
    }));
  }
  async listSkills(): Promise<{ items: Schema<"Skill">[] }> {
    return { items: await this.skillRows(null) };
  }
  async getSkill(id: string): Promise<Schema<"Skill">> {
    const [s] = await this.skillRows(id);
    if (!s) throw missing();
    return s;
  }
  private async attempt(
    tx: Tx,
    auth: GuestAuth,
    id: string,
    lock = false,
  ): Promise<AttemptRow> {
    const [row] = await tx.$queryRaw<AttemptRow[]>(
      Prisma.sql`SELECT a.* FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id WHERE a.id=${id}::uuid AND l.guest_session_id=${auth.row.id}::uuid ${lock ? Prisma.sql`FOR UPDATE OF a` : Prisma.empty}`,
    );
    if (!row) throw missing();
    return row;
  }
  private steps(tx: Tx, id: string): Promise<StepRow[]> {
    return tx.$queryRaw<
      StepRow[]
    >`SELECT s.*,v.id AS version_id,v.source_raw,p.parse_status,p.display_text FROM step_slots s JOIN step_versions v ON v.step_slot_id=s.id AND v.version_number=s.current_version LEFT JOIN LATERAL (SELECT parse_status,display_text FROM parse_results WHERE step_version_id=v.id AND engine_version='0.3.0' AND notation_profile_version='ar-mashriq-school-v1' ORDER BY created_at DESC,id DESC LIMIT 1) p ON true WHERE s.attempt_id=${id}::uuid AND s.is_active ORDER BY s.position`;
  }
  private async attemptDto(tx: Tx, a: AttemptRow): Promise<Schema<"Attempt">> {
    const [current] = await tx.$queryRaw<
      { report_json: unknown }[]
    >`SELECT report_json FROM verification_reports WHERE attempt_id=${a.id}::uuid AND attempt_revision=${a.revision} AND problem_revision_id=${a.problem_revision_id}::uuid AND engine_version='0.3.0' AND notation_profile=${a.notation_profile} AND dispatch_status='finished' AND report_json->>'isCurrent'='true' ORDER BY (scope='current_sequence') DESC,finished_at DESC,id DESC LIMIT 1`;
    return {
      id: a.id,
      learningSessionId: a.learning_session_id,
      problemRevisionId: a.problem_revision_id,
      kind: a.attempt_kind,
      revision: Number(a.revision),
      status: a.status,
      completionVerdict: a.completion_verdict,
      notationProfile: a.notation_profile,
      steps: (await this.steps(tx, a.id)).map(stepDto),
      openedAt: a.opened_at.toISOString(),
      updatedAt: a.updated_at.toISOString(),
      parentEpisodeId: ph08Active()
        ? ((
            await tx.$queryRaw<
              { episode_id: string }[]
            >`SELECT episode_id FROM learning_assignments WHERE attempt_id=${a.id}::uuid`
          )[0]?.episode_id ?? null)
        : null,
      currentVerification: current
        ? publicMathReport(
            a.attempt_kind,
            await projectDiagnosis(
              tx,
              output("VerificationReport", current.report_json),
            ),
          )
        : null,
    };
  }
  async createAttempt(
    auth: GuestAuth,
    key: string,
    body: Schema<"CreateAttemptInput">,
  ): Promise<MutationResult<Schema<"Attempt">>> {
    return this.mutate(auth, "attempt.create", key, body, async (tx) => {
      const learning = await this.learning(tx, auth, body.learningSessionId);
      if (learning.status !== "active") throw invalidState();
      if (body.source.kind === "assignment") {
        if (!ph08Active() || !learning.is_synthetic) throw missing();
        const [x] = await tx.$queryRaw<
          {
            id: string;
            problem_revision_id: string;
            phase: "remediation" | "transfer";
            attempt_id: string | null;
            episode_id: string;
          }[]
        >`SELECT x.* FROM learning_assignments x JOIN learning_episodes e ON e.id=x.episode_id JOIN attempts root ON root.id=e.root_attempt_id JOIN content_pairings p ON p.id=x.pairing_id WHERE x.id=${body.source.assignmentId}::uuid AND root.learning_session_id=${learning.id}::uuid AND root.revision=e.root_revision AND e.state<>'cancelled' AND x.invalidated_at IS NULL AND p.enabled FOR UPDATE OF x`;
        if (!x) throw missing();
        if (x.attempt_id)
          return {
            status: 201,
            data: await this.attemptDto(
              tx,
              await this.attempt(tx, auth, x.attempt_id, true),
            ),
          };
        const [p] = await tx.$queryRaw<
          { notation_profile: "ar-mashriq-school-v1" }[]
        >`SELECT notation_profile FROM problem_revisions WHERE id=${x.problem_revision_id}::uuid AND review_status='published'`;
        if (!p) throw missing();
        const [a] = await tx.$queryRaw<
          AttemptRow[]
        >`INSERT INTO attempts(id,learning_session_id,problem_revision_id,attempt_kind,status,notation_profile) VALUES(${randomUUID()}::uuid,${learning.id}::uuid,${x.problem_revision_id}::uuid,${x.phase},'in_progress',${p.notation_profile}) RETURNING *`;
        if (!a) throw invalidState();
        await tx.$executeRaw`UPDATE learning_assignments SET attempt_id=${a.id}::uuid WHERE id=${x.id}::uuid`;
        return { status: 201, data: await this.attemptDto(tx, a) };
      }
      const [problem] = await this.problemRows(
        tx,
        Prisma.sql`r.id=${body.source.problemRevisionId}::uuid AND r.release_id=${learning.release_id}::uuid FOR SHARE OF r,c,p,s`,
      );
      if (!problem) throw missing();
      const [a] = await tx.$queryRaw<
        AttemptRow[]
      >`INSERT INTO attempts(id,learning_session_id,problem_revision_id,attempt_kind,status,notation_profile) VALUES(${randomUUID()}::uuid,${learning.id}::uuid,${problem.id}::uuid,'main','in_progress',${problem.notation_profile}) RETURNING *`;
      if (!a) throw invalidState();
      if (ph08Active())
        await recordExposure(tx, auth.row.id, problem.id, "catalog_attempt");
      return { status: 201, data: await this.attemptDto(tx, a) };
    });
  }
  async getAttempt(auth: GuestAuth, id: string): Promise<Schema<"Attempt">> {
    return this.db.$transaction(async (tx) =>
      this.attemptDto(tx, await this.attempt(tx, auth, id, true)),
    );
  }
  async listAttempts(
    auth: GuestAuth,
    learningId: string,
    limit: number,
    cursor: string | null,
  ): Promise<Schema<"ListAttempts">> {
    return this.db.$transaction(
      async (tx) => {
        await this.learning(tx, auth, learningId);
        const rows = await tx.$queryRaw<
          AttemptRow[]
        >`SELECT * FROM attempts WHERE learning_session_id=${learningId}::uuid AND (${cursor}::uuid IS NULL OR id>${cursor}::uuid) ORDER BY id LIMIT ${limit + 1}`;
        const items = await Promise.all(
          rows.slice(0, limit).map((a) => this.attemptDto(tx, a)),
        );
        return {
          items,
          nextCursor:
            rows.length > limit
              ? this.security.cursor(
                  "attempts:" + auth.row.id + ":" + learningId,
                  rows[limit - 1]!.id,
                )
              : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async changeStep(
    auth: GuestAuth,
    key: string,
    attemptId: string,
    mode: "create" | "edit" | "delete",
    body:
      | Schema<"CreateStepInput">
      | Schema<"EditStepInput">
      | Schema<"DeleteStepInput">,
    stepId?: string,
  ): Promise<MutationResult<Schema<"StepMutationResult">>> {
    return this.mutate(
      auth,
      "step." + mode,
      key,
      { attemptId, stepId: stepId ?? null, body },
      async (tx) => {
        const a = await this.attempt(tx, auth, attemptId, true);
        if (ph08Active()) await requireAssignmentCurrent(tx, a.id);
        if (a.revision !== BigInt(body.expectedRevision))
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغيّرت المحاولة. حدّثها ثم أعد المحاولة.",
            [],
            Number(a.revision),
          );
        if (a.status === "stopped" || a.revision >= 2147483647n)
          throw invalidState();
        const steps = await this.steps(tx, a.id);
        let changed: StepRow | null = null,
          position: number;
        const [count] = await tx.$queryRaw<
          { count: bigint }[]
        >`SELECT count(*) FROM current_verification_runs r JOIN verification_results v ON v.verification_run_id=r.id WHERE r.attempt_id=${a.id}::uuid`;
        if (mode === "create") {
          if (!("position" in body) || !("sourceRaw" in body))
            throw invalidState();
          position = steps.length + 1;
          if (body.position !== position)
            throw new ApiFault(
              422,
              "invalid_input",
              "أضف الخطوة في نهاية الحل.",
            );
          const id = randomUUID(),
            versionId = randomUUID();
          await tx.$executeRaw`INSERT INTO step_slots(id,attempt_id,position,current_version) VALUES(${id}::uuid,${a.id}::uuid,${position},1)`;
          await tx.$executeRaw`INSERT INTO step_versions(id,step_slot_id,version_number,source_raw,input_origin) VALUES(${versionId}::uuid,${id}::uuid,1,${body.sourceRaw},${body.inputOrigin})`;
          changed =
            (await this.steps(tx, a.id)).find((s) => s.id === id) ?? null;
        } else {
          const old = steps.find((s) => s.id === stepId);
          if (!old) throw missing();
          position = old.position;
          if (mode === "edit") {
            if (!("sourceRaw" in body)) throw invalidState();
            await tx.$executeRaw`INSERT INTO step_versions(id,step_slot_id,version_number,source_raw,input_origin,supersedes_step_version_id) VALUES(${randomUUID()}::uuid,${old.id}::uuid,${old.current_version + 1},${body.sourceRaw},${body.inputOrigin},${old.version_id}::uuid)`;
            await tx.$executeRaw`UPDATE step_slots SET current_version=current_version+1,updated_at=now() WHERE id=${old.id}::uuid`;
            changed =
              (await this.steps(tx, a.id)).find((s) => s.id === old.id) ?? null;
          } else {
            await tx.$executeRaw`UPDATE step_slots SET is_active=false,updated_at=now() WHERE id=${old.id}::uuid`;
            // The partial unique index is not deferrable. Move to a disjoint
            // positive range first, then compact the remaining active positions.
            const offset = steps.length + 1;
            await tx.$executeRaw`UPDATE step_slots SET position=position+${offset},updated_at=now() WHERE attempt_id=${a.id}::uuid AND is_active AND position>${position}`;
            await tx.$executeRaw`UPDATE step_slots SET position=position-${offset}-1 WHERE attempt_id=${a.id}::uuid AND is_active AND position>${offset}`;
          }
        }
        await tx.$executeRaw`UPDATE attempts SET revision=revision+1,status='in_progress',completion_verdict=NULL,closed_at=NULL,updated_at=now() WHERE id=${a.id}::uuid`;
        return {
          status: mode === "create" ? 201 : 200,
          data: {
            attemptId: a.id,
            attemptRevision: Number(a.revision) + 1,
            step: changed ? stepDto(changed) : null,
            invalidatedFromPosition: 1,
            invalidatedVerificationCount: Number(count?.count ?? 0),
          },
        };
      },
    );
  }
  // PH-04 repository boundary tested with Mock responses. No public verify flow
  // or external math call is initiated here (PH-05 owns that orchestration).
  async captureVerification(
    auth: GuestAuth,
    attemptId: string,
    revision: number,
    fromVersionId: string | null,
    toVersionId: string,
    key: string,
    engineVersion: string,
  ): Promise<VerificationSnapshot> {
    return this.db.$transaction(async (tx) => {
      this.active(await this.lockGuest(tx, auth));
      const a = await this.attempt(tx, auth, attemptId, true),
        steps = await this.steps(tx, a.id);
      if (Number(a.revision) !== revision)
        throw new ApiFault(
          409,
          "revision_conflict",
          "تغيّرت المحاولة.",
          [],
          Number(a.revision),
        );
      const target = steps.findIndex((s) => s.version_id === toVersionId);
      if (
        target < 0 ||
        (target === 0
          ? fromVersionId !== null
          : steps[target - 1]?.version_id !== fromVersionId)
      )
        throw invalidState();
      const [p] = await tx.$queryRaw<
        { original_equation_raw: string }[]
      >`SELECT original_equation_raw FROM problem_revisions WHERE id=${a.problem_revision_id}::uuid`;
      if (!p) throw missing();
      const runId = randomUUID();
      await tx.$executeRaw`INSERT INTO verification_runs(id,attempt_id,request_key_hash,attempt_revision_requested,problem_revision_id,from_kind,from_step_version_id,to_step_version_id,notation_profile_version,engine_version_requested,dispatch_status)
        VALUES(${runId}::uuid,${a.id}::uuid,${bytes(this.security.keyDigest(key))},${a.revision},${a.problem_revision_id}::uuid,${fromVersionId ? "step" : "problem"},${fromVersionId}::uuid,${toVersionId}::uuid,${a.notation_profile},${engineVersion},'running')`;
      return {
        runId,
        attemptId: a.id,
        revision,
        problemRevisionId: a.problem_revision_id,
        notationProfile: a.notation_profile,
        engineVersion,
        fromVersionId,
        toVersionId,
        fromRaw:
          target === 0
            ? p.original_equation_raw
            : steps[target - 1]!.source_raw,
        toRaw: steps[target]!.source_raw,
      };
    });
  }
  async acceptVerification(
    auth: GuestAuth,
    snapshot: VerificationSnapshot,
    raw: unknown,
  ): Promise<{ isCurrent: boolean }> {
    const result = internalValue<TransitionResult>(
      "InternalMathTransitionResult",
      raw,
    );
    if (
      result.attemptRevision !== snapshot.revision ||
      result.engineVersion !== snapshot.engineVersion ||
      result.notationProfileVersion !== snapshot.notationProfile ||
      (result.status === "verified_invalid" &&
        (!result.evidence || result.evidence.type === "none"))
    )
      throw new ApiFault(503, "math_unavailable", "تعذر اعتماد نتيجة المحرك.");
    return this.db.$transaction(async (tx) => {
      this.active(await this.lockGuest(tx, auth));
      await this.attempt(tx, auth, snapshot.attemptId, true);
      const [run] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM verification_runs WHERE id=${snapshot.runId}::uuid AND attempt_id=${snapshot.attemptId}::uuid AND attempt_revision_requested=${BigInt(snapshot.revision)} AND problem_revision_id=${snapshot.problemRevisionId}::uuid AND to_step_version_id=${snapshot.toVersionId}::uuid AND from_step_version_id IS NOT DISTINCT FROM ${snapshot.fromVersionId}::uuid AND engine_version_requested=${snapshot.engineVersion} AND notation_profile_version=${snapshot.notationProfile} AND dispatch_status='running' FOR UPDATE`;
      if (!run) throw invalidState();
      await tx.$executeRaw`INSERT INTO verification_results(id,verification_run_id,math_status,reason_code,evidence_kind,evidence_json,engine_version_actual,schema_version,notation_profile_version,validated_at)
        VALUES(${randomUUID()}::uuid,${run.id}::uuid,${result.status},${result.reasonCode},${result.evidence?.type ?? null},${result.evidence ? JSON.stringify(result.evidence) : null}::jsonb,${result.engineVersion},${result.schemaVersion},${result.notationProfileVersion},now())`;
      await tx.$executeRaw`UPDATE verification_runs SET dispatch_status='finished',finished_at=now() WHERE id=${run.id}::uuid`;
      const current = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM current_verification_runs WHERE id=${run.id}::uuid`;
      return { isCurrent: current.length === 1 };
    });
  }
  async requireCurrentDependency(
    auth: GuestAuth,
    attemptId: string,
    runId: string,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      this.active(await this.lockGuest(tx, auth));
      await this.attempt(tx, auth, attemptId, true);
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT r.id FROM current_verification_runs r JOIN verification_results v ON v.verification_run_id=r.id WHERE r.id=${runId}::uuid AND r.attempt_id=${attemptId}::uuid AND r.dispatch_status='finished' AND v.math_status IN ('verified_valid','verified_invalid') AND v.engine_version_actual=r.engine_version_requested AND v.notation_profile_version=r.notation_profile_version AND v.schema_version='math-internal-v1'`;
      if (rows.length !== 1) throw invalidState();
    });
  }
}
