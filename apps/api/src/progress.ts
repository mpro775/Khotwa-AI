import type { Prisma } from "@prisma/client";
import type { Store, GuestAuth } from "./store";
import { ApiFault } from "./http";
import type { Schema } from "./contracts";
import {
  realLearningConfigured,
  requireLearningAccess,
} from "./learning-access";
import {
  evidenceState,
  LEARNING_POLICY,
  type Observation,
} from "./learning-policy";
export interface ProgressEvidence {
  skill_id: string;
  event_kind: string;
  observation: Observation;
  created_at: Date;
}
export function summarizeSkill(
  skill: { id: string; skill_code: string; name_ar: string },
  events: ProgressEvidence[],
): Schema<"SkillProgress"> {
  const es = events.filter((e) => e.skill_id === skill.id);
  return {
    skillId: skill.id,
    skillCode: skill.skill_code,
    titleAr: skill.name_ar,
    state: evidenceState(es),
    evidenceCount: es.filter((e) => e.observation !== "non_assessable").length,
    independentTransferCount: es.filter(
      (e) =>
        e.event_kind === "transfer_observation" && e.observation === "positive",
    ).length,
    assistedPracticeCount: es.filter((e) => e.observation === "assisted")
      .length,
    updatedAt: es.length
      ? new Date(
          es.reduce((latest, e) => Math.max(latest, e.created_at.getTime()), 0),
        ).toISOString()
      : null,
  };
}
export class ProgressService {
  constructor(
    readonly store: Store,
    readonly active = false,
  ) {
    if (active && !store.syntheticData && !realLearningConfigured())
      throw Error(
        "Progress requires synthetic data or explicitly configured real learning",
      );
  }
  async progress(
    auth: GuestAuth,
    learningId: string,
    skillId?: string,
  ): Promise<Schema<"ProgressSummary">> {
    if (!this.active || process.env.PH09_API_ENABLED !== "true")
      throw new ApiFault(404, "not_found", "المورد غير متاح.");
    return this.store.db.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.store.authorizeInTransaction(tx, auth);
      const [l] = await tx.$queryRaw<
        { is_synthetic: boolean; release_id: string }[]
      >`SELECT is_synthetic,release_id FROM learning_sessions WHERE id=${learningId}::uuid AND guest_session_id=${auth.row.id}::uuid`;
      if (!l) throw new ApiFault(404, "not_found", "المورد غير متاح.");
      await requireLearningAccess(tx, auth, l.is_synthetic);
      const skills = await tx.$queryRaw<
        { id: string; skill_code: string; name_ar: string }[]
      >`SELECT id,skill_code,name_ar FROM skills WHERE release_id=${l.release_id}::uuid AND status='active' AND (${skillId ?? null}::uuid IS NULL OR id=${skillId ?? null}::uuid) ORDER BY sort_order,id`;
      if (skillId && !skills.length)
        throw new ApiFault(404, "not_found", "المورد غير متاح.");
      const events = await tx.$queryRaw<
        ProgressEvidence[]
      >`SELECT skill_id,event_kind,observation,created_at FROM current_skill_evidence WHERE learning_session_id=${learningId}::uuid AND policy_version=${LEARNING_POLICY} ORDER BY created_at DESC,id DESC`;
      return {
        learningSessionId: learningId,
        isSynthetic: l.is_synthetic,
        skills: skills.map((s) => summarizeSkill(s, events)),
        updatedAt: new Date().toISOString(),
        noteAr:
          (l.is_synthetic
            ? "بيانات اختبار اصطناعية قيد المراجعة. "
            : "أدلة خاصة بحسابك وموافقتك الحالية. ") +
          "المصدر هو آخر دليل صالح من التدريب والنقل في هذه الجلسة، بعد استبعاد النسخ القديمة والمساعدة من النقل المستقل. عدد الأدلة ليس درجة؛ عدم التقييم لا يعني صفرًا، ونجاح مسألة واحدة لا يثبت إتقانًا دائمًا.",
      };
    });
  }
}
