import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import pg from "pg";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const require = createRequire(import.meta.url);
const enabled = process.env.V22_INTEGRATION === "true";
const serve = process.env.V22_SERVE === "true";
const subjectsOnly = process.env.V22_SUBJECTS_ONLY === "true";
const spec = parse(
  readFileSync(
    new URL("../../../docs/12-API-CONTRACT.yaml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validators = new Map();
const resolve = (schema) =>
  schema.$ref
    ? schema.$ref
        .split("/")
        .slice(1)
        .reduce((node, key) => node[key], spec)
    : schema;

// These fixtures test mechanics only. Neither the generated actors nor this
// test's publication constitutes approval of deliverable learning material.
async function fixture(pool, math) {
  const releaseId = randomUUID();
  const skillId = randomUUID();
  await pool.query(
    "INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES($1,$2,'algebra','ar-mashriq-school-v1','V22 TEST_ONLY synthetic — no human review','draft')",
    [releaseId, "v22-test-" + releaseId],
  );
  await pool.query(
    "INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES($1,$2,'SK-ALG-04','توزيع الأقواس — اختبار اصطناعي','اختبار وظائف المصدر فقط',1,'active')",
    [skillId, releaseId],
  );
  const bank = [
    ["٤(س + ١) = ٢٠", "س = ٤", "main"],
    ["٥(س + ٢) = ٢٥", "س = ٣", "main"],
    ["٢(س + ٤) = ١٤", "س = ٣", "main"],
    ["٣(س + ٤) = ٢١", "س = ٣", "main"],
    ["٤(س + ٢) = ٢٤", "س = ٤", "main"],
    ["٥(س + ١) = ٢٠", "س = ٣", "main"],
    ["٦(س + ١) = ٣٠", "س = ٤", "main"],
    ["٢(س + ٥) = ١٦", "س = ٣", "main"],
    ["٣(س + ٥) = ٢٤", "س = ٣", "main"],
    ["٤(س + ٣) = ٢٨", "س = ٤", "main"],
    ["٢(س + ٦) = ١٨", "س = ٣", "main"],
    ["٣(س + ٦) = ٢٧", "س = ٣", "main"],
    ["٤(٣ − س) = ٢٠", "س = −٢", "transfer"],
    ["١٤ = ٢(س − ١)", "س = ٨", "transfer"],
  ];
  const problems = [];
  for (const [index, [equation, answer, kind]] of bank.entries()) {
    const id = randomUUID();
    const problemId = randomUUID();
    const verified = await math.checkFinal(
      {
        attemptId: randomUUID(),
        attemptRevision: 0,
        problemRevisionId: id,
        notationProfile: "ar-mashriq-school-v1",
        domain: "reals",
      },
      equation,
      { stepVersionId: randomUUID(), raw: answer },
    );
    assert.equal(verified.status, "verified_valid");
    assert.equal(verified.isIsolated, true);
    await pool.query("INSERT INTO problems(id,problem_code) VALUES($1,$2)", [
      problemId,
      "v22-test-" + id,
    ]);
    await pool.query(
      "INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash,learning_family) VALUES($1,$2,1,$3,$4,'اختبار اصطناعي لوظائف الجبر',$5,$6::jsonb,2,'ar-mashriq-school-v1','published',now(),now(),$7,$8)",
      [
        id,
        problemId,
        releaseId,
        kind,
        equation,
        JSON.stringify({
          solution: answer,
          sentinel: "V22_SERVER_ONLY_REFERENCE",
        }),
        createHash("sha256").update(equation).digest("hex"),
        "v22-family-" + index,
      ],
    );
    await pool.query(
      "INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES($1,$2,'primary')",
      [id, skillId],
    );
    problems.push({ id, problemId, equation, answer, kind });
  }
  await pool.query(
    "INSERT INTO misconception_catalog(id,release_id,error_code,skill_id,catalog_version,enabled,is_synthetic,review_status) VALUES($1,$2,'ERR-ALG-01',$3,'v22-test-only',true,true,'draft')",
    [randomUUID(), releaseId, skillId],
  );
  for (const [index, text] of [
    "تأمل الحدين داخل القوس.",
    "المعامل خارج القوس يضرب كل حد داخله.",
    "ابدأ بحد المتغير، ثم أكمل الحد الثابت بنفسك.",
  ].entries())
    await pool.query(
      "INSERT INTO intervention_templates(id,release_id,hint_level,template_version,policy_version,text_ar,is_synthetic,enabled,review_status,reviewed_by_role,reviewed_at) VALUES($1,$2,$3,'v22-test-only','tutoring-p0-0.7.0',$4,true,true,'reviewed','automated_test_fixture_not_human',now())",
      [randomUUID(), releaseId, index + 1, text],
    );
  await pool.query(
    "UPDATE content_releases SET status='published',reviewed_by_role='automated_test_fixture_not_human',reviewed_at=now(),published_at=now() WHERE id=$1",
    [releaseId],
  );
  return { releaseId, problems };
}

test(
  "V2.2 focused synthetic author/student journey uses actual NestJS PostgreSQL and SymPy",
  { skip: !enabled, timeout: serve ? 900000 : 120000 },
  async (t) => {
    const database = new URL(process.env.DATABASE_URL);
    assert.equal(database.hostname, "127.0.0.1");
    assert.equal(database.pathname, "/v22_test");
    assert.match(
      process.env.V22_TEST_CONTAINER,
      /^khotwa-v22-[a-f0-9]{12}-db$/,
    );
    assert.equal(process.env.KHOTWA_SYNTHETIC_DATA, "true");
    const pool = new pg.Pool({ connectionString: database.href });
    const { createApplication } = require("../dist/application.js");
    const { Store } = require("../dist/store.js");
    const { MathGateway } = require("../dist/math-gateway.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await app.close();
      await pool.end();
    };
    t.after(close);
    const base = await app.getUrl();
    const store = app.get(Store);
    const fixtures = subjectsOnly
      ? { problems: [] }
      : await fixture(pool, app.get(MathGateway));
    const operations = [];
    function actor(initial = {}) {
      const jar = new Map(Object.entries(initial));
      return {
        csrf: null,
        async request(path, method = "GET", body, options = {}) {
          const headers = {
            origin: process.env.PUBLIC_APP_ORIGIN,
            "sec-fetch-site": "same-origin",
          };
          if (jar.size)
            headers.cookie = [...jar]
              .map(([key, value]) => key + "=" + value)
              .join("; ");
          if (method !== "GET")
            Object.assign(headers, {
              "content-type": "application/json",
              "x-csrf-token": this.csrf ?? "",
              "idempotency-key": options.key ?? randomUUID(),
            });
          Object.assign(headers, options.headers ?? {});
          const response = await fetch(base + "/api/v1" + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(30000),
          });
          for (const cookie of response.headers.getSetCookie()) {
            const [key, value] = cookie.split(";")[0].split("=");
            if (value) jar.set(key, value);
            else jar.delete(key);
          }
          const raw = await response.text();
          const value = raw ? JSON.parse(raw) : null;
          assert.equal(raw.includes("V22_SERVER_ONLY_REFERENCE"), false);
          assert.match(response.headers.get("cache-control"), /no-store/);
          const target = "/api/v1" + path.split("?")[0];
          const match = Object.entries(spec.paths).find(([template]) =>
            new RegExp(
              "^" + template.replace(/\{[^}]+\}/g, "[^/]+") + "$",
            ).test(target),
          );
          assert.ok(match, target);
          const operation = match[1][method.toLowerCase()];
          assert.ok(operation);
          const responseSchema = operation.responses[String(response.status)];
          assert.ok(responseSchema, `${method} ${target}: ${response.status}`);
          const schema =
            resolve(responseSchema).content?.["application/json"]?.schema;
          if (schema) {
            const key = JSON.stringify(schema);
            if (!validators.has(key))
              validators.set(
                key,
                ajv.compile({ components: spec.components, ...schema }),
              );
            const validate = validators.get(key);
            assert.equal(
              validate(value),
              true,
              JSON.stringify(validate.errors),
            );
          }
          operations.push({ method, path: match[0], status: response.status });
          if (options.expect !== undefined)
            assert.equal(
              response.status,
              options.expect,
              JSON.stringify(value),
            );
          return { status: response.status, data: value?.data, value };
        },
        async start() {
          const boot = await this.request("/bootstrap", "GET", undefined, {
            expect: 200,
          });
          this.csrf = boot.data.csrfToken;
          const created = await this.request(
            "/guest-sessions",
            "POST",
            {},
            { expect: 201 },
          );
          this.csrf = created.data.csrfToken;
        },
      };
    }
    const adminToken = randomBytes(32).toString("base64url");
    const adminId = randomUUID();
    await pool.query(
      "INSERT INTO users(id,email_normalized,email_verified_at,role,status,is_internal) VALUES($1,'v22-test-only@example.invalid',now(),'admin','active',true)",
      [adminId],
    );
    await pool.query(
      "INSERT INTO auth_sessions(id,user_id,token_digest,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [
        randomUUID(),
        adminId,
        Buffer.from(store.security.digest("account:" + adminToken), "hex"),
      ],
    );
    const admin = actor({ kh_account: adminToken });
    admin.csrf = store.security.guestCsrf(adminToken);
    const student = actor();
    const other = actor();
    let lesson;
    let track;
    let diagnostic;
    let diagnosticStartKey;
    let currentLessonId;
    const lessonPayload = {
      kind: "lesson",
      subject: "algebra",
      code: "ALG-L04",
      titleAr: "توزيع الأقواس — اختبار تقني اصطناعي",
      descriptionAr: "بيانات مؤقتة لا تشكل اعتماد محتوى تربوي.",
      objectives: ["تطبيق الضرب على كل حد داخل القوس"],
      skillCodes: ["SK-ALG-04"],
      prerequisiteSkillCodes: [],
      prerequisiteLessonIds: [],
      errorCodes: ["ERR-ALG-01"],
      mappingPending: [],
      contentBlocks: [
        {
          type: "paragraph",
          textAr: "عند توزيع الضرب نضرب المعامل في كل حد داخل القوس.",
        },
        {
          type: "paragraph",
          textAr: "نحافظ على توازن المعادلة ونراجع الإشارات عند كل انتقال.",
        },
        {
          type: "math_example",
          textAr: "مثال أول",
          raw: "٢(س + ٣) = ١٠",
          steps: [
            { raw: "٢س + ٦ = ١٠", explanationAr: "نوزع الضرب." },
            { raw: "٢س = ٤", explanationAr: "نطرح من الطرفين." },
            { raw: "س = ٢", explanationAr: "نقسم الطرفين." },
          ],
        },
        {
          type: "math_example",
          textAr: "مثال ثان",
          raw: "٣(س + ٢) = ١٨",
          steps: [
            { raw: "٣س + ٦ = ١٨", explanationAr: "نوزع الضرب." },
            { raw: "٣س = ١٢", explanationAr: "نطرح من الطرفين." },
            { raw: "س = ٤", explanationAr: "نقسم الطرفين." },
          ],
        },
        {
          type: "common_mistake",
          textAr: "راجع أثر المعامل على الحد الثابت أيضًا.",
        },
      ],
      practiceProblemRevisionIds: fixtures.problems
        .slice(0, 2)
        .map((problem) => problem.id),
      assessmentProblemRevisionIds: fixtures.problems
        .filter((problem) => problem.kind === "transfer")
        .map((problem) => problem.id),
    };
    async function transition(row, action, expect = 201) {
      return admin.request(
        `/studio/learning-content/${row.id}/transition`,
        "POST",
        { expectedRevision: row.editRevision, action },
        { expect },
      );
    }
    try {
      await student.start();
      await other.start();
      await t.test(
        "author validates with real math and publishes only through role-controlled workflow; drafts stay private",
        { skip: subjectsOnly },
        async () => {
          lesson = (
            await admin.request(
              "/studio/learning-content",
              "POST",
              lessonPayload,
              { expect: 201 },
            )
          ).data;
          await student.request(
            `/learning/lessons/${lesson.id}`,
            "GET",
            undefined,
            { expect: 404 },
          );
          await student.request(
            `/studio/learning-content/${lesson.id}`,
            "GET",
            undefined,
            { expect: 403 },
          );
          lesson = (
            await admin.request(
              `/studio/learning-content/${lesson.id}/validate`,
              "POST",
              { expectedRevision: lesson.editRevision },
              { expect: 201 },
            )
          ).data;
          assert.equal(
            lesson.validation.valid,
            true,
            lesson.validation.issues.join(" "),
          );
          lesson = (await transition(lesson, "submit")).data;
          lesson = (await transition(lesson, "approve")).data;
          lesson = (await transition(lesson, "publish")).data;
          track = (
            await admin.request(
              "/studio/learning-content",
              "POST",
              {
                kind: "track",
                subject: "algebra",
                code: "ALG-BASIC",
                titleAr: "الجبر — اختبار اصطناعي",
                descriptionAr: "مسار مؤقت لاختبار المصدر",
                units: [
                  {
                    code: "ALG-U01",
                    titleAr: "توزيع الأقواس",
                    lessonRevisionIds: [lesson.id],
                  },
                ],
              },
              { expect: 201 },
            )
          ).data;
          track = (await transition(track, "submit")).data;
          track = (await transition(track, "approve")).data;
          track = (await transition(track, "publish")).data;
          const visible = (
            await student.request(
              `/learning/tracks/${track.id}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.equal(visible.lessons[0].id, lesson.id);
          const detail = (
            await student.request(
              `/learning/lessons/${lesson.id}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.equal(detail.practiceProblems.length, 2);
          assert.ok(
            detail.assessmentProblems.every((problem) => !problem.equationRaw),
          );
          const invalidPayload = structuredClone(lessonPayload);
          invalidPayload.code = "ALG-TEST-INVALID";
          invalidPayload.contentBlocks[2].steps[0].raw = "٢س + ٣ = ١٠";
          let invalid = (
            await admin.request(
              "/studio/learning-content",
              "POST",
              invalidPayload,
              { expect: 201 },
            )
          ).data;
          invalid = (await transition(invalid, "submit")).data;
          await transition(invalid, "approve", 422);
        },
      );
      await t.test(
        "assessment is pinned, independently verified, idempotent and private",
        { skip: subjectsOnly },
        async () => {
          const start = {
            trackRevisionId: track.id,
            kind: "diagnostic_pretest",
          };
          const key = randomUUID();
          diagnosticStartKey = key;
          diagnostic = (
            await student.request("/assessments/start", "POST", start, {
              expect: 201,
              key,
            })
          ).data;
          const replay = (
            await student.request("/assessments/start", "POST", start, {
              expect: 201,
              key,
            })
          ).data;
          assert.equal(replay.id, diagnostic.id);
          assert.equal(diagnostic.questions.length, 10);
          await other.request(
            `/assessments/${diagnostic.id}`,
            "GET",
            undefined,
            { expect: 404 },
          );
          await student.request(
            `/assessments/${diagnostic.id}/answer`,
            "POST",
            {
              expectedRevision: 999,
              questionId: diagnostic.questions[0].id,
              steps: ["س = ١"],
            },
            { expect: 409 },
          );
          for (const [index, question] of diagnostic.questions.entries()) {
            const source = fixtures.problems.find(
              (problem) => problem.id === question.problem.revisionId,
            );
            const step = index >= 8 ? "س = ١" : source.answer;
            diagnostic = (
              await student.request(
                `/assessments/${diagnostic.id}/answer`,
                "POST",
                {
                  expectedRevision: diagnostic.revision,
                  questionId: question.id,
                  steps: [step],
                },
                { expect: 201 },
              )
            ).data;
          }
          assert.equal(
            diagnostic.questions.filter(
              (question) => question.status === "verified_invalid",
            ).length,
            2,
          );
          const summary = (
            await student.request(
              `/assessments/${diagnostic.id}/summary`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.ok(summary.skills[0].independentErrors >= 2);
          assert.equal(summary.recommendation.recommendedLessonId, lesson.id);
          assert.equal(summary.recommendation.confidence, "tentative");
          assert.ok(summary.recommendation.evidenceIds.length > 0);
          const native = (
            await student.request(
              `/attempts/${diagnostic.questions[0].attemptId}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          await student.request(
            `/attempts/${native.id}/steps/${native.steps[0].id}`,
            "PUT",
            {
              expectedRevision: native.revision,
              sourceRaw: "س = ١",
              inputOrigin: "keyboard",
            },
            { expect: 200 },
          );
          await student.request(
            `/assessments/${diagnostic.id}/answer`,
            "POST",
            {
              expectedRevision: diagnostic.revision,
              questionId: diagnostic.questions[0].id,
              steps: ["س = ١"],
            },
            { expect: 409 },
          );
          const refreshed = (
            await student.request(
              `/assessments/${diagnostic.id}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.ok(refreshed.revision > diagnostic.revision);
          assert.equal(refreshed.questions[0].status, null);
          diagnostic = refreshed;
          await student.request(
            `/learning/lessons/${lesson.id}/progress`,
            "POST",
            { event: "lesson_viewed" },
            { expect: 201 },
          );
        },
      );
      await t.test(
        "H2 practice stays assisted; fresh post-remediation questions produce actual evidence",
        { skip: subjectsOnly },
        async () => {
          let practice = (
            await student.request(
              "/assessments/start",
              "POST",
              {
                trackRevisionId: track.id,
                lessonRevisionId: lesson.id,
                kind: "practice",
              },
              { expect: 201 },
            )
          ).data;
          const question = practice.questions[0];
          practice = (
            await student.request(
              `/assessments/${practice.id}/answer`,
              "POST",
              {
                expectedRevision: practice.revision,
                questionId: question.id,
                steps: ["س = ١"],
              },
              { expect: 201 },
            )
          ).data;
          for (let index = 0; index < 2; index++) {
            const response = (
              await student.request(
                `/assessments/${practice.id}/support`,
                "POST",
                {
                  expectedRevision: practice.revision,
                  questionId: question.id,
                  action: "request_hint",
                },
                { expect: 201 },
              )
            ).data;
            practice = response.session;
            assert.equal(response.hint.level, "H" + (index + 1));
          }
          assert.equal(practice.questions[0].independent, false);
          const source = fixtures.problems.find(
            (problem) => problem.id === question.problem.revisionId,
          );
          practice = (
            await student.request(
              `/assessments/${practice.id}/answer`,
              "POST",
              {
                expectedRevision: practice.revision,
                questionId: question.id,
                steps: [source.answer],
              },
              { expect: 201 },
            )
          ).data;
          assert.equal(practice.questions[0].independent, false);
          let post = (
            await student.request(
              "/assessments/start",
              "POST",
              {
                trackRevisionId: track.id,
                lessonRevisionId: lesson.id,
                kind: "post_remediation",
              },
              { expect: 201 },
            )
          ).data;
          assert.equal(post.questions.length, 2);
          const exposed = new Set(
            [...diagnostic.questions, ...practice.questions].map(
              (item) => item.problem.revisionId,
            ),
          );
          assert.ok(
            post.questions.every(
              (item) => !exposed.has(item.problem.revisionId),
            ),
          );
          for (const item of post.questions) {
            const source = fixtures.problems.find(
              (problem) => problem.id === item.problem.revisionId,
            );
            post = (
              await student.request(
                `/assessments/${post.id}/answer`,
                "POST",
                {
                  expectedRevision: post.revision,
                  questionId: item.id,
                  steps: [source.answer],
                },
                { expect: 201 },
              )
            ).data;
          }
          const summary = (
            await student.request(
              `/assessments/${post.id}/summary`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.equal(summary.skills[0].state, "independent_evidence");
          const reopened = (
            await student.request(
              `/assessments/${practice.id}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.deepEqual(reopened.questions[0].steps, [source.answer]);
          assert.equal(reopened.lessonRevisionId, lesson.id);
        },
      );
      await t.test(
        "published revisions remain pinned after the author creates and publishes a new revision",
        { skip: subjectsOnly },
        async () => {
          let next = (await transition(lesson, "revise")).data;
          assert.notEqual(next.id, lesson.id);
          assert.equal(next.version, lesson.version + 1);
          const payload = {
            ...next.payload,
            descriptionAr: "نسخة اختبار تقنية جديدة",
          };
          next = (
            await admin.request(
              `/studio/learning-content/${next.id}`,
              "PUT",
              { expectedRevision: next.editRevision, payload },
              { expect: 200 },
            )
          ).data;
          next = (await transition(next, "submit")).data;
          next = (await transition(next, "approve")).data;
          next = (await transition(next, "publish")).data;
          currentLessonId = next.id;
          const pinned = (
            await student.request(
              `/learning/lessons/${lesson.id}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.equal(pinned.version, lesson.version);
          assert.notEqual(
            pinned.payload.descriptionAr,
            next.payload.descriptionAr,
          );
          await other.request(
            `/learning/lessons/${lesson.id}`,
            "GET",
            undefined,
            { expect: 404 },
          );
          const oldTrack = track;
          let nextTrack = (await transition(track, "revise")).data;
          nextTrack = (
            await admin.request(
              `/studio/learning-content/${nextTrack.id}`,
              "PUT",
              {
                expectedRevision: nextTrack.editRevision,
                payload: {
                  ...nextTrack.payload,
                  units: [
                    {
                      code: "ALG-U01",
                      titleAr: "توزيع الأقواس",
                      lessonRevisionIds: [next.id],
                    },
                  ],
                },
              },
              { expect: 200 },
            )
          ).data;
          nextTrack = (await transition(nextTrack, "submit")).data;
          nextTrack = (await transition(nextTrack, "approve")).data;
          nextTrack = (await transition(nextTrack, "publish")).data;
          await student.request(
            `/learning/tracks/${oldTrack.id}`,
            "GET",
            undefined,
            { expect: 200 },
          );
          await other.request(
            `/learning/tracks/${oldTrack.id}`,
            "GET",
            undefined,
            { expect: 404 },
          );
          await student.request(
            "/assessments/start",
            "POST",
            { trackRevisionId: oldTrack.id, kind: "diagnostic_pretest" },
            { expect: 409 },
          );
          const archivedReplay = (
            await student.request(
              "/assessments/start",
              "POST",
              { trackRevisionId: oldTrack.id, kind: "diagnostic_pretest" },
              { expect: 201, key: diagnosticStartKey },
            )
          ).data;
          assert.equal(archivedReplay.id, diagnostic.id);
          const resumed = (
            await student.request(
              `/assessments/${diagnostic.id}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.equal(resumed.trackRevisionId, oldTrack.id);
          track = nextTrack;
        },
      );
      await t.test(
        "physics uses the shared path with actual value/unit verification; programming stays read-only without Runner",
        async () => {
          const publishedProblems = [];
          async function publishQuestion(payload) {
            let row = (
              await admin.request("/studio/items", "POST", payload, {
                expect: 201,
              })
            ).data;
            row = (
              await admin.request(
                `/studio/items/${row.id}/validate`,
                "POST",
                { expectedRevision: row.editRevision },
                { expect: 201 },
              )
            ).data;
            assert.equal(
              row.validation.valid,
              true,
              row.validation.issues.join(" "),
            );
            for (const action of ["submit", "approve", "publish"])
              row = (
                await admin.request(
                  `/studio/items/${row.id}/transition`,
                  "POST",
                  { expectedRevision: row.editRevision, action },
                  { expect: 201 },
                )
              ).data;
            return row;
          }
          for (const [index, [v, time]] of [
            [3, 4],
            [5, 6],
            [7, 6],
          ].entries()) {
            const physics = {
              topic: "kinematics_1d",
              formula: "constant_speed_distance",
              quantity: "distance",
              expectedDimension: "length",
              expectedValueSI: String(v * time),
              expectedUnit: "m",
              tolerance: "0",
              givens: { v: String(v), t: String(time) },
            };
            const question = await publishQuestion({
              titleAr: "فيزياء — اختبار اصطناعي",
              statementAr: `تحرك جسم بسرعة ${v} m/s مدة ${time} s. أوجد المسافة.`,
              subject: "physics",
              unitCode: "kinematics_1d",
              unitTitleAr: "الحركة",
              lessonCode: "constant_motion",
              lessonTitleAr: "الحركة بسرعة ثابتة",
              skillCodes: ["PHYS-CONSTANT_MOTION"],
              difficulty: 1,
              kind: "main",
              familyCode: "v22-physics-" + index,
              hints: [
                {
                  level: 1,
                  textAr: "حدد الكمية المطلوبة ووحدتها.",
                  source: "manual",
                  reviewed: true,
                },
                {
                  level: 2,
                  textAr: "اربط السرعة بالزمن قبل الحساب.",
                  source: "manual",
                  reviewed: true,
                },
                {
                  level: 3,
                  textAr: "راجع توافق الوحدة مع المسافة.",
                  source: "manual",
                  reviewed: true,
                },
              ],
              physics,
            });
            publishedProblems.push({
              ...question,
              expectedValue: physics.expectedValueSI,
            });
          }
          const payload = {
            kind: "lesson",
            subject: "physics",
            code: "PHY-TEST-L01",
            titleAr: "السرعة والمسافة — اختبار تقني",
            descriptionAr: "محتوى اصطناعي مؤقت للتحقق من المسار",
            objectives: ["ربط المسافة بالسرعة والزمن والوحدة"],
            skillCodes: ["PHYS-CONSTANT_MOTION"],
            prerequisiteSkillCodes: [],
            prerequisiteLessonIds: [],
            errorCodes: [],
            mappingPending: [],
            contentBlocks: [
              {
                type: "paragraph",
                textAr:
                  "المسافة في الحركة بسرعة ثابتة تساوي حاصل ضرب السرعة في الزمن.",
              },
              {
                type: "physics_example",
                textAr: "مثال قيمة ووحدة",
                physics: {
                  topic: "kinematics_1d",
                  formula: "constant_speed_distance",
                  quantity: "distance",
                  expectedDimension: "length",
                  expectedValueSI: "6",
                  expectedUnit: "m",
                  tolerance: "0",
                  givens: { v: "2", t: "3" },
                },
              },
            ],
            practiceProblemRevisionIds: [publishedProblems[0].id],
            assessmentProblemRevisionIds: publishedProblems
              .slice(1)
              .map((problem) => problem.id),
          };
          let physicsLesson = (
            await admin.request("/studio/learning-content", "POST", payload, {
              expect: 201,
            })
          ).data;
          for (const action of ["submit", "approve", "publish"])
            physicsLesson = (await transition(physicsLesson, action)).data;
          let physicsTrack = (
            await admin.request(
              "/studio/learning-content",
              "POST",
              {
                kind: "track",
                subject: "physics",
                code: "PHY-TEST-TRACK",
                titleAr: "الحركة — اختبار اصطناعي",
                descriptionAr: "مسار مؤقت",
                units: [
                  {
                    code: "PHY-U01",
                    titleAr: "الحركة",
                    lessonRevisionIds: [physicsLesson.id],
                  },
                ],
              },
              { expect: 201 },
            )
          ).data;
          for (const action of ["submit", "approve", "publish"])
            physicsTrack = (await transition(physicsTrack, action)).data;
          let practice = (
            await student.request(
              "/assessments/start",
              "POST",
              {
                trackRevisionId: physicsTrack.id,
                lessonRevisionId: physicsLesson.id,
                kind: "practice",
              },
              { expect: 201 },
            )
          ).data;
          const question = practice.questions[0];
          practice = (
            await student.request(
              `/assessments/${practice.id}/answer`,
              "POST",
              {
                expectedRevision: practice.revision,
                questionId: question.id,
                steps: [],
                value: publishedProblems[0].expectedValue,
                unit: "m",
              },
              { expect: 201 },
            )
          ).data;
          assert.equal(practice.questions[0].status, "correct");
          assert.equal(practice.questions[0].independent, false);
          const native = await pool.query(
            "SELECT independent FROM subject_attempts WHERE id=$1",
            [practice.questions[0].attemptId],
          );
          assert.equal(native.rows[0].independent, false);
          practice = (
            await student.request(
              `/assessments/${practice.id}/answer`,
              "POST",
              {
                expectedRevision: practice.revision,
                questionId: question.id,
                steps: [],
                value: publishedProblems[0].expectedValue,
                unit: "s",
              },
              { expect: 201 },
            )
          ).data;
          assert.equal(practice.questions[0].status, "wrong_unit");
          let post = (
            await student.request(
              "/assessments/start",
              "POST",
              {
                trackRevisionId: physicsTrack.id,
                lessonRevisionId: physicsLesson.id,
                kind: "post_remediation",
              },
              { expect: 201 },
            )
          ).data;
          assert.equal(post.questions.length, 2);
          for (const item of post.questions) {
            const source = publishedProblems.find(
              (problem) => problem.id === item.problem.revisionId,
            );
            post = (
              await student.request(
                `/assessments/${post.id}/answer`,
                "POST",
                {
                  expectedRevision: post.revision,
                  questionId: item.id,
                  steps: [],
                  value: source.expectedValue,
                  unit: "m",
                },
                { expect: 201 },
              )
            ).data;
            assert.equal(
              post.questions.find((q) => q.id === item.id).status,
              "correct",
            );
          }
          const summary = (
            await student.request(
              `/assessments/${post.id}/summary`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.equal(summary.skills[0].skillCode, "PHYS-CONSTANT_MOTION");
          assert.equal(summary.skills[0].state, "independent_evidence");
          assert.ok(
            summary.skills.every(
              (skill) => !skill.skillCode.startsWith("SK-ALG"),
            ),
          );
          const firstPost = post.questions[0];
          const nativePost = (
            await student.request(
              `/physics/attempts/${firstPost.attemptId}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          await student.request(
            `/physics/attempts/${firstPost.attemptId}/hints`,
            "POST",
            { expectedRevision: nativePost.result.revision, level: 1 },
            { expect: 409 },
          );
          const nativeSource = publishedProblems.find(
            (problem) => problem.id === firstPost.problem.revisionId,
          );
          await student.request(
            "/physics/attempts",
            "POST",
            {
              problemRevisionId: firstPost.problem.revisionId,
              attemptId: firstPost.attemptId,
              expectedRevision: nativePost.result.revision,
              value: nativeSource.expectedValue,
              unit: "m",
            },
            { expect: 200 },
          );
          await student.request(
            `/assessments/${post.id}/answer`,
            "POST",
            {
              expectedRevision: post.revision,
              questionId: firstPost.id,
              steps: [],
              value: nativeSource.expectedValue,
              unit: "m",
            },
            { expect: 409 },
          );
          const refreshedPost = (
            await student.request(`/assessments/${post.id}`, "GET", undefined, {
              expect: 200,
            })
          ).data;
          assert.ok(refreshedPost.revision > post.revision);
          let pythonLesson = (
            await admin.request(
              "/studio/learning-content",
              "POST",
              {
                ...payload,
                subject: "programming",
                code: "PY-TEST-L01",
                titleAr: "مقدمة Python — اختبار تقني",
                skillCodes: ["PY-PRINT"],
                objectives: ["قراءة مثال الطباعة"],
                contentBlocks: [
                  { type: "paragraph", textAr: "تطبع الدالة النص المعطى لها." },
                  {
                    type: "code_example",
                    textAr: "مثال للقراءة فقط",
                    code: "print('Hello')",
                  },
                ],
                practiceProblemRevisionIds: [],
                assessmentProblemRevisionIds: [],
              },
              { expect: 201 },
            )
          ).data;
          for (const action of ["submit", "approve", "publish"])
            pythonLesson = (await transition(pythonLesson, action)).data;
          let pythonTrack = (
            await admin.request(
              "/studio/learning-content",
              "POST",
              {
                kind: "track",
                subject: "programming",
                code: "PY-TEST-TRACK",
                titleAr: "Python — اختبار اصطناعي",
                descriptionAr: "درس قراءة فقط، لا تشغيل كود",
                units: [
                  {
                    code: "PY-U01",
                    titleAr: "الطباعة",
                    lessonRevisionIds: [pythonLesson.id],
                  },
                ],
              },
              { expect: 201 },
            )
          ).data;
          for (const action of ["submit", "approve", "publish"])
            pythonTrack = (await transition(pythonTrack, action)).data;
          const reading = (
            await student.request(
              `/learning/lessons/${pythonLesson.id}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data;
          assert.equal(reading.payload.subject, "programming");
          assert.equal(reading.payload.contentBlocks[1].code, "print('Hello')");
          await student.request(
            "/assessments/start",
            "POST",
            { trackRevisionId: pythonTrack.id, kind: "diagnostic_pretest" },
            { expect: 409 },
          );
        },
      );
      t.diagnostic(
        `Verified ${operations.length} HTTP responses against canonical OpenAPI; PostgreSQL17.6 and actual SymPy; synthetic test actors only.`,
      );
      if (serve) {
        let revisedTrack = (await transition(track, "revise")).data;
        revisedTrack = (
          await admin.request(
            `/studio/learning-content/${revisedTrack.id}`,
            "PUT",
            {
              expectedRevision: revisedTrack.editRevision,
              payload: {
                ...revisedTrack.payload,
                units: [
                  {
                    code: "ALG-U01",
                    titleAr: "توزيع الأقواس",
                    lessonRevisionIds: [currentLessonId],
                  },
                ],
              },
            },
            { expect: 200 },
          )
        ).data;
        revisedTrack = (await transition(revisedTrack, "submit")).data;
        revisedTrack = (await transition(revisedTrack, "approve")).data;
        revisedTrack = (await transition(revisedTrack, "publish")).data;
        assert.equal(revisedTrack.status, "published");
        const { createServer } = await import("vite");
        const preview = await createServer({
          configFile: false,
          root: path.resolve("apps/web"),
          server: {
            host: "127.0.0.1",
            port: 8461,
            strictPort: true,
            https: {
              cert: readFileSync(".local/ph09-tls/cert.pem"),
              key: readFileSync(".local/ph09-tls/key.pem"),
            },
            proxy: { "/api": base },
          },
        });
        preview.middlewares.use((request, response, next) => {
          if (request.url === "/__v22_test_teacher") {
            response.setHeader(
              "Set-Cookie",
              `kh_account=${adminToken}; Secure; HttpOnly; SameSite=Lax; Path=/`,
            );
            response.writeHead(302, { location: "/" });
            response.end();
          } else if (request.url === "/__v22_test_student") {
            response.setHeader("Set-Cookie", [
              "kh_account=; Max-Age=0; Secure; HttpOnly; SameSite=Lax; Path=/",
              "kh_guest=; Max-Age=0; Secure; HttpOnly; SameSite=Lax; Path=/",
            ]);
            response.writeHead(302, { location: "/" });
            response.end();
          } else next();
        });
        await preview.listen();
        mkdirSync(".local", { recursive: true });
        const stopFile = path.resolve(
          ".local",
          `v22-preview-stop-${process.env.V22_TEST_CONTAINER}`,
        );
        writeFileSync(
          ".local/v22-preview.json",
          JSON.stringify(
            {
              url: process.env.PUBLIC_APP_ORIGIN,
              teacherUrl: process.env.PUBLIC_APP_ORIGIN + "/__v22_test_teacher",
              studentUrl: process.env.PUBLIC_APP_ORIGIN + "/__v22_test_student",
              stopFile,
              testContainer: process.env.V22_TEST_CONTAINER,
              expiresAt: new Date(Date.now() + 600000).toISOString(),
              scope: "Synthetic test fixtures only, no content approval",
            },
            null,
            2,
          ),
        );
        console.log(
          "V22_BROWSER_PREVIEW_READY " + process.env.PUBLIC_APP_ORIGIN,
        );
        const until = Date.now() + 600000;
        while (Date.now() < until && !existsSync(stopFile))
          await new Promise((resolve) => setTimeout(resolve, 250));
        await preview.close();
      }
    } finally {
      await close();
    }
  },
);
