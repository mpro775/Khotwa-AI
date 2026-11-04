import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
import { writeFileSync } from "node:fs";
import pg from "pg";
import { bank, seedIntegration } from "../../../qa/ph08-fixtures.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
const require = createRequire(import.meta.url);
test(
  "PH08 Gemini through real NestJS/PG/SymPy",
  { skip: process.env.PH08_GEMINI_INTEGRATION !== "true" },
  async (t) => {
    const real = process.env.PH08_GEMINI_LIVE === "true",
      pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const proof = {
      at: new Date().toISOString(),
      realProvider: real,
      actualExternalCalls: 0,
      samples: [],
      checks: [],
      metrics: [],
      contracts: [],
      error: null,
    };
    const { createApplication } = require("../dist/application.js"),
      { TutoringService } = require("../dist/tutoring.js");
    const fixtures = await seedIntegration(pool),
      app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const tutor = app.get(TutoringService),
      adapter = tutor.gemini,
      originalFetch = adapter.transport,
      base = await app.getUrl();
    const good = (c) =>
      Response.json({
        modelVersion: "gemini-3.5-flash-lite",
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 70,
          totalTokenCount: 190,
        },
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    schemaVersion: "ai-draft-v1",
                    task: "hint_rephrase",
                    decision: "usable",
                    messageAr: c.reviewedHintTextAr,
                    reasonCode: "APPROVED_HINT_REPHRASE",
                    sourceTemplateId: c.sourceTemplateId,
                    isAnswerRevealed: false,
                  }),
                },
              ],
            },
          },
        ],
      });
    const originalAudit = adapter.audit;
    adapter.audit = (m) => {
      originalAudit(m);
      proof.metrics.push({
        ...m,
        transport: real && mode === "success" ? "real" : "controlled",
      });
    };
    let mode = "success",
      release;
    adapter.transport = async (url, opts) => {
      const c = JSON.parse(JSON.parse(opts.body).contents[0].parts[0].text);
      assert.deepEqual(
        Object.keys(c).sort(),
        [
          "task",
          "targetHintLevel",
          "sourceTemplateId",
          "contentVersion",
          "policyVersion",
          "promptVersion",
          "reviewedHintTextAr",
          "approvedRephrasesAr",
          "skillNameAr",
          "verifiedObservationAr",
          "maxOutputTokens",
        ].sort(),
      );
      if (mode === "503")
        return new Response("discarded private upstream diagnostic", {
          status: 503,
        });
      if (mode === "timeout")
        return new Promise((_, reject) =>
          opts.signal.addEventListener("abort", () => reject(Error("abort")), {
            once: true,
          }),
        );
      if (mode === "stale") {
        await new Promise((resolve) => {
          release = resolve;
        });
        return good(c);
      }
      if (mode === "unsafe")
        return Response.json({
          modelVersion: "gemini-3.5-flash-lite",
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      schemaVersion: "ai-draft-v1",
                      task: "hint_rephrase",
                      decision: "usable",
                      messageAr: "س = ٩٩",
                      reasonCode: "APPROVED_HINT_REPHRASE",
                      sourceTemplateId: c.sourceTemplateId,
                      isAnswerRevealed: false,
                    }),
                  },
                ],
              },
            },
          ],
        });
      if (!real) return good(c);
      proof.actualExternalCalls++;
      return originalFetch(url, opts);
    };
    async function request(
      a,
      path,
      body,
      key = randomUUID(),
      status = 200,
      method = "POST",
    ) {
      const r = await a.request(path, method, body, key);
      assert.equal(r.status, status, JSON.stringify(r.body));
      return r.body.data;
    }
    async function root(w = bank[0]) {
      const a = createActor(base, proof.contracts),
        l = await a.start();
      const at = await request(
        a,
        "/attempts",
        {
          learningSessionId: l.id,
          source: {
            kind: "catalog",
            problemRevisionId: fixtures.byEquation.get(w.root).revisionId,
          },
        },
        undefined,
        201,
      );
      const c = { a, l, at, w };
      await step(c, w.wrong);
      await verify(c);
      return c;
    }
    async function step(c, raw) {
      const s = await request(
        c.a,
        `/attempts/${c.at.id}/steps`,
        {
          expectedRevision: c.at.revision,
          position: c.at.steps.length + 1,
          sourceRaw: raw,
          inputOrigin: "keyboard",
        },
        undefined,
        201,
      );
      c.at = {
        ...c.at,
        revision: s.attemptRevision,
        steps: [...c.at.steps, s.step],
      };
    }
    async function edit(c, raw) {
      const s = await request(
        c.a,
        `/attempts/${c.at.id}/steps/${c.at.steps[0].id}`,
        {
          expectedRevision: c.at.revision,
          sourceRaw: raw,
          inputOrigin: "keyboard",
        },
        undefined,
        200,
        "PUT",
      );
      c.at = { ...c.at, revision: s.attemptRevision, steps: [s.step] };
    }
    async function verify(c) {
      c.report = await request(c.a, `/attempts/${c.at.id}/verify`, {
        expectedRevision: c.at.revision,
        scope: "current_sequence",
        targetStepId: null,
      });
      return c.report;
    }
    async function remed(c) {
      return request(
        c.a,
        `/attempts/${c.at.id}/remediation`,
        { expectedRevision: c.at.revision },
        undefined,
        201,
      );
    }
    async function open(c, x) {
      return {
        ...c,
        x,
        at: await request(
          c.a,
          "/attempts",
          {
            learningSessionId: c.l.id,
            source: { kind: "assignment", assignmentId: x.id },
          },
          undefined,
          201,
        ),
      };
    }
    async function wrongRem(c) {
      const eq = c.x.problem.originalEquation;
      const wrong = eq.includes("(")
        ? eq.replace(/([٠-٩]+)\(س ([+−]) ([٠-٩]+)\)/u, "$1س $2 $3")
        : "س = ٩٩";
      await step(c, wrong);
      await verify(c);
      return c;
    }
    const hint = (c, key) =>
      request(
        c.a,
        `/attempts/${c.at.id}/hints`,
        { expectedRevision: c.at.revision, action: "next_hint" },
        key,
      );
    async function complete(c) {
      const raw = fixtures.byEquation.get(
        c.x.problem.originalEquation,
      ).solution;
      if (c.at.steps.length) await edit(c, raw);
      else await step(c, raw);
      const r = await verify(c);
      assert.equal(r.completion.canMarkAttemptCompleted, true);
    }
    async function transfer(c, e) {
      return request(
        c.a,
        `/attempts/${e.rootAttemptId}/transfer`,
        { expectedRevision: c.at.revision, episodeId: e.id },
        undefined,
        201,
      );
    }
    async function check(name, fn) {
      await t.test(name, async () => {
        await fn();
        proof.checks.push({ name, passed: true });
      });
    }
    const count = () => proof.metrics.length;
    try {
      await check(
        "PH07 root hint is local; only PH08 assigned attempts may call Gemini",
        async () => {
          const c = await root(),
            before = count();
          await hint(c);
          assert.equal(count(), before);
        },
      );
      // Controlled failures run first, on a separate quota so the real round cap
      // remains exactly ten upstream attempts including real failures.
      const { GeminiQuota } = require("../dist/gemini-quota.js");
      const realQuota = adapter.quota;
      const localQuota = new GeminiQuota({
        ledgerPath: "/tmp/ph08-gemini-controls.json",
        roundLimit: 15,
        dailyRemaining: null,
        validUntil: Date.now() + 3600000,
        model: "gemini-3.5-flash-lite",
      });
      adapter.quota = localQuota;
      try {
        for (const failure of ["503", "timeout", "unsafe"]) {
          await check(
            `controlled Gemini ${failure}: fallback preserves steps, revision and SymPy verdict`,
            async () => {
              const c = await root(),
                e = await remed(c),
                m = await wrongRem(await open(c, e.assignments.at(-1)));
              const originalReport = structuredClone(m.report),
                originalStep = m.at.steps[0].source.sourceRaw;
              mode = failure;
              const event = await hint(m);
              mode = "success";
              assert.equal(event.eventType, "fallback");
              assert.deepEqual(event.solutionStepsAr, []);
              const fresh = await m.a.request(`/attempts/${m.at.id}`);
              assert.equal(fresh.status, 200);
              assert.equal(fresh.body.data.revision, m.at.revision);
              assert.equal(
                fresh.body.data.steps[0].source.sourceRaw,
                originalStep,
              );
              const report = await verify(m);
              assert.deepEqual(
                report.transitions.map((x) => x.mathStatus),
                originalReport.transitions.map((x) => x.mathStatus),
              );
            },
          );
        }
        await check(
          "late Gemini result is rejected after concurrent step edit",
          async () => {
            const c = await root(),
              e = await remed(c),
              m = await wrongRem(await open(c, e.assignments.at(-1)));
            mode = "stale";
            const pending = m.a.request(`/attempts/${m.at.id}/hints`, "POST", {
              expectedRevision: m.at.revision,
              action: "next_hint",
            });
            for (let n = 0; !release && n < 100; n++)
              await new Promise((resolve) => setTimeout(resolve, 20));
            assert.ok(release);
            await edit(m, "س = ٩٨");
            release();
            const r = await pending;
            mode = "success";
            assert.equal(r.status, 409);
            const events = await pool.query(
              "SELECT count(*)::int AS n FROM tutoring_events WHERE attempt_id=$1",
              [m.at.id],
            );
            assert.equal(events.rows[0].n, 0);
          },
        );
      } finally {
        adapter.quota = realQuota;
        localQuota.close();
        mode = "success";
      }
      let usable = 0;
      const resumed = process.env.PH08_GEMINI_RESUME_TRANSFER_ONLY === "true";
      if (resumed)
        assert.equal(
          realQuota.spent,
          8,
          "resume only after the recorded eighth-call timeout; never replenish quota",
        );
      for (const [i, w] of (resumed ? [] : bank).entries()) {
        const c = await root(w),
          e = await remed(c),
          m = await wrongRem(await open(c, e.assignments.at(-1)));
        const before = count(),
          key = randomUUID(),
          event = await hint(m, key);
        const metric = proof.metrics.at(-1);
        assert.equal(count(), before + 1, "a provider call must be observed");
        proof.samples.push({
          case: i + 1,
          root: w.root,
          rootDiagnosis: c.report.diagnosisCandidate,
          remediation: m.x.problem.originalEquation,
          remediationDiagnosis: m.report.diagnosisCandidate,
          mathStatuses: m.report.transitions.map((x) => x.mathStatus),
          hint: event,
          metric,
        });
        if (real && metric.httpStatus !== 200)
          throw Error(
            `REAL_PROVIDER_HTTP_${metric.httpStatus ?? "NETWORK"}; stopped without retry`,
          );
        assert.equal(metric.outcome, "AI_VALIDATED");
        usable++;
        const cached = await hint(m, key);
        assert.equal(cached.id, event.id);
        assert.equal(count(), before + 1);
        const audited = await pool.query(
          "SELECT audit_json FROM tutoring_events WHERE id=$1",
          [event.id],
        );
        assert.equal(audited.rows[0].audit_json.actualLlmUsed, true);
        assert.equal(
          audited.rows[0].audit_json.modelActual,
          metric.actualModel,
        );
        assert.equal(
          audited.rows[0].audit_json.reportedTotalTokens,
          metric.totalTokens,
        );
        assert.deepEqual(event.solutionStepsAr, []);
        assert.equal(event.hintLevel, "H1");
        if (i === 0) {
          for (let level = 2; level <= 3; level++) {
            const next = await hint(m),
              measurement = proof.metrics.at(-1);
            proof.samples.push({
              case: `distribution-H${level}`,
              hint: next,
              metric: measurement,
            });
            if (real && measurement.httpStatus !== 200)
              throw Error(
                `REAL_PROVIDER_HTTP_${measurement.httpStatus ?? "NETWORK"}; stopped without retry`,
              );
            assert.equal(measurement.outcome, "AI_VALIDATED");
            assert.equal(next.hintLevel, `H${level}`);
            usable++;
          }
          await complete(m);
          const tr = await transfer(c, e),
            x = tr.assignments.at(-1),
            n = await open(c, x),
            start = count();
          assert.equal(x.assistancePolicy, "independent");
          assert.equal(
            count(),
            start,
            "assigning/reading independent transfer must not call provider",
          );
          await complete(n);
          assert.equal(
            count(),
            start,
            "independent verification uses only SymPy",
          );
          const progress = await n.a.request(
            "/progress?learningSessionId=" + n.l.id,
          );
          assert.equal(progress.status, 200);
          proof.checks.push({
            name: "completed remediation and fresh independent transfer without answer leakage or provider call",
            passed: true,
          });
        }
      }
      // Two more provider calls: explicit exit from independent transfer and a
      // second H2 request. Independent eligibility must already be revoked.
      const c = await root(),
        e = await remed(c),
        m = await open(c, e.assignments.at(-1));
      await complete(m);
      const tr = await transfer(c, e),
        n = await open(c, tr.assignments.at(-1));
      await step(n, "س = ٩٩");
      await verify(n);
      const before = count();
      for (let i = 0; i < 2; i++) {
        const event = await hint(n),
          metric = proof.metrics.at(-1);
        proof.samples.push({
          case: `transfer-explicit-exit-H${i + 1}`,
          hint: event,
          metric,
        });
        if (real && metric.httpStatus !== 200)
          throw Error(
            `REAL_PROVIDER_HTTP_${metric.httpStatus ?? "NETWORK"}; stopped without retry`,
          );
        assert.equal(metric.outcome, "AI_VALIDATED");
        assert.equal(event.independentEvidenceEligible, false);
        usable++;
      }
      assert.equal(count(), before + 2);
      const current = await n.a.request(`/attempts/${n.at.id}`);
      assert.equal(current.status, 200);
      const eligibility = await pool.query(
        "SELECT independent_evidence_eligible FROM attempts WHERE id=$1",
        [n.at.id],
      );
      assert.equal(eligibility.rows[0].independent_evidence_eligible, false);
      proof.checks.push({
        name: "transfer assistance explicitly exits independent measurement before Gemini",
        passed: true,
      });
      assert.equal(usable, resumed ? 2 : 10);
      assert.equal(realQuota.spent, 10);
      assert.equal(proof.actualExternalCalls, real ? (resumed ? 2 : 10) : 0);
      const blocked = await hint(n);
      assert.equal(blocked.eventType, "fallback");
      assert.equal(realQuota.spent, 10);
      assert.equal(proof.actualExternalCalls, real ? (resumed ? 2 : 10) : 0);
      proof.checks.push({
        name: "eleventh request uses fallback without upstream dispatch",
        passed: true,
      });
    } catch (error) {
      proof.error = error.message;
      throw error;
    } finally {
      proof.contractResponseCount = proof.contracts.length;
      delete proof.contracts;
      writeFileSync(
        "/evidence/" +
          (real
            ? "ph08-gemini-real-results.json"
            : "ph08-gemini-controlled-results.json"),
        JSON.stringify(proof, null, 2) + "\n",
      );
      await app.close();
      await pool.end();
    }
  },
);
