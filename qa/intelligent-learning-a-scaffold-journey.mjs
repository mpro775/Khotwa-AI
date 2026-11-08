import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/** Native HTTP/SymPy test blueprint. Uses only the caller's isolated synthetic DB.
 * Temporary publication by a test admin is workflow evidence, never human review.
 * The caller must invoke this before shutting down app/pool. */
export async function intelligentLearningScaffoldJourney({
  t,
  pool,
  actor,
  admin,
  fixtures,
  app,
  lesson,
}) {
  assert.ok(app && pool && admin && lesson?.payload);
  assert.equal(process.env.KHOTWA_SYNTHETIC_DATA, "true");
  assert.equal(process.env.A_INTEGRATION, "true");
  assert.equal(process.env.FADING_SCAFFOLD_ENABLED, "true");
  await t.test(
    "A6 native S0→S1→S2→S3→S4 uses reviewed-for-test distinct questions and real verifier",
    async () => {
      const client = actor(),
        other = actor();
      await client.start();
      await other.start();
      const token = randomUUID().replaceAll("-", "").slice(0, 12);
      const request = async (
        who,
        path,
        method = "GET",
        body,
        expect = method === "GET" ? 200 : 201,
        key,
      ) =>
        (
          await who.request(path, method, body, {
            expect,
            ...(key ? { key } : {}),
          })
        ).data;
      const transition = async (row, action) =>
        request(
          admin,
          `/studio/learning-content/${row.id}/transition`,
          "POST",
          { expectedRevision: row.editRevision, action },
        );
      const publish = async (payload) => {
        let row = await request(
          admin,
          "/studio/learning-content",
          "POST",
          payload,
        );
        row = await request(
          admin,
          `/studio/learning-content/${row.id}/validate`,
          "POST",
          { expectedRevision: row.editRevision },
        );
        assert.equal(
          row.validation.valid,
          true,
          row.validation.issues.join(" "),
        );
        for (const action of ["submit", "approve", "publish"])
          row = await transition(row, action);
        return row;
      };
      const practiceIds = lesson.payload.practiceProblemRevisionIds;
      const candidates = fixtures.problems.filter(
        (p) => p.kind === "main" && !practiceIds.includes(p.id),
      );
      assert.ok(
        candidates.length >= 4,
        "S3/S4 each require two distinct unexposed questions",
      );
      assert.ok(practiceIds.length >= 1);
      let testLesson = null,
        testTrack = null;
      try {
        testLesson = await publish({
          ...structuredClone(lesson.payload),
          code: "ALG-A6-TEST-" + token,
          titleAr: "دعم تدريجي — اختبار اصطناعي مؤقت",
          descriptionAr:
            "TEST_ONLY؛ حسابات مولدة وبيانات اصطناعية، لا اعتماد مراجع بشري.",
          assessmentProblemRevisionIds: candidates.map((p) => p.id),
        });
        testTrack = await publish({
          kind: "track",
          subject: "algebra",
          code: "ALG-A6-TRACK-" + token,
          titleAr: "دورة دعم اصطناعية مؤقتة",
          descriptionAr:
            "TEST_ONLY — archived after native integration scenario",
          units: [
            {
              code: "ALG-A6-U01",
              titleAr: "توزيع الأقواس",
              lessonRevisionIds: [testLesson.id],
            },
          ],
        });
        const context = {
          trackRevisionId: testTrack.id,
          lessonRevisionId: testLesson.id,
          skillCode: "SK-ALG-04",
        };
        const mastery = () =>
          request(client, "/learning/mastery?trackRevisionId=" + testTrack.id);
        const independentCount = async () =>
          (await mastery()).skills.find(
            (s) => s.skillCode === context.skillCode,
          ).counts.eligibleIndependent;
        const startKey = randomUUID();
        let scaffold = await request(
          client,
          "/learning/scaffolds",
          "POST",
          context,
          201,
          startKey,
        );
        assert.equal(
          (
            await request(
              client,
              "/learning/scaffolds",
              "POST",
              context,
              201,
              startKey,
            )
          ).id,
          scaffold.id,
        );
        assert.equal(scaffold.stage, "S0");
        assert.equal(scaffold.visibleSteps.length, 0);
        assert.equal(await independentCount(), 0);
        await request(
          other,
          "/learning/scaffolds/" + scaffold.id,
          "GET",
          undefined,
          404,
        );
        const revealKey = randomUUID(),
          revealBody = { expectedRevision: scaffold.revision };
        scaffold = await request(
          client,
          `/learning/scaffolds/${scaffold.id}/reveal`,
          "POST",
          revealBody,
          201,
          revealKey,
        );
        assert.equal(scaffold.visibleSteps.length, 1);
        assert.deepEqual(
          await request(
            client,
            `/learning/scaffolds/${scaffold.id}/reveal`,
            "POST",
            revealBody,
            201,
            revealKey,
          ),
          scaffold,
        );
        await request(
          other,
          `/learning/scaffolds/${scaffold.id}/reveal`,
          "POST",
          { expectedRevision: scaffold.revision },
          404,
        );
        const assessmentIds = [],
          independentProblemIds = new Set();
        let latestAssessment;
        for (const stage of ["S1", "S2", "S3", "S4"]) {
          const advanceKey = randomUUID(),
            advanceBody = { expectedRevision: scaffold.revision };
          const started = await request(
            client,
            `/learning/scaffolds/${scaffold.id}/advance`,
            "POST",
            advanceBody,
            201,
            advanceKey,
          );
          assert.deepEqual(
            await request(
              client,
              `/learning/scaffolds/${scaffold.id}/advance`,
              "POST",
              advanceBody,
              201,
              advanceKey,
            ),
            started,
          );
          scaffold = started.scaffold;
          assert.equal(scaffold.stage, stage);
          latestAssessment = started.assessment;
          assessmentIds.push(latestAssessment.id);
          assert.ok(latestAssessment.questions.length >= 1);
          if (["S3", "S4"].includes(stage))
            assert.equal(latestAssessment.questions.length, 2);
          for (const question of latestAssessment.questions) {
            const source = fixtures.problems.find(
              (p) => p.id === question.problem.revisionId,
            );
            assert.ok(
              source,
              "Native question must reference a published canonical test fixture",
            );
            if (["S3", "S4"].includes(stage)) {
              assert.equal(question.independent, true);
              assert.equal(
                independentProblemIds.has(source.problemId),
                false,
                "S4 cannot reuse an S3 question",
              );
              independentProblemIds.add(source.problemId);
            } else assert.equal(question.independent, false);
            latestAssessment = await request(
              client,
              `/assessments/${latestAssessment.id}/answer`,
              "POST",
              {
                expectedRevision: latestAssessment.revision,
                questionId: question.id,
                steps: [source.answer],
              },
            );
            const checked = latestAssessment.questions.find(
              (q) => q.id === question.id,
            );
            assert.equal(checked.status, "verified_valid");
            assert.equal(checked.completed, true);
            assert.equal(checked.independent, ["S3", "S4"].includes(stage));
            const report = (
              await pool.query(
                "SELECT r.id,r.attempt_revision,a.revision,r.report_json FROM verification_reports r JOIN attempts a ON a.id=r.attempt_id WHERE r.attempt_id=$1 AND r.dispatch_status='finished' ORDER BY r.finished_at DESC LIMIT 1",
                [checked.attemptId],
              )
            ).rows[0];
            assert.ok(
              report,
              "Actual VerificationService must have persisted a report",
            );
            assert.equal(
              String(report.attempt_revision),
              String(report.revision),
            );
            assert.equal(report.report_json.isCurrent, true);
            assert.equal(
              report.report_json.completion.canMarkAttemptCompleted,
              true,
            );
          }
          if (["S1", "S2"].includes(stage))
            assert.equal(await independentCount(), 0);
          const resumed = await request(
            client,
            `/learning/scaffolds/${scaffold.id}`,
          );
          assert.equal(resumed.stage, stage);
          assert.equal(resumed.assessmentId, latestAssessment.id);
        }
        assert.equal(new Set(assessmentIds).size, 4);
        assert.equal(independentProblemIds.size, 4);
        const completed = await request(
          client,
          `/learning/scaffolds/${scaffold.id}/advance`,
          "POST",
          { expectedRevision: scaffold.revision },
        );
        assert.equal(completed.scaffold.stage, "S4");
        assert.equal(completed.scaffold.status, "completed");
        assert.equal(completed.scaffold.independentEligible, true);
        assert.ok(
          completed.scaffold.supportCount >= 1,
          "Prior disclosed support is retained even after a fresh independent success",
        );
        assert.ok((await independentCount()) >= 4);
        const stored = (
          await pool.query(
            "SELECT data FROM intelligent_learning_records WHERE id=$1 AND kind='scaffold'",
            [scaffold.id],
          )
        ).rows[0].data;
        assert.equal(stored.lessonRevisionId, testLesson.id);
        assert.equal(stored.contentHash, testLesson.contentHash);
        assert.equal(stored.supportHistory.length, stored.supportCount);
        assert.equal(stored.supportHistory[0].kind, "revealed_worked_step");
        assert.equal(
          JSON.stringify(completed.scaffold).includes("lessonSnapshot"),
          false,
        );
        assert.equal(
          JSON.stringify(completed.scaffold).includes("answer_spec"),
          false,
        );
      } finally {
        // New item codes avoid replacing the existing lesson. Archive only this test's rows.
        if (testTrack?.status === "published")
          testTrack = await transition(testTrack, "archive");
        if (testLesson?.status === "published")
          testLesson = await transition(testLesson, "archive");
      }
    },
  );
}
