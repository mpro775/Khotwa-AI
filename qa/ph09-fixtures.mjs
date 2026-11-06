import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
export const reference = JSON.parse(
  readFileSync(
    new URL("../docs/14-GOLDEN-DATASET.cases.json", import.meta.url),
    "utf8",
  ),
);
const require = createRequire(import.meta.url);
export const bank = [
  {
    skill: "SK-ALG-04",
    root: "٢(س + ٣) = ١٠",
    wrong: "٢س + ٣ = ١٠",
    solution: "س = ٢",
    rem: [
      ["٢(س + ١) = ٨", "س = ٣"],
      ["٣(س + ١) = ٩", "س = ٢"],
    ],
    transfer: [
      ["٣(٢ − س) = ٩", "س = −١"],
      ["١٨ = ٣(س + ٢)", "س = ٤"],
      ["−٢(س + ١) = ٦", "س = −٤"],
    ],
  },
  {
    skill: "SK-ALG-02",
    root: "س − ٣ = ٥",
    wrong: "س = ٢",
    solution: "س = ٨",
    rem: [
      ["س − ١ = ٢", "س = ٣"],
      ["س − ٢ = ٤", "س = ٦"],
    ],
    transfer: [
      ["٧ = س − ٢", "س = ٩"],
      ["−س = ٣", "س = −٣"],
      ["−٤ = س + ٢", "س = −٦"],
    ],
  },
  {
    skill: "SK-ALG-01",
    root: "س + ٣ = ٧",
    wrong: "س = ٧",
    solution: "س = ٤",
    rem: [
      ["س + ١ = ٣", "س = ٢"],
      ["س + ٢ = ٦", "س = ٤"],
    ],
    transfer: [
      ["٩ = س + ٢", "س = ٧"],
      ["٢س + ٢ = ٨", "س = ٣"],
      ["٥ = ٢س − ١", "س = ٣"],
    ],
  },
  {
    skill: "SK-ALG-06",
    root: "٣س = ١٢",
    wrong: "س = ٣٦",
    solution: "س = ٤",
    rem: [
      ["٢س = ٦", "س = ٣"],
      ["٤س = ٨", "س = ٢"],
    ],
    transfer: [
      ["١٦ = ٤س", "س = ٤"],
      ["س/٣ = ٢", "س = ٦"],
      ["−٢س = ٨", "س = −٤"],
    ],
  },
  {
    skill: "SK-ALG-03",
    root: "س + ٥ = ١٢",
    wrong: "س = ٨",
    solution: "س = ٧",
    rem: [
      ["س + ٤ = ١٠", "س = ٦"],
      ["س + ٦ = ١١", "س = ٥"],
    ],
    transfer: [
      ["١١ = س − ٣", "س = ١٤"],
      ["٢س + ٣ = ١٣", "س = ٥"],
      ["١٧ = ٣س + ٢", "س = ٥"],
    ],
  },
  {
    skill: "SK-ALG-04",
    root: "−٢(س − ٣) = ١٠",
    wrong: "−٢س − ٦ = ١٠",
    solution: "س = −٢",
    rem: [
      ["−٢(س − ١) = ٤", "س = −١"],
      ["−٣(س − ١) = ٦", "س = −١"],
    ],
    transfer: [
      ["١٢ = −٣(س − ٢)", "س = −٢"],
      ["−٢(٣ − س) = ٨", "س = ٧"],
      ["٦ = −٢(س + ٤)", "س = −٧"],
    ],
  },
];
export const mainEquation = bank[0].root;
export async function seedIntegration(pool) {
  const url = new URL(process.env.DATABASE_URL);
  if (
    !/^khotwa-ph09-[a-f0-9]{12}-db$/.test(url.hostname) ||
    url.pathname != "/ph09_test"
  )
    throw Error("Isolated PH09 DB only");
  const { MathGateway } = require("../apps/api/dist/math-gateway.js");
  const math = new MathGateway({
    baseUrl: process.env.MATH_ENGINE_BASE_URL,
    token: process.env.MATH_INTERNAL_TOKEN,
    timeoutMs: 15000,
    expectedEngine: "0.3.0",
  });
  const client = await pool.connect(),
    releaseId = randomUUID(),
    skillId = randomUUID(),
    byEquation = new Map();
  const proofs = [];
  // Every private reference answer is checked by real Python before any test release is published.
  for (const row of bank)
    for (const [equation, solution] of [
      [row.root, row.solution],
      ...row.rem,
      ...row.transfer,
    ]) {
      const context = {
        attemptId: randomUUID(),
        attemptRevision: 0,
        problemRevisionId: randomUUID(),
        notationProfile: "ar-mashriq-school-v1",
        domain: "reals",
      };
      const final = await math.checkFinal(context, equation, {
        stepVersionId: randomUUID(),
        raw: solution,
      });
      if (
        final.status !== "verified_valid" ||
        !final.isIsolated ||
        !final.substitutionValid ||
        final.originalSolution?.kind !== "singleton"
      )
        throw Error("Invalid authored PH09 fixture");
      proofs.push({
        equationHash: createHash("sha256").update(equation).digest("hex"),
        status: final.status,
        engine: final.engineVersion,
      });
    }
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES($1,$2,'algebra','ar-mashriq-school-v1','بيانات اختبار اصطناعية فقط','draft')",
      [releaseId, "ph09-test-" + releaseId],
    );
    await client.query(
      "INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES($1,$2,'SK-ALG-04','خاصية التوزيع — اختبار اصطناعي','للمراجعة التقنية فقط',1,'active')",
      [skillId, releaseId],
    );
    await seedDiagnosticDrafts(client, releaseId, skillId);
    const skills = new Map(
      (
        await client.query(
          "SELECT id,skill_code FROM skills WHERE release_id=$1",
          [releaseId],
        )
      ).rows.map((s) => [s.skill_code, s.id]),
    );
    for (const [index, row] of bank.entries()) {
      const items = [
        [row.root, row.solution, "main", `root-${index}`],
        ...row.rem.map(([a, b], i) => [
          a,
          b,
          "remediation",
          `rem-${index}-${i}`,
        ]),
        ...row.transfer.map(([a, b], i) => [
          a,
          b,
          "transfer",
          `transfer-${index}-${i}`,
        ]),
      ];
      for (const [equation, solution, kind, family] of items) {
        const problemId = randomUUID(),
          revisionId = randomUUID();
        await client.query(
          "INSERT INTO problems(id,problem_code) VALUES($1,$2)",
          [problemId, "ph09-test-" + problemId],
        );
        await client.query(
          "INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash,learning_family) VALUES($1,$2,1,$3,$4,$5,$6,$7::jsonb,2,'ar-mashriq-school-v1','published',now(),now(),$8,$9)",
          [
            revisionId,
            problemId,
            releaseId,
            kind,
            "اختبار اصطناعي غير مراجع: " +
              (kind === "main"
                ? "المسألة الأساسية"
                : kind === "remediation"
                  ? "تدريب على مهارة واحدة"
                  : "مسألة مختلفة لقياس النقل"),
            equation,
            JSON.stringify({
              solution,
              privateTestSentinel: "PH09_SERVER_ONLY_KEY",
            }),
            createHash("sha256").update(equation).digest("hex"),
            family,
          ],
        );
        await client.query(
          "INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES($1,$2,'primary')",
          [revisionId, skills.get(row.skill)],
        );
        byEquation.set(equation, {
          problemId,
          revisionId,
          kind,
          solution,
          skillId: skills.get(row.skill),
          family,
        });
      }
      for (const rem of row.rem)
        for (const tr of row.transfer) {
          await client.query(
            "INSERT INTO content_pairings(id,release_id,skill_id,root_problem_revision_id,remediation_revision_id,transfer_revision_id,version,transfer_contrast,math_checks,review_status,enabled,is_synthetic) VALUES($1,$2,$3,$4,$5,$6,'ph09-draft-1','اختلاف مؤلف: موضع المتغير أو ترتيب العملية أو بنية الإشارة والقوس',$7::jsonb,'draft',true,true)",
            [
              randomUUID(),
              releaseId,
              skills.get(row.skill),
              byEquation.get(row.root).revisionId,
              byEquation.get(rem[0]).revisionId,
              byEquation.get(tr[0]).revisionId,
              JSON.stringify({
                status: "verified_valid",
                engine: "0.3.0",
                humanReview: false,
                proofs: proofs.filter((p) =>
                  [row.root, rem[0], tr[0]].some(
                    (eq) =>
                      createHash("sha256").update(eq).digest("hex") ===
                      p.equationHash,
                  ),
                ),
              }),
            ],
          );
        }
    }
    await seedHintDrafts(client, releaseId, byEquation);
    // Private authored H4 for each new learning item. Public bundle never contains this map.
    for (const [equation, item] of byEquation) {
      if (["٢(س + ٣) = ١٠"].includes(equation)) continue;
      await client.query(
        "INSERT INTO intervention_templates(id,release_id,problem_revision_id,template_version,hint_level,policy_version,text_ar,allowed_rephrases,math_assertions,solution_steps,review_status,enabled,is_synthetic) VALUES($1,$2,$3,'ph09-draft-1',4,'tutoring-p0-0.7.0','هذا حل بمساعدة كاملة للتعلم؛ لا يعد أداء مستقلًا.','[]','[]',$4::jsonb,'draft',true,true)",
        [
          randomUUID(),
          releaseId,
          item.revisionId,
          JSON.stringify([item.solution]),
        ],
      );
    }
    await client.query(
      "UPDATE content_releases SET status='published',reviewed_by_role='integration_fixture_not_human_review',reviewed_at=now(),published_at=now() WHERE id=$1",
      [releaseId],
    );
    await client.query("COMMIT");
    return { releaseId, skillId, byEquation, proofs, bank };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
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
      "INSERT INTO misconception_catalog(id,release_id,error_code,skill_id,catalog_version,enabled,is_synthetic,review_status) VALUES($1,$2,$3,$4,'ph07-draft-1',true,true,'draft')",
      [randomUUID(), releaseId, "ERR-ALG-0" + (i + 1), skills.get(skill)],
    );
  for (const [family, question, labels, supports, rejects] of draftTemplates)
    await client.query(
      "INSERT INTO diagnostic_templates(id,release_id,family,template_version,question_ar,options_json,rules_json,enabled,is_synthetic,review_status) VALUES($1,$2,$3,'ph07-draft-1',$4,$5,$6,true,true,'draft')",
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

const hintTexts = {
  "ERR-ALG-01": [
    "انظر إلى الحدين داخل القوس: هل تأثر كل منهما بالمعامل؟",
    "المعامل خارج القوس يضرب كل حد داخله.",
    "ابدأ بضرب المعامل في حد س، ثم أكمل الحد الثابت بنفسك.",
  ],
  "ERR-ALG-02": [
    "راقب الإشارة في الحد الذي عزلته.",
    "اسأل نفسك أي عملية تعكس طرح الحد الثابت.",
    "حدد العملية العكسية للحد الثابت أولًا، ثم طبقها على طرفي المساواة.",
  ],
  "ERR-ALG-03": [
    "أي طرف من المساواة تغير؟",
    "كل عملية على أحد الطرفين تحتاج عملية مكافئة على الطرف الآخر.",
    "اكتب العملية بجوار كل طرف على حدة قبل متابعة التبسيط.",
  ],
  "ERR-ALG-04": [
    "تأمل العملية المرتبطة بس.",
    "اختر العملية التي تعكس ما يحدث للمتغير.",
    "سمّ العملية العكسية أولًا، ثم طبقها على طرفي المساواة.",
  ],
  "ERR-ALG-05": [
    "راقب الحساب العددي في الخطوة الأخيرة.",
    "افصل الحساب العددي عن التحويل الجبري لتراجعه.",
    "احسب جزءًا عدديًا واحدًا على حدة ثم عد إلى الخطوة المكتوبة.",
  ],
  "ERR-ALG-06": [
    "تأمل أثر المعامل السالب على الحدين.",
    "راجع إشارة كل حاصل ضرب عند توزيع المعامل السالب.",
    "حدد إشارتَي عاملي الحد الثابت أولًا، ثم اكتب إشارة ناتجه.",
  ],
};
async function seedHintDrafts(client, releaseId, problems) {
  const insert = async (
    level,
    text,
    pattern = null,
    problem = null,
    assertions = [],
    steps = [],
    variants = [],
  ) =>
    client.query(
      "INSERT INTO intervention_templates(id,release_id,problem_revision_id,error_code,hint_level,template_version,policy_version,text_ar,allowed_rephrases,math_assertions,solution_steps,is_synthetic,enabled,review_status) VALUES($1,$2,$3,$4,$5,'ph07-draft-1','tutoring-p0-0.7.0',$6,$7,$8,$9,true,true,'draft')",
      [
        randomUUID(),
        releaseId,
        problem,
        pattern,
        level,
        text,
        JSON.stringify(variants),
        JSON.stringify(assertions),
        JSON.stringify(steps),
      ],
    );
  for (const [pattern, texts] of Object.entries(hintTexts))
    for (const [i, text] of texts.entries()) await insert(i + 1, text, pattern);
  for (const [i, text] of [
    "راجع ما تغير في طرفي المساواة.",
    "حدد العملية التي طبقتها وحافظ على تكافؤ الطرفين.",
    "ابدأ بجزء واحد من السطر ودوّن العملية نفسها لكل طرف.",
  ].entries())
    await insert(i + 1, text);
  const main = problems.get(mainEquation).revisionId;
  await insert(
    3,
    "ابدأ بالحد الذي يحوي س: ٢ × س = ٢س. أكمل الحد الآخر بنفسك.",
    "ERR-ALG-01",
    main,
    ["٢ × س = ٢س"],
    [],
    ["نراجع الحد الأول فقط: ٢ × س = ٢س. أكمل الحد الآخر بنفسك."],
  );
  for (const [original, steps] of [
    [mainEquation, ["٢س + ٦ = ١٠", "٢س = ٤", "س = ٢"]],
    ["٤(س + ٢) = ٢٠", ["س + ٢ = ٥", "٣ = س"]],
    ["−٣(س − ٢) = ١٢", ["س − ٢ = −٤", "س = −٢"]],
    ["س/٢ = ٣", ["س = ٦"]],
  ]) {
    const p = problems.get(original);
    if (p)
      await insert(
        4,
        "هذا حل بمساعدة كاملة. راجع كل انتقال، ثم جرّب لاحقًا مسألة مختلفة بنفسك.",
        null,
        p.revisionId,
        [],
        steps,
      );
  }
}
