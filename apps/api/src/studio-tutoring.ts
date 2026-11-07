import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { ContentPayload } from "../../../packages/contracts/src/product";
import { safeTeachingText } from "./ai-tutor";
import { TUTORING_POLICY } from "./tutoring-policy";

/** Studio hints enter the same audited/versioned tutoring path as older
 * templates. H1–H3 are conceptual prose; equation proof belongs to H4's
 * separately verified solution_steps, never to unchecked prose extraction. */
export function studioHintIssues(payload: ContentPayload): string[] {
  if (!payload.algebra) return [];
  const issues: string[] = [];
  for (const h of payload.hints) {
    if (!safeTeachingText(h.textAr))
      issues.push(
        `نص H${h.level} يحتاج صياغة عربية مأمونة دون روابط أو شيفرة أو محارف اتجاه خفية.`,
      );
    if (
      h.level < 4 &&
      (/[=٠-٩0-9×÷]|(?:الجواب هو|الحل هو|س يساوي)/u.test(h.textAr) ||
        h.textAr.includes("/"))
    )
      issues.push(
        `تلميح H${h.level} يجب أن يوجه الفكرة دون كشف قيمة أو معادلة؛ ضع خطوات الحل في H4.`,
      );
  }
  return issues;
}
export async function materializeStudioHints(
  tx: Prisma.TransactionClient,
  input: {
    payload: ContentPayload;
    releaseId: string;
    problemRevisionId: string;
    studioRevisionId: string;
    reviewerId: string;
  },
): Promise<void> {
  const {
    payload,
    releaseId,
    problemRevisionId,
    studioRevisionId,
    reviewerId,
  } = input;
  if (
    !payload.algebra ||
    studioHintIssues(payload).length ||
    payload.hints.some((h) => !h.reviewed)
  )
    throw new Error("Studio tutoring requires reviewed safe algebra hints");
  for (const h of payload.hints) {
    const steps =
      h.level === 4
        ? [
            ...new Set([
              payload.algebra.validStepRaw,
              payload.algebra.answerRaw,
            ]),
          ]
        : [];
    await tx.$executeRaw`INSERT INTO intervention_templates(id,release_id,problem_revision_id,error_code,hint_level,template_version,policy_version,text_ar,allowed_rephrases,math_assertions,solution_steps,is_synthetic,enabled,review_status,reviewed_by_role,reviewed_at) VALUES(${randomUUID()}::uuid,${releaseId}::uuid,${problemRevisionId}::uuid,NULL,${h.level},${"studio-" + studioRevisionId},${TUTORING_POLICY},${h.textAr},'[]'::jsonb,'[]'::jsonb,${JSON.stringify(steps)}::jsonb,true,true,'reviewed',${"admin:" + reviewerId},now())`;
  }
}
