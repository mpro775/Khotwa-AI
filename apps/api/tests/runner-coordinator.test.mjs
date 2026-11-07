import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { RunnerCoordinator } = require("../dist/runner-coordinator.js");
const {
  evaluateProgram,
  Judge0Runner,
} = require("../dist/programming-runner.js");
const { ContentStudioService } = require("../dist/content-studio.js");
const { ProgrammingService } = require("../dist/programming.js");
const { parsePayload } = require("../dist/content-payload.js");
const owner = (id = "one") => ({
  ownerKey: "user:" + id,
  userId: id,
  guestId: null,
  role: "teacher",
  authSessionId: id,
});
const request = (key = "same-request-000000000000") => ({
  headers: { "idempotency-key": key },
});
const fingerprint = (body) =>
  createHash("sha256").update(JSON.stringify(body)).digest("hex");

// A serialized, rollback-capable DB double. No PostgreSQL, Runner or network is
// started; real SQL constraints and multi-process races remain integration work.
function ledgerStore() {
  const store = {
    syntheticData: true,
    now: 1000000,
    activeTransactions: 0,
    state: { jobs: [], resourceRevision: 0 },
    security: { keyDigest: fingerprint, fingerprint },
  };
  let tail = Promise.resolve();
  const sql = (parts) => (Array.isArray(parts) ? parts.join("?") : parts.sql);
  const query = async (parts, ...values) => {
    if (!Array.isArray(parts)) values = parts.values;
    const q = sql(parts),
      jobs = store.state.jobs;
    if (q.includes("FROM auth_sessions")) return [{ id: "authorized" }];
    if (q.startsWith("SELECT u.is_internal"))
      return [{ is_internal: true, enabled: null, policy_version: null }];
    if (q.includes("FROM product_mutations")) return [];
    if (q.includes("SELECT id,fingerprint,state"))
      return jobs.filter(
        (j) =>
          j.owner_key === values[0] &&
          j.operation === values[1] &&
          j.key_digest === values[2] &&
          (j.expires_at > store.now ||
            ["running", "interrupted"].includes(j.state)),
      );
    if (q.includes("SELECT id FROM runner_work_requests"))
      return jobs.filter(
        (j) =>
          j.id === values[0] &&
          j.owner_key === values[1] &&
          j.lease_token === values[2] &&
          j.state === "running" &&
          j.lease_until > store.now,
      );
    if (q.includes("AS cases_minute")) {
      const all = jobs.filter(
          (j) =>
            j.reserved_runs > 0 &&
            (j.created_at > store.now - 86400000 ||
              ["running", "interrupted"].includes(j.state)),
        ),
        own = all.filter((j) => j.owner_key === values[0]);
      const recent = (ms) => own.filter((j) => j.created_at > store.now - ms);
      return [
        {
          minute: recent(60000).length,
          daily: recent(86400000).length,
          cases_minute: recent(60000).reduce((n, j) => n + j.reserved_runs, 0),
          cases_daily: recent(86400000).reduce(
            (n, j) => n + j.reserved_runs,
            0,
          ),
          owner_active: own.filter((j) =>
            ["running", "interrupted"].includes(j.state),
          ).length,
          global_active: all.filter((j) =>
            ["running", "interrupted"].includes(j.state),
          ).length,
        },
      ];
    }
    const extra = store.queryHook?.(q, values);
    if (extra !== undefined) return extra;
    throw new Error("Unexpected mocked query: " + q);
  };
  const execute = async (parts, ...v) => {
    const q = sql(parts);
    if (q.includes("pg_advisory_xact_lock")) return 1;
    if (q.startsWith("UPDATE runner_work_requests SET state='interrupted'")) {
      for (const job of store.state.jobs)
        if (job.state === "running" && job.lease_until <= store.now)
          Object.assign(job, {
            state: "interrupted",
            fault_cache: JSON.parse(v[0]),
          });
      return 1;
    }
    if (q.startsWith("DELETE FROM runner_work_requests")) {
      store.state.jobs = store.state.jobs.filter(
        (j) =>
          !(
            j.owner_key === v[0] &&
            j.operation === v[1] &&
            j.key_digest === v[2] &&
            j.expires_at <= store.now &&
            !["running", "interrupted"].includes(j.state)
          ),
      );
      return 1;
    }
    if (q.startsWith("INSERT INTO runner_work_requests")) {
      store.state.jobs.push({
        id: v[0],
        owner_key: v[1],
        operation: v[2],
        key_digest: v[3],
        fingerprint: v[4],
        state: "running",
        lease_token: v[5],
        lease_until: store.now + v[6] * 1000,
        reserved_runs: v[7],
        attempt_id: v[8],
        attempt_revision: v[9],
        response_cache: null,
        fault_cache: null,
        remote_tokens: [],
        created_at: store.now,
        expires_at: store.now + 86400000,
      });
      return 1;
    }
    if (q.startsWith("UPDATE runner_work_requests SET remote_tokens")) {
      const job = store.state.jobs.find(
        (j) =>
          j.id === v[1] &&
          j.owner_key === v[2] &&
          j.lease_token === v[3] &&
          j.state === "running" &&
          j.lease_until > store.now &&
          j.remote_tokens.length < j.reserved_runs,
      );
      if (!job) return 0;
      job.remote_tokens.push(...JSON.parse(v[0]));
      return 1;
    }
    if (q.startsWith("UPDATE runner_work_requests SET state=")) {
      const job = store.state.jobs.find(
        (j) =>
          j.id === v[2] &&
          j.lease_token === v[3] &&
          (!q.includes("AND state='running'") || j.state === "running"),
      );
      if (!job) return 0;
      Object.assign(job, {
        state: v[0],
        [q.includes("response_cache=") ? "response_cache" : "fault_cache"]:
          JSON.parse(v[1]),
      });
      return 1;
    }
    const extra = store.executeHook?.(q, v);
    if (extra !== undefined) return extra;
    if (q.startsWith("UPDATE subject_attempts")) return 1;
    throw new Error("Unexpected mocked mutation: " + q);
  };
  const tx = { $queryRaw: query, $executeRaw: execute };
  store.db = {
    ...tx,
    $transaction: async (work) => {
      let release;
      const previous = tail;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      const before = structuredClone(store.state);
      store.activeTransactions++;
      try {
        return await work(tx);
      } catch (e) {
        store.state = before;
        throw e;
      } finally {
        store.activeTransactions--;
        release();
      }
    },
  };
  return store;
}
function workFor(store, overrides = {}) {
  return {
    prepare: async () => ({
      snapshot: { revision: ++store.state.resourceRevision },
      runs: 2,
    }),
    execute: async (snapshot, execution) => {
      assert.equal(store.activeTransactions, 0);
      await execution.accepted("accepted-token");
      return snapshot;
    },
    finish: async (_tx, snapshot) => ({ revision: snapshot.revision }),
    ...overrides,
  };
}
const fault = (status, code) => (e) =>
  e.status === status && (code === undefined || e.code === code);

