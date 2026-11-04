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
    !/^khotwa-ph06-[a-f0-9]{12}-db$/.test(url.hostname) ||
    url.pathname !== "/ph06_test"
  )
    throw new Error("Seed allowed only on isolated PH-06 test database");
  const client = await pool.connect(),
    releaseId = randomUUID(),
    skillId = randomUUID(),
    byEquation = new Map();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES($1,$2,'algebra','ar-mashriq-school-v1','بيانات اختبار اصطناعية فقط','draft')",
      [releaseId, "ph06-test-" + releaseId],
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
        [problemId, "ph06-test-" + problemId],
      );
      await client.query(
        "INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash) VALUES($1,$2,1,$3,'main',$4,$5,'{\"privateTestSentinel\":\"PH06_SERVER_ONLY_KEY\"}'::jsonb,1,'ar-mashriq-school-v1','published',now(),now(),$6)",
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
    await seedDiagnosticDrafts(client, releaseId, skillId);
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

// QA proposals derived from doc 06, not reviewed/published teaching content.
// Kept server-side; the app strips grading rules and randomizes public option IDs.
export const draftTemplates = [
  [
    "distribution",
    "أي التعبيرين يساوي ٥(س + ٤)؟",
    ["٥س + ٢٠", "٥س + ٤"],
    ["ERR-ALG-01"],
    ["ERR-ALG-01"],
  ],
  [
    "negative_product",
    "ما ناتج −٤ × (−٢)؟",
    ["٨", "−٨"],
    ["ERR-ALG-06"],
    ["ERR-ALG-06"],
  ],
  [
    "inverse_add",
    "ما العملية التي تعكس طرح ٦ عند عزل س؟",
    ["أضف ٦ إلى الطرفين", "اطرح ٦ من الطرفين"],
    ["ERR-ALG-04"],
    ["ERR-ALG-04"],
  ],
  [
    "inverse_multiply",
    "عند ٦س = ١٨، أي عملية تساعد على عزل س؟",
    ["١٨ ÷ ٦", "١٨ × ٦"],
    ["ERR-ALG-04"],
    ["ERR-ALG-04"],
  ],
  [
    "balance",
    "إذا كانت ٩ + ٢ = ١١، فهل تبقى المساواة صحيحة إذا غيّرنا الطرف الأيمن إلى ٩ وحده؟",
    ["لا؛ يجب الحفاظ على تكافؤ الطرفين", "نعم؛ يمكن تغيير الطرف الأيمن وحده"],
    ["ERR-ALG-03"],
    ["ERR-ALG-03"],
  ],
  [
    "calculation",
    "احسب ١١ − ٦ دون حل معادلة.",
    ["٥", "٦"],
    ["ERR-ALG-05"],
    ["ERR-ALG-05"],
  ],
  [
    "calculation_divide",
    "احسب ١٢ ÷ ٣ دون حل معادلة.",
    ["٤", "٩"],
    ["ERR-ALG-05"],
    ["ERR-ALG-05"],
  ],
  [
    "calculation_signed",
    "احسب −٣ + ٨ دون حل معادلة.",
    ["٥", "−٥"],
    ["ERR-ALG-05"],
    ["ERR-ALG-05"],
  ],
];
async function seedDiagnosticDrafts(client, releaseId, defaultSkillId) {
  const skills = new Map([["SK-ALG-04", defaultSkillId]]);
  for (const skill of [
    "SK-ALG-01",
    "SK-ALG-02",
    "SK-ALG-03",
    "SK-ALG-05",
    "SK-ALG-06",
  ]) {
    const id = randomUUID();
    skills.set(skill, id);
    await client.query(
      "INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES($1,$2,$3,'مهارة اختبار اصطناعية','للمراجعة فقط',2,'active')",
      [id, releaseId, skill],
    );
  }
  for (const [i, skill] of [
    "SK-ALG-04",
    "SK-ALG-02",
    "SK-ALG-01",
    "SK-ALG-06",
    "SK-ALG-03",
    "SK-ALG-04",
  ].entries())
    await client.query(
      "INSERT INTO misconception_catalog(id,release_id,error_code,skill_id,catalog_version,enabled,is_synthetic,review_status) VALUES($1,$2,$3,$4,'ph06-draft-1',true,true,'draft')",
      [randomUUID(), releaseId, "ERR-ALG-0" + (i + 1), skills.get(skill)],
    );
  for (const [family, question, labels, supports, rejects] of draftTemplates)
    await client.query(
      "INSERT INTO diagnostic_templates(id,release_id,family,template_version,question_ar,options_json,rules_json,enabled,is_synthetic,review_status) VALUES($1,$2,$3,'ph06-draft-1',$4,$5,$6,true,true,'draft')",
      [
        randomUUID(),
        releaseId,
        family,
        question,
        JSON.stringify([
          ...labels.map((labelAr, i) => ({ id: String(i), labelAr })),
          { id: "2", labelAr: "لا أدري" },
        ]),
        JSON.stringify({
          0: { rejects },
          1: { supports },
          2: { supports: [], rejects: [] },
        }),
      ],
    );
}
