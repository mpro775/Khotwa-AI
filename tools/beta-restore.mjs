import { spawn } from "node:child_process";
import { createDecipheriv } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

const target = new URL(process.env.RESTORE_TEST_DATABASE_URL ?? "");
const dbName = decodeURIComponent(target.pathname.slice(1));
if (
  !/^khotwa_beta_restore_[a-z0-9_]+$/.test(dbName) ||
  !process.argv.includes("--confirm-test-only")
)
  throw Error(
    "Restore requires a named khotwa_beta_restore_* TEST database and --confirm-test-only",
  );
if (!["postgres:", "postgresql:"].includes(target.protocol))
  throw Error("PostgreSQL is required");
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64");
if (key.length !== 32)
  throw Error("BACKUP_ENCRYPTION_KEY must decode to 32 bytes");
const source = process.argv
  .find((arg) => arg.startsWith("--file="))
  ?.slice("--file=".length);
if (!source) throw Error("--file=encrypted-backup is required");
const file = resolve(source),
  information = await stat(file),
  headerSize = Buffer.byteLength("KHOTWA-BACKUP-V1\n") + 12;
if (information.size <= headerSize + 16)
  throw Error("Invalid encrypted backup");
const handle = await open(file, "r");
const header = Buffer.alloc(headerSize),
  tag = Buffer.alloc(16);
try {
  await handle.read(header, 0, header.length, 0);
  await handle.read(tag, 0, 16, information.size - 16);
} finally {
  await handle.close();
}
if (
  !header.subarray(0, headerSize - 12).equals(Buffer.from("KHOTWA-BACKUP-V1\n"))
)
  throw Error("Invalid backup format");
const decipher = createDecipheriv(
  "aes-256-gcm",
  key,
  header.subarray(headerSize - 12),
);
decipher.setAuthTag(tag);
// Verify the entire GCM tag before any plaintext reaches PostgreSQL. No
// decrypted dump is written to disk during this authentication pass.
await pipeline(
  createReadStream(file, { start: headerSize, end: information.size - 17 }),
  decipher,
  new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  }),
);
const restoreDecipher = createDecipheriv(
  "aes-256-gcm",
  key,
  header.subarray(headerSize - 12),
);
restoreDecipher.setAuthTag(tag);
const processHandle = spawn(
  "pg_restore",
  [
    "--dbname",
    dbName,
    "--no-owner",
    "--no-acl",
    "--exit-on-error",
    "--single-transaction",
  ],
  {
    env: {
      ...process.env,
      PGHOST: target.hostname,
      PGPORT: target.port || "5432",
      PGDATABASE: dbName,
      PGUSER: decodeURIComponent(target.username),
      PGPASSWORD: decodeURIComponent(target.password),
      PGSSLMODE:
        target.searchParams.get("sslmode") ??
        (["database", "localhost", "127.0.0.1", "::1"].includes(target.hostname)
          ? "disable"
          : "verify-full"),
    },
    stdio: ["pipe", "ignore", "ignore"],
    windowsHide: true,
  },
);
const completed = new Promise((done, failed) => {
  processHandle.once("error", () => failed(Error("RESTORE_PROCESS_FAILED")));
  processHandle.once("exit", (code) =>
    code === 0 ? done() : failed(Error("RESTORE_FAILED")),
  );
});
try {
  await Promise.all([
    pipeline(
      createReadStream(file, { start: headerSize, end: information.size - 17 }),
      restoreDecipher,
      processHandle.stdin,
    ),
    completed,
  ]);
  const result = {
    event: "beta_restore_completed_test_only",
    at: new Date().toISOString(),
    encrypted: true,
    deletionTombstonesReplayed: false,
    note: "Do not expose restored data until deletion requests and revocations have been replayed and acceptance checks pass.",
  };
  await mkdir(resolve(".local"), { recursive: true, mode: 0o700 });
  await writeFile(
    resolve(".local/beta-last-restore.json"),
    JSON.stringify(result, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(JSON.stringify(result));
} catch {
  processHandle.kill();
  console.error(JSON.stringify({ event: "beta_restore_failed_test_only" }));
  process.exitCode = 1;
}
