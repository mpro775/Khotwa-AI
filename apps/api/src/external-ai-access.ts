import type { Prisma } from "@prisma/client";
import type { ProductOwner } from "./product-core";
import {
  EXTERNAL_AI_POLICY,
  freshApprovalReference,
  requireProductLearningAccess,
} from "./learning-access";

export function betaAiConfigured(): boolean {
  const expiry = Date.parse(
    process.env.BETA_GEMINI_AUTHORIZATION_EXPIRES_AT ?? "",
  );
  return (
    process.env.BETA_ENABLED === "true" &&
    process.env.BETA_ACCESS_PAUSED !== "true" &&
    process.env.BETA_GEMINI_ENABLED === "true" &&
    process.env.AI_ENABLED === "true" &&
    process.env.BETA_AI_ENABLED === "true" &&
    freshApprovalReference(process.env.BETA_GEMINI_AUTHORIZATION_ID) &&
    Number.isFinite(expiry) &&
    expiry > Date.now() &&
    /^gemini-[A-Za-z0-9._-]{1,80}$/.test(process.env.BETA_GEMINI_MODEL ?? "") &&
    (process.env.GEMINI_API_KEY ?? "").length >= 16 &&
    Number.isSafeInteger(
      Number(process.env.BETA_GEMINI_KNOWN_DAILY_REMAINING),
    ) &&
    Number(process.env.BETA_GEMINI_KNOWN_DAILY_REMAINING) > 0
  );
}
export async function canDeliverExternalAi(
  tx: Prisma.TransactionClient,
  owner: ProductOwner,
): Promise<boolean> {
  if (!betaAiConfigured() || !owner.userId || !owner.authSessionId)
    return false;
  try {
    await requireProductLearningAccess(tx, owner);
  } catch {
    return false;
  }
  const [consent] = await tx.$queryRaw<
    { enabled: boolean; policy_version: string }[]
  >`SELECT c.enabled,c.policy_version FROM account_ai_consents c JOIN users u ON u.id=c.user_id JOIN auth_sessions s ON s.user_id=u.id WHERE c.user_id=${owner.userId}::uuid AND s.id=${owner.authSessionId}::uuid AND u.status='active' AND s.revoked_at IS NULL AND s.expires_at>now() FOR SHARE OF c,u,s`;
  return (
    consent?.enabled === true && consent.policy_version === EXTERNAL_AI_POLICY
  );
}
