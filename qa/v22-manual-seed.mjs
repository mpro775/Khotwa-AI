import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const digits = "٠١٢٣٤٥٦٧٨٩";
const ar = (value) => String(value).replace(/\d/g, (d) => digits[Number(d)]);
const scope = "بيئة اختبار محلية اصطناعية؛ لا اعتماد تربوي بشري";

/** Test-only persisted fixture bank. No production startup imports this file. */
export async function seedManualRuntime({
  pool,
  store,
  math,
  base,
  actors,
  saveActors,
}) {
  if (
    process.env.KHOTWA_SYNTHETIC_DATA !== "true" ||
    process.env.BETA_ENABLED !== "false" ||
    new URL(process.env.DATABASE_URL).pathname !== "/v22_manual"
  )
    throw Error("Manual fixtures require the dedicated synthetic database");
  await pool.query(
    "CREATE TABLE IF NOT EXISTS v22_manual_runtime_manifest (id text PRIMARY KEY, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const [name, role] of [
    ["teacher", "admin"],
    ["student-a", "student"],
    ["student-b", "student"],
    ["student-c", "student"],
  ]) {
    const email = `v22-manual-${name}@example.invalid`;
    let user = (
      await pool.query(
        "SELECT id,learning_guest_id FROM users WHERE email_normalized=$1 AND is_internal",
        [email],
      )
    ).rows[0];
    if (!user) {
      const guest = await store.createGuest(
        randomBytes(32).toString("base64url"),
      );
      user = { id: randomUUID(), learning_guest_id: guest.auth.row.id };
      await pool.query(
        "INSERT INTO users(id,email_normalized,email_verified_at,role,status,is_internal,learning_guest_id) VALUES($1,$2,now(),$3,'active',true,$4)",
        [user.id, email, role, user.learning_guest_id],
      );
    }
    await pool.query(
      "UPDATE guest_sessions SET status='active',revoked_at=NULL,last_seen_at=now(),expires_at=GREATEST(expires_at,now()+interval '7 days') WHERE id=$1",
      [user.learning_guest_id],
    );
    let token = actors[name]?.token;
    const valid =
      token &&
      (
        await pool.query(
          "SELECT id FROM auth_sessions WHERE user_id=$1 AND token_digest=$2 AND revoked_at IS NULL AND expires_at>now()",
          [
            user.id,
            Buffer.from(store.security.digest("account:" + token), "hex"),
          ],
        )
      ).rows.length;
    if (!valid) {
      token = randomBytes(32).toString("base64url");
      await pool.query(
        "INSERT INTO auth_sessions(id,user_id,token_digest,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
        [
          randomUUID(),
          user.id,
          Buffer.from(store.security.digest("account:" + token), "hex"),
        ],
      );
    }
    actors[name] = {
      userId: user.id,
      guestId: user.learning_guest_id,
      role,
      token,
    };
  }
  saveActors();
  const teacher = actors.teacher;
  const request = async (path, method = "GET", body) => {
    const response = await fetch(base + "/api/v1" + path, {
      method,
      headers: {
        origin: process.env.PUBLIC_APP_ORIGIN,
        "sec-fetch-site": "same-origin",
        cookie: "kh_account=" + teacher.token,
        ...(method === "GET"
          ? {}
          : {
              "content-type": "application/json",
              "x-csrf-token": store.security.guestCsrf(teacher.token),
              "idempotency-key": randomUUID(),
            }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const value = await response.json();
    if (!response.ok)
      throw Error(
        `${method} ${path}: ${response.status} ${value.error?.messageAr ?? "failed"}`,
      );
    return value.data;
  };
  const old = (
    await pool.query(
      "SELECT payload FROM v22_manual_runtime_manifest WHERE id='algebra-bank-v1'",
    )
  ).rows[0];
  let bank = old?.payload;
  if (!bank) {
    const releaseId = randomUUID(),
      skills = [];
    const titles = [
      "معنى المساواة",
      "الإشارات",
      "جمع الحدود المتشابهة",
      "توزيع الأقواس",
      "الجمع والطرح المكافئان",
      "الضرب والقسمة بثابت",
      "حل المعادلات متعددة الخطوات",
    ];
    const problems = [];
    for (let index = 0; index < 24; index++) {
      const a = (index % 5) + 2,
        b = Math.floor(index / 5) + 1,
        solution = (index % 4) + 2;
      problems.push({
        id: randomUUID(),
        problemId: randomUUID(),
        equation: `${ar(a)}(س + ${ar(b)}) = ${ar(a * (solution + b))}`,
        answer: `س = ${ar(solution)}`,
        kind: "main",
        family: `manual-dist-${index}`,
        titleAr: `توزيع — تدريب اختبار ${ar(index + 1)}`,
      });
    }
    for (const [index, [equation, answer]] of [
      ["٤(٣ − س) = ٢٠", "س = −٢"],
      ["١٤ = ٢(س − ١)", "س = ٨"],
      ["−٣(س + ٢) = ٩", "س = −٥"],
      ["٢(٥ − س) = ١٤", "س = −٢"],
    ].entries())
      problems.push({
        id: randomUUID(),
        problemId: randomUUID(),
        equation,
        answer,
        kind: "transfer",
        family: `manual-transfer-${index}`,
        titleAr: `قياس مستقل — اختبار ${ar(index + 1)}`,
      });
    for (const p of problems) {
      const result = await math.checkFinal(
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
      if (
        result.status !== "verified_valid" ||
        !result.isIsolated ||
        !result.substitutionValid
      )
        throw Error("Manual algebra fixture failed the real verifier");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO content_releases(id,release_code,subject_code,notation_profile,curriculum_label_ar,status) VALUES($1,'v22-manual-fixtures-v1','algebra','ar-mashriq-school-v1',$2,'draft')",
        [releaseId, scope],
      );
      for (const [index, title] of titles.entries()) {
        const id = randomUUID();
        skills.push(id);
        await client.query(
          "INSERT INTO skills(id,release_id,skill_code,name_ar,learning_objective_ar,sort_order,status) VALUES($1,$2,$3,$4,$5,$6,'active')",
          [id, releaseId, `SK-ALG-0${index + 1}`, title, scope, index + 1],
        );
      }
      for (const [target, prerequisites] of [
        [2, [0]],
        [3, [1]],
        [4, [1, 2]],
        [5, [0, 1]],
        [6, [0, 1, 4]],
        [7, [2, 3, 4, 5]],
      ])
        for (const prerequisite of prerequisites)
          await client.query(
            "INSERT INTO skill_prerequisites(skill_id,prerequisite_skill_id,relation_kind,rationale_ar) VALUES($1,$2,'required',$3)",
            [
              skills[target - 1],
              skills[prerequisite],
              "ربط المواصفة القائمة؛ مراجعة المحتوى المضافة منفصلة",
            ],
          );
      for (const p of problems) {
        await client.query(
          "INSERT INTO problems(id,problem_code) VALUES($1,$2)",
          [p.problemId, "V22-MANUAL-" + p.id],
        );
        await client.query(
          "INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash,learning_family) VALUES($1,$2,1,$3,$4,$5,$6,$7::jsonb,2,'ar-mashriq-school-v1','published',now(),now(),$8,$9)",
          [
            p.id,
            p.problemId,
            releaseId,
            p.kind,
            `${p.titleAr} — ${scope}`,
            p.equation,
            JSON.stringify({
              solution: p.answer,
              provenance: "TEST_ONLY_NOT_HUMAN_REVIEW",
            }),
            createHash("sha256").update(p.equation).digest("hex"),
            p.family,
          ],
        );
        await client.query(
          "INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES($1,$2,'primary')",
          [p.id, skills[3]],
        );
      }
      await client.query(
        "INSERT INTO misconception_catalog(id,release_id,error_code,skill_id,catalog_version,enabled,is_synthetic,review_status) VALUES($1,$2,'ERR-ALG-01',$3,'manual-fixture-v1',true,true,'draft')",
        [randomUUID(), releaseId, skills[3]],
      );
      for (const [index, text] of [
        "تأمل الحدين داخل القوس.",
        "المعامل خارج القوس يضرب كل حد داخله.",
        "ابدأ بحد المتغير، ثم أكمل الحد الثابت بنفسك.",
      ].entries())
        await client.query(
          "INSERT INTO intervention_templates(id,release_id,hint_level,template_version,policy_version,text_ar,is_synthetic,enabled,review_status,reviewed_by_role,reviewed_at) VALUES($1,$2,$3,'v22-manual-test-only','tutoring-p0-0.7.0',$4,true,true,'reviewed','automated_test_fixture_not_human',now())",
          [randomUUID(), releaseId, index + 1, text],
        );
      await client.query(
        "UPDATE content_releases SET status='published',reviewed_by_role='automated_test_fixture_not_human',reviewed_at=now(),published_at=now() WHERE id=$1",
        [releaseId],
      );
      bank = { releaseId, problems };
      await client.query(
        "INSERT INTO v22_manual_runtime_manifest(id,payload) VALUES('algebra-bank-v1',$1::jsonb)",
        [JSON.stringify(bank)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  const existingManifest = (
    await pool.query(
      "SELECT payload FROM v22_manual_runtime_manifest WHERE id='manual-content-v1'",
    )
  ).rows[0];
  if (existingManifest) {
    writeFileSync(
      ".local/v22-manual/content-manifest.json",
      JSON.stringify(existingManifest.payload, null, 2) + "\n",
    );
    return existingManifest.payload;
  }
  const all = await request("/studio/learning-content");
  const find = (code) => all.items.find((r) => r.payload.code === code);
  const ensureLesson = async (payload, publish = false) => {
    let row = find(payload.code);
    if (!row) row = await request("/studio/learning-content", "POST", payload);
    if (publish)
      for (const [status, action] of [
        ["draft", "submit"],
        ["in_review", "approve"],
        ["approved", "publish"],
      ])
        if (row.status === status)
          row = await request(
            `/studio/learning-content/${row.id}/transition`,
            "POST",
            { expectedRevision: row.editRevision, action },
          );
    return row;
  };
  const publishedPhysics = [];
  const existingPhysics = await request("/studio/items?subject=physics");
  for (const [index, [v, t]] of [
    [3, 4],
    [5, 6],
    [7, 6],
    [4, 8],
    [6, 9],
    [8, 7],
  ].entries()) {
    const code = `manual-physics-${index}`;
    let row = existingPhysics.items.find((r) => r.payload.familyCode === code);
    if (!row)
      row = await request("/studio/items", "POST", {
        titleAr: `حركة خطية — اختبار ${ar(index + 1)}`,
        statementAr: `بيئة اختبار: تحرك جسم بسرعة ${v} m/s مدة ${t} s. أوجد المسافة.`,
        subject: "physics",
        unitCode: "kinematics_1d",
        unitTitleAr: "الحركة",
        lessonCode: "constant_motion",
        lessonTitleAr: "الحركة بسرعة ثابتة",
        skillCodes: ["PHYS-CONSTANT_MOTION"],
        difficulty: 1,
        kind: "main",
        familyCode: code,
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
        physics: {
          topic: "kinematics_1d",
          formula: "constant_speed_distance",
          quantity: "distance",
          expectedDimension: "length",
          expectedValueSI: String(v * t),
          expectedUnit: "m",
          tolerance: "0",
          givens: { v: String(v), t: String(t) },
        },
      });
    for (const [status, action] of [
      ["draft", "submit"],
      ["in_review", "approve"],
      ["approved", "publish"],
    ])
      if (row.status === status)
        row = await request(`/studio/items/${row.id}/transition`, "POST", {
          expectedRevision: row.editRevision,
          action,
        });
    publishedPhysics.push(row);
  }
  const featured = JSON.parse(
    readFileSync("apps/api/data/learning-paths.draft.v1.json", "utf8"),
  );
  const algebraPayload = {
    ...featured.find((p) => p.code === "ALG-L04"),
    titleAr: "توزيع الأقواس — بيئة اختبار",
    descriptionAr: scope,
    practiceProblemRevisionIds: bank.problems.slice(0, 3).map((p) => p.id),
    assessmentProblemRevisionIds: bank.problems
      .filter((p) => p.kind === "transfer")
      .map((p) => p.id),
  };
  const algebra = await ensureLesson(algebraPayload);
  const algebraTrack = await ensureLesson({
    kind: "track",
    subject: "algebra",
    code: "ALG-BASIC",
    titleAr: "الجبر الأساسي — بيئة اختبار",
    descriptionAr: scope,
    units: [
      {
        code: "linear_equations",
        titleAr: "المعادلات الخطية",
        lessonRevisionIds: [algebra.id],
      },
    ],
  });
  const physicsPayload = {
    ...featured.find((p) => p.code === "PHY-L01"),
    code: "PHY-MANUAL-L01",
    titleAr: "السرعة والمسافة والوحدات — بيئة اختبار",
    descriptionAr: scope,
    mappingPending: [],
    contentBlocks: [
      {
        type: "paragraph",
        textAr: "نقرأ السرعة والزمن ثم نحسب المسافة مع وحدتها.",
      },
      {
        type: "paragraph",
        textAr:
          "في الحركة بسرعة ثابتة تساوي المسافة حاصل ضرب السرعة في الزمن؛ اختلاف الوحدة يختلف عن خطأ القيمة.",
      },
      {
        type: "physics_example",
        textAr: "مثال للقراءة: سرعة ٢ m/s وزمن٣ s؛ المسافة٦ m.",
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
    practiceProblemRevisionIds: [publishedPhysics[0].id],
    assessmentProblemRevisionIds: publishedPhysics.slice(1).map((p) => p.id),
  };
  const physicsLesson = await ensureLesson(physicsPayload, true);
  const physicsTrack = await ensureLesson(
    {
      kind: "track",
      subject: "physics",
      code: "PHY-MANUAL-TRACK",
      titleAr: "الحركة الخطية والوحدات — بيئة اختبار",
      descriptionAr: scope,
      units: [
        {
          code: "kinematics_1d",
          titleAr: "الحركة الخطية",
          lessonRevisionIds: [physicsLesson.id],
        },
      ],
    },
    true,
  );
  const pythonPayload = {
    ...featured.find((p) => p.code === "PY-L01"),
    code: "PY-MANUAL-L01",
    titleAr: "الطباعة والمتغيرات — بيئة اختبار للقراءة",
    descriptionAr: scope,
    mappingPending: [],
  };
  const pythonLesson = await ensureLesson(pythonPayload, true);
  const pythonTrack = await ensureLesson(
    {
      kind: "track",
      subject: "programming",
      code: "PY-MANUAL-TRACK",
      titleAr: "Python للمبتدئين — بيئة اختبار",
      descriptionAr: scope,
      units: [
        {
          code: "python_basics",
          titleAr: "الطباعة",
          lessonRevisionIds: [pythonLesson.id],
        },
      ],
    },
    true,
  );
  const manifest = {
    scope,
    seededAt: new Date().toISOString(),
    algebraLessonId: algebra.id,
    algebraTrackId: algebraTrack.id,
    physicsLessonId: physicsLesson.id,
    physicsTrackId: physicsTrack.id,
    pythonLessonId: pythonLesson.id,
    pythonTrackId: pythonTrack.id,
    algebraProblemCount: bank.problems.length,
    physicsProblemCount: publishedPhysics.length,
    algebraPracticeIds: algebraPayload.practiceProblemRevisionIds,
    algebraPostIds: algebraPayload.assessmentProblemRevisionIds,
  };
  await pool.query(
    "INSERT INTO v22_manual_runtime_manifest(id,payload) VALUES('manual-content-v1',$1::jsonb) ON CONFLICT(id) DO NOTHING",
    [JSON.stringify(manifest)],
  );
  writeFileSync(
    ".local/v22-manual/content-manifest.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return manifest;
}
