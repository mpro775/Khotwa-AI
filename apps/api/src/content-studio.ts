import { randomUUID, createHash } from "node:crypto";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ContentPayload,
  ContentStatus,
  ContentValidation,
  ProductCatalog,
  StudioItem,
} from "../../../packages/contracts/src/product";
import { AccountService } from "./accounts";
import { Store } from "./store";
import { MathGateway } from "./math-gateway";
import { PhysicsGateway } from "./physics-gateway";
import { ApiFault, RequestContext } from "./http";
import { uuid } from "./contracts";
import { parsePayload, publicItem } from "./content-payload";
import {
  productEnvelope,
  productInvalid,
  productMutation,
  record,
  only,
  revisionField,
  textField,
  ProductOwner,
} from "./product-core";
import { evaluateProgram, RunnerPort } from "./programming-runner";
import { materializeStudioHints, studioHintIssues } from "./studio-tutoring";
import { materializeStudioPairings } from "./studio-pairings";
import { materializeStudioDiagnosis } from "./studio-diagnosis";

export interface StudioRow {
  id: string;
  item_id: string;
  version: number;
  edit_revision: number;
  status: ContentStatus;
  payload: ContentPayload;
  content_hash: string;
  validation: ContentValidation | null;
  created_at: Date;
  reviewed_at: Date | null;
  published_at: Date | null;
  reviewed_by: string | null;
}
const hash = (p: ContentPayload) =>
  createHash("sha256").update(JSON.stringify(p)).digest("hex");
