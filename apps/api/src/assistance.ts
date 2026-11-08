import type { Prisma } from "@prisma/client";
import type { AttemptRow } from "./store";
import { ApiFault } from "./http";
export const hasAssistance = (attempt: AttemptRow): boolean =>
  (attempt.highest_hint_level_seen ?? 0) > 0 ||
  attempt.independent_evidence_eligible === false ||
  attempt.full_solution_seen === true ||
  attempt.status === "assisted_completed";
/** The path adapter uses transfer attempts for checks. Only an explicit path
 * measurement exit can open A3; a native transfer assignment remains sealed. */
export async function exitedSyntheticPathProbe(
  tx: Prisma.TransactionClient,
  attempt: AttemptRow,
): Promise<boolean> {
  if (
    process.env.DEEP_DIAGNOSIS_ENABLED !== "true" ||
    process.env.KHOTWA_SYNTHETIC_DATA !== "true"
  )
    return false;
  const [path] = await tx.$queryRaw<
    { id: string }[]
  >`SELECT i.id FROM learning_assessment_items i JOIN learning_assessments x ON x.id=i.assessment_id JOIN learning_sessions l ON l.id=${attempt.learning_session_id}::uuid WHERE i.attempt_id=${attempt.id}::uuid AND i.measurement_exited_at IS NOT NULL AND x.guest_session_id=l.guest_session_id AND x.subject_code='algebra' AND l.is_synthetic AND NOT EXISTS(SELECT 1 FROM learning_assignments a WHERE a.attempt_id=${attempt.id}::uuid) LIMIT 1`;
  return !!path;
}
export async function requireUnassistedProbe(
  tx: Prisma.TransactionClient,
  attempt: AttemptRow,
): Promise<void> {
  if (
    attempt.attempt_kind === "transfer" &&
    !(await exitedSyntheticPathProbe(tx, attempt))
  )
    throw new ApiFault(
      409,
      "invalid_state",
      "لا يقدم سؤال تأكيدي تعليمي أثناء قياس النقل المستقل.",
    );
  if (hasAssistance(attempt))
    throw new ApiFault(
      409,
      "invalid_state",
      "سُجلت مساعدة لهذه المحاولة؛ لا نعد جوابًا لاحقًا للسؤال دليلًا تشخيصيًا مستقلًا.",
    );
  if (process.env.PH07_API_ENABLED === "true") {
    const [pending] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM hint_requests WHERE attempt_id=${attempt.id}::uuid AND dispatch_status='running' AND deadline_at>now()`;
    if (pending)
      throw new ApiFault(
        409,
        "request_in_progress",
        "طلب المساعدة قيد التنفيذ؛ انتظر قبل بدء سؤال تأكيدي.",
      );
  }
}
