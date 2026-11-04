import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const token = randomBytes(32).toString("hex");
const mathToken = randomBytes(32).toString("hex");
const port = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const value = s.address();
      if (!value || typeof value === "string")
        return reject(new Error("Port allocation failed"));
      s.close(() => resolve(value.port));
    });
  });
const apiPort = await port();
const mathPort = await port();
const python = path.resolve(
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const children = [];
let errors = "";
const spec = parse(readFileSync("docs/12-API-CONTRACT.yaml", "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat("int32", {
  type: "number",
  validate: (v) => Number.isInteger(v) && v >= -2147483648 && v <= 2147483647,
});
const validate = (name) =>
  ajv.compile({
    components: spec.components,
    $ref: "#/components/schemas/" + name,
  });
const health = validate("HealthEnvelope");
const error = validate("ErrorEnvelope");
function launch(executable, args, env) {
  const c = spawn(executable, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  c.stdout.on("data", () => {});
  c.stderr.on("data", (b) => {
    errors += b.toString();
  });
  children.push(c);
  return c;
}
async function get(url, bearer) {
  return fetch(url, {
    headers: bearer ? { authorization: "Bearer " + bearer } : {},
    signal: AbortSignal.timeout(1800),
  });
}
async function wait(url, bearer) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    try {
      const r = await get(url, bearer);
      if (r.ok) return;
    } catch {
      /* wait for startup */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Service startup timeout: " + errors.slice(0, 1200));
}
let checks = 0;
try {
  launch(python, ["-m", "khotwa_math"], {
    PYTHONPATH: path.resolve("services/math-engine/src"),
    MATH_ENGINE_HOST: "127.0.0.1",
    MATH_ENGINE_PORT: String(mathPort),
    MATH_INTERNAL_TOKEN: mathToken,
  });
  launch(process.execPath, ["apps/api/dist/main.js"], {
    HOST: "127.0.0.1",
    PORT: String(apiPort),
    INTERNAL_HEALTH_TOKEN: token,
    DATABASE_URL: "",
    MATH_ENGINE_BASE_URL: "http://127.0.0.1:" + mathPort,
    MATH_INTERNAL_TOKEN: mathToken,
  });
  const api = "http://127.0.0.1:" + apiPort;
  const math = "http://127.0.0.1:" + mathPort;
  await wait(math + "/internal/health", mathToken);
  await wait(api + "/internal/health/live", token);
  let r = await get(api + "/internal/health/live");
  assert.equal(r.status, 403);
  assert.equal(error(await r.json()), true);
  checks++;
  r = await get(api + "/internal/health/live", token);
  assert.equal(r.status, 200);
  const live = await r.json();
  assert.equal(health(live), true, JSON.stringify(health.errors));
  assert.equal(r.headers.get("x-request-id"), live.meta.requestId);
  assert.match(r.headers.get("cache-control"), /no-store/);
  checks++;
  r = await get(api + "/internal/health/ready", token);
  assert.equal(r.status, 503);
  const ready = await r.json();
  assert.equal(error(ready), true, JSON.stringify(error.errors));
  assert.equal(ready.error.retryable, true);
  checks++;
  r = await get(api + "/api/v1/bootstrap");
  assert.equal(r.status, 404);
  assert.equal(error(await r.json()), true);
  checks++;
  r = await get(math + "/internal/health");
  assert.equal(r.status, 403);
  checks++;
  r = await get(math + "/internal/health", mathToken);
  assert.equal(r.status, 200);
  const m = await r.json();
  assert.equal(m.verificationImplemented, false);
  assert.equal(m.sympyVersion, "1.14.0");
  checks++;
  r = await get(math + "/internal/health", "caf\u00e9");
  assert.equal(r.status, 403);
  checks++;
  console.log(
    "Native smoke: " +
      checks +
      " checks passed; protected health and truthful unavailable readiness; no business/math routes claimed.",
  );
} finally {
  for (const c of children) c.kill();
  await new Promise((r) => setTimeout(r, 300));
}