test("durable replay precedes revision validation and survives a new coordinator", async () => {
  const store = ledgerStore();
  let calls = 0;
  const work = workFor(store, {
    execute: async () => {
      calls++;
      assert.equal(store.activeTransactions, 0);
      return {};
    },
  });
  const result = await new RunnerCoordinator(store).run(
    owner(),
    request(),
    "studio.approve:item",
    { expectedRevision: 0 },
    work,
  );
  store.state.resourceRevision = 99;
  const replay = await new RunnerCoordinator(store).run(
    owner(),
    request(),
    "studio.approve:item",
    { expectedRevision: 0 },
    workFor(store, {
      prepare: async () => {
        throw new Error("Must not validate stale request revision on replay");
      },
    }),
  );
  assert.deepEqual(replay, result);
  assert.equal(calls, 1);
  assert.equal(store.state.resourceRevision, 99);
  await assert.rejects(
    new RunnerCoordinator(store).run(
      owner(),
      request(),
      "studio.approve:item",
      { expectedRevision: 1 },
      work,
    ),
    fault(409, "idempotency_conflict"),
  );
});
test("duplicate, owner and global reservations cannot dispatch concurrently", async () => {
  const store = ledgerStore();
  let release, started;
  const began = new Promise((r) => {
      started = r;
    }),
    done = new Promise((r) => {
      release = r;
    });
  process.env.RUNNER_GLOBAL_CONCURRENCY = "1";
  try {
    const first = new RunnerCoordinator(store).run(
      owner(),
      request(),
      "programming.submit",
      {},
      workFor(store, {
        execute: async () => {
          started();
          await done;
          return {};
        },
      }),
    );
    await began;
    await assert.rejects(
      new RunnerCoordinator(store).run(
        owner(),
        request(),
        "programming.submit",
        {},
        workFor(store),
      ),
      fault(409, "request_in_progress"),
    );
    await assert.rejects(
      new RunnerCoordinator(store).run(
        owner(),
        request("different-key-0000000000"),
        "studio.validate:item",
        {},
        workFor(store),
      ),
      fault(429),
    );
    await assert.rejects(
      new RunnerCoordinator(store).run(
        owner("other"),
        request(),
        "studio.validate:item",
        {},
        workFor(store),
      ),
      fault(429),
    );
    assert.equal(store.state.jobs.length, 1);
    assert.equal(store.state.resourceRevision, 1);
    release();
    await first;
  } finally {
    delete process.env.RUNNER_GLOBAL_CONCURRENCY;
  }
});
test("expired work is quarantined after restart; fresh keys cannot bypass it", async () => {
  const store = ledgerStore();
  let release,
    started,
    dispatched = 0;
  const began = new Promise((r) => {
      started = r;
    }),
    done = new Promise((r) => {
      release = r;
    });
  const first = new RunnerCoordinator(store).run(
    owner(),
    request(),
    "programming.submit",
    {},
    workFor(store, {
      execute: async () => {
        dispatched++;
        started();
        await done;
        return {};
      },
    }),
  );
  await began;
  store.now += 61000;
  await assert.rejects(
    new RunnerCoordinator(store).run(
      owner(),
      request(),
      "programming.submit",
      {},
      workFor(store),
    ),
    fault(503),
  );
  assert.equal(store.state.jobs[0].state, "interrupted");
  store.now += 2 * 86400000;
  await assert.rejects(
    new RunnerCoordinator(store).run(
      owner(),
      request("fresh-key-000000000000"),
      "studio.validate:item",
      {},
      workFor(store),
    ),
    fault(429),
  );
  release();
  await assert.rejects(first, fault(503));
  assert.equal(dispatched, 1);
  assert.equal(store.state.jobs[0].response_cache, null);
});
test("student and author work share request and reserved-case quotas", async () => {
  const store = ledgerStore();
  process.env.PROGRAMMING_RUNS_PER_MINUTE = "1";
  try {
    await new RunnerCoordinator(store).run(
      owner(),
      request(),
      "programming.submit",
      {},
      workFor(store),
    );
    assert.deepEqual(store.state.jobs[0].remote_tokens, ["accepted-token"]);
    await assert.rejects(
      new RunnerCoordinator(store).run(
        owner(),
        request("teacher-key-0000000000"),
        "studio.validate:item",
        {},
        workFor(store),
      ),
      fault(429),
    );
    assert.equal(store.state.jobs.length, 1);
  } finally {
    delete process.env.PROGRAMMING_RUNS_PER_MINUTE;
  }
  store.now += 61000;
  process.env.PROGRAMMING_CASES_PER_MINUTE = "1";
  try {
    await assert.rejects(
      new RunnerCoordinator(store).run(
        owner(),
        request("case-key-000000000000"),
        "studio.publish:item",
        {},
        workFor(store),
      ),
      fault(429),
    );
  } finally {
    delete process.env.PROGRAMMING_CASES_PER_MINUTE;
  }
});
test("ambiguous remote completion preserves its stable result and holds capacity", async () => {
  const store = ledgerStore();
  const work = workFor(store, { uncertain: () => true });
  const result = await new RunnerCoordinator(store).run(
    owner(),
    request(),
    "programming.submit",
    {},
    work,
  );
  assert.equal(store.state.jobs[0].state, "interrupted");
  assert.deepEqual(
    await new RunnerCoordinator(store).run(
      owner(),
      request(),
      "programming.submit",
      {},
      work,
    ),
    result,
  );
  await assert.rejects(
    new RunnerCoordinator(store).run(
      owner(),
      request(randomUUID()),
      "studio.validate:item",
      {},
      work,
    ),
    fault(429),
  );
});
test("teacher public/hidden outcomes contain no private inputs, answers or outputs", async () => {
  const tests = [
    { input: "public-input", expectedOutput: "yes", hidden: false },
    { input: "private-input", expectedOutput: "private-answer", hidden: true },
  ];
  const result = await evaluateProgram(
    {
      execute: async (_source, input) => ({
        status: "succeeded",
        stdout: input === "public-input" ? "yes" : "private-output",
        stderr: "",
      }),
    },
    "source",
    tests,
  );
  assert.deepEqual(result.validation.public, { passed: 1, total: 1 });
  assert.deepEqual(result.validation.hidden, { passed: 0, total: 1 });
  assert.deepEqual(
    result.validation.cases.map((c) => [c.visibility, c.passed, c.executed]),
    [
      ["public", true, true],
      ["hidden", false, true],
    ],
  );
  assert.equal(result.stdout, "yes");
  for (const secret of [
    "private-input",
    "private-answer",
    "private-output",
    "source",
  ])
    assert.ok(!JSON.stringify(result.validation).includes(secret));
});
test("teacher validation distinguishes skipped cases and continues known per-case errors", async () => {
  const tests = [false, true, true].map((hidden) => ({
    input: "",
    expectedOutput: "ok",
    hidden,
  }));
  let calls = 0;
  const result = await evaluateProgram(
    {
      execute: async () =>
        ++calls === 1
          ? { status: "runtime_error", stdout: "", stderr: "error" }
          : { status: "succeeded", stdout: "ok", stderr: "" },
    },
    "source",
    tests,
    undefined,
    { continueOnFailure: true },
  );
  assert.equal(calls, 3);
  assert.equal(result.allPassed, false);
  assert.equal(result.validation.hidden.passed, 2);
  const interrupted = await evaluateProgram(
    {
      execute: async () => ({
        status: "timeout",
        stdout: "",
        stderr: "",
        uncertain: true,
      }),
    },
    "source",
    tests,
    undefined,
    { continueOnFailure: true },
  );
  assert.deepEqual(
    interrupted.validation.cases.map((c) => c.executed),
    [true, false, false],
  );
});
test("Judge0 acceptance receipt is durably checkpointed before polling", async () => {
  const calls = [];
  const runner = new Judge0Runner(
    {
      enabled: true,
      isolationAttested: true,
      baseUrl: "http://private-runner/",
      token: "x".repeat(32),
      languageId: 71,
      timeoutMs: 1000,
      cpuSeconds: 1,
      memoryKiB: 16384,
      outputBytes: 1024,
    },
    async (_url, options) => {
      calls.push(options.method);
      return new Response(
        JSON.stringify(
          options.method === "POST"
            ? { token: "receipt-token" }
            : {
                status: { id: 3 },
                stdout: Buffer.from("ok").toString("base64"),
              },
        ),
        { headers: { "content-type": "application/json" } },
      );
    },
  );
  const result = await runner.execute(
    "source",
    "",
    undefined,
    async (token) => {
      assert.equal(token, "receipt-token");
      assert.deepEqual(calls, ["POST"]);
      calls.push("checkpoint");
    },
  );
  assert.deepEqual(calls, ["POST", "checkpoint", "GET"]);
  assert.equal(result.status, "succeeded");
});
test("a delayed dispatch gate cannot submit code after the whole grading deadline", async () => {
  let release,
    executions = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const evaluated = await evaluateProgram(
    {
      execute: async () => {
        executions++;
        return { status: "succeeded", stdout: "ok", stderr: "" };
      },
    },
    "source",
    [{ input: "", expectedOutput: "ok", hidden: false }],
    undefined,
    { timeoutMs: 5, beforeDispatch: () => gate },
  );
  assert.equal(evaluated.status, "timeout");
  assert.equal(evaluated.uncertain, true);
  assert.equal(executions, 0);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(executions, 0);
});

