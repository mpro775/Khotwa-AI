import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { parsePayload, publicItem } = require("../dist/content-payload.js");
const { ContentStudioService } = require("../dist/content-studio.js");
const { materializeStudioDiagnosis } = require("../dist/studio-diagnosis.js");
const {
  Judge0Runner,
  evaluateProgram,
  sourceForTest,
} = require("../dist/programming-runner.js");
const base = () => ({
  titleAr: "جمع عددين",
  statementAr: "اقرأ عددين واطبع المجموع.",
  subject: "programming",
  unitCode: "python_basics",
  unitTitleAr: "أساسيات بايثون",
  lessonCode: "arithmetic",
  lessonTitleAr: "الحساب",
  skillCodes: ["PY_ARITHMETIC"],
  difficulty: 1,
  kind: "main",
  familyCode: "PY_SUM",
  hints: [
    {
      level: 1,
      textAr: "راجع العددين المدخلين.",
      source: "manual",
      reviewed: false,
    },
  ],
  programming: {
    starterCode: "",
    referenceCode: "a,b=map(int,input().split());print(a+b)",
    tests: [
      { input: "2 3", expectedOutput: "5", hidden: false },
      { input: "918 729", expectedOutput: "1647", hidden: true },
    ],
  },
});
test("new content reuses only reviewed catalog snapshots and preserves their reviewer evidence", async () => {
  const at = new Date("2026-11-06T00:00:00Z"),
    writes = [];
  const replies = [
    [{ id: "source-release" }],
    [
      {
        error_code: "ERR-ALG-01",
        catalog_version: "reviewed-v1",
        reviewed_by_role: "reviewer-source",
        reviewed_at: at,
      },
    ],
    [
      {
        family: "distribution",
        template_version: "reviewed-v1",
        question_ar: "ما خاصية التوزيع؟",
        options_json: [{ id: "a" }, { id: "b" }],
        rules_json: { a: "supported", b: "not_supported" },
        reviewed_by_role: "reviewer-source",
        reviewed_at: at,
      },
    ],
  ];
  await materializeStudioDiagnosis(
    {
      $queryRaw: async () => replies.shift(),
      $executeRaw: async (sql, ...values) => {
        writes.push({ sql: sql.join("?"), values });
        return 1;
      },
    },
    "new-release",
    "new-skill",
    "SK-ALG-04",
  );
  assert.equal(writes.length, 3);
  assert.ok(
    writes
      .slice(0, 2)
      .every(
        (w) => w.values.includes("reviewer-source") && w.values.includes(at),
      ),
  );
  assert.ok(writes.every((w) => w.sql.startsWith("INSERT")));
  assert.ok(
    writes
      .at(-1)
      .values.some(
        (v) =>
          typeof v === "string" &&
          v.includes('"sourceReleaseId":"source-release"'),
      ),
  );
});
test("absence of a reviewed source cannot manufacture a catalog or teacher approval", async () => {
  let writes = 0;
  await materializeStudioDiagnosis(
    {
      $queryRaw: async () => [],
      $executeRaw: async () => {
        writes++;
        return 1;
      },
    },
    "new-release",
    "new-skill",
    "SK-ALG-04",
  );
  assert.equal(writes, 0);
});
test("whole grading deadline bounds an unresponsive runner and cancels its signal", async () => {
  let received;
  const result = await evaluateProgram(
    {
      execute: (_source, _input, signal) => {
        received = signal;
        return new Promise(() => {});
      },
    },
    "print(1)",
    [{ input: "", expectedOutput: "1", hidden: false }],
    undefined,
    { timeoutMs: 10 },
  );
  assert.equal(result.status, "timeout");
  assert.equal(result.allPassed, false);
  assert.equal(received.aborted, true);
});
test("student content projection contains no hidden tests, reference code or physics answer", () => {
  const p = parsePayload(base()),
    publicView = publicItem("revision", "item", 1, p);
  assert.equal(publicView.programming.publicTests.length, 1);
  for (const hidden of ["referenceCode", "918", "1647", "hidden"])
    assert.equal(JSON.stringify(publicView).includes(hidden), false);
  const physics = JSON.parse(
    readFileSync("apps/api/data/physics-kinematics.draft.v1.json", "utf8"),
  )[0];
  const view = publicItem("revision", "item", 1, parsePayload(physics));
  for (const hidden of [
    "expectedValueSI",
    "expectedDimension",
    "expectedUnit",
    "tolerance",
    "formula",
    "hints",
  ])
    assert.equal(JSON.stringify(view).includes(hidden), false);
});
test("content importer parses every prepared draft without asserting review", () => {
  for (const filename of [
    "algebra-expansion.draft.v1.json",
    "physics-kinematics.draft.v1.json",
    "python-basics.draft.v1.json",
  ]) {
    const items = JSON.parse(readFileSync("apps/api/data/" + filename, "utf8"));
    for (const item of items) {
      const payload = parsePayload(item);
      assert.ok(payload.hints.every((h) => !h.reviewed));
    }
  }
});
test("content parser rejects unknown keys, mixed subjects, hidden flag spoofing and executable function names", () => {
  for (const payload of [
    { ...base(), role: "admin" },
    { ...base(), physics: {} },
    { ...base(), difficulty: "1" },
    {
      ...base(),
      programming: {
        ...base().programming,
        tests: [{ input: "", expectedOutput: "", hidden: "false" }],
      },
    },
    {
      ...base(),
      programming: { ...base().programming, functionName: "f);import os" },
    },
  ])
    assert.throws(
      () => parsePayload(payload),
      (e) => e.status === 422,
    );
});
test("publication checks reject incorrect algebra answers and unavailable isolated runner", async () => {
  const algebra = JSON.parse(
    readFileSync("apps/api/data/algebra-expansion.draft.v1.json", "utf8"),
  )[0];
  const math = {
    parse: async () => ({ parseStatus: "parsed" }),
    checkFinal: async () => ({
      status: "verified_invalid",
      isIsolated: true,
      substitutionValid: false,
    }),
    verify: async (_context, step) => ({
      status:
        step.toRaw === algebra.algebra.validStepRaw
          ? "verified_valid"
          : "verified_invalid",
    }),
  };
  const studio = new ContentStudioService({}, {}, math, {
    execute: async () => ({
      status: "service_error",
      stdout: "",
      stderr: "offline",
    }),
  });
  assert.equal(
    (await studio.validatePayload(parsePayload(algebra))).valid,
    false,
  );
  assert.equal(
    (await studio.validatePayload(parsePayload(base()))).valid,
    false,
  );
});
test("alternate source is accepted by case results, not by reference text comparison", async () => {
  const tests = base().programming.tests;
  const seen = [];
  const result = await evaluateProgram(
    {
      execute: async (source, input) => {
        seen.push(source);
        return {
          status: "succeeded",
          stdout:
            String(
              input
                .split(" ")
                .map(Number)
                .reduce((a, b) => a + b, 0),
            ) + "\n",
          stderr: "",
        };
      },
    },
    "left,right=map(int,input().split())\nprint(sum([left,right]))",
    tests,
  );
  assert.equal(result.allPassed, true);
  assert.equal(result.passed, 2);
  assert.ok(
    seen.every((source) => source !== base().programming.referenceCode),
  );
});
test("hidden case stdout and stderr never reach public result on failure", async () => {
  const tests = base().programming.tests;
  let n = 0;
  const result = await evaluateProgram(
    {
      execute: async () =>
        ++n === 1
          ? { status: "succeeded", stdout: "5", stderr: "" }
          : {
              status: "runtime_error",
              stdout: "SECRET_TEST_INPUT",
              stderr: "SECRET_TEST_TRACE",
            },
    },
    "candidate",
    tests,
  );
  assert.equal(result.allPassed, false);
  assert.equal(result.passed, 1);
  assert.equal(JSON.stringify(result).includes("SECRET_TEST"), false);
});
test("function harness sends arguments without serializing expected or hidden labels into source", () => {
  const testCase = {
    input: "[2,3]",
    expectedOutput: "SECRET_EXPECTED",
    hidden: true,
  };
  const wrapped = sourceForTest("def add(a,b):\n return a+b", testCase, "add");
  assert.equal(wrapped.input, "[2,3]");
  assert.equal(wrapped.source.includes("SECRET_EXPECTED"), false);
  assert.throws(() => sourceForTest("", testCase, "f);open('/tmp/x')"));
});
const settings = {
  enabled: true,
  isolationAttested: true,
  baseUrl: "http://runner:2358",
  token: "k".repeat(32),
  languageId: 71,
  timeoutMs: 1000,
  cpuSeconds: 2,
  memoryKiB: 131072,
  outputBytes: 65536,
};
test("sandbox adapter refuses unreviewed isolation and always requests explicit private limits", async () => {
  assert.throws(
    () => new Judge0Runner({ ...settings, isolationAttested: false }),
    /isolation/,
  );
  let submitted;
  const runner = new Judge0Runner(settings, async (_url, request) => {
    if (request.method === "POST") {
      submitted = JSON.parse(request.body);
      return Response.json({ token: "mock-token" });
    }
    return Response.json({
      status: { id: 3 },
      stdout: Buffer.from("safe\n").toString("base64"),
      stderr: null,
      compile_output: null,
    });
  });
  const result = await runner.execute("print('safe')", "");
  assert.equal(result.status, "succeeded");
  assert.equal(submitted.enable_network, false);
  assert.equal(submitted.max_processes_and_or_threads, 1);
  assert.equal(submitted.memory_limit, 131072);
  assert.equal(submitted.cpu_time_limit, 2);
  assert.equal("expected_output" in submitted, false);
});
test("runner response output limits and service failures fail closed", async () => {
  const transport = async (_url, request) =>
    request.method === "POST"
      ? Response.json({ token: "mock-token" })
      : Response.json({
          status: { id: 3 },
          stdout: Buffer.alloc(65537, 65).toString("base64"),
          stderr: null,
          compile_output: null,
        });
  assert.equal(
    (await new Judge0Runner(settings, transport).execute("candidate", ""))
      .status,
    "service_error",
  );
  assert.equal(
    (
      await new Judge0Runner({ ...settings, enabled: false }, async () => {
        throw new Error("must not call");
      }).execute("candidate", "")
    ).status,
    "service_error",
  );
});
