import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { ContentPayload } from "../../../packages/contracts/src/product";
import type {
  PhysicsAttempt,
  PhysicsLearningLoop,
  PhysicsProblem,
} from "../../../packages/contracts/src/product-physics";
import { AccountService } from "./accounts";
import { ApiFault, RequestContext } from "./http";
import { uuid } from "./contracts";
import {
  only,
  productInvalid,
  productMutation,
  record,
  revisionField,
} from "./product-core";
import { Store } from "./store";
import { requireProductLearningAccess } from "./learning-access";

type Tx = Prisma.TransactionClient;
type Revision = {
  id: string;
  item_id: string;
  code: string;
  payload: ContentPayload;
};
type Attempt = {
  id: string;
  problem_revision_id: string;
  revision: number;
  verdict: PhysicsAttempt;
  assistance_level: number;
  independent: boolean;
};
type Episode = {
  id: string;
  root_attempt_id: string;
  root_revision: number;
  state: PhysicsLearningLoop["state"];
  created_at: Date;
};
const missing = () => new ApiFault(404, "not_found", "المورد غير متاح.");
const blocked = (message = "تغير أصل التدريب؛ ابدأ حلقة من النسخة الحالية.") =>
  new ApiFault(409, "invalid_state", message);
const publicProblem = (r: Revision): PhysicsProblem => ({
  id: r.id,
  problemId: r.item_id,
  revisionId: r.id,
  code: r.code,
  titleAr: r.payload.titleAr,
  statementAr: r.payload.statementAr,
  unitCode: r.payload.unitCode,
  lessonCode: r.payload.lessonCode,
  lessonTitleAr: r.payload.lessonTitleAr,
  skillCodes: r.payload.skillCodes,
  difficulty: r.payload.difficulty,
  quantity: r.payload.physics!.quantity,
  givens: r.payload.physics!.givens,
  allowedUnits: ["m", "s", "m/s", "m/s²", "km/h"],
});
/** Identity normalization only. The Python verifier alone decides physics. */
export function physicsExposureKey(p: {
  physics?: Pick<
    NonNullable<ContentPayload["physics"]>,
    "formula" | "quantity" | "givens"
  >;
}): string {
  if (!p.physics) throw productInvalid();
  const numberKey = (raw: string) => {
    const normalized = raw
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/−/g, "-")
      .replace(/٫/g, ".");
    if (!/^-?\d+(?:\.\d+|\/\d+)?$/.test(normalized)) return normalized;
    let a: bigint, b: bigint;
    if (normalized.includes("/")) {
      const parts = normalized.split("/");
      a = BigInt(parts[0]!);
      b = BigInt(parts[1]!);
    } else if (normalized.includes(".")) {
      const [whole, fraction] = normalized.split(".");
      b = 10n ** BigInt(fraction!.length);
      a = BigInt(
        (whole!.startsWith("-") ? "-" : "") +
          whole!.replace("-", "") +
          fraction,
      );
    } else {
      a = BigInt(normalized);
      b = 1n;
    }
    if (b === 0n) return normalized;
    let x = a < 0n ? -a : a,
      y = b < 0n ? -b : b;
    while (y) {
      const q = x % y;
      x = y;
      y = q;
    }
    const gcd = x || 1n;
    return String(a / gcd) + "/" + String(b / gcd);
  };
  return createHash("sha256")
    .update(
      JSON.stringify({
        formula: p.physics.formula,
        quantity: p.physics.quantity,
        givens: Object.fromEntries(
          Object.entries(p.physics.givens)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, numberKey(v)]),
        ),
      }),
    )
    .digest("hex");
}
export function physicsPracticeEligible(
  root: ContentPayload,
  candidate: ContentPayload,
  phase: "remediation" | "transfer",
  previous?: ContentPayload,
): boolean {
  if (
    !root.physics ||
    !candidate.physics ||
    candidate.subject !== "physics" ||
    candidate.kind !== phase ||
    root.unitCode !== candidate.unitCode ||
    root.lessonCode !== candidate.lessonCode ||
    root.skillCodes[0] !== candidate.skillCodes[0] ||
    root.familyCode === candidate.familyCode ||
    physicsExposureKey(root) === physicsExposureKey(candidate)
  )
    return false;
  if (
    Math.abs(candidate.difficulty - root.difficulty) > 1 ||
    (phase === "remediation" && candidate.difficulty > root.difficulty)
  )
    return false;
  if (
    previous &&
    (candidate.familyCode === previous.familyCode ||
      physicsExposureKey(previous) === physicsExposureKey(candidate) ||
      Math.abs(candidate.difficulty - previous.difficulty) > 1)
  )
    return false;
  return (
    candidate.hints.every((h) => h.reviewed) &&
    [1, 2, 3].every((level) => candidate.hints.some((h) => h.level === level))
  );
}
export async function recordPhysicsExposures(
  tx: Tx,
  ownerKey: string,
  revisions: readonly { id: string; payload: ContentPayload }[],
): Promise<void> {
  const physics = revisions.filter(
    (r) => r.payload.subject === "physics" && r.payload.physics,
  );
  if (!physics.length) return;
  await tx.$executeRaw(
    Prisma.sql`INSERT INTO physics_content_exposures(id,owner_key,origin_owner_key,problem_revision_id,family_code,context_key) VALUES ${Prisma.join(physics.map((r) => Prisma.sql`(${randomUUID()}::uuid,${ownerKey},${ownerKey},${r.id}::uuid,${r.payload.familyCode},${physicsExposureKey(r.payload)})`))} ON CONFLICT(owner_key,problem_revision_id) DO NOTHING`,
  );
}
export async function recordPhysicsExposure(
  tx: Tx,
  ownerKey: string,
  revision: Revision,
): Promise<void> {
  return recordPhysicsExposures(tx, ownerKey, [revision]);
}
export async function requirePhysicsAssignmentCurrent(
  tx: Tx,
  ownerKey: string,
  attemptId: string,
): Promise<"main" | "remediation" | "transfer"> {
  const [row] = await tx.$queryRaw<
    {
      phase: "remediation" | "transfer";
      invalidated_at: Date | null;
      state: string;
      root_revision: number;
      revision: number;
    }[]
  >`SELECT x.phase,x.invalidated_at,e.state,e.root_revision,r.revision FROM physics_learning_assignments x JOIN physics_learning_episodes e ON e.id=x.episode_id JOIN subject_attempts r ON r.id=e.root_attempt_id WHERE x.attempt_id=${attemptId}::uuid AND e.owner_key=${ownerKey}`;
  if (!row) return "main";
  if (
    row.invalidated_at ||
    row.state === "cancelled" ||
    row.root_revision !== row.revision
  )
    throw blocked();
  return row.phase;
}
export async function requirePhysicsHintAllowed(
  tx: Tx,
  ownerKey: string,
  attemptId: string,
): Promise<void> {
  const phase = await requirePhysicsAssignmentCurrent(tx, ownerKey, attemptId);
  const [measurement] = await tx.$queryRaw<
    { id: string }[]
  >`SELECT i.id FROM learning_assessment_items i JOIN learning_assessments x ON x.id=i.assessment_id WHERE i.subject_attempt_id=${attemptId}::uuid AND x.owner_key=${ownerKey} AND i.measurement_exited_at IS NULL LIMIT 1`;
  if (measurement)
    throw blocked(
      "هذه محاولة قياس مستقلة في المسار؛ لا تكشف تلميحاتها من مساحة أخرى. اختر تدريبًا مستقلًا عن سؤال القياس.",
    );
  if (phase === "transfer")
    throw blocked("هذه مسألة نقل مستقلة؛ لا تقدم التلميحات أثناء القياس.");
  if (phase === "remediation") {
    const [downstream] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT t.id FROM physics_learning_assignments t JOIN physics_learning_assignments r ON r.episode_id=t.episode_id WHERE r.attempt_id=${attemptId}::uuid AND t.phase='transfer' AND t.invalidated_at IS NULL`;
    if (downstream)
      throw blocked(
        "بدأ قياس النقل؛ أكمل السؤال المستقل قبل فتح مساعدة جديدة في التدريب.",
      );
  }
}
export async function preparePhysicsAssignmentUpdate(
  tx: Tx,
  ownerKey: string,
  attemptId: string,
): Promise<"main" | "remediation" | "transfer"> {
  const phase = await requirePhysicsAssignmentCurrent(tx, ownerKey, attemptId);
  if (phase === "main") return phase;
  const [row] = await tx.$queryRaw<
    {
      id: string;
      episode_id: string;
      completed_at: Date | null;
      has_transfer: boolean;
    }[]
  >`SELECT x.id,x.episode_id,x.completed_at,EXISTS(SELECT 1 FROM physics_learning_assignments t WHERE t.episode_id=x.episode_id AND t.phase='transfer') AS has_transfer FROM physics_learning_assignments x WHERE x.attempt_id=${attemptId}::uuid`;
  if (!row) throw blocked();
  if (
    (phase === "transfer" && row.completed_at) ||
    (phase === "remediation" && row.has_transfer)
  )
    throw blocked(
      "اكتمل هذا الجزء من الحلقة؛ عد للمسألة الرئيسية لبدء تدريب جديد دون تغيير دليل سابق.",
    );
  if (phase === "remediation") {
    await tx.$executeRaw`UPDATE physics_learning_assignments SET completed_at=NULL WHERE id=${row.id}::uuid`;
    await tx.$executeRaw`UPDATE physics_learning_episodes SET state='remediating' WHERE id=${row.episode_id}::uuid AND state<>'cancelled'`;
  }
  return phase;
}
export async function invalidatePhysicsRootEpisodes(
  tx: Tx,
  ownerKey: string,
  attemptId: string,
): Promise<void> {
  await tx.$executeRaw`UPDATE physics_learning_assignments SET invalidated_at=coalesce(invalidated_at,now()) WHERE episode_id IN (SELECT id FROM physics_learning_episodes WHERE owner_key=${ownerKey} AND root_attempt_id=${attemptId}::uuid AND state<>'cancelled')`;
  await tx.$executeRaw`UPDATE physics_learning_episodes SET state='cancelled',ended_at=now() WHERE owner_key=${ownerKey} AND root_attempt_id=${attemptId}::uuid AND state<>'cancelled'`;
}
export async function finishPhysicsAssignment(
  tx: Tx,
  ownerKey: string,
  attempt: Attempt,
  result: PhysicsAttempt,
): Promise<void> {
  const phase = await requirePhysicsAssignmentCurrent(tx, ownerKey, attempt.id);
  if (phase === "main") return;
  const completed =
    result.status === "correct" &&
    (phase !== "transfer" ||
      (attempt.independent && attempt.assistance_level === 0));
  await tx.$executeRaw`UPDATE physics_learning_assignments SET completed_at=${completed ? new Date() : null} WHERE attempt_id=${attempt.id}::uuid AND invalidated_at IS NULL`;
  if (completed)
    await tx.$executeRaw`UPDATE physics_learning_episodes SET state=${phase === "remediation" ? "awaiting_transfer" : "finished"},ended_at=${phase === "transfer" ? new Date() : null} WHERE id=(SELECT episode_id FROM physics_learning_assignments WHERE attempt_id=${attempt.id}::uuid) AND owner_key=${ownerKey} AND state<>'cancelled'`;
}
export class PhysicsLearningService {
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
  ) {}
  private async attempt(
    tx: Tx,
    ownerKey: string,
    id: string,
  ): Promise<Attempt> {
    const [r] = await tx.$queryRaw<
      Attempt[]
    >`SELECT * FROM subject_attempts WHERE id=${uuid(id)}::uuid AND owner_key=${ownerKey} AND subject_code='physics' FOR UPDATE`;
    if (!r) throw missing();
    return r;
  }
  private async revision(tx: Tx, id: string): Promise<Revision> {
    const [r] = await tx.$queryRaw<
      Revision[]
    >`SELECT r.id,r.item_id,r.payload,i.code FROM studio_revisions r JOIN studio_items i ON i.id=r.item_id WHERE r.id=${id}::uuid AND r.published_at IS NOT NULL AND r.status IN ('published','archived') AND i.subject_code='physics'`;
    if (!r?.payload.physics) throw missing();
    return r;
  }
  private async episode(
    tx: Tx,
    ownerKey: string,
    attemptId: string,
  ): Promise<Episode | null> {
    const [r] = await tx.$queryRaw<
      Episode[]
    >`SELECT e.* FROM physics_learning_episodes e WHERE e.owner_key=${ownerKey} AND (e.root_attempt_id=${attemptId}::uuid OR EXISTS(SELECT 1 FROM physics_learning_assignments x WHERE x.episode_id=e.id AND x.attempt_id=${attemptId}::uuid)) ORDER BY e.created_at DESC,e.id DESC LIMIT 1 FOR UPDATE`;
    return r ?? null;
  }
  private async dto(
    tx: Tx,
    ownerKey: string,
    episode: Episode | null,
    rootId: string,
    rootRevision: number,
  ): Promise<PhysicsLearningLoop> {
    if (!episode)
      return {
        episodeId: null,
        rootAttemptId: rootId,
        rootRevision,
        state: "not_started",
        reasonAr:
          "يمكن اختيار تدريب قصير على المهارة نفسها ثم سؤال مختلف لقياس الفهم.",
        assignments: [],
      };
    const root = await this.attempt(tx, ownerKey, episode.root_attempt_id);
    if (
      root.revision !== episode.root_revision &&
      episode.state !== "cancelled"
    ) {
      await invalidatePhysicsRootEpisodes(tx, ownerKey, root.id);
      episode = { ...episode, state: "cancelled" };
    }
    const rows = await tx.$queryRaw<
      {
        id: string;
        phase: "remediation" | "transfer";
        attempt_id: string;
        problem_revision_id: string;
        completed_at: Date | null;
        invalidated_at: Date | null;
        independent: boolean;
      }[]
    >`SELECT x.*,a.independent FROM physics_learning_assignments x JOIN subject_attempts a ON a.id=x.attempt_id WHERE x.episode_id=${episode.id}::uuid ORDER BY x.assigned_at,x.id`;
    return {
      episodeId: episode.id,
      rootAttemptId: episode.root_attempt_id,
      rootRevision: episode.root_revision,
      state: episode.state,
      reasonAr:
        episode.state === "cancelled"
          ? "تغيرت المحاولة الأصلية؛ لا تُنسب نتائج التدريب القديم إلى النسخة الجديدة."
          : episode.state === "finished"
            ? "انتهى التدريب وسؤال النقل بأدلة محدودة؛ لا يعني ذلك إتقانًا دائمًا."
            : episode.state === "awaiting_transfer"
              ? "اكتمل التدريب؛ السؤال التالي مختلف ويُحل دون تلميحات."
              : "لنراجع العلاقة والوحدة في تدريب قريب من المهارة الحالية.",
      assignments: await Promise.all(
        rows.map(async (x) => ({
          id: x.id,
          phase: x.phase,
          attemptId: x.attempt_id,
          problem: publicProblem(
            await this.revision(tx, x.problem_revision_id),
          ),
          status: x.invalidated_at
            ? ("invalidated" as const)
            : x.completed_at
              ? ("completed" as const)
              : ("assigned" as const),
          independent: x.phase === "transfer" && x.independent,
        })),
      ),
    };
  }
  async current(
    request: RequestContext,
    id: string,
  ): Promise<PhysicsLearningLoop> {
    const owner = await this.accounts.actor(request);
    return this.store.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      await this.accounts.authorizeInTransaction(tx, owner);
      await requireProductLearningAccess(tx, owner, this.store.syntheticData);
      const a = await this.attempt(tx, owner.ownerKey, id);
      return this.dto(
        tx,
        owner.ownerKey,
        await this.episode(tx, owner.ownerKey, a.id),
        a.id,
        a.revision,
      );
    });
  }
  async assign(
    request: RequestContext,
    id: string,
    phase: "remediation" | "transfer",
    raw: unknown,
  ): Promise<PhysicsLearningLoop> {
    const owner = await this.accounts.actor(request, true),
      body = record(raw);
    only(body, ["expectedRevision"]);
    const expected = revisionField(body.expectedRevision);
    return productMutation(
      this.store,
      owner,
      request,
      "physics.learning." + phase + ":" + uuid(id),
      body,
      async (tx) => {
        await requireProductLearningAccess(tx, owner, this.store.syntheticData);
        const a = await this.attempt(tx, owner.ownerKey, id);
        if (a.revision !== expected)
          throw new ApiFault(
            409,
            "revision_conflict",
            "تغيرت المحاولة؛ حدّث النتيجة قبل طلب التدريب.",
            [],
            a.revision,
          );
        let current = await this.episode(tx, owner.ownerKey, a.id);
        if (
          current?.state === "cancelled" &&
          current.root_attempt_id === a.id &&
          phase === "remediation"
        )
          current = null;
        let e = current;
        const root = current
          ? await this.attempt(tx, owner.ownerKey, current.root_attempt_id)
          : a;
        const original = await this.revision(tx, root.problem_revision_id);
        if (
          original.payload.kind !== "main" ||
          (!current && phase === "transfer")
        )
          throw blocked("ابدأ بالتدريب العلاجي من المسألة الرئيسية أولًا.");
        if (
          !["correct", "wrong_value", "wrong_unit"].includes(
            root.verdict.status,
          )
        )
          throw blocked(
            "أعد التحقق من القيمة والوحدة أولًا؛ تعذر الخدمة أو الصيغة لا يبدأ علاجًا مفاهيميًا.",
          );
        if (
          current &&
          (current.root_revision !== root.revision ||
            current.state === "cancelled")
        )
          throw blocked();
        if (!e) {
          e = {
            id: randomUUID(),
            root_attempt_id: root.id,
            root_revision: root.revision,
            state: "remediating",
            created_at: new Date(),
          };
          await tx.$executeRaw`INSERT INTO physics_learning_episodes(id,owner_key,origin_owner_key,root_attempt_id,root_revision,state) VALUES(${e.id}::uuid,${owner.ownerKey},${owner.ownerKey},${root.id}::uuid,${root.revision},'remediating')`;
        }
        const [old] = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM physics_learning_assignments WHERE episode_id=${e.id}::uuid AND phase=${phase}`;
        if (old) return this.dto(tx, owner.ownerKey, e, root.id, root.revision);
        const [previous] = await tx.$queryRaw<
          { problem_revision_id: string; completed_at: Date | null }[]
        >`SELECT problem_revision_id,completed_at FROM physics_learning_assignments WHERE episode_id=${e.id}::uuid AND phase='remediation' AND invalidated_at IS NULL`;
        if (
          phase === "transfer" &&
          (!previous?.completed_at || e.state !== "awaiting_transfer")
        )
          throw blocked(
            "أكمل التدريب بقيمة ووحدة صحيحتين قبل سؤال النقل المستقل.",
          );
        const previousPayload = previous
          ? (await this.revision(tx, previous.problem_revision_id)).payload
          : undefined;
        const sources = await tx.$queryRaw<
          Revision[]
        >`SELECT r.id,r.item_id,r.payload,i.code FROM studio_revisions r JOIN studio_items i ON i.id=r.item_id WHERE r.status='published' AND i.subject_code='physics' AND r.payload->>'kind'=${phase} AND r.validation->>'valid'='true' AND r.validation->>'engine'='physics-internal-v1' AND r.reviewed_by IS NOT NULL AND r.reviewed_at IS NOT NULL AND r.published_at IS NOT NULL ORDER BY r.payload->>'difficulty',r.id LIMIT 500 FOR SHARE OF r,i`;
        const exposed = await tx.$queryRaw<
          { family_code: string; context_key: string }[]
        >`SELECT family_code,context_key FROM physics_content_exposures WHERE owner_key=${owner.ownerKey}`;
        // Include pre-migration attempts and archived aliases, not just the new
        // disclosure ledger. Bound the read and fail closed rather than call a
        // remembered question a fresh independent transfer.
        const historical = await tx.$queryRaw<
          { family_code: string; physics: ContentPayload["physics"] }[]
        >`SELECT DISTINCT r.payload->>'familyCode' AS family_code,r.payload->'physics' AS physics FROM subject_attempts a JOIN studio_revisions r ON r.id=a.problem_revision_id WHERE a.owner_key=${owner.ownerKey} AND a.subject_code='physics' LIMIT 5001`;
        if (historical.length > 5000)
          throw blocked(
            "يلزم مراجعة سجل التعرض الكبير قبل إسناد سؤال جديد مستقل.",
          );
        for (const item of historical)
          if (item.physics)
            exposed.push({
              family_code: item.family_code,
              context_key: physicsExposureKey({ physics: item.physics }),
            });
        const selected = sources.find(
          (s) =>
            physicsPracticeEligible(
              original.payload,
              s.payload,
              phase,
              previousPayload,
            ) &&
            !exposed.some(
              (x) =>
                x.family_code === s.payload.familyCode ||
                x.context_key === physicsExposureKey(s.payload),
            ),
        );
        if (!selected)
          throw blocked(
            "لا يتوفر تدريب مراجع جديد لهذا الدرس؛ انشر علاجًا ونقلًا مختلفي المعطيات والعائلة والمهارة نفسيهما من الاستوديو.",
          );
        const attemptId = randomUUID(),
          assignmentId = randomUUID();
        const pending: PhysicsAttempt = {
          id: attemptId,
          problemRevisionId: selected.id,
          revision: 0,
          status: "service_error",
          valueCorrect: null,
          unitCorrect: null,
          messageAr: "اكتب القيمة والوحدة لبدء التحقق.",
          diagnosis: {
            state: "unresolved",
            code: null,
            messageAr: "لم تُقيّم الإجابة بعد.",
          },
          independentEvidence: false,
          assistanceLevel: 0,
        };
        await tx.$executeRaw`INSERT INTO subject_attempts(id,owner_key,subject_code,problem_revision_id,source_raw,answer_json,verdict,independent) VALUES(${attemptId}::uuid,${owner.ownerKey},'physics',${selected.id}::uuid,'',${JSON.stringify({ value: "", unit: "" })}::jsonb,${JSON.stringify(pending)}::jsonb,${phase === "transfer"})`;
        await tx.$executeRaw`INSERT INTO physics_learning_assignments(id,episode_id,phase,problem_revision_id,attempt_id) VALUES(${assignmentId}::uuid,${e.id}::uuid,${phase},${selected.id}::uuid,${attemptId}::uuid)`;
        await recordPhysicsExposure(tx, owner.ownerKey, selected);
        await tx.$executeRaw`UPDATE physics_learning_episodes SET state=${phase === "transfer" ? "awaiting_transfer" : "remediating"} WHERE id=${e.id}::uuid`;
        e = {
          ...e,
          state: phase === "transfer" ? "awaiting_transfer" : "remediating",
        };
        return this.dto(tx, owner.ownerKey, e, root.id, root.revision);
      },
    );
  }
}
