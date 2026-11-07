import type { Prisma } from "@prisma/client";
import type { GuestAuth } from "./store";
import { ApiFault } from "./http";
import type { ProductOwner } from "./product-core";

export const REAL_LEARNING_POLICY = "real-learning-v1";
export const EXTERNAL_AI_POLICY = "external-ai-v1";
export function freshApprovalReference(value: string | undefined): boolean {
  return (
    !!value &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/.test(value) &&
    !/PH-?08|LIVE4|2026-11-06|MVP-CLOSURE|SOURCE-CLOSURE/i.test(value)
  );
}
export function realLearningConfigured(): boolean {
  return (
    process.env.REAL_LEARNING_ENABLED === "true" &&
    process.env.REAL_LEARNING_POLICY_VERSION === REAL_LEARNING_POLICY &&
    freshApprovalReference(process.env.REAL_LEARNING_APPROVAL_REFERENCE)
  );
}
export async function requireLearningAccess(
  tx: Prisma.TransactionClient,
  auth: GuestAuth,
  isSynthetic: boolean,
): Promise<void> {
  if (isSynthetic) {
    if (auth.accountUserId && auth.accountIsInternal === false)
      throw new ApiFault(
        403,
        "forbidden",
        "هذا الحساب لا يملك بيانات تجربة اصطناعية.",
      );
    return;
  }
  if (
    !realLearningConfigured() ||
    !auth.accountUserId ||
    !auth.accountSessionId ||
    auth.accountIsInternal !== false
  )
    throw new ApiFault(
      403,
      "forbidden",
      "التعلم للحساب الحقيقي يحتاج تهيئة معتمدة وموافقة صريحة.",
    );
  const [allowed] = await tx.$queryRaw<
    { id: string }[]
  >`SELECT u.id FROM users u JOIN auth_sessions s ON s.user_id=u.id JOIN account_learning_consents c ON c.user_id=u.id WHERE u.id=${auth.accountUserId}::uuid AND NOT u.is_internal AND u.status='active' AND s.id=${auth.accountSessionId}::uuid AND s.revoked_at IS NULL AND s.expires_at>now() AND c.enabled AND c.policy_version=${REAL_LEARNING_POLICY} FOR SHARE OF u,s,c`;
  if (!allowed)
    throw new ApiFault(
      403,
      "forbidden",
      "وافق على سياسة حفظ رحلة التعلم في حسابك أولًا؛ يمكن سحب الموافقة لاحقًا.",
    );
}
export function learningSessionIsSynthetic(
  auth: GuestAuth,
  defaultSynthetic: boolean,
): boolean {
  return auth.accountUserId
    ? auth.accountIsInternal === true
    : defaultSynthetic;
}
export async function requireProductLearningAccess(
  tx: Prisma.TransactionClient,
  owner: ProductOwner,
  syntheticData = process.env.KHOTWA_SYNTHETIC_DATA === "true",
): Promise<void> {
  if (!owner.userId) {
    if (!owner.guestAuth)
      throw new ApiFault(401, "unauthenticated", "ابدأ جلسة للمتابعة.");
    if (!syntheticData)
      throw new ApiFault(
        403,
        "forbidden",
        "التعلم غير الاصطناعي يحتاج حسابًا وموافقة سياسة التعلم.",
      );
    return;
  }
  const [user] = await tx.$queryRaw<
    { is_internal: boolean }[]
  >`SELECT u.is_internal FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE u.id=${owner.userId}::uuid AND s.id=${owner.authSessionId ?? "00000000-0000-0000-0000-000000000000"}::uuid AND u.status='active' AND s.revoked_at IS NULL AND s.expires_at>now() FOR SHARE OF u,s`;
  if (!user) throw new ApiFault(401, "unauthenticated", "انتهت جلسة الحساب.");
  if (user.is_internal) return;
  const [consent] = await tx.$queryRaw<
    { enabled: boolean; policy_version: string }[]
  >`SELECT enabled,policy_version FROM account_learning_consents WHERE user_id=${owner.userId}::uuid FOR SHARE`;
  if (
    !realLearningConfigured() ||
    !consent?.enabled ||
    consent.policy_version !== REAL_LEARNING_POLICY
  )
    throw new ApiFault(
      403,
      "forbidden",
      "التعلم للحساب الحقيقي يتطلب تهيئة معتمدة وموافقة سياسة التعلم الحالية.",
    );
}
