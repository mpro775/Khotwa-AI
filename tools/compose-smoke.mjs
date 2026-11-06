import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const base = ["compose", "--env-file", ".local/compose.env"];
function docker(args) {
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error("Docker command failed: " + r.stderr);
  return r.stdout.trim();
}
const checks = [];
const record = (name, fn) => {
  const detail = fn();
  checks.push({ name, passed: true, detail });
};
const config = JSON.parse(docker([...base, "config", "--format", "json"]));
record("only_loopback_web_port_published", () => {
  for (const n of ["api", "math-engine", "database"])
    assert.equal(config.services[n].ports, undefined);
  assert.equal(config.services.web.ports[0].host_ip, "127.0.0.1");
  return true;
});
record("private_internal_backend_network", () => {
  assert.equal(config.networks.backend.internal, true);
  return true;
});
const ids = {};
for (const name of ["web", "api", "math-engine", "database"])
  ids[name] = docker([...base, "ps", "-q", name]);
for (const name of ["api", "math-engine", "database"])
  record(name + "_no_host_port", () => {
    const obj = JSON.parse(docker(["inspect", ids[name]]))[0];
    assert.ok(
      Object.values(obj.NetworkSettings.Ports ?? {}).every((v) => v === null),
    );
    return {
      imageId: obj.Image,
      user: obj.Config.User,
      health: obj.State.Health?.Status,
    };
  });
record("backend_network_runtime_internal", () => {
  const name = config.networks.backend.name;
  const net = JSON.parse(docker(["network", "inspect", name]))[0];
  assert.equal(net.Internal, true);
  return true;
});
const result = JSON.parse(
  docker([
    ...base,
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    "(async()=>{const h={authorization:'Bearer '+process.env.INTERNAL_HEALTH_TOKEN};const r=await fetch('http://127.0.0.1:3000/internal/health/ready',{headers:h});const body=await r.json();const denied=await fetch('http://127.0.0.1:3000/internal/health/live');const math=await fetch(process.env.MATH_ENGINE_BASE_URL+'/internal/health',{headers:{authorization:'Bearer '+process.env.MATH_INTERNAL_TOKEN}});console.log(JSON.stringify({status:r.status,body,deniedStatus:denied.status,math:await math.json(),node:process.version}))})().catch(()=>process.exit(1))",
  ]),
);
record("real_postgresql_and_math_readiness", () => {
  assert.equal(result.status, 200);
  assert.equal(result.body.data.status, "ok");
  assert.ok(result.body.data.dependencies.every((d) => d.state === "ok"));
  return result.body.data.dependencies;
});
record("internal_health_requires_token", () => {
  assert.equal(result.deniedStatus, 403);
  return true;
});
record("python_math_worker_is_versioned_and_ready", () => {
  assert.equal(result.math.verificationImplemented, true);
  assert.equal(result.math.engineVersion, "0.3.0");
  assert.equal(result.math.workerReady, true);
  assert.equal(result.math.sympyVersion, "1.14.0");
  return true;
});
const tables = docker([
  ...base,
  "exec",
  "-T",
  "database",
  "psql",
  "-U",
  "khotwa_dev",
  "-d",
  "khotwa_dev",
  "-Atc",
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
]);
record("no_domain_tables_or_migrations_applied", () => {
  assert.equal(tables, "0");
  return true;
});
const web = await fetch("http://127.0.0.1:8080/");
assert.equal(web.status, 200);
const html = await web.text();
assert.match(html, /lang="ar"/);
assert.match(html, /dir="rtl"/);
checks.push({ name: "web_document_reachable_arabic_rtl", passed: true });
const internal = await fetch("http://127.0.0.1:8080/internal/health/live");
assert.equal(internal.status, 403);
checks.push({ name: "public_proxy_denies_internal_health", passed: true });
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  const asset = await fetch("http://127.0.0.1:8080" + match[1]);
  assert.equal(asset.status, 200);
  checks.push({ name: "built_asset_http_200", passed: true, path: match[1] });
}
const report = {
  phase: "PH-03-foundation-regression",
  recordedAtRiyadh: new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Riyadh",
  }),
  checks,
  passed: checks.length,
  failed: 0,
  nodeInContainer: result.node,
  postgresVersion: docker([
    ...base,
    "exec",
    "-T",
    "database",
    "psql",
    "-U",
    "khotwa_dev",
    "-d",
    "khotwa_dev",
    "-Atc",
    "SHOW server_version",
  ]),
  scope:
    "Foundation container health/readiness/network smoke only; no editor/parser/tutoring/runtime security acceptance",
  privateSyntheticOnly: true,
  publicUrl: "http://127.0.0.1:8080",
};
writeFileSync(
  "qa-reports/ph03-compose-checks.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  "Compose smoke: " +
    checks.length +
    " checks passed; real DB/math readiness and loopback-only web; no migrations.",
);
