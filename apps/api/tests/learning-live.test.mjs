import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
import { writeFileSync } from "node:fs";
import pg from "pg";
import {
  seedIntegration,
  bank,
  reference,
} from "../../../qa/ph08-fixtures.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
import { startAiStub } from "../../../qa/ph07-ai-stub.mjs";
const require = createRequire(import.meta.url);
test(
  "PH08 live remediation and transfer on real services",
  { skip: process.env.PH08_INTEGRATION !== "true" },
  async (t) => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
      fixtures = await seedIntegration(pool),
      contracts = [],
      runId = randomUUID();
    const { createApplication } = require("../dist/application.js"),
      { TutoringService } = require("../dist/tutoring.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const tutor = app.get(TutoringService),
      originalAi = tutor.ai,
      originalLimits = tutor.limits,
      stub = await startAiStub();
    const observations = [],
      base = await app.getUrl();
    const last = (e) => e.assignments.at(-1);
    async function actor() {
      const a = createActor(base, contracts);
      return { a, l: await a.start() };
    }
    async function root(w = bank[0]) {
      const { a, l } = await actor();
      const r = await a.request("/attempts", "POST", {
        learningSessionId: l.id,
        source: {
          kind: "catalog",
          problemRevisionId: fixtures.byEquation.get(w.root).revisionId,
        },
      });
      assert.equal(r.status, 201);
      return { a, l, at: r.body.data, w };
    }
    async function step(c, raw) {
      const r = await c.a.request(`/attempts/${c.at.id}/steps`, "POST", {
        expectedRevision: c.at.revision,
        position: c.at.steps.length + 1,
        sourceRaw: raw,
        inputOrigin: "math_editor",
      });
      assert.equal(r.status, 201);
      c.at = {
        ...c.at,
        revision: r.body.data.attemptRevision,
        steps: [...c.at.steps, r.body.data.step],
      };
      return c;
    }
    async function edit(c, raw, index = 0) {
      const r = await c.a.request(
        `/attempts/${c.at.id}/steps/${c.at.steps[index].id}`,
        "PUT",
        {
          expectedRevision: c.at.revision,
          sourceRaw: raw,
          inputOrigin: "keyboard",
        },
      );
      assert.equal(r.status, 200);
      c.at = {
        ...c.at,
        revision: r.body.data.attemptRevision,
        steps: c.at.steps.map((s, i) => (i === index ? r.body.data.step : s)),
      };
      return c;
    }
    async function verify(c) {
      const r = await c.a.request(`/attempts/${c.at.id}/verify`, "POST", {
        expectedRevision: c.at.revision,
        scope: "current_sequence",
        targetStepId: null,
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      c.report = r.body.data;
      return r.body.data;
    }
    async function ready(w = bank[0]) {
      const c = await root(w);
      await step(c, w.wrong);
      await verify(c);
      return c;
    }
    async function remed(c, expected = 201, key = randomUUID()) {
      const r = await c.a.request(
        `/attempts/${c.at.id}/remediation`,
        "POST",
        { expectedRevision: c.at.revision },
        key,
      );
      assert.equal(r.status, expected, JSON.stringify(r.body));
      return r.body.data;
    }
    async function open(c, x) {
      const r = await c.a.request("/attempts", "POST", {
        learningSessionId: c.l.id,
        source: { kind: "assignment", assignmentId: x.id },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return { ...c, at: r.body.data, x };
    }
    async function complete(c) {
      if (c.at.steps.length)
        await edit(
          c,
          fixtures.byEquation.get(c.x.problem.originalEquation).solution,
        );
      else
        await step(
          c,
          fixtures.byEquation.get(c.x.problem.originalEquation).solution,
        );
      const r = await verify(c);
      assert.equal(r.completion.canMarkAttemptCompleted, true);
      return c;
    }
    async function transfer(c, e, key = randomUUID()) {
      return c.a.request(
        `/attempts/${e.rootAttemptId}/transfer`,
        "POST",
        { expectedRevision: c.rootRevision ?? c.at.revision, episodeId: e.id },
        key,
      );
    }
    async function progress(c) {
      const r = await c.a.request("/progress?learningSessionId=" + c.l.id);
      assert.equal(r.status, 200);
      return r.body.data;
    }
    async function transferReady() {
      const c = await ready(),
        e = await remed(c),
        m = await complete(await open(c, last(e))),
        r = await transfer(c, e);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return { c, m, e: r.body.data, x: last(r.body.data) };
    }
    async function hint(c, action = "next_hint", confirm) {
      return c.a.request(`/attempts/${c.at.id}/hints`, "POST", {
        expectedRevision: c.at.revision,
        action,
        ...(confirm === undefined
          ? {}
          : { confirmAssistedCompletion: confirm }),
      });
    }
    try {
      await t.test(
        "hidden bank is absent from catalog and foreign UUIDs never grant access",
        async () => {
          const c = await ready(),
            hidden = fixtures.byEquation.get(bank[0].transfer[0][0]);
          assert.equal(
            (await c.a.request("/problems/" + hidden.problemId)).status,
            404,
          );
          const catalog = await c.a.request(
            "/problems?skillId=" + fixtures.skillId,
          );
          assert.equal(catalog.status, 200);
          assert.ok(catalog.body.data.items.every((p) => p.kind === "main"));
          assert.equal(
            (
              await c.a.request("/attempts", "POST", {
                learningSessionId: c.l.id,
                source: {
                  kind: "catalog",
                  problemRevisionId: hidden.revisionId,
                },
              })
            ).status,
            404,
          );
          const e = await remed(c),
            other = await actor();
          assert.equal(
            (await other.a.request("/learning-episodes/" + e.id)).status,
            404,
          );
          assert.equal(
            (await other.a.request("/problems/" + last(e).problem.id)).status,
            404,
          );
          assert.equal(
            (
              await other.a.request("/attempts", "POST", {
                learningSessionId: other.l.id,
                source: { kind: "assignment", assignmentId: last(e).id },
              })
            ).status,
            404,
          );
          assert.equal(
            (await other.a.request("/progress?learningSessionId=" + c.l.id))
              .status,
            404,
          );
          assert.equal(
            (await c.a.request("/problems/" + last(e).problem.id)).status,
            200,
          );
          assert.equal(
            JSON.stringify(e).includes("PH08_SERVER_ONLY_KEY"),
            false,
          );
          assert.equal(JSON.stringify(e).includes("answer_spec"), false);
        },
      );
      await t.test(
        "six authored pairings select the intended single skill with real reference checks",
        async () => {
          for (const w of bank) {
            const c = await ready(w),
              e = await remed(c),
              x = last(e);
            assert.equal(e.skillId, fixtures.byEquation.get(w.root).skillId);
            assert.equal(x.problem.primarySkillId, e.skillId);
            assert.equal(x.phase, "remediation");
            assert.ok(w.rem.some(([eq]) => eq === x.problem.originalEquation));
            assert.notEqual(x.problem.originalEquation, w.root);
          }
          assert.equal(fixtures.proofs.length, 36);
          assert.ok(
            fixtures.proofs.every((p) => p.status === "verified_valid"),
          );
        },
      );
      await t.test(
        "no verification, abstention and open probe cannot create a misleading treatment",
        async () => {
          const c = await root();
          assert.equal(
            (
              await c.a.request(`/attempts/${c.at.id}/remediation`, "POST", {
                expectedRevision: 0,
              })
            ).status,
            409,
          );
          for (const raw of ["س + ( = ٣", "جا(٣٠) = ١"]) {
            const n = await root();
            await step(n, raw);
            await verify(n);
            assert.equal(
              (
                await n.a.request(`/attempts/${n.at.id}/remediation`, "POST", {
                  expectedRevision: n.at.revision,
                })
              ).status,
              409,
            );
            assert.ok(
              (await progress(n)).skills.every(
                (s) => s.evidenceCount === 0 && s.state === "not_assessed",
              ),
            );
          }
          const n = await ready();
          if (n.report.diagnosisCandidate) {
            const p = await n.a.request(`/attempts/${n.at.id}/probes`, "POST", {
              expectedRevision: n.at.revision,
              verificationResultId:
                n.report.transitions[0].verificationResultId,
            });
            assert.equal(p.status, 201);
            assert.equal(
              (
                await n.a.request(`/attempts/${n.at.id}/remediation`, "POST", {
                  expectedRevision: n.at.revision,
                })
              ).status,
              409,
            );
          }
        },
      );
      await t.test(
        "idempotency and distinct racing keys produce one episode and one attempt per assignment",
        async () => {
          const c = await ready(),
            key = randomUUID(),
            body = { expectedRevision: c.at.revision };
          const results = await Promise.all([
            c.a.request(`/attempts/${c.at.id}/remediation`, "POST", body, key),
            c.a.request(`/attempts/${c.at.id}/remediation`, "POST", body, key),
            c.a.request(`/attempts/${c.at.id}/remediation`, "POST", body),
          ]);
          assert.deepEqual(
            results.map((r) => r.body.data.id),
            [
              results[0].body.data.id,
              results[0].body.data.id,
              results[0].body.data.id,
            ],
          );
          const x = last(results[0].body.data),
            opens = await Promise.all([open(c, x), open(c, x)]);
          assert.equal(opens[0].at.id, opens[1].at.id);
          assert.equal(opens[0].at.parentEpisodeId, results[0].body.data.id);
          const mismatch = await c.a.request(
            `/attempts/${c.at.id}/remediation`,
            "POST",
            { expectedRevision: 0 },
            key,
          );
          assert.equal(mismatch.status, 409);
          const count = await pool.query(
            "SELECT count(*)::int AS n FROM learning_episodes WHERE root_attempt_id=$1",
            [c.at.id],
          );
          assert.equal(count.rows[0].n, 1);
        },
      );
      await t.test(
        "remediation must finish a valid chain before any transfer is assigned",
        async () => {
          const c = await ready(),
            e = await remed(c);
          assert.equal((await transfer(c, e)).status, 409);
          const m = await open(c, last(e));
          await step(m, "س = ٩٩");
          await verify(m);
          assert.equal((await transfer(c, e)).status, 409);
          await step(
            m,
            fixtures.byEquation.get(m.x.problem.originalEquation).solution,
          );
          const r = await verify(m);
          assert.equal(r.completion.canMarkAttemptCompleted, false);
          assert.equal((await transfer(c, e)).status, 409);
        },
      );
      await t.test(
        "live incorrect-root → probe → AI failure/H4 → remediation → new independent transfer journey",
        async () => {
          const c = await ready();
          assert.equal(c.report.transitions[0].mathStatus, "verified_invalid");
          const p = await c.a.request(`/attempts/${c.at.id}/probes`, "POST", {
            expectedRevision: c.at.revision,
            verificationResultId: c.report.transitions[0].verificationResultId,
          });
          assert.equal(p.status, 201);
          const response = await c.a.request(
            `/attempts/${c.at.id}/probes/${p.body.data.id}/responses`,
            "POST",
            {
              expectedRevision: c.at.revision,
              answer: {
                kind: "choice",
                optionId: p.body.data.options.find(
                  (o) => o.labelAr === "لا أدري",
                ).id,
              },
            },
          );
          assert.equal(response.status, 201);
          tutor.ai = stub.port;
          stub.setMode("invalid_json");
          const h = await hint(c);
          assert.equal(h.status, 200);
          assert.equal(h.body.data.eventType, "fallback");
          assert.equal(h.body.data.generationSource, "manual");
          tutor.ai = originalAi;
          assert.equal((await hint(c, "show_full_solution")).status, 422);
          assert.equal((await hint(c, "show_full_solution", true)).status, 200);
          const e = await remed(c),
            m = await open(c, last(e));
          assert.equal((await hint(m, "show_full_solution", true)).status, 200);
          await complete(m);
          const before = await progress(c);
          assert.equal(
            before.skills.find((s) => s.skillId === e.skillId).state,
            "practice_with_support",
          );
          const assigned = await transfer(c, e);
          assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
          const tx = last(assigned.body.data);
          assert.equal(tx.assistancePolicy, "independent");
          assert.ok(
            ![c.w.root, m.x.problem.originalEquation].includes(
              tx.problem.originalEquation,
            ),
          );
          const n = await open(c, tx),
            answer = fixtures.byEquation.get(
              tx.problem.originalEquation,
            ).solution;
          // A valid alternative form is authored during the run, then judged by real Python, not matched to a string.
          await step(n, answer.split("=").reverse().join("="));
          const final = await verify(n);
          assert.equal(final.completion.canMarkAttemptCompleted, true);
          const result = await progress(n),
            skill = result.skills.find((s) => s.skillId === e.skillId);
          assert.equal(skill.independentTransferCount, 1);
          assert.equal(skill.assistedPracticeCount, 1);
          assert.equal(skill.state, "new_evidence_of_understanding");
          const detail = await c.a.request(
            "/progress/skills/" + e.skillId + "?learningSessionId=" + c.l.id,
          );
          assert.equal(detail.status, 200);
          assert.deepEqual(detail.body.data, skill);
          const current = await c.a.request("/learning-episodes/" + e.id);
          assert.equal(current.body.data.state, "finished");
          assert.equal(current.body.data.nextAction, "review_progress");
          observations.push({
            scenario: "QA-E2E-J02/AI/H4",
            rootVerdict: c.report.transitions[0].mathStatus,
            transferVerdict: final.completion.state,
            independentTransferCount: skill.independentTransferCount,
            assistedPracticeCount: skill.assistedPracticeCount,
            episodeId: e.id,
          });
        },
      );
      await t.test(
        "a transfer hint explicitly exits measurement and the latch survives reload, edits and full solution",
        async () => {
          const { c, e, x } = await transferReady(),
            n = await open(c, x);
          await step(n, "س = ٩٩");
          await verify(n);
          assert.equal((await hint(n, "show_full_solution")).status, 422);
          const h = await hint(n);
          assert.equal(h.status, 200, JSON.stringify(h.body));
          const state = await pool.query(
            "SELECT assistance_policy,measurement_exited_at FROM learning_assignments WHERE id=$1",
            [x.id],
          );
          assert.equal(state.rows[0].assistance_policy, "guided");
          assert.ok(state.rows[0].measurement_exited_at);
          assert.equal((await hint(n, "show_full_solution", true)).status, 200);
          await complete(n);
          const restored = await c.a.request("/attempts/" + n.at.id);
          assert.equal(restored.body.data.status, "assisted_completed");
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
          const next = await transfer(c, e);
          assert.equal(next.status, 201, JSON.stringify(next.body));
          assert.notEqual(
            last(next.body.data).problemRevisionId,
            x.problemRevisionId,
          );
        },
      );
      await t.test(
        "a late verification cannot restore independent status after a help request",
        async () => {
          const { c, e, x } = await transferReady(),
            n = await open(c, x);
          await complete(n);
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            1,
          );
          assert.equal((await hint(n)).status, 200);
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
          await verify(n);
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
        },
      );
      await t.test(
        "transfer selection excludes exposure across learning sessions and never reuses exhausted content",
        async () => {
          const { c, e } = await transferReady();
          // Controlled prior-exposure fixture, not a claim about a real learner.
          for (const [eq] of c.w.transfer) {
            const item = fixtures.byEquation.get(eq);
            await pool.query(
              "INSERT INTO content_exposures(id,guest_session_id,problem_revision_id,learning_family,equation_hash,exposure_kind) SELECT $1,l.guest_session_id,$2,$3,repeat('a',64),'prior_fixture' FROM learning_sessions l WHERE l.id=$4 ON CONFLICT DO NOTHING",
              [randomUUID(), item.revisionId, item.family, c.l.id],
            );
          }
          const x = last(e),
            n = await open(c, x);
          await step(n, "س = ٩٩");
          await verify(n);
          assert.equal((await hint(n)).status, 200);
          await complete(n);
          const r = await transfer(c, e);
          assert.equal(r.status, 503);
          assert.equal(r.body.error.code, "internal_error");
          const count = await pool.query(
            "SELECT count(*)::int AS n FROM learning_assignments WHERE episode_id=$1 AND phase='transfer'",
            [e.id],
          );
          assert.equal(count.rows[0].n, 1);
        },
      );
      await t.test(
        "root revision changes invalidate the whole loop and cached responses without erasing exposure",
        async () => {
          const { c, e, x } = await transferReady(),
            n = await open(c, x);
          await complete(n);
          const exposure = (
            await pool.query("SELECT count(*)::int AS n FROM content_exposures")
          ).rows[0].n;
          await edit(c, c.w.solution);
          const current = await c.a.request("/learning-episodes/" + e.id);
          assert.equal(current.body.data.state, "cancelled");
          assert.deepEqual(current.body.data.assignments, []);
          assert.equal(
            (
              await c.a.request(`/attempts/${n.at.id}/verify`, "POST", {
                expectedRevision: n.at.revision,
                scope: "current_sequence",
                targetStepId: null,
              })
            ).status,
            409,
          );
          assert.equal(
            (await progress(c)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM content_exposures",
              )
            ).rows[0].n,
            exposure,
          );
        },
      );
      await t.test(
        "editing remediation invalidates assigned transfer and removes stale evidence while preserving raw history",
        async () => {
          const { c, m, e, x } = await transferReady(),
            n = await open(c, x);
          await complete(n);
          await edit(m, "س = ٩٩");
          assert.equal(
            (await c.a.request("/problems/" + x.problem.id)).status,
            404,
          );
          assert.equal(
            (
              await c.a.request(`/attempts/${n.at.id}/hints`, "POST", {
                expectedRevision: n.at.revision,
                action: "next_hint",
              })
            ).status,
            409,
          );
          const p = await progress(c);
          assert.equal(
            p.skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
          assert.ok(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM step_versions WHERE step_slot_id=$1",
                [m.at.steps[0].id],
              )
            ).rows[0].n >= 2,
          );
        },
      );
      await t.test(
        "unsupported transfer is not negative evidence and later corrections are re-evaluated",
        async () => {
          const { c, e, x } = await transferReady(),
            n = await open(c, x);
          await step(n, "جا(٣٠) = ١");
          const r = await verify(n);
          assert.equal(r.transitions[0].mathStatus, "unsupported");
          let p = (await progress(n)).skills.find(
            (s) => s.skillId === e.skillId,
          );
          assert.equal(p.independentTransferCount, 0);
          assert.notEqual(p.state, "needs_followup");
          await complete(n);
          p = (await progress(n)).skills.find((s) => s.skillId === e.skillId);
          assert.equal(p.independentTransferCount, 1);
        },
      );
      await t.test(
        "finite remediation policy offers stop/support after two failed activities",
        async () => {
          const c = await ready(),
            e = await remed(c),
            m = await open(c, last(e));
          await step(m, "س = ٩٩");
          await verify(m);
          const again = await remed(m, 200),
            n = await open(c, last(again));
          assert.notEqual(n.at.id, m.at.id);
          await step(n, "س = ٩٩");
          await verify(n);
          const r = await c.a.request(
            `/attempts/${n.at.id}/remediation`,
            "POST",
            { expectedRevision: n.at.revision },
          );
          assert.equal(r.status, 409);
          assert.match(r.body.error.messageAr, /التوقف|تلقائي/);
        },
      );
      await t.test(
        "DB rejects cross-scope assignment, mutable evidence and reset measurement eligibility",
        async () => {
          const { c, x } = await transferReady(),
            n = await open(c, x);
          await complete(n);
          await assert.rejects(
            () =>
              pool.query(
                "UPDATE skill_evidence SET observation='assisted' WHERE attempt_id=$1",
                [n.at.id],
              ),
            /immutable/,
          );
          await assert.rejects(
            () =>
              pool.query(
                "UPDATE learning_assignments SET attempt_id=$1 WHERE id=$2",
                [c.at.id, x.id],
              ),
            /scope|history/,
          );
          assert.equal((await hint(n)).status, 200);
          await assert.rejects(
            () =>
              pool.query(
                "UPDATE learning_assignments SET assistance_policy='independent',measurement_exited_at=NULL WHERE id=$1",
                [x.id],
              ),
            /reset/,
          );
          await assert.rejects(
            () =>
              pool.query(
                "UPDATE attempts SET independent_evidence_eligible=true WHERE id=$1",
                [n.at.id],
              ),
            /assistance|reset|monotonic/,
          );
          const unchanged = await c.a.request("/attempts/" + c.at.id);
          assert.equal(
            unchanged.body.data.steps[0].source.sourceRaw,
            c.w.wrong,
          );
        },
      );
      await t.test(
        "racing root edit and transfer assignment cannot leave an active stale measurement",
        async () => {
          const c = await ready(),
            e = await remed(c);
          await complete(await open(c, last(e)));
          const responses = await Promise.all([
            transfer(c, e),
            edit(c, c.w.solution),
          ]);
          assert.ok([201, 409].includes(responses[0].status));
          const current = await c.a.request("/learning-episodes/" + e.id);
          assert.equal(current.body.data.state, "cancelled");
          assert.deepEqual(current.body.data.assignments, []);
        },
      );
      await t.test(
        "all transfer verification surfaces withhold solution sets and automatic coaching",
        async () => {
          const { c, e, x } = await transferReady(),
            n = await open(c, x);
          await step(n, "س = ٩٩");
          const key = randomUUID(),
            body = {
              expectedRevision: n.at.revision,
              scope: "current_sequence",
              targetStepId: null,
            };
          const r = await n.a.request(
            `/attempts/${n.at.id}/verify`,
            "POST",
            body,
            key,
          );
          assert.equal(r.status, 200);
          const vr = r.body.data;
          assert.equal(vr.transitions[0].mathStatus, "verified_invalid");
          assert.equal(vr.transitions[0].evidence, null);
          assert.equal(vr.diagnosisCandidate, null);
          const cached = await n.a.request(
            `/attempts/${n.at.id}/verify`,
            "POST",
            body,
            key,
          );
          assert.equal(cached.body.data.transitions[0].evidence, null);
          const detail = await n.a.request(
            `/attempts/${n.at.id}/verifications/${vr.transitions[0].verificationResultId}`,
          );
          assert.equal(detail.body.data.result.evidence, null);
          const attempt = await n.a.request("/attempts/" + n.at.id);
          assert.equal(
            attempt.body.data.currentVerification.transitions[0].evidence,
            null,
          );
          const list = await n.a.request(
            "/attempts?learningSessionId=" + c.l.id,
          );
          assert.equal(
            list.body.data.items.find((a) => a.id === n.at.id)
              .currentVerification.transitions[0].evidence,
            null,
          );
          assert.equal(
            (
              await n.a.request(`/attempts/${n.at.id}/probes`, "POST", {
                expectedRevision: n.at.revision,
                verificationResultId: vr.transitions[0].verificationResultId,
              })
            ).status,
            409,
          );
          const internal = await pool.query(
            "SELECT report_json FROM verification_reports WHERE id=$1",
            [vr.id],
          );
          assert.ok(internal.rows[0].report_json.transitions[0].evidence);
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
        },
      );
      await t.test(
        "confirmed H4 may exit transfer directly before steps, but never supplies independent evidence",
        async () => {
          const { c, e, x } = await transferReady(),
            n = await open(c, x);
          const h = await hint(n, "show_full_solution", true);
          assert.equal(h.status, 200, JSON.stringify(h.body));
          assert.equal(h.body.data.hintLevel, "H4");
          await complete(n);
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
        },
      );
      await t.test(
        "one correct probe answer never creates a mastery or transfer observation",
        async () => {
          const c = await ready(),
            p = await c.a.request(`/attempts/${c.at.id}/probes`, "POST", {
              expectedRevision: c.at.revision,
              verificationResultId:
                c.report.transitions[0].verificationResultId,
            });
          assert.equal(p.status, 201);
          const correct = p.body.data.options.find(
            (o) => o.labelAr === "٥س + ٢٠",
          );
          assert.ok(correct);
          const r = await c.a.request(
            `/attempts/${c.at.id}/probes/${p.body.data.id}/responses`,
            "POST",
            {
              expectedRevision: c.at.revision,
              answer: { kind: "choice", optionId: correct.id },
            },
          );
          assert.equal(r.status, 201);
          assert.equal(r.body.data.diagnosis.state, "rejected");
          assert.ok(
            (await progress(c)).skills.every(
              (s) =>
                s.independentTransferCount === 0 && s.state === "not_assessed",
            ),
          );
        },
      );
      await t.test(
        "a failed independent transfer offers a different bounded remediation, without permanent labels",
        async () => {
          const { c, e, x } = await transferReady(),
            n = await open(c, x);
          await step(n, "س = ٩٩");
          await verify(n);
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .state,
            "needs_followup",
          );
          const next = await remed(n, 200),
            newRem = last(next);
          assert.equal(newRem.phase, "remediation");
          assert.notEqual(
            newRem.problemRevisionId,
            e.assignments.find((x) => x.phase === "remediation")
              .problemRevisionId,
          );
          assert.equal(
            (await c.a.request("/problems/" + x.problem.id)).status,
            404,
          );
        },
      );
      await t.test(
        "a question previously disclosed by a probe is excluded from subsequent transfer",
        async () => {
          const blockedEquation = bank[0].transfer[0][0];
          const [tmpl] = (
            await pool.query(
              "SELECT * FROM diagnostic_templates WHERE release_id=$1 AND family='distribution' ORDER BY template_version DESC LIMIT 1",
              [fixtures.releaseId],
            )
          ).rows;
          assert.ok(tmpl);
          await pool.query(
            "INSERT INTO diagnostic_templates(id,release_id,family,template_version,question_ar,options_json,rules_json,enabled,is_synthetic,review_status) VALUES($1,$2,$3,'zz-ph08-exposure',$4,$5,$6,true,true,'draft')",
            [
              randomUUID(),
              fixtures.releaseId,
              tmpl.family,
              "سؤال اختبار التعرّض: " + blockedEquation,
              JSON.stringify(tmpl.options_json),
              JSON.stringify(tmpl.rules_json),
            ],
          );
          const c = await ready(),
            p = await c.a.request(`/attempts/${c.at.id}/probes`, "POST", {
              expectedRevision: c.at.revision,
              verificationResultId:
                c.report.transitions[0].verificationResultId,
            });
          assert.equal(p.status, 201);
          const answered = await c.a.request(
            `/attempts/${c.at.id}/probes/${p.body.data.id}/responses`,
            "POST",
            {
              expectedRevision: c.at.revision,
              answer: {
                kind: "choice",
                optionId: p.body.data.options.find(
                  (o) => o.labelAr === "لا أدري",
                ).id,
              },
            },
          );
          assert.equal(answered.status, 201);
          const e = await remed(c);
          await complete(await open(c, last(e)));
          const r = await transfer(c, e);
          assert.equal(r.status, 201, JSON.stringify(r.body));
          assert.notEqual(
            last(r.body.data).problem.originalEquation,
            blockedEquation,
          );
        },
      );
      await t.test(
        "a later cross-activity disclosure withdraws positive transfer evidence without rewriting history",
        async () => {
          const { c, e, x } = await transferReady(),
            n = await open(c, x);
          await complete(n);
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            1,
          );
          await pool.query(
            "INSERT INTO intervention_templates(id,release_id,problem_revision_id,template_version,hint_level,policy_version,text_ar,allowed_rephrases,math_assertions,solution_steps,review_status,enabled,is_synthetic) VALUES($1,$2,$3,'zz-ph08-cross-context',4,'tutoring-p0-0.7.0',$4,'[]','[]',$5::jsonb,'draft',true,true)",
            [
              randomUUID(),
              fixtures.releaseId,
              c.at.problemRevisionId,
              "مثال للتعلم: " + x.problem.originalEquation,
              JSON.stringify([c.w.solution]),
            ],
          );
          assert.equal((await hint(c, "show_full_solution", true)).status, 200);
          assert.equal(
            (await progress(n)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
          assert.equal(
            (await c.a.request("/learning-episodes/" + e.id)).body.data
              .nextAction,
            "start_transfer",
          );
          assert.ok(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM skill_evidence WHERE attempt_id=$1 AND observation='positive'",
                [n.at.id],
              )
            ).rows[0].n > 0,
          );
        },
      );
    } finally {
      tutor.ai = originalAi;
      tutor.limits = originalLimits;
      const counts = await pool.query(
        "SELECT (SELECT count(*) FROM learning_episodes)::int AS episodes,(SELECT count(*) FROM learning_assignments)::int AS assignments,(SELECT count(*) FROM skill_evidence)::int AS evidence,(SELECT count(*) FROM content_exposures)::int AS exposures",
      );
      const summary = {
        phase: "PH-08",
        runId,
        recordedAt: new Date().toISOString(),
        services:
          "real NestJS/PostgreSQL17.6/Python/SymPy; test-only HTTP AI double",
        validatedResponses: contracts.length,
        contracts,
        actualExternalProviderCalls: 0,
        actualLlmInferences: 0,
        controlledProviderCalls: stub.requests.length,
        referenceChecks: fixtures.proofs,
        counts: counts.rows[0],
        journey: observations,
        contentReview: "draft_not_human_approved",
        golden: reference.tutoring?.map((x) => ({
          id: x.id,
          sourceRecord: x,
          result: [
            "GOLD-TUTOR-007",
            "GOLD-TUTOR-008",
            "GOLD-TUTOR-013",
            "GOLD-TUTOR-014",
            "GOLD-TUTOR-017",
            "GOLD-TUTOR-018",
          ].includes(x.id)
            ? "observed_synthetic_behavior"
            : "covered_in_PH07_not_rerun_as_independent_case",
          humanReview: "pending",
        })),
        gate2: "not_approved",
        ph09: "not_started",
      };
      writeFileSync(
        "/tmp/ph08-live-results.json",
        JSON.stringify(summary, null, 2),
      );
      await stub.close();
      await app.close();
      await pool.end();
    }
  },
);
