import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { ProductOwner } from "./product-core";
import { productMutation, productInvalid } from "./product-core";
import { requireProductLearningAccess } from "./learning-access";
import { ApiFault, type RequestContext } from "./http";
import type { Store } from "./store";
import { idempotencyHeader } from "./contracts";

export type ARecordKind =
  | "decision"
  | "activity"
  | "review"
  | "tutor"
  | "goal"
  | "reflection"
  | "scaffold"
  | "lab"
  | "problem_session"
  | "project_run";
export interface ARecord<T> {
  id: string;
  owner_key: string;
  kind: ARecordKind;
  track_revision_id: string;
  parent_id: string | null;
  revision: number;
  data: T;
  created_at: Date;
  updated_at: Date;
}

export function requireAFeature(name: string): void {
  if (process.env[name] !== "true")
    throw new ApiFault(
      403,
      "forbidden",
      "هذه الميزة غير مفعّلة في البيئة الحالية.",
    );
}

async function authorizeA(
  store: Store,
  owner: ProductOwner,
  tx: Prisma.TransactionClient,
) {
  // A is a synthetic release only; the existing real-learning flag cannot enable it.
  if (!store.syntheticData)
    throw new ApiFault(
      403,
      "forbidden",
      "برنامج التعلم الذكي متاح للتجربة الاصطناعية فقط.",
    );
  if (owner.guestAuth) await store.authorizeInTransaction(tx, owner.guestAuth);
  if (owner.userId) {
    const [account] = await tx.$queryRaw<
      { is_internal: boolean }[]
    >`SELECT is_internal FROM users WHERE id=${owner.userId}::uuid FOR SHARE`;
    if (!account?.is_internal)
      throw new ApiFault(
        403,
        "forbidden",
        "أنشطة A وB وC مخصصة لهويات الاختبار الاصطناعية فقط.",
      );
  }
  await requireProductLearningAccess(tx, owner, store.syntheticData);
}

export function aRead<T>(
  store: Store,
  owner: ProductOwner,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return store.db.$transaction(async (tx) => {
    await authorizeA(store, owner, tx);
    return work(tx);
  });
}

export function aMutation<T>(
  store: Store,
  owner: ProductOwner,
  request: RequestContext,
  operation: string,
  body: unknown,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return productMutation(
    store,
    owner,
    request,
    "intelligent-a:" + operation,
    body,
    async (tx) => {
      await authorizeA(store, owner, tx);
      return work(tx);
    },
    (tx) => authorizeA(store, owner, tx),
  );
}

/** Replay before orchestration performs any native side effect. The write still
 * uses productMutation; this read never allocates or completes a pending job. */
export function aReplay<T>(
  store: Store,
  owner: ProductOwner,
  request: RequestContext,
  operation: string,
  body: unknown,
): Promise<T | null> {
  const key = idempotencyHeader(request.headers["idempotency-key"]);
  const digest = store.security.keyDigest(key);
  const fingerprint = store.security.fingerprint(body);
  return aRead(store, owner, async (tx) => {
    const [row] = await tx.$queryRaw<
      { fingerprint: string; response_cache: T }[]
    >`SELECT fingerprint,response_cache FROM product_mutations WHERE owner_key=${owner.ownerKey} AND operation=${"intelligent-a:" + operation} AND key_digest=${digest} AND expires_at>now()`;
    if (!row) return null;
    if (row.fingerprint !== fingerprint)
      throw new ApiFault(
        409,
        "idempotency_conflict",
        "استُخدم مفتاح الإرسال مع طلب مختلف.",
      );
    return row.response_cache;
  });
}

/** Versioned state with an append-only history. All lookups include owner_key. */
export class ARecords {
  constructor(
    readonly tx: Prisma.TransactionClient,
    readonly ownerKey: string,
  ) {}
  async get<T>(id: string, kind: ARecordKind): Promise<ARecord<T>> {
    const [row] = await this.tx.$queryRaw<
      ARecord<T>[]
    >`SELECT * FROM intelligent_learning_records WHERE id=${id}::uuid AND owner_key=${this.ownerKey} AND kind=${kind}`;
    if (!row) throw new ApiFault(404, "not_found", "المورد غير متاح.");
    return row;
  }
  list<T>(kind: ARecordKind, trackRevisionId?: string): Promise<ARecord<T>[]> {
    return trackRevisionId
      ? this.tx.$queryRaw<
          ARecord<T>[]
        >`SELECT * FROM intelligent_learning_records WHERE owner_key=${this.ownerKey} AND kind=${kind} AND track_revision_id=${trackRevisionId}::uuid ORDER BY created_at,id LIMIT 500`
      : this.tx.$queryRaw<
          ARecord<T>[]
        >`SELECT * FROM intelligent_learning_records WHERE owner_key=${this.ownerKey} AND kind=${kind} ORDER BY created_at,id LIMIT 500`;
  }
  async create<T>(
    kind: ARecordKind,
    trackRevisionId: string,
    data: T,
    parentId: string | null = null,
  ): Promise<ARecord<T>> {
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > 65536)
      throw productInvalid("بيانات النشاط أكبر من الحد المسموح.");
    const id = randomUUID();
    const [row] = await this.tx.$queryRaw<
      ARecord<T>[]
    >`INSERT INTO intelligent_learning_records(id,owner_key,kind,track_revision_id,parent_id,data) VALUES(${id}::uuid,${this.ownerKey},${kind},${trackRevisionId}::uuid,${parentId}::uuid,${json}::jsonb) RETURNING *`;
    if (!row) throw new Error("A record insert failed");
    await this.event(row);
    return row;
  }
  async update<T>(
    id: string,
    kind: ARecordKind,
    expectedRevision: number,
    data: T,
  ): Promise<ARecord<T>> {
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > 65536)
      throw productInvalid("بيانات النشاط أكبر من الحد المسموح.");
    const current = await this.get<T>(id, kind);
    const [row] = await this.tx.$queryRaw<
      ARecord<T>[]
    >`UPDATE intelligent_learning_records SET data=${json}::jsonb,revision=revision+1,updated_at=now() WHERE id=${id}::uuid AND owner_key=${this.ownerKey} AND kind=${kind} AND revision=${expectedRevision} RETURNING *`;
    if (!row)
      throw new ApiFault(
        409,
        "revision_conflict",
        "تغير النشاط؛ حدّثه ثم أعد المحاولة.",
        [],
        current.revision,
      );
    await this.event(row);
    return row;
  }
  private async event<T>(row: ARecord<T>) {
    await this.tx
      .$executeRaw`INSERT INTO intelligent_learning_events(id,record_id,owner_key,revision,data) VALUES(${randomUUID()}::uuid,${row.id}::uuid,${this.ownerKey},${row.revision},${JSON.stringify(row.data)}::jsonb)`;
  }
}
