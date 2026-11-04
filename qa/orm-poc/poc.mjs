import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, "khotwa-ph04-poc-db");
assert.equal(url.pathname, "/ormpoc");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.href }),
});
const checks = [];
const record = (name) => checks.push({ name, passed: true });
try {
  const [version] =
    await db.$queryRaw`SELECT current_setting('server_version') AS version, current_database() AS database`;
  assert.match(version.version, /^17\.6/);
  assert.equal(version.database, "ormpoc");
  record("postgres_17_6_isolated_database");
  if (process.argv[2] === "replay") {
    assert.equal(await db.pocOwner.count(), 0);
    record("migration_replay_clean_tables");
  } else {
    const a = randomUUID(),
      b = randomUUID(),
      slot = randomUUID();
    await db.pocOwner.createMany({ data: [{ id: a }, { id: b }] });
    record("prisma_7_10_1_adapter_crud");
    await db.pocSlot.create({ data: { id: slot, ownerId: a, position: 1 } });
    await assert.rejects(
      db.pocSlot.create({
        data: { id: randomUUID(), ownerId: a, position: 1 },
      }),
    );
    record("partial_unique_active_position");
    await db.pocSlot.update({ where: { id: slot }, data: { active: false } });
    await db.pocSlot.create({
      data: { id: randomUUID(), ownerId: a, position: 1 },
    });
    record("partial_index_allows_inactive_history");
    await assert.rejects(
      db.pocVersion.create({
        data: {
          id: randomUUID(),
          ownerId: b,
          slotId: slot,
          version: 1,
          raw: "س=٢",
        },
      }),
    );
    record("composite_fk_rejects_cross_owner");
    await db.pocVersion.create({
      data: {
        id: randomUUID(),
        ownerId: a,
        slotId: slot,
        version: 1,
        raw: "٢(س + ٣) = ١٠",
      },
    });
    const row = await db.pocVersion.findFirst();
    assert.equal(row.raw, "٢(س + ٣) = ١٠");
    record("arabic_raw_round_trip");
    await assert.rejects(
      db.pocSlot.create({
        data: { id: randomUUID(), ownerId: a, position: 0 },
      }),
    );
    record("check_constraint");
    const cancelled = randomUUID();
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.pocOwner.create({ data: { id: cancelled } });
        throw new Error("synthetic rollback");
      }),
    );
    assert.equal(await db.pocOwner.count({ where: { id: cancelled } }), 0);
    record("interactive_transaction_rollback");
    const races = await Promise.all(
      [1, 2].map(() =>
        db.$transaction((tx) =>
          tx.pocSlot.updateMany({
            where: { id: slot, revision: 0n },
            data: { revision: { increment: 1n } },
          }),
        ),
      ),
    );
    assert.deepEqual(races.map((r) => r.count).sort(), [0, 1]);
    record("atomic_revision_race_one_winner");
    const keys = await Promise.all(
      [1, 2].map(() =>
        db.pocKey.createMany({
          data: [
            {
              id: randomUUID(),
              ownerId: a,
              operation: "create",
              digest: "synthetic-hash",
              fingerprint: "synthetic-fingerprint",
            },
          ],
          skipDuplicates: true,
        }),
      ),
    );
    assert.deepEqual(keys.map((r) => r.count).sort(), [0, 1]);
    record("idempotency_unique_race");
    await db.$transaction(async (tx) => {
      const rows =
        await tx.$queryRaw`SELECT id FROM poc_slots WHERE id=${slot}::uuid FOR UPDATE`;
      assert.equal(rows.length, 1);
    });
    record("row_lock_with_prisma_transaction");
    for (const table of [
      "poc_versions",
      "poc_keys",
      "poc_slots",
      "poc_owners",
    ]) {
      await db.$executeRawUnsafe("DROP TABLE " + table);
    }
    const missing =
      await db.$queryRaw`SELECT to_regclass('poc_slots')::text AS name`;
    assert.equal(missing[0].name, null);
    record("explicit_down_migration_isolated_poc_only");
  }
  console.log(
    "PH04_POC_RESULT " +
      JSON.stringify({
        prisma: "7.10.1",
        node: process.version,
        postgres: version.version,
        checks,
        passed: checks.length,
        scope: "isolated synthetic capability proof; not final ORM approval",
      }),
  );
} finally {
  await db.$disconnect();
}
