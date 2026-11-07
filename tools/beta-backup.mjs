import { spawn } from "node:child_process";
import { createCipheriv, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  appendFile,
  chmod,
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64");
if (key.length !== 32)
  throw Error("BACKUP_ENCRYPTION_KEY must decode to 32 bytes");
const database = new URL(process.env.BACKUP_DATABASE_URL ?? "");
const dbName = decodeURIComponent(database.pathname.slice(1));
if (
  !["postgres:", "postgresql:"].includes(database.protocol) ||
  !/^khotwa_beta(?:_[a-z0-9_]+)?$/.test(dbName)
)
  throw Error("A named Beta database is required");
const directory = resolve(
  process.env.BACKUP_DIRECTORY ?? ".local/beta-backups",
);
const maximum = Number(process.env.BACKUP_MAX_FILES ?? "7");
const hours = Number(
  process.argv
    .find((arg) => arg.startsWith("--interval-hours="))
    ?.split("=")[1] ?? "0",
);
if (
  !Number.isInteger(maximum) ||
  maximum < 1 ||
  maximum > 14 ||
  !Number.isInteger(hours) ||
  hours < 0 ||
  hours > 168
)
  throw Error("Invalid backup schedule or retention limit");
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const environment = {
  ...process.env,
  PGHOST: database.hostname,
  PGPORT: database.port || "5432",
  PGDATABASE: dbName,
  PGUSER: decodeURIComponent(database.username),
  PGPASSWORD: decodeURIComponent(database.password),
  PGSSLMODE:
    database.searchParams.get("sslmode") ??
    (["database", "localhost", "127.0.0.1", "::1"].includes(database.hostname)
      ? "disable"
      : "verify-full"),
};
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
  });
async function backup() {
  const name =
    "khotwa-beta-" +
    new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-") +
    ".dump.enc";
  const target = resolve(directory, name);
  if (!target.startsWith(directory + sep))
    throw Error("Invalid backup destination");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const output = createWriteStream(target, { flags: "wx", mode: 0o600 });
  output.write(Buffer.concat([Buffer.from("KHOTWA-BACKUP-V1\n"), iv]));
  const processHandle = spawn(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl"],
    {
      env: environment,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    },
  );
  const completed = new Promise((done, failed) => {
    processHandle.once("error", () => failed(Error("BACKUP_PROCESS_FAILED")));
    processHandle.once("exit", (code) =>
      code === 0 ? done() : failed(Error("BACKUP_DUMP_FAILED")),
    );
  });
  try {
    await Promise.all([
      pipeline(processHandle.stdout, cipher, output),
      completed,
    ]);
    await appendFile(target, cipher.getAuthTag());
    const details = await stat(target);
    const manifest = {
      at: new Date().toISOString(),
      file: name,
      encrypted: true,
      algorithm: "AES-256-GCM",
      bytes: details.size,
      restoreVerified: false,
    };
    await writeFile(
      resolve(directory, "last-backup.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { mode: 0o600 },
    );
    const entries = (await readdir(directory))
      .filter((entry) => /^khotwa-beta-[0-9TZ-]+\.dump\.enc$/.test(entry))
      .sort()
      .reverse();
    for (const entry of entries.slice(maximum)) {
      const previous = resolve(directory, entry);
      if (!previous.startsWith(directory + sep))
        throw Error("Invalid retention target");
      await unlink(previous);
    }
    console.log(
      JSON.stringify({
        event: "beta_backup_created",
        at: manifest.at,
        bytes: manifest.bytes,
        encrypted: true,
        restoreVerified: false,
      }),
    );
  } catch {
    processHandle.kill();
    await unlink(target).catch(() => {});
    throw Error("BETA_BACKUP_FAILED");
  }
}
do {
  try {
    await backup();
  } catch {
    console.error(JSON.stringify({ event: "beta_backup_failed" }));
    if (!hours) process.exitCode = 1;
  }
  if (!hours) break;
  const deadline = Date.now() + hours * 3600000;
  while (!stopping && Date.now() < deadline)
    await new Promise((done) =>
      setTimeout(done, Math.min(1000, deadline - Date.now())),
    );
} while (!stopping);
