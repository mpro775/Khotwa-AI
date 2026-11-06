import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  readFileSync("docs/contracts/math-internal-v1.schema.json"),
);
const fixtures = JSON.parse(
  readFileSync("qa-reports/ph03-contract-fixtures.json"),
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat("int32", {
  type: "number",
  validate: (n) => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647,
});
const validators = new Map();
function validate(name, value) {
  if (!validators.has(name))
    validators.set(
      name,
      ajv.compile({ $defs: schema.$defs, $ref: "#/$defs/" + name }),
    );
  const validator = validators.get(name);
  assert.equal(
    validator(value),
    true,
    name + ": " + JSON.stringify(validator.errors),
  );
}
for (const row of fixtures) {
  validate(row.requestSchema, row.request);
  validate(row.responseSchema, row.response);
}
const report = {
  phase: "PH-03",
  fixturePairsValidated: fixtures.length,
  schemasFromCanonical: true,
  httpChecks: [],
  gate1: "not_approved",
};
const allocate = createServer();
await new Promise((resolve, reject) => {
  allocate.once("error", reject);
  allocate.listen(0, "127.0.0.1", resolve);
});
const address = allocate.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise((resolve) => allocate.close(resolve));
const token = randomBytes(32).toString("hex");
const child = spawn(
  path.resolve(
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  ),
  ["-X", "utf8", "-m", "khotwa_math"],
  {
    env: {
      ...process.env,
      PYTHONPATH: path.resolve("services/math-engine/src"),
      MATH_ENGINE_HOST: "127.0.0.1",
      MATH_ENGINE_PORT: String(port),
      MATH_INTERNAL_TOKEN: token,
    },
    stdio: ["ignore", "ignore", "pipe"],
  },
);
let errors = "";
child.stderr.on("data", (b) => {
  errors += b.toString();
});
const base = "http://127.0.0.1:" + port;
const get = (route, auth = true) =>
  fetch(base + route, {
    headers: auth ? { authorization: "Bearer " + token } : {},
    signal: AbortSignal.timeout(3000),
  });
async function post(route, body, { auth = true, headers = {} } = {}) {
  return fetch(base + route, {
    method: "POST",
    body:
      typeof body === "string" || body instanceof Uint8Array
        ? body
        : JSON.stringify(body),
    headers: {
      ...(auth ? { authorization: "Bearer " + token } : {}),
      "content-type": "application/json",
      ...headers,
    },
    signal: AbortSignal.timeout(4000),
  });
}
async function record(name, fn) {
  const detail = await fn();
  report.httpChecks.push({ name, passed: true, detail });
}
try {
  const until = Date.now() + 20000;
  let started = false;
  while (Date.now() < until) {
    try {
      if ((await get("/internal/health")).ok) {
        started = true;
        break;
      }
    } catch {
      /* bounded startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(started, "Private server startup failed: " + errors.slice(0, 500));
  await record("protected_health_and_versioned_ready_worker", async () => {
    assert.equal((await get("/internal/health", false)).status, 403);
    const response = await get("/internal/health");
    const data = await response.json();
    assert.equal(data.verificationImplemented, true);
    assert.equal(data.engineVersion, "0.3.0");
    assert.equal(data.workerReady, true);
    assert.equal(data.schemaVersion, "math-internal-v1");
    return data;
  });
  for (const [route, requestSchema, responseSchema] of [
    ["parse", "InternalMathParseRequest", "InternalMathParseResult"],
    [
      "verify-transition",
      "InternalMathTransitionRequest",
      "InternalMathTransitionResult",
    ],
    [
      "check-final",
      "InternalMathCheckFinalRequest",
      "InternalMathCheckFinalResult",
    ],
  ]) {
    const row = fixtures.find((f) => f.requestSchema === requestSchema);
    await record("http_" + route, async () => {
      assert.equal(
        (await post("/internal/v1/math/" + route, row.request, { auth: false }))
          .status,
        403,
      );
      const response = await post("/internal/v1/math/" + route, row.request);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      const data = await response.json();
      validate(responseSchema, data);
      assert.equal(data.requestId, row.request.requestId);
      if (route === "verify-transition")
        assert.equal(data.attemptRevision, row.request.context.attemptRevision);
      else assert.deepEqual(data.context, row.request.context);
      return { status: data.status ?? data.parseStatus, requestIdEchoed: true };
    });
  }
  const parseRow = fixtures.find(
    (f) => f.requestSchema === "InternalMathParseRequest",
  );
  const valid = parseRow.request;
  const route = "/internal/v1/math/parse";
  for (const [name, body, expected] of [
    [
      "unknown_wire_version",
      { ...valid, schemaVersion: "math-internal-v99" },
      400,
    ],
    ["untrusted_client_ast", { ...valid, ast: {} }, 400],
    [
      "client_resource_override",
      { ...valid, limits: { timeout: 999999 } },
      400,
    ],
    ["invalid_uuid", { ...valid, requestId: "not-uuid" }, 400],
    [
      "boolean_revision",
      { ...valid, context: { ...valid.context, attemptRevision: true } },
      400,
    ],
    ["input_over_contract_length", { ...valid, raw: "س".repeat(257) }, 400],
    ["body_over_transport_budget", " ".repeat(8193), 413],
    ["invalid_json", "{", 400],
    ["invalid_utf8", new Uint8Array([0xff, 0xfe]), 400],
    ["deep_json", "[".repeat(1100) + "0" + "]".repeat(1100), 400],
    [
      "duplicate_keys",
      JSON.stringify(valid).slice(0, -1) + ',"raw":"س=٣"}',
      400,
    ],
  ])
    await record(name, async () => {
      const response = await post(route, body);
      assert.equal(response.status, expected);
      const data = await response.json();
      assert.equal(typeof data.error, "string");
      assert.doesNotMatch(
        JSON.stringify(data),
        /Traceback|stack|\.py:|synthetic-secret/,
      );
      return { httpStatus: response.status, error: data.error };
    });
  await record("student_cookie_not_forwarded_to_math", async () => {
    assert.equal(
      (await post(route, valid, { headers: { cookie: "kh_guest=synthetic" } }))
        .status,
      400,
    );
    return true;
  });
  await record("json_content_type_required", async () => {
    assert.equal(
      (await post(route, valid, { headers: { "content-type": "text/plain" } }))
        .status,
      415,
    );
    return true;
  });
  await record("unknown_private_route_rejected", async () => {
    assert.equal((await post("/internal/v99/math/parse", valid)).status, 404);
    return true;
  });
  await record("math_scope_error_is_200_typed_abstention", async () => {
    const response = await post(route, { ...valid, raw: "س/س=١" });
    assert.equal(response.status, 200);
    const data = await response.json();
    validate("InternalMathParseResult", data);
    assert.equal(data.parseStatus, "unsupported");
    assert.equal(data.reasonCode, "VARIABLE_DENOMINATOR");
    assert.equal(data.ast, null);
    return { status: data.parseStatus, reasonCode: data.reasonCode };
  });
  await record("escaped_surrogate_is_safe_typed_syntax_error", async () => {
    const response = await post(route, { ...valid, raw: "\ud800=٢" });
    assert.equal(response.status, 200);
    const data = await response.json();
    validate("InternalMathParseResult", data);
    assert.equal(data.parseStatus, "syntax_error");
    assert.equal(data.reasonCode, "UNSAFE_CONTROL_CHARACTER");
    assert.equal((await get("/internal/health")).status, 200);
    return { status: data.parseStatus, workerStillReady: true };
  });
  assert.equal(errors, "", "Unexpected server diagnostic output");
  report.recordedAtRiyadh = new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Riyadh",
  });
  report.passed = report.httpChecks.length;
  report.failed = 0;
  writeFileSync(
    "qa-reports/ph03-contract-results.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "Internal contract: " +
      fixtures.length +
      " schema pairs and " +
      report.passed +
      " HTTP checks passed; no public backend routes added.",
  );
} finally {
  child.kill();
}
