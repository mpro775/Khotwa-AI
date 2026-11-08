import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function noLeak(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /"(?:answer_spec|privateEvaluation|privateRubric|hiddenTests|referenceCode|privateValidation|domainVerification|solutionKey|privateTestSentinel)"|C_DOMAIN_PRIVATE_SENTINEL/,
  );
}

/** Real domain acceptance, confined to the random c_test harness. Content rows
 * are TEST_ONLY runtime fixtures, never a claim of human content approval. */
export async function advancedDomainJourney({
  t,
  pool,
  app,
  actor,
  reviewerId,
}) {
  assert.equal(process.env.C_INTEGRATION, "true");
  assert.match(
    process.env.C_TEST_CONTAINER ?? "",
    /^khotwa-c-[a-f0-9]{12}-db$/,
  );
  const database = new URL(process.env.DATABASE_URL);
  assert.equal(database.hostname, "127.0.0.1");
  assert.equal(database.pathname, "/c_test");
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    "c_test",
  );
  assert.equal(process.env.KHOTWA_SYNTHETIC_DATA, "true");
  const {
    LearningPathContentService,
  } = require("../apps/api/dist/learning-path-content.js");
  const {
    parseLearningPayload,
  } = require("../apps/api/dist/learning-path-payload.js");
  const content = app.get(LearningPathContentService),
    math = content.math;
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/advanced-learning-c/fixtures.synthetic.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const releaseId = randomUUID(),
    skillId = randomUUID(),
    suffix = randomUUID().replaceAll("-", "");
  const problems = [
    {
      equation: "٣س + ٦ = ٢١",
      answer: "س = ٥",
      family: "C-SCIENCE-TRAIN-" + suffix,
    },
    {
      equation: "٤س + ٣ = ٣١",
      answer: "س = ٧",
      family: "C-SCIENCE-NOVEL-A-" + suffix,
    },
    {
      equation: "١١ = ٢س − ٣",
      answer: "س = ٧",
      family: "C-SCIENCE-NOVEL-B-" + suffix,
    },
  ].map((p) => ({ ...p, id: randomUUID(), problemId: randomUUID() }));
  await t.test(
    "C domain TEST_ONLY answers verified by real SymPy before fixture publication",
    async () => {
      for (const p of problems) {
        const proof = await math.checkFinal(
          {
            attemptId: randomUUID(),
            attemptRevision: 0,
            problemRevisionId: p.id,
            notationProfile: "ar-mashriq-school-v1",
            domain: "reals",
          },
          p.equation,
          { stepVersionId: randomUUID(), raw: p.answer },
        );
        assert.equal(proof.status, "verified_valid");
        assert.equal(proof.isIsolated, true);
        assert.equal(proof.substitutionValid, true);
        assert.equal(proof.originalSolution.kind, "singleton");
      }
    },
  );
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query(
      "INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES($1,$2,'algebra','ar-mashriq-school-v1','C TEST_ONLY science acceptance','draft')",
      [releaseId, "c-domain-test-only-" + suffix],
    );
    await db.query(
      "INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES($1,$2,'SK-ALG-07','حل المعادلة — TEST_ONLY','قبول تقني دون توقيع بشري',1,'active')",
      [skillId, releaseId],
    );
    for (const p of problems) {
      await db.query("INSERT INTO problems(id,problem_code) VALUES($1,$2)", [
        p.problemId,
        "C-DOMAIN-" + p.problemId,
      ]);
      await db.query(
        "INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash,learning_family) VALUES($1,$2,1,$3,'main','TEST_ONLY مسألة جبر اصطناعية',$4,$5::jsonb,2,'ar-mashriq-school-v1','published',now(),now(),$6,$7)",
        [
          p.id,
          p.problemId,
          releaseId,
          p.equation,
          JSON.stringify({
            solution: p.answer,
            privateTestSentinel: "C_DOMAIN_PRIVATE_SENTINEL",
          }),
          digest(p.equation),
          p.family,
        ],
      );
      await db.query(
        "INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES($1,$2,'primary')",
        [p.id, skillId],
      );
    }
    await db.query(
      "UPDATE content_releases SET status='published',reviewed_by_role='c_domain_TEST_ONLY_not_human',reviewed_at=now(),published_at=now() WHERE id=$1",
      [releaseId],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
  async function revision(payload) {
    const id = randomUUID(),
      itemId = randomUUID(),
      parsed = parseLearningPayload(payload);
    await pool.query(
      "INSERT INTO learning_content_items(id,code,subject_code,kind) VALUES($1,$2,$3,$4)",
      [itemId, parsed.code, parsed.subject, parsed.kind],
    );
    await pool.query(
      "INSERT INTO learning_content_revisions(id,item_id,version,status,payload,content_hash,created_by,reviewed_by,published_by,reviewed_at,published_at) VALUES($1,$2,1,'published',$3,$4,$5,$5,$5,now(),now())",
      [id, itemId, parsed, digest(parsed), reviewerId],
    );
    return { id, payload: parsed };
  }
  const scenarioAr =
    "خدمة أولى كلفتها اشتراك ٦ ريالات وثلاثة ريالات لكل استخدام، وخدمة ثانية كلفتها ثابتة ٢١ ريالًا. حدد عدد مرات الاستخدام عند تساوي الكلفتين وفسر أي العرضين أوفر قبل هذا الحد وبعده، مع توضيح افتراضاتك.";
  const problem = {
    ...fixture.problems[0],
    code: "C-SCIENCE-PROBLEM-" + suffix,
    scenarioAr,
    publicBriefAr:
      "قارن كلفة عرضين وحدد الحد الفاصل بينهما دون الاقتصار على حالة واحدة.",
    representations: fixture.problems[0].representations.map((r) => ({
      ...r,
      accessibleText: scenarioAr,
      textAr: scenarioAr,
    })),
    familyCode: "C-SCIENCE-SCENARIO-" + suffix,
    verification: { kind: "bank_problem", problemRevisionId: problems[0].id },
  };
  const project = {
    ...fixture.projects[0],
    code: "C-SCIENCE-PROJECT-" + suffix,
  };
  const lesson = await revision({
    kind: "lesson",
    subject: "algebra",
    code: "C-DOMAIN-LESSON-" + suffix,
    titleAr: "قبول مصدر C بمحرك حقيقي",
    descriptionAr: "TEST_ONLY",
    objectives: problem.objectives,
    skillCodes: problem.skillCodes,
    prerequisiteSkillCodes: [],
    prerequisiteLessonIds: [],
    errorCodes: [],
    mappingPending: [],
    practiceProblemRevisionIds: [],
    assessmentProblemRevisionIds: problems.map((p) => p.id),
    contentBlocks: [
      { type: "problem_activity", textAr: "المشكلة", activity: problem },
      { type: "project_activity", textAr: "المشروع", activity: project },
    ],
  });
  const track = await revision({
    kind: "track",
    subject: "algebra",
    code: "C-DOMAIN-TRACK-" + suffix,
    titleAr: "مسار قبول اصطناعي",
    descriptionAr: "TEST_ONLY",
    units: [
      { code: "SCIENCE", titleAr: "وحدة", lessonRevisionIds: [lesson.id] },
    ],
  });
  const student = actor();
  await student.start();
  const begin = async (client = student, blockIndex = 0) =>
    (
      await client.request(
        blockIndex === 0
          ? "/learning/problem-sessions"
          : "/learning/project-runs",
        "POST",
        { trackRevisionId: track.id, lessonRevisionId: lesson.id, blockIndex },
        { expect: 200 },
      )
    ).data;
  let session;
  await t.test(
    "C1 real SymPy wrong/correct alternate final retains learning-only and redacts evidence",
    async () => {
      session = await begin();
      for (const stage of [
        "frame",
        "plan",
        "investigate",
        "justify",
        "reflect",
      ])
        session = (
          await student.request(
            `/learning/problem-sessions/${session.id}/steps`,
            "POST",
            {
              expectedRevision: session.revision,
              stage,
              textAr:
                stage === "plan"
                  ? "أستخدم جدولًا ثم أتحقق بمعادلة مكافئة."
                  : "شرح اصطناعي للمرحلة " + stage,
            },
            { expect: 200 },
          )
        ).data;
      session = (
        await student.request(
          `/learning/problem-sessions/${session.id}/feedback`,
          "POST",
          { expectedRevision: session.revision, answer: { raw: "س = ٤" } },
          { expect: 200 },
        )
      ).data;
      assert.equal(session.result.result, "incorrect_practice");
      const key = randomUUID(),
        input = {
          expectedRevision: session.revision,
          answer: { raw: "٥ = س" },
        };
      session = (
        await student.request(
          `/learning/problem-sessions/${session.id}/feedback`,
          "POST",
          input,
          { key, expect: 200 },
        )
      ).data;
      assert.equal(session.result.result, "correct_practice");
      assert.equal(session.evidenceClass, "learning_only");
      assert.notEqual(session.result.domainVerifier, "domain_unavailable");
      noLeak(session);
      assert.deepEqual(
        (
          await student.request(
            `/learning/problem-sessions/${session.id}/feedback`,
            "POST",
            input,
            { key, expect: 200 },
          )
        ).data,
        session,
      );
      const independent = (
        await pool.query(
          "SELECT count(*)::int AS n FROM learning_assessments a JOIN intelligent_learning_records r ON r.owner_key=a.owner_key WHERE r.id=$1",
          [session.id],
        )
      ).rows[0].n;
      assert.equal(
        independent,
        0,
        "C completion must not manufacture native independent observations",
      );
    },
  );
  await t.test(
    "C1 closed native support gate then owner-scoped real offline A7 bridge",
    async () => {
      const old = process.env.SOCRATIC_TUTOR_ENABLED;
      try {
        process.env.SOCRATIC_TUTOR_ENABLED = "false";
        await student.request(
          `/learning/problem-sessions/${session.id}/support`,
          "POST",
          { expectedRevision: session.revision, kind: "tutor" },
          { expect: 403 },
        );
        process.env.SOCRATIC_TUTOR_ENABLED = "true";
        const key = randomUUID(),
          input = { expectedRevision: session.revision, kind: "tutor" };
        const linked = (
          await student.request(
            `/learning/problem-sessions/${session.id}/support`,
            "POST",
            input,
            { key, expect: 200 },
          )
        ).data;
        session = linked.session;
        assert.equal(linked.support.kind, "tutor");
        assert.ok(session.assistanceLevel >= 1);
        assert.deepEqual(
          (
            await student.request(
              `/learning/problem-sessions/${session.id}/support`,
              "POST",
              input,
              { key, expect: 200 },
            )
          ).data,
          linked,
        );
        const native = (
          await student.request(
            `/learning/tutor-sessions/${linked.support.id}`,
            "GET",
            undefined,
            { expect: 200 },
          )
        ).data;
        assert.equal(native.trackRevisionId, track.id);
        assert.equal(native.lessonRevisionId, lesson.id);
        assert.equal(native.source, "synthetic_template");
        const stranger = actor();
        await stranger.start();
        await stranger.request(
          `/learning/tutor-sessions/${linked.support.id}`,
          "GET",
          undefined,
          { expect: 404 },
        );
        noLeak(linked);
        noLeak(native);
      } finally {
        if (old === undefined) delete process.env.SOCRATIC_TUTOR_ENABLED;
        else process.env.SOCRATIC_TUTOR_ENABLED = old;
      }
    },
  );
  await t.test(
    "C1 delayed real domain response cannot overwrite edited stage",
    async () => {
      let delayed = await begin();
      const original = math.checkFinal.bind(math);
      let release, entered;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const started = new Promise((resolve) => {
        entered = resolve;
      });
      math.checkFinal = async (...args) => {
        const result = await original(...args);
        if (args[0].attemptId === delayed.id) {
          entered();
          await gate;
        }
        return result;
      };
      let pending;
      try {
        pending = student.request(
          `/learning/problem-sessions/${delayed.id}/feedback`,
          "POST",
          { expectedRevision: delayed.revision, answer: { raw: "س = ٥" } },
          { expect: 409 },
        );
        await Promise.race([
          started,
          new Promise((_, reject) => {
            const timer = setTimeout(
              () => reject(Error("C domain intercept was not reached")),
              15000,
            );
            timer.unref();
          }),
        ]);
        delayed = (
          await student.request(
            `/learning/problem-sessions/${delayed.id}`,
            "GET",
            undefined,
            { expect: 200 },
          )
        ).data;
        delayed = (
          await student.request(
            `/learning/problem-sessions/${delayed.id}/steps`,
            "POST",
            {
              expectedRevision: delayed.revision,
              stage: "plan",
              textAr: "خطة معدلة أثناء انتظار المحرك",
            },
            { expect: 200 },
          )
        ).data;
        release();
        await pending;
        const resumed = (
          await student.request(
            `/learning/problem-sessions/${delayed.id}`,
            "GET",
            undefined,
            { expect: 200 },
          )
        ).data;
        assert.equal(resumed.revision, delayed.revision);
        assert.equal(resumed.result, null);
        assert.equal(resumed.answers.plan, "خطة معدلة أثناء انتظار المحرك");
      } finally {
        release();
        math.checkFinal = original;
        if (pending) await pending;
      }
    },
  );
  await t.test(
    "C1 assisted completion hands off only novel families to canonical A2 real verifier",
    async () => {
      session = (
        await student.request(
          `/learning/problem-sessions/${session.id}/finish`,
          "POST",
          { expectedRevision: session.revision },
          { expect: 200 },
        )
      ).data;
      const before = session;
      const oldPedagogy = process.env.PEDAGOGY_ENGINE_ENABLED,
        oldScaffold = process.env.FADING_SCAFFOLD_ENABLED;
      try {
        process.env.PEDAGOGY_ENGINE_ENABLED = "false";
        process.env.FADING_SCAFFOLD_ENABLED = "false";
        await student.request(
          `/learning/problem-sessions/${session.id}/assessment`,
          "POST",
          { expectedRevision: session.revision },
          { expect: 403 },
        );
        session = (
          await student.request(
            `/learning/problem-sessions/${session.id}`,
            "GET",
            undefined,
            { expect: 200 },
          )
        ).data;
        process.env.PEDAGOGY_ENGINE_ENABLED = "true";
        const key = randomUUID(),
          input = { expectedRevision: session.revision };
        const handed = (
          await student.request(
            `/learning/problem-sessions/${session.id}/assessment`,
            "POST",
            input,
            { key, expect: 200 },
          )
        ).data;
        session = handed.session;
        let assessment = handed.assessment;
        noLeak(handed);
        assert.equal(assessment.kind, "independent_check");
        assert.equal(assessment.questions.length, 2);
        assert.ok(
          assessment.questions.every(
            (q) =>
              q.problem.revisionId !== problems[0].id &&
              q.problem.familyCode !== problems[0].family,
          ),
        );
        assert.deepEqual(
          (
            await student.request(
              `/learning/problem-sessions/${session.id}/assessment`,
              "POST",
              input,
              { key, expect: 200 },
            )
          ).data,
          handed,
        );
        for (const question of assessment.questions) {
          const source = problems.find(
            (p) => p.id === question.problem.revisionId,
          );
          assert.ok(source);
          assessment = (
            await student.request(
              `/assessments/${assessment.id}/answer`,
              "POST",
              {
                expectedRevision: assessment.revision,
                questionId: question.id,
                steps: [source.answer],
              },
              { expect: 201 },
            )
          ).data;
        }
        assert.equal(assessment.status, "completed");
        assert.ok(
          assessment.questions.every(
            (q) =>
              q.status === "verified_valid" &&
              q.independent &&
              q.supportLevel === 0,
          ),
        );
        const canonical = (
          await pool.query(
            "SELECT count(*)::int AS n FROM verification_reports v JOIN learning_assessment_items i ON i.attempt_id=v.attempt_id JOIN attempts a ON a.id=i.attempt_id WHERE i.assessment_id=$1 AND v.attempt_revision=a.revision AND v.dispatch_status='finished'",
            [assessment.id],
          )
        ).rows[0].n;
        assert.ok(canonical >= 2);
        assert.equal(before.evidenceClass, "learning_only");
        assert.ok(before.assistanceLevel >= 1);
      } finally {
        if (oldPedagogy === undefined)
          delete process.env.PEDAGOGY_ENGINE_ENABLED;
        else process.env.PEDAGOGY_ENGINE_ENABLED = oldPedagogy;
        if (oldScaffold === undefined)
          delete process.env.FADING_SCAFFOLD_ENABLED;
        else process.env.FADING_SCAFFOLD_ENABLED = oldScaffold;
      }
    },
  );
  await t.test(
    "C2 explicit pause/resume/withdraw preserves immutable workflow boundary",
    async () => {
      let run = await begin(student, 1);
      for (const action of ["pause", "resume", "withdraw"]) {
        run = (
          await student.request(
            `/learning/project-runs/${run.id}/state`,
            "POST",
            { expectedRevision: run.revision, action },
            { expect: 200 },
          )
        ).data;
        assert.equal(
          run.status,
          action === "pause"
            ? "paused"
            : action === "resume"
              ? "active"
              : "withdrawn",
        );
        if (action === "pause")
          await student.request(
            `/learning/project-runs/${run.id}/milestones/plan`,
            "POST",
            {
              expectedRevision: run.revision,
              textAr: "لا تعديل أثناء الإيقاف",
            },
            { expect: 409 },
          );
      }
      await student.request(
        `/learning/project-runs/${run.id}/state`,
        "POST",
        { expectedRevision: run.revision, action: "resume" },
        { expect: 409 },
      );
      await student.request(
        `/learning/project-runs/${run.id}/submissions`,
        "POST",
        {
          expectedRevision: run.revision,
          milestoneCode: "plan",
          artifactKind: "text",
          artifact: "لا تسليم بعد الانسحاب",
          isFinal: false,
        },
        { expect: 409 },
      );
    },
  );
}
