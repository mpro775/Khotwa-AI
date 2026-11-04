import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { bank, seedIntegration } from "../../../qa/ph08-fixtures.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
const require = createRequire(import.meta.url);
test(
  "PH08 new generated prose through NestJS/PG/SymPy with all external network blocked",
  { skip: process.env.PH08_GENERATIVE_INTEGRATION !== "true" },
  async (t) => {
    const nativeFetch = globalThis.fetch,
      pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
      contracts = [];
    const proof = {
      at: new Date().toISOString(),
      actualGeminiCalls: 0,
      blockedExternalAttempts: 0,
      checks: [],
      examples: [],
      metrics: [],
      error: null,
    };
    const mathHost = new URL(process.env.MATH_ENGINE_BASE_URL).hostname;
    globalThis.fetch = (input, options) => {
      const url = new URL(
        typeof input === "string" ? input : (input.url ?? input.href),
      );
      if (!["127.0.0.1", mathHost].includes(url.hostname)) {
        proof.blockedExternalAttempts++;
        throw Error("EXTERNAL_NETWORK_BLOCKED");
      }
      return nativeFetch(input, options);
    };
    let app;
    try {
      const fixtures = await seedIntegration(pool),
        { createApplication } = require("../dist/application.js"),
        { TutoringService } = require("../dist/tutoring.js");
      app = await createApplication(true);
      await app.listen(0, "127.0.0.1");
      const tutor = app.get(TutoringService),
        adapter = tutor.gemini,
        base = await app.getUrl();
      const nativeAudit = adapter.audit;
      adapter.audit = (m) => {
        nativeAudit(m);
        proof.metrics.push({ ...m, transport: "offline_simulated" });
      };
      let behavior = "generated",
        nonce = 0,
        release;
      const providerTexts = [];
      adapter.transport = async (_url, opts) => {
        const body = JSON.parse(opts.body),
          c = JSON.parse(body.contents[0].parts[0].text),
          g = c.generation.rules.grammar;
        assert.equal(
          body.generationConfig.responseJsonSchema.properties.messageAr.enum,
          undefined,
        );
        assert.ok(!opts.body.includes("attemptId"));
        assert.ok(!opts.body.includes("learningSessionId"));
        if (c.generation.profile.phase === "transfer")
          assert.equal(c.generation.profile.transferExited, true);
        if (behavior === "503")
          return new Response("not logged", { status: 503 });
        if (behavior === "timeout")
          return new Promise((_, reject) =>
            opts.signal.addEventListener(
              "abort",
              () => reject(Error("abort")),
              { once: true },
            ),
          );
        if (behavior === "late")
          await new Promise((resolve) => {
            release = resolve;
          });
        const i = nonce++;
        const text =
          behavior === "unsafe"
            ? "الحل هو اثنان."
            : behavior === "literal"
              ? c.reviewedHintTextAr
              : g.transferPrefix +
                g.introductions[1 + (i % 3)] +
                g.starters[i % g.starters.length] +
                " " +
                g.focus +
                (g.continuation[0] ?? "") +
                g.punctuation +
                g.endings[1 + (i % 2)];
        providerTexts.push(text);
        return Response.json({
          modelVersion: "gemini-3.5-flash-lite",
          usageMetadata: {
            promptTokenCount: 200,
            candidatesTokenCount: 110,
            totalTokenCount: 310,
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
                      messageAr: text,
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
      };
      const call = async (
        c,
        path,
        body,
        status = 200,
        key = randomUUID(),
        method = "POST",
      ) => {
        const r = await c.a.request(path, method, body, key);
        assert.equal(r.status, status, JSON.stringify(r.body));
        return r.body.data;
      };
      async function step(c, raw) {
        const x = await call(
          c,
          `/attempts/${c.at.id}/steps`,
          {
            expectedRevision: c.at.revision,
            position: 1,
            sourceRaw: raw,
            inputOrigin: "keyboard",
          },
          201,
        );
        c.at = { ...c.at, revision: x.attemptRevision, steps: [x.step] };
      }
      async function edit(c, raw) {
        const x = await call(
          c,
          `/attempts/${c.at.id}/steps/${c.at.steps[0].id}`,
          {
            expectedRevision: c.at.revision,
            sourceRaw: raw,
            inputOrigin: "keyboard",
          },
          200,
          undefined,
          "PUT",
        );
        c.at = { ...c.at, revision: x.attemptRevision, steps: [x.step] };
      }
      async function verify(c) {
        return (c.report = await call(c, `/attempts/${c.at.id}/verify`, {
          expectedRevision: c.at.revision,
          scope: "current_sequence",
          targetStepId: null,
        }));
      }
      async function root() {
        const a = createActor(base, contracts),
          l = await a.start(),
          c = { a, l };
        c.at = await call(
          c,
          "/attempts",
          {
            learningSessionId: l.id,
            source: {
              kind: "catalog",
              problemRevisionId: fixtures.byEquation.get(bank[0].root)
                .revisionId,
            },
          },
          201,
        );
        await step(c, bank[0].wrong);
        await verify(c);
        return c;
      }
      async function assigned() {
        const rootContext = await root(),
          e = await call(
            rootContext,
            `/attempts/${rootContext.at.id}/remediation`,
            { expectedRevision: rootContext.at.revision },
            201,
          ),
          x = e.assignments.at(-1),
          c = { ...rootContext, rootContext, e, x };
        c.at = await call(
          c,
          "/attempts",
          {
            learningSessionId: c.l.id,
            source: { kind: "assignment", assignmentId: x.id },
          },
          201,
        );
        await step(
          c,
          x.problem.originalEquation.replace(
            /([٠-٩]+)\(س ([+−]) ([٠-٩]+)\)/u,
            "$1س $2 $3",
          ),
        );
        await verify(c);
        return c;
      }
      const hint = (c, status = 200, key) =>
        call(
          c,
          `/attempts/${c.at.id}/hints`,
          { expectedRevision: c.at.revision, action: "next_hint" },
          status,
          key,
        );
      async function sameEvidence(c) {
        const fresh = await c.a.request(`/attempts/${c.at.id}`);
        assert.equal(fresh.status, 200);
        assert.equal(fresh.body.data.revision, c.at.revision);
        assert.equal(
          fresh.body.data.steps[0].source.sourceRaw,
          c.at.steps[0].source.sourceRaw,
        );
        const r = await verify(c);
        assert.equal(r.transitions[0].mathStatus, "verified_invalid");
      }
      const check = async (name, fn) =>
        t.test(name, async () => {
          await fn();
          proof.checks.push({ name, passed: true });
        });
      await check(
        "generated H1-H3 are fresh provider response bytes, not a cached template, with draft audit and unchanged math",
        async () => {
          const c = await assigned();
          for (let n = 1; n <= 3; n++) {
            const key = randomUUID(),
              event = await hint(c, 200, key),
              row = (
                await pool.query(
                  "SELECT audit_json FROM tutoring_events WHERE id=$1",
                  [event.id],
                )
              ).rows[0];
            assert.equal(event.hintLevel, `H${n}`);
            assert.equal(event.textAr, providerTexts.at(-1));
            assert.equal(event.generationSource, "llm_validated");
            assert.equal(event.eventType, "hint");
            assert.equal(row.audit_json.textOrigin, "gemini_generated");
            assert.equal(row.audit_json.actualLlmUsed, false);
            assert.equal(row.audit_json.transportMode, "offline_simulated");
            assert.equal(
              row.audit_json.generatedContentStatus,
              "draft_pending_human_review",
            );
            assert.equal(
              row.audit_json.providerValidation,
              "PH08_GENERATED_VALIDATED",
            );
            assert.equal((await hint(c, 200, key)).id, event.id);
            proof.examples.push({
              level: event.hintLevel,
              textAr: event.textAr,
              source: "simulated_provider_response",
              reviewStatus: "draft",
            });
          }
          await sameEvidence(c);
        },
      );
      await check(
        "H4 remains explicit, verified stored content and does not call Gemini",
        async () => {
          const c = await assigned(),
            before = proof.metrics.length;
          await call(
            c,
            `/attempts/${c.at.id}/hints`,
            { expectedRevision: c.at.revision, action: "show_full_solution" },
            422,
          );
          const event = await call(c, `/attempts/${c.at.id}/hints`, {
            expectedRevision: c.at.revision,
            action: "show_full_solution",
            confirmAssistedCompletion: true,
          });
          assert.equal(event.hintLevel, "H4");
          assert.equal(event.independentEvidenceEligible, false);
          assert.equal(proof.metrics.length, before);
        },
      );
      await check(
        "draft-only rejected generation returns safe 503 with no lost attempt or false reviewed fallback",
        async () => {
          const c = await assigned();
          behavior = "unsafe";
          await hint(c, 503);
          behavior = "generated";
          await sameEvidence(c);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM tutoring_events WHERE attempt_id=$1",
                [c.at.id],
              )
            ).rows[0].n,
            0,
          );
        },
      );
      // Test doubles for content review metadata only; NOT human approval of these
      // drafts. This isolated DB is destroyed after the test and never published.
      await pool.query(
        "INSERT INTO intervention_templates(id,release_id,problem_revision_id,error_code,hint_level,template_version,policy_version,text_ar,allowed_rephrases,math_assertions,solution_steps,is_synthetic,enabled,review_status,reviewed_by_role,reviewed_at) SELECT gen_random_uuid(),release_id,problem_revision_id,error_code,hint_level,'ph08-refinement-qa-review-v2',policy_version,text_ar,allowed_rephrases,math_assertions,solution_steps,true,true,'reviewed','qa_simulated_review_not_human_approval',now() FROM intervention_templates WHERE release_id=$1",
        [fixtures.releaseId],
      );
      for (const mode of ["503", "timeout", "unsafe", "literal"]) {
        await check(
          `${mode} uses reviewed-fixture fallback and retains student evidence`,
          async () => {
            const c = await assigned();
            behavior = mode;
            const event = await hint(c);
            behavior = "generated";
            assert.equal(event.eventType, "fallback");
            assert.equal(event.generationSource, "reviewed_template");
            assert.deepEqual(event.solutionStepsAr, []);
            await sameEvidence(c);
          },
        );
      }
      await check(
        "root PH07 requests stay local; foreign UUID cannot call the adapter",
        async () => {
          const a = await root(),
            b = await assigned(),
            before = proof.metrics.length;
          await hint(a);
          const r = await a.a.request(`/attempts/${b.at.id}/hints`, "POST", {
            expectedRevision: b.at.revision,
            action: "next_hint",
          });
          assert.equal(r.status, 404);
          assert.equal(proof.metrics.length, before);
        },
      );
      await check(
        "a late generated response cannot overwrite evidence after a step edit",
        async () => {
          const c = await assigned();
          behavior = "late";
          const pending = c.a.request(`/attempts/${c.at.id}/hints`, "POST", {
            expectedRevision: c.at.revision,
            action: "next_hint",
          });
          for (let i = 0; !release && i < 50; i++)
            await new Promise((resolve) => setTimeout(resolve, 10));
          assert.ok(release);
          await edit(c, "س = ٩٨");
          release();
          const result = await pending;
          behavior = "generated";
          assert.equal(result.status, 409);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM tutoring_events WHERE attempt_id=$1",
                [c.at.id],
              )
            ).rows[0].n,
            0,
          );
          await sameEvidence(c);
        },
      );
      await check(
        "transfer generation occurs only after explicit exit from independent measurement",
        async () => {
          const m = await assigned();
          await edit(
            m,
            fixtures.byEquation.get(m.x.problem.originalEquation).solution,
          );
          await verify(m);
          const r = m.rootContext,
            e = await call(
              r,
              `/attempts/${r.at.id}/transfer`,
              { expectedRevision: r.at.revision, episodeId: m.e.id },
              201,
            ),
            x = e.assignments.at(-1),
            c = { ...r, x };
          c.at = await call(
            c,
            "/attempts",
            {
              learningSessionId: c.l.id,
              source: { kind: "assignment", assignmentId: x.id },
            },
            201,
          );
          await step(c, "س = ٩٩");
          await verify(c);
          const event = await hint(c);
          assert.equal(event.independentEvidenceEligible, false);
          const row = (
            await pool.query(
              "SELECT assistance_policy,measurement_exited_at FROM learning_assignments WHERE id=$1",
              [x.id],
            )
          ).rows[0];
          assert.equal(row.assistance_policy, "guided");
          assert.ok(row.measurement_exited_at);
        },
      );
      assert.equal(proof.blockedExternalAttempts, 0);
    } catch (e) {
      proof.error = e.message;
      throw e;
    } finally {
      proof.validatedContractResponses = contracts.length;
      writeFileSync(
        "/evidence/ph08-generative-integration-results.json",
        JSON.stringify(proof, null, 2) + "\n",
      );
      if (app) await app.close();
      await pool.end();
      globalThis.fetch = nativeFetch;
    }
  },
);
