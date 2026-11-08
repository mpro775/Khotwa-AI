import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fixtures = JSON.parse(
  readFileSync(
    "qa/fixtures/advanced-learning-c/fixtures.synthetic.json",
    "utf8",
  ),
);
const hash = (p) =>
  createHash("sha256").update(JSON.stringify(p)).digest("hex");
function noLeak(payload) {
  assert.doesNotMatch(
    JSON.stringify(payload),
    /"(?:privateEvaluation|privateRubric|hiddenTests|referenceCode|privateValidation|domainVerification|solutionKey)"/,
  );
}
export async function advancedLearningJourney({
  t,
  pool,
  app,
  actor,
  reviewerId,
  reviewer,
}) {
  const {
    parseLearningPayload,
  } = require("../apps/api/dist/learning-path-payload.js");
  const { Store } = require("../apps/api/dist/store.js");
  const store = app.get(Store),
    client = actor(),
    other = actor(),
    content = {};
  await client.start();
  await other.start();
  async function revision(payload, status = "published") {
    const itemId = randomUUID(),
      id = randomUUID(),
      parsed = parseLearningPayload(payload);
    await pool.query(
      "INSERT INTO learning_content_items(id,code,subject_code,kind) VALUES($1,$2,$3,$4)",
      [itemId, payload.code, payload.subject, payload.kind],
    );
    // TEST_ONLY mechanics in a disposable DB; no human signoff or application seed.
    await pool.query(
      "INSERT INTO learning_content_revisions(id,item_id,version,status,payload,content_hash,created_by,reviewed_by,published_by,reviewed_at,published_at) VALUES($1,$2,1,$3,$4,$5,$6,$6,$6,now(),now())",
      [id, itemId, status, parsed, hash(parsed), reviewerId],
    );
    return { id, payload: parsed };
  }
  for (let i = 0; i < 3; i++) {
    const problem = fixtures.problems[i],
      project = fixtures.projects[i],
      subject = problem.subject;
    const payload = {
      kind: "lesson",
      subject,
      code: "C-TEST-LESSON-" + subject,
      titleAr: "درس اصطناعي لاختبار المصدر",
      descriptionAr: "TEST_ONLY دون اعتماد بشري",
      objectives: problem.objectives,
      skillCodes: problem.skillCodes,
      prerequisiteSkillCodes: [],
      prerequisiteLessonIds: [],
      errorCodes: [],
      mappingPending: [],
      practiceProblemRevisionIds: [],
      assessmentProblemRevisionIds: [],
      contentBlocks: [
        { type: "problem_activity", textAr: "المشكلة", activity: problem },
        { type: "project_activity", textAr: "المشروع", activity: project },
        {
          type: "representation_set",
          textAr: "التمثيلات",
          representation: {
            schemaVersion: "udl-representation-v1",
            learningObjective: problem.objectives[0],
            targetSkillCodes: problem.skillCodes,
            variants: problem.representations,
            responseModes: ["text"],
          },
        },
      ],
    };
    const lesson = await revision(payload),
      track = await revision({
        kind: "track",
        subject,
        code: "C-TEST-TRACK-" + subject,
        titleAr: "مسار اختبار اصطناعي",
        descriptionAr: "لا اعتماد محتوى",
        units: [
          {
            code: "C-U1",
            titleAr: "وحدة تجريبية",
            lessonRevisionIds: [lesson.id],
          },
        ],
      });
    content[subject] = { lesson, track, problem, project };
  }
  let problemSession, projectRun;
  await t.test(
    "C contracts auth public redaction draft exposure and published activities",
    async () => {
      const a = content.algebra;
      await actor().request(
        `/learning/problems/available?trackRevisionId=${a.track.id}`,
        "GET",
        undefined,
        { expect: 401 },
      );
      for (const c of Object.values(content)) {
        const available = (
          await client.request(
            `/learning/problems/available?trackRevisionId=${c.track.id}`,
            "GET",
            undefined,
            { expect: 200 },
          )
        ).data;
        noLeak(available);
        assert.equal(available.items.length, 1);
        const brief = (
          await client.request(
            `/learning/problems/${c.lesson.id}?blockIndex=0`,
            "GET",
            undefined,
            { expect: 200 },
          )
        ).data;
        noLeak(brief);
        assert.equal(brief.activity.type, "problem_based");
        const rep = (
          await client.request(
            `/learning/representations/${c.lesson.id}?blockIndex=2`,
            "GET",
            undefined,
            { expect: 200 },
          )
        ).data;
        assert.ok(rep.variants[0].accessibleText);
      }
      const draft = await revision(
        { ...a.lesson.payload, code: "C-TEST-DRAFT" },
        "draft",
      );
      await client.request(
        `/learning/problems/${draft.id}?blockIndex=0`,
        "GET",
        undefined,
        { expect: 404 },
      );
    },
  );
  await t.test(
    "C1 session owner/CAS/idempotency/race and synthetic real HTTP stages",
    async () => {
      for (const c of Object.values(content)) {
        const body = {
            trackRevisionId: c.track.id,
            lessonRevisionId: c.lesson.id,
            blockIndex: 0,
          },
          key = randomUUID();
        let s = (
          await client.request("/learning/problem-sessions", "POST", body, {
            key,
            expect: 200,
          })
        ).data;
        noLeak(s);
        assert.equal(s.evidenceClass, "learning_only");
        assert.deepEqual(
          (
            await client.request("/learning/problem-sessions", "POST", body, {
              key,
              expect: 200,
            })
          ).data,
          s,
        );
        await client.request(
          "/learning/problem-sessions",
          "POST",
          { ...body, blockIndex: 1 },
          { key, expect: 409 },
        );
        await other.request(
          `/learning/problem-sessions/${s.id}`,
          "GET",
          undefined,
          { expect: 404 },
        );
        const updates = await Promise.all(
          ["الخطة الأولى", "الخطة الثانية"].map((textAr) =>
            client.request(`/learning/problem-sessions/${s.id}/steps`, "POST", {
              expectedRevision: s.revision,
              stage: "frame",
              textAr,
            }),
          ),
        );
        assert.deepEqual(updates.map((r) => r.status).sort(), [200, 409]);
        s = updates.find((r) => r.status === 200).data;
        for (const stage of [
          "frame",
          "plan",
          "investigate",
          "justify",
          "reflect",
        ])
          s = (
            await client.request(
              `/learning/problem-sessions/${s.id}/steps`,
              "POST",
              {
                expectedRevision: s.revision,
                stage,
                textAr: "تفسير اصطناعي محفوظ " + stage,
              },
              { expect: 200 },
            )
          ).data;
        s = (
          await client.request(
            `/learning/problem-sessions/${s.id}/feedback`,
            "POST",
            { expectedRevision: s.revision, answer: { raw: "س = ٥" } },
            { expect: 200 },
          )
        ).data;
        assert.equal(s.result.result, "needs_review");
        s = (
          await client.request(
            `/learning/problem-sessions/${s.id}/finish`,
            "POST",
            { expectedRevision: s.revision },
            { expect: 200 },
          )
        ).data;
        assert.equal(s.status, "completed");
        assert.equal(s.evidenceClass, "learning_only");
        problemSession = s;
      }
    },
  );
  await t.test(
    "C2 revision-requested immutable artifact then accepted final human-review mechanism",
    async () => {
      for (const c of Object.values(content)) {
        let run = (
          await client.request(
            "/learning/project-runs",
            "POST",
            {
              trackRevisionId: c.track.id,
              lessonRevisionId: c.lesson.id,
              blockIndex: 1,
            },
            { expect: 200 },
          )
        ).data;
        for (const m of c.project.milestones)
          run = (
            await client.request(
              `/learning/project-runs/${run.id}/milestones/${m.code}`,
              "POST",
              {
                expectedRevision: run.revision,
                textAr: "خطة وتوثيق " + m.code,
              },
              { expect: 200 },
            )
          ).data;
        const m = c.project.milestones.at(-1),
          artifact =
            m.requiredArtifactKind === "text"
              ? "نص المشروع لا ينفذ كودًا"
              : { explanation: "نتائج جدول اصطناعي", values: [1, 2] };
        run = (
          await client.request(
            `/learning/project-runs/${run.id}/submissions`,
            "POST",
            {
              expectedRevision: run.revision,
              milestoneCode: m.code,
              artifactKind: m.requiredArtifactKind,
              artifact,
              isFinal: false,
            },
            { expect: 200 },
          )
        ).data;
        const first = run.submissions[0],
          feedback = {
            expectedRevision: run.revision,
            decision: "revision_requested",
            criteria: c.project.publicRubric.map((r) => ({
              criterionCode: r.code,
              levelCode: r.levels[0].code,
              reasonAr: "مراجعة آلية لاختبار آلية المراجعة فقط",
            })),
            feedbackAr: "TEST_ONLY: أضف شرح الافتراضات",
          };
        await client.request(
          `/studio/project-submissions/${first.id}/feedback`,
          "POST",
          feedback,
          { expect: 403 },
        );
        run = (
          await reviewer.request(
            `/studio/project-submissions/${first.id}/feedback`,
            "POST",
            feedback,
            { expect: 200 },
          )
        ).data;
        assert.equal(run.status, "revision_requested");
        await reviewer.request(
          `/studio/project-submissions/${first.id}/feedback`,
          "POST",
          { ...feedback, expectedRevision: run.revision },
          { expect: 409 },
        );
        run = (
          await client.request(
            `/learning/project-runs/${run.id}/submissions`,
            "POST",
            {
              expectedRevision: run.revision,
              milestoneCode: m.code,
              artifactKind: m.requiredArtifactKind,
              artifact:
                m.requiredArtifactKind === "text"
                  ? artifact + " مع الافتراضات"
                  : { ...artifact, assumptions: "شروط التجربة" },
              isFinal: true,
            },
            { expect: 200 },
          )
        ).data;
        const second = run.submissions[1];
        assert.equal(
          run.submissions[0].artifact,
          m.requiredArtifactKind === "text"
            ? artifact
            : run.submissions[0].artifact,
        );
        run = (
          await reviewer.request(
            `/studio/project-submissions/${second.id}/feedback`,
            "POST",
            {
              ...feedback,
              expectedRevision: run.revision,
              decision: "accepted",
              feedbackAr: "TEST_ONLY قبول مسار المصدر",
            },
            { expect: 200 },
          )
        ).data;
        run = (
          await client.request(
            `/learning/project-runs/${run.id}/finish`,
            "POST",
            { expectedRevision: run.revision },
            { expect: 200 },
          )
        ).data;
        assert.equal(run.status, "completed");
        assert.equal(run.submissions.length, 2);
        noLeak(run);
        await other.request(
          `/learning/project-runs/${run.id}`,
          "GET",
          undefined,
          { expect: 404 },
        );
        await assert.rejects(
          () =>
            pool.query(
              "UPDATE learning_project_submissions SET artifact_json='\"overwritten\"'::jsonb WHERE id=$1",
              [first.id],
            ),
          /immutable/,
        );
        projectRun = run;
      }
    },
  );
  await t.test(
    "C5 reconcile replay safe, honest nulls, role restrictions, no learner text",
    async () => {
      const track = content.algebra.track.id;
      const dashboard = (
        await client.request(
          `/learning/analytics/me?trackRevisionId=${track}&window=7`,
          "GET",
          undefined,
          { expect: 200 },
        )
      ).data;
      assert.equal(dashboard.activity.problemCompleted, 1);
      assert.equal(dashboard.activity.projectCompleted, 1);
      assert.equal(dashboard.metrics[0].value, null);
      const [before] = (
        await pool.query(
          "SELECT count(*)::int AS n FROM learning_analytics_events",
        )
      ).rows;
      for (let i = 0; i < 10; i++)
        await client.request(
          `/learning/analytics/me?trackRevisionId=${track}&window=7`,
          "GET",
          undefined,
          { expect: 200 },
        );
      const [after] = (
        await pool.query(
          "SELECT count(*)::int AS n FROM learning_analytics_events",
        )
      ).rows;
      assert.equal(after.n, before.n);
      const rows = (
        await pool.query("SELECT payload FROM learning_analytics_events")
      ).rows;
      assert.doesNotMatch(
        JSON.stringify(rows),
        /تفسير اصطناعي|نص المشروع|solutionKey|hiddenTests|email/,
      );
      await client.request(
        `/studio/learning-analytics/content?revisionId=${content.algebra.lesson.id}`,
        "GET",
        undefined,
        { expect: 403 },
      );
      const quality = (
        await reviewer.request(
          `/studio/learning-analytics/content?revisionId=${content.algebra.lesson.id}`,
          "GET",
          undefined,
          { expect: 200 },
        )
      ).data;
      assert.equal(quality.status, "suppressed");
      assert.equal(quality.quality.problemActivities, 1);
      await reviewer.request(
        `/learning/analytics/cohort/${randomUUID()}`,
        "GET",
        undefined,
        { expect: 403 },
      );
    },
  );
  await t.test(
    "C OFF preserves read-only state and rejects writes/replayed starts",
    async () => {
      process.env.C_PROBLEM_LEARNING_ENABLED = "false";
      process.env.C_PROJECT_LEARNING_ENABLED = "false";
      const resumed = (
        await client.request(
          `/learning/problem-sessions/${problemSession.id}`,
          "GET",
          undefined,
          { expect: 200 },
        )
      ).data;
      assert.equal(resumed.readOnly, true);
      const resumedProject = (
        await client.request(
          `/learning/project-runs/${projectRun.id}`,
          "GET",
          undefined,
          { expect: 200 },
        )
      ).data;
      assert.equal(resumedProject.readOnly, true);
      await client.request(
        `/learning/problem-sessions/${problemSession.id}/steps`,
        "POST",
        {
          expectedRevision: problemSession.revision,
          stage: "frame",
          textAr: "تعديل",
        },
        { expect: 403 },
      );
      process.env.C_PROBLEM_LEARNING_ENABLED = "true";
      process.env.C_PROJECT_LEARNING_ENABLED = "true";
    },
  );
  await t.test(
    "C4 author/reviewer hash scopes gate, versioned publishing, no self approval",
    async () => {
      const authorId = randomUUID(),
        token = randomBytes(32).toString("base64url");
      await pool.query(
        "INSERT INTO users(id,email_normalized,email_verified_at,role,status,is_internal) VALUES($1,$2,now(),'content_manager','active',true)",
        [authorId, authorId + "@example.invalid"],
      );
      await pool.query(
        "INSERT INTO auth_sessions(id,user_id,token_digest,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
        [
          randomUUID(),
          authorId,
          Buffer.from(store.security.digest("account:" + token), "hex"),
        ],
      );
      const author = actor({ kh_account: token });
      author.csrf = store.security.guestCsrf(token);
      // Physics advanced lessons do not invent an algebra bank requirement.
      let r = (
        await author.request(
          "/studio/learning-content",
          "POST",
          { ...content.physics.lesson.payload, code: "C-TEST-C4-AUTHOR" },
          { expect: 201 },
        )
      ).data;
      r = (
        await author.request(
          `/studio/learning-content/${r.id}/transition`,
          "POST",
          { expectedRevision: r.editRevision, action: "submit" },
          { expect: 201 },
        )
      ).data;
      await reviewer.request(
        `/studio/learning-content/${r.id}/transition`,
        "POST",
        { expectedRevision: r.editRevision, action: "approve" },
        { expect: 409 },
      );
      for (const scope of [
        "subject",
        "pedagogy",
        "accessibility",
        "security",
      ]) {
        const review = (
          await reviewer.request(
            `/studio/learning-content/${r.id}/reviews`,
            "POST",
            {
              expectedRevision: r.editRevision,
              scope,
              decision: "approve",
              notesAr: "TEST_ONLY technical workflow test",
            },
            { expect: 201 },
          )
        ).data;
        assert.equal(review.review.reviewMode, "TEST_ONLY");
        r = review.content;
      }
      r = (
        await reviewer.request(
          `/studio/learning-content/${r.id}/transition`,
          "POST",
          { expectedRevision: r.editRevision, action: "approve" },
          { expect: 201 },
        )
      ).data;
      r = (
        await reviewer.request(
          `/studio/learning-content/${r.id}/transition`,
          "POST",
          { expectedRevision: r.editRevision, action: "publish" },
          { expect: 201 },
        )
      ).data;
      const pinned = r.id;
      r = (
        await author.request(
          `/studio/learning-content/${r.id}/transition`,
          "POST",
          { expectedRevision: r.editRevision, action: "revise" },
          { expect: 201 },
        )
      ).data;
      assert.notEqual(r.id, pinned);
      assert.equal(r.status, "draft");
      assert.equal(
        (
          await pool.query(
            "SELECT status FROM learning_content_revisions WHERE id=$1",
            [pinned],
          )
        ).rows[0].status,
        "published",
      );
    },
  );
  await t.test(
    "C claim atomically transfers runs/artifacts, clears stale projection and supports safe export/deletion",
    async () => {
      const realId = randomUUID(),
        realGuestId = randomUUID(),
        realToken = randomBytes(32).toString("base64url");
      await pool.query(
        "INSERT INTO guest_sessions(id,token_digest,status,expires_at) VALUES($1,$2,'active',now()+interval '1 hour')",
        [
          realGuestId,
          Buffer.from(
            store.security.digest(randomBytes(32).toString("base64url")),
            "hex",
          ),
        ],
      );
      // Synthetic test identity marked noninternal solely for the refusal case.
      await pool.query(
        "INSERT INTO users(id,email_normalized,email_verified_at,role,status,is_internal,learning_guest_id) VALUES($1,$2,now(),'student','active',false,$3)",
        [realId, realId + "@example.invalid", realGuestId],
      );
      await pool.query(
        "INSERT INTO auth_sessions(id,user_id,token_digest,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
        [
          randomUUID(),
          realId,
          Buffer.from(store.security.digest("account:" + realToken), "hex"),
        ],
      );
      const realAccount = actor({
        ...client.cookieSnapshot(),
        kh_account: realToken,
      });
      realAccount.csrf = store.security.guestCsrf(realToken);
      await realAccount.request(
        "/me/claim-guest",
        "POST",
        { consent: true },
        { expect: 409 },
      );
      const userId = randomUUID(),
        guestId = randomUUID(),
        token = randomBytes(32).toString("base64url");
      await pool.query(
        "INSERT INTO guest_sessions(id,token_digest,status,expires_at) VALUES($1,$2,'active',now()+interval '1 hour')",
        [
          guestId,
          Buffer.from(
            store.security.digest(randomBytes(32).toString("base64url")),
            "hex",
          ),
        ],
      );
      await pool.query(
        "INSERT INTO users(id,email_normalized,email_verified_at,role,status,is_internal,learning_guest_id) VALUES($1,$2,now(),'student','active',true,$3)",
        [userId, userId + "@example.invalid", guestId],
      );
      await pool.query(
        "INSERT INTO auth_sessions(id,user_id,token_digest,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
        [
          randomUUID(),
          userId,
          Buffer.from(store.security.digest("account:" + token), "hex"),
        ],
      );
      const account = actor({ ...client.cookieSnapshot(), kh_account: token });
      account.csrf = store.security.guestCsrf(token);
      await account.request(
        "/me/claim-guest",
        "POST",
        { consent: true },
        { expect: 200 },
      );
      const project = (
        await account.request(
          `/learning/project-runs/${projectRun.id}`,
          "GET",
          undefined,
          { expect: 200 },
        )
      ).data;
      assert.equal(project.submissions.length, 2);
      const exported = (
        await account.request("/me/export", "GET", undefined, { expect: 200 })
      ).data;
      assert.equal(exported.advancedLearning.sessions.length, 6);
      assert.equal(exported.advancedLearning.submissions.length, 6);
      noLeak(exported);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM intelligent_learning_events e JOIN intelligent_learning_records r ON r.id=e.record_id WHERE e.owner_key<>r.owner_key",
          )
        ).rows[0].n,
        0,
      );
      const dashboard = (
        await account.request(
          `/learning/analytics/me?trackRevisionId=${content.algebra.track.id}`,
          "GET",
          undefined,
          { expect: 200 },
        )
      ).data;
      assert.equal(dashboard.activity.projectCompleted, 1);
      await account.request(
        "/me",
        "DELETE",
        { confirm: true },
        { expect: 202 },
      );
      await account.request(
        `/learning/project-runs/${projectRun.id}`,
        "GET",
        undefined,
        { expect: 401 },
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM learning_project_submissions WHERE project_run_id=$1",
            [projectRun.id],
          )
        ).rows[0].n,
        2,
      );
    },
  );
  await t.test(
    "C guest retention purge removes dependent artifacts and derived analytics through existing policy",
    async () => {
      const c = content.algebra;
      let run = (
        await other.request(
          "/learning/project-runs",
          "POST",
          {
            trackRevisionId: c.track.id,
            lessonRevisionId: c.lesson.id,
            blockIndex: 1,
          },
          { expect: 200 },
        )
      ).data;
      const m = c.project.milestones[0];
      run = (
        await other.request(
          `/learning/project-runs/${run.id}/submissions`,
          "POST",
          {
            expectedRevision: run.revision,
            milestoneCode: m.code,
            artifactKind: "text",
            artifact: "retention test only",
            isFinal: false,
          },
          { expect: 200 },
        )
      ).data;
      await other.request(
        `/learning/analytics/me?trackRevisionId=${c.track.id}`,
        "GET",
        undefined,
        { expect: 200 },
      );
      const owner = (
        await pool.query(
          "SELECT owner_key FROM intelligent_learning_records WHERE id=$1",
          [run.id],
        )
      ).rows[0].owner_key;
      await pool.query(
        "UPDATE guest_sessions SET status='revoked',revoked_at=now()-interval '10 days' WHERE id=$1",
        [owner.slice(6)],
      );
      const dry = (
        await pool.query("SELECT purge_expired_guests(true,100) AS result")
      ).rows[0].result;
      assert.ok(dry.eligibleGuests >= 1);
      const purged = (
        await pool.query("SELECT purge_expired_guests(false,100) AS result")
      ).rows[0].result;
      assert.ok(purged.deletedGuests >= 1);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM intelligent_learning_records WHERE id=$1",
            [run.id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM learning_project_submissions WHERE project_run_id=$1",
            [run.id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM learning_analytics_events WHERE owner_key=$1",
            [owner],
          )
        ).rows[0].n,
        0,
      );
    },
  );
}
