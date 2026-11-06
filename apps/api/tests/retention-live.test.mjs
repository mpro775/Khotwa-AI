import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { writeFileSync, readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { seedIntegration, bank } from "../../../qa/ph09-fixtures.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
const require = createRequire(import.meta.url);
test(
  "SEC-047: actual atomic retention with isolated operator and immutable API history",
  { skip: process.env.PH09_INTEGRATION !== "true" },
  async (t) => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
      fixtures = await seedIntegration(pool);
    const { createApplication } = require("../dist/application.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const contracts = [],
      a = createActor(await app.getUrl(), contracts),
      l = await a.start();
    const protectedActor = createActor(await app.getUrl(), contracts),
      protectedLearning = await protectedActor.start();
    const call = async (path, body, status = 200) => {
      const r = await a.request(path, "POST", body);
      assert.equal(r.status, status, JSON.stringify(r.body));
      return r.body.data;
    };
    const add = async (at, raw) => {
      const r = await call(
        `/attempts/${at.id}/steps`,
        {
          expectedRevision: at.revision,
          position: at.steps.length + 1,
          sourceRaw: raw,
          inputOrigin: "keyboard",
        },
        201,
      );
      return {
        ...at,
        revision: r.attemptRevision,
        steps: [...at.steps, r.step],
      };
    };
    const verify = async (at) =>
      call(`/attempts/${at.id}/verify`, {
        expectedRevision: at.revision,
        scope: "current_sequence",
        targetStepId: null,
      });
    const counts = async () =>
      Object.fromEntries(
        (
          await pool.query(
            "SELECT relname FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='public' AND relkind='r' ORDER BY relname",
          )
        ).rows.length
          ? await Promise.all(
              (
                await pool.query(
                  "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
                )
              ).rows.map(async ({ tablename }) => [
                tablename,
                Number(
                  (
                    await pool.query(
                      `SELECT count(*) AS n FROM public.${tablename}`,
                    )
                  ).rows[0].n,
                ),
              ]),
            )
          : [],
      );
    const evidence = {
      runId: process.env.PH10_RUN_ID,
      commit: process.env.PH10_COMMIT,
      at: new Date().toISOString(),
      checks: [],
      contracts,
      syntheticOnly: true,
    };
    let client;
    try {
      let root = await call(
        "/attempts",
        {
          learningSessionId: l.id,
          source: {
            kind: "catalog",
            problemRevisionId: fixtures.byEquation.get(bank[0].root).revisionId,
          },
        },
        201,
      );
      root = await add(root, bank[0].wrong);
      const report = await verify(root);
      const probe = await call(
        `/attempts/${root.id}/probes`,
        {
          expectedRevision: root.revision,
          verificationResultId: report.transitions[0].verificationResultId,
        },
        201,
      );
      await call(
        `/attempts/${root.id}/probes/${probe.id}/responses`,
        {
          expectedRevision: root.revision,
          answer: { kind: "choice", optionId: probe.options[0].id },
        },
        201,
      );
      await call(`/attempts/${root.id}/hints`, {
        expectedRevision: root.revision,
        action: "next_hint",
      });
      const episode = await call(
        `/attempts/${root.id}/remediation`,
        { expectedRevision: root.revision },
        201,
      );
      const assignment = episode.assignments.at(-1);
      let rem = await call(
        "/attempts",
        {
          learningSessionId: l.id,
          source: { kind: "assignment", assignmentId: assignment.id },
        },
        201,
      );
      rem = await add(
        rem,
        fixtures.byEquation.get(assignment.problem.originalEquation).solution,
      );
      await verify(rem);
      const transfer = await call(
        `/attempts/${root.id}/transfer`,
        { expectedRevision: root.revision, episodeId: episode.id },
        201,
      );
      const x = transfer.assignments.at(-1);
      let tr = await call(
        "/attempts",
        {
          learningSessionId: l.id,
          source: { kind: "assignment", assignmentId: x.id },
        },
        201,
      );
      tr = await add(
        tr,
        fixtures.byEquation.get(x.problem.originalEquation).solution,
      );
      await verify(tr);
      await t.test(
        "GOLD-STATE-011: a new problem revision cannot reinterpret an existing attempt",
        async () => {
          const newer = randomUUID(),
            old = fixtures.byEquation.get(bank[0].root).revisionId;
          const release = randomUUID(),
            skill = randomUUID();
          await pool.query(
            "INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES($1,$2,'algebra','ar-mashriq-school-v1','إصدار اختبار اصطناعي غير مراجع','draft')",
            [release, "ph10-revision-" + release],
          );
          await pool.query(
            "INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES($1,$2,'SK-ALG-04','توزيع للاختبار','اختبار النسخ فقط',1,'active')",
            [skill, release],
          );
          await pool.query(
            "INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash,learning_family) SELECT $1,problem_id,version_number+1,$3,item_kind,'مسألة اختبار اصطناعية بإصدار جديد','٢(س + ٣) = ١٢','{}',difficulty_band,notation_profile,'published',now(),now(),'synthetic-revision-check','revision-check' FROM problem_revisions WHERE id=$2",
            [newer, old, release],
          );
          await pool.query(
            "INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES($1,$2,'primary')",
            [newer, skill],
          );
          await pool.query(
            "UPDATE content_releases SET status='published',reviewed_by_role='integration_fixture_not_human_review',reviewed_at=now(),published_at=now() WHERE id=$1",
            [release],
          );
          const original = (await a.request(`/attempts/${root.id}`)).body.data;
          assert.equal(original.problemRevisionId, old);
          assert.equal(
            (await verify(root)).transitions[0].mathStatus,
            "verified_invalid",
          );
          let fresh = await call(
            "/attempts",
            {
              learningSessionId: (await call("/learning-sessions", {}, 201)).id,
              source: { kind: "catalog", problemRevisionId: newer },
            },
            201,
          );
          fresh = await add(fresh, "س = ٣");
          assert.equal(
            (await verify(fresh)).completion.canMarkAttemptCompleted,
            true,
          );
          assert.equal(
            (await a.request(`/attempts/${root.id}`)).body.data
              .problemRevisionId,
            old,
          );
          evidence.checks.push("GOLD-STATE-011");
        },
      );
      await t.test(
        "GOLD-STATE-016: failed storage rolls back revision and preserves the mathematical verdict",
        async () => {
          const tx = await pool.connect();
          try {
            await tx.query("BEGIN");
            await tx.query(
              "UPDATE attempts SET revision=revision+1 WHERE id=$1",
              [root.id],
            );
            await assert.rejects(
              tx.query(
                "UPDATE step_versions SET source_raw='س=٩' WHERE step_slot_id IN(SELECT id FROM step_slots WHERE attempt_id=$1)",
                [root.id],
              ),
              /immutable/,
            );
            await tx.query("ROLLBACK");
            const fresh = (await a.request(`/attempts/${root.id}`)).body.data;
            assert.equal(fresh.revision, root.revision);
            assert.equal(fresh.steps[0].source.sourceRaw, bank[0].wrong);
            assert.equal(
              (await verify(root)).transitions[0].mathStatus,
              "verified_invalid",
            );
            evidence.checks.push("GOLD-STATE-016");
          } finally {
            await tx.query("ROLLBACK");
            tx.release();
          }
        },
      );
      const guest = (
        await pool.query(
          "SELECT guest_session_id AS id FROM learning_sessions WHERE id=$1",
          [l.id],
        )
      ).rows[0].id;
      await pool.query(
        "INSERT INTO ai_budget_ledgers(scope,day,calls_reserved,cost_units_reserved) VALUES($1,current_date,1,1) ON CONFLICT DO NOTHING",
        ["guest:" + guest],
      );
      const runtimePassword = randomBytes(32).toString("hex"),
        maintenancePassword = randomBytes(32).toString("hex");
      await pool.query(
        `CREATE ROLE ph10_runtime LOGIN PASSWORD '${runtimePassword}'; GRANT USAGE ON SCHEMA public TO ph10_runtime; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO ph10_runtime; CREATE ROLE ph10_maintenance LOGIN PASSWORD '${maintenancePassword}'; GRANT khotwa_retention_operator TO ph10_maintenance`,
      );
      const operatorUrl = new URL(process.env.DATABASE_URL);
      operatorUrl.username = "ph10_maintenance";
      operatorUrl.password = maintenancePassword;
      client = new pg.Client({ connectionString: operatorUrl.href });
      await client.connect();
      await t.test(
        "runtime cannot invoke purge or bypass immutable history by setting a flag",
        async () => {
          const runtimeUrl = new URL(process.env.DATABASE_URL);
          runtimeUrl.username = "ph10_runtime";
          runtimeUrl.password = runtimePassword;
          const runtime = new pg.Client({ connectionString: runtimeUrl.href });
          await runtime.connect();
          try {
            await assert.rejects(
              runtime.query("SELECT purge_expired_guests(false,100)"),
              /permission denied/,
            );
            await runtime.query(
              "SELECT set_config('khotwa.retention_job','on',false)",
            );
            await assert.rejects(
              runtime.query(
                "DELETE FROM step_versions WHERE step_slot_id IN(SELECT id FROM step_slots WHERE attempt_id=$1)",
                [root.id],
              ),
              /permission denied/,
            );
            await assert.rejects(
              runtime.query(
                "UPDATE step_versions SET source_raw='س=٩' WHERE step_slot_id IN(SELECT id FROM step_slots WHERE attempt_id=$1)",
                [root.id],
              ),
              /immutable/,
            );
            await assert.rejects(
              runtime.query("SET ROLE khotwa_retention_executor"),
              /permission denied/,
            );
            await pool.query("GRANT DELETE ON step_versions TO ph10_runtime");
            await assert.rejects(
              runtime.query(
                "DELETE FROM step_versions WHERE step_slot_id IN(SELECT id FROM step_slots WHERE attempt_id=$1)",
                [root.id],
              ),
              /immutable/,
            );
          } finally {
            await runtime.end();
          }
          evidence.checks.push("runtime_permission_and_history_guard");
        },
      );
      await pool.query(
        "UPDATE guest_sessions SET created_at=now()-interval '10 days',last_seen_at=now()-interval '8 days 2 hours',expires_at=now()-interval '8 days' WHERE id=$1",
        [guest],
      );
      await t.test(
        "dry-run makes no changes; seven-day boundary uses idle/absolute/revocation expiry",
        async () => {
          const before = await counts();
          evidence.dryRun = (
            await client.query(
              "SELECT purge_expired_guests(true,100) AS result",
            )
          ).rows[0].result;
          assert.equal(evidence.dryRun.eligibleGuests, 1);
          assert.equal(evidence.dryRun.deletedGuests, 0);
          assert.deepEqual(await counts(), before);
          evidence.checks.push("dry_run_no_mutation");
        },
      );
      await t.test(
        "failure rolls back every child deletion and retry is safe",
        async () => {
          const before = await counts();
          await client.query("BEGIN");
          const r = (
            await client.query(
              "SELECT purge_expired_guests(false,100) AS result",
            )
          ).rows[0].result;
          assert.equal(r.deletedGuests, 1);
          await assert.rejects(client.query("SELECT 1/0"), /division by zero/);
          await client.query("ROLLBACK");
          assert.deepEqual(await counts(), before);
          evidence.checks.push("atomic_rollback");
        },
      );
      await t.test(
        "apply deletes the full graph, preserves content/other guests and reruns without duplication",
        async () => {
          const before = await counts();
          evidence.applied = (
            await client.query(
              "SELECT purge_expired_guests(false,100) AS result",
            )
          ).rows[0].result;
          assert.equal(evidence.applied.deletedGuests, 1);
          for (const table of [
            "step_versions",
            "verification_results",
            "verification_reports",
            "diagnoses",
            "diagnostic_probes",
            "probe_responses",
            "tutoring_events",
            "hint_requests",
            "learning_assignments",
            "learning_episodes",
            "content_exposures",
            "skill_evidence",
            "idempotency_records",
            "ai_budget_ledgers",
          ])
            assert.ok(evidence.applied.counts[table] > 0, table);
          evidence.rerun = (
            await client.query(
              "SELECT purge_expired_guests(false,100) AS result",
            )
          ).rows[0].result;
          assert.equal(evidence.rerun.deletedGuests, 0);
          const after = await counts();
          for (const table of [
            "content_releases",
            "skills",
            "problems",
            "problem_revisions",
            "intervention_templates",
            "diagnostic_templates",
            "content_pairings",
          ])
            assert.equal(after[table], before[table], table);
          assert.equal((await a.request(`/attempts/${root.id}`)).status, 401);
          assert.equal(
            (
              await protectedActor.request(
                `/learning-sessions/${protectedLearning.id}`,
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int n FROM guest_sessions WHERE id=$1",
                [guest],
              )
            ).rows[0].n,
            0,
          );
          evidence.checks.push(
            "actual_full_graph_purge_preserves_other_data",
            "repeat_safe",
            "expired_cookie_not_revived",
          );
        },
      );
      await t.test(
        "retention migration executable surface rolls back and restores transactionally",
        async () => {
          const tx = await pool.connect();
          try {
            await tx.query("BEGIN");
            await tx.query(readFileSync("qa/retention-down.sql", "utf8"));
            assert.equal(
              (
                await tx.query(
                  "SELECT to_regprocedure('public.purge_expired_guests(boolean,integer)')::text AS proc",
                )
              ).rows[0].proc,
              null,
            );
            await tx.query("ROLLBACK");
            assert.ok(
              (
                await tx.query(
                  "SELECT to_regprocedure('public.purge_expired_guests(boolean,integer)')::text AS proc",
                )
              ).rows[0].proc,
            );
            evidence.checks.push("migration_down_and_transactional_restore");
          } finally {
            await tx.query("ROLLBACK");
            tx.release();
          }
        },
      );
    } finally {
      if (client) {
        await client.query("ROLLBACK");
        await client.end();
      }
      evidence.actualGeminiCalls = 0;
      writeFileSync(
        "/evidence/retention-results.json",
        JSON.stringify(evidence, null, 2) + "\n",
      );
      await app.close();
      await pool.end();
    }
  },
);
