import { createHash, randomUUID } from "node:crypto";
import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  AssessmentKind,
  AssessmentQuestion,
  AssessmentSession,
  AssessmentSummary,
  LearningPathProgress,
  LearningRecommendation,
  LearningSkillEvidence,
} from "../../../packages/contracts/src/learning-assessments";
import type {
  LearningBankProblem,
  LearningContentRevision,
  LearningSkillMap,
  LessonPayload,
} from "../../../packages/contracts/src/learning-paths";
import { AccountService, type ProductActor } from "./accounts";
import { Store, type GuestAuth } from "./store";
import { ApiFault, type RequestContext } from "./http";
import { uuid, output } from "./contracts";
import {
  only,
  productEnvelope,
  productInvalid,
  productMutation,
  record,
  revisionField,
  textField,
} from "./product-core";
import {
  learningSessionIsSynthetic,
  requireProductLearningAccess,
} from "./learning-access";
import {
  LearningPathContentService,
  learningContentDto,
} from "./learning-path-content";
import { VerificationService } from "./verification";
import { TutoringService } from "./tutoring";
import { PhysicsService } from "./physics";
import { recordExposure } from "./learning";
import { physicsExposureKey, recordPhysicsExposure } from "./physics-learning";
import type { ContentPayload } from "../../../packages/contracts/src/product";
import { labMathSources } from "./stem/lab-registry";
import { readLabExposures } from "./stem/lab-exposure";

export const ASSESSMENT_RULE = "learning-path-evidence-1.0";
export interface LearningObservation {
  skillCode: string;
  problemId: string;
  difficulty: number;
  evidenceId: string;
  contentKey?: string;
  outcome: "correct" | "error" | "assisted" | "unassessable";
  time: string;
  kind?: AssessmentKind | "transfer";
  attemptId?: string;
  attemptRevision?: number;
  verifiedCorrect?: boolean;
  assessmentId?: string;
  transferEligible?: boolean;
}
type Tx = Prisma.TransactionClient;
type AssessmentRow = {
  id: string;
  owner_key: string;
  guest_session_id: string;
  subject_code: AssessmentSession["subject"];
  track_revision_id: string;
  lesson_revision_id: string | null;
  kind: AssessmentKind;
  revision: number;
  rule_version: string;
  mapping_snapshot: {
    map: LearningSkillMap;
    lessons: LearningContentRevision[];
  };
  coverage: AssessmentSession["coverage"];
  created_at: Date;
};
type ItemRow = {
  id: string;
  assessment_id: string;
  position: number;
  problem_revision_id: string;
  problem_snapshot: LearningBankProblem;
  attempt_id: string | null;
  subject_attempt_id: string | null;
  measurement_exited_at: Date | null;
};
const missing = () => new ApiFault(404, "not_found", "المورد غير متاح.");
const conflict = (revision: number) =>
  new ApiFault(
    409,
    "revision_conflict",
    "تغيرت الجلسة؛ حدّثها ثم أعد الإرسال.",
    [],
    revision,
  );
const keyRequest = (
  request: RequestContext,
  suffix: string,
): RequestContext => ({
  ...request,
  headers: {
    ...request.headers,
    "idempotency-key": createHash("sha256")
      .update(String(request.headers["idempotency-key"]) + suffix)
      .digest("hex"),
  },
});
export const normalizedLearningEquation = (s: string) =>
  s
    .replace(/[٠-٩]/gu, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[−–]/gu, "-")
    .replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "");
/** Later study cannot rewrite a completed independent observation. Pending
 * work uses now so help obtained while a verifier is running is still seen. */
export function temporalLearningExposure(
  exposedAt: Date | string | undefined,
  verifiedAt: Date | string | null = null,
): boolean {
  return (
    exposedAt !== undefined &&
    new Date(exposedAt).getTime() <=
      (verifiedAt ? new Date(verifiedAt).getTime() : Date.now())
  );
}
function exposureTimes(entries: [string, Date][]): Map<string, Date> {
  const times = new Map<string, Date>();
  for (const [key, at] of entries) {
    if (!times.has(key) || at < times.get(key)!) times.set(key, at);
  }
  return times;
}

/** Distinct comparable problems, not step count, are the unit of independent evidence. */
export function summarizeSkillEvidence(
  observations: {
    skillCode: string;
    problemId: string;
    difficulty: number;
    evidenceId: string;
    contentKey?: string;
    outcome: "correct" | "error" | "assisted" | "unassessable";
    time: string;
  }[],
  skills: { skillCode: string; titleAr: string }[],
): LearningSkillEvidence[] {
  return skills.map((skill) => {
    const latest = new Map<string, (typeof observations)[number]>();
    for (const item of observations
      .filter((o) => o.skillCode === skill.skillCode)
      .sort((a, b) => a.time.localeCompare(b.time)))
      latest.set(item.problemId, item);
    const semanticSeen = new Set<string>();
    const items = [...latest.values()]
      .sort((a, b) => b.time.localeCompare(a.time))
      .filter((item) => {
        if (!item.contentKey) return true;
        if (semanticSeen.has(item.contentKey)) return false;
        semanticSeen.add(item.contentKey);
        return true;
      });
    const successes = items.filter((i) => i.outcome === "correct");
    const independentCorrect = successes.length,
      independentErrors = items.filter((i) => i.outcome === "error").length,
      assisted = items.filter((i) => i.outcome === "assisted").length;
    // Two later successes at a comparable level can supersede an earlier error.
    const recentSuccesses = items.slice(0, 2);
    const independent =
      recentSuccesses.length === 2 &&
      recentSuccesses.every((i) => i.outcome === "correct") &&
      recentSuccesses[0]!.difficulty === recentSuccesses[1]!.difficulty;
    return {
      skillCode: skill.skillCode,
      titleAr: skill.titleAr,
      independentCorrect,
      independentErrors,
      assisted,
      evidenceIds: items.map((i) => i.evidenceId),
      source:
        "verification_reports + current_skill_evidence + subject_attempts",
      state: independent
        ? "independent_evidence"
        : independentErrors > 0
          ? "needs_review"
          : assisted > 0
            ? "practicing_with_support"
            : items.length > 0
              ? "insufficient_evidence"
              : "not_assessed",
    };
  });
}
export function recommendLesson(
  skills: LearningSkillEvidence[],
  map: LearningSkillMap,
  lessons: LearningContentRevision[],
): LearningRecommendation | null {
  const available = lessons.filter(
    (l) =>
      l.status === "published" &&
      l.payload.kind === "lesson" &&
      !l.payload.mappingPending.length,
  );
  const valid = (s: LearningSkillMap["skills"][number]) =>
    available.find((l) => l.id === s.lessonRevisionId);
  const ordered = [...skills].sort(
    (a, b) =>
      Number(b.state === "needs_review") - Number(a.state === "needs_review") ||
      b.independentErrors - a.independentErrors,
  );
  let chosen = ordered.find(
    (s) =>
      s.state === "needs_review" &&
      map.skills.some((m) => m.skillCode === s.skillCode && valid(m)),
  );
  let reason: LearningRecommendation["reasonCode"] = chosen
    ? chosen.independentErrors >= 2
      ? "repeated_independent_error"
      : "tentative_review"
    : "introduction";
  if (chosen) {
    const mapping = map.skills.find((s) => s.skillCode === chosen!.skillCode)!;
    const prerequisite = mapping.prerequisiteSkillCodes
      .map((code) => skills.find((s) => s.skillCode === code))
      .find(
        (s) =>
          s?.state === "needs_review" &&
          map.skills.some((m) => m.skillCode === s.skillCode && valid(m)),
      );
    if (prerequisite) {
      chosen = prerequisite;
      reason = "prerequisite_review";
    }
  }
  if (!chosen)
    chosen = ordered.find(
      (s) =>
        s.state !== "independent_evidence" &&
        map.skills.some((m) => m.skillCode === s.skillCode && valid(m)),
    );
  if (!chosen) return null;
  const mapping = map.skills.find(
    (s) => s.skillCode === chosen!.skillCode && valid(s),
  )!;
  const lesson = valid(mapping)!;
  return {
    recommendedLessonId: lesson.id,
    targetSkillCode: chosen.skillCode,
    reasonCode: reason,
    reasonAr:
      reason === "introduction"
        ? "يمكنك البدء بهذا الدرس؛ الأدلة الحالية لا تكفي لتحديد حاجة علاجية."
        : reason === "prerequisite_review"
          ? "قد تفيدك مراجعة هذه المقدمة قبل متابعة الدرس، بناءً على محاولاتك المسجلة."
          : `قد تفيدك مراجعة ${lesson.payload.titleAr} بناءً على ${chosen.independentErrors} من المحاولات المستقلة. هذه توصية محتملة وليست حكمًا دائمًا على فهمك.`,
    confidence: "tentative",
    evidenceCount: chosen.evidenceIds.length,
    evidenceIds: chosen.evidenceIds,
    ruleVersion: ASSESSMENT_RULE + ":" + map.ruleVersion,
    mappingPending: map.mappingPending,
    nextAction: "study_lesson",
    alternatives: available
      .filter((l) => l.id !== lesson.id)
      .map((l) => ({ lessonRevisionId: l.id, titleAr: l.payload.titleAr })),
  };
}

