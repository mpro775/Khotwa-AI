import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import Ajv2020 from "ajv/dist/2020.js";
import { bank, seedIntegration } from "../../../qa/ph08-fixtures.mjs";
import { installReviewedContent } from "../../../qa/ph08-reviewed-content.mjs";
import { createActor } from "../../../qa/ph05-http-client.mjs";
const require = createRequire(import.meta.url);
test(
  "Owner-authorized PH08 live generative round: maximum four, sequential, no retry",
  { skip: process.env.PH08_FINAL_LIVE_INTEGRATION !== "true" },
  async () => {
    const nativeFetch = globalThis.fetch,
      contracts = [],
      pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const proof = {
      authorizationId: "PH08-OWNER-2026-11-06-LIVE4",
      date: "2026-11-06",
      at: new Date().toISOString(),
      status: "RUNNING",
      roundLimit: 4,
      requestsSent: 0,
      dailyQuota: {
        rpd: null,
        remaining: null,
        policy: "owner_authorized_unknown_rpd_live4",
      },
      calls: [],
      error: null,
    };
    const {
        validateTutorReply,
        HINT_REPLY_SCHEMA,
      } = require("../dist/ai-tutor.js"),
      { validateGeneratedMeaning } = require("../dist/ph08-generative.js");
    const validateSchema = new Ajv2020({ strict: false }).compile(
      HINT_REPLY_SCHEMA,
    );
    let app,
      adapter,
      halted = false;
    try {
      const fixtures = await seedIntegration(pool);
      proof.installed = await installReviewedContent(pool, fixtures);
      const { createApplication } = require("../dist/application.js"),
        { TutoringService } = require("../dist/tutoring.js");
      app = await createApplication(true);
      await app.listen(0, "127.0.0.1");
      const tutor = app.get(TutoringService);
      adapter = tutor.gemini;
      const base = await app.getUrl();
      const nativeAudit = adapter.audit;
      adapter.audit = (m) => {
        nativeAudit(m);
        Object.assign(proof.calls.at(-1), { metric: m });
      };
      adapter.transport = async (url, opts) => {
        assert.equal(
          url,
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
        );
        if (halted || proof.requestsSent >= 4) throw Error("LIVE4_HARD_STOP");
        const body = JSON.parse(opts.body),
          c = JSON.parse(body.contents[0].parts[0].text);
        assert.ok(!opts.body.includes("attemptId"));
        assert.ok(!opts.body.includes("learningSessionId"));
        const record = {
          requestNumber: ++proof.requestsSent,
          level: c.targetHintLevel,
          phase: c.generation.profile.phase,
          httpStatus: null,
          modelVersion: null,
          latencyMs: null,
          inputTokens: null,
          outputTokens: null,
          schemaValidation: "NOT_EVALUATED",
          semanticValidation: "NOT_EVALUATED",
          actualLlmUsed: false,
          fallbackUsed: null,
          displayedSource: null,
          decision: null,
          reasons: [],
        };
        proof.calls.push(record);
        const start = performance.now();
        try {
          const response = await nativeFetch(url, {
            ...opts,
            redirect: "error",
          });
          record.httpStatus = response.status;
          if (response.status === 429) {
            halted = true;
            record.reasons.push("UPSTREAM_QUOTA_STOP");
          }
          let data;
          try {
            data = await response.clone().json();
          } catch {
            record.reasons.push("UPSTREAM_INVALID_JSON");
          }
          if (data?.error?.status === "RESOURCE_EXHAUSTED") {
            halted = true;
            record.reasons.push("UPSTREAM_QUOTA_STOP");
          }
          record.modelVersion =
            typeof data?.modelVersion === "string" &&
            /^gemini-[a-zA-Z0-9._-]+$/.test(data.modelVersion)
              ? data.modelVersion
              : null;
          record.actualLlmUsed = record.modelVersion !== null;
          record.inputTokens = data?.usageMetadata?.promptTokenCount ?? null;
          record.outputTokens =
            data?.usageMetadata?.candidatesTokenCount ?? null;
          if (response.ok) {
            const parts = data?.candidates?.[0]?.content?.parts?.filter(
                (p) => p.thought !== true,
              ),
              raw = parts?.length === 1 ? parts[0].text : "";
            const candidate = data?.candidates?.[0];
            const reply = {
              rawJson: raw,
              finish:
                candidate?.finishReason === "STOP" ? "complete" : "truncated",
              contentVersion: c.contentVersion,
              policyVersion: c.policyVersion,
              promptVersion: c.promptVersion,
              inputTokens: record.inputTokens,
              outputTokens: record.outputTokens,
            };
            let parsedDraft;
            try {
              parsedDraft = JSON.parse(raw);
            } catch {
              parsedDraft = null;
            }
            record.schemaValidation = validateSchema(parsedDraft)
              ? "PASS"
              : "FAIL";
            const verdict = validateTutorReply(
              reply,
              c,
              c.maxOutputTokens,
              (text) => validateGeneratedMeaning(text, c, c.generation.profile),
            );
            record.semanticValidation = verdict.text ? "PASS" : "FAIL";
            record.reasons.push(verdict.reason);
            const allSaved = (
              await pool.query(
                "SELECT text_ar,allowed_rephrases FROM intervention_templates",
              )
            ).rows.flatMap((t) => [t.text_ar, ...t.allowed_rephrases]);
            record.novelAgainstStoredTemplates =
              !!verdict.text && !allSaved.includes(verdict.text);
            record.modelMatchesRequested =
              record.modelVersion === "gemini-3.5-flash-lite";
            if (verdict.text) record.acceptedGeneratedTextAr = verdict.text;
          }
          return response;
        } catch {
          record.reasons.push(
            opts.signal.aborted ? "TIMEOUT" : "NETWORK_FAILURE",
          );
          throw Error("LIVE4_SAFE_TRANSPORT_FAILURE");
        } finally {
          record.latencyMs =
            Math.round((performance.now() - start) * 1000) / 1000;
        }
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

      const m = await assigned();
      const observed = async (c, label) => {
        const before = proof.calls.length,
          event = await hint(c);
        const record =
          proof.calls.length > before
            ? proof.calls.at(-1)
            : {
                case: label,
                decision: "NOT_SENT",
                reasons: ["LOCAL_STOP_OR_PROVIDER_GATE"],
              };
        record.case = label;
        record.fallbackUsed = event.eventType === "fallback";
        record.displayedSource = event.generationSource;
        record.displayedTextAr = event.textAr;
        const row = (
          await pool.query(
            "SELECT audit_json FROM tutoring_events WHERE id=$1",
            [event.id],
          )
        ).rows[0];
        record.savedAudit = row.audit_json;
        assert.equal(record.savedAudit.actualLlmUsed, record.actualLlmUsed);
        assert.equal(record.savedAudit.transportMode, "live");
        record.accepted =
          record.semanticValidation === "PASS" &&
          record.schemaValidation === "PASS" &&
          record.modelMatchesRequested &&
          record.novelAgainstStoredTemplates &&
          event.generationSource === "llm_validated" &&
          event.textAr === record.acceptedGeneratedTextAr;
        record.decision = record.accepted
          ? "ACCEPTED_NEW_GEMINI_TEXT"
          : "REJECTED_OR_FALLBACK";
        await sameEvidence(c);
        if (proof.calls.length === before) proof.calls.push(record);
      };
      for (let n = 1; n <= 3; n++) {
        if (halted) break;
        await observed(m, "remediation_H" + n);
      }
      if (!halted) {
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
        const before = proof.requestsSent;
        await step(c, "س = ٩٩");
        await verify(c);
        const independent = (
          await pool.query(
            "SELECT assistance_policy,measurement_exited_at FROM learning_assignments WHERE id=$1",
            [x.id],
          )
        ).rows[0];
        assert.equal(independent.assistance_policy, "independent");
        assert.equal(independent.measurement_exited_at, null);
        assert.equal(proof.requestsSent, before);
        await observed(c, "transfer_after_explicit_help_exit");
        const exited = (
          await pool.query(
            "SELECT assistance_policy,measurement_exited_at FROM learning_assignments WHERE id=$1",
            [x.id],
          )
        ).rows[0];
        assert.equal(exited.assistance_policy, "guided");
        assert.ok(exited.measurement_exited_at);
        proof.explicitMeasurementExitVerified = true;
      }
      assert.ok(proof.requestsSent <= 4);
      proof.acceptedNewTexts = proof.calls.filter((x) => x.accepted).length;
      proof.status =
        proof.requestsSent === 4 && proof.acceptedNewTexts === 4
          ? "PASS"
          : "PARTIAL_OR_FAILED";
    } catch (e) {
      proof.error = String(e.message)
        .replace(/AQ\.[A-Za-z0-9_-]+/g, "[REDACTED]")
        .slice(0, 500);
      proof.status = "FAILED";
      throw e;
    } finally {
      proof.validatedContractResponses = contracts.length;
      if (app) await app.close();
      await pool.end();
      writeFileSync(
        "/evidence/ph08-generative-live-4-results.json",
        JSON.stringify(proof, null, 2) + "\n",
      );
    }
  },
);
