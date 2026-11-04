import type { Prisma } from "@prisma/client";
import type { AttemptRow } from "./store";
import { ApiFault } from "./http";
export const hasAssistance = (attempt: AttemptRow): boolean =>
  (attempt.highest_hint_level_seen ?? 0) > 0 ||
  attempt.independent_evidence_eligible === false ||
  attempt.full_solution_seen === true ||
  attempt.status === "assisted_completed";
export async function requireUnassistedProbe(
  tx: Prisma.TransactionClient,
  attempt: AttemptRow,
): Promise<void> {
  if (attempt.attempt_kind === "transfer")
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
