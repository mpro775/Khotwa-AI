import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import pg from "pg";
import {
  seedIntegration,
  reference,
  mainEquation,
} from "../../../qa/ph05-fixtures.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
const require = createRequire(import.meta.url);
test(
  "PH-05 real NestJS PostgreSQL Python verification integration",
  { skip: process.env.PH05_INTEGRATION !== "true" },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL);
    assert.match(url.hostname, /^khotwa-ph05-[a-f0-9]{12}-db$/);
    assert.equal(url.pathname, "/ph05_test");
    const pool = new pg.Pool({ connectionString: url.href });
    const fixtures = await seedIntegration(pool);
    const { createApplication } = require("../dist/application.js"),
      { VerificationService } = require("../dist/verification.js"),
      { MathGateway } = require("../dist/math-gateway.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const service = app.get(VerificationService),
      gateway = service.math;
    const contracts = [],
      golden = [],
      runId = randomUUID(),
      a = createActor(await app.getUrl(), contracts),
      b = createActor(await app.getUrl(), contracts);
    const learning = await a.start();
    await b.start();
    async function attempt(equation = mainEquation) {
      const id = fixtures.byEquation.get(equation).revisionId;
      const r = await a.request("/attempts", "POST", {
        learningSessionId: learning.id,
        source: { kind: "catalog", problemRevisionId: id },
      });
      assert.equal(r.status, 201);
      return r.body.data;
    }
    async function step(attempt, raw) {
      const r = await a.request(`/attempts/${attempt.id}/steps`, "POST", {
        expectedRevision: attempt.revision,
        position: attempt.steps.length + 1,
        sourceRaw: raw,
        inputOrigin: "math_editor",
      });
      assert.equal(r.status, 201);
      return {
        ...attempt,
        revision: r.body.data.attemptRevision,
        steps: [...attempt.steps, r.body.data.step],
      };
    }
    const verify = (
      at,
      key = randomUUID(),
      scope = "current_sequence",
      targetStepId = null,
    ) =>
      a.request(
        `/attempts/${at.id}/verify`,
        "POST",
        { expectedRevision: at.revision, scope, targetStepId },
        key,
      );
    try {
      await t.test(
        "equivalent chain and isolated final answer complete only the pinned revision",
        async () => {
          let at = await attempt();
          for (const raw of ["٢س + ٦ = ١٠", "٢س = ٤", "س = ٢"])
            at = await step(at, raw);
          const key = randomUUID(),
            r = await verify(at, key);
          assert.equal(r.status, 200);
          assert.ok(
            r.body.data.transitions.every(
              (v) => v.mathStatus === "verified_valid",
            ),
          );
          assert.equal(r.body.data.completion.canMarkAttemptCompleted, true);
          assert.equal(r.body.data.diagnosisCandidate, null);
          const retry = await verify(at, key);
          assert.deepEqual(retry.body.data, r.body.data);
          assert.notEqual(retry.body.meta.requestId, r.body.meta.requestId);
          const current = await a.request("/attempts/" + at.id);
          assert.equal(current.body.data.status, "completed");
          assert.equal(
            current.body.data.currentVerification.id,
            r.body.data.id,
          );
          assert.equal(
            current.body.data.steps[0].source.displayAr,
            "٢س + ٦ = ١٠",
          );
          const saved = await pool.query(
            "SELECT v.source_raw,p.ast,p.normalized_text FROM step_versions v JOIN step_slots s ON s.id=v.step_slot_id JOIN parse_results p ON p.step_version_id=v.id WHERE s.attempt_id=$1 ORDER BY s.position",
            [at.id],
          );
          assert.equal(saved.rows[0].source_raw, "٢س + ٦ = ١٠");
          assert.equal(saved.rows[0].ast.sourceRaw, saved.rows[0].source_raw);
          assert.equal(saved.rows[0].ast.schemaVersion, "math-ast-v1");
          assert.notEqual(
            saved.rows[0].normalized_text,
            saved.rows[0].source_raw,
          );
          const result = r.body.data.transitions[0].verificationResultId;
          const detail = await a.request(
            `/attempts/${at.id}/verifications/${result.toUpperCase()}`,
          );
          assert.equal(detail.status, 200);
          assert.equal(detail.body.data.isCurrent, true);
          assert.equal(
            (await b.request(`/attempts/${at.id}/verifications/${result}`))
              .status,
            404,
          );
          assert.equal(
            (
              await b.request(`/attempts/${at.id}/verify`, "POST", {
                expectedRevision: at.revision,
                scope: "current_sequence",
                targetStepId: null,
              })
            ).status,
            404,
          );
          const wrong = await a.request(
            `/attempts/${at.id}/verify`,
            "POST",
            {
              expectedRevision: at.revision,
              scope: "target_edge",
              targetStepId: at.steps[0].id,
            },
            key,
          );
          assert.equal(wrong.body.error.code, "idempotency_conflict");
          const historyCount = await pool.query(
            "SELECT count(*)::int AS n FROM verification_reports WHERE attempt_id=$1",
            [at.id],
          );
          assert.equal(historyCount.rows[0].n, 1);
        },
      );
      await t.test(
        "a correct final answer cannot erase an earlier invalid edge",
        async () => {
          let at = await attempt();
          at = await step(at, "٢س + ٣ = ١٠");
          at = await step(at, "س = ٢");
          const r = await verify(at);
          assert.equal(r.status, 200);
          assert.equal(
            r.body.data.transitions[0].mathStatus,
            "verified_invalid",
          );
          assert.ok(r.body.data.transitions[0].evidence.witness);
          assert.equal(r.body.data.firstBlockingTransitionIndex, 0);
          assert.equal(r.body.data.completion.canMarkAttemptCompleted, false);
          const upper = await verify(
            at,
            randomUUID(),
            "target_edge",
            at.steps[0].id.toUpperCase(),
          );
          assert.equal(upper.status, 200);
          assert.equal(upper.body.data.transitions.length, 1);
          assert.equal(
            upper.body.data.transitions[0].to.stepId,
            at.steps[0].id,
          );
          assert.equal(r.body.data.diagnosisCandidate, null);
        },
      );
      await t.test(
        "target edge and a nonisolated equivalent equation cannot complete a sequence",
        async () => {
          let at = await attempt();
          at = await step(at, "٢س = ٤");
          let r = await verify(at);
          assert.equal(r.body.data.transitions[0].mathStatus, "verified_valid");
          assert.equal(r.body.data.completion.state, "not_complete");
          at = await step(at, "س = ٢");
          r = await verify(at, randomUUID(), "target_edge", at.steps[1].id);
          assert.equal(r.status, 200);
          assert.equal(r.body.data.transitions.length, 1);
          assert.equal(r.body.data.transitions[0].from.stepId, at.steps[0].id);
          assert.equal(r.body.data.completion.canMarkAttemptCompleted, false);
          assert.equal(
            (await a.request("/attempts/" + at.id)).body.data.status,
            "in_progress",
          );
        },
      );
      await t.test(
        "fresh inputs, reversed isolation and negative coefficients use real Python",
        async () => {
          for (const [original, steps] of [
            ["٤(س + ٢) = ٢٠", ["س + ٢ = ٥", "٣ = س"]],
            ["−٣(س − ٢) = ١٢", ["س − ٢ = −٤", "س = −٢"]],
          ]) {
            let at = await attempt(original);
            for (const raw of steps) at = await step(at, raw);
            const r = await verify(at);
            assert.equal(r.status, 200);
            assert.equal(r.body.data.completion.canMarkAttemptCompleted, true);
          }
        },
      );
      await t.test(
        "syntax, unsupported and resource abstention never become conceptual mistakes",
        async () => {
          for (const [raw, status] of [
            ["٢(س + ٣ = ١٠", "syntax_error"],
            ["جا(س) = ١", "unsupported"],
            ["(" + Array(70).fill("١").join(" + ") + ")س=٢", "inconclusive"],
          ]) {
            // The complexity case stays inside the public 256-codepoint envelope.
            const source =
              status === "inconclusive"
                ? "س=١" + ("/" + "٩".repeat(18)).repeat(5)
                : raw;
            let at = await attempt();
            at = await step(at, source);
            const r = await verify(at);
            assert.equal(r.status, 200);
            assert.equal(r.body.data.transitions[0].mathStatus, status);
            assert.equal(r.body.data.diagnosisCandidate, null);
            assert.equal(r.body.data.completion.canMarkAttemptCompleted, false);
            const saved = await a.request("/attempts/" + at.id);
            assert.equal(saved.body.data.steps[0].source.sourceRaw, source);
          }
        },
      );
      await t.test(
        "all 40 draft Golden parser cases pass through the saved NestJS/Python path",
        async () => {
          for (const c of reference.parse) {
            let at = await attempt();
            const source = c.raw.replace(/\[U\+(202E|2066)\]/g, (_, hex) =>
              String.fromCodePoint(parseInt(hex, 16)),
            );
            at = await step(at, source);
            const r = await verify(at);
            assert.equal(r.status, 200, c.id);
            const current = await a.request("/attempts/" + at.id);
            const actual = current.body.data.steps[0].source.parseStatus;
            assert.equal(
              actual,
              c.status === "accepted" ? "parsed" : c.status,
              c.id,
            );
            if (c.status !== "accepted")
              assert.equal(
                r.body.data.transitions[0].reasonCode,
                c.reason,
                c.id,
              );
            golden.push({
              id: c.id,
              scope: "public_saved_step_parse",
              expected: c.status === "accepted" ? "parsed" : c.status,
              actual,
              passed: true,
              reviewStatus: reference.review_status,
              sourceMapping:
                source === c.raw
                  ? "literal"
                  : "documented visible U+ marker replaced by its Unicode code point; sourceRecord unchanged",
            });
          }
        },
      );
      await t.test(
        "all 53 student-domain draft Golden transitions pass through real Python",
        async () => {
          for (const c of reference.math.filter((c) => c.kind === "student")) {
            let at = await attempt(c.before);
            at = await step(at, c.after);
            const r = await verify(at);
            assert.equal(r.status, 200, c.id);
            const actual = r.body.data.transitions[0].mathStatus;
            assert.equal(actual, c.status, c.id);
            if (actual === "verified_invalid")
              assert.ok(r.body.data.transitions[0].evidence.witness, c.id);
            golden.push({
              id: c.id,
              scope: "public_transition",
              expected: c.status,
              actual,
              passed: true,
              reviewStatus: reference.review_status,
            });
          }
        },
      );
      await t.test(
        "concurrent same-key retry, stale response, historical proof and reverify are safe",
        async () => {
          let at = await attempt();
          at = await step(at, "س = ٢");
          let release;
          const held = new Promise((r) => (release = r));
          let notify;
          const reached = new Promise((r) => (notify = r));
          const proxy = createServer(async (req, res) => {
            let body = "";
            for await (const chunk of req) body += chunk;
            const result = await fetch(
              new URL(req.url, gateway.settings.baseUrl),
              {
                method: req.method,
                headers: {
                  authorization: "Bearer " + gateway.settings.token,
                  "content-type": "application/json",
                },
                body: req.method === "GET" ? undefined : body,
              },
            );
            const text = await result.text();
            if (req.url.endsWith("/verify-transition")) {
              notify();
              await held;
            }
            res
              .writeHead(result.status, { "content-type": "application/json" })
              .end(text);
          });
          proxy.listen(0, "127.0.0.1");
          await once(proxy, "listening");
          service.math = new MathGateway({
            ...gateway.settings,
            baseUrl: "http://127.0.0.1:" + proxy.address().port,
            timeoutMs: 15000,
          });
          try {
            const key = randomUUID(),
              pending = verify(at, key);
            await reached;
            const retry = await verify(at, key);
            assert.equal(retry.status, 409);
            assert.equal(retry.body.error.code, "request_in_progress");
            const edit = await a.request(
              `/attempts/${at.id}/steps/${at.steps[0].id}`,
              "PUT",
              {
                expectedRevision: at.revision,
                sourceRaw: "٢س = ٤",
                inputOrigin: "keyboard",
              },
            );
            assert.equal(edit.status, 200);
            release();
            const stale = await pending;
            assert.equal(stale.status, 409);
            assert.equal(stale.body.error.code, "revision_conflict");
            const latest = await a.request("/attempts/" + at.id);
            assert.equal(latest.body.data.currentVerification, null);
            assert.equal(latest.body.data.completionVerdict, null);
            const old = await pool.query(
              "SELECT report_json FROM verification_reports WHERE attempt_id=$1",
              [at.id],
            );
            assert.equal(old.rows[0].report_json.isCurrent, false);
            const resultId =
              old.rows[0].report_json.transitions[0].verificationResultId;
            assert.equal(
              (await a.request(`/attempts/${at.id}/verifications/${resultId}`))
                .body.data.isCurrent,
              false,
            );
            assert.equal((await verify(at, key)).status, 409);
            service.math = gateway;
            const fresh = await verify(latest.body.data);
            assert.equal(fresh.status, 200);
            assert.equal(
              fresh.body.data.completion.canMarkAttemptCompleted,
              false,
            );
          } finally {
            release();
            service.math = gateway;
            proxy.closeAllConnections();
            await new Promise((r) => proxy.close(r));
          }
        },
      );
      await t.test(
        "unavailable service preserves raw and permits the identical key to retry safely",
        async () => {
          let at = await attempt();
          at = await step(at, "س = ٢");
          const key = randomUUID();
          const closed = createServer();
          closed.listen(0, "127.0.0.1");
          await once(closed, "listening");
          const port = closed.address().port;
          await new Promise((r) => closed.close(r));
          service.math = new MathGateway({
            ...gateway.settings,
            baseUrl: "http://127.0.0.1:" + port,
          });
          try {
            const failed = await verify(at, key);
            assert.equal(failed.status, 503);
            assert.equal(failed.body.error.code, "math_unavailable");
            assert.equal(failed.text.includes(gateway.settings.token), false);
            const current = await a.request("/attempts/" + at.id);
            assert.equal(current.body.data.steps[0].source.sourceRaw, "س = ٢");
            assert.equal(current.body.data.currentVerification, null);
          } finally {
            service.math = gateway;
          }
          const retry = await verify(at, key);
          assert.equal(retry.status, 200);
          assert.equal(
            retry.body.data.completion.canMarkAttemptCompleted,
            true,
          );
        },
      );
      await t.test(
        "whole-request deadline aborts real HTTP work and same-key retry recovers",
        async () => {
          let at = await attempt();
          at = await step(at, "س = ٢");
          const key = randomUUID(),
            previousTimeout = service.timeoutMs;
          let release;
          const held = new Promise((r) => (release = r));
          const proxy = createServer(async (req, res) => {
            let body = "";
            for await (const chunk of req) body += chunk;
            const result = await fetch(
              new URL(req.url, gateway.settings.baseUrl),
              {
                method: req.method,
                headers: {
                  authorization: "Bearer " + gateway.settings.token,
                  "content-type": "application/json",
                },
                body,
              },
            );
            const text = await result.text();
            if (req.url.endsWith("/verify-transition")) await held;
            res
              .writeHead(result.status, { "content-type": "application/json" })
              .end(text);
          });
          proxy.listen(0, "127.0.0.1");
          await once(proxy, "listening");
          service.math = new MathGateway({
            ...gateway.settings,
            baseUrl: "http://127.0.0.1:" + proxy.address().port,
            timeoutMs: 15000,
          });
          service.timeoutMs = 300;
          try {
            const started = Date.now(),
              r = await verify(at, key);
            assert.equal(r.status, 503);
            assert.equal(r.body.error.code, "math_unavailable");
            assert.ok(Date.now() - started < 5000);
            const rows = await pool.query(
              "SELECT dispatch_status FROM verification_reports WHERE attempt_id=$1",
              [at.id],
            );
            assert.equal(rows.rows[0].dispatch_status, "failed");
          } finally {
            release();
            service.math = gateway;
            service.timeoutMs = previousTimeout;
            proxy.closeAllConnections();
            await new Promise((r) => proxy.close(r));
          }
          assert.equal((await verify(at, key)).status, 200);
        },
      );
      await t.test(
        "expired reservation can be reclaimed without an old worker overwriting its retry",
        async () => {
          let at = await attempt();
          at = await step(at, "س = ٢");
          const key = randomUUID();
          let release, notify;
          const held = new Promise((r) => (release = r)),
            reached = new Promise((r) => (notify = r));
          const proxy = createServer(async (req, res) => {
            let body = "";
            for await (const chunk of req) body += chunk;
            const r = await fetch(new URL(req.url, gateway.settings.baseUrl), {
              method: req.method,
              headers: {
                authorization: "Bearer " + gateway.settings.token,
                "content-type": "application/json",
              },
              body,
            });
            const text = await r.text();
            if (req.url.endsWith("/verify-transition")) {
              notify();
              await held;
            }
            res
              .writeHead(r.status, { "content-type": "application/json" })
              .end(text);
          });
          proxy.listen(0, "127.0.0.1");
          await once(proxy, "listening");
          service.math = new MathGateway({
            ...gateway.settings,
            baseUrl: "http://127.0.0.1:" + proxy.address().port,
            timeoutMs: 15000,
          });
          try {
            const old = verify(at, key);
            await reached;
            await pool.query(
              "UPDATE verification_reports SET created_at=now()-interval '2 minutes',deadline_at=now()-interval '1 minute' WHERE attempt_id=$1 AND dispatch_status='running'",
              [at.id],
            );
            service.math = gateway;
            const fresh = await verify(at, key);
            assert.equal(fresh.status, 200);
            release();
            assert.equal((await old).status, 503);
            const retry = await verify(at, key);
            assert.equal(retry.body.data.id, fresh.body.data.id);
            const count = await pool.query(
              "SELECT count(*)::int AS n FROM verification_results v JOIN verification_runs r ON r.id=v.verification_run_id WHERE r.attempt_id=$1",
              [at.id],
            );
            assert.equal(count.rows[0].n, 1);
          } finally {
            release();
            service.math = gateway;
            proxy.closeAllConnections();
            await new Promise((r) => proxy.close(r));
          }
        },
      );
      await t.test(
        "verification DTO and empty/foreign target boundaries match the public contract",
        async () => {
          const at = await attempt();
          assert.equal((await verify(at)).status, 422);
          assert.equal(
            (
              await a.request(`/attempts/${at.id}/verify`, "POST", {
                expectedRevision: 0,
                scope: "current_sequence",
                targetStepId: randomUUID(),
              })
            ).status,
            422,
          );
          assert.equal(
            (
              await a.request(`/attempts/${at.id}/verify`, "POST", {
                expectedRevision: 0,
                scope: "current_sequence",
                targetStepId: null,
                ast: {},
              })
            ).status,
            422,
          );
        },
      );
    } finally {
      writeFileSync(
        "/tmp/ph05-live-results.json",
        JSON.stringify(
          {
            phase: "PH-05",
            runId,
            contracts,
            validatedResponses: contracts.length,
            golden,
            criticalGoldenAcceptance: "not_approved_draft_reference_only",
            services:
              "real NestJS + PostgreSQL + Python/SymPy; stale proxy forwards unmodified real verdict",
            node: process.version,
          },
          null,
          2,
        ),
      );
      await app.close();
      await pool.end();
    }
  },
);
