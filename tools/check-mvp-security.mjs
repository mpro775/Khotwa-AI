import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
const metadata = JSON.parse(readFileSync(".local/mvp-local.json", "utf8"));
const env = Object.fromEntries(
  readFileSync(metadata.envFile, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const secrets = Object.entries(env)
  .filter(
    ([k, v]) => /KEY|PASSWORD|TOKEN|DATABASE_URL/.test(k) && v.length >= 24,
  )
  .map(([, v]) => v);
const names = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8", maxBuffer: 12000000 },
)
  .stdout.split("\0")
  .filter(Boolean);
const bundle = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else bundle.push(file);
  }
}
walk("apps/web/dist");
const leaks = [];
for (const file of [...names, ...bundle]) {
  if (
    !/\.(?:ts|tsx|mjs|cjs|json|md|ya?ml|log|html|css|py|sql|pem|txt)$/.test(
      file,
    )
  )
    continue;
  const text = readFileSync(file, "utf8");
  if (
    secrets.some((secret) => text.includes(secret)) ||
    /AIza[0-9A-Za-z_-]{35}/.test(text)
  )
    leaks.push(file);
}
const r = spawnSync(
  "docker",
  [
    "compose",
    "-f",
    "compose.mvp.yaml",
    "--env-file",
    metadata.envFile,
    "ps",
    "-a",
    "-q",
  ],
  { encoding: "utf8" },
);
if (r.status !== 0) throw Error("DEMO_CONTAINER_INVENTORY_FAILED");
const containers = [];
for (const id of r.stdout.trim().split(/\r?\n/).filter(Boolean)) {
  const data = JSON.parse(
    spawnSync("docker", ["inspect", id], { encoding: "utf8" }).stdout,
  )[0];
  const service = data.Config.Labels["com.docker.compose.service"],
    ports = data.HostConfig.PortBindings ?? {};
  containers.push({
    service,
    ports,
    networks: Object.keys(data.NetworkSettings.Networks),
  });
  if (service !== "web" && Object.keys(ports).length)
    throw Error("PRIVATE_SERVICE_PORT_EXPOSED");
  for (const values of Object.values(ports))
    for (const binding of values ?? [])
      if (binding.HostIp !== "127.0.0.1") throw Error("NON_LOOPBACK_DEMO_PORT");
}
const network = JSON.parse(
  spawnSync("docker", ["network", "inspect", metadata.prefix + "_backend"], {
    encoding: "utf8",
  }).stdout,
)[0];
const database = spawnSync(
  "docker",
  [
    "exec",
    metadata.prefix + "-db",
    "psql",
    "-U",
    "ph09",
    "-d",
    "ph09_test",
    "-t",
    "-A",
    "-c",
    "SELECT jsonb_build_object('problemRevisions',(SELECT count(*) FROM problem_revisions),'diagnosticTemplates',(SELECT count(*) FROM diagnostic_templates),'reviewedPairings',(SELECT count(*) FROM content_pairings WHERE review_status='reviewed'),'draftPairings',(SELECT count(*) FROM content_pairings WHERE review_status='draft'),'runtimeCanPurge',has_function_privilege('mvp_api','public.purge_expired_guests(boolean,integer)','EXECUTE'),'runtimeSuperuser',(SELECT rolsuper FROM pg_roles WHERE rolname='mvp_api'),'maintenanceCanPurge',has_function_privilege('mvp_maintenance','public.purge_expired_guests(boolean,integer)','EXECUTE'))",
  ],
  { encoding: "utf8" },
);
if (database.status !== 0) throw Error("DATABASE_PERMISSION_REVIEW_FAILED");
const databaseReview = JSON.parse(database.stdout.trim());
const report = {
  at: new Date().toISOString(),
  scan: "actual generated local secret values and Google-key pattern; no values recorded",
  filesScanned: names.length + bundle.length,
  leaks,
  containers,
  backendInternal: network.Internal,
  databaseReview,
  syntheticOnly: true,
  googleCallsThisClosure: 0,
  limitations: [
    "No claim of penetration test or production security certification",
    "Browser inspection unavailable; manual Chrome acceptance pending",
    "No backups of real guest data created or restored",
  ],
};
writeFileSync(
  "qa-reports/mvp-demo/security-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
if (
  leaks.length ||
  !network.Internal ||
  databaseReview.runtimeCanPurge ||
  databaseReview.runtimeSuperuser ||
  !databaseReview.maintenanceCanPurge
)
  process.exitCode = 1;
console.log(
  JSON.stringify({
    secretLeaks: leaks.length,
    backendInternal: network.Internal,
    services: containers.length,
  }),
);
