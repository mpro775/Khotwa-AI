import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  Body,
  Controller,
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
  SubjectCode,
} from "../../../packages/contracts/src/product";
import type {
  LearningBankProblem,
  LearningContentPayload,
  LearningContentRevision,
  LearningContentValidation,
  LearningLessonDetail,
  LearningSkillMap,
  LearningTrackDetail,
} from "../../../packages/contracts/src/learning-paths";
import { AccountService } from "./accounts";
import { ContentStudioService } from "./content-studio";
import { uuid } from "./contracts";
import { ApiFault, RequestContext } from "./http";
import { MathPort } from "./math-gateway";
import { PhysicsGateway } from "./physics-gateway";
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
import { Store } from "./store";
import { requireProductLearningAccess } from "./learning-access";
import {
  ALGEBRA_ERROR_SKILLS,
  ALGEBRA_SKILLS,
  LEARNING_MAP_VERSION,
  PENDING_MAPPINGS,
  learningSubject,
  parseLearningPayload,
} from "./learning-path-payload";
import { validateGraph, type GraphEdge } from "./knowledge-graph";
import { recordExposure } from "./learning";
import { recordPhysicsExposures } from "./physics-learning";

type Tx = Prisma.TransactionClient;
interface ContentRow {
  id: string;
  item_id: string;
  version: number;
  edit_revision: number;
  status: ContentStatus;
  payload: LearningContentPayload;
  content_hash: string;
  validation: LearningContentValidation | null;
  created_by: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  published_at: Date | null;
}
const editors = ["teacher", "content_manager", "admin"];
const digest = (p: LearningContentPayload) =>
  createHash("sha256").update(JSON.stringify(p)).digest("hex");
const missing = () =>
  new ApiFault(404, "not_found", "المحتوى التعليمي غير متاح.");
export const learningContentDto = (r: ContentRow): LearningContentRevision => ({
  id: r.id,
  itemId: r.item_id,
  version: r.version,
  editRevision: r.edit_revision,
  status: r.status,
  payload: parseLearningPayload(r.payload),
  contentHash: r.content_hash,
  validation: r.validation,
  createdAt: r.created_at.toISOString(),
  reviewedAt: r.reviewed_at?.toISOString() ?? null,
  publishedAt: r.published_at?.toISOString() ?? null,
});
/** Completion answers are revealed only by the owned scaffold state. */
export const learningStudentContentDto = (
  r: ContentRow,
): LearningContentRevision => {
  const dto = learningContentDto(r);
  if (dto.payload.kind === "lesson")
    dto.payload = {
      ...dto.payload,
      contentBlocks: dto.payload.contentBlocks.map((block) => {
        if (block.type !== "completion_step") return block;
        const { steps: _, ...visible } = block;
        void _;
        return visible;
      }),
    };
  return dto;
};

