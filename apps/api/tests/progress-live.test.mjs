import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { seedIntegration, bank } from "../../../qa/ph09-fixtures.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
import { startAiStub } from "../../../qa/ph07-ai-stub.mjs";
import { mathFaultProxy } from "../../../qa/ph09-fault-proxy.mjs";
const require = createRequire(import.meta.url);
test(
  "PH09 current progress, isolated teacher artifact and failure/security boundaries",
  { skip: process.env.PH09_INTEGRATION !== "true" },
  async (t) => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
      fixtures = await seedIntegration(pool),
      contracts = [],
      runId = randomUUID();
    const { createApplication } = require("../dist/application.js"),
      { TutoringService } = require("../dist/tutoring.js"),
      { VerificationService } = require("../dist/verification.js"),
      { MathGateway } = require("../dist/math-gateway.js"),
      { retentionReview } = require("../dist/retention-review.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl(),
      tutor = app.get(TutoringService),
      verification = app.get(VerificationService),
      originalMath = verification.math,
      originalAi = tutor.ai,
      originalLimits = tutor.limits;
    const ai = await startAiStub(),
      proxy = await mathFaultProxy(
        process.env.MATH_ENGINE_BASE_URL,
        process.env.MATH_INTERNAL_TOKEN,
      ),
      httpMath = new MathGateway({
        baseUrl: proxy.url,
        token: process.env.MATH_INTERNAL_TOKEN,
        timeoutMs: 150,
        expectedEngine: "0.3.0",
      });
    const examples = JSON.parse(
        readFileSync("apps/api/data/teacher-demo.v1.json"),
      ).examples,
      mathProofs = [],
      review = [];
    async function actor() {
      const a = createActor(base, contracts);
      return { a, l: await a.start() };
    }
    async function root(context) {
      const c = context ?? (await actor());
      const r = await c.a.request("/attempts", "POST", {
        learningSessionId: c.l.id,
        source: {
          kind: "catalog",
          problemRevisionId: fixtures.byEquation.get(bank[0].root).revisionId,
        },
      });
      assert.equal(r.status, 201);
      return { ...c, at: r.body.data };
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
    }
    async function edit(c, raw) {
      const r = await c.a.request(
        `/attempts/${c.at.id}/steps/${c.at.steps[0].id}`,
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
        steps: [r.body.data.step],
      };
    }
    const body = (c) => ({
      expectedRevision: c.at.revision,
      scope: "current_sequence",
      targetStepId: null,
    });
    const verify = (c, key = randomUUID()) =>
      c.a.request(`/attempts/${c.at.id}/verify`, "POST", body(c), key);
    async function ready(context) {
      const c = await root(context);
      await step(c, "٢س + ٣ = ١٠");
      const r = await verify(c);
      assert.equal(r.status, 200);
      c.report = r.body.data;
      return c;
    }
    async function remediation(c) {
      const r = await c.a.request(`/attempts/${c.at.id}/remediation`, "POST", {
        expectedRevision: c.at.revision,
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body.data;
    }
    async function open(c, x) {
      const r = await c.a.request("/attempts", "POST", {
        learningSessionId: c.l.id,
        source: { kind: "assignment", assignmentId: x.id },
      });
      assert.equal(r.status, 201);
      return { ...c, at: r.body.data, x };
    }
    async function solve(c) {
      const answer = fixtures.byEquation.get(
        c.x.problem.originalEquation,
      ).solution;
      if (c.at.steps.length) await edit(c, answer);
      else await step(c, answer);
      const r = await verify(c);
      assert.equal(r.status, 200);
      assert.equal(r.body.data.completion.canMarkAttemptCompleted, true);
      return r.body.data;
    }
    async function progress(c) {
      const r = await c.a.request("/progress?learningSessionId=" + c.l.id);
      assert.equal(r.status, 200);
      return r.body.data;
    }
    async function transferReady(context) {
      const c = await ready(context),
        e = await remediation(c),
        m = await open(c, e.assignments.at(-1));
      await solve(m);
      const r = await c.a.request(`/attempts/${c.at.id}/transfer`, "POST", {
        expectedRevision: c.at.revision,
        episodeId: e.id,
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const x = r.body.data.assignments.at(-1),
        n = await open(c, x);
      return { c, e, m, n, x };
    }
    const hint = (c, action = "next_hint") =>
      c.a.request(`/attempts/${c.at.id}/hints`, "POST", {
        expectedRevision: c.at.revision,
        action,
        ...(action === "show_full_solution"
          ? { confirmAssistedCompletion: true }
          : {}),
      });
    try {
      await t.test(
        "teacher math examples are real verified counterexamples, with no hidden bank or live attempt IDs",
        async () => {
          for (const e of examples) {
            const r = await originalMath.verify(
              {
                attemptId: randomUUID(),
                attemptRevision: 0,
                problemRevisionId: e.problem.revisionId,
                notationProfile: "ar-mashriq-school-v1",
                domain: "reals",
              },
              {
                fromKind: "problem",
                fromStepVersionId: null,
                toStepVersionId: randomUUID(),
                fromRaw: e.problem.originalEquation,
                toRaw: e.steps[0].source.sourceRaw,
              },
            );
            assert.equal(r.status, e.mathStatus);
            assert.ok(r.evidence);
            mathProofs.push({
              exampleId: e.id,
              status: r.status,
              evidence: r.evidence,
              engine: r.engineVersion,
            });
            assert.ok(
              ![...fixtures.byEquation.keys()].includes(
                e.problem.originalEquation,
              ),
            );
          }
        },
      );
      await t.test(
        "three progress states and per-skill detail match actual current evidence without mastery scores",
        async () => {
          const c = await ready();
          assert.ok(
            (await progress(c)).skills.every(
              (s) =>
                s.state === "not_assessed" &&
                s.evidenceCount === 0 &&
                s.updatedAt === null,
            ),
          );
          const e = await remediation(c),
            m = await open(c, e.assignments.at(-1));
          assert.equal((await hint(m, "show_full_solution")).status, 200);
          await solve(m);
          const practice = (await progress(c)).skills.find(
            (s) => s.skillId === e.skillId,
          );
          assert.equal(practice.state, "practice_with_support");
          assert.equal(practice.assistedPracticeCount, 1);
          assert.equal(practice.independentTransferCount, 0);
          const r = await c.a.request(`/attempts/${c.at.id}/transfer`, "POST", {
            expectedRevision: c.at.revision,
            episodeId: e.id,
          });
          const n = await open(c, r.body.data.assignments.at(-1));
          await solve(n);
          const skill = (await progress(c)).skills.find(
            (s) => s.skillId === e.skillId,
          );
          assert.equal(skill.state, "new_evidence_of_understanding");
          assert.equal(skill.independentTransferCount, 1);
          assert.equal(skill.evidenceCount, 2);
          const detail = await c.a.request(
            "/progress/skills/" + e.skillId + "?learningSessionId=" + c.l.id,
          );
          assert.deepEqual(detail.body.data, skill);
          const facts = (
            await pool.query(
              "SELECT observation,event_kind FROM current_skill_evidence WHERE learning_session_id=$1",
              [c.l.id],
            )
          ).rows;
          assert.equal(facts.length, skill.evidenceCount);
          assert.equal(
            facts.filter(
              (f) =>
                f.observation === "positive" &&
                f.event_kind === "transfer_observation",
            ).length,
            skill.independentTransferCount,
          );
          assert.ok(
            !Object.keys(skill).some((k) => /score|percent|mastery/i.test(k)),
          );
          review.push({
            case: "states_and_source",
            evidenceCount: skill.evidenceCount,
            independentTransferCount: skill.independentTransferCount,
            assistedPracticeCount: skill.assistedPracticeCount,
          });
        },
      );
      await t.test(
        "duplicate source events and repeated verification do not double count a completed attempt",
        async () => {
          const { c, n, e } = await transferReady();
          await solve(n);
          await pool.query(
            "INSERT INTO skill_evidence(id,learning_session_id,skill_id,attempt_id,attempt_revision,problem_revision_id,report_id,assignment_id,event_kind,observation,assistance_snapshot,assistance_revision,policy_version,content_release_id,dedup_key) SELECT $1,learning_session_id,skill_id,attempt_id,attempt_revision,problem_revision_id,report_id,assignment_id,event_kind,observation,assistance_snapshot,assistance_revision,policy_version,content_release_id,$2 FROM skill_evidence WHERE attempt_id=$3 LIMIT 1",
            [randomUUID(), "ph09-duplicate-" + randomUUID(), n.at.id],
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM skill_evidence WHERE attempt_id=$1",
                [n.at.id],
              )
            ).rows[0].n,
            2,
          );
          assert.equal(
            (await progress(c)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            1,
          );
          assert.equal((await verify(n)).status, 200);
          assert.equal(
            (await progress(c)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            1,
          );
        },
      );
      await t.test(
        "content withdrawal, assignment mode and source revisions immediately remove stale positive evidence",
        async () => {
          const { c, n, e, x } = await transferReady();
          await solve(n);
          const [pair] = (
            await pool.query(
              "SELECT pairing_id FROM learning_assignments WHERE id=$1",
              [x.id],
            )
          ).rows;
          await pool.query(
            "UPDATE content_pairings SET enabled=false WHERE id=$1",
            [pair.pairing_id],
          );
          assert.equal(
            (await progress(c)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
          await pool.query(
            "UPDATE content_pairings SET enabled=true WHERE id=$1",
            [pair.pairing_id],
          );
          assert.equal(
            (await progress(c)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            1,
          );
          await pool.query(
            "UPDATE learning_assignments SET assistance_policy='guided',measurement_exited_at=now() WHERE id=$1",
            [x.id],
          );
          assert.equal(
            (await progress(c)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
          await edit(c, "س = ٩٩");
          assert.equal(
            (await progress(c)).skills.find((s) => s.skillId === e.skillId)
              .evidenceCount,
            0,
          );
        },
      );
      await t.test(
        "a new non-assessable transfer does not erase another current independent observation",
        async () => {
          const first = await transferReady();
          await solve(first.n);
          const next = await transferReady({ a: first.c.a, l: first.c.l });
          await step(next.n, "جا(٣٠) = ١");
          assert.equal(
            (await verify(next.n)).body.data.transitions[0].mathStatus,
            "unsupported",
          );
          const skill = (await progress(first.c)).skills.find(
            (s) => s.skillId === first.e.skillId,
          );
          assert.equal(skill.independentTransferCount, 1);
          assert.equal(skill.state, "new_evidence_of_understanding");
        },
      );
      await t.test(
        "teacher cards always read the fixed synthetic source, independent of guest data and feature-source selectors",
        async () => {
          const c = await ready(),
            other = await actor(),
            summary = await c.a.request("/teacher-demo/summary");
          assert.equal(summary.status, 200);
          assert.equal(summary.body.data.isSynthetic, true);
          assert.equal(summary.body.data.sampleStudentCount, 8);
          assert.equal(summary.body.data.sampleAttemptCount, 12);
          const privateAttempt = await root({ a: c.a, l: c.l });
          await step(privateAttempt, "PH09_PRIVATE_LEARNER_TEXT");
          process.env.TEACHER_DEMO_SOURCE = "database";
          const foreign = await other.a.request("/teacher-demo/summary");
          delete process.env.TEACHER_DEMO_SOURCE;
          assert.deepEqual(foreign.body.data, summary.body.data);
          for (const id of summary.body.data.exampleIds) {
            const ex = await other.a.request("/teacher-demo/examples/" + id);
            assert.equal(ex.status, 200);
            assert.equal(ex.body.data.isSynthetic, true);
            assert.equal(
              ex.body.data.datasetCode,
              summary.body.data.datasetCode,
            );
            assert.ok(
              !ex.text.includes(c.at.id) &&
                !ex.text.includes(c.l.id) &&
                !ex.text.includes("PH09_PRIVATE_LEARNER_TEXT"),
            );
            assert.equal(
              (await c.a.request("/problems/" + ex.body.data.problem.id))
                .status,
              404,
            );
          }
          assert.equal(
            (await c.a.request("/teacher-demo/examples/" + c.at.id)).status,
            404,
          );
          for (const q of [
            "attemptId=" + c.at.id,
            "learningSessionId=" + c.l.id,
            "isSynthetic=false",
            "source=database",
          ])
            assert.equal(
              (await c.a.request("/teacher-demo/summary?" + q)).status,
              404,
            );
        },
      );
      await t.test(
        "anonymous and foreign-session reads cannot resolve progress, examples or learning resources",
        async () => {
          const { c, e, n } = await transferReady(),
            other = await actor(),
            anon = createActor(base, contracts);
          for (const path of [
            "/teacher-demo/summary",
            "/teacher-demo/examples/" + examples[0].id,
            "/progress?learningSessionId=" + c.l.id,
          ])
            assert.equal((await anon.request(path)).status, 401);
          for (const path of [
            "/progress?learningSessionId=" + c.l.id,
            "/progress/skills/" + e.skillId + "?learningSessionId=" + c.l.id,
            "/learning-episodes/" + e.id,
            "/attempts/" + n.at.id,
          ])
            assert.equal((await other.a.request(path)).status, 404);
          assert.equal(
            (
              await c.a.request(
                "/progress?learningSessionId=" + c.l.id + "&isSynthetic=true",
              )
            ).status,
            400,
          );
          await pool.query(
            "UPDATE learning_sessions SET is_synthetic=false WHERE id=$1",
            [c.l.id],
          );
          assert.equal(
            (await c.a.request("/progress?learningSessionId=" + c.l.id)).status,
            404,
          );
          assert.equal(
            (await c.a.request("/teacher-demo/summary")).status,
            200,
          );
        },
      );
      await t.test(
        "absolute expiry and idle expiry revoke read permission including teacher demo",
        async () => {
          for (const mode of ["absolute", "idle"]) {
            const c = await actor();
            await pool.query(
              mode === "absolute"
                ? "UPDATE guest_sessions SET created_at=now()-interval '1 day',expires_at=now()-interval '1 second' WHERE id=(SELECT guest_session_id FROM learning_sessions WHERE id=$1)"
                : "UPDATE guest_sessions SET last_seen_at=now()-interval '2 hours 1 second' WHERE id=(SELECT guest_session_id FROM learning_sessions WHERE id=$1)",
              [c.l.id],
            );
            const r = await c.a.request("/teacher-demo/summary");
            assert.equal(r.status, 401);
            assert.equal(r.body.error.code, "session_expired");
            assert.equal(
              (await c.a.request("/progress?learningSessionId=" + c.l.id))
                .status,
              401,
            );
          }
        },
      );
      await t.test(
        "logout is repeatable revocation, not a false claim of deleting stored work",
        async () => {
          const c = await ready(),
            key = randomUUID(),
            cookie = c.a.jar.get("kh_guest");
          const countBefore = (
            await pool.query(
              "SELECT count(*)::int AS n FROM step_versions v JOIN step_slots s ON s.id=v.step_slot_id WHERE s.attempt_id=$1",
              [c.at.id],
            )
          ).rows[0].n;
          assert.equal(
            (
              await c.a.request(
                "/guest-sessions/current",
                "DELETE",
                undefined,
                key,
              )
            ).status,
            204,
          );
          c.a.jar.set("kh_guest", cookie);
          assert.equal(
            (
              await c.a.request(
                "/guest-sessions/current",
                "DELETE",
                undefined,
                key,
              )
            ).status,
            204,
          );
          c.a.jar.set("kh_guest", cookie);
          assert.equal(
            (await c.a.request("/teacher-demo/summary")).status,
            401,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM step_versions v JOIN step_slots s ON s.id=v.step_slot_id WHERE s.attempt_id=$1",
                [c.at.id],
              )
            ).rows[0].n,
            countBefore,
          );
          const [g] = (
            await pool.query(
              "SELECT expires_at,last_seen_at,revoked_at FROM guest_sessions WHERE id=(SELECT guest_session_id FROM learning_sessions WHERE id=$1)",
              [c.l.id],
            )
          ).rows;
          const retention = retentionReview(
            {
              expiresAt: g.expires_at,
              lastSeenAt: g.last_seen_at,
              revokedAt: g.revoked_at,
            },
            new Date(),
          );
          assert.equal(retention.eligible, false);
          assert.equal(retention.action, "review_only_no_deletion");
          review.push({
            case: "retention_and_logout",
            deleted: false,
            retentionWindowDays: 7,
            reviewOnly: true,
          });
        },
      );
      await t.test(
        "Origin, CSRF and secure cookies stay mandatory and errors do not disclose stacks or credentials",
        async () => {
          const c = await root(),
            mutation = {
              expectedRevision: 0,
              position: 1,
              sourceRaw: "س = ٢",
              inputOrigin: "keyboard",
            };
          const badOrigin = await c.a.request(
            `/attempts/${c.at.id}/steps`,
            "POST",
            mutation,
            randomUUID(),
            { origin: "https://untrusted.invalid" },
          );
          assert.equal(badOrigin.status, 403);
          const cookie = [...c.a.jar].map(([k, v]) => k + "=" + v).join("; ");
          const response = await fetch(
            base + "/api/v1/attempts/" + c.at.id + "/steps",
            {
              method: "POST",
              headers: {
                origin: "https://localhost:8443",
                cookie,
                "content-type": "application/json",
                "x-csrf-token": "a".repeat(64),
                "idempotency-key": randomUUID(),
              },
              body: JSON.stringify(mutation),
            },
          );
          assert.equal(response.status, 403);
          const text = await response.text();
          assert.ok(!/stack|Prisma|DATABASE_URL|GUEST_DIGEST_KEY/.test(text));
          const b = await c.a.request("/bootstrap"),
            guest = await c.a.request("/guest-sessions", "POST", {});
          assert.equal(b.status, 200);
          assert.equal(guest.status, 200);
          for (const flag of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/"])
            assert.ok(guest.headers.getSetCookie()[0].includes(flag));
          assert.equal(
            guest.headers.getSetCookie()[0].includes("Domain="),
            false,
          );
        },
      );
      await t.test(
        "parallel duplicate keys and revision races never duplicate student work",
        async () => {
          const c = await root(),
            b = {
              expectedRevision: 0,
              position: 1,
              sourceRaw: "س = ٢",
              inputOrigin: "keyboard",
            },
            key = randomUUID();
          const r = await Promise.all([
            c.a.request(`/attempts/${c.at.id}/steps`, "POST", b, key),
            c.a.request(`/attempts/${c.at.id}/steps`, "POST", b, key),
          ]);
          assert.equal(r[0].status, 201);
          assert.equal(r[1].status, 201);
          assert.equal(r[0].body.data.step.id, r[1].body.data.step.id);
          const next = { ...b, expectedRevision: 1, position: 2 };
          const race = await Promise.all([
            c.a.request(`/attempts/${c.at.id}/steps`, "POST", next),
            c.a.request(`/attempts/${c.at.id}/steps`, "POST", next),
          ]);
          assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
          const rows = await pool.query(
            "SELECT count(*)::int AS n FROM step_slots WHERE attempt_id=$1 AND is_active",
            [c.at.id],
          );
          assert.equal(rows.rows[0].n, 2);
          assert.equal(
            (
              await c.a.request(
                `/attempts/${c.at.id}/steps`,
                "POST",
                { ...b, sourceRaw: "س = ٣" },
                key,
              )
            ).status,
            409,
          );
        },
      );
      await t.test(
        "real HTTP Python failure and timeout preserve saved raw, prior facts and safe same-key retry",
        async () => {
          const { c, n, e } = await transferReady();
          await solve(n);
          const original = (await c.a.request("/attempts/" + n.at.id)).body
            .data;
          verification.math = httpMath;
          try {
            for (const mode of ["503", "timeout", "invalid_json"]) {
              proxy.setMode(mode);
              const key = randomUUID(),
                r = await verify(n, key);
              assert.equal(r.status, 503);
              assert.equal(r.body.error.code, "math_unavailable");
              const current = (await c.a.request("/attempts/" + n.at.id)).body
                .data;
              assert.equal(
                current.steps[0].source.sourceRaw,
                original.steps[0].source.sourceRaw,
              );
              assert.equal(current.revision, original.revision);
              assert.equal(
                current.currentVerification.id,
                original.currentVerification.id,
              );
              assert.equal(
                (await progress(c)).skills.find((s) => s.skillId === e.skillId)
                  .independentTransferCount,
                1,
              );
              proxy.setMode("forward");
              assert.equal((await verify(n, key)).status, 200);
              original.currentVerification = (
                await c.a.request("/attempts/" + n.at.id)
              ).body.data.currentVerification;
            }
          } finally {
            verification.math = originalMath;
            proxy.setMode("forward");
          }
        },
      );
      await t.test(
        "Python failure after an edit produces no negative skill event or overwritten source",
        async () => {
          const { c, n, e } = await transferReady();
          await solve(n);
          await edit(n, "س = ٩٩");
          const count = (
            await pool.query(
              "SELECT count(*)::int AS n FROM skill_evidence WHERE attempt_id=$1",
              [n.at.id],
            )
          ).rows[0].n;
          verification.math = httpMath;
          proxy.setMode("503");
          try {
            assert.equal((await verify(n)).status, 503);
          } finally {
            verification.math = originalMath;
            proxy.setMode("forward");
          }
          assert.equal(
            (await c.a.request("/attempts/" + n.at.id)).body.data.steps[0]
              .source.sourceRaw,
            "س = ٩٩",
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM skill_evidence WHERE attempt_id=$1",
                [n.at.id],
              )
            ).rows[0].n,
            count,
          );
          assert.equal(
            (await progress(c)).skills.find((s) => s.skillId === e.skillId)
              .independentTransferCount,
            0,
          );
        },
      );
      await t.test(
        "AI invalid JSON and HTTP timeout use a draft fallback while preserving verified math and private raw",
        async () => {
          const c = await ready(),
            before = JSON.stringify(c.report);
          tutor.ai = ai.port;
          try {
            ai.setMode("invalid_json");
            const r = await hint(c);
            assert.equal(r.status, 200);
            assert.equal(r.body.data.eventType, "fallback");
            assert.equal(r.body.data.generationSource, "manual");
            tutor.limits = { ...originalLimits, aiTimeoutMs: 40 };
            ai.setMode("valid");
            const release = ai.holdNext();
            try {
              const r = await hint(c);
              assert.equal(r.status, 200);
              assert.equal(r.body.data.eventType, "fallback");
            } finally {
              release();
            }
            const after = await c.a.request("/attempts/" + c.at.id);
            assert.equal(
              after.body.data.steps[0].source.sourceRaw,
              "٢س + ٣ = ١٠",
            );
            assert.equal(
              after.body.data.currentVerification.transitions[0].mathStatus,
              c.report.transitions[0].mathStatus,
            );
            assert.equal(JSON.stringify(c.report), before);
            assert.ok(
              ai.requests.every(
                (r) =>
                  !JSON.stringify(r).includes(c.at.id) &&
                  !JSON.stringify(r).includes(c.l.id) &&
                  !JSON.stringify(r).includes("sourceRaw"),
              ),
            );
          } finally {
            tutor.ai = originalAi;
            tutor.limits = originalLimits;
          }
        },
      );
      await t.test(
        "a held real Python response cannot restore an old revision or its progress",
        async () => {
          const { c, n, e } = await transferReady();
          await solve(n);
          verification.math = new MathGateway({
            baseUrl: proxy.url,
            token: process.env.MATH_INTERNAL_TOKEN,
            timeoutMs: 2500,
            expectedEngine: "0.3.0",
          });
          proxy.setMode("forward");
          const release = proxy.holdNext(),
            arrived = proxy.nextCall();
          try {
            const pending = verify(n);
            await arrived;
            await edit(n, "س = ٩٩");
            release();
            const r = await pending;
            assert.equal(r.status, 409);
            const current = (await c.a.request("/attempts/" + n.at.id)).body
              .data;
            assert.equal(current.steps[0].source.sourceRaw, "س = ٩٩");
            assert.equal(current.currentVerification, null);
            assert.equal(
              (await progress(c)).skills.find((s) => s.skillId === e.skillId)
                .independentTransferCount,
              0,
            );
          } finally {
            release();
            verification.math = originalMath;
          }
        },
      );
    } finally {
      verification.math = originalMath;
      tutor.ai = originalAi;
      tutor.limits = originalLimits;
      delete process.env.TEACHER_DEMO_SOURCE;
      const artifact = JSON.parse(
          readFileSync("apps/api/data/teacher-demo.v1.json"),
        ),
        summary = await app
          .get(require("../dist/teacher-demo.js").TeacherDemoService)
          .summary();
      const result = {
        phase: "PH-09",
        runId,
        recordedAt: new Date().toISOString(),
        services:
          "real NestJS/PostgreSQL17.6/Python/SymPy; loopback HTTP fault proxies and AI test double only",
        validatedResponses: contracts.length,
        contracts,
        teacher: {
          datasetCode: artifact.datasetCode,
          source: "fixed authored synthetic artifact, no learner DB queries",
          sampleStudentCount: summary.sampleStudentCount,
          sampleAttemptCount: summary.sampleAttemptCount,
          metrics: summary.metrics,
          mathProofs,
          contentReview: "pending",
        },
        review,
        pythonFaultRequests: proxy.requests,
        controlledAiCalls: ai.requests.length,
        actualExternalProviderCalls: 0,
        actualLlmInferences: 0,
        retention: {
          eligibilityReview: "tested",
          actualPurge: "not_implemented_pending_data_security_review",
          deletedRecords: 0,
        },
        gate2: "not_approved",
        gate3: "not_approved",
        ph10: "not_started",
      };
      writeFileSync(
        "/tmp/ph09-live-results.json",
        JSON.stringify(result, null, 2),
      );
      await proxy.close();
      await ai.close();
      await app.close();
      await pool.end();
    }
  },
);
