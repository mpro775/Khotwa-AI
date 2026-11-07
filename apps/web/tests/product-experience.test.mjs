import assert from "node:assert/strict";
import test from "node:test";
import Module, { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { indentCode, continueCodeLine } from "../src/code-editor-model.ts";
import { clearLearningStorage } from "../src/product-session.ts";
import { pollExecution } from "../src/programming-poll.ts";

// Transpile only trusted repository modules; every transport below is mocked.
const cache = new Map();
function trustedModule(file) {
  if (cache.has(file)) return cache.get(file);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const mod = new Module(file);
  cache.set(file, mod.exports);
  const require = createRequire(file);
  mod.require = (name) =>
    name.startsWith(".") && existsSync(resolve(dirname(file), name + ".ts"))
      ? trustedModule(resolve(dirname(file), name + ".ts"))
      : require(name);
  mod._compile(compiled.outputText, file);
  cache.set(file, mod.exports);
  return mod.exports;
}
const {
  ProductApi,
  ProductFault,
  identityData,
  record,
  textField,
  publicItem,
} = trustedModule(
  fileURLToPath(new URL("../src/product-api.ts", import.meta.url)),
);
const response = (data, status = 200) =>
  new Response(JSON.stringify({ data, meta: { requestId: "test" } }), {
    status,
    headers: { "content-type": "application/json" },
  });

test("DEV-072: Tab inserts four spaces without changing surrounding Python or Arabic strings", () => {
  const raw = 'print("مرحبا")';
  assert.deepEqual(indentCode(raw, 0, 0), {
    raw: "    " + raw,
    start: 4,
    end: 4,
  });
  assert.equal(indentCode(raw, 6, 6).raw, 'print(    "مرحبا")');
});
test("DEV-072: selected lines indent and unindent while preserving final newline", () => {
  const raw = "a = 1\nb = 2\n";
  const next = indentCode(raw, 0, raw.length);
  assert.equal(next.raw, "    a = 1\n    b = 2\n");
  assert.equal(next.end, raw.length + 8);
  assert.equal(indentCode(next.raw, 0, next.raw.length, true).raw, raw);
});
test("DEV-072: Shift+Tab removes only leading spaces and keeps selection valid", () => {
  const next = indentCode("  print(1)", 1, 1, true);
  assert.equal(next.raw, "print(1)");
  assert.equal(next.start, 0);
  assert.ok(next.end >= next.start);
});
test("DEV-072: Enter after a Python block continues indentation; start-of-document newline is safe", () => {
  assert.deepEqual(continueCodeLine("    if x:", 9, 9), {
    raw: "    if x:\n        ",
    caret: 18,
  });
  assert.equal(continueCodeLine("\nprint(1)", 0, 0).raw, "\n\nprint(1)");
  assert.equal(indentCode("\nprint(1)", 0, 0).raw, "    \nprint(1)");
});
test("DEV-024/SEC: identity switch removes only previous learning resource IDs", () => {
  const values = new Map([
    ["khotwa-active-attempt", "id"],
    ["khotwa-episode:a", "id"],
    ["unrelated-preference", "keep"],
  ]);
  clearLearningStorage({
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
  });
  assert.deepEqual([...values], [["unrelated-preference", "keep"]]);
});
test("DEV-022: email login uses bootstrap CSRF while account writes use account CSRF", async () => {
  const sent = [];
  const api = new ProductApi(async (path, init) => {
    sent.push({ path, init });
    return path.endsWith("/me")
      ? response({
          user: {
            id: "u",
            email: "u@example.invalid",
            role: "student",
            status: "active",
          },
          csrfToken: "account-csrf",
          loginCsrfToken: "bootstrap-csrf",
          guestAvailable: true,
        })
      : response({ ok: "yes" });
  });
  await api.me();
  await api.request(
    "/auth/email/request",
    (value) => textField(record(value).ok),
    "POST",
    { email: "u@example.invalid" },
  );
  await api.request(
    "/me/claim-guest",
    (value) => textField(record(value).ok),
    "POST",
    { consent: true },
  );
  assert.equal(sent[1].init.headers["X-CSRF-Token"], "bootstrap-csrf");
  assert.equal(sent[2].init.headers["X-CSRF-Token"], "account-csrf");
  assert.equal(sent[2].init.credentials, "same-origin");
  assert.equal(sent[2].init.redirect, "error");
});
test("DEV-045: network retry reuses the idempotency key and preserves raw learner code", async () => {
  const sent = [];
  let offline = true;
  const api = new ProductApi(async (_path, init) => {
    sent.push(init);
    if (offline) throw new TypeError("offline");
    return response({ ok: "yes" });
  });
  const body = {
    sourceRaw: 'print("مرحبا")\n    # raw spacing',
    mode: "submit",
  };
  await assert.rejects(
    api.request(
      "/programming/attempts",
      (value) => textField(record(value).ok),
      "POST",
      body,
    ),
    (error) => error instanceof ProductFault && error.code === "network_error",
  );
  offline = false;
  await api.request(
    "/programming/attempts",
    (value) => textField(record(value).ok),
    "POST",
    body,
  );
  assert.equal(
    sent[0].headers["Idempotency-Key"],
    sent[1].headers["Idempotency-Key"],
  );
  assert.equal(JSON.parse(sent[1].body).sourceRaw, body.sourceRaw);
  assert.equal(body.sourceRaw, 'print("مرحبا")\n    # raw spacing');
});
test("DEV-045: malformed successful response never becomes a trusted result", async () => {
  const api = new ProductApi(async () =>
    response({ csrfToken: 42, guestAvailable: true, user: null }),
  );
  await assert.rejects(
    api.request("/me", identityData),
    (error) =>
      error instanceof ProductFault && error.code === "invalid_response",
  );
});
test("DEV-048/SEC: product client rejects nonlocal and protocol-relative routes", async () => {
  let called = false;
  const api = new ProductApi(async () => {
    called = true;
    return response({});
  });
  await assert.rejects(api.request("https://runner.invalid", record));
  await assert.rejects(api.request("//runner.invalid", record));
  assert.equal(called, false);
});
test("DEV-071: public programming decoder exposes only starter code and public tests", () => {
  const item = publicItem({
    id: "revision",
    itemId: "item",
    version: 1,
    subject: "programming",
    titleAr: "طباعة",
    statementAr: "اطبع العدد",
    unitCode: "python_basics",
    lessonCode: "print",
    skillCodes: ["print"],
    difficulty: 1,
    kind: "main",
    programming: {
      starterCode: "",
      publicTests: [{ input: "", expectedOutput: "1" }],
      referenceCode: "server-only",
      hiddenTests: ["server-only"],
    },
  });
  assert.equal("referenceCode" in item.programming, false);
  assert.equal("hiddenTests" in item.programming, false);
  assert.equal(item.programming.publicTests.length, 1);
});
test("DEV-073: pending polling reads the same result until terminal without new execution", async () => {
  const snapshots = [
      { status: "queued" },
      { status: "running" },
      { status: "succeeded" },
    ],
    seen = [];
  let calls = 0;
  const outcome = await pollExecution(
    async () => snapshots[calls++],
    new AbortController().signal,
    (value) => seen.push(value.status),
    0,
  );
  assert.equal(outcome, "finished");
  assert.equal(calls, 3);
  assert.deepEqual(seen, ["queued", "running", "succeeded"]);
});
test("DEV-073: aborting pending polling prevents another read and any late result adoption", async () => {
  const controller = new AbortController(),
    seen = [];
  let calls = 0;
  const outcome = await pollExecution(
    async () => {
      calls++;
      return { status: "running" };
    },
    controller.signal,
    (value) => {
      seen.push(value.status);
      controller.abort();
    },
    0,
  );
  assert.equal(outcome, "aborted");
  assert.equal(calls, 1);
  assert.deepEqual(seen, ["running"]);
});
test("DEV-073: failed pending-result read never becomes a successful execution", async () => {
  const seen = [];
  await assert.rejects(
    pollExecution(
      async () => {
        throw new Error("network_error");
      },
      new AbortController().signal,
      (value) => seen.push(value),
      0,
    ),
    /network_error/,
  );
  assert.deepEqual(seen, []);
});
