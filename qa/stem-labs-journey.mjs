import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mathFixtures = JSON.parse(
  readFileSync(
    new URL("../apps/api/tests/fixtures/stem-math.v1.json", import.meta.url),
    "utf8",
  ),
);
const modelFixtures = JSON.parse(
  readFileSync(
    new URL("../apps/api/tests/fixtures/stem-models.v1.json", import.meta.url),
    "utf8",
  ),
);
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const leakKeys = [
  "privateValidation",
  "acceptedMethodIds",
  "acceptedChoiceIds",
  "expectedFirstInvalidStep",
  "completionRaw",
  "workedSteps",
  "correctPatchIds",
  "validOrders",
  "expectedOutput",
  "hiddenTests",
  "domainVerification",
];
function noLeak(value) {
  const text = JSON.stringify(value);
  for (const key of leakKeys) assert.ok(!text.includes('"' + key + '"'), key);
}

export async function stemLabsJourney({
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
  const { MathGateway } = require("../apps/api/dist/math-gateway.js");
  const { Store } = require("../apps/api/dist/store.js");
  const { ApiFault } = require("../apps/api/dist/http.js");
  const math = app.get(MathGateway),
    store = app.get(Store),
    client = actor(),
    other = actor();
  await client.start();
  await other.start();
  const content = {};
  const physics = (model) => ({
    kind: "physics_prediction_experiment_v1",
    model,
    predictionPromptAr: "ما توقعك قبل التجربة؟",
    observationPromptAr: "ما الذي لاحظته؟",
    explanationPromptAr: "لماذا تغير الموضع؟",
    assumptionsAr: ["حركة مثالية على محور واحد"],
    controlledVariables: ["موضع البداية ثابت"],
  });
  const domains = {
    algebra: mathFixtures.activities,
    physics: [
      physics(modelFixtures.physics.positiveVelocity),
      physics(modelFixtures.physics.reversal),
    ],
    programming: Object.values(modelFixtures.coding),
  };
  // SQL fixtures are mechanics-only test_not_human data in the newly owned DB.
  // They are never added to application seed files or claimed as real review.
  async function revision(
    payload,
    status = "published",
    itemId = randomUUID(),
    version = 1,
  ) {
    const id = randomUUID();
    await pool.query(
      "INSERT INTO learning_content_items(id,code,subject_code,kind) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [itemId, payload.code, payload.subject, payload.kind],
    );
    await pool.query(
      "INSERT INTO learning_content_revisions(id,item_id,version,status,payload,content_hash,created_by,reviewed_by,published_by,reviewed_at,published_at,validation) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$7,$7,now(),now(),$8::jsonb)",
      [
        id,
        itemId,
        version,
        status,
        JSON.stringify(parseLearningPayload(payload)),
        hash(payload),
        reviewerId,
        JSON.stringify(null),
      ],
    );
    return { id, itemId, payload };
  }
  for (const [subject, specs] of Object.entries(domains)) {
    const skills =
      subject === "algebra"
        ? ["SK-ALG-04"]
        : subject === "physics"
          ? ["PHYS-CONSTANT_MOTION"]
          : ["PY-LOOPS"];
    const lessonPayload = {
      kind: "lesson",
      subject,
      code: "B-TEST-LESSON-" + subject,
      titleAr: "مختبر اصطناعي لاختبار المصدر فقط",
      descriptionAr: "بيانات مؤقتة، test_not_human، لا اعتماد تدريس حقيقي",
      objectives: ["اختبار حفظ النشاط وتحقق المجال"],
      skillCodes: skills,
      prerequisiteSkillCodes: [],
      prerequisiteLessonIds: [],
      errorCodes: [],
      mappingPending: [],
      practiceProblemRevisionIds: [],
      assessmentProblemRevisionIds: [],
      contentBlocks: specs.map((domainSpec, index) => ({
        type: "subject_lab_activity",
        textAr: "نشاط اصطناعي للتجربة",
        lab: {
          schemaVersion: "subject-lab-v1",
          subject,
          labKind: domainSpec.kind,
          objectiveAr: "تحقق سلوك المصدر في نطاق معروف",
          familyCode: `b-test-${subject}-${index}`,
          skillCodes: skills,
          domainSpec,
        },
      })),
    };
    const lesson = await revision(lessonPayload),
      track = await revision({
        kind: "track",
        subject,
        code: "B-TEST-TRACK-" + subject,
        titleAr: "مسار اصطناعي للاختبار فقط",
        descriptionAr: "لا اعتماد محتوى",
        units: [
          {
            code: "B-TEST-U1",
            titleAr: "وحدة اختبار",
            lessonRevisionIds: [lesson.id],
          },
        ],
      });
    content[subject] = { lesson, track };
  }
  const path = (id) => `/learning/labs/sessions/${id}`;
  async function start(subject, index, who = client, options = {}) {
    const c = content[subject];
    return (
      await who.request(
        "/learning/labs/sessions",
        "POST",
        {
          trackRevisionId: c.track.id,
          lessonRevisionId: c.lesson.id,
          blockIndex: index,
        },
        { expect: 200, ...options },
      )
    ).data;
  }
  async function event(s, eventKind, payload = {}, who = client, options = {}) {
    return (
      await who.request(
        path(s.id) + "/events",
        "POST",
        { expectedRevision: s.revision, eventKind, payload },
        { expect: 200, ...options },
      )
    ).data;
  }
  async function submit(s, answer, who = client, options = {}) {
    return (
      await who.request(
        path(s.id) + "/submit",
        "POST",
        { expectedRevision: s.revision, answer },
        { expect: 200, ...options },
      )
    ).data;
  }
  let savedMath, savedPhysics;
  await t.test(
    "B flags default off and cannot be bypassed through direct routes",
    async () => {
      const flags = (
        await client.request("/learning/labs/capabilities", "GET", undefined, {
          expect: 200,
        })
      ).data;
      assert.equal(flags.math, false);
      assert.equal(flags.physics, false);
      assert.equal(flags.codingNonExecuting, false);
      assert.equal(flags.runnerBridge, false);
      assert.equal(flags.phet, false);
      const c = content.algebra;
      await client.request(
        "/learning/labs/sessions",
        "POST",
        {
          trackRevisionId: c.track.id,
          lessonRevisionId: c.lesson.id,
          blockIndex: 0,
        },
        { expect: 403 },
      );
      process.env.MATH_LAB_ENABLED = "true";
      process.env.PHYSICS_LAB_ENABLED = "true";
      process.env.CODING_LAB_NONEXEC_ENABLED = "true";
    },
  );
  await t.test(
    "B public lessons and activity routes redact all private rubrics",
    async () => {
      for (const [subject, c] of Object.entries(content)) {
        noLeak(
          (
            await client.request(
              `/learning/lessons/${c.lesson.id}`,
              "GET",
              undefined,
              { expect: 200 },
            )
          ).data,
        );
        for (let i = 0; i < domains[subject].length; i++)
          noLeak(
            (
              await client.request(
                `/learning/labs/activities/${c.lesson.id}?blockIndex=${i}`,
                "GET",
                undefined,
                { expect: 200 },
              )
            ).data,
          );
      }
      const draft = await revision(
        { ...content.algebra.lesson.payload, code: "B-TEST-DRAFT" },
        "draft",
      );
      await client.request(
        `/learning/labs/activities/${draft.id}?blockIndex=0`,
        "GET",
        undefined,
        { expect: 404 },
      );
      await client.request(
        `/studio/learning-content/${content.algebra.lesson.id}`,
        "GET",
        undefined,
        { expect: 403 },
      );
      await reviewer.request(
        `/studio/learning-content/${content.algebra.lesson.id}`,
        "GET",
        undefined,
        { expect: 200 },
      );
    },
  );
  await t.test(
    "B owner-scoped start replay CAS and foreign UUID protection",
    async () => {
      const key = randomUUID();
      savedMath = await start("algebra", 2, client, { key });
      assert.equal(
        (await start("algebra", 2, client, { key })).id,
        savedMath.id,
      );
      process.env.MATH_LAB_ENABLED = "false";
      try {
        await start("algebra", 2, client, { key, expect: 403 });
      } finally {
        process.env.MATH_LAB_ENABLED = "true";
      }
      await other.request(path(savedMath.id), "GET", undefined, {
        expect: 404,
      });
      await other.request(
        path(savedMath.id) + "/events",
        "POST",
        { expectedRevision: 0, eventKind: "scaffold_revealed", payload: {} },
        { expect: 404 },
      );
      await client.request(
        path(savedMath.id) + "/events",
        "POST",
        { expectedRevision: 9, eventKind: "scaffold_revealed", payload: {} },
        { expect: 409 },
      );
      const count = (
        await pool.query(
          "SELECT count(*)::int AS n FROM intelligent_learning_records WHERE kind='lab' AND id=$1",
          [savedMath.id],
        )
      ).rows[0].n;
      assert.equal(count, 1);
    },
  );
  await t.test(
    "B1 actual SymPy verifies six practice kinds without manufacturing independent evidence",
    async () => {
      const answers = [
        { observationAr: "زاد الميل عند زيادة المعامل" },
        { methodIds: ["distribute", "divide"] },
        { transitionIndex: 1 },
        { choiceIds: ["subtract"] },
        { raw: "٣س=٣" },
        { equivalent: true },
      ];
      for (let i = 0; i < answers.length; i++) {
        const session = i === 2 ? savedMath : await start("algebra", i);
        const key = randomUUID();
        const finished = await submit(session, answers[i], client, { key });
        assert.equal(
          finished.result.result,
          i === 0 ? "needs_review" : "correct_practice",
          JSON.stringify(finished.result),
        );
        assert.equal(finished.evidenceClass, "learning_only");
        assert.equal(finished.result.evidenceClass, "learning_only");
        if (i > 0) {
          const stored = (
            await pool.query(
              "SELECT data->'domainVerification' AS reports FROM intelligent_learning_records WHERE id=$1",
              [finished.id],
            )
          ).rows[0].reports;
          assert.ok(
            stored.length > 0,
            "Original private domain reports must be retained",
          );
          assert.ok(
            stored.every((report) => report.requestId && report.engineVersion),
          );
          if (i === 2) {
            assert.equal(stored[0].status, "verified_invalid");
            assert.equal(stored[0].evidence.type, "counterexample");
            assert.equal(
              stored[0].requestId,
              finished.result.verificationReportIds[0],
            );
          }
        }
        if (i === 2) {
          savedMath = finished;
          assert.equal(
            (await submit(session, answers[i], client, { key })).revision,
            finished.revision,
          );
          process.env.MATH_LAB_ENABLED = "false";
          try {
            await submit(session, answers[i], client, { key, expect: 403 });
          } finally {
            process.env.MATH_LAB_ENABLED = "true";
          }
        }
        noLeak(finished);
      }
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM learning_assessment_items",
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await t.test(
    "B1 support records assistance before revealing a private worked step",
    async () => {
      const session = await start("algebra", 4),
        key = randomUUID();
      noLeak(session);
      const revealed = await event(session, "scaffold_revealed", {}, client, {
        key,
      });
      assert.equal(revealed.assistanceLevel >= 1, true);
      assert.equal(revealed.resultRevealed, true);
      assert.ok(JSON.stringify(revealed.artifact).includes("completionRaw"));
      assert.equal(
        (await event(session, "scaffold_revealed", {}, client, { key }))
          .revision,
        revealed.revision,
      );
      process.env.MATH_LAB_ENABLED = "false";
      try {
        await event(session, "scaffold_revealed", {}, client, {
          key,
          expect: 403,
        });
      } finally {
        process.env.MATH_LAB_ENABLED = "true";
      }
    },
  );
  await t.test(
    "B2 prediction must persist before reveal and direction reversal has correct distance",
    async () => {
      savedPhysics = await start("physics", 1);
      assert.equal(savedPhysics.artifact, null);
      await client.request(
        path(savedPhysics.id) + "/events",
        "POST",
        {
          expectedRevision: savedPhysics.revision,
          eventKind: "simulation_revealed",
          payload: {},
        },
        { expect: 409 },
      );
      const key = randomUUID(),
        before = savedPhysics;
      savedPhysics = await event(
        savedPhysics,
        "prediction_submitted",
        { textAr: "لا أعرف" },
        client,
        { key },
      );
      assert.equal(savedPhysics.artifact, null);
      assert.equal(
        (
          await event(
            before,
            "prediction_submitted",
            { textAr: "لا أعرف" },
            client,
            { key },
          )
        ).revision,
        savedPhysics.revision,
      );
      savedPhysics = await event(savedPhysics, "simulation_revealed");
      assert.equal(savedPhysics.artifact.displacement_m, -3);
      assert.equal(savedPhysics.artifact.distance_m, 5);
      savedPhysics = await event(savedPhysics, "simulation_parameter_changed", {
        parameters: { t_s: 2 },
      });
      const resumed = (
        await client.request(path(savedPhysics.id), "GET", undefined, {
          expect: 200,
        })
      ).data;
      assert.equal(resumed.parameters.t_s, 2);
      assert.equal(resumed.artifact.distance_m, 2);
      const result = await submit(resumed, {
        observationAr: "انعكس اتجاه الحركة",
        explanationAr: "السرعة تغيرت إشارتها",
      });
      assert.equal(result.result.result, "needs_review");
    },
  );
  await t.test(
    "B authoring validates a draft physics lab and blocks a false algebra method through actual Studio",
    async () => {
      const draftPayload = {
        ...content.physics.lesson.payload,
        code: "B-TEST-AUTHOR-VALID",
      };
      let draft = (
        await reviewer.request(
          "/studio/learning-content",
          "POST",
          draftPayload,
          { expect: 201 },
        )
      ).data;
      draft = (
        await reviewer.request(
          `/studio/learning-content/${draft.id}/validate`,
          "POST",
          { expectedRevision: draft.editRevision },
          { expect: 201 },
        )
      ).data;
      assert.equal(
        draft.validation.valid,
        true,
        draft.validation.issues.join(" "),
      );
      assert.equal(draft.status, "draft");
      const bad = structuredClone(content.algebra.lesson.payload);
      bad.code = "B-TEST-AUTHOR-INVALID";
      bad.contentBlocks = [bad.contentBlocks[1]];
      bad.contentBlocks[0].lab.domainSpec.methods[0].steps = ["س=٢"];
      let invalid = (
        await reviewer.request("/studio/learning-content", "POST", bad, {
          expect: 201,
        })
      ).data;
      invalid = (
        await reviewer.request(
          `/studio/learning-content/${invalid.id}/validate`,
          "POST",
          { expectedRevision: invalid.editRevision },
          { expect: 201 },
        )
      ).data;
      assert.equal(invalid.validation.valid, false);
      assert.ok(
        invalid.validation.issues.some((issue) =>
          issue.includes("method_claim_unverified"),
        ),
        invalid.validation.issues.join(" "),
      );
      invalid = (
        await reviewer.request(
          `/studio/learning-content/${invalid.id}/transition`,
          "POST",
          { expectedRevision: invalid.editRevision, action: "submit" },
          { expect: 201 },
        )
      ).data;
      await reviewer.request(
        `/studio/learning-content/${invalid.id}/transition`,
        "POST",
        { expectedRevision: invalid.editRevision, action: "approve" },
        { expect: 422 },
      );
    },
  );
  await t.test(
    "B2 GET-only lab exposure excludes the same physics context under a different family from later assessment",
    async () => {
      const { parsePayload } = require("../apps/api/dist/content-payload.js");
      const itemId = randomUUID(),
        questionId = randomUUID();
      const question = parsePayload({
        titleAr: "قياس اصطناعي فقط",
        statementAr:
          "جسم سرعته ثلاثة أمتار في الثانية لمدة أربع ثوان؛ احسب المسافة.",
        subject: "physics",
        unitCode: "kinematics_1d",
        unitTitleAr: "الحركة",
        lessonCode: "b_test_context",
        lessonTitleAr: "اختبار السياق",
        skillCodes: ["PHYS-CONSTANT_MOTION"],
        difficulty: 1,
        kind: "main",
        familyCode: "b-distinct-family-same-context",
        hints: [],
        physics: {
          topic: "kinematics_1d",
          formula: "constant_speed_distance",
          quantity: "distance",
          expectedDimension: "length",
          expectedValueSI: "12",
          expectedUnit: "m",
          tolerance: "0",
          givens: { v: "3", t: "4" },
        },
      });
      await pool.query(
        "INSERT INTO studio_items(id,code,subject_code,unit_code,lesson_code) VALUES($1,$2,'physics','kinematics_1d','b_test_context')",
        [itemId, "b-context-" + itemId],
      );
      await pool.query(
        "INSERT INTO studio_revisions(id,item_id,version,status,payload,content_hash,created_by,reviewed_by,published_by,reviewed_at,published_at) VALUES($1,$2,1,'published',$3::jsonb,$4,$5,$5,$5,now(),now())",
        [
          questionId,
          itemId,
          JSON.stringify(question),
          hash(question),
          reviewerId,
        ],
      );
      const lesson = await revision({
        ...content.physics.lesson.payload,
        code: "B-TEST-ASSESSMENT-CONTEXT",
        contentBlocks: [
          { type: "paragraph", textAr: "سؤال جديد دون كشف مثال مطابق." },
        ],
        assessmentProblemRevisionIds: [questionId],
      });
      const track = await revision({
        kind: "track",
        subject: "physics",
        code: "B-TEST-CONTEXT-TRACK",
        titleAr: "مسار قياس اصطناعي",
        descriptionAr: "اختبار الجدة فقط",
        units: [
          { code: "B-U1", titleAr: "اختبار", lessonRevisionIds: [lesson.id] },
        ],
      });
      const control = actor(),
        reader = actor();
      await control.start();
      await reader.start();
      const assessment = {
        trackRevisionId: track.id,
        lessonRevisionId: lesson.id,
        kind: "lesson_check",
      };
      const untouched = (
        await control.request("/assessments/start", "POST", assessment, {
          expect: 201,
        })
      ).data;
      assert.equal(untouched.questions[0].problem.revisionId, questionId);
      const completed = (
        await control.request(
          `/assessments/${untouched.id}/answer`,
          "POST",
          {
            expectedRevision: untouched.revision,
            questionId: untouched.questions[0].id,
            steps: [],
            value: "12",
            unit: "m",
          },
          { expect: 201 },
        )
      ).data;
      assert.equal(completed.questions[0].status, "correct");
      assert.equal(completed.questions[0].independent, true);
      const matchingFamilyPayload = structuredClone(
        content.physics.lesson.payload,
      );
      matchingFamilyPayload.code = "B-TEST-MATCHING-FAMILY-EXPOSURE";
      matchingFamilyPayload.contentBlocks = [
        matchingFamilyPayload.contentBlocks[0],
      ];
      matchingFamilyPayload.contentBlocks[0].lab.familyCode =
        question.familyCode;
      const matchingFamilyLesson = await revision(matchingFamilyPayload);
      await control.request(
        `/learning/labs/activities/${matchingFamilyLesson.id}?blockIndex=0`,
        "GET",
        undefined,
        { expect: 200 },
      );
      const afterCompletedExposure = (
        await control.request(
          `/assessments/${completed.id}`,
          "GET",
          undefined,
          { expect: 200 },
        )
      ).data;
      assert.equal(
        afterCompletedExposure.questions[0].independent,
        true,
        "A later lab exposure must not retroactively revoke a completed independent answer",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT measurement_exited_at FROM learning_assessment_items WHERE id=$1",
            [untouched.questions[0].id],
          )
        ).rows[0].measurement_exited_at,
        null,
      );
      const pendingOwner = actor();
      await pendingOwner.start();
      const pending = (
        await pendingOwner.request("/assessments/start", "POST", assessment, {
          expect: 201,
        })
      ).data;
      await pendingOwner.request(
        `/learning/labs/activities/${content.physics.lesson.id}?blockIndex=0`,
        "GET",
        undefined,
        { expect: 200 },
      );
      const exited = (
        await pendingOwner.request(
          `/assessments/${pending.id}`,
          "GET",
          undefined,
          { expect: 200 },
        )
      ).data;
      assert.equal(
        exited.questions[0].independent,
        false,
        "A matching-context pending measurement must exit before lab exposure",
      );
      assert.ok(
        (
          await pool.query(
            "SELECT measurement_exited_at FROM learning_assessment_items WHERE id=$1",
            [pending.questions[0].id],
          )
        ).rows[0].measurement_exited_at,
      );
      const assisted = (
        await pendingOwner.request(
          `/assessments/${pending.id}/answer`,
          "POST",
          {
            expectedRevision: exited.revision,
            questionId: pending.questions[0].id,
            steps: [],
            value: "12",
            unit: "m",
          },
          { expect: 201 },
        )
      ).data;
      assert.equal(assisted.questions[0].status, "correct");
      assert.equal(assisted.questions[0].independent, false);
      const before = (
        await pool.query(
          "SELECT count(*)::int AS n FROM intelligent_learning_records WHERE kind='lab'",
        )
      ).rows[0].n;
      await reader.request(
        `/learning/labs/activities/${content.physics.lesson.id}?blockIndex=0`,
        "GET",
        undefined,
        { expect: 200 },
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM intelligent_learning_records WHERE kind='lab'",
          )
        ).rows[0].n,
        before,
        "GET activity must not require a lab session for exposure enforcement",
      );
      await reader.request("/assessments/start", "POST", assessment, {
        expect: 409,
      });
    },
  );
  await t.test(
    "B2 changed simulation parameters record context exposure once across repeats",
    async () => {
      const owner = actor();
      await owner.start();
      let session = await start("physics", 0, owner);
      session = await event(
        session,
        "prediction_submitted",
        { textAr: "أتوقع زيادة المسافة" },
        owner,
      );
      session = await event(session, "simulation_revealed", {}, owner);
      const initial = (
        await pool.query(
          "SELECT data->'contextExposures' AS contexts FROM intelligent_learning_records WHERE id=$1",
          [session.id],
        )
      ).rows[0].contexts;
      session = await event(
        session,
        "simulation_parameter_changed",
        { parameters: { v_mps: 5, t_s: 6 } },
        owner,
      );
      const changed = (
        await pool.query(
          "SELECT data->'contextExposures' AS contexts FROM intelligent_learning_records WHERE id=$1",
          [session.id],
        )
      ).rows[0].contexts;
      assert.ok(changed.length > initial.length);
      session = await event(
        session,
        "simulation_parameter_changed",
        { parameters: { v_mps: 5, t_s: 6 } },
        owner,
      );
      const repeated = (
        await pool.query(
          "SELECT data->'contextExposures' AS contexts FROM intelligent_learning_records WHERE id=$1",
          [session.id],
        )
      ).rows[0].contexts;
      assert.equal(repeated.length, changed.length);
      assert.equal(
        new Set(repeated.map((context) => context.key)).size,
        repeated.length,
      );
    },
  );
  await t.test(
    "B3 static trace Parsons and closed debug work while Runner and PhET remain off",
    async () => {
      const trace = await start("programming", 1);
      assert.equal(trace.artifact, null);
      noLeak(trace);
      let revealed = await event(trace, "prediction_submitted", {
        textAr: "المخرج ستة",
      });
      for (let index = 0; index < 4; index++)
        revealed = await event(revealed, "trace_step_revealed", { index });
      assert.equal(revealed.artifact.traceSteps[3].stdoutCumulative, "6");
      assert.equal(revealed.assistanceLevel >= 1, true);
      assert.equal(
        (await submit(revealed, { output: "6" })).result.result,
        "correct_practice",
      );
      const parsons = await start("programming", 2);
      assert.equal(
        (
          await submit(parsons, {
            lines: ["A", "B", "C", "D"].map((lineId) => ({
              lineId,
              indentationLevel: lineId === "C" ? 1 : 0,
            })),
          })
        ).result.result,
        "correct_practice",
      );
      assert.equal(
        (
          await submit(await start("programming", 3), {
            patchId: "include-three",
          })
        ).result.result,
        "correct_practice",
      );
      const flags = (
        await client.request("/learning/labs/capabilities", "GET", undefined, {
          expect: 200,
        })
      ).data;
      assert.equal(flags.runnerBridge, false);
      assert.equal(flags.phet, false);
    },
  );
  await t.test(
    "B technical math outage preserves the submitted draft and returns a neutral result",
    async () => {
      const session = await start("algebra", 5),
        original = math.verify;
      math.verify = async () => {
        throw new ApiFault(503, "math_unavailable", "اختبار انقطاع اصطناعي");
      };
      try {
        const result = await submit(session, { equivalent: true });
        assert.equal(result.result.result, "cannot_determine");
        assert.deepEqual(result.answer, { equivalent: true });
      } finally {
        math.verify = original;
      }
    },
  );
  await t.test(
    "B late verifier result cannot overwrite a newer owner revision",
    async () => {
      const session = await start("algebra", 5),
        original = math.verify;
      let release, entered;
      const gate = new Promise((r) => {
          release = r;
        }),
        started = new Promise((r) => {
          entered = r;
        });
      math.verify = async (...args) => {
        entered();
        await gate;
        return original.apply(math, args);
      };
      const pending = client.request(
        path(session.id) + "/submit",
        "POST",
        { expectedRevision: session.revision, answer: { equivalent: true } },
        { expect: 409 },
      );
      try {
        await started;
        const current = (
          await client.request(path(session.id), "GET", undefined, {
            expect: 200,
          })
        ).data;
        const changed = await event(current, "observation_saved", {
          textAr: "ملاحظة أحدث أثناء التحقق",
        });
        release();
        await pending;
        const latest = (
          await client.request(path(session.id), "GET", undefined, {
            expect: 200,
          })
        ).data;
        assert.equal(latest.revision, changed.revision);
        assert.equal(latest.result, null);
        assert.equal(latest.observation, "ملاحظة أحدث أثناء التحقق");
      } finally {
        release();
        math.verify = original;
      }
    },
  );
  await t.test(
    "B archived pinned revision resumes while a newly published revision stays separate",
    async () => {
      const c = content.algebra;
      await pool.query(
        "UPDATE learning_content_revisions SET status='archived',edit_revision=edit_revision+1 WHERE id=$1",
        [c.lesson.id],
      );
      const next = await revision(
        { ...c.lesson.payload, titleAr: "نسخة ثانية اصطناعية" },
        "published",
        c.lesson.itemId,
        2,
      );
      const old = (
        await client.request(path(savedMath.id), "GET", undefined, {
          expect: 200,
        })
      ).data;
      assert.equal(old.lessonRevisionId, c.lesson.id);
      await client.request(
        `/learning/labs/activities/${c.lesson.id}?blockIndex=0`,
        "GET",
        undefined,
        { expect: 404 },
      );
      assert.equal(
        (
          await client.request(
            `/learning/labs/activities/${next.id}?blockIndex=0`,
            "GET",
            undefined,
            { expect: 200 },
          )
        ).data.activityRevisionId,
        next.id,
      );
    },
  );
  await t.test(
    "B guest claim moves lab history atomically and keeps other owners excluded",
    async () => {
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
        [userId, "b-internal-" + userId + "@example.invalid", guestId],
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
      assert.equal(
        (
          await account.request(path(savedMath.id), "GET", undefined, {
            expect: 200,
          })
        ).data.id,
        savedMath.id,
      );
      await other.request(path(savedMath.id), "GET", undefined, {
        expect: 404,
      });
      const owner = (
        await pool.query(
          "SELECT owner_key FROM intelligent_learning_records WHERE id=$1",
          [savedMath.id],
        )
      ).rows[0].owner_key;
      assert.equal(owner, "user:" + userId);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM intelligent_learning_events e JOIN intelligent_learning_records r ON r.id=e.record_id WHERE e.owner_key<>r.owner_key",
          )
        ).rows[0].n,
        0,
      );
      const exported = (
        await account.request("/me/export", "GET", undefined, { expect: 200 })
      ).data;
      assert.ok(JSON.stringify(exported).includes(savedMath.id));
    },
  );
}
