import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = "http://127.0.0.1:3000",
  cookies = new Map(),
  checks = [];
let csrf;
const request = async (path, method = "GET", body) => {
  const headers = { origin: process.env.PUBLIC_APP_ORIGIN };
  if (cookies.size)
    headers.cookie = [...cookies].map(([k, v]) => k + "=" + v).join("; ");
  if (method !== "GET")
    Object.assign(headers, {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      "idempotency-key": randomUUID(),
    });
  const r = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });
  for (const value of r.headers.getSetCookie()) {
    const [k, v] = value.split(";")[0].split("=");
    if (v) cookies.set(k, v);
    else cookies.delete(k);
  }
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text).data : null };
};
const until = Date.now() + 20000;
let bootstrap;
while (Date.now() < until) {
  try {
    bootstrap = await request("/api/v1/bootstrap");
    if (bootstrap.status === 200) break;
  } catch {
    /* bounded startup wait */
  }
  await new Promise((r) => setTimeout(r, 100));
}
assert.equal(bootstrap?.status, 200);
csrf = bootstrap.data.csrfToken;
checks.push("runtime_contract_files_readable");
const guest = await request("/api/v1/guest-sessions", "POST", {});
assert.equal(guest.status, 201);
csrf = guest.data.csrfToken;
assert.equal((await request("/api/v1/guest-sessions/current")).status, 200);
checks.push("production_prisma_client_and_guest_security");
const skills = await request("/api/v1/skills"),
  skill = skills.data.items.find((s) => s.availability === "available");
assert.ok(skill);
const catalog = await request("/api/v1/problems?skillId=" + skill.id),
  problem = catalog.data.items[0];
assert.ok(problem);
const detail = await request("/api/v1/problems/" + problem.id);
assert.equal(JSON.stringify(detail).includes("server-only-solution"), false);
checks.push("published_catalog_without_answers");
const learning = await request("/api/v1/learning-sessions", "POST", {});
assert.equal(learning.status, 201);
const attempt = await request("/api/v1/attempts", "POST", {
  learningSessionId: learning.data.id,
  source: { kind: "catalog", problemRevisionId: problem.revisionId },
});
assert.equal(attempt.status, 201);
checks.push("runtime_learning_and_attempt");
const path = "/api/v1/attempts/" + attempt.data.id;
const step = await request(path + "/steps", "POST", {
  expectedRevision: 0,
  position: 1,
  sourceRaw: "٢س = ٤",
  inputOrigin: "keyboard",
});
assert.equal(step.status, 201);
assert.equal(step.data.step.source.parseStatus, "not_checked");
const edit = await request(path + "/steps/" + step.data.step.id, "PUT", {
  expectedRevision: 1,
  sourceRaw: "س=٢",
  inputOrigin: "keyboard",
});
assert.equal(edit.status, 200);
assert.equal(edit.data.step.currentVersion, 2);
const removed = await request(path + "/steps/" + step.data.step.id, "DELETE", {
  expectedRevision: 2,
});
assert.equal(removed.status, 200);
assert.equal(removed.data.attemptRevision, 3);
checks.push("runtime_versioned_step_mutations");
assert.equal(
  (await request(path + "/verify", "POST", { expectedRevision: 3 })).status,
  404,
);
checks.push("no_ph05_orchestration");
assert.equal(process.getuid(), 1000);
checks.push("non_root_runtime");
console.log(
  "PH04_RUNTIME_RESULT " +
    JSON.stringify({
      passed: checks.length,
      checks,
      node: process.version,
      uid: process.getuid(),
      scope:
        "production image on isolated synthetic DB; local HTTP, no TLS/browser acceptance",
    }),
);
