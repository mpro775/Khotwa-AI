import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const require = createRequire(import.meta.url);
const enabled = process.env.PH04_INTEGRATION === "true";
test(
  "PH-04 NestJS + isolated PostgreSQL contract and state integration",
  { skip: !enabled },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL);
    assert.match(url.hostname, /^khotwa-ph04-[a-f0-9]{12}-db$/);
    assert.equal(url.pathname, "/ph04_test");
    for (const key of [
      "GUEST_DIGEST_KEY",
      "BOOTSTRAP_SIGNING_KEY",
      "CSRF_SIGNING_KEY",
      "GUEST_ISSUE_KEY",
      "IDEMPOTENCY_DIGEST_KEY",
      "CURSOR_SIGNING_KEY",
      "INTERNAL_HEALTH_TOKEN",
      "MATH_INTERNAL_TOKEN",
    ])
      process.env[key] = randomBytes(32).toString("hex");
    Object.assign(process.env, {
      PUBLIC_APP_ORIGIN: "https://khotwa.test",
      PH04_BOOTSTRAP_TTL_SECONDS: "120",
      PH04_RATE_LIMIT_MAX: "1000",
      PH04_RATE_LIMIT_WINDOW_SECONDS: "60",
      PH04_MATH_TIMEOUT_MS: "250",
      MATH_ENGINE_BASE_URL: "http://unused-math:8001",
    });
    const { createApplication } = require("../dist/application.js");
    const { Store } = require("../dist/store.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const store = app.get(Store),
      db = store.db,
      base = await app.getUrl();
    const spec = parse(
      readFileSync(
        new URL("../../../docs/12-API-CONTRACT.yaml", import.meta.url),
        "utf8",
      ),
    );
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    ajv.addFormat("int32", {
      type: "number",
      validate: (n) =>
        Number.isInteger(n) && n >= -2147483648 && n <= 2147483647,
    });
    const validators = new Map(),
      contracts = [];
    const resolve = (s) =>
      s.$ref
        ? s.$ref
            .split("/")
            .slice(1)
            .reduce((o, k) => o[k], spec)
        : s;
    const check = (schema, value) => {
      const key = JSON.stringify(schema);
      let validate = validators.get(key);
      if (!validate) {
        validate = ajv.compile({ components: spec.components, ...schema });
        validators.set(key, validate);
      }
      assert.equal(validate(value), true, JSON.stringify(validate.errors));
    };
    function operation(path, method) {
      for (const [template, methods] of Object.entries(spec.paths)) {
        const expression = "^" + template.replace(/\{[^}]+\}/g, "[^/]+") + "$";
        if (new RegExp(expression).test(path))
          return { template, op: methods[method.toLowerCase()] };
      }
      return null;
    }
    function actor() {
      const jar = new Map();
      return {
        jar,
        csrf: null,
        async request(path, method = "GET", body, options = {}) {
          const headers = {
            origin: "https://khotwa.test",
            ...Object.fromEntries(
              jar.size
                ? [["cookie", [...jar].map(([k, v]) => k + "=" + v).join("; ")]]
                : [],
            ),
          };
          if (method !== "GET") {
            headers["content-type"] = "application/json";
            if (this.csrf) headers["x-csrf-token"] = this.csrf;
            if (path !== "/api/v1/guest-sessions")
              headers["idempotency-key"] = randomUUID();
          }
          for (const [k, v] of Object.entries(options.headers ?? {})) {
            if (v === null) delete headers[k];
            else headers[k] = v;
          }
          const response = await fetch(base + path, {
            method,
            headers,
            body:
              options.raw ??
              (body === undefined ? undefined : JSON.stringify(body)),
            signal: AbortSignal.timeout(6000),
          });
          const cookies = response.headers.getSetCookie();
          if (!options.ignoreCookies)
            for (const cookie of cookies) {
              const [k, v] = cookie.split(";")[0].split("=");
              if (v) jar.set(k, v);
              else jar.delete(k);
            }
          const text = await response.text();
          const data = text ? JSON.parse(text) : null;
          assert.match(response.headers.get("cache-control"), /no-store/);
          assert.equal(
            response.headers.get("access-control-allow-origin"),
            null,
          );
          assert.equal(
            response.headers.get("x-content-type-options"),
            "nosniff",
          );
          if (data) {
            assert.equal(
              data.meta.requestId,
              response.headers.get("x-request-id"),
            );
            assert.equal(text.includes("stack"), false);
          }
          const match = operation(path.split("?")[0], method);
          if (match?.op) {
            const declared = match.op.responses[response.status];
            assert.ok(
              declared,
              `${method} ${match.template}: unexpected ${response.status}`,
            );
            const schema =
              resolve(declared).content?.["application/json"]?.schema;
            if (schema) check(schema, data);
            else assert.equal(text, "");
            contracts.push({
              method,
              path: match.template,
              status: response.status,
            });
          } else if (data)
            check({ $ref: "#/components/schemas/ErrorEnvelope" }, data);
          return {
            status: response.status,
            body: data,
            cookies,
            text,
            headers: response.headers,
          };
        },
        async start() {
          const bootstrap = await this.request("/api/v1/bootstrap");
          assert.equal(bootstrap.status, 200);
          this.csrf = bootstrap.body.data.csrfToken;
          const created = await this.request(
            "/api/v1/guest-sessions",
            "POST",
            {},
          );
          assert.equal(created.status, 201);
          this.csrf = created.body.data.csrfToken;
          return created;
        },
      };
    }
    const a = actor(),
      b = actor(),
      ids = {
        release: randomUUID(),
        skill: randomUUID(),
        skill2: randomUUID(),
        problem: randomUUID(),
        revision: randomUUID(),
        problem2: randomUUID(),
        revision2: randomUUID(),
        transfer: randomUUID(),
        transferRevision: randomUUID(),
        draft: randomUUID(),
        draftRevision: randomUUID(),
        remediation: randomUUID(),
        remediationRevision: randomUUID(),
      };
    let learning, attempt, step1, step2, step3;
    const stepBody = (revision, position, sourceRaw = "س = ٢") => ({
      expectedRevision: revision,
      position,
      sourceRaw,
      inputOrigin: "math_editor",
    });
    try {
      await t.test(
        "two guests receive opaque secured cookies and no identity fields",
        async () => {
          const created = await a.start();
          await b.start();
          assert.notEqual(a.jar.get("kh_guest"), b.jar.get("kh_guest"));
          assert.equal(created.text.includes(a.jar.get("kh_guest")), false);
          assert.match(created.cookies[0], /HttpOnly/);
          assert.match(created.cookies[0], /Secure/);
          assert.match(created.cookies[0], /SameSite=Lax/);
          assert.equal(created.cookies[0].includes("Domain="), false);
          const [count] =
            await db.$queryRaw`SELECT count(*) AS n FROM guest_sessions`;
          assert.equal(Number(count.n), 2);
          assert.equal((await actor().request("/api/v1/skills")).status, 401);
          assert.equal(
            (await a.request("/api/v1/guest-sessions/current")).status,
            200,
          );
        },
      );
      await t.test(
        "bootstrap POST replay/concurrency yields one guest and existing session resumes",
        async () => {
          const c = actor();
          const bootstrap = await c.request("/api/v1/bootstrap");
          c.csrf = bootstrap.body.data.csrfToken;
          const responses = await Promise.all([
            c.request("/api/v1/guest-sessions", "POST", {}),
            c.request("/api/v1/guest-sessions", "POST", {}),
          ]);
          assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
          assert.equal(
            responses[0].body.data.session.id,
            responses[1].body.data.session.id,
          );
          const cookies = responses.map((r) => r.cookies[0].split(";")[0]);
          assert.equal(cookies[0], cookies[1]);
          c.csrf = responses[0].body.data.csrfToken;
          assert.equal(
            (await c.request("/api/v1/guest-sessions", "POST", {})).status,
            200,
          );
        },
      );
      await t.test(
        "Origin, fetch-site, CSRF, JSON and DTO protections reject requests",
        async () => {
          for (const headers of [
            { origin: "https://evil.test" },
            { "sec-fetch-site": "cross-site" },
            { "x-csrf-token": "wrong".repeat(8) },
          ])
            assert.equal(
              (
                await a.request(
                  "/api/v1/learning-sessions",
                  "POST",
                  {},
                  { headers },
                )
              ).status,
              403,
            );
          for (const headers of [
            { "x-csrf-token": null },
            { "idempotency-key": null },
            { "content-type": "text/plain" },
          ])
            assert.equal(
              (
                await a.request(
                  "/api/v1/learning-sessions",
                  "POST",
                  {},
                  { headers },
                )
              ).status,
              400,
            );
          assert.equal(
            (
              await a.request("/api/v1/guest-sessions", "POST", {
                name: "forbidden identity",
              })
            ).status,
            422,
          );
          assert.equal(
            (
              await a.request("/api/v1/learning-sessions", "POST", undefined, {
                raw: "{",
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await a.request("/api/v1/learning-sessions", "POST", undefined, {
                raw: JSON.stringify({ x: "x".repeat(5000) }),
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await a.request("/api/v1/bootstrap", "GET", undefined, {
                headers: { origin: "https://evil.test" },
              })
            ).status,
            400,
          );
        },
      );
      await t.test(
        "unpublished catalog stays empty and unavailable release creates no learning session",
        async () => {
          assert.deepEqual(
            (await a.request("/api/v1/skills")).body.data.items,
            [],
          );
          assert.equal(
            (await a.request("/api/v1/learning-sessions", "POST", {})).status,
            409,
          );
          const [row] =
            await db.$queryRaw`SELECT count(*) AS n FROM learning_sessions`;
          assert.equal(Number(row.n), 0);
        },
      );
      await t.test(
        "isolated synthetic fixtures simulate publication without human approval",
        async () => {
          await db.$transaction(async (tx) => {
            await tx.$executeRaw`INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES(${ids.release}::uuid,'test-only-not-human-reviewed','algebra','ar-mashriq-school-v1','بيانات اختبار اصطناعية فقط','draft')`;
            for (const [index, skill] of [ids.skill, ids.skill2].entries())
              await tx.$executeRaw`INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES(${skill}::uuid,${ids.release}::uuid,${"SK-ALG-0" + (index + 1)},'مهارة اختبار','هدف اختبار',${index},'active')`;
            await tx.$executeRaw`INSERT INTO skill_prerequisites(skill_id,prerequisite_skill_id,relation_kind) VALUES(${ids.skill2}::uuid,${ids.skill}::uuid,'recommended')`;
            for (const [problem, revision, kind, status] of [
              [ids.problem, ids.revision, "main", "published"],
              [ids.problem2, ids.revision2, "main", "published"],
              [ids.transfer, ids.transferRevision, "transfer", "published"],
              [
                ids.remediation,
                ids.remediationRevision,
                "remediation",
                "published",
              ],
              [ids.draft, ids.draftRevision, "main", "draft"],
            ]) {
              await tx.$executeRaw`INSERT INTO problems(id,problem_code) VALUES(${problem}::uuid,${problem})`;
              await tx.$executeRaw`INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash) VALUES(${revision}::uuid,${problem}::uuid,1,${ids.release}::uuid,${kind},'مسألة اختبار اصطناعية','٢س=٤','{"privateTestSentinel":"server-only-solution"}'::jsonb,1,'ar-mashriq-school-v1',${status},now(),now(),'synthetic-test-only')`;
              await tx.$executeRaw`INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES(${revision}::uuid,${ids.skill}::uuid,'primary')`;
            }
            await tx.$executeRaw`UPDATE content_releases SET status='published',reviewed_by_role='test_fixture_not_human_review',reviewed_at=now(),published_at=now() WHERE id=${ids.release}::uuid`;
          });
        },
      );
      await t.test(
        "catalog filters hidden/draft items, paginates and never returns answers",
        async () => {
          const skills = await a.request("/api/v1/skills");
          assert.equal(skills.body.data.items.length, 2);
          assert.equal(skills.body.data.items[0].availableProblemCount, 2);
          assert.equal(
            (await a.request("/api/v1/skills/" + ids.skill)).status,
            200,
          );
          const first = await a.request(
            `/api/v1/problems?skillId=${ids.skill}&limit=1`,
          );
          assert.equal(first.body.data.items.length, 1);
          assert.ok(first.body.data.nextCursor);
          const second = await a.request(
            `/api/v1/problems?skillId=${ids.skill}&limit=1&cursor=${encodeURIComponent(first.body.data.nextCursor)}`,
          );
          assert.equal(second.body.data.items.length, 1);
          assert.equal(second.body.data.nextCursor, null);
          assert.notEqual(
            first.body.data.items[0].revisionId,
            second.body.data.items[0].revisionId,
          );
          assert.equal(
            (
              await a.request(
                `/api/v1/problems?skillId=${ids.skill2}&cursor=${encodeURIComponent(first.body.data.nextCursor)}`,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await a.request(
                "/api/v1/problems?skillId=" + ids.skill + "&limit=31",
              )
            ).status,
            422,
          );
          assert.equal((await a.request("/api/v1/problems")).status, 400);
          for (const hidden of [ids.transfer, ids.remediation, ids.draft])
            assert.equal(
              (await a.request("/api/v1/problems/" + hidden)).status,
              404,
            );
          const problem = await a.request("/api/v1/problems/" + ids.problem);
          assert.equal(problem.status, 200);
          assert.equal(problem.text.includes("server-only-solution"), false);
          assert.equal(problem.text.includes("answer"), false);
        },
      );
      await t.test(
        "learning and attempt create/retry are scoped and pin content revision",
        async () => {
          const key = randomUUID(),
            options = { headers: { "idempotency-key": key } };
          const first = await a.request(
            "/api/v1/learning-sessions",
            "POST",
            {},
            options,
          );
          assert.equal(first.status, 201);
          learning = first.body.data;
          const retry = await a.request(
            "/api/v1/learning-sessions",
            "POST",
            {},
            options,
          );
          assert.deepEqual(retry.body.data, learning);
          assert.notEqual(retry.body.meta.requestId, first.body.meta.requestId);
          const other = await b.request(
            "/api/v1/learning-sessions",
            "POST",
            {},
            options,
          );
          assert.equal(other.status, 201);
          assert.notEqual(other.body.data.id, learning.id);
          assert.equal(
            (await a.request("/api/v1/learning-sessions/" + learning.id))
              .status,
            200,
          );
          const body = {
              learningSessionId: learning.id,
              source: { kind: "catalog", problemRevisionId: ids.revision },
            },
            attemptKey = randomUUID();
          const responses = await Promise.all(
            [1, 2].map(() =>
              a.request("/api/v1/attempts", "POST", body, {
                headers: { "idempotency-key": attemptKey },
              }),
            ),
          );
          assert.equal(responses[0].status, 201);
          assert.deepEqual(responses[0].body.data, responses[1].body.data);
          attempt = responses[0].body.data;
          assert.equal(attempt.problemRevisionId, ids.revision);
          assert.equal(attempt.revision, 0);
          assert.equal(attempt.currentVerification, null);
          assert.equal(
            (
              await a.request(
                "/api/v1/attempts",
                "POST",
                {
                  ...body,
                  source: { kind: "catalog", problemRevisionId: ids.revision2 },
                },
                { headers: { "idempotency-key": attemptKey } },
              )
            ).body.error.code,
            "idempotency_conflict",
          );
          for (const hidden of [
            ids.transferRevision,
            ids.remediationRevision,
            ids.draftRevision,
          ])
            assert.equal(
              (
                await a.request("/api/v1/attempts", "POST", {
                  ...body,
                  source: { kind: "catalog", problemRevisionId: hidden },
                })
              ).status,
              404,
            );
          assert.equal(
            (
              await a.request("/api/v1/attempts", "POST", {
                ...body,
                source: { kind: "assignment", assignmentId: randomUUID() },
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await a.request(
                "/api/v1/attempts?learningSessionId=" + learning.id,
              )
            ).body.data.items.length,
            1,
          );
        },
      );
      await t.test(
        "guest B cannot discover, read or mutate guest A resources",
        async () => {
          const paths = [
            "/api/v1/learning-sessions/" + learning.id,
            "/api/v1/attempts/" + attempt.id,
            "/api/v1/attempts?learningSessionId=" + learning.id,
          ];
          for (const path of paths) {
            const r = await b.request(path);
            assert.equal(r.status, 404);
            assert.equal(r.body.error.messageAr, "المورد غير متاح.");
          }
          assert.equal(
            (
              await b.request(
                `/api/v1/attempts/${attempt.id}/steps`,
                "POST",
                stepBody(0, 1),
              )
            ).status,
            404,
          );
          const c = actor();
          c.jar.set("kh_guest", attempt.id);
          assert.equal(
            (await c.request("/api/v1/attempts/" + attempt.id)).status,
            401,
          );
        },
      );
      await t.test(
        "step append preserves exact raw and repeat does not duplicate versions/revision",
        async () => {
          const key = randomUUID(),
            body = stepBody(0, 1, " ٢س = ٤ "),
            path = `/api/v1/attempts/${attempt.id}/steps`,
            options = { headers: { "idempotency-key": key } };
          const responses = await Promise.all(
            [1, 2].map(() => a.request(path, "POST", body, options)),
          );
          assert.equal(responses[0].status, 201);
          assert.deepEqual(responses[0].body.data, responses[1].body.data);
          step1 = responses[0].body.data.step;
          assert.equal(step1.source.sourceRaw, body.sourceRaw);
          assert.equal(step1.source.parseStatus, "not_checked");
          assert.equal(step1.source.displayAr, null);
          assert.equal(responses[0].body.data.attemptRevision, 1);
          const conflict = await a.request(
            path,
            "POST",
            { ...body, sourceRaw: "س=-٢" },
            options,
          );
          assert.equal(conflict.body.error.code, "idempotency_conflict");
          assert.equal(
            (
              await a.request(path, "POST", {
                ...stepBody(1, 2),
                ast: { trusted: true },
              })
            ).status,
            422,
          );
          const second = await a.request(path, "POST", stepBody(1, 2, "س = ٢"));
          assert.equal(second.status, 201);
          step2 = second.body.data.step;
          const third = await a.request(path, "POST", stepBody(2, 3, "س=٢"));
          assert.equal(third.status, 201);
          step3 = third.body.data.step;
        },
      );
      await t.test(
        "two different keys racing at one revision have exactly one winner",
        async () => {
          const path = `/api/v1/attempts/${attempt.id}/steps`;
          const responses = await Promise.all(
            [1, 2].map(() => a.request(path, "POST", stepBody(3, 4))),
          );
          assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
          const rejected = responses.find((r) => r.status === 409);
          assert.equal(rejected.body.error.code, "revision_conflict");
          assert.equal(rejected.body.error.currentRevision, 4);
          const current = await a.request("/api/v1/attempts/" + attempt.id);
          assert.equal(current.body.data.revision, 4);
          assert.equal(current.body.data.steps.length, 4);
        },
      );
      await t.test(
        "old-step edit invalidates proof dependencies and late responses remain historical",
        async () => {
          const auth = await store.authenticate({
            headers: { cookie: "kh_guest=" + a.jar.get("kh_guest") },
          });
          const versions =
            await db.$queryRaw`SELECT v.id,s.id AS slot FROM step_versions v JOIN step_slots s ON s.id=v.step_slot_id WHERE s.attempt_id=${attempt.id}::uuid AND v.version_number=s.current_version ORDER BY s.position`;
          const snapshot = await store.captureVerification(
            auth,
            attempt.id,
            4,
            null,
            versions[0].id,
            "mock-current-proof",
            "0.3.0",
          );
          const mock = {
            schemaVersion: "math-internal-v1",
            requestId: randomUUID(),
            engineVersion: "0.3.0",
            notationProfileVersion: "ar-mashriq-school-v1",
            attemptRevision: 4,
            status: "verified_valid",
            reasonCode: null,
            evidence: null,
            issue: null,
          };
          assert.equal(
            (await store.acceptVerification(auth, snapshot, mock)).isCurrent,
            true,
          );
          await store.requireCurrentDependency(
            auth,
            attempt.id,
            snapshot.runId,
          );
          const late = await store.captureVerification(
            auth,
            attempt.id,
            4,
            versions[0].id,
            versions[1].id,
            "mock-late-proof",
            "0.3.0",
          );
          const edited = await a.request(
            `/api/v1/attempts/${attempt.id}/steps/${step1.id}`,
            "PUT",
            {
              expectedRevision: 4,
              sourceRaw: "٢س = ٤",
              inputOrigin: "keyboard",
            },
          );
          assert.equal(edited.status, 200);
          assert.equal(edited.body.data.step.currentVersion, 2);
          assert.equal(edited.body.data.attemptRevision, 5);
          assert.equal(edited.body.data.invalidatedFromPosition, 1);
          assert.equal(edited.body.data.invalidatedVerificationCount, 1);
          await assert.rejects(
            store.requireCurrentDependency(auth, attempt.id, snapshot.runId),
            (e) => e.code === "invalid_state",
          );
          assert.equal(
            (
              await store.acceptVerification(auth, late, {
                ...mock,
                requestId: randomUUID(),
              })
            ).isCurrent,
            false,
          );
          await assert.rejects(
            store.requireCurrentDependency(auth, attempt.id, late.runId),
            (e) => e.code === "invalid_state",
          );
          const current = await a.request("/api/v1/attempts/" + attempt.id);
          assert.equal(current.body.data.completionVerdict, null);
          assert.equal(current.body.data.currentVerification, null);
          const history =
            await db.$queryRaw`SELECT source_raw,version_number FROM step_versions WHERE step_slot_id=${step1.id}::uuid ORDER BY version_number`;
          assert.deepEqual(
            history.map((v) => v.source_raw),
            [" ٢س = ٤ ", "٢س = ٤"],
          );
          const [counts] =
            await db.$queryRaw`SELECT count(*) AS n FROM verification_results`;
          assert.equal(Number(counts.n), 2);
        },
      );
      await t.test(
        "logical delete compacts positions atomically and retains immutable history",
        async () => {
          const removed = await a.request(
            `/api/v1/attempts/${attempt.id}/steps/${step2.id}`,
            "DELETE",
            { expectedRevision: 5 },
          );
          assert.equal(removed.status, 200);
          assert.equal(removed.body.data.step, null);
          assert.equal(removed.body.data.attemptRevision, 6);
          const current = await a.request("/api/v1/attempts/" + attempt.id);
          assert.deepEqual(
            current.body.data.steps.map((s) => s.position),
            [1, 2, 3],
          );
          assert.equal(current.body.data.steps[1].id, step3.id);
          assert.equal(
            (
              await a.request(
                `/api/v1/attempts/${attempt.id}/steps/${step2.id}`,
                "PUT",
                {
                  expectedRevision: 6,
                  sourceRaw: "س=٢",
                  inputOrigin: "keyboard",
                },
              )
            ).status,
            404,
          );
          const [slot] =
            await db.$queryRaw`SELECT is_active FROM step_slots WHERE id=${step2.id}::uuid`;
          assert.equal(slot.is_active, false);
          const [old] =
            await db.$queryRaw`SELECT count(*) AS n FROM step_versions WHERE step_slot_id=${step2.id}::uuid`;
          assert.equal(Number(old.n), 1);
        },
      );
      await t.test(
        "content relations, cycles and predecessor scope are enforced in PostgreSQL",
        async () => {
          const release = randomUUID(),
            skillA = randomUUID(),
            skillB = randomUUID();
          await db.$executeRaw`INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES(${release}::uuid,${release},'algebra','ar-mashriq-school-v1','اختبار قيود فقط','draft')`;
          for (const [i, id] of [skillA, skillB].entries())
            await db.$executeRaw`INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES(${id}::uuid,${release}::uuid,${"SK-ALG-0" + (i + 1)},'اختبار','اختبار',${i},'active')`;
          await assert.rejects(
            db.$executeRaw`INSERT INTO skill_prerequisites(skill_id,prerequisite_skill_id,relation_kind) VALUES(${skillA}::uuid,${ids.skill}::uuid,'required')`,
          );
          await db.$executeRaw`INSERT INTO skill_prerequisites(skill_id,prerequisite_skill_id,relation_kind) VALUES(${skillA}::uuid,${skillB}::uuid,'required'),(${skillB}::uuid,${skillA}::uuid,'required')`;
          await assert.rejects(
            db.$executeRaw`UPDATE content_releases SET status='published',reviewed_at=now(),published_at=now(),reviewed_by_role='test_not_human' WHERE id=${release}::uuid`,
          );
          await assert.rejects(
            db.$executeRaw`UPDATE skills SET release_id=${ids.release}::uuid WHERE id=${skillA}::uuid`,
          );
          await assert.rejects(
            db.$executeRaw`UPDATE problem_skills SET skill_id=${ids.skill2}::uuid WHERE problem_revision_id=${ids.revision}::uuid`,
          );
          const [old] =
            await db.$queryRaw`SELECT id FROM step_versions WHERE step_slot_id=${step1.id}::uuid AND version_number=2`;
          await assert.rejects(
            db.$executeRaw`INSERT INTO step_versions(id,step_slot_id,version_number,source_raw,input_origin,supersedes_step_version_id) VALUES(${randomUUID()}::uuid,${step3.id}::uuid,2,'س=٢','keyboard',${old.id}::uuid)`,
          );
          const auth = await store.authenticate({
              headers: { cookie: "kh_guest=" + a.jar.get("kh_guest") },
            }),
            id = randomUUID(),
            key = randomUUID();
          await assert.rejects(
            store.mutate(auth, "test.rollback", key, {}, async (tx) => {
              await tx.$executeRaw`INSERT INTO audit_events(id,correlation_id,entity_kind,event_code) VALUES(${id}::uuid,${randomUUID()}::uuid,'test','rolled_back')`;
              throw new Error("synthetic transaction interruption");
            }),
          );
          const [count] =
            await db.$queryRaw`SELECT count(*) AS n FROM idempotency_records WHERE guest_session_id=${auth.row.id}::uuid AND operation='test.rollback'`;
          assert.equal(Number(count.n), 0);
          const [audit] =
            await db.$queryRaw`SELECT count(*) AS n FROM audit_events WHERE id=${id}::uuid`;
          assert.equal(Number(audit.n), 0);
        },
      );
      await t.test(
        "unknown skill list stays within the declared response contract",
        async () => {
          assert.equal(
            (await a.request("/api/v1/problems?skillId=" + randomUUID()))
              .status,
            422,
          );
        },
      );
      await t.test(
        "PostgreSQL constraints, immutable records and transaction rollback are real",
        async () => {
          await assert.rejects(
            db.$executeRaw`UPDATE step_versions SET source_raw='س=٩' WHERE step_slot_id=${step1.id}::uuid`,
          );
          await assert.rejects(
            db.$executeRaw`UPDATE verification_results SET math_status='verified_invalid'`,
          );
          await assert.rejects(
            db.$executeRaw`UPDATE problem_revisions SET answer_spec='{}'::jsonb WHERE id=${ids.revision}::uuid`,
          );
          await assert.rejects(
            db.$executeRaw`UPDATE content_releases SET release_code='changed' WHERE id=${ids.release}::uuid`,
          );
          await assert.rejects(
            db.$executeRaw`INSERT INTO step_slots(id,attempt_id,position,current_version) VALUES(${randomUUID()}::uuid,${attempt.id}::uuid,1,1)`,
          );
          const cancelled = randomUUID();
          await assert.rejects(
            db.$transaction(async (tx) => {
              await tx.$executeRaw`INSERT INTO audit_events(id,correlation_id,entity_kind,event_code) VALUES(${cancelled}::uuid,${randomUUID()}::uuid,'test','rollback')`;
              throw new Error("synthetic rollback");
            }),
          );
          const [count] =
            await db.$queryRaw`SELECT count(*) AS n FROM audit_events WHERE id=${cancelled}::uuid`;
          assert.equal(Number(count.n), 0);
          const [stored] =
            await db.$queryRaw`SELECT encode(token_digest,'hex') AS digest FROM guest_sessions WHERE id=${(await a.request("/api/v1/guest-sessions/current")).body.data.id}::uuid`;
          assert.equal(stored.digest.length, 64);
          assert.notEqual(stored.digest, a.jar.get("kh_guest"));
          const [privateLogs] =
            await db.$queryRaw`SELECT count(*) AS n FROM audit_events WHERE limited_metadata::text LIKE '%sourceRaw%' OR limited_metadata::text LIKE '%kh_guest%'`;
          assert.equal(Number(privateLogs.n), 0);
        },
      );
      await t.test(
        "raw script/SQL-like text is inert draft data and cannot select a foreign step",
        async () => {
          const created = await a.request("/api/v1/attempts", "POST", {
            learningSessionId: learning.id,
            source: { kind: "catalog", problemRevisionId: ids.revision2 },
          });
          assert.equal(created.status, 201);
          const id = created.body.data.id;
          const raw =
            "<script>alert(1)</script>; DROP TABLE attempts; __import__('os')";
          const saved = await a.request(
            `/api/v1/attempts/${id}/steps`,
            "POST",
            stepBody(0, 1, raw),
          );
          assert.equal(saved.status, 201);
          assert.equal(saved.body.data.step.source.sourceRaw, raw);
          assert.match(saved.headers.get("content-type"), /application\/json/);
          assert.equal(saved.body.data.step.source.parseStatus, "not_checked");
          const foreign = await a.request(
            `/api/v1/attempts/${id}/steps/${step1.id}`,
            "PUT",
            { expectedRevision: 1, sourceRaw: "س=٢", inputOrigin: "keyboard" },
          );
          assert.equal(foreign.status, 404);
          const [table] =
            await db.$queryRaw`SELECT to_regclass('public.attempts')::text AS name`;
          assert.equal(table.name, "attempts");
        },
      );
      await t.test(
        "cross-guest edit/delete and malformed UUID are isolated",
        async () => {
          for (const method of ["PUT", "DELETE"]) {
            const body =
              method === "PUT"
                ? {
                    expectedRevision: 6,
                    sourceRaw: "س=٢",
                    inputOrigin: "keyboard",
                  }
                : { expectedRevision: 6 };
            assert.equal(
              (
                await b.request(
                  `/api/v1/attempts/${attempt.id}/steps/${step1.id}`,
                  method,
                  body,
                )
              ).status,
              404,
            );
          }
          assert.equal(
            (await a.request("/api/v1/attempts/bad-id")).status,
            400,
          );
        },
      );
      await t.test(
        "unexpected database failure returns sanitized matching HTTP envelope",
        async () => {
          const original = store.listSkills;
          store.listSkills = async () => {
            throw new Error("secret database stack trace");
          };
          try {
            const failed = await a.request("/api/v1/skills");
            assert.equal(failed.status, 500);
            assert.equal(failed.text.includes("secret"), false);
            assert.equal(failed.body.error.code, "internal_error");
          } finally {
            store.listSkills = original;
          }
        },
      );
      await t.test(
        "rate limit emits a contracted 429 with Retry-After",
        async () => {
          const { RequestLimits } = require("../dist/business.js"),
            limits = app.get(RequestLimits),
            maximum = limits.maximum;
          limits.maximum = 1;
          try {
            const r = await a.request("/api/v1/skills");
            assert.equal(r.status, 429);
            assert.equal(r.body.error.code, "rate_limited");
            assert.equal(r.body.error.retryable, true);
            assert.ok(Number(r.headers.get("retry-after")) > 0);
          } finally {
            limits.maximum = maximum;
          }
        },
      );
      await t.test(
        "expiry, idle timeout, revocation and bootstrap replay cannot revive access",
        async () => {
          assert.equal(
            (
              await a.request("/api/v1/guest-sessions/current", "DELETE", {
                unexpected: true,
              })
            ).status,
            400,
          );
          const c = actor();
          await c.start();
          const current = await c.request("/api/v1/guest-sessions/current"),
            id = current.body.data.id;
          await db.$executeRaw`UPDATE guest_sessions SET created_at=now()-interval '2 days',expires_at=now()-interval '1 hour' WHERE id=${id}::uuid`;
          assert.equal(
            (await c.request("/api/v1/guest-sessions/current")).status,
            410,
          );
          assert.equal((await c.request("/api/v1/skills")).status, 401);
          const idle = actor();
          await idle.start();
          const idleId = (await idle.request("/api/v1/guest-sessions/current"))
            .body.data.id;
          await db.$executeRaw`UPDATE guest_sessions SET last_seen_at=now()-interval '3 hours' WHERE id=${idleId}::uuid`;
          assert.equal(
            (await idle.request("/api/v1/guest-sessions/current")).status,
            410,
          );
          const d = actor();
          const bootstrap = await d.request("/api/v1/bootstrap");
          d.csrf = bootstrap.body.data.csrfToken;
          const bootstrapCsrf = d.csrf;
          const created = await d.request("/api/v1/guest-sessions", "POST", {});
          d.csrf = created.body.data.csrfToken;
          const guestToken = d.jar.get("kh_guest"),
            logoutKey = randomUUID();
          const logout = await d.request(
            "/api/v1/guest-sessions/current",
            "DELETE",
            undefined,
            { headers: { "idempotency-key": logoutKey } },
          );
          assert.equal(logout.status, 204);
          assert.equal(logout.text, "");
          assert.match(logout.cookies[0], /Max-Age=0/);
          d.jar.set("kh_guest", guestToken);
          assert.equal(
            (
              await d.request(
                "/api/v1/guest-sessions/current",
                "DELETE",
                undefined,
                { headers: { "idempotency-key": logoutKey } },
              )
            ).status,
            204,
          );
          d.jar.set("kh_guest", guestToken);
          assert.equal((await d.request("/api/v1/skills")).status, 401);
          d.jar.delete("kh_guest");
          d.csrf = bootstrapCsrf;
          assert.equal(
            (await d.request("/api/v1/guest-sessions", "POST", {})).status,
            403,
          );
        },
      );
      await t.test(
        "PH-05 and private math routes remain unexposed",
        async () => {
          assert.equal(
            (
              await a.request(`/api/v1/attempts/${attempt.id}/verify`, "POST", {
                expectedRevision: 6,
              })
            ).status,
            404,
          );
          assert.equal(
            (await a.request("/internal/v1/math/parse", "POST", {})).status,
            404,
          );
        },
      );
    } finally {
      writeFileSync(
        "/tmp/ph04-http-contracts.json",
        JSON.stringify(
          {
            phase: "PH-04",
            contracts,
            validatedResponses: contracts.length,
            environment: {
              node: process.version,
              postgres: "17.6",
              database: "isolated synthetic test only",
              transport:
                "local HTTP client with explicit HTTPS Origin; cookie flags checked; no browser/HTTPS deployment claim",
            },
          },
          null,
          2,
        ),
      );
      await app.close();
    }
  },
);