const dto = (r: StudioRow): StudioItem => ({
  id: r.id,
  itemId: r.item_id,
  version: r.version,
  editRevision: r.edit_revision,
  status: r.status,
  payload: parsePayload(r.payload),
  contentHash: r.content_hash,
  validation: r.validation,
  createdAt: r.created_at.toISOString(),
  reviewedAt: r.reviewed_at?.toISOString() ?? null,
  publishedAt: r.published_at?.toISOString() ?? null,
});
const editors = ["teacher", "content_manager", "admin"];
const notFound = () => new ApiFault(404, "not_found", "المحتوى غير متاح.");
export class ContentStudioService {
  readonly physics = new PhysicsGateway();
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly math: MathGateway,
    readonly runner: RunnerPort,
  ) {}
  private async row(
    id: string,
    tx: Prisma.TransactionClient = this.store.db,
    lock = false,
  ): Promise<StudioRow> {
    const rows = await tx.$queryRaw<StudioRow[]>(
      Prisma.sql`SELECT * FROM studio_revisions WHERE id=${uuid(id)}::uuid ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`,
    );
    if (!rows[0]) throw notFound();
    return rows[0];
  }
  async list(request: RequestContext, query: Record<string, unknown>) {
    await this.accounts.actor(request, false, editors);
    only(query, ["subject", "status", "q"]);
    const subject =
        query.subject === undefined ? null : textField(query.subject, 40),
      status = query.status === undefined ? null : textField(query.status, 40),
      q = query.q === undefined ? null : textField(query.q, 120, 0);
    if (subject && !["algebra", "physics", "programming"].includes(subject))
      throw productInvalid();
    if (
      status &&
      !["draft", "in_review", "approved", "published", "archived"].includes(
        status,
      )
    )
      throw productInvalid();
    const rows = await this.store.db.$queryRaw<
      StudioRow[]
    >`SELECT * FROM studio_revisions WHERE (${subject}::text IS NULL OR payload->>'subject'=${subject}) AND (${status}::text IS NULL OR status=${status}) AND (${q}::text IS NULL OR strpos(lower(payload->>'titleAr'),lower(${q}))>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(payload->'skillCodes') s WHERE strpos(lower(s),lower(${q}))>0)) ORDER BY created_at DESC,id LIMIT 300`;
    return { items: rows.map(dto) };
  }
  async detail(request: RequestContext, id: string) {
    await this.accounts.actor(request, false, editors);
    return dto(await this.row(id));
  }
  private async insert(
    tx: Prisma.TransactionClient,
    actor: ProductOwner,
    payload: ContentPayload,
  ): Promise<StudioItem> {
    const itemId = randomUUID(),
      id = randomUUID(),
      code = "STUDIO-" + itemId;
    await tx.$executeRaw`INSERT INTO studio_items(id,code,subject_code,unit_code,lesson_code) VALUES(${itemId}::uuid,${code},${payload.subject},${payload.unitCode},${payload.lessonCode})`;
    await tx.$executeRaw`INSERT INTO studio_revisions(id,item_id,version,payload,content_hash,created_by) VALUES(${id}::uuid,${itemId}::uuid,1,${JSON.stringify(payload)}::jsonb,${hash(payload)},${actor.userId}::uuid)`;
    await this.audit(tx, id, actor, "create", hash(payload));
    return dto(await this.row(id, tx));
  }
  async create(request: RequestContext, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors),
      payload = parsePayload(raw);
    return productMutation(
      this.store,
      actor,
      request,
      "studio.create",
      payload,
      (tx) => this.insert(tx, actor, payload),
    );
  }
  private async audit(
    tx: Prisma.TransactionClient,
    id: string,
    actor: ProductOwner,
    action: string,
    contentHash: string,
  ) {
    await tx.$executeRaw`INSERT INTO studio_events(id,revision_id,actor_id,action,content_hash) VALUES(${randomUUID()}::uuid,${id}::uuid,${actor.userId}::uuid,${action},${contentHash})`;
  }
  async edit(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors),
      b = record(raw);
    only(b, ["expectedRevision", "payload"]);
    const expected = revisionField(b.expectedRevision),
      payload = parsePayload(b.payload);
    return productMutation(
      this.store,
      actor,
      request,
      "studio.edit:" + uuid(id),
      b,
      async (tx) => {
        const old = await this.row(id, tx, true);
        this.expected(old, expected);
        if (old.status !== "draft" || old.payload.subject !== payload.subject)
          throw new ApiFault(
            409,
            "invalid_state",
            "التحرير متاح للمسودة في المادة نفسها فقط.",
          );
        await tx.$executeRaw`UPDATE studio_revisions SET payload=${JSON.stringify(payload)}::jsonb,content_hash=${hash(payload)},validation=NULL,edit_revision=edit_revision+1,reviewed_by=NULL,reviewed_at=NULL WHERE id=${id}::uuid`;
        await this.audit(tx, id, actor, "edit", hash(payload));
        return dto(await this.row(id, tx));
      },
    );
  }
  private expected(row: StudioRow, expected: number) {
    if (row.edit_revision !== expected)
      throw new ApiFault(
        409,
        "revision_conflict",
        "تغيرت النسخة؛ حدّث الصفحة ثم راجع الفرق.",
        [],
        row.edit_revision,
      );
  }
  async deleteDraft(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors),
      body = record(raw);
    only(body, ["expectedRevision"]);
    const expected = revisionField(body.expectedRevision);
    return productMutation(
      this.store,
      actor,
      request,
      "studio.delete-draft:" + uuid(id),
      body,
      async (tx) => {
        const row = await this.row(id, tx, true);
        this.expected(row, expected);
        if (row.status !== "draft")
          throw new ApiFault(
            409,
            "invalid_state",
            "يمكن إزالة المسودة فقط؛ النسخ المنشورة تؤرشف دون حذف تاريخها.",
          );
        await tx.$executeRaw`UPDATE studio_revisions SET status='archived',edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        await this.audit(tx, id, actor, "delete_draft", row.content_hash);
        return dto(await this.row(id, tx));
      },
    );
  }
  async validatePayload(
    payload: ContentPayload,
    id: string = randomUUID(),
  ): Promise<ContentValidation> {
    const issues: string[] = [...studioHintIssues(payload)];
    let engine = "none";
    try {
      if (payload.algebra) {
        engine = "math-internal-v1";
        const a = payload.algebra;
        if (Object.values(a).some((v) => v.length > 256))
          issues.push("معادلة أطول من حدود محرك الجبر.");
        else {
          const context = {
            attemptId: randomUUID(),
            attemptRevision: 0,
            problemRevisionId: id,
            notationProfile: "ar-mashriq-school-v1",
            domain: "reals" as const,
          };
          const parsed = await this.math.parse(
            context,
            { kind: "problem", stepVersionId: null },
            a.equationRaw,
          );
          if (parsed.parseStatus !== "parsed")
            issues.push("الصيغة غير مدعومة من محرك الجبر.");
          else {
            const final = await this.math.checkFinal(context, a.equationRaw, {
              stepVersionId: randomUUID(),
              raw: a.answerRaw,
            });
            if (
              final.status !== "verified_valid" ||
              !final.isIsolated ||
              !final.substitutionValid
            )
              issues.push("مفتاح الحل لا يطابق المعادلة أو ليس حلًا معزولًا.");
            for (const [raw, expected] of [
              [a.validStepRaw, "verified_valid"],
              [a.invalidStepRaw, "verified_invalid"],
            ] as const) {
              const step = await this.math.verify(context, {
                fromKind: "problem",
                fromStepVersionId: null,
                toStepVersionId: randomUUID(),
                fromRaw: a.equationRaw,
                toRaw: raw,
              });
              if (step.status !== expected)
                issues.push(
                  expected === "verified_valid"
                    ? "مثال التحويل الصحيح غير متحقق."
                    : "مثال التحويل الخاطئ لا يثبت خطأه.",
                );
            }
          }
        }
      } else if (payload.physics) {
        engine = "physics-internal-v1";
        const result = await this.physics.validateReference(
          id,
          payload.physics,
        );
        if (result.status !== "correct")
          issues.push(
            "المعطيات والقانون والقيمة المرجعية أو الوحدة غير متوافقة.",
          );
      } else if (payload.programming) {
        engine = "judge0-python";
        const p = payload.programming;
        if (!p.tests.some((t) => !t.hidden))
          issues.push("يلزم اختبار علني واحد على الأقل.");
        if (!p.tests.some((t) => t.hidden))
          issues.push("يلزم اختبار مخفي واحد على الأقل.");
        const result = await evaluateProgram(
          this.runner,
          p.referenceCode,
          p.tests,
          p.functionName,
        );
        if (!result.allPassed)
          issues.push(
            result.status === "service_error"
              ? "خدمة التنفيذ المعزول غير مهيأة؛ يمنع نشر التمرين قبل اختبار الحل المرجعي."
              : "الحل المرجعي لا يجتاز جميع اختبارات التمرين.",
          );
      }
    } catch {
      issues.push("تعذر التحقق التخصصي الآن؛ لا يمكن اعتماد النشر.");
    }
    return {
      valid: issues.length === 0,
      issues,
      checkedAt: new Date().toISOString(),
      engine,
    };
  }
  async validate(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors),
      b = record(raw);
    only(b, ["expectedRevision"]);
    const expected = revisionField(b.expectedRevision),
      snapshot = await this.row(id);
    this.expected(snapshot, expected);
    const validation = await this.validatePayload(
      parsePayload(snapshot.payload),
      id,
    );
    return productMutation(
      this.store,
      actor,
      request,
      "studio.validate:" + id,
      b,
      async (tx) => {
        const row = await this.row(id, tx, true);
        this.expected(row, expected);
        if (row.content_hash !== snapshot.content_hash)
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغير المحتوى أثناء التحقق.",
          );
        await tx.$executeRaw`UPDATE studio_revisions SET validation=${JSON.stringify(validation)}::jsonb WHERE id=${id}::uuid`;
        return dto(await this.row(id, tx));
      },
    );
  }
  async transition(request: RequestContext, id: string, raw: unknown) {
    const b = record(raw);
    only(b, ["expectedRevision", "action"]);
    const action = textField(b.action, 20),
      expected = revisionField(b.expectedRevision);
    if (
      ![
        "submit",
        "approve",
        "publish",
        "archive",
        "revise",
        "rollback",
      ].includes(action)
    )
      throw productInvalid();
    const actor = await this.accounts.actor(
      request,
      true,
      ["approve", "publish", "archive", "rollback"].includes(action)
        ? ["admin"]
        : editors,
    );
    const snapshot = await this.row(id);
    this.expected(snapshot, expected);
    let validation: ContentValidation | null = null;
    if (["approve", "publish", "rollback"].includes(action)) {
      validation = await this.validatePayload(
        parsePayload(snapshot.payload),
        id,
      );
      if (!validation.valid) throw productInvalid(validation.issues.join(" "));
      if (
        ![1, 2, 3].every((level) =>
          snapshot.payload.hints.some((h) => h.level === level),
        )
      )
        throw productInvalid("يلزم تلميح عربي لكل من H1 وH2 وH3 قبل الاعتماد.");
      if (
        ["publish", "rollback"].includes(action) &&
        snapshot.payload.hints.some((h) => !h.reviewed)
      )
        throw productInvalid("تلميحات غير مراجعة؛ أعد النسخة إلى المراجعة.");
    }
    return productMutation(
      this.store,
      actor,
      request,
      "studio." + action + ":" + uuid(id),
      b,
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM studio_items WHERE id=${snapshot.item_id}::uuid FOR UPDATE`;
        const row = await this.row(id, tx, true);
        this.expected(row, expected);
        if (row.content_hash !== snapshot.content_hash)
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغير المحتوى أثناء المراجعة.",
          );
        if (action === "revise") {
          if (
            !["published", "archived", "approved", "in_review"].includes(
              row.status,
            )
          )
            throw new ApiFault(
              409,
              "invalid_state",
              "هذه النسخة مسودة بالفعل.",
            );
          const [next] = await tx.$queryRaw<
            { version: number }[]
          >`SELECT coalesce(max(version),0)+1 AS version FROM studio_revisions WHERE item_id=${row.item_id}::uuid`;
          const newId = randomUUID(),
            payload = {
              ...row.payload,
              hints: row.payload.hints.map((h) => ({ ...h, reviewed: false })),
            };
          await tx.$executeRaw`INSERT INTO studio_revisions(id,item_id,version,payload,content_hash,created_by) VALUES(${newId}::uuid,${row.item_id}::uuid,${next!.version},${JSON.stringify(payload)}::jsonb,${hash(payload)},${actor.userId}::uuid)`;
          await this.audit(tx, newId, actor, "revise", hash(payload));
          return dto(await this.row(newId, tx));
        }
        const allowed: Record<string, ContentStatus[]> = {
          submit: ["draft"],
          approve: ["in_review"],
          publish: ["approved"],
          archive: ["published"],
          rollback: ["archived"],
        };
        if (!allowed[action]?.includes(row.status))
          throw new ApiFault(
            409,
            "invalid_state",
            "الانتقال غير متاح في حالة المحتوى الحالية.",
          );
        if (action === "submit")
          await tx.$executeRaw`UPDATE studio_revisions SET status='in_review',edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        if (action === "approve") {
          const payload = {
            ...row.payload,
            hints: row.payload.hints.map((h) => ({ ...h, reviewed: true })),
          };
          await tx.$executeRaw`UPDATE studio_revisions SET status='approved',payload=${JSON.stringify(payload)}::jsonb,content_hash=${hash(payload)},validation=${JSON.stringify(validation)}::jsonb,reviewed_by=${actor.userId}::uuid,reviewed_at=now(),edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        }
        if (action === "publish" || action === "rollback") {
          if (!row.reviewed_by)
            throw productInvalid("مراجعة المستخدم المخول مطلوبة.");
          await tx.$executeRaw`UPDATE studio_revisions SET status='archived',edit_revision=edit_revision+1 WHERE item_id=${row.item_id}::uuid AND status='published'`;
          await tx.$executeRaw`UPDATE studio_revisions SET status='published',validation=${JSON.stringify(validation)}::jsonb,published_by=${actor.userId}::uuid,published_at=now(),edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
          if (row.payload.algebra)
            await this.materializeAlgebra(tx, row, actor);
        }
        if (action === "archive") {
          await tx.$executeRaw`UPDATE studio_revisions SET status='archived',edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        }
        const result = await this.row(id, tx);
        await this.audit(tx, id, actor, action, result.content_hash);
        return dto(result);
      },
    );
  }
  private async materializeAlgebra(
    tx: Prisma.TransactionClient,
    row: StudioRow,
    actor: ProductOwner,
  ) {
    const p = row.payload,
      a = p.algebra!;
    const existing = await tx.$queryRaw<
      { problem_revision_id: string }[]
    >`SELECT problem_revision_id FROM studio_algebra_links WHERE studio_revision_id=${row.id}::uuid`;
    // Existing pinned original revisions and evidence remain unchanged on rollback.
    if (existing[0]) return;
    // Every publication has a fresh release; frozen membership of earlier
    // releases is never altered, including skills and problem relationships.
    const release = { id: randomUUID() };
    await tx.$executeRaw`INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES(${release.id}::uuid,${"studio-" + row.id},'algebra','ar-mashriq-school-v1',${p.unitTitleAr},'draft')`;
    const primary = p.skillCodes[0]!;
    let [skill] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM skills WHERE release_id=${release.id}::uuid AND skill_code=${primary}`;
    if (!skill) {
      skill = { id: randomUUID() };
      await tx.$executeRaw`INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES(${skill.id}::uuid,${release.id}::uuid,${primary},${p.lessonTitleAr},${p.statementAr},0,'active')`;
    }
    const problemId = row.item_id,
      revisionId = randomUUID();
    await tx.$executeRaw`INSERT INTO problems(id,problem_code) VALUES(${problemId}::uuid,${"STUDIO-" + problemId}) ON CONFLICT(id) DO NOTHING`;
    await tx.$executeRaw`INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash,learning_family) VALUES(${revisionId}::uuid,${problemId}::uuid,${row.version},${release.id}::uuid,${p.kind},${p.statementAr},${a.equationRaw},${JSON.stringify({ kind: "linear_one_variable", finalRaw: a.answerRaw })}::jsonb,${p.difficulty},'ar-mashriq-school-v1','published',now(),now(),${row.content_hash},${p.familyCode})`;
    await tx.$executeRaw`INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES(${revisionId}::uuid,${skill.id}::uuid,'primary')`;
    await tx.$executeRaw`INSERT INTO studio_algebra_links(studio_revision_id,problem_revision_id,problem_id,release_id) VALUES(${row.id}::uuid,${revisionId}::uuid,${problemId}::uuid,${release.id}::uuid)`;
    await materializeStudioHints(tx, {
      payload: p,
      releaseId: release.id,
      problemRevisionId: revisionId,
      studioRevisionId: row.id,
      reviewerId: actor.userId!,
    });
    if (p.kind === "main")
      await materializeStudioPairings(tx, {
        root: p,
        rootRevisionId: revisionId,
        releaseId: release.id,
        skillId: skill.id,
        reviewerId: actor.userId!,
      });
    await materializeStudioDiagnosis(tx, release.id, skill.id, primary);
    await tx.$executeRaw`UPDATE content_releases SET status='published',reviewed_by_role=${"admin:" + actor.userId},reviewed_at=now(),published_at=now() WHERE id=${release.id}::uuid`;
  }
  async preview(request: RequestContext, raw: unknown) {
    await this.accounts.actor(request, true, editors);
    return this.importPreview(raw);
  }
  importPreview(raw: unknown) {
    const b = record(raw);
    only(b, ["items"]);
    if (!Array.isArray(b.items) || b.items.length > 100)
      throw productInvalid("الاستيراد يدعم حتى ١٠٠ سجل.");
    const results = b.items.map((item, index) => {
      try {
        parsePayload(item);
        return { index, valid: true, issues: [] as string[] };
      } catch (error) {
        return {
          index,
          valid: false,
          issues: [
            error instanceof ApiFault ? error.messageAr : "حقول غير صالحة.",
          ],
        };
      }
    });
    return {
      accepted: results.filter((x) => x.valid).length,
      rejected: results.filter((x) => !x.valid).length,
      results,
    };
  }
  async import(request: RequestContext, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors),
      preview = this.importPreview(raw),
      b = record(raw);
    if (preview.rejected)
      throw productInvalid(
        "تتضمن الدفعة سجلات مرفوضة؛ صححها وفق المعاينة ثم أعد الاستيراد.",
      );
    const payloads = (b.items as unknown[]).map(parsePayload);
    return productMutation(
      this.store,
      actor,
      request,
      "studio.import",
      b,
      async (tx) => {
        const items: StudioItem[] = [];
        for (const p of payloads) items.push(await this.insert(tx, actor, p));
        return { items };
      },
    );
  }
  async export(request: RequestContext) {
    await this.accounts.actor(request, false, editors);
    const rows = await this.store.db.$queryRaw<
      StudioRow[]
    >`SELECT * FROM studio_revisions ORDER BY item_id,version LIMIT 1000`;
    return {
      format: "khotwa-content-v1",
      items: rows.map((r) => parsePayload(r.payload)),
    };
  }
  async catalog(
    request: RequestContext,
    subject?: string,
  ): Promise<ProductCatalog> {
    await this.accounts.actor(request);
    if (subject && !["algebra", "physics", "programming"].includes(subject))
      throw productInvalid();
    const rows = await this.store.db.$queryRaw<
      StudioRow[]
    >`SELECT r.* FROM studio_revisions r WHERE r.status='published' AND r.payload->>'kind'='main' AND (${subject ?? null}::text IS NULL OR payload->>'subject'=${subject ?? null}) ORDER BY payload->>'subject',payload->>'unitCode',payload->>'lessonCode',id LIMIT 500`;
    const catalog: ProductCatalog = { subjects: [] };
    const names = {
      algebra: "الرياضيات",
      physics: "الفيزياء",
      programming: "البرمجة",
    };
    for (const r of rows) {
      const p = parsePayload(r.payload);
      let s = catalog.subjects.find((s) => s.code === p.subject);
      if (!s) {
        s = { code: p.subject, titleAr: names[p.subject], units: [] };
        catalog.subjects.push(s);
      }
      let u = s.units.find((u) => u.code === p.unitCode);
      if (!u) {
        u = { code: p.unitCode, titleAr: p.unitTitleAr, lessons: [] };
        s.units.push(u);
      }
      let l = u.lessons.find((l) => l.code === p.lessonCode);
      if (!l) {
        l = { code: p.lessonCode, titleAr: p.lessonTitleAr, items: [] };
        u.lessons.push(l);
      }
      l.items.push(publicItem(r.id, r.item_id, r.version, p));
    }
    return catalog;
  }
  async publicDetail(request: RequestContext, id: string) {
    await this.accounts.actor(request);
    const row = await this.row(id);
    if (row.status !== "published" || row.payload.kind !== "main")
      throw notFound();
    return publicItem(
      row.id,
      row.item_id,
      row.version,
      parsePayload(row.payload),
    );
  }
  async startAlgebra(request: RequestContext, id: string, raw: unknown) {
    const body = record(raw);
    only(body, []);
    const actor = await this.accounts.actor(request, true);
    const auth = await this.store.authenticate(request);
    if (!auth)
      throw new ApiFault(401, "unauthenticated", "ابدأ جلسة للمتابعة.");
    return productMutation(
      this.store,
      actor,
      request,
      "catalog.start:" + uuid(id),
      body,
      async (tx) => {
        const [link] = await tx.$queryRaw<
          {
            problem_revision_id: string;
            problem_id: string;
            release_id: string;
          }[]
        >`SELECT l.* FROM studio_algebra_links l JOIN studio_revisions r ON r.id=l.studio_revision_id WHERE r.id=${id}::uuid AND r.status='published' AND r.payload->>'kind'='main'`;
        if (!link) throw notFound();
        const learningId = randomUUID(),
          attemptId = randomUUID();
        await tx.$executeRaw`INSERT INTO learning_sessions(id,guest_session_id,release_id,status,session_policy_version,is_synthetic) VALUES(${learningId}::uuid,${auth.row.id}::uuid,${link.release_id}::uuid,'active','p0-policy-draft-1',${this.store.syntheticData})`;
        await tx.$executeRaw`INSERT INTO attempts(id,learning_session_id,problem_revision_id,attempt_kind,status,notation_profile) VALUES(${attemptId}::uuid,${learningId}::uuid,${link.problem_revision_id}::uuid,'main','in_progress','ar-mashriq-school-v1')`;
        return {
          attemptId,
          problemId: link.problem_id,
          learningSessionId: learningId,
        };
      },
    );
  }
}
@Controller("api/v1")
export class ContentStudioController {
  constructor(readonly studio: ContentStudioService) {}
  @Get("studio/items") list(
    @Req() r: RequestContext,
    @Query() q: Record<string, unknown>,
  ) {
    return this.studio.list(r, q).then((x) => productEnvelope(r, x));
  }
  @Get("studio/items/:id") detail(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.studio.detail(r, id).then((x) => productEnvelope(r, x));
  }
  @Post("studio/items") create(@Req() r: RequestContext, @Body() b: unknown) {
    return this.studio.create(r, b).then((x) => productEnvelope(r, x));
  }
  @Delete("studio/items/:id") deleteDraft(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.studio.deleteDraft(r, id, b).then((x) => productEnvelope(r, x));
  }
  @Put("studio/items/:id") edit(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.studio.edit(r, id, b).then((x) => productEnvelope(r, x));
  }
  @Post("studio/items/:id/validate") validate(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.studio.validate(r, id, b).then((x) => productEnvelope(r, x));
  }
  @Post("studio/items/:id/transition") transition(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.studio.transition(r, id, b).then((x) => productEnvelope(r, x));
  }
  @Post("studio/import/preview") preview(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.studio.preview(r, b).then((x) => productEnvelope(r, x));
  }
  @Post("studio/import") import(@Req() r: RequestContext, @Body() b: unknown) {
    return this.studio.import(r, b).then((x) => productEnvelope(r, x));
  }
  @Get("studio/export") export(@Req() r: RequestContext) {
    return this.studio.export(r).then((x) => productEnvelope(r, x));
  }
  @Get("catalog") catalog(
    @Req() r: RequestContext,
    @Query("subject") s?: string,
  ) {
    return this.studio.catalog(r, s).then((x) => productEnvelope(r, x));
  }
  @Get("catalog/problems/:id") problem(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.studio.publicDetail(r, id).then((x) => productEnvelope(r, x));
  }
  @Post("catalog/problems/:id/start") start(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.studio
      .startAlgebra(r, id, b)
      .then((x) => productEnvelope(r, x));
  }
}
