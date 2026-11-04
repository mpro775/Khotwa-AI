import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
import { writeFileSync, readFileSync } from "node:fs";
import pg from "pg";
import {
  seedIntegration,
  mainEquation,
  reference,
} from "../../../qa/ph07-fixtures.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
import { startAiStub } from "../../../qa/ph07-ai-stub.mjs";
const require = createRequire(import.meta.url);
test(
  "PH-07 guided tutoring on real NestJS PostgreSQL Python",
  { skip: process.env.PH07_INTEGRATION !== "true" },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL);
    assert.match(url.hostname, /^khotwa-ph07-[a-f0-9]{12}-db$/);
    assert.equal(url.pathname, "/ph07_test");
    const pool = new pg.Pool({ connectionString: url.href }),
      fixtures = await seedIntegration(pool);
    const { createApplication } = require("../dist/application.js"),
      { TutoringService } = require("../dist/tutoring.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const service = app.get(TutoringService),
      originalAi = service.ai,
      originalLimits = service.limits,
      contracts = [],
      runId = randomUUID(),
      a = createActor(await app.getUrl(), contracts),
      outsider = createActor(await app.getUrl(), contracts);
    const learning = await a.start();
    await outsider.start();
    const stub = await startAiStub();
    const coverage = new Map(),
      mark = (ids, result, evidence) =>
        ids.forEach((id) =>
          coverage.set(`GOLD-TUTOR-${String(id).padStart(3, "0")}`, {
            result,
            evidence,
          }),
        );
    async function attempt(
      original = mainEquation,
      actor = a,
      session = learning,
    ) {
      const r = await actor.request("/attempts", "POST", {
        learningSessionId: session.id,
        source: {
          kind: "catalog",
          problemRevisionId: fixtures.byEquation.get(original).revisionId,
        },
      });
      assert.equal(r.status, 201);
      return r.body.data;
    }
    async function step(at, raw, actor = a) {
      const r = await actor.request(`/attempts/${at.id}/steps`, "POST", {
        expectedRevision: at.revision,
        position: at.steps.length + 1,
        sourceRaw: raw,
        inputOrigin: "math_editor",
      });
      assert.equal(r.status, 201);
      return {
        ...at,
        revision: r.body.data.attemptRevision,
        steps: [...at.steps, r.body.data.step],
      };
    }
    const verify = (at, actor = a) =>
      actor.request(`/attempts/${at.id}/verify`, "POST", {
        expectedRevision: at.revision,
        scope: "current_sequence",
        targetStepId: null,
      });
    async function ready(
      raw = "٢س + ٣ = ١٠",
      original = mainEquation,
      actor = a,
      session = learning,
    ) {
      const at = await step(
          await attempt(original, actor, session),
          raw,
          actor,
        ),
        r = await verify(at, actor);
      assert.equal(r.status, 200);
      return { at, report: r.body.data };
    }
    const hint = (at, action = "next_hint", key = randomUUID(), actor = a) =>
      actor.request(
        `/attempts/${at.id}/hints`,
        "POST",
        {
          expectedRevision: at.revision,
          action,
          ...(action === "show_full_solution"
            ? { confirmAssistedCompletion: true }
            : {}),
        },
        key,
      );
    const state = async (at) =>
      (
        await pool.query(
          "SELECT highest_hint_level_seen,independent_evidence_eligible,full_solution_seen,assistance_revision,status FROM attempts WHERE id=$1",
          [at.id],
        )
      ).rows[0];
    const eventAudit = async (id) =>
      (
        await pool.query(
          "SELECT audit_json,math_proof_json FROM tutoring_events WHERE id=$1",
          [id],
        )
      ).rows[0];
    const useStub = async (fn) => {
      service.ai = stub.port;
      try {
        return await fn();
      } finally {
        service.ai = originalAi;
        service.limits = originalLimits;
        stub.setMode("valid");
      }
    };
    try {
      await t.test(
        "H0 is unassisted; owner-disabled AI uses authored H1/H2/H3 and verified partial math without claiming review",
        async () => {
          const { at, report } = await ready();
          const before = await state(at);
          assert.equal(before.highest_hint_level_seen, 0);
          assert.equal(before.independent_evidence_eligible, true);
          for (const level of [1, 2, 3]) {
            const r = await hint(at);
            assert.equal(r.status, 200);
            assert.equal(r.body.data.hintLevel, "H" + level);
            assert.equal(r.body.data.generationSource, "manual");
            assert.equal(r.body.data.independentEvidenceEligible, false);
            assert.deepEqual(r.body.data.solutionStepsAr, []);
            assert.equal(
              (await a.request(`/attempts/${at.id}`)).body.data
                .currentVerification.transitions[0].mathStatus,
              report.transitions[0].mathStatus,
            );
            const audit = await eventAudit(r.body.data.id);
            assert.equal(audit.audit_json.actualLlmUsed, false);
            assert.equal(audit.audit_json.callReserved, false);
            if (level === 3) assert.ok(audit.math_proof_json.length > 0);
          }
          assert.equal((await hint(at)).status, 409);
          assert.equal(stub.requests.length, 0);
          assert.equal((await state(at)).highest_hint_level_seen, 3);
          mark(
            [1, 2, 3, 4],
            "observed",
            "H0 state and explicit H1/H2/H3; no automatic H4; real identity proof for partial calculation",
          );
        },
      );
      await t.test(
        "H4 requires confirmation, verifies every transition/final answer, and does not complete the student attempt",
        async () => {
          const at = await attempt();
          const missing = await a.request(`/attempts/${at.id}/hints`, "POST", {
            expectedRevision: 0,
            action: "show_full_solution",
          });
          assert.equal(missing.status, 422);
          const r = await hint(at, "show_full_solution");
          assert.equal(r.status, 200);
          assert.equal(r.body.data.hintLevel, "H4");
          assert.equal(r.body.data.eventType, "full_solution");
          assert.equal(r.body.data.solutionStepsAr.at(-1), "س = ٢");
          const row = await state(at);
          assert.equal(row.full_solution_seen, true);
          assert.equal(row.independent_evidence_eligible, false);
          assert.equal(row.status, "in_progress");
          const audit = await eventAudit(r.body.data.id);
          assert.equal(audit.audit_json.providerKind, "not_used");
          assert.equal(audit.math_proof_json.at(-1).substitutionValid, true);
          mark(
            [5, 6],
            "observed",
            "explicit confirmation, private real-Python checks, no inferred attempt completion",
          );
        },
      );
      await t.test(
        "assistance survives edit/reload and disabling PH07; correct completion is assisted even for H1",
        async () => {
          for (const level of ["next_hint", "show_full_solution"]) {
            let { at } = await ready();
            assert.equal((await hint(at, level)).status, 200);
            const changed = await a.request(
              `/attempts/${at.id}/steps/${at.steps[0].id}`,
              "PUT",
              {
                expectedRevision: at.revision,
                sourceRaw: "س = ٢",
                inputOrigin: "math_editor",
              },
            );
            assert.equal(changed.status, 200);
            at = { ...at, revision: changed.body.data.attemptRevision };
            const enabled = process.env.PH07_API_ENABLED;
            process.env.PH07_API_ENABLED = "false";
            try {
              assert.equal((await verify(at)).status, 200);
            } finally {
              process.env.PH07_API_ENABLED = enabled;
            }
            assert.equal(
              (await a.request(`/attempts/${at.id}`)).body.data.status,
              "assisted_completed",
            );
            assert.equal(
              (await state(at)).independent_evidence_eligible,
              false,
            );
          }
          mark(
            [16],
            "observed",
            "durable assistance latch controls later mathematical completion after edit and feature disable",
          );
        },
      );
      await t.test(
        "independent transfer/probe fixtures deny all hint levels without exposing hidden content",
        async () => {
          for (const kind of ["transfer", "probe"]) {
            const { at } = await ready();
            await pool.query(
              "UPDATE attempts SET attempt_kind=$2 WHERE id=$1",
              [at.id, kind],
            );
            for (const action of ["next_hint", "show_full_solution"])
              assert.equal((await hint(at, action)).status, 409);
            assert.equal((await state(at)).highest_hint_level_seen, 0);
          }
          mark(
            [7, 8],
            "partial",
            "independent-mode denial verified; switching mode/assigning transfer is PH08 and not implemented",
          );
        },
      );
      await t.test(
        "syntax/unsupported/inconclusive never escalate assistance or call the provider",
        async () => {
          for (const raw of [
            "٢(س + ٣ = ١٠",
            "جا(س)=١",
            "س=١" + ("/" + "٩".repeat(18)).repeat(5),
          ]) {
            const { at } = await ready(raw);
            assert.equal((await hint(at)).status, 409);
            assert.equal((await state(at)).highest_hint_level_seen, 0);
          }
          mark(
            [9, 10, 11],
            "observed",
            "non-assessable contexts rejected with no assistance event or adverse skill write",
          );
        },
      );
      await t.test(
        "open probes block hints; any served assistance prevents later independent probe evidence",
        async () => {
          const { at, report } = await ready(),
            body = {
              expectedRevision: at.revision,
              verificationResultId: report.transitions[0].verificationResultId,
            };
          const p = await a.request(`/attempts/${at.id}/probes`, "POST", body);
          assert.equal(p.status, 201);
          for (const action of ["next_hint", "show_full_solution"])
            assert.equal((await hint(at, action)).status, 409);
          const unknown = p.body.data.options.find(
            (o) => o.labelAr === "لا أدري",
          );
          const answered = await a.request(
            `/attempts/${at.id}/probes/${p.body.data.id}/responses`,
            "POST",
            {
              expectedRevision: at.revision,
              answer: { kind: "choice", optionId: unknown.id },
            },
          );
          assert.equal(answered.status, 201);
          assert.equal(answered.body.data.diagnosis.state, "unresolved");
          assert.equal((await hint(at)).status, 200);
          assert.equal(
            (await a.request(`/attempts/${at.id}/probes`, "POST", body)).status,
            409,
          );
          mark(
            [15],
            "observed",
            "a differentiating open question is not bypassed by hints; no forced definitive diagnosis",
          );
          mark(
            [13, 14],
            "partial",
            "question disclosure/assistance boundary guarded; transfer item reuse and mastery summaries are PH08/09",
          );
        },
      );
      await t.test(
        "valid structured test-provider text is sanitized, versioned and never presented as real LLM output",
        async () =>
          useStub(async () => {
            const { at } = await ready(),
              r = await hint(at);
            assert.equal(r.status, 200);
            assert.equal(r.body.data.generationSource, "manual");
            const context = stub.requests.at(-1);
            for (const key of [
              "attemptId",
              "guestId",
              "sourceRaw",
              "answer_spec",
              "solutionStepsAr",
              "transferSolution",
              "history",
            ])
              assert.equal(Object.hasOwn(context, key), false);
            assert.equal(
              JSON.stringify(context).includes("PH07_SERVER_ONLY_KEY"),
              false,
            );
            assert.equal(context.maxOutputTokens, 256);
            const audit = await eventAudit(r.body.data.id);
            assert.equal(audit.audit_json.validatorAccepted, true);
            assert.equal(audit.audit_json.actualLlmUsed, false);
            assert.equal(audit.audit_json.reportedOutputTokens, 20);
          }),
      );
      await t.test(
        "unexpected provider JSON, verdict changes, leaked answers, HTML, bidi and unsafe arithmetic fall back",
        async () =>
          useStub(async () => {
            for (const mode of [
              "invalid_json",
              "extra",
              "leak",
              "wrong_math",
              "html",
              "rtl",
              "wrong_template",
              "abstain",
              "injection",
              "hidden",
              "version",
              "refused",
              "truncated",
              "tokens",
            ]) {
              stub.setMode(mode);
              const { at, report } = await ready(),
                r = await hint(at);
              assert.equal(r.status, 200, mode);
              assert.equal(r.body.data.eventType, "fallback", mode);
              assert.equal(r.body.data.generationSource, "manual");
              assert.equal(
                r.body.data.textAr,
                "انظر إلى الحدين داخل القوس: هل تأثر كل منهما بالمعامل؟",
              );
              assert.deepEqual(r.body.data.solutionStepsAr, []);
              assert.equal(
                (await a.request(`/attempts/${at.id}`)).body.data
                  .currentVerification.transitions[0].mathStatus,
                report.transitions[0].mathStatus,
              );
              assert.equal(
                JSON.stringify(await eventAudit(r.body.data.id)).includes(
                  "HIDDEN_TRANSFER_ANSWER_SENTINEL",
                ),
                false,
              );
            }
          }),
      );
      await t.test(
        "real HTTP provider timeout falls back once without losing raw input or double escalation",
        async () =>
          useStub(async () => {
            service.limits = { ...originalLimits, aiTimeoutMs: 80 };
            const release = stub.holdNext(),
              call = stub.nextCall(),
              { at } = await ready(),
              n = stub.requests.length;
            try {
              const pending = hint(at);
              await call;
              const r = await pending;
              assert.equal(r.status, 200);
              assert.equal(r.body.data.eventType, "fallback");
              assert.equal(
                (await eventAudit(r.body.data.id)).audit_json.outcome,
                "AI_TIMEOUT",
              );
              assert.equal(stub.requests.length, n + 1);
              assert.equal((await state(at)).highest_hint_level_seen, 1);
              assert.equal(
                (await a.request(`/attempts/${at.id}`)).body.data.steps[0]
                  .source.sourceRaw,
                "٢س + ٣ = ١٠",
              );
            } finally {
              release();
            }
            mark(
              [12],
              "observed",
              "real private HTTP fixture timeout returns authored safe fallback and preserves mathematics/raw",
            );
          }),
      );
      await t.test(
        "same-key concurrency and changed-key retry cannot duplicate a hint or its budget charge",
        async () =>
          useStub(async () => {
            const { at } = await ready(),
              release = stub.holdNext(),
              arrived = stub.nextCall(),
              key = randomUUID(),
              first = hint(at, "next_hint", key);
            try {
              await arrived;
              assert.equal((await hint(at, "next_hint", key)).status, 409);
              assert.equal((await hint(at)).status, 409);
              release();
              const r = await first,
                retry = await hint(at, "next_hint", key);
              assert.equal(r.status, 200);
              assert.deepEqual(retry.body.data, r.body.data);
              assert.equal(
                (
                  await pool.query(
                    "SELECT count(*)::int AS n FROM tutoring_events WHERE attempt_id=$1",
                    [at.id],
                  )
                ).rows[0].n,
                1,
              );
              assert.equal(
                (await hint(at, "show_full_solution", key)).status,
                409,
              );
            } finally {
              release();
            }
          }),
      );
      await t.test(
        "editing during provider wait rejects the late result and cached old context",
        async () =>
          useStub(async () => {
            const { at } = await ready(),
              release = stub.holdNext(),
              arrived = stub.nextCall(),
              key = randomUUID(),
              first = hint(at, "next_hint", key);
            try {
              await arrived;
              const edit = await a.request(
                `/attempts/${at.id}/steps/${at.steps[0].id}`,
                "PUT",
                {
                  expectedRevision: at.revision,
                  sourceRaw: "٢س + ٦ = ١٠",
                  inputOrigin: "math_editor",
                },
              );
              assert.equal(edit.status, 200);
              release();
              assert.equal((await first).status, 409);
              assert.equal((await state(at)).highest_hint_level_seen, 0);
              assert.equal((await hint(at, "next_hint", key)).status, 409);
              assert.equal(
                (
                  await pool.query(
                    "SELECT count(*)::int AS n FROM tutoring_events WHERE attempt_id=$1",
                    [at.id],
                  )
                ).rows[0].n,
                0,
              );
            } finally {
              release();
            }
          }),
      );
      await t.test(
        "a pending hint prevents a racing diagnostic question from becoming an independent observation",
        async () =>
          useStub(async () => {
            const { at, report } = await ready(),
              release = stub.holdNext(),
              arrived = stub.nextCall(),
              pending = hint(at);
            try {
              await arrived;
              const p = await a.request(`/attempts/${at.id}/probes`, "POST", {
                expectedRevision: at.revision,
                verificationResultId:
                  report.transitions[0].verificationResultId,
              });
              assert.equal(p.status, 409);
              release();
              assert.equal((await pending).status, 200);
            } finally {
              release();
            }
          }),
      );
      await t.test(
        "an expired hint reservation can recover, and its old worker cannot overwrite the retry",
        async () =>
          useStub(async () => {
            const { at } = await ready(),
              release = stub.holdNext(),
              arrived = stub.nextCall(),
              key = randomUUID(),
              old = hint(at, "next_hint", key);
            try {
              await arrived;
              await pool.query(
                "UPDATE hint_requests SET created_at=now()-interval '1 minute',deadline_at=now()-interval '1 second' WHERE attempt_id=$1 AND dispatch_status='running'",
                [at.id],
              );
              const recovered = await hint(at, "next_hint", key);
              assert.equal(recovered.status, 200);
              release();
              assert.equal((await old).status, 503);
              const replay = await hint(at, "next_hint", key);
              assert.deepEqual(replay.body.data, recovered.body.data);
              assert.equal(
                (
                  await pool.query(
                    "SELECT count(*)::int AS n FROM tutoring_events WHERE attempt_id=$1",
                    [at.id],
                  )
                ).rows[0].n,
                1,
              );
            } finally {
              release();
            }
          }),
      );
      await t.test(
        "call/cost/input/parallel limits are reserved atomically and use safe fallback",
        async () =>
          useStub(async () => {
            const actor = createActor(await app.getUrl(), contracts),
              session = await actor.start(),
              { at } = await ready("٢س + ٣ = ١٠", mainEquation, actor, session);
            service.limits = {
              ...originalLimits,
              guestCalls: 2,
              guestCostUnits: 10,
            };
            assert.equal(
              (await hint(at, "next_hint", randomUUID(), actor)).status,
              200,
            );
            assert.equal(
              (await hint(at, "next_hint", randomUUID(), actor)).status,
              200,
            );
            const r = await hint(at, "next_hint", randomUUID(), actor);
            assert.equal(r.status, 200);
            assert.equal(
              (await eventAudit(r.body.data.id)).audit_json.outcome,
              "AI_BUDGET_LIMIT",
            );
            const budgets = await pool.query(
              "SELECT calls_reserved,cost_units_reserved FROM ai_budget_ledgers WHERE scope<>'global' AND calls_reserved=2 AND cost_units_reserved=10",
            );
            assert.ok(budgets.rows.length);
            service.limits = { ...originalLimits, maxInputBytes: 10 };
            const next = await ready(),
              blocked = await hint(next.at);
            assert.equal(
              (await eventAudit(blocked.body.data.id)).audit_json.outcome,
              "AI_INPUT_LIMIT",
            );
            service.limits = { ...originalLimits, maxParallel: 1 };
            const held = await ready(),
              second = await ready(),
              release = stub.holdNext(),
              arrived = stub.nextCall(),
              waiting = hint(held.at);
            try {
              await arrived;
              const limited = await hint(second.at);
              assert.equal(limited.status, 200);
              assert.equal(
                (await eventAudit(limited.body.data.id)).audit_json.outcome,
                "AI_PARALLEL_LIMIT",
              );
              release();
              assert.equal((await waiting).status, 200);
            } finally {
              release();
            }
          }),
      );
      await t.test(
        "missing or mathematically invalid content never becomes an unverified H4 solution",
        async () => {
          const at = await attempt(),
            id = randomUUID(),
            key = randomUUID();
          await pool.query(
            "INSERT INTO intervention_templates SELECT $1,idummy.release_id,idummy.problem_revision_id,idummy.error_code,idummy.hint_level,'zz-invalid-test',idummy.policy_version,idummy.text_ar,idummy.allowed_rephrases,idummy.math_assertions,'[\"س = ٩\"]'::jsonb,idummy.is_synthetic,true,'draft',NULL,NULL FROM intervention_templates idummy WHERE problem_revision_id=$2 AND hint_level=4 LIMIT 1",
            [id, at.problemRevisionId],
          );
          assert.equal((await hint(at, "show_full_solution", key)).status, 503);
          assert.equal((await state(at)).highest_hint_level_seen, 0);
          await pool.query(
            "UPDATE intervention_templates SET enabled=false WHERE id=$1",
            [id],
          );
          assert.equal((await hint(at, "show_full_solution", key)).status, 200);
          const no = await attempt();
          await pool.query(
            "UPDATE intervention_templates SET enabled=false WHERE release_id=$1 AND hint_level=4",
            [fixtures.releaseId],
          );
          assert.equal((await hint(no, "show_full_solution")).status, 503);
          assert.equal((await state(no)).highest_hint_level_seen, 0);
          await pool.query(
            "UPDATE intervention_templates SET enabled=true WHERE release_id=$1 AND hint_level=4 AND id<>$2",
            [fixtures.releaseId, id],
          );
        },
      );
      await t.test(
        "legacy assisted status remains non-independent after migration and an edit without inventing H4",
        async () => {
          let { at } = await ready();
          await pool.query(
            "UPDATE attempts SET status='assisted_completed' WHERE id=$1",
            [at.id],
          );
          await pool.query(
            readFileSync(
              "apps/api/prisma/migrations/0007_preserve_legacy_assistance/migration.sql",
              "utf8",
            ),
          );
          assert.equal((await state(at)).independent_evidence_eligible, false);
          assert.equal((await state(at)).highest_hint_level_seen, 0);
          const edit = await a.request(
            `/attempts/${at.id}/steps/${at.steps[0].id}`,
            "PUT",
            {
              expectedRevision: at.revision,
              sourceRaw: "س = ٢",
              inputOrigin: "math_editor",
            },
          );
          at = { ...at, revision: edit.body.data.attemptRevision };
          assert.equal((await verify(at)).status, 200);
          assert.equal(
            (await a.request(`/attempts/${at.id}`)).body.data.status,
            "assisted_completed",
          );
        },
      );
      await t.test(
        "ownership, DTOs, immutable events and monotonic assistance are enforced",
        async () => {
          const { at } = await ready(),
            r = await hint(at, "show_full_solution");
          assert.equal(r.status, 200);
          assert.equal(
            (await hint(at, "next_hint", randomUUID(), outsider)).status,
            404,
          );
          assert.equal(
            (
              await a.request(`/attempts/${at.id}/hints`, "POST", {
                expectedRevision: at.revision,
                action: "next_hint",
                hintLevel: "H4",
              })
            ).status,
            422,
          );
          await assert.rejects(
            pool.query(
              "UPDATE tutoring_events SET rendered_text_ar='نص آخر' WHERE id=$1",
              [r.body.data.id],
            ),
            /immutable/,
          );
          await assert.rejects(
            pool.query(
              "UPDATE attempts SET highest_hint_level_seen=0,independent_evidence_eligible=true,full_solution_seen=false WHERE id=$1",
              [at.id],
            ),
            /cannot be reset/,
          );
          await assert.rejects(
            pool.query(
              "UPDATE intervention_templates SET text_ar='نص آخر' WHERE id=(SELECT template_id FROM tutoring_events WHERE id=$1)",
              [r.body.data.id],
            ),
            /versioned/,
          );
        },
      );
    } finally {
      const budgets = await pool.query(
        "SELECT count(*)::int AS buckets,COALESCE(sum(calls_reserved),0)::int AS reserved_calls,COALESCE(sum(cost_units_reserved),0)::int AS reserved_units FROM ai_budget_ledgers",
      );
      const events = await pool.query(
        "SELECT count(*)::int AS total,count(*) FILTER(WHERE generation_source='llm_validated')::int AS real_label FROM tutoring_events",
      );
      mark(
        [17, 18],
        "not_run",
        "transfer learning evidence and followup are PH08/09, not implemented here",
      );
      const golden = reference.tutoring.map((c) => ({
        id: c.id,
        sourceRecord: c,
        reviewStatus: "draft_not_human_approved",
        ...(coverage.get(c.id) ?? {
          result: "not_run",
          evidence: "scenario did not complete",
        }),
      }));
      writeFileSync(
        "/tmp/ph07-live-results.json",
        JSON.stringify(
          {
            phase: "PH-07",
            runId,
            recordedAt: new Date().toISOString(),
            contracts,
            validatedResponses: contracts.length,
            services:
              "real NestJS + PostgreSQL 17.6 + Python/SymPy; private HTTP AI test double only",
            actualExternalProviderCalls: 0,
            actualLlmInferences: 0,
            providerDecision: "owner explicitly kept external AI disabled",
            controlledProviderCalls: stub.requests.length,
            allProviderContextsOmitStudentIdentityAndHiddenAnswer:
              stub.requests.every(
                (c) =>
                  ![
                    "attemptId",
                    "guestId",
                    "sourceRaw",
                    "solutionStepsAr",
                    "transferSolution",
                    "history",
                  ].some((k) => Object.hasOwn(c, k)),
              ),
            budget: {
              ...budgets.rows[0],
              unit: "synthetic_reservation_units",
              realMonetaryCost: "not_measured_no_external_provider",
              note: "sums include global and per-guest accounting rows; not a count of unique calls",
            },
            events: events.rows[0],
            golden,
            node: process.version,
            humanContentReview: "pending",
            gate1: "blocked",
            ph08: "not_started",
          },
          null,
          2,
        ),
      );
      service.ai = originalAi;
      service.limits = originalLimits;
      await stub.close();
      await app.close();
      await pool.end();
    }
  },
);
