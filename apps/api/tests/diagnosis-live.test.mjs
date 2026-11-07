import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
import { writeFileSync } from "node:fs";
import pg from "pg";
import {
  seedIntegration,
  reference,
  mainEquation,
} from "../../../qa/ph06-fixtures.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
const require = createRequire(import.meta.url);
const { DIAGNOSIS_POLICY } = require("../dist/diagnosis-rules.js");
const exactGoldenResults = [];
test(
  "PH-06 conservative diagnosis on real NestJS PostgreSQL Python",
  { skip: process.env.PH06_INTEGRATION !== "true" },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL);
    assert.match(url.hostname, /^khotwa-ph06-[a-f0-9]{12}-db$/);
    assert.equal(url.pathname, "/ph06_test");
    const pool = new pg.Pool({ connectionString: url.href });
    const fixtures = await seedIntegration(pool);
    const { createApplication } = require("../dist/application.js"),
      { VerificationService } = require("../dist/verification.js"),
      { observeTransition } = require("../dist/diagnosis-rules.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const service = app.get(VerificationService),
      gateway = service.math;
    const contracts = [],
      golden = exactGoldenResults,
      runId = randomUUID(),
      a = createActor(await app.getUrl(), contracts),
      outsider = createActor(await app.getUrl(), contracts);
    const learning = await a.start();
    await outsider.start();
    async function attempt(original = mainEquation) {
      const r = await a.request("/attempts", "POST", {
        learningSessionId: learning.id,
        source: {
          kind: "catalog",
          problemRevisionId: fixtures.byEquation.get(original).revisionId,
        },
      });
      assert.equal(r.status, 201);
      return r.body.data;
    }
    async function step(at, raw) {
      const r = await a.request(`/attempts/${at.id}/steps`, "POST", {
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
    const probe = (at, report, key = randomUUID()) =>
      a.request(
        `/attempts/${at.id}/probes`,
        "POST",
        {
          expectedRevision: at.revision,
          verificationResultId:
            report.transitions[report.firstBlockingTransitionIndex ?? 0]
              .verificationResultId,
        },
        key,
      );
    const answer = (at, p, response, key = randomUUID()) =>
      a.request(
        `/attempts/${at.id}/probes/${p.id}/responses`,
        "POST",
        { expectedRevision: at.revision, answer: response },
        key,
      );
    async function wrong(original = mainEquation, raw = "٢س + ٣ = ١٠") {
      const at = await step(await attempt(original), raw),
        r = await verify(at);
      assert.equal(r.status, 200);
      return { at, report: r.body.data };
    }
    async function optionFor(p, field, expected) {
      const { rows } = await pool.query(
        "SELECT private_rules_json FROM diagnostic_probes WHERE id=$1",
        [p.id],
      );
      const entry = Object.entries(rows[0].private_rules_json).find(
        ([, rule]) =>
          expected
            ? rule[field]?.includes(expected)
            : !rule.supports?.length && !rule.rejects?.length,
      );
      assert.ok(entry);
      return entry[0];
    }
    try {
      await t.test(
        "six patterns retain distinct observations, pinned evidence, skills and policy",
        async () => {
          for (const [original, raw, pattern] of [
            [mainEquation, "٢س + ٣ = ١٠", "ERR-ALG-01"],
            ["س − ٥ = −٢", "س = −٢ − ٥", "ERR-ALG-02"],
            ["س + ٣ = ٨", "س + ٣ = ٥", "ERR-ALG-03"],
            ["٤س = ١٢", "س = ٤ × ١٢", "ERR-ALG-04"],
            ["س = ٢ + ٣", "س = ٦", "ERR-ALG-05"],
            ["−٢(س + ٣) = −١٠", "−٢س + ٦ = −١٠", "ERR-ALG-06"],
          ]) {
            const { at, report } = await wrong(original, raw),
              d = report.diagnosisCandidate;
            assert.equal(d.errorCode, pattern);
            assert.notEqual(d.state, "supported_by_probe");
            assert.ok(d.skillId);
            const stored = await pool.query(
              "SELECT * FROM diagnoses WHERE id=$1",
              [d.diagnosisId],
            );
            assert.equal(Number(stored.rows[0].attempt_revision), at.revision);
            assert.equal(
              stored.rows[0].verification_result_id,
              report.transitions[0].verificationResultId,
            );
            assert.ok(stored.rows[0].basis_json.beforeAstSha256);
            assert.ok(stored.rows[0].basis_json.evidence.witness);
            assert.equal(
              stored.rows[0].diagnosis_policy_version,
              DIAGNOSIS_POLICY,
            );
          }
        },
      );
      await t.test(
        "reviewed expectations are not invented: execute all draft Golden diagnosis cases and record exact mismatches",
        async () => {
          for (const c of reference.diagnosis) {
            const m = reference.math.find((v) => v.id === c.math);
            let candidate,
              scope = "public_saved_attempt";
            if (m.kind === "guard") {
              scope = "internal_guard_not_published";
              const context = {
                  attemptId: randomUUID(),
                  attemptRevision: 0,
                  problemRevisionId: randomUUID(),
                  notationProfile: "ar-mashriq-school-v1",
                  domain: "reals",
                },
                version = randomUUID();
              const p = await gateway.parse(
                  context,
                  { kind: "problem", stepVersionId: null },
                  m.before,
                ),
                q = await gateway.parse(
                  context,
                  { kind: "step", stepVersionId: version },
                  m.after,
                );
              const v = await gateway.verify(context, {
                fromKind: "problem",
                fromStepVersionId: null,
                toStepVersionId: version,
                fromRaw: m.before,
                toRaw: m.after,
              });
              candidate = observeTransition(
                p.ast,
                q.ast,
                {
                  mathStatus: v.status,
                  evidence: v.evidence
                    ? { ...v.evidence, kind: v.evidence.type }
                    : null,
                },
                true,
              );
              assert.equal(candidate, null);
            } else {
              const { report } = await wrong(m.before, m.after);
              candidate = report.diagnosisCandidate;
            }
            const actual = {
              state: candidate?.state ?? "none",
              pattern: candidate?.errorCode ?? "—",
            };
            const matched =
              actual.state === c.state && actual.pattern === c.pattern;
            golden.push({
              id: c.id,
              mathCase: c.math,
              scope,
              expected: { state: c.state, pattern: c.pattern },
              actual,
              matched,
              reviewStatus: "draft_not_human_approved",
              issue: matched ? null : "DATASET-ISSUE-PH06-01",
            });
            assert.ok(
              ["none", "tentative", "needs_probe", "unresolved"].includes(
                actual.state,
              ),
            );
          }
        },
      );
      await t.test(
        "questions are private-key-free, shuffled, idempotent, and single per revision even after reverify",
        async () => {
          const { at, report } = await wrong(),
            key = randomUUID();
          const [one, two] = await Promise.all([
            probe(at, report, key),
            probe(at, report, key),
          ]);
          assert.equal(one.status, 201);
          assert.deepEqual(one.body.data, two.body.data);
          const p = one.body.data;
          assert.equal((await probe(at, report)).body.data.id, p.id);
          const serialized = JSON.stringify(p);
          for (const term of [
            "rules",
            "supports",
            "rejects",
            "correctOption",
            "PH06_SERVER_ONLY_KEY",
          ])
            assert.equal(serialized.includes(term), false);
          assert.ok(p.options.every((o) => /^[0-9a-f-]{36}$/.test(o.id)));
          const choice = await optionFor(p, "supports", "ERR-ALG-01"),
            answerKey = randomUUID(),
            body = { kind: "choice", optionId: choice };
          const [r, retry] = await Promise.all([
            answer(at, p, body, answerKey),
            answer(at, p, body, answerKey),
          ]);
          assert.equal(r.status, 201);
          assert.deepEqual(r.body.data, retry.body.data);
          assert.equal(r.body.data.diagnosis.state, "supported_by_probe");
          assert.equal(r.body.data.evaluation, "supported");
          assert.equal((await answer(at, p, body)).status, 409);
          assert.equal(
            (
              await answer(
                at,
                p,
                { kind: "text", textAr: "جواب مختلف" },
                answerKey,
              )
            ).status,
            409,
          );
          const reread = await a.request(`/attempts/${at.id}`);
          assert.equal(
            reread.body.data.currentVerification.diagnosisCandidate.state,
            "supported_by_probe",
          );
          const verifiedAgain = await verify(at);
          assert.equal(
            verifiedAgain.body.data.diagnosisCandidate.diagnosisId,
            report.diagnosisCandidate.diagnosisId,
          );
          assert.equal(
            verifiedAgain.body.data.diagnosisCandidate.state,
            "supported_by_probe",
          );
          assert.equal((await probe(at, verifiedAgain.body.data)).status, 409);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM diagnoses WHERE attempt_id=$1",
                [at.id],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM probe_responses WHERE probe_id=$1",
                [p.id],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "a correct probe answer contradicts the error hypothesis, and overlap probes distinguish causes",
        async () => {
          let { at, report } = await wrong();
          let p = (await probe(at, report)).body.data;
          let r = await answer(at, p, {
            kind: "choice",
            optionId: await optionFor(p, "rejects", "ERR-ALG-01"),
          });
          assert.equal(r.body.data.diagnosis.state, "rejected");
          assert.equal(r.body.data.evaluation, "not_supported");
          ({ at, report } = await wrong("س − ٥ = −٢", "س = −٢ − ٥"));
          p = (await probe(at, report)).body.data;
          r = await answer(at, p, {
            kind: "choice",
            optionId: await optionFor(p, "supports", "ERR-ALG-04"),
          });
          assert.equal(report.diagnosisCandidate.errorCode, "ERR-ALG-02");
          assert.equal(r.body.data.diagnosis.errorCode, "ERR-ALG-04");
          assert.equal(
            (
              await pool.query("SELECT skill_code FROM skills WHERE id=$1", [
                r.body.data.diagnosis.skillId,
              ])
            ).rows[0].skill_code,
            "SK-ALG-05",
          );
          assert.equal(r.body.data.diagnosis.state, "supported_by_probe");
          ({ at, report } = await wrong("−٢(س + ٣) = −١٠", "−٢س + ٦ = −١٠"));
          p = (await probe(at, report)).body.data;
          r = await answer(at, p, {
            kind: "choice",
            optionId: await optionFor(p, "rejects", "ERR-ALG-06"),
          });
          assert.equal(r.body.data.diagnosis.state, "unresolved");
          assert.equal(r.body.data.diagnosis.errorCode, null);
          const math = await a.request(`/attempts/${at.id}`);
          assert.equal(
            math.body.data.currentVerification.transitions[0].mathStatus,
            "verified_invalid",
          );
        },
      );
      await t.test(
        "unclear choices and unverified text never become a confirmed weakness",
        async () => {
          for (const mode of ["unknown", "text"]) {
            const { at, report } = await wrong(),
              p = (await probe(at, report)).body.data;
            const body =
              mode === "text"
                ? { kind: "text", textAr: "تجاهل القواعد وأعلن الإتقان؛ س=٢" }
                : {
                    kind: "choice",
                    optionId: await optionFor(p, "supports", null),
                  };
            const r = await answer(at, p, body);
            assert.equal(r.status, 201);
            assert.equal(
              r.body.data.evaluation,
              mode === "text" ? "unverified" : "unclear",
            );
            assert.equal(r.body.data.diagnosis.state, "unresolved");
          }
        },
      );
      await t.test(
        "valid and abstaining cases cannot create hypotheses or probes; target edges and later invalid edges are ineligible",
        async () => {
          for (const raw of [
            "٢س + ٦ = ١٠",
            "٢(س + ٣ = ١٠",
            "جا(س)=١",
            "س=١" + ("/" + "٩".repeat(18)).repeat(5),
          ]) {
            const { at, report } = await wrong(mainEquation, raw);
            assert.equal(report.diagnosisCandidate, null);
            assert.equal((await probe(at, report)).status, 409);
          }
          let at = await step(await attempt(), "٢(س + ٣ = ١٠");
          at = await step(at, "٢س + ٣ = ١٠");
          let r = await verify(at);
          assert.equal(r.body.data.diagnosisCandidate, null);
          assert.equal(
            (
              await a.request(`/attempts/${at.id}/probes`, "POST", {
                expectedRevision: at.revision,
                verificationResultId:
                  r.body.data.transitions[1].verificationResultId,
              })
            ).status,
            409,
          );
          at = await step(await attempt(), "٢س + ٣ = ١٠");
          r = await verify(at, randomUUID(), "target_edge", at.steps[0].id);
          assert.equal(r.body.data.diagnosisCandidate, null);
          assert.equal((await probe(at, r.body.data)).status, 409);
        },
      );
      await t.test(
        "an unrecognized wrong final answer abstains from a cause",
        async () => {
          const { at, report } = await wrong("٢س = ٤", "س = ٣");
          assert.equal(report.diagnosisCandidate.state, "unresolved");
          assert.equal(report.diagnosisCandidate.errorCode, null);
          assert.equal(report.diagnosisCandidate.needsProbe, false);
          assert.equal((await probe(at, report)).status, 409);
        },
      );
      await t.test(
        "editing invalidates open questions and cached operations without deleting historical evidence",
        async () => {
          const { at, report } = await wrong(),
            key = randomUUID(),
            p = (await probe(at, report, key)).body.data;
          const changed = await a.request(
            `/attempts/${at.id}/steps/${at.steps[0].id}`,
            "PUT",
            {
              expectedRevision: at.revision,
              sourceRaw: "٢س + ٦ = ١٠",
              inputOrigin: "math_editor",
            },
          );
          assert.equal(changed.status, 200);
          assert.equal((await probe(at, report, key)).status, 409);
          assert.equal(
            (await answer(at, p, { kind: "choice", optionId: p.options[0].id }))
              .status,
            409,
          );
          const current = await a.request(`/attempts/${at.id}`);
          assert.equal(current.body.data.currentVerification, null);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM current_diagnoses WHERE attempt_id=$1",
                [at.id],
              )
            ).rows[0].n,
            0,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM diagnoses WHERE attempt_id=$1",
                [at.id],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "a real Python response held across an edit never persists a diagnosis",
        async () => {
          let at = await step(await attempt(), "٢س + ٣ = ١٠");
          let release, entered;
          const barrier = new Promise((r) => (release = r)),
            ready = new Promise((r) => (entered = r));
          service.math = {
            parse: (...args) => gateway.parse(...args),
            checkFinal: (...args) => gateway.checkFinal(...args),
            verify: async (...args) => {
              const v = await gateway.verify(...args);
              entered();
              await barrier;
              return v;
            },
          };
          try {
            const pending = verify(at);
            await ready;
            await a.request(
              `/attempts/${at.id}/steps/${at.steps[0].id}`,
              "PUT",
              {
                expectedRevision: at.revision,
                sourceRaw: "٢س + ٦ = ١٠",
                inputOrigin: "math_editor",
              },
            );
            release();
            assert.equal((await pending).status, 409);
            assert.equal(
              (
                await pool.query(
                  "SELECT count(*)::int AS n FROM diagnoses WHERE attempt_id=$1",
                  [at.id],
                )
              ).rows[0].n,
              0,
            );
          } finally {
            release();
            service.math = gateway;
          }
        },
      );
      await t.test(
        "disabled patterns/templates and non-synthetic sessions fail closed; guest isolation and DTOs are enforced",
        async () => {
          const { at, report } = await wrong(),
            p = (await probe(at, report)).body.data;
          assert.equal(
            (
              await outsider.request(`/attempts/${at.id}/probes`, "POST", {
                expectedRevision: at.revision,
                verificationResultId:
                  report.transitions[0].verificationResultId,
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await outsider.request(
                `/attempts/${at.id}/probes/${p.id}/responses`,
                "POST",
                {
                  expectedRevision: at.revision,
                  answer: { kind: "choice", optionId: p.options[0].id },
                },
              )
            ).status,
            404,
          );
          assert.equal(
            (await answer(at, p, { kind: "choice", optionId: "not-an-option" }))
              .status,
            422,
          );
          await pool.query(
            "UPDATE misconception_catalog SET enabled=false WHERE release_id=$1 AND error_code='ERR-ALG-01'",
            [fixtures.releaseId],
          );
          const otherPattern = await wrong("−٢(س + ٣) = −١٠", "−٢س + ٦ = −١٠");
          assert.equal(
            otherPattern.report.diagnosisCandidate.errorCode,
            "ERR-ALG-06",
          );
          assert.equal(
            (await a.request(`/attempts/${at.id}`)).body.data
              .currentVerification.diagnosisCandidate,
            null,
          );
          assert.equal(
            (await answer(at, p, { kind: "choice", optionId: p.options[0].id }))
              .status,
            409,
          );
          await pool.query(
            "UPDATE misconception_catalog SET enabled=true WHERE release_id=$1",
            [fixtures.releaseId],
          );
          await pool.query(
            "UPDATE diagnostic_templates SET enabled=false WHERE release_id=$1 AND family='distribution'",
            [fixtures.releaseId],
          );
          assert.equal((await probe(at, report)).status, 409);
          await pool.query(
            "UPDATE diagnostic_templates SET enabled=true WHERE release_id=$1",
            [fixtures.releaseId],
          );
          await pool.query(
            "UPDATE learning_sessions SET is_synthetic=false WHERE id=$1",
            [learning.id],
          );
          assert.equal((await probe(at, report)).status, 409);
          await pool.query(
            "UPDATE learning_sessions SET is_synthetic=true WHERE id=$1",
            [learning.id],
          );
          assert.equal(
            (
              await a.request(`/attempts/${at.id}/probes`, "POST", {
                expectedRevision: at.revision,
                verificationResultId:
                  report.transitions[0].verificationResultId,
                confidence: 1,
              })
            ).status,
            422,
          );
        },
      );
      await t.test(
        "real private-service failure creates neither a diagnosis nor a negative learning observation",
        async () => {
          const { MathGateway } = require("../dist/math-gateway.js");
          const at = await step(await attempt(), "٢س + ٣ = ١٠");
          service.math = new MathGateway({
            baseUrl: "http://127.0.0.1:1",
            token: process.env.MATH_INTERNAL_TOKEN,
            timeoutMs: 150,
            expectedEngine: "0.3.0",
          });
          try {
            const r = await verify(at);
            assert.equal(r.status, 503);
            assert.equal(r.body.error.code, "math_unavailable");
            assert.equal(
              (
                await pool.query(
                  "SELECT count(*)::int AS n FROM diagnoses WHERE attempt_id=$1",
                  [at.id],
                )
              ).rows[0].n,
              0,
            );
            assert.equal(
              (await a.request(`/attempts/${at.id}`)).body.data.steps[0].source
                .sourceRaw,
              "٢س + ٣ = ١٠",
            );
          } finally {
            service.math = gateway;
          }
        },
      );
      await t.test(
        "diagnosis and probe history are immutable and template changes require a new version",
        async () => {
          const { at, report } = await wrong(),
            p = (await probe(at, report)).body.data;
          await assert.rejects(
            pool.query("UPDATE diagnoses SET candidate_json='{}' WHERE id=$1", [
              report.diagnosisCandidate.diagnosisId,
            ]),
            /immutable/,
          );
          await assert.rejects(
            pool.query("DELETE FROM diagnostic_probes WHERE id=$1", [p.id]),
            /immutable/,
          );
          await assert.rejects(
            pool.query(
              "UPDATE diagnostic_templates SET question_ar='نص آخر' WHERE id=(SELECT template_id FROM diagnostic_probes WHERE id=$1)",
              [p.id],
            ),
            /versioned/,
          );
          const row = await pool.query(
            "SELECT review_status,reviewed_by_role FROM diagnostic_templates LIMIT 1",
          );
          assert.equal(row.rows[0].review_status, "draft");
          assert.equal(row.rows[0].reviewed_by_role, null);
        },
      );
    } finally {
      const mismatches = golden.filter((v) => !v.matched);
      writeFileSync(
        "/tmp/ph06-live-results.json",
        JSON.stringify(
          {
            phase: "PH-06",
            runId,
            recordedAt: new Date().toISOString(),
            contracts,
            validatedResponses: contracts.length,
            golden,
            goldenMatched: golden.filter((v) => v.matched).length,
            goldenMismatches: mismatches,
            goldenConformance: mismatches.length
              ? "not_passed_pending_reference_review"
              : "draft_only_not_acceptance",
            reviewerApproval: "pending",
            syntheticOnly: true,
            services:
              "real NestJS + PostgreSQL 17.6 + Python/SymPy; no external AI",
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

test(
  "exact conformance to every draft GOLD-DIAG state and pattern (no exemptions)",
  { skip: process.env.PH06_INTEGRATION !== "true" },
  () => {
    assert.equal(exactGoldenResults.length, reference.diagnosis.length);
    assert.deepEqual(
      exactGoldenResults.filter((v) => !v.matched),
      [],
      "Reference mismatches require content/QA review; no expected values were changed",
    );
  },
);