export class LearningPathContentService {
  readonly physics = new PhysicsGateway();
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly math: MathPort,
    readonly studio: ContentStudioService,
  ) {}
  async row(
    id: string,
    tx: Tx = this.store.db,
    lock = false,
  ): Promise<ContentRow> {
    const [r] = await tx.$queryRaw<ContentRow[]>(
      Prisma.sql`SELECT * FROM learning_content_revisions WHERE id=${uuid(id)}::uuid ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`,
    );
    if (!r) throw missing();
    return r;
  }
  private expected(r: ContentRow, revision: number): void {
    if (r.edit_revision !== revision)
      throw new ApiFault(
        409,
        "revision_conflict",
        "تغيرت نسخة المحتوى؛ أعد تحميلها.",
        [],
        r.edit_revision,
      );
  }
  private canEdit(r: ContentRow, actor: ProductOwner): void {
    if (actor.role === "teacher" && r.created_by !== actor.userId)
      throw new ApiFault(403, "forbidden", "يمكنك تحرير مسوداتك فقط.");
  }
  private async audit(
    tx: Tx,
    r: ContentRow,
    actor: ProductOwner,
    action: string,
  ) {
    await tx.$executeRaw`INSERT INTO learning_content_events(id,revision_id,actor_id,action,content_hash) VALUES(${randomUUID()}::uuid,${r.id}::uuid,${actor.userId}::uuid,${action},${r.content_hash})`;
  }
  async bank(
    subject?: SubjectCode,
    ids?: string[],
    tx: Tx = this.store.db,
    pinned = false,
  ): Promise<LearningBankProblem[]> {
    if (ids?.length === 0) return [];
    const refs = ids?.map(uuid) ?? [];
    const result: LearningBankProblem[] = [];
    if (!subject || subject === "algebra") {
      const rows = await tx.$queryRaw<
        {
          id: string;
          problem_id: string;
          statement_ar: string;
          original_equation_raw: string;
          difficulty_band: number;
          item_kind: LearningBankProblem["kind"];
          learning_family: string | null;
          primary_skill: string;
          skills: string[];
        }[]
      >(
        Prisma.sql`SELECT r.id,r.problem_id,r.statement_ar,r.original_equation_raw,r.difficulty_band,r.item_kind,r.learning_family,s.skill_code AS primary_skill,ARRAY(SELECT s2.skill_code FROM problem_skills ps2 JOIN skills s2 ON s2.id=ps2.skill_id WHERE ps2.problem_revision_id=r.id ORDER BY CASE WHEN ps2.coverage_kind='primary' THEN 0 ELSE 1 END,s2.skill_code) AS skills FROM problem_revisions r JOIN content_releases c ON c.id=r.release_id JOIN problems p ON p.id=r.problem_id JOIN problem_skills ps ON ps.problem_revision_id=r.id AND ps.coverage_kind='primary' JOIN skills s ON s.id=ps.skill_id WHERE ${pinned ? Prisma.sql`r.review_status IN ('published','retired')` : Prisma.sql`r.review_status='published' AND c.status='published' AND p.archived_at IS NULL AND s.status='active' AND (c.release_code NOT LIKE 'studio-%' OR EXISTS(SELECT 1 FROM studio_algebra_links sl JOIN studio_revisions sr ON sr.id=sl.studio_revision_id WHERE sl.problem_revision_id=r.id AND sr.status='published'))`} AND s.skill_code IN ('SK-ALG-01','SK-ALG-02','SK-ALG-03','SK-ALG-04','SK-ALG-05','SK-ALG-06','SK-ALG-07') ${refs.length ? Prisma.sql`AND r.id IN (${Prisma.join(refs.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.empty} ORDER BY s.skill_code,r.difficulty_band,r.id LIMIT 500`,
      );
      for (const r of rows)
        result.push({
          revisionId: r.id,
          problemId: r.problem_id,
          source: "algebra",
          subject: "algebra",
          titleAr: r.statement_ar,
          statementAr: r.statement_ar,
          skillCodes: r.skills,
          primarySkillCode: r.primary_skill,
          difficulty: r.difficulty_band,
          kind: r.item_kind,
          familyCode: r.learning_family ?? r.problem_id,
          equationRaw: r.original_equation_raw,
        });
    }
    if (subject !== "algebra") {
      const rows = await tx.$queryRaw<
        { id: string; item_id: string; payload: ContentPayload }[]
      >(
        Prisma.sql`SELECT id,item_id,payload FROM studio_revisions WHERE payload->>'subject' IN ('physics','programming') AND ${pinned ? Prisma.sql`status IN ('published','archived') AND reviewed_at IS NOT NULL AND published_at IS NOT NULL` : Prisma.sql`status='published'`} ${subject ? Prisma.sql`AND payload->>'subject'=${subject}` : Prisma.empty} ${refs.length ? Prisma.sql`AND id IN (${Prisma.join(refs.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.empty} ORDER BY payload->>'subject',payload->>'lessonCode',id LIMIT 500`,
      );
      for (const r of rows) {
        const p = r.payload;
        result.push({
          revisionId: r.id,
          problemId: r.item_id,
          source: "studio",
          subject: p.subject,
          titleAr: p.titleAr,
          statementAr: p.statementAr,
          skillCodes: p.skillCodes,
          primarySkillCode: p.skillCodes[0]!,
          difficulty: p.difficulty,
          kind: p.kind,
          familyCode: p.familyCode,
          ...(p.physics
            ? {
                physics: {
                  quantity: p.physics.quantity,
                  givens: p.physics.givens,
                  allowedUnits: ["m", "s", "m/s", "m/s²", "km/h"],
                },
              }
            : {}),
          ...(p.programming
            ? {
                programming: {
                  starterCode: p.programming.starterCode,
                  publicTests: p.programming.tests
                    .filter((t) => !t.hidden)
                    .map(({ input, expectedOutput }) => ({
                      input,
                      expectedOutput,
                    })),
                },
              }
            : {}),
        });
      }
    }
    return ids
      ? ids.flatMap((id) => result.filter((r) => r.revisionId === id))
      : result;
  }
  async bankList(request: RequestContext, query: Record<string, unknown>) {
    await this.accounts.actor(request, false, editors);
    only(query, ["subject", "skillCode", "difficulty"]);
    const subject =
      query.subject === undefined ? undefined : learningSubject(query.subject);
    const skill =
      query.skillCode === undefined ? null : textField(query.skillCode, 80);
    const difficulty =
      query.difficulty === undefined ? null : textField(query.difficulty, 1);
    if (difficulty && !["1", "2", "3"].includes(difficulty))
      throw productInvalid();
    return {
      items: (await this.bank(subject)).filter(
        (r) =>
          (!skill || r.skillCodes.includes(skill)) &&
          (!difficulty || r.difficulty === Number(difficulty)),
      ),
    };
  }
  async skillMap(
    tx: Tx = this.store.db,
    publishedOnly = true,
  ): Promise<LearningSkillMap> {
    const rows = await tx.$queryRaw<ContentRow[]>(
      Prisma.sql`SELECT * FROM learning_content_revisions WHERE payload->>'kind'='lesson' ${publishedOnly ? Prisma.sql`AND status='published'` : Prisma.empty} ORDER BY version DESC,id`,
    );
    const skills = await tx.$queryRaw<
      { skill_code: string; name_ar: string; prerequisites: string[] }[]
    >`SELECT DISTINCT ON(s.skill_code) s.skill_code,s.name_ar,ARRAY(SELECT p.skill_code FROM skill_prerequisites k JOIN skills p ON p.id=k.prerequisite_skill_id WHERE k.skill_id=s.id ORDER BY p.skill_code) AS prerequisites FROM skills s JOIN content_releases c ON c.id=s.release_id WHERE c.status='published' AND s.status='active' AND s.skill_code<>'SK-ALG-08' ORDER BY s.skill_code,(c.release_code LIKE 'studio-%'),c.published_at DESC,s.id`;
    const titles: [string, string][] = [
      ...ALGEBRA_SKILLS.map(([c, t]): [string, string] => [c, t]),
      ["PHYS-CONSTANT_MOTION", "الحركة بسرعة ثابتة"],
      ["PHYS-DISTANCE_DISPLACEMENT", "المسافة والإزاحة"],
      ["PHYS-AVERAGE_SPEED", "السرعة المتوسطة"],
      ["PHYS-ACCELERATION", "التسارع"],
      ["PHYS-FINAL_VELOCITY", "السرعة النهائية"],
      ["PHYS-DISPLACEMENT", "الإزاحة مع التسارع"],
      ["PY-PRINT", "الطباعة"],
      ["PY-VARIABLES", "المتغيرات"],
      ["PY-ARITHMETIC", "العمليات الحسابية"],
      ["PY-CONDITIONS", "الشروط"],
      ["PY-LOOPS", "الحلقات"],
      ["PY-FUNCTIONS", "الدوال"],
    ];
    return {
      ruleVersion: LEARNING_MAP_VERSION,
      mappingPending: PENDING_MAPPINGS,
      skills: titles.map(([skillCode, titleAr]) => ({
        skillCode,
        titleAr:
          skills.find((s) => s.skill_code === skillCode)?.name_ar ?? titleAr,
        prerequisiteSkillCodes:
          skills.find((s) => s.skill_code === skillCode)?.prerequisites ?? [],
        lessonRevisionId:
          rows.find(
            (r) =>
              r.payload.kind === "lesson" &&
              r.payload.skillCodes[0] === skillCode,
          )?.id ?? null,
      })),
      errors: Object.entries(ALGEBRA_ERROR_SKILLS).map(
        ([errorCode, candidateSkills]) => ({
          errorCode,
          candidateSkills,
          mappingPending: errorCode === "ERR-ALG-05",
        }),
      ),
    };
  }
  async publicSkillMap(request: RequestContext) {
    await this.accounts.actor(request, false);
    return this.skillMap();
  }
  async tracks(request: RequestContext, subject?: string) {
    await this.accounts.actor(request, false);
    const s = subject === undefined ? null : learningSubject(subject);
    const rows = await this.store.db.$queryRaw<
      ContentRow[]
    >`SELECT * FROM learning_content_revisions WHERE status='published' AND payload->>'kind'='track' AND (${s}::text IS NULL OR payload->>'subject'=${s}) ORDER BY payload->>'subject',payload->>'titleAr',id`;
    return { items: rows.map(learningContentDto) };
  }
  async track(
    request: RequestContext,
    id: string,
  ): Promise<LearningTrackDetail> {
    const actor = await this.accounts.actor(request, false);
    const r = await this.row(id);
    if (r.payload.kind !== "track") throw missing();
    let historical = false;
    if (r.status !== "published") {
      const [pin] = await this.store.db.$queryRaw<
        { id: string }[]
      >`SELECT id FROM learning_assessments WHERE owner_key=${actor.ownerKey} AND track_revision_id=${id}::uuid LIMIT 1`;
      if (r.status !== "archived" || !r.published_at || !pin) throw missing();
      historical = true;
    }
    const lessons: LearningContentRevision[] = [];
    for (const ref of r.payload.units.flatMap((u) => u.lessonRevisionIds)) {
      const lesson = await this.row(ref);
      if (
        !(
          lesson.status === "published" ||
          (historical && lesson.status === "archived" && lesson.published_at)
        ) ||
        lesson.payload.kind !== "lesson" ||
        lesson.payload.subject !== r.payload.subject
      )
        continue;
      lessons.push(learningStudentContentDto(lesson));
    }
    await this.recordReadExposure(
      actor,
      lessons.map((l) => l.id),
    );
    return { ...learningContentDto(r), lessons };
  }
  private async recordReadExposure(
    actor: ProductOwner,
    lessonIds: string[],
    includePractice = false,
  ) {
    if (!lessonIds.length) return;
    await this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.ownerKey},0))`;
      await requireProductLearningAccess(tx, actor, this.store.syntheticData);
      for (const id of lessonIds) {
        await tx.$executeRaw`INSERT INTO learning_lesson_events(id,owner_key,lesson_revision_id,event_kind) SELECT ${randomUUID()}::uuid,${actor.ownerKey},${id}::uuid,'lesson_started' WHERE NOT EXISTS(SELECT 1 FROM learning_lesson_events WHERE owner_key=${actor.ownerKey} AND lesson_revision_id=${id}::uuid AND event_kind='lesson_started')`;
        const lesson = await this.row(id, tx);
        if (lesson.payload.kind !== "lesson") continue;
        if (includePractice)
          await tx.$executeRaw`INSERT INTO learning_lesson_events(id,owner_key,lesson_revision_id,event_kind) SELECT ${randomUUID()}::uuid,${actor.ownerKey},${id}::uuid,'lesson_viewed' WHERE NOT EXISTS(SELECT 1 FROM learning_lesson_events WHERE owner_key=${actor.ownerKey} AND lesson_revision_id=${id}::uuid AND event_kind='lesson_viewed')`;
        const refs = [
          ...new Set([
            ...(includePractice
              ? lesson.payload.practiceProblemRevisionIds
              : []),
            ...lesson.payload.contentBlocks
              .filter((b) => b.type === "worked_example_ref")
              .flatMap((b) =>
                b.problemRevisionId ? [b.problemRevisionId] : [],
              ),
          ]),
        ];
        if (lesson.payload.subject === "algebra" && actor.guestId) {
          for (const ref of refs)
            await recordExposure(
              tx,
              actor.guestId,
              ref,
              "learning_lesson_practice",
            );
        }
        if (lesson.payload.subject === "physics" && refs.length) {
          const revisions = await tx.$queryRaw<
            { id: string; payload: ContentPayload }[]
          >(
            Prisma.sql`SELECT id,payload FROM studio_revisions WHERE id IN (${Prisma.join(refs.map((ref) => Prisma.sql`${ref}::uuid`))}) AND status IN ('published','archived') AND payload->>'subject'='physics'`,
          );
          await recordPhysicsExposures(tx, actor.ownerKey, revisions);
        }
      }
    });
  }
  async lesson(
    request: RequestContext,
    id: string,
  ): Promise<LearningLessonDetail> {
    const actor = await this.accounts.actor(request, false);
    const r = await this.row(id);
    if (r.payload.kind !== "lesson") throw missing();
    if (r.status !== "published") {
      const [pin] = await this.store.db.$queryRaw<
        { id: string }[]
      >`SELECT id FROM learning_lesson_events WHERE owner_key=${actor.ownerKey} AND lesson_revision_id=${id}::uuid UNION ALL SELECT id FROM learning_assessments WHERE owner_key=${actor.ownerKey} AND lesson_revision_id=${id}::uuid LIMIT 1`;
      if (r.status !== "archived" || !r.published_at || !pin) throw missing();
    }
    const p = r.payload;
    await this.recordReadExposure(actor, [r.id], true);
    return {
      ...learningStudentContentDto(r),
      practiceProblems: await this.bank(
        p.subject,
        p.practiceProblemRevisionIds,
        this.store.db,
        true,
      ),
      assessmentProblems: (
        await this.bank(
          p.subject,
          p.assessmentProblemRevisionIds,
          this.store.db,
          true,
        )
      ).map(
        ({
          revisionId,
          problemId,
          source,
          subject,
          skillCodes,
          primarySkillCode,
          difficulty,
          kind,
          familyCode,
        }) => ({
          revisionId,
          problemId,
          source,
          subject,
          titleAr: "سؤال قياس مستقل",
          statementAr: "",
          skillCodes,
          primarySkillCode,
          difficulty,
          kind,
          familyCode,
        }),
      ),
    };
  }
  async list(request: RequestContext, query: Record<string, unknown>) {
    const actor = await this.accounts.actor(request, false, editors);
    only(query, ["subject", "kind", "status"]);
    const subject =
        query.subject === undefined ? null : learningSubject(query.subject),
      kind = query.kind === undefined ? null : textField(query.kind, 10),
      status = query.status === undefined ? null : textField(query.status, 20);
    if (
      (kind && !["track", "lesson"].includes(kind)) ||
      (status &&
        !["draft", "in_review", "approved", "published", "archived"].includes(
          status,
        ))
    )
      throw productInvalid();
    const rows = await this.store.db.$queryRaw<
      ContentRow[]
    >`SELECT * FROM learning_content_revisions WHERE (${subject}::text IS NULL OR payload->>'subject'=${subject}) AND (${kind}::text IS NULL OR payload->>'kind'=${kind}) AND (${status}::text IS NULL OR status=${status}) AND (${actor.role} <> 'teacher' OR created_by=${actor.userId}::uuid) ORDER BY created_at DESC,id LIMIT 300`;
    return { items: rows.map(learningContentDto) };
  }
  async detail(request: RequestContext, id: string) {
    const actor = await this.accounts.actor(request, false, editors),
      r = await this.row(id);
    this.canEdit(r, actor);
    return learningContentDto(r);
  }
  private async insert(
    tx: Tx,
    actor: ProductOwner,
    payload: LearningContentPayload,
  ) {
    const itemId = randomUUID(),
      id = randomUUID();
    await tx.$executeRaw`INSERT INTO learning_content_items(id,code,subject_code,kind) VALUES(${itemId}::uuid,${payload.subject + ":" + payload.code + ":" + itemId},${payload.subject},${payload.kind})`;
    await tx.$executeRaw`INSERT INTO learning_content_revisions(id,item_id,version,payload,content_hash,created_by) VALUES(${id}::uuid,${itemId}::uuid,1,${JSON.stringify(payload)}::jsonb,${digest(payload)},${actor.userId}::uuid)`;
    const r = await this.row(id, tx);
    await this.audit(tx, r, actor, "create");
    return learningContentDto(r);
  }
  async create(request: RequestContext, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors),
      payload = parseLearningPayload(raw);
    return productMutation(
      this.store,
      actor,
      request,
      "learning-content.create",
      payload,
      (tx) => this.insert(tx, actor, payload),
    );
  }
  async edit(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors),
      b = record(raw);
    only(b, ["expectedRevision", "payload"]);
    const expected = revisionField(b.expectedRevision),
      payload = parseLearningPayload(b.payload);
    return productMutation(
      this.store,
      actor,
      request,
      "learning-content.edit:" + uuid(id),
      b,
      async (tx) => {
        const r = await this.row(id, tx, true);
        this.canEdit(r, actor);
        this.expected(r, expected);
        if (
          r.status !== "draft" ||
          r.payload.kind !== payload.kind ||
          r.payload.subject !== payload.subject ||
          r.payload.code !== payload.code
        )
          throw new ApiFault(
            409,
            "invalid_state",
            "حرر المسودة فقط مع حفظ هوية المادة والمحتوى.",
          );
        await tx.$executeRaw`UPDATE learning_content_revisions SET payload=${JSON.stringify(payload)}::jsonb,content_hash=${digest(payload)},validation=NULL,edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        const changed = await this.row(id, tx);
        await this.audit(tx, changed, actor, "edit");
        return learningContentDto(changed);
      },
    );
  }
  async validatePayload(
    payload: LearningContentPayload,
    id: string = randomUUID(),
    tx: Tx = this.store.db,
  ): Promise<LearningContentValidation> {
    const issues: string[] = [],
      examples: LearningContentValidation["examples"] = [];
    if (payload.kind === "track") {
      const ids = payload.units.flatMap((u) => u.lessonRevisionIds);
      const graphNodes: { skillCode: string }[] = [],
        graphEdges: GraphEdge[] = [];
      if (!ids.length || new Set(ids).size !== ids.length)
        issues.push("يلزم درس منشور واحد على الأقل دون تكرار.");
      for (const ref of ids) {
        try {
          const r = await this.row(ref, tx);
          if (r.payload.kind === "lesson" && r.status === "published") {
            for (const skill of [
              ...r.payload.skillCodes,
              ...r.payload.prerequisiteSkillCodes,
            ])
              if (!graphNodes.some((n) => n.skillCode === skill))
                graphNodes.push({ skillCode: skill });
            for (const skill of r.payload.skillCodes)
              for (const prerequisite of r.payload.prerequisiteSkillCodes)
                graphEdges.push({
                  fromSkill: skill,
                  toSkill: prerequisite,
                  relationKind: "required",
                  rationaleAr: "متطلب الدرس المنشور",
                  reviewState: "reviewed",
                });
          }
          if (
            r.status !== "published" ||
            r.payload.kind !== "lesson" ||
            r.payload.subject !== payload.subject
          )
            issues.push("المسار يشير إلى درس غير منشور أو مادة مختلفة.");
        } catch {
          issues.push("مرجع درس غير متاح.");
        }
      }
      for (const issue of validateGraph(graphNodes, graphEdges))
        issues.push("خريطة المتطلبات غير صالحة: " + issue);
    } else {
      const refs = [
        ...payload.practiceProblemRevisionIds,
        ...payload.assessmentProblemRevisionIds,
        ...payload.contentBlocks.flatMap((b) =>
          b.problemRevisionId ? [b.problemRevisionId] : [],
        ),
      ];
      const bank = await this.bank(payload.subject, [...new Set(refs)], tx);
      if (bank.length !== new Set(refs).size)
        issues.push("يوجد سؤال غير منشور أو غير مدعوم ضمن الروابط.");
      if (bank.some((p) => !payload.skillCodes.includes(p.primarySkillCode)))
        issues.push("المهارة الأساسية للسؤال لا تتطابق مع مهارات الدرس.");
      for (const ref of payload.prerequisiteLessonIds) {
        try {
          const p = await this.row(ref, tx);
          if (
            p.id === id ||
            p.status !== "published" ||
            p.payload.kind !== "lesson" ||
            p.payload.subject !== payload.subject
          )
            issues.push("الدرس السابق غير منشور أو غير صالح.");
        } catch {
          issues.push("مرجع درس سابق غير متاح.");
        }
      }
      if (
        payload.subject === "algebra" &&
        (!payload.practiceProblemRevisionIds.length ||
          !payload.assessmentProblemRevisionIds.length ||
          !payload.contentBlocks.some((b) => b.type === "math_example"))
      )
        issues.push(
          "يلزم مثال جبري وسؤال تدريب وسؤال مستقل مختلفان على الأقل.",
        );
      if (
        payload.contentBlocks.some(
          (b) =>
            b.problemRevisionId &&
            payload.assessmentProblemRevisionIds.includes(b.problemRevisionId),
        )
      )
        issues.push("لا يمكن كشف سؤال القياس ضمن روابط التدريب.");
      if (
        payload.code === "ALG-L04" &&
        (payload.practiceProblemRevisionIds.length < 2 ||
          payload.contentBlocks.filter((b) => b.type === "math_example")
            .length < 2 ||
          payload.contentBlocks.filter((b) => b.type === "paragraph").length <
            2 ||
          !payload.contentBlocks.some((b) => b.type === "common_mistake"))
      )
        issues.push(
          "درس توزيع الأقواس يحتاج فقرتين ومثالين وخطأ شائعًا وسؤالي تدريب.",
        );
      for (const [blockIndex, b] of payload.contentBlocks.entries()) {
        if (
          b.type === "math_example" ||
          b.type === "worked_steps" ||
          b.type === "completion_step"
        ) {
          try {
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
              b.raw!,
            );
            const statuses: string[] = [];
            let previous = b.raw!;
            for (const step of b.steps ?? []) {
              const result = await this.math.verify(context, {
                fromKind: "problem",
                fromStepVersionId: null,
                toStepVersionId: randomUUID(),
                fromRaw: previous,
                toRaw: step.raw,
              });
              statuses.push(result.status);
              previous = step.raw;
            }
            examples.push({
              blockIndex,
              normalizedText: parsed.normalizedText,
              displayAr: parsed.displayAr,
              ast: parsed.ast,
              status: parsed.parseStatus,
              stepStatuses: statuses,
            });
            if (
              parsed.parseStatus !== "parsed" ||
              statuses.some((s) => s !== "verified_valid")
            )
              issues.push(`المثال ${blockIndex + 1} غير متحقق؛ لا يمكن نشره.`);
            const exposed = [b.raw!, ...(b.steps ?? []).map((s) => s.raw)].map(
              (s) => s.replace(/\s/g, ""),
            );
            if (
              bank.some(
                (p) =>
                  payload.assessmentProblemRevisionIds.includes(p.revisionId) &&
                  p.equationRaw &&
                  exposed.includes(p.equationRaw.replace(/\s/g, "")),
              )
            )
              issues.push(
                "سؤال القياس مستخدم في المثال المحلول؛ اختر سؤالًا مختلفًا.",
              );
          } catch {
            issues.push("تعذر التحقق من مثال الجبر؛ النشر محجوب.");
          }
        } else if (b.type === "physics_example") {
          try {
            const result = await this.physics.validateReference(id, b.physics!);
            examples.push({
              blockIndex,
              normalizedText: null,
              displayAr: null,
              ast: null,
              status: result.status,
              stepStatuses: [],
            });
            if (result.status !== "correct")
              issues.push("مثال الفيزياء لا يطابق القيمة والوحدة والمعطيات.");
          } catch {
            issues.push("متحقق الفيزياء غير متاح؛ النشر محجوب.");
          }
        }
      }
      if (
        payload.errorCodes.includes("ERR-ALG-05") &&
        !payload.mappingPending.some((p) => p.includes("ERR-ALG-05"))
      )
        issues.push("يبقى ربط ERR-ALG-05 معلقًا ويجب إظهاره دون إغلاقه.");
    }
    return {
      valid: issues.length === 0,
      issues,
      examples,
      engine:
        payload.kind === "track"
          ? "learning-reference-v1"
          : payload.subject === "algebra"
            ? "math-internal-v1"
            : payload.subject === "physics"
              ? "physics-internal-v1"
              : "read_only_content",
      checkedAt: new Date().toISOString(),
    };
  }
  async validate(request: RequestContext, id: string, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors),
      b = record(raw);
    only(b, ["expectedRevision"]);
    const expected = revisionField(b.expectedRevision),
      snapshot = await this.row(id);
    this.canEdit(snapshot, actor);
    const validation = await this.validatePayload(
      parseLearningPayload(snapshot.payload),
      id,
    );
    return productMutation(
      this.store,
      actor,
      request,
      "learning-content.validate:" + uuid(id),
      b,
      async (tx) => {
        const r = await this.row(id, tx, true);
        this.expected(r, expected);
        if (r.content_hash !== snapshot.content_hash)
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغير المحتوى أثناء التحقق.",
          );
        await tx.$executeRaw`UPDATE learning_content_revisions SET validation=${JSON.stringify(validation)}::jsonb WHERE id=${id}::uuid`;
        await this.audit(tx, r, actor, "validate");
        return learningContentDto(await this.row(id, tx));
      },
    );
  }
  private async lockReferences(tx: Tx, payload: LearningContentPayload) {
    const lessonRefs =
      payload.kind === "track"
        ? payload.units.flatMap((u) => u.lessonRevisionIds)
        : payload.prerequisiteLessonIds;
    if (lessonRefs.length) {
      const rows = await tx.$queryRaw<ContentRow[]>(
        Prisma.sql`SELECT * FROM learning_content_revisions WHERE id IN (${Prisma.join(lessonRefs.map((ref) => Prisma.sql`${ref}::uuid`))}) FOR SHARE`,
      );
      if (
        rows.length !== new Set(lessonRefs).size ||
        rows.some(
          (r) =>
            r.status !== "published" ||
            r.payload.kind !== "lesson" ||
            r.payload.subject !== payload.subject,
        )
      )
        throw productInvalid(
          "تغير نشر الدرس المرتبط أثناء التحقق؛ أعد المراجعة.",
        );
    }
    if (payload.kind === "lesson") {
      const refs = [
        ...new Set([
          ...payload.practiceProblemRevisionIds,
          ...payload.assessmentProblemRevisionIds,
          ...payload.contentBlocks.flatMap((b) =>
            b.problemRevisionId ? [b.problemRevisionId] : [],
          ),
        ]),
      ];
      if (!refs.length) return;
      const queryRefs = Prisma.join(
        refs.map((ref) => Prisma.sql`${ref}::uuid`),
      );
      // Keep the publication/status rows stable until this review commits.
      await tx.$queryRaw(
        Prisma.sql`SELECT r.id FROM problem_revisions r JOIN content_releases c ON c.id=r.release_id JOIN problems p ON p.id=r.problem_id JOIN problem_skills ps ON ps.problem_revision_id=r.id JOIN skills s ON s.id=ps.skill_id WHERE r.id IN (${queryRefs}) FOR SHARE OF r,c,p,s`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT r.id FROM studio_revisions r WHERE r.id IN (${queryRefs}) OR EXISTS(SELECT 1 FROM studio_algebra_links l WHERE l.studio_revision_id=r.id AND l.problem_revision_id IN (${queryRefs})) FOR SHARE OF r`,
      );
      if ((await this.bank(payload.subject, refs, tx)).length !== refs.length)
        throw productInvalid("تغير نشر سؤال مرتبط أثناء التحقق؛ أعد المراجعة.");
    }
  }
  async transition(request: RequestContext, id: string, raw: unknown) {
    const b = record(raw);
    only(b, ["expectedRevision", "action"]);
    const expected = revisionField(b.expectedRevision),
      action = textField(b.action, 20);
    if (!["submit", "approve", "publish", "archive", "revise"].includes(action))
      throw productInvalid();
    const actor = await this.accounts.actor(
      request,
      true,
      ["approve", "publish", "archive"].includes(action) ? ["admin"] : editors,
    );
    const snapshot = await this.row(id);
    if (["submit", "revise"].includes(action)) this.canEdit(snapshot, actor);
    const validation = ["approve", "publish"].includes(action)
      ? await this.validatePayload(parseLearningPayload(snapshot.payload), id)
      : null;
    return productMutation(
      this.store,
      actor,
      request,
      "learning-content." + action + ":" + uuid(id),
      b,
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM learning_content_items WHERE id=${snapshot.item_id}::uuid FOR UPDATE`;
        const r = await this.row(id, tx, true);
        this.expected(r, expected);
        if (r.content_hash !== snapshot.content_hash)
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغير المحتوى أثناء المراجعة.",
          );
        const allowed: Record<string, ContentStatus[]> = {
          submit: ["draft"],
          approve: ["in_review"],
          publish: ["approved"],
          archive: ["published"],
          revise: ["in_review", "approved", "published", "archived"],
        };
        if (!allowed[action]?.includes(r.status))
          throw new ApiFault(
            409,
            "invalid_state",
            "الانتقال غير متاح في هذه الحالة.",
          );
        if (validation && !validation.valid)
          throw productInvalid(validation.issues.join(" "));
        if (validation) await this.lockReferences(tx, r.payload);
        if (action === "revise") {
          const [n] = await tx.$queryRaw<
            { version: number }[]
          >`SELECT coalesce(max(version),0)+1 AS version FROM learning_content_revisions WHERE item_id=${r.item_id}::uuid`;
          const next = randomUUID();
          await tx.$executeRaw`INSERT INTO learning_content_revisions(id,item_id,version,payload,content_hash,created_by) VALUES(${next}::uuid,${r.item_id}::uuid,${n!.version},${JSON.stringify(r.payload)}::jsonb,${r.content_hash},${actor.userId}::uuid)`;
          const created = await this.row(next, tx);
          await this.audit(tx, created, actor, "revise");
          return learningContentDto(created);
        }
        if (action === "submit")
          await tx.$executeRaw`UPDATE learning_content_revisions SET status='in_review',edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        if (action === "approve")
          await tx.$executeRaw`UPDATE learning_content_revisions SET status='approved',reviewed_by=${actor.userId}::uuid,reviewed_at=now(),validation=${JSON.stringify(validation)}::jsonb,edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        if (action === "publish") {
          await tx.$executeRaw`UPDATE learning_content_revisions SET status='archived',edit_revision=edit_revision+1 WHERE item_id=${r.item_id}::uuid AND status='published'`;
          await tx.$executeRaw`UPDATE learning_content_revisions SET status='published',published_by=${actor.userId}::uuid,published_at=now(),validation=${JSON.stringify(validation)}::jsonb,edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        }
        if (action === "archive")
          await tx.$executeRaw`UPDATE learning_content_revisions SET status='archived',edit_revision=edit_revision+1 WHERE id=${id}::uuid`;
        const changed = await this.row(id, tx);
        await this.audit(tx, changed, actor, action);
        return learningContentDto(changed);
      },
    );
  }
  async seed(request: RequestContext, raw: unknown) {
    const actor = await this.accounts.actor(request, true, editors);
    only(record(raw), []);
    const bundle: unknown = JSON.parse(
      await readFile(
        path.resolve(__dirname, "../data/learning-paths.draft.v1.json"),
        "utf8",
      ),
    );
    if (!Array.isArray(bundle)) throw productInvalid();
    return productMutation(
      this.store,
      actor,
      request,
      "learning-content.seed",
      {},
      async (tx) => {
        const existing = await tx.$queryRaw<
          ContentRow[]
        >`SELECT * FROM learning_content_revisions WHERE created_by=${actor.userId}::uuid AND payload->>'code' IN ('ALG-L01','ALG-L02','ALG-L03','ALG-L04','ALG-L05','ALG-L06','PHY-L01','PHY-L02','PHY-L03','PHY-L04','PHY-L05','PHY-L06','PY-L01','PY-L02','PY-L03','PY-L04','PY-L05','PY-L06','ALG-BASIC','PHY-MOTION','PY-BASIC') ORDER BY version DESC`;
        const items: LearningContentRevision[] = [],
          byCode = new Map<string, string>();
        for (const value of bundle) {
          const b = record(value),
            rawPayload = { ...b };
          const old = existing.find((r) => r.payload.code === b.code);
          if (old) {
            items.push(learningContentDto(old));
            byCode.set(old.payload.code, old.id);
            continue;
          }
          if (b.kind === "track") {
            const units = b.units as {
              code: string;
              titleAr: string;
              lessonCodes: string[];
            }[];
            rawPayload.units = units.map((u) => ({
              code: u.code,
              titleAr: u.titleAr,
              lessonRevisionIds: u.lessonCodes
                .map((code) => byCode.get(code))
                .filter(Boolean),
            }));
          }
          const payload = parseLearningPayload(rawPayload);
          if (payload.kind === "lesson") {
            const candidates = (
              await this.bank(payload.subject, undefined, tx)
            ).filter((p) => p.primarySkillCode === payload.skillCodes[0]);
            const examples = payload.contentBlocks
              .flatMap((b) => [b.raw, ...(b.steps ?? []).map((s) => s.raw)])
              .filter(Boolean)
              .map((s) => s!.replace(/\s/g, ""));
            const eligible = candidates.filter(
              (p) =>
                !p.equationRaw ||
                !examples.includes(p.equationRaw.replace(/\s/g, "")),
            );
            payload.practiceProblemRevisionIds = eligible
              .filter((p) => p.kind !== "transfer")
              .slice(0, 2)
              .map((p) => p.revisionId);
            payload.assessmentProblemRevisionIds = eligible
              .filter(
                (p) =>
                  !payload.practiceProblemRevisionIds.includes(p.revisionId),
              )
              .slice(-2)
              .map((p) => p.revisionId);
          }
          const created = await this.insert(tx, actor, payload);
          items.push(created);
          byCode.set(payload.code, created.id);
        }
        return { items };
      },
    );
  }
}

@Controller("api/v1")
export class LearningPathContentController {
  constructor(readonly content: LearningPathContentService) {}
  @Get("learning/tracks") tracks(
    @Req() r: RequestContext,
    @Query("subject") s?: string,
  ) {
    return this.content.tracks(r, s).then((x) => productEnvelope(r, x));
  }
  @Get("learning/tracks/:id") track(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.content.track(r, id).then((x) => productEnvelope(r, x));
  }
  @Get("learning/lessons/:id") lesson(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.content.lesson(r, id).then((x) => productEnvelope(r, x));
  }
  @Get("learning/skill-map") mapping(@Req() r: RequestContext) {
    return this.content.publicSkillMap(r).then((x) => productEnvelope(r, x));
  }
  @Get("studio/learning-bank") bank(
    @Req() r: RequestContext,
    @Query() q: Record<string, unknown>,
  ) {
    return this.content.bankList(r, q).then((x) => productEnvelope(r, x));
  }
  @Get("studio/learning-content") list(
    @Req() r: RequestContext,
    @Query() q: Record<string, unknown>,
  ) {
    return this.content.list(r, q).then((x) => productEnvelope(r, x));
  }
  @Post("studio/learning-content/seed") seed(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.content.seed(r, b).then((x) => productEnvelope(r, x));
  }
  @Post("studio/learning-content") create(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.content.create(r, b).then((x) => productEnvelope(r, x));
  }
  @Get("studio/learning-content/:id") detail(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.content.detail(r, id).then((x) => productEnvelope(r, x));
  }
  @Put("studio/learning-content/:id") edit(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.content.edit(r, id, b).then((x) => productEnvelope(r, x));
  }
  @Post("studio/learning-content/:id/validate") validate(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.content.validate(r, id, b).then((x) => productEnvelope(r, x));
  }
  @Post("studio/learning-content/:id/transition") transition(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.content.transition(r, id, b).then((x) => productEnvelope(r, x));
  }
}
