import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export const reference = JSON.parse(
  readFileSync(
    new URL("../docs/14-GOLDEN-DATASET.cases.json", import.meta.url),
    "utf8",
  ),
);
export const mainEquation = "٢(س + ٣) = ١٠";
export async function seedIntegration(pool, { golden = true } = {}) {
  const url = new URL(process.env.DATABASE_URL);
  if (
    !/^khotwa-ph05-[a-f0-9]{12}-db$/.test(url.hostname) ||
    url.pathname !== "/ph05_test"
  )
    throw new Error("Seed allowed only on isolated PH-05 test database");
  const client = await pool.connect(),
    releaseId = randomUUID(),
    skillId = randomUUID(),
    byEquation = new Map();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES($1,$2,'algebra','ar-mashriq-school-v1','بيانات اختبار اصطناعية فقط','draft')",
      [releaseId, "ph05-test-" + releaseId],
    );
    await client.query(
      "INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES($1,$2,'SK-ALG-04','اختبار التكافؤ الخطي — بيانات اصطناعية','فحص التكامل فقط، لا إجازة تعليمية',1,'active')",
      [skillId, releaseId],
    );
    const equations = [
      ...new Set([
        mainEquation,
        "٤(س + ٢) = ٢٠",
        "−٣(س − ٢) = ١٢",
        "س/٢ = ٣",
        ...(golden
          ? reference.math
              .filter((c) => c.kind === "student")
              .map((c) => c.before)
          : []),
      ]),
    ];
    for (const [index, equation] of equations.entries()) {
      const problemId = randomUUID(),
        revisionId = randomUUID();
      await client.query(
        "INSERT INTO problems(id,problem_code) VALUES($1,$2)",
        [problemId, "ph05-test-" + problemId],
      );
      await client.query(
        "INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash) VALUES($1,$2,1,$3,'main',$4,$5,'{\"privateTestSentinel\":\"PH05_SERVER_ONLY_KEY\"}'::jsonb,1,'ar-mashriq-school-v1','published',now(),now(),$6)",
        [
          revisionId,
          problemId,
          releaseId,
          index === 0
            ? "اختبار اصطناعي: معادلة ذات أقواس"
            : index === 1
              ? "اختبار اصطناعي: معادلة جديدة بمعاملات مختلفة"
              : "مسألة اختبار اصطناعية رقم " + (index + 1),
          equation,
          createHash("sha256").update(equation).digest("hex"),
        ],
      );
      await client.query(
        "INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES($1,$2,'primary')",
        [revisionId, skillId],
      );
      byEquation.set(equation, { problemId, revisionId });
    }
    await client.query(
      "UPDATE content_releases SET status='published',reviewed_by_role='integration_fixture_not_human_review',reviewed_at=now(),published_at=now() WHERE id=$1",
      [releaseId],
    );
    await client.query("COMMIT");
    return { releaseId, skillId, byEquation };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