export class LearningAssessmentService {
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly content: LearningPathContentService,
    readonly verification: VerificationService,
    readonly tutoring: TutoringService,
    readonly physics: PhysicsService,
  ) {}
  private async identity(request: RequestContext, write = false) {
    const owner = await this.accounts.actor(request, write),
      auth = await this.store.authenticate(request);
    if (!auth) throw missing();
    await this.store.db.$transaction((tx) =>
      requireProductLearningAccess(tx, owner, this.store.syntheticData),
    );
    return { owner, auth };
  }
  private async row(
    tx: Tx,
    owner: ProductActor,
    id: string,
    lock = false,
  ): Promise<AssessmentRow> {
    await this.accounts.authorizeInTransaction(tx, owner);
    await requireProductLearningAccess(tx, owner, this.store.syntheticData);
    const [row] = await tx.$queryRaw<AssessmentRow[]>(
      Prisma.sql`SELECT * FROM learning_assessments WHERE id=${uuid(id)}::uuid AND owner_key=${owner.ownerKey} ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`,
    );
    if (!row) throw missing();
    return row;
  }
  private items(tx: Tx, id: string) {
    return tx.$queryRaw<
      ItemRow[]
    >`SELECT * FROM learning_assessment_items WHERE assessment_id=${id}::uuid ORDER BY position`;
  }
  private async algebraContamination(
    tx: Tx,
    ownerKey: string,
    guestId: string,
  ) {
    const assisted = await tx.$queryRaw<
      {
        problem_id: string;
        learning_family: string | null;
        original_equation_raw: string | null;
        exposed_at: Date;
      }[]
    >`SELECT p.problem_id,p.learning_family,p.original_equation_raw,COALESCE(LEAST((SELECT min(t.created_at) FROM tutoring_events t WHERE t.attempt_id=a.id),(SELECT min(i.measurement_exited_at) FROM learning_assessment_items i WHERE i.attempt_id=a.id),(SELECT min(x.measurement_exited_at) FROM learning_assignments x WHERE x.attempt_id=a.id)),a.opened_at) AS exposed_at FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id JOIN problem_revisions p ON p.id=a.problem_revision_id WHERE l.guest_session_id=${guestId}::uuid AND (NOT a.independent_evidence_eligible OR a.highest_hint_level_seen>0 OR a.full_solution_seen)`;
    const viewed = await tx.$queryRaw<
      { payload: LessonPayload; exposed_at: Date }[]
    >`SELECT r.payload,min(e.created_at) AS exposed_at FROM learning_content_revisions r JOIN learning_lesson_events e ON e.lesson_revision_id=r.id WHERE e.owner_key=${ownerKey} AND r.payload->>'kind'='lesson' AND r.payload->>'subject'='algebra' GROUP BY r.id,r.payload`;
    const disclosed = await tx.$queryRaw<
      {
        problem_id: string;
        learning_family: string | null;
        original_equation_raw: string;
        exposed_at: Date;
      }[]
    >`SELECT p.problem_id,p.learning_family,p.original_equation_raw,min(e.created_at) AS exposed_at FROM learning_lesson_events e JOIN learning_content_revisions r ON r.id=e.lesson_revision_id JOIN problem_revisions p ON ((e.event_kind='lesson_viewed' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.payload->'practiceProblemRevisionIds') AS refs(value) WHERE refs.value=p.id::text)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'contentBlocks') AS blocks(value) WHERE blocks.value->>'type'='worked_example_ref' AND blocks.value->>'problemRevisionId'=p.id::text)) WHERE e.owner_key=${ownerKey} AND r.payload->>'subject'='algebra' GROUP BY p.problem_id,p.learning_family,p.original_equation_raw`;
    const equations = exposureTimes(
      viewed.flatMap((v) =>
        v.payload.contentBlocks
          .flatMap((b) => [
            b.raw ?? "",
            ...(b.steps ?? []).map((s) => s.raw),
            ...labMathSources(b.lab),
          ])
          .filter(Boolean)
          .map((raw): [string, Date] => [
            normalizedLearningEquation(raw),
            v.exposed_at,
          ]),
      ),
    );
    for (const a of [...assisted, ...disclosed])
      if (a.original_equation_raw) {
        const key = normalizedLearningEquation(a.original_equation_raw);
        if (!equations.has(key) || a.exposed_at < equations.get(key)!)
          equations.set(key, a.exposed_at);
      }
    return {
      equations,
      problems: exposureTimes(
        [...assisted, ...disclosed].map((a) => [a.problem_id, a.exposed_at]),
      ),
      families: exposureTimes(
        [
          ...viewed.flatMap((v) =>
            v.payload.contentBlocks.flatMap((b) =>
              b.lab
                ? [
                    {
                      learning_family: b.lab.familyCode,
                      exposed_at: v.exposed_at,
                    },
                  ]
                : [],
            ),
          ),
          ...assisted,
          ...disclosed,
        ]
          .filter((a) => a.learning_family)
          .map((a) => [a.learning_family!, a.exposed_at]),
      ),
    };
  }
  private async physicsContamination(tx: Tx, ownerKey: string) {
    const labs = (await readLabExposures(tx, ownerKey, "physics")).filter(
      (l) => l.subject === "physics",
    );
    const rows = await tx.$queryRaw<
      {
        id: string;
        problem_revision_id: string;
        payload: ContentPayload;
        assisted: boolean;
        exposed_at: Date;
      }[]
    >`SELECT a.id,a.problem_revision_id,r.payload,(NOT a.independent OR a.assistance_level>0) AS assisted,COALESCE(LEAST((SELECT min(e.created_at) FROM subject_attempt_events e WHERE e.attempt_id=a.id AND e.event_kind='hint'),(SELECT min(i.measurement_exited_at) FROM learning_assessment_items i WHERE i.subject_attempt_id=a.id)),a.created_at) AS exposed_at FROM subject_attempts a JOIN studio_revisions r ON r.id=a.problem_revision_id WHERE a.owner_key=${ownerKey} AND a.subject_code='physics'`;
    const viewed = await tx.$queryRaw<
      { payload: LessonPayload; exposed_at: Date }[]
    >`SELECT r.payload,min(e.created_at) AS exposed_at FROM learning_content_revisions r JOIN learning_lesson_events e ON e.lesson_revision_id=r.id WHERE e.owner_key=${ownerKey} AND r.payload->>'subject'='physics' AND r.payload->>'kind'='lesson' GROUP BY r.id,r.payload`;
    const disclosed = await tx.$queryRaw<
      { payload: ContentPayload; exposed_at: Date }[]
    >`SELECT p.payload,min(e.created_at) AS exposed_at FROM learning_lesson_events e JOIN learning_content_revisions r ON r.id=e.lesson_revision_id JOIN studio_revisions p ON ((e.event_kind='lesson_viewed' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.payload->'practiceProblemRevisionIds') AS refs(value) WHERE refs.value=p.id::text)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'contentBlocks') AS blocks(value) WHERE blocks.value->>'type'='worked_example_ref' AND blocks.value->>'problemRevisionId'=p.id::text)) WHERE e.owner_key=${ownerKey} AND r.payload->>'subject'='physics' AND p.payload->>'subject'='physics' GROUP BY p.payload`;
    const contexts = exposureTimes([
      ...labs.flatMap((l) =>
        l.contexts.map((c): [string, Date] => [c.key, new Date(c.at)]),
      ),
      ...viewed.flatMap((v) =>
        v.payload.contentBlocks
          .filter((b) => b.physics)
          .map((b): [string, Date] => [
            physicsExposureKey({ physics: b.physics }),
            v.exposed_at,
          ]),
      ),
      ...disclosed.map((d): [string, Date] => [
        physicsExposureKey(d.payload),
        d.exposed_at,
      ]),
    ]);
    for (const r of rows)
      if (r.assisted) {
        const key = physicsExposureKey(r.payload);
        if (!contexts.has(key) || r.exposed_at < contexts.get(key)!)
          contexts.set(key, r.exposed_at);
      }
    return {
      contexts,
      byRevision: new Map(
        rows.map((r) => [r.problem_revision_id, physicsExposureKey(r.payload)]),
      ),
      families: exposureTimes([
        ...labs.map((l): [string, Date] => [l.family, l.created_at]),
        ...viewed.flatMap((v) =>
          v.payload.contentBlocks.flatMap((b): [string, Date][] =>
            b.lab ? [[b.lab.familyCode, v.exposed_at]] : [],
          ),
        ),
        ...rows
          .filter((r) => r.assisted)
          .map((r): [string, Date] => [r.payload.familyCode, r.exposed_at]),
        ...disclosed.map((r): [string, Date] => [
          r.payload.familyCode,
          r.exposed_at,
        ]),
      ]),
    };
  }
  async start(
    request: RequestContext,
    raw: unknown,
  ): Promise<AssessmentSession> {
    const { owner, auth } = await this.identity(request, true),
      b = record(raw);
    only(b, ["trackRevisionId", "lessonRevisionId", "kind"]);
    const trackId = uuid(textField(b.trackRevisionId, 36));
    if (
      ![
        "diagnostic_pretest",
        "lesson_check",
        "post_remediation",
        "practice",
        "retrieval_review",
        "independent_check",
      ].includes(String(b.kind))
    )
      throw productInvalid();
    const kind = b.kind as AssessmentKind,
      lessonId =
        b.lessonRevisionId === undefined
          ? null
          : uuid(textField(b.lessonRevisionId, 36));
    if (
      ["retrieval_review", "independent_check"].includes(kind) &&
      (!this.store.syntheticData ||
        (kind === "retrieval_review"
          ? process.env.SPACED_REVIEW_ENABLED !== "true"
          : process.env.PEDAGOGY_ENGINE_ENABLED !== "true" &&
            process.env.FADING_SCAFFOLD_ENABLED !== "true"))
    )
      throw new ApiFault(
        403,
        "forbidden",
        "هذا النوع من النشاط متاح للتجربة الاصطناعية المفعّلة فقط.",
      );
    const track = await this.content.track(request, trackId);
    if (track.payload.subject === "programming")
      throw new ApiFault(
        409,
        "invalid_state",
        "تقييم البرمجة محجوب حتى تهيئة Runner المعزول وقبول تشغيله؛ يمكنك قراءة الدروس المنشورة.",
      );
    if (kind !== "diagnostic_pretest" && !lessonId)
      throw productInvalid("اختر درسًا لهذا النشاط.");
    const lessons = track.lessons.filter(
      (l) => l.status === "published" && l.payload.kind === "lesson",
    );
    const target = lessonId ? lessons.find((l) => l.id === lessonId) : null;
    const selectedLessons = target ? [target] : lessons;
    return productMutation(
      this.store,
      owner,
      request,
      "assessment.start",
      b,
      async (tx) => {
        if (track.status !== "published")
          throw new ApiFault(
            409,
            "content_version_conflict",
            "هذه نسخة تاريخية؛ اختر المسار المنشور لبدء نشاط جديد.",
          );
        if (lessonId && !target) throw missing();
        await requireProductLearningAccess(tx, owner, this.store.syntheticData);
        const bank = await this.content.bank(
          track.payload.subject,
          undefined,
          tx,
        );
        const skillCodes = new Set(
          selectedLessons.flatMap(
            (l) => (l.payload as LessonPayload).skillCodes,
          ),
        );
        const practiceIds = new Set(
          selectedLessons.flatMap(
            (l) => (l.payload as LessonPayload).practiceProblemRevisionIds,
          ),
        );
        const assessmentIds = new Set(
          selectedLessons.flatMap(
            (l) => (l.payload as LessonPayload).assessmentProblemRevisionIds,
          ),
        );
        let pool = bank.filter((p) => skillCodes.has(p.primarySkillCode));
        // Physics remediation/transfer question kinds require their native owned
        // assignments. Standalone path checks use reviewed main questions only.
        if (track.payload.subject === "physics")
          pool = pool.filter((p) => p.kind === "main");
        if (kind === "practice")
          pool = pool.filter((p) => practiceIds.has(p.revisionId));
        else if (kind !== "diagnostic_pretest")
          pool = pool.filter((p) => assessmentIds.has(p.revisionId));
        else
          pool = pool.filter(
            (p) => p.kind === "main" && !practiceIds.has(p.revisionId),
          );
        const physicsRefs =
          track.payload.subject === "physics"
            ? await tx.$queryRaw<
                {
                  id: string;
                  item_id: string;
                  code: string;
                  payload: ContentPayload;
                }[]
              >`SELECT r.id,r.item_id,i.code,r.payload FROM studio_revisions r JOIN studio_items i ON i.id=r.item_id WHERE i.subject_code='physics' AND r.status='published'`
            : [];
        if (kind !== "practice") {
          const labExposures = await readLabExposures(
            tx,
            owner.ownerKey,
            track.payload.subject,
          );
          const viewed = await tx.$queryRaw<
            { payload: LessonPayload }[]
          >`SELECT DISTINCT r.payload FROM learning_content_revisions r JOIN learning_lesson_events e ON e.lesson_revision_id=r.id WHERE e.owner_key=${owner.ownerKey} AND r.payload->>'kind'='lesson' AND r.payload->>'subject'=${track.payload.subject}`;
          const blocks = [
            ...lessons.map((l) => l.payload as LessonPayload),
            ...viewed.map((v) => v.payload),
          ].flatMap((l) => l.contentBlocks);
          const solved = new Set(
            blocks
              .flatMap((block) => [
                block.raw ?? "",
                ...(block.steps ?? []).map((s) => s.raw),
                ...labMathSources(block.lab),
              ])
              .filter(Boolean)
              .map(normalizedLearningEquation),
          );
          const exposures = await tx.$queryRaw<
            {
              id: string;
              problem_id: string;
              learning_family: string | null;
              original_equation_raw: string | null;
            }[]
          >`SELECT p.id,p.problem_id,p.learning_family,p.original_equation_raw FROM content_exposures e JOIN problem_revisions p ON p.id=e.problem_revision_id WHERE e.guest_session_id=${auth.row.id}::uuid`;
          pool = pool.filter(
            (p) =>
              !blocks.some((b) => b.lab?.familyCode === p.familyCode) &&
              !labExposures.some((l) => l.family === p.familyCode) &&
              !practiceIds.has(p.revisionId) &&
              (!p.equationRaw ||
                !solved.has(normalizedLearningEquation(p.equationRaw))) &&
              !exposures.some(
                (e) =>
                  e.id === p.revisionId ||
                  e.problem_id === p.problemId ||
                  (e.learning_family && e.learning_family === p.familyCode) ||
                  (e.original_equation_raw &&
                    p.equationRaw &&
                    normalizedLearningEquation(e.original_equation_raw) ===
                      normalizedLearningEquation(p.equationRaw)),
              ),
          );
          if (track.payload.subject === "physics") {
            const seen = await tx.$queryRaw<
              { family_code: string; context_key: string }[]
            >`SELECT family_code,context_key FROM physics_content_exposures WHERE owner_key=${owner.ownerKey}`;
            const exampleKeys = new Set(
              blocks
                .filter((b) => b.physics)
                .map((b) => physicsExposureKey({ physics: b.physics })),
            );
            pool = pool.filter((p) => {
              const reference = physicsRefs.find((r) => r.id === p.revisionId);
              if (!reference?.payload.physics) return false;
              const context = physicsExposureKey(reference.payload);
              return (
                !exampleKeys.has(context) &&
                !labExposures.some((l) =>
                  l.contexts.some((c) => c.key === context),
                ) &&
                !seen.some(
                  (e) =>
                    e.family_code === p.familyCode || e.context_key === context,
                )
              );
            });
          }
        }
        if (
          [
            "post_remediation",
            "lesson_check",
            "retrieval_review",
            "independent_check",
          ].includes(kind)
        ) {
          const priorPathItems = await tx.$queryRaw<
            { problem_snapshot: LearningBankProblem }[]
          >`SELECT i.problem_snapshot FROM learning_assessment_items i JOIN learning_assessments x ON x.id=i.assessment_id WHERE x.owner_key=${owner.ownerKey} AND x.subject_code=${track.payload.subject}`;
          pool = pool.filter(
            (p) =>
              !priorPathItems.some(
                ({ problem_snapshot: old }) =>
                  old.revisionId === p.revisionId ||
                  old.problemId === p.problemId ||
                  old.familyCode === p.familyCode,
              ),
          );
          const previous = await tx.$queryRaw<
            {
              problem_revision_id: string;
              equation: string | null;
              family: string | null;
            }[]
          >`SELECT p.id AS problem_revision_id,p.original_equation_raw AS equation,p.learning_family AS family FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id JOIN problem_revisions p ON p.id=a.problem_revision_id WHERE l.guest_session_id=${auth.row.id}::uuid`;
          const examples = selectedLessons.flatMap((l) =>
            (l.payload as LessonPayload).contentBlocks.flatMap((block) => [
              block.raw ?? "",
              ...(block.steps ?? []).map((s) => s.raw),
              ...labMathSources(block.lab),
            ]),
          );
          const normalized = (s: string) =>
            s
              .replace(/[٠-٩]/gu, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
              .replace(/[−–]/gu, "-")
              .replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "");
          pool = pool.filter(
            (p) =>
              !practiceIds.has(p.revisionId) &&
              !previous.some(
                (old) =>
                  old.problem_revision_id === p.revisionId ||
                  (old.family && old.family === p.familyCode) ||
                  (old.equation &&
                    p.equationRaw &&
                    normalized(old.equation) === normalized(p.equationRaw)),
              ) &&
              !examples.some(
                (s) =>
                  s &&
                  p.equationRaw &&
                  normalized(s) === normalized(p.equationRaw),
              ),
          );
          if (track.payload.subject === "physics") {
            const seen = await tx.$queryRaw<
              { problem_revision_id: string }[]
            >`SELECT problem_revision_id FROM subject_attempts WHERE owner_key=${owner.ownerKey} AND subject_code='physics'`;
            pool = pool.filter(
              (p) => !seen.some((s) => s.problem_revision_id === p.revisionId),
            );
          }
        }
        const seenProblems = new Set<string>(),
          seenContent = new Set<string>();
        pool = pool.filter((p) => {
          const reference = physicsRefs.find((r) => r.id === p.revisionId);
          const contentKey = p.equationRaw
            ? normalizedLearningEquation(p.equationRaw)
            : reference
              ? physicsExposureKey(reference.payload)
              : p.revisionId;
          if (seenProblems.has(p.problemId) || seenContent.has(contentKey))
            return false;
          seenProblems.add(p.problemId);
          seenContent.add(contentKey);
          return true;
        });
        // Round robin primary skills; secondary coverage never grants extra evidence.
        const chosen: LearningBankProblem[] = [],
          groups = [...skillCodes].map((code) =>
            pool
              .filter((p) => p.primarySkillCode === code)
              .sort((a, b) => a.revisionId.localeCompare(b.revisionId)),
          );
        const requested =
          kind === "diagnostic_pretest" ? 10 : kind === "practice" ? 3 : 2;
        while (chosen.length < requested && groups.some((g) => g.length))
          for (const group of groups) {
            const next = group.shift();
            if (next && chosen.length < requested) chosen.push(next);
          }
        if (!chosen.length)
          throw new ApiFault(
            409,
            "invalid_state",
            "لا توجد أسئلة كافية جديدة ومراجعة لهذا التقييم بعد. ارجع للدرس أو اختر التدريب.",
          );
        const coverage = {
          requested,
          available: chosen.length,
          partial: chosen.length < requested,
          messageAr:
            chosen.length < requested
              ? "هذا تقييم جزئي لأن البنك المنشور لا يغطي العدد المطلوب؛ لا نستنتج إتقانًا شاملًا."
              : "أدلة محدودة ضمن المهارات والأسئلة المنشورة، وليست تقدير إتقان دائم.",
        };
        const id = randomUUID(),
          map = await this.content.skillMap(tx, true);
        await tx.$executeRaw`INSERT INTO learning_assessments(id,owner_key,guest_session_id,subject_code,track_revision_id,lesson_revision_id,kind,rule_version,mapping_snapshot,coverage) VALUES(${id}::uuid,${owner.ownerKey},${auth.row.id}::uuid,${track.payload.subject},${trackId}::uuid,${lessonId}::uuid,${kind},${ASSESSMENT_RULE},${JSON.stringify({ map, lessons })}::jsonb,${JSON.stringify(coverage)}::jsonb)`;
        for (const [i, p] of chosen.entries()) {
          let attemptId: string | null = null;
          if (p.subject === "algebra") {
            const [problem] = await tx.$queryRaw<
              { release_id: string; notation_profile: string }[]
            >`SELECT release_id,notation_profile FROM problem_revisions WHERE id=${p.revisionId}::uuid AND review_status='published'`;
            if (!problem) throw missing();
            const learningId = randomUUID();
            attemptId = randomUUID();
            await tx.$executeRaw`INSERT INTO learning_sessions(id,guest_session_id,release_id,status,session_policy_version,is_synthetic) VALUES(${learningId}::uuid,${auth.row.id}::uuid,${problem.release_id}::uuid,'active',${ASSESSMENT_RULE},${learningSessionIsSynthetic(auth, this.store.syntheticData)})`;
            const [exposure] = await tx.$queryRaw<
              { assisted: boolean }[]
            >`SELECT EXISTS(SELECT 1 FROM attempts old JOIN learning_sessions ol ON ol.id=old.learning_session_id JOIN problem_revisions op ON op.id=old.problem_revision_id WHERE ol.guest_session_id=${auth.row.id}::uuid AND (op.problem_id=${p.problemId}::uuid OR op.learning_family=${p.familyCode}) AND (NOT old.independent_evidence_eligible OR old.highest_hint_level_seen>0 OR old.full_solution_seen)) AS assisted`;
            await tx.$executeRaw`INSERT INTO attempts(id,learning_session_id,problem_revision_id,attempt_kind,status,notation_profile,independent_evidence_eligible) VALUES(${attemptId}::uuid,${learningId}::uuid,${p.revisionId}::uuid,'transfer','in_progress',${problem.notation_profile},${kind !== "practice" && !exposure?.assisted})`;
            await recordExposure(
              tx,
              auth.row.id,
              p.revisionId,
              "learning_path_assessment",
            );
          } else if (p.subject === "physics") {
            const reference = physicsRefs.find((r) => r.id === p.revisionId);
            if (!reference) throw missing();
            await recordPhysicsExposure(tx, owner.ownerKey, reference);
          }
          await tx.$executeRaw`INSERT INTO learning_assessment_items(id,assessment_id,position,problem_revision_id,problem_snapshot,attempt_id,measurement_exited_at) VALUES(${randomUUID()}::uuid,${id}::uuid,${i + 1},${p.revisionId}::uuid,${JSON.stringify(p)}::jsonb,${attemptId}::uuid,${kind === "practice" ? new Date() : null})`;
        }
        return this.project(tx, await this.row(tx, owner, id));
      },
    );
  }
  private async project(
    tx: Tx,
    row: AssessmentRow,
  ): Promise<AssessmentSession> {
    const questions: AssessmentQuestion[] = [];
    const contamination =
      row.subject_code === "algebra"
        ? await this.algebraContamination(
            tx,
            row.owner_key,
            row.guest_session_id,
          )
        : null;
    const physicsContamination =
      row.subject_code === "physics"
        ? await this.physicsContamination(tx, row.owner_key)
        : null;
    for (const item of await this.items(tx, row.id)) {
      let steps: string[] = [],
        value = "",
        unit = "",
        status: string | null = null,
        completed = false,
        supportLevel = 0,
        independent = !item.measurement_exited_at;
      if (item.attempt_id) {
        const [a] = await tx.$queryRaw<
          {
            revision: bigint;
            highest_hint_level_seen: number;
            independent_evidence_eligible: boolean;
            full_solution_seen: boolean;
          }[]
        >`SELECT revision,highest_hint_level_seen,independent_evidence_eligible,full_solution_seen FROM attempts WHERE id=${item.attempt_id}::uuid`;
        const raws = await tx.$queryRaw<
          { source_raw: string }[]
        >`SELECT v.source_raw FROM step_slots s JOIN step_versions v ON v.step_slot_id=s.id AND v.version_number=s.current_version WHERE s.attempt_id=${item.attempt_id}::uuid AND s.is_active ORDER BY s.position`;
        steps = raws.map((s) => s.source_raw);
        supportLevel = a?.highest_hint_level_seen ?? 0;
        independent &&=
          a?.independent_evidence_eligible === true && !a.full_solution_seen;
        const [result] = await tx.$queryRaw<
          { report_json: unknown; finished_at: Date }[]
        >`SELECT report_json,finished_at FROM verification_reports WHERE attempt_id=${item.attempt_id}::uuid AND attempt_revision=${a!.revision} AND scope='current_sequence' AND dispatch_status='finished' AND report_json->>'isCurrent'='true' ORDER BY finished_at DESC,id DESC LIMIT 1`;
        const problem = item.problem_snapshot,
          cutoff = result?.finished_at ?? null;
        if (
          contamination &&
          (temporalLearningExposure(
            contamination.problems.get(problem.problemId),
            cutoff,
          ) ||
            temporalLearningExposure(
              contamination.families.get(problem.familyCode),
              cutoff,
            ) ||
            (problem.equationRaw &&
              temporalLearningExposure(
                contamination.equations.get(
                  normalizedLearningEquation(problem.equationRaw),
                ),
                cutoff,
              )))
        )
          independent = false;
        if (result) {
          const report = output("VerificationReport", result.report_json);
          status =
            report.transitions.find((t) => t.mathStatus !== "verified_valid")
              ?.mathStatus ??
            (report.transitions.length ? "verified_valid" : null);
          completed =
            status === "verified_invalid" ||
            report.completion.canMarkAttemptCompleted;
        }
      } else if (item.subject_attempt_id) {
        const [a] = await tx.$queryRaw<
          {
            answer_json: { value: string; unit: string };
            verdict: { status: string };
            independent: boolean;
            assistance_level: number;
            verified_at: Date | null;
          }[]
        >`SELECT a.answer_json,a.verdict,a.independent,a.assistance_level,(SELECT max(e.created_at) FROM subject_attempt_events e WHERE e.attempt_id=a.id AND e.revision=a.revision AND e.event_kind='verified') AS verified_at FROM subject_attempts a WHERE a.id=${item.subject_attempt_id}::uuid`;
        if (a) {
          value = a.answer_json.value;
          unit = a.answer_json.unit;
          status = a.verdict.status;
          supportLevel = a.assistance_level;
          independent &&= a.independent && supportLevel === 0;
          const context = physicsContamination?.byRevision.get(
            item.problem_revision_id,
          );
          if (
            physicsContamination &&
            (temporalLearningExposure(
              physicsContamination.families.get(
                item.problem_snapshot.familyCode,
              ),
              a.verified_at,
            ) ||
              (context &&
                temporalLearningExposure(
                  physicsContamination.contexts.get(context),
                  a.verified_at,
                )))
          )
            independent = false;
          completed = ["correct", "wrong_unit", "wrong_value"].includes(status);
        }
      }
      questions.push({
        id: item.id,
        problem: item.problem_snapshot,
        attemptId: item.attempt_id ?? item.subject_attempt_id,
        steps,
        value,
        unit,
        status,
        completed,
        supportLevel,
        independent,
      });
    }
    return {
      id: row.id,
      revision: row.revision,
      subject: row.subject_code,
      kind: row.kind,
      trackRevisionId: row.track_revision_id,
      lessonRevisionId: row.lesson_revision_id,
      status: questions.every((q) => q.completed) ? "completed" : "active",
      mode:
        row.kind === "practice" || questions.some((q) => !q.independent)
          ? "practice"
          : "independent",
      questions,
      coverage: row.coverage,
      createdAt: row.created_at.toISOString(),
    };
  }
  async get(request: RequestContext, id: string) {
    const { owner } = await this.identity(request);
    return this.store.db.$transaction(async (tx) =>
      this.project(tx, await this.row(tx, owner, id)),
    );
  }
  async answer(
    request: RequestContext,
    id: string,
    raw: unknown,
  ): Promise<AssessmentSession> {
    const { owner, auth } = await this.identity(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "questionId", "steps", "value", "unit"]);
    const expected = revisionField(b.expectedRevision),
      questionId = uuid(textField(b.questionId, 36));
    if (!Array.isArray(b.steps) || b.steps.length > 20) throw productInvalid();
    const steps = b.steps.map((s) => textField(s, 256));
    const prepared = await productMutation(
      this.store,
      owner,
      request,
      "assessment.save:" + uuid(id),
      b,
      async (tx) => {
        const row = await this.row(tx, owner, id, true);
        if (row.revision !== expected) throw conflict(row.revision);
        const item = (await this.items(tx, id)).find(
          (q) => q.id === questionId,
        );
        if (!item) throw missing();
        let attemptRevision = 0,
          subjectAttemptRevision = 0;
        if (item.attempt_id) {
          if (!steps.length || b.value !== undefined || b.unit !== undefined)
            throw productInvalid();
          await this.store.readAttemptInTransaction(tx, auth, item.attempt_id);
          const [a] = await tx.$queryRaw<
            { revision: bigint }[]
          >`SELECT revision FROM attempts WHERE id=${item.attempt_id}::uuid FOR UPDATE`;
          await tx.$executeRaw`UPDATE step_slots SET is_active=false,updated_at=now() WHERE attempt_id=${item.attempt_id}::uuid AND is_active`;
          for (const [index, source] of steps.entries()) {
            const slot = randomUUID();
            await tx.$executeRaw`INSERT INTO step_slots(id,attempt_id,position,current_version) VALUES(${slot}::uuid,${item.attempt_id}::uuid,${index + 1},1)`;
            await tx.$executeRaw`INSERT INTO step_versions(id,step_slot_id,version_number,source_raw,input_origin) VALUES(${randomUUID()}::uuid,${slot}::uuid,1,${source},'keyboard')`;
          }
          attemptRevision = Number(a!.revision) + 1;
          await tx.$executeRaw`UPDATE attempts SET revision=revision+1,status='in_progress',completion_verdict=NULL,closed_at=NULL,updated_at=now() WHERE id=${item.attempt_id}::uuid`;
        } else {
          if (steps.length || row.subject_code !== "physics")
            throw productInvalid();
          textField(b.value, 28);
          textField(b.unit, 16, 0);
          if (item.subject_attempt_id) {
            const [prior] = await tx.$queryRaw<
              { revision: number }[]
            >`SELECT revision FROM subject_attempts WHERE id=${item.subject_attempt_id}::uuid AND owner_key=${owner.ownerKey} FOR UPDATE`;
            if (!prior) throw missing();
            subjectAttemptRevision = prior.revision;
          }
        }
        if (!item.attempt_id && !item.subject_attempt_id)
          await tx.$executeRaw`UPDATE learning_assessments SET revision=revision+1 WHERE id=${id}::uuid`;
        return {
          item,
          attemptRevision,
          subjectAttemptRevision,
          sessionRevision: row.revision + 1,
        };
      },
    );
    if (prepared.item.attempt_id) {
      await this.verification.verify(
        auth,
        prepared.item.attempt_id,
        createHash("sha256")
          .update(String(request.headers["idempotency-key"]) + ":verify")
          .digest("hex"),
        {
          expectedRevision: prepared.attemptRevision,
          scope: "current_sequence",
          targetStepId: null,
        },
      );
    } else {
      const result = await this.physics.submit(
        keyRequest(request, ":physics"),
        {
          problemRevisionId: prepared.item.problem_revision_id,
          value: b.value,
          unit: b.unit,
          ...(prepared.item.subject_attempt_id
            ? {
                attemptId: prepared.item.subject_attempt_id,
                expectedRevision: prepared.subjectAttemptRevision,
              }
            : {}),
        },
      );
      await productMutation(
        this.store,
        owner,
        keyRequest(request, ":link"),
        "assessment.link:" + id,
        b,
        async (tx) => {
          const row = await this.row(tx, owner, id, true);
          if (row.revision !== prepared.sessionRevision)
            throw conflict(row.revision);
          await tx.$executeRaw`UPDATE learning_assessment_items SET subject_attempt_id=${result.id}::uuid WHERE id=${questionId}::uuid`;
          if (prepared.item.measurement_exited_at)
            await tx.$executeRaw`UPDATE subject_attempts SET independent=false,verdict=jsonb_set(verdict,'{independentEvidence}','false'::jsonb) WHERE id=${result.id}::uuid AND owner_key=${owner.ownerKey}`;
          return true;
        },
      );
    }
    return this.get(request, id);
  }
  async support(request: RequestContext, id: string, raw: unknown) {
    const { owner, auth } = await this.identity(request, true),
      b = record(raw);
    only(b, [
      "expectedRevision",
      "questionId",
      "action",
      "confirmAssistedCompletion",
    ]);
    const expected = revisionField(b.expectedRevision),
      questionId = uuid(textField(b.questionId, 36));
    if (
      !["request_hint", "show_full_solution"].includes(String(b.action)) ||
      (b.action === "show_full_solution" &&
        b.confirmAssistedCompletion !== true)
    )
      throw productInvalid("الحل الكامل يتطلب تأكيد المساعدة.");
    const prepared = await productMutation(
      this.store,
      owner,
      request,
      "assessment.support:" + uuid(id),
      b,
      async (tx) => {
        const row = await this.row(tx, owner, id, true);
        if (row.revision !== expected) throw conflict(row.revision);
        const item = (await this.items(tx, id)).find(
          (i) => i.id === questionId,
        );
        if (!item?.attempt_id)
          throw new ApiFault(
            409,
            "invalid_state",
            "مساعدة هذا النشاط متاحة من مساحة المادة بعد حفظ محاولة متحققة.",
          );
        const a = await this.store.readAttemptInTransaction(
          tx,
          auth,
          item.attempt_id,
        );
        await tx.$executeRaw`UPDATE learning_assessment_items SET measurement_exited_at=COALESCE(measurement_exited_at,now()) WHERE id=${questionId}::uuid`;
        await tx.$executeRaw`UPDATE attempts SET independent_evidence_eligible=false,assistance_revision=assistance_revision+1 WHERE id=${a.id}::uuid`;
        return { attemptId: a.id, revision: Number(a.revision) };
      },
    );
    const event = await this.tutoring.request(
      auth,
      prepared.attemptId,
      createHash("sha256")
        .update(String(request.headers["idempotency-key"]) + ":hint")
        .digest("hex"),
      {
        expectedRevision: prepared.revision,
        action:
          b.action === "request_hint" ? "next_hint" : "show_full_solution",
        confirmAssistedCompletion: b.confirmAssistedCompletion === true,
      },
    );
    return {
      session: await this.get(request, id),
      hint: {
        level: event.hintLevel,
        textAr: event.textAr,
        source: event.generationSource,
        solutionStepsAr: event.solutionStepsAr,
      },
    };
  }
  /** Mark non-classic support before revealing a scaffold or tutor prompt. */
  async exitMeasurement(request: RequestContext, id: string, raw: unknown) {
    const { owner, auth } = await this.identity(request, true),
      b = record(raw);
    only(b, ["expectedRevision", "questionId"]);
    const expected = revisionField(b.expectedRevision),
      questionId = uuid(textField(b.questionId, 36));
    await productMutation(
      this.store,
      owner,
      keyRequest(request, ":exit-measurement"),
      "assessment.exit:" + uuid(id),
      b,
      async (tx) => {
        const row = await this.row(tx, owner, id, true);
        if (row.revision !== expected) throw conflict(row.revision);
        const item = (await this.items(tx, id)).find(
          (i) => i.id === questionId,
        );
        if (!item) throw missing();
        if (item.attempt_id) {
          await this.store.readAttemptInTransaction(tx, auth, item.attempt_id);
          await tx.$executeRaw`UPDATE attempts SET independent_evidence_eligible=false,assistance_revision=assistance_revision+1 WHERE id=${item.attempt_id}::uuid`;
        } else if (item.subject_attempt_id) {
          await tx.$executeRaw`UPDATE subject_attempts SET independent=false,assistance_level=GREATEST(assistance_level,1) WHERE id=${item.subject_attempt_id}::uuid AND owner_key=${owner.ownerKey}`;
        } else {
          await tx.$executeRaw`UPDATE learning_assessments SET revision=revision+1 WHERE id=${id}::uuid`;
        }
        await tx.$executeRaw`UPDATE learning_assessment_items SET measurement_exited_at=COALESCE(measurement_exited_at,now()) WHERE id=${questionId}::uuid`;
        return true;
      },
    );
    return this.get(request, id);
  }
  private async evidenceObservations(
    tx: Tx,
    owner: ProductActor,
    auth: GuestAuth,
    row: AssessmentRow,
  ) {
    const source = await tx.$queryRaw<
      {
        problem_revision_id: string;
        problem_id: string;
        primary_skill: string;
        difficulty: number;
        id: string;
        report_json: unknown;
        created_at: Date;
        independent: boolean;
        original_equation_raw: string;
        learning_family: string | null;
        item_kind: string;
      }[]
    >`SELECT DISTINCT ON(a.problem_revision_id) a.problem_revision_id,p.problem_id,p.original_equation_raw,p.learning_family,p.item_kind,s.skill_code AS primary_skill,p.difficulty_band AS difficulty,r.id,r.report_json,r.finished_at AS created_at,(a.independent_evidence_eligible AND a.highest_hint_level_seen=0 AND NOT a.full_solution_seen AND i.measurement_exited_at IS NULL) AS independent FROM learning_assessment_items i JOIN learning_assessments x ON x.id=i.assessment_id JOIN attempts a ON a.id=i.attempt_id JOIN problem_revisions p ON p.id=a.problem_revision_id JOIN problem_skills ps ON ps.problem_revision_id=p.id AND ps.coverage_kind='primary' JOIN skills s ON s.id=ps.skill_id JOIN verification_reports r ON r.attempt_id=a.id AND r.attempt_revision=a.revision AND r.scope='current_sequence' AND r.dispatch_status='finished' AND r.report_json->>'isCurrent'='true' WHERE x.owner_key=${owner.ownerKey} AND x.subject_code=${row.subject_code} ORDER BY a.problem_revision_id,r.finished_at DESC,r.id DESC`;
    const contamination =
      row.subject_code === "algebra"
        ? await this.algebraContamination(tx, owner.ownerKey, auth.row.id)
        : null;
    const observations: LearningObservation[] = source.map((s) => {
      const report = output("VerificationReport", s.report_json);
      const invalid = report.transitions.some(
          (t) => t.mathStatus === "verified_invalid",
        ),
        assessable =
          report.transitions.length > 0 &&
          report.transitions.every((t) =>
            ["verified_valid", "verified_invalid"].includes(t.mathStatus),
          );
      return {
        skillCode: s.primary_skill,
        problemId: s.problem_id,
        contentKey: normalizedLearningEquation(s.original_equation_raw),
        difficulty: s.difficulty,
        evidenceId: s.id,
        time: s.created_at.toISOString(),
        verifiedCorrect:
          assessable && !invalid && report.completion.canMarkAttemptCompleted,
        transferEligible: s.item_kind === "transfer",
        outcome: !assessable
          ? "unassessable"
          : !s.independent ||
              (contamination &&
                (temporalLearningExposure(
                  contamination.problems.get(s.problem_id),
                  s.created_at,
                ) ||
                  (s.learning_family &&
                    temporalLearningExposure(
                      contamination.families.get(s.learning_family),
                      s.created_at,
                    )) ||
                  temporalLearningExposure(
                    contamination.equations.get(
                      normalizedLearningEquation(s.original_equation_raw),
                    ),
                    s.created_at,
                  )))
            ? "assisted"
            : invalid
              ? "error"
              : report.completion.canMarkAttemptCompleted
                ? "correct"
                : "unassessable",
      };
    });
    if (row.subject_code === "algebra") {
      const old = await tx.$queryRaw<
        {
          skill_code: string;
          problem_id: string;
          difficulty: number;
          id: string;
          observation: string;
          independent: boolean;
          created_at: Date;
          original_equation_raw: string;
          item_kind: string;
        }[]
      >`SELECT s.skill_code AS skill_code,p.problem_id,p.original_equation_raw,p.item_kind,p.difficulty_band AS difficulty,e.id,e.observation,e.created_at,(e.event_kind='transfer_observation' AND a.independent_evidence_eligible AND a.highest_hint_level_seen=0 AND NOT a.full_solution_seen) AS independent FROM current_skill_evidence e JOIN learning_sessions l ON l.id=e.learning_session_id JOIN attempts a ON a.id=e.attempt_id JOIN skills s ON s.id=e.skill_id JOIN problem_revisions p ON p.id=e.problem_revision_id WHERE l.guest_session_id=${auth.row.id}::uuid`;
      observations.push(
        ...old.map((e) => ({
          skillCode: e.skill_code,
          problemId: e.problem_id,
          contentKey: normalizedLearningEquation(e.original_equation_raw),
          difficulty: e.difficulty,
          evidenceId: e.id,
          time: e.created_at.toISOString(),
          kind: e.independent ? ("transfer" as const) : undefined,
          transferEligible: e.independent && e.item_kind === "transfer",
          verifiedCorrect: e.observation === "positive",
          outcome:
            e.observation === "non_assessable"
              ? ("unassessable" as const)
              : !e.independent
                ? ("assisted" as const)
                : e.observation === "positive"
                  ? ("correct" as const)
                  : e.observation === "needs_review"
                    ? ("error" as const)
                    : e.observation === "assisted"
                      ? ("assisted" as const)
                      : ("unassessable" as const),
        })),
      );
    } else {
      const contamination = await this.physicsContamination(tx, owner.ownerKey);
      const physics = await tx.$queryRaw<
        {
          id: string;
          problem_snapshot: LearningBankProblem;
          verdict: { status: string };
          independent: boolean;
          assistance_level: number;
          measurement_exited_at: Date | null;
          updated_at: Date;
          verified_at: Date | null;
        }[]
      >`SELECT a.id,i.problem_snapshot,a.verdict,a.independent,a.assistance_level,i.measurement_exited_at,a.updated_at,(SELECT max(e.created_at) FROM subject_attempt_events e WHERE e.attempt_id=a.id AND e.revision=a.revision AND e.event_kind='verified') AS verified_at FROM learning_assessment_items i JOIN learning_assessments x ON x.id=i.assessment_id JOIN subject_attempts a ON a.id=i.subject_attempt_id WHERE x.owner_key=${owner.ownerKey} AND x.subject_code=${row.subject_code} AND a.owner_key=${owner.ownerKey} AND a.subject_code=${row.subject_code}`;
      observations.push(
        ...physics.map((p) => ({
          skillCode: p.problem_snapshot.primarySkillCode,
          problemId: p.problem_snapshot.problemId,
          contentKey: contamination.byRevision.get(
            p.problem_snapshot.revisionId,
          ),
          difficulty: p.problem_snapshot.difficulty,
          evidenceId: p.id,
          time: (p.verified_at ?? p.updated_at).toISOString(),
          verifiedCorrect: p.verdict.status === "correct",
          transferEligible: p.problem_snapshot.kind === "transfer",
          outcome: !["correct", "wrong_unit", "wrong_value"].includes(
            p.verdict.status,
          )
            ? ("unassessable" as const)
            : !p.independent ||
                temporalLearningExposure(
                  contamination.families.get(p.problem_snapshot.familyCode),
                  p.verified_at,
                ) ||
                temporalLearningExposure(
                  contamination.contexts.get(
                    contamination.byRevision.get(
                      p.problem_snapshot.revisionId,
                    ) ?? "",
                  ),
                  p.verified_at,
                ) ||
                p.assistance_level > 0 ||
                p.measurement_exited_at
              ? ("assisted" as const)
              : p.verdict.status === "correct"
                ? ("correct" as const)
                : ("error" as const),
        })),
      );
    }
    const allowedSkills = new Set(
      row.mapping_snapshot.lessons.flatMap((l) =>
        l.payload.kind === "lesson" ? l.payload.skillCodes : [],
      ),
    );
    return observations.filter((item) => allowedSkills.has(item.skillCode));
  }
  private async evidence(
    tx: Tx,
    owner: ProductActor,
    auth: GuestAuth,
    row: AssessmentRow,
  ) {
    return summarizeSkillEvidence(
      await this.evidenceObservations(tx, owner, auth, row),
      row.mapping_snapshot.map.skills.filter((skill) =>
        row.mapping_snapshot.lessons.some(
          (lesson) =>
            lesson.payload.kind === "lesson" &&
            lesson.payload.skillCodes.includes(skill.skillCode),
        ),
      ),
    );
  }
  /** Read only context: unlike track()/lesson(), this does not expose examples. */
  async context(
    request: RequestContext,
    trackId: string,
    existing?: { tx: Tx; owner: ProductActor; auth: GuestAuth },
  ) {
    const { owner, auth } = existing ?? (await this.identity(request));
    const work = async (tx: Tx) => {
      await this.accounts.authorizeInTransaction(tx, owner);
      await requireProductLearningAccess(tx, owner, this.store.syntheticData);
      const source = await this.content.row(uuid(trackId), tx);
      if (source.status !== "published" || source.payload.kind !== "track")
        throw missing();
      const lessons: LearningContentRevision[] = [];
      for (const id of source.payload.units.flatMap(
        (unit) => unit.lessonRevisionIds,
      )) {
        const lesson = await this.content.row(id, tx);
        if (
          lesson.status === "published" &&
          lesson.payload.kind === "lesson" &&
          lesson.payload.subject === source.payload.subject
        )
          lessons.push(learningContentDto(lesson));
      }
      const map = await this.content.skillMap(tx, true);
      const row: AssessmentRow = {
        id: "",
        owner_key: owner.ownerKey,
        guest_session_id: auth.row.id,
        subject_code: source.payload.subject,
        track_revision_id: source.id,
        lesson_revision_id: null,
        kind: "diagnostic_pretest",
        revision: 0,
        rule_version: ASSESSMENT_RULE,
        mapping_snapshot: { map, lessons },
        coverage: { requested: 0, available: 0, partial: false, messageAr: "" },
        created_at: new Date(),
      };
      const base = await this.evidenceObservations(tx, owner, auth, row);
      const provenance = await tx.$queryRaw<
        {
          evidence_id: string;
          attempt_id: string;
          revision: number;
          kind: AssessmentKind;
          updated_at: Date;
          assessment_id: string;
        }[]
      >`SELECT r.id AS evidence_id,a.id AS attempt_id,a.revision::int AS revision,x.kind,a.updated_at,x.id AS assessment_id FROM learning_assessments x JOIN learning_assessment_items i ON i.assessment_id=x.id JOIN attempts a ON a.id=i.attempt_id JOIN verification_reports r ON r.attempt_id=a.id AND r.attempt_revision=a.revision WHERE x.owner_key=${owner.ownerKey} UNION ALL SELECT a.id,a.id,a.revision,x.kind,a.updated_at,x.id FROM learning_assessments x JOIN learning_assessment_items i ON i.assessment_id=x.id JOIN subject_attempts a ON a.id=i.subject_attempt_id WHERE x.owner_key=${owner.ownerKey} AND a.owner_key=${owner.ownerKey}`;
      const observations: LearningObservation[] = base
        .map((item) => {
          const ref = provenance.find((p) => p.evidence_id === item.evidenceId);
          return {
            ...item,
            kind: ref?.kind ?? item.kind,
            attemptId: ref?.attempt_id,
            attemptRevision: ref?.revision,
            assessmentId: ref?.assessment_id,
          };
        })
        .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
      const events = await tx.$queryRaw<
        { lesson_revision_id: string }[]
      >`SELECT DISTINCT lesson_revision_id FROM learning_lesson_events WHERE owner_key=${owner.ownerKey}`;
      const attemptVersions = await tx.$queryRaw<
        {
          id: string;
          revision: string;
          assistance_revision: number;
          updated_at: Date;
        }[]
      >`SELECT a.id,a.revision::text,a.assistance_revision,a.updated_at FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id WHERE l.guest_session_id=${auth.row.id}::uuid ORDER BY a.id`;
      const evidenceFingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            observations,
            attemptVersions,
            provenance: provenance.sort((a, b) =>
              a.evidence_id.localeCompare(b.evidence_id),
            ),
            content: [
              source,
              ...lessons.map((l) => ({
                id: l.id,
                content_hash: l.contentHash,
              })),
            ].map((l) => ({ id: l.id, hash: l.content_hash })),
            map,
            events: events.map((e) => e.lesson_revision_id).sort(),
          }),
        )
        .digest("hex");
      return {
        owner,
        auth,
        track: { ...learningContentDto(source), lessons },
        map,
        observations,
        skills: summarizeSkillEvidence(
          observations,
          map.skills.filter((s) =>
            lessons.some(
              (l) =>
                l.payload.kind === "lesson" &&
                l.payload.skillCodes.includes(s.skillCode),
            ),
          ),
        ),
        viewedLessonIds: events.map((e) => e.lesson_revision_id),
        evidenceFingerprint,
      };
    };
    return existing ? work(existing.tx) : this.store.db.$transaction(work);
  }
  async summary(
    request: RequestContext,
    id: string,
  ): Promise<AssessmentSummary> {
    const { owner, auth } = await this.identity(request);
    return this.store.db.$transaction(async (tx) => {
      const row = await this.row(tx, owner, id),
        skills = await this.evidence(tx, owner, auth, row);
      const current = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM learning_content_revisions WHERE status='published'`;
      const lessons = row.mapping_snapshot.lessons.filter((l) =>
        current.some((c) => c.id === l.id),
      );
      const recommendation = recommendLesson(
        skills,
        row.mapping_snapshot.map,
        lessons,
      );
      await tx.$executeRaw`INSERT INTO learning_recommendation_events(id,owner_key,assessment_id,track_revision_id,rule_version,recommendation) VALUES(${randomUUID()}::uuid,${owner.ownerKey},${id}::uuid,${row.track_revision_id}::uuid,${row.rule_version},${JSON.stringify(recommendation)}::jsonb)`;
      return { session: await this.project(tx, row), skills, recommendation };
    });
  }
  async progress(
    request: RequestContext,
    trackId: string,
  ): Promise<LearningPathProgress> {
    const { owner, auth } = await this.identity(request),
      track = await this.content.track(request, uuid(trackId));
    return this.store.db.$transaction(async (tx) => {
      await this.accounts.authorizeInTransaction(tx, owner);
      const map = await this.content.skillMap(tx, true),
        synthetic: AssessmentRow = {
          id: "",
          owner_key: owner.ownerKey,
          guest_session_id: auth.row.id,
          subject_code: track.payload.subject,
          track_revision_id: track.id,
          lesson_revision_id: null,
          kind: "diagnostic_pretest",
          revision: 0,
          rule_version: ASSESSMENT_RULE,
          mapping_snapshot: { map, lessons: track.lessons },
          coverage: {
            requested: 0,
            available: 0,
            partial: false,
            messageAr: "",
          },
          created_at: new Date(),
        };
      const skills = await this.evidence(tx, owner, auth, synthetic);
      const events = await tx.$queryRaw<
        { lesson_revision_id: string; viewed_at: Date }[]
      >`SELECT lesson_revision_id,max(created_at) AS viewed_at FROM learning_lesson_events WHERE owner_key=${owner.ownerKey} GROUP BY lesson_revision_id`;
      const practiced = await tx.$queryRaw<
        { lesson_revision_id: string }[]
      >`SELECT DISTINCT x.lesson_revision_id FROM learning_assessments x JOIN learning_assessment_items i ON i.assessment_id=x.id JOIN attempts a ON a.id=i.attempt_id JOIN verification_reports r ON r.attempt_id=a.id AND r.attempt_revision=a.revision AND r.dispatch_status='finished' WHERE x.owner_key=${owner.ownerKey} AND x.kind='practice' AND x.track_revision_id=${track.id}::uuid`;
      return {
        skills,
        recommendation: recommendLesson(skills, map, track.lessons),
        ruleVersion: ASSESSMENT_RULE,
        lessons: track.lessons.map((l) => {
          const event = events.find((e) => e.lesson_revision_id === l.id),
            codes = l.payload.kind === "lesson" ? l.payload.skillCodes : [];
          return {
            lessonRevisionId: l.id,
            viewedAt: event?.viewed_at.toISOString() ?? null,
            state:
              codes.length &&
              codes.every(
                (c) =>
                  skills.find((s) => s.skillCode === c)?.state ===
                  "independent_evidence",
              )
                ? ("independent_evidence" as const)
                : practiced.some((p) => p.lesson_revision_id === l.id)
                  ? ("practiced" as const)
                  : event
                    ? ("viewed" as const)
                    : ("not_started" as const),
          };
        }),
      };
    });
  }
  async lessonEvent(request: RequestContext, id: string, raw: unknown) {
    const { owner } = await this.identity(request, true),
      b = record(raw);
    only(b, ["event"]);
    if (!["lesson_started", "lesson_viewed"].includes(String(b.event)))
      throw productInvalid();
    await this.content.lesson(request, uuid(id));
    return productMutation(
      this.store,
      owner,
      request,
      "lesson.event:" + id,
      b,
      async (tx) => {
        await requireProductLearningAccess(tx, owner, this.store.syntheticData);
        const at = new Date();
        await tx.$executeRaw`INSERT INTO learning_lesson_events(id,owner_key,lesson_revision_id,event_kind,created_at) VALUES(${randomUUID()}::uuid,${owner.ownerKey},${id}::uuid,${String(b.event)},${at})`;
        return {
          lessonRevisionId: id,
          state: "viewed",
          viewedAt: at.toISOString(),
        };
      },
    );
  }
}
@Controller("api/v1")
export class LearningAssessmentController {
  constructor(readonly assessments: LearningAssessmentService) {}
  @Post("assessments/start") start(
    @Req() r: RequestContext,
    @Body() b: unknown,
  ) {
    return this.assessments.start(r, b).then((d) => productEnvelope(r, d));
  }
  @Get("assessments/:id") get(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.assessments.get(r, id).then((d) => productEnvelope(r, d));
  }
  @Post("assessments/:id/answer") answer(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.assessments.answer(r, id, b).then((d) => productEnvelope(r, d));
  }
  @Post("assessments/:id/support") support(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.assessments
      .support(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
  @Get("assessments/:id/summary") summary(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.assessments.summary(r, id).then((d) => productEnvelope(r, d));
  }
  @Get("learning/progress") progress(
    @Req() r: RequestContext,
    @Query("trackRevisionId") id: string,
  ) {
    return this.assessments.progress(r, id).then((d) => productEnvelope(r, d));
  }
  @Get("recommendations/next") next(
    @Req() r: RequestContext,
    @Query("trackRevisionId") id: string,
  ) {
    return this.assessments
      .progress(r, id)
      .then(({ skills, recommendation }) =>
        productEnvelope(r, { skills, recommendation }),
      );
  }
  @Post("learning/lessons/:id/progress") event(
    @Req() r: RequestContext,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.assessments
      .lessonEvent(r, id, b)
      .then((d) => productEnvelope(r, d));
  }
}