function studioFixture() {
  const store = ledgerStore(),
    payload = JSON.parse(
      readFileSync(
        new URL("../data/python-basics.draft.v1.json", import.meta.url),
        "utf8",
      ),
    )[0];
  const id = "00000000-0000-4000-8000-000000000001";
  store.state.studio = {
    id,
    item_id: "00000000-0000-4000-8000-000000000002",
    version: 1,
    edit_revision: 0,
    status: "draft",
    payload,
    content_hash: "original-hash",
    validation: null,
    created_at: new Date(),
    reviewed_at: null,
    published_at: null,
    reviewed_by: null,
  };
  store.queryHook = (q) => {
    if (q.includes("SELECT * FROM studio_revisions"))
      return [structuredClone(store.state.studio)];
    if (q.includes("SELECT id FROM studio_items"))
      return [{ id: store.state.studio.item_id }];
  };
  store.executeHook = (q, values) => {
    if (q.startsWith("UPDATE studio_revisions SET validation=")) {
      store.state.studio.validation = JSON.parse(values[0]);
      return 1;
    }
    if (q.startsWith("UPDATE studio_revisions SET status='in_review'")) {
      store.state.studio.status = "in_review";
      store.state.studio.edit_revision++;
      return 1;
    }
    if (q.startsWith("INSERT INTO studio_events")) return 1;
  };
  return { store, id, payload };
}
test("function test argument shape is rejected before any execution reservation", () => {
  const { payload } = studioFixture();
  payload.programming.functionName = "solve";
  payload.programming.tests = [
    { input: "not-json", expectedOutput: "0", hidden: false },
  ];
  assert.throws(() => parsePayload(payload), fault(422));
  payload.programming.tests[0].input = "{}";
  assert.throws(() => parsePayload(payload), fault(422));
  payload.programming.tests[0].input = JSON.stringify(Array(17).fill(1));
  assert.throws(() => parsePayload(payload), fault(422));
  payload.programming.tests[0].input = "[1,2]";
  assert.equal(parsePayload(payload).programming.tests[0].input, "[1,2]");
});
test("teacher validation endpoint persists public/hidden results and transition replay skips stale revision checks", async () => {
  const { store, id, payload } = studioFixture();
  let executions = 0;
  const studio = new ContentStudioService(
    store,
    { actor: async () => owner() },
    {},
    {
      execute: async (_source, input) => {
        assert.equal(store.activeTransactions, 0);
        executions++;
        return {
          status: "succeeded",
          stdout: payload.programming.tests.find((t) => t.input === input)
            .expectedOutput,
          stderr: "",
        };
      },
    },
  );
  const checked = await studio.validate(request(), id, { expectedRevision: 0 });
  assert.equal(checked.validation.valid, true);
  assert.equal(checked.validation.programming.public.passed, 1);
  assert.equal(checked.validation.programming.hidden.passed, 1);
  const sent = await studio.transition(request("submit-studio-000000000"), id, {
    expectedRevision: 0,
    action: "submit",
  });
  assert.equal(sent.status, "in_review");
  assert.equal(sent.editRevision, 1);
  assert.deepEqual(
    await studio.transition(request("submit-studio-000000000"), id, {
      expectedRevision: 0,
      action: "submit",
    }),
    sent,
  );
  assert.deepEqual(
    await studio.validate(request(), id, { expectedRevision: 0 }),
    checked,
  );
  assert.equal(executions, 2);
});
test("late teacher validation cannot overwrite edited content and its retry never reruns reference code", async () => {
  const { store, id } = studioFixture();
  let release,
    started,
    executions = 0;
  const began = new Promise((r) => {
      started = r;
    }),
    done = new Promise((r) => {
      release = r;
    });
  const studio = new ContentStudioService(
    store,
    { actor: async () => owner() },
    {},
    {
      execute: async () => {
        executions++;
        started();
        await done;
        return { status: "succeeded", stdout: "Hello", stderr: "" };
      },
    },
  );
  const pending = studio.validate(request(), id, { expectedRevision: 0 });
  await began;
  store.state.studio.edit_revision = 1;
  store.state.studio.content_hash = "new-hash";
  release();
  await assert.rejects(pending, fault(409, "revision_conflict"));
  assert.equal(store.state.studio.validation, null);
  await assert.rejects(
    studio.validate(request(), id, { expectedRevision: 0 }),
    fault(409, "revision_conflict"),
  );
  assert.equal(executions, 2);
});
test("student submit persists its raw code, projects no teacher details, and refuses stale cached results", async () => {
  const { store, id } = studioFixture();
  store.state.studio.status = "published";
  store.state.attempts = [];
  const studioQuery = store.queryHook,
    studioWrite = store.executeHook;
  store.queryHook = (q, v) => {
    if (q.includes("FROM subject_attempts WHERE id="))
      return store.state.attempts
        .filter((a) => a.id === v[0] && a.owner_key === v[1])
        .map((a) => structuredClone(a));
    if (q.includes("max(assistance_level)")) return [{ level: 0 }];
    return studioQuery(q, v);
  };
  store.executeHook = (q, v) => {
    if (q.startsWith("INSERT INTO subject_attempts")) {
      store.state.attempts.push({
        id: v[0],
        owner_key: v[1],
        problem_revision_id: v[2],
        revision: 0,
        source_raw: v[3],
        answer_json: JSON.parse(v[4]),
        verdict: JSON.parse(v[5]),
        assistance_level: v[6],
        independent: v[7],
        created_at: new Date(),
        updated_at: new Date(),
      });
      return 1;
    }
    if (q.startsWith("UPDATE subject_attempts SET verdict=")) {
      store.state.attempts.find((a) => a.id === v[1]).verdict = JSON.parse(
        v[0],
      );
      return 1;
    }
    if (q.startsWith("INSERT INTO subject_attempt_events")) return 1;
    return studioWrite(q, v);
  };
  let executions = 0;
  const programming = new ProgrammingService(
    store,
    { actor: async () => owner() },
    {
      execute: async () => {
        assert.equal(store.activeTransactions, 0);
        executions++;
        return { status: "succeeded", stdout: "Hello", stderr: "" };
      },
    },
  );
  const body = {
    problemRevisionId: id,
    sourceRaw: "print('Hello')\n# raw source",
    mode: "submit",
  };
  const result = await programming.submit(request(), body);
  assert.equal(result.allPassed, true);
  assert.equal(store.state.attempts[0].source_raw, body.sourceRaw);
  assert.equal("validation" in result, false);
  assert.equal("uncertain" in result, false);
  assert.equal("cases" in result, false);
  assert.deepEqual(await programming.submit(request(), body), result);
  store.state.attempts[0].revision++;
  await assert.rejects(
    programming.submit(request(), body),
    fault(409, "revision_conflict"),
  );
  assert.equal(executions, 2);
});
