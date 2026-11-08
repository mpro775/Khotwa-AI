import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiFault, RequestContext, metadata } from "./http";
import { idempotencyHeader } from "./contracts";
import { Store } from "./store";
import type { GuestAuth } from "./store";

export interface ProductOwner {
  ownerKey: string;
  userId: string | null;
  guestId: string | null;
  role: string;
  authSessionId?: string;
  guestAuth?: GuestAuth;
}
export const productEnvelope = <T>(request: RequestContext, data: T) => ({
  data,
  meta: metadata(request),
});
export const productInvalid = (messageAr = "راجع حقول الطلب."): ApiFault =>
  new ApiFault(422, "invalid_input", messageAr);
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw productInvalid();
  return value as Record<string, unknown>;
}
export function only(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw productInvalid("يتضمن الطلب حقولًا غير معروفة.");
}
export function textField(value: unknown, max = 2000, min = 1): string {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    value.includes("\0")
  )
    throw productInvalid();
  return value;
}
export function revisionField(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > 2147483647
  )
    throw productInvalid("رقم المراجعة مطلوب.");
  return Number(value);
}
/** Owner-scoped, fingerprinted, transactional idempotency, never a UUID permission. */
export async function productMutation<T>(
  store: Store,
  owner: ProductOwner,
  request: RequestContext,
  operation: string,
  body: unknown,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  authorizeReplay?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<T> {
  const key = idempotencyHeader(request.headers["idempotency-key"]);
  const digest = store.security.keyDigest(key);
  const fingerprint = store.security.fingerprint(body);
  return store.db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      if (owner.userId) {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT s.id FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=${owner.authSessionId ?? "00000000-0000-0000-0000-000000000000"}::uuid AND s.user_id=${owner.userId}::uuid AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active' AND u.role=${owner.role} FOR SHARE OF s,u`;
        if (rows.length !== 1)
          throw new ApiFault(401, "unauthenticated", "انتهت جلسة الحساب.");
      } else if (owner.guestAuth)
        await store.authorizeInTransaction(tx, owner.guestAuth);
      else throw new ApiFault(401, "unauthenticated", "ابدأ جلسة للمتابعة.");
      // Domain guards must protect cached responses too, including when release
      // mode or account provenance has changed since the original request.
      if (authorizeReplay) await authorizeReplay(tx);
      const [old] = await tx.$queryRaw<
        { fingerprint: string; response_cache: T }[]
      >`SELECT fingerprint,response_cache FROM product_mutations WHERE owner_key=${owner.ownerKey} AND operation=${operation} AND key_digest=${digest} AND expires_at>now()`;
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new ApiFault(
            409,
            "idempotency_conflict",
            "استُخدم مفتاح الإرسال مع طلب مختلف.",
          );
        return old.response_cache;
      }
      const result = await work(tx);
      const serialized = JSON.stringify(result);
      if (Buffer.byteLength(serialized) > 512000)
        throw productInvalid("النتيجة كبيرة؛ قلل عدد السجلات.");
      await tx.$executeRaw`DELETE FROM product_mutations WHERE owner_key=${owner.ownerKey} AND operation=${operation} AND key_digest=${digest} AND expires_at<=now()`;
      await tx.$executeRaw`INSERT INTO product_mutations(id,owner_key,operation,key_digest,fingerprint,response_cache,expires_at) VALUES(${randomUUID()}::uuid,${owner.ownerKey},${operation},${digest},${fingerprint},${serialized}::jsonb,now()+interval '24 hours')`;
      return result;
    },
    { maxWait: 5000, timeout: 15000 },
  );
}
