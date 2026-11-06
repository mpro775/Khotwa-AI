import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
const directory = process.argv[2];
if (!directory) throw Error("Pass the final evidence directory");
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const relative = directory.replaceAll("\\", "/").replace(/^qa-reports\//, "");
const integration = read(path.join(directory, "integration-summary.json"));
const math = read(path.join(directory, "golden-math-http.json"));
const diagnosis = read(path.join(directory, "ph06-live-results.json"));
const retention = read(path.join(directory, "retention-results.json"));
const reviewed = read(
  path.join(directory, "ph08-reviewed-fallback-tests.json"),
);
const staticChecks = read("qa-reports/mvp-static/checks.json");
const demo = read("qa-reports/mvp-demo/demo-content.json"),
  https = read("qa-reports/mvp-demo/https-results.json"),
  security = read("qa-reports/mvp-demo/security-results.json");
assert.equal(staticChecks.commit, integration.commit);
assert.equal(math.commit, integration.commit);
assert.equal(retention.commit, integration.commit);
const datasetBytes = readFileSync("docs/14-GOLDEN-DATASET.cases.json"),
  dataset = JSON.parse(datasetBytes);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(sha(datasetBytes), math.datasetSha256);
const historical = spawnSync(
  "git",
  ["show", "defddb0:docs/14-GOLDEN-DATASET.cases.json"],
  { encoding: null, maxBuffer: 5000000 },
);
assert.equal(
  sha(historical.stdout),
  math.datasetSha256,
  "Golden source must remain byte-identical",
);
const cases = math.cases.map((c) => ({
  id: c.id,
  status: c.status,
  evidence: `${relative}/golden-math-http.json`,
  scope: c.transport,
  reviewStatus: dataset.review_status,
}));
for (const c of diagnosis.golden)
  cases.push({
    id: c.id,
    status: c.matched ? "PASS" : "FAIL",
    expected: c.expected,
    actual: c.actual,
    evidence: `${relative}/ph06-live-results.json`,
    issue: c.issue,
    reviewStatus: c.reviewStatus,
  });
function mapped(id, file, marker, requireSuiteSuccess = true) {
  const log = readFileSync(path.join(directory, file), "utf8");
  const check = integration.checks.find((c) => c.name + ".log" === file);
  const passed =
    log
      .split(/\r?\n/)
      .some((line) => line.includes("✔") && line.includes(marker)) &&
    (!requireSuiteSuccess || check?.exitCode === 0);
  return {
    id,
    status: passed ? "PASS" : "NOT_RUN",
    evidence: `${relative}/${file}`,
    assertion: marker,
    scope:
      "mapped executed integration assertions; development conformance, not human content approval",
    reviewStatus: dataset.review_status,
  };
}
const tutor = [
  ["ph07-integration.log", "H0 is unassisted"],
  ["ph07-integration.log", "H0 is unassisted"],
  ["ph07-integration.log", "H0 is unassisted"],
  ["ph07-integration.log", "H0 is unassisted"],
  ["ph07-integration.log", "H4 requires confirmation"],
  ["ph07-integration.log", "H4 requires confirmation"],
  ["ph08-integration.log", "confirmed H4 may exit transfer directly"],
  ["ph08-integration.log", "a transfer hint explicitly exits measurement"],
  ["ph07-integration.log", "syntax/unsupported/inconclusive never escalate"],
  ["ph07-integration.log", "syntax/unsupported/inconclusive never escalate"],
  ["ph07-integration.log", "syntax/unsupported/inconclusive never escalate"],
  [
    "reviewed-gemini-simulation.log",
    "timeout uses owner-attested reviewed fallback",
  ],
  [
    "ph08-integration.log",
    "a question previously disclosed by a probe is excluded",
  ],
  ["ph08-integration.log", "one correct probe answer never creates a mastery"],
  ["ph06-integration.log", "overlap probes distinguish causes", false],
  ["ph07-integration.log", "assistance survives edit/reload"],
  null,
  [
    "ph08-integration.log",
    "a failed independent transfer offers a different bounded remediation",
  ],
];
for (const [i, mapping] of tutor.entries()) {
  const id = "GOLD-TUTOR-" + String(i + 1).padStart(3, "0");
  cases.push(
    mapping
      ? mapped(id, ...mapping)
      : {
          id,
          status: "BLOCKED",
          reason:
            "The exact fixture requires an approved problem bank. Transfer mechanics passed but bank/pairing review remains pending.",
          evidence: "math-tutoring-review-packet.md",
          reviewStatus: dataset.review_status,
        },
  );
}
const state = [
  ["ph04-integration.log", "old-step edit invalidates proof dependencies"],
  ["ph05-integration.log", "concurrent same-key retry, stale response"],
  ["ph04-integration.log", "two different keys racing at one revision"],
  ["ph04-integration.log", "step append preserves exact raw and repeat"],
  [
    "ph05-integration.log",
    "equivalent chain and isolated final answer complete only the pinned revision",
  ],
  ["ph04-integration.log", "guest B cannot discover, read or mutate"],
  [
    "reviewed-gemini-simulation.log",
    "invalid_json uses owner-attested reviewed fallback",
  ],
  ["ph07-integration.log", "unexpected provider JSON, verdict changes"],
  ["ph05-integration.log", "unavailable service preserves raw"],
  [
    "reviewed-gemini-simulation.log",
    "503 uses owner-attested reviewed fallback",
  ],
  ["retention.log", "GOLD-STATE-011"],
  ["ph07-integration.log", "H4 requires confirmation"],
  [
    "ph08-integration.log",
    "a question previously disclosed by a probe is excluded",
  ],
  [
    "ph09-integration.log",
    "teacher cards always read the fixed synthetic source",
  ],
  [
    "ph09-integration.log",
    "anonymous and foreign-session reads cannot resolve",
  ],
  ["retention.log", "GOLD-STATE-016"],
  [
    "ph04-integration.log",
    "expiry, idle timeout, revocation and bootstrap replay",
  ],
  ["ph09-integration.log", "duplicate source events and repeated verification"],
];
for (const [i, mapping] of state.entries())
  cases.push(
    mapped("GOLD-STATE-" + String(i + 1).padStart(3, "0"), ...mapping),
  );
assert.equal(cases.length, 151);
assert.equal(new Set(cases.map((c) => c.id)).size, 151);
const counts = Object.fromEntries(
  ["PASS", "FAIL", "BLOCKED", "NOT_RUN", "NOT_APPLICABLE"].map((s) => [
    s,
    cases.filter((c) => c.status === s).length,
  ]),
);
const report = {
  runId: integration.runId,
  sourceCommit: integration.commit,
  at: new Date().toISOString(),
  datasetSha256: math.datasetSha256,
  datasetReview: dataset.review_status,
  counts,
  acceptance: "NOT_ACCEPTED_PENDING_DOMAIN_AND_MANUAL_REVIEW",
  caseExecution:
    "97 directly executed math/parse; 18 exact diagnosis comparisons; 36 explicitly mapped policy/state scenarios with assertions or blockers. PASS is development execution only.",
  actualGeminiCalls: 0,
  cases,
};
writeFileSync(
  "qa-reports/golden-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
const write = (file, text) =>
  writeFileSync("qa-reports/" + file, text.trim() + "\n");
const evidence = `[الجولة](${relative}/integration-summary.json) · [Golden](golden-results.json) · [التطهير](${relative}/retention-results.json) · [HTTPS](mvp-demo/https-results.json) · [الأمان](mvp-demo/security-results.json)`;
const stamp = `2026-11-06 / Asia/Riyadh؛ run_id \`${integration.runId}\`؛ source commit \`${integration.commit}\`. لا توقيع بشري مستحدث.`;
const common = `الهاتف وAndroid وتحسين Mobile Responsive: \`DEFERRED_BY_APPROVED_SCOPE_CHANGE\` وفق [أمر المالك](../planning/approvals/MVP-CLOSURE-OWNER-ORDER-2026-11-06.md). Chrome/RTL للحاسوب يبقى إلزاميًا وغير منفذ؛ أداة computer-use أوقفت التفاعل لعدم إمكان التحقق من عنوان المتصفح. لا صور للمشروع أو اختبار React تفاعلي جديد. الكسور غير المقبولة وSK08 محجوبة.`;
write(
  "gate-1.md",
  `# GATE-1 — BLOCKED_PENDING_DESKTOP_AND_MATH_REVIEW
${stamp}

| الشرط | النتيجة والدليل | المتبقي |
|---|---|---|
| 40 parse +57 math، مجموعات حل وشواهد دقيقة | PASS تطويري عبر HTTP؛ و40+53 طالبية عبر API | مرجع draft يحتاج اعتماد الرياضيات/QA |
| مكافئ وغير مكافئ وامتناع، بديل صحيح | PASS في التكامل وHTTPS | مراجعة المجال |
| رد متأخر وتعديل وإبطال مشتقات | PASS خادمًا ووحدات epoch في React | التفاعل المرئي |
| React → NestJS → Python | React مبني ووحداته ناجحة؛ مسار HTTPS إلى Python ناجح | Chrome الفعلي NOT_RUN |
| RTL والأقواس والإشارات والنسخ/اللصق | NOT_RUN على الإصدار الحالي | المالك/الواجهة/الرياضيات |
| الهاتف | DEFERRED_BY_APPROVED_SCOPE_CHANGE | خارج قبول هذه النسخة |

${common}

${evidence}
لم تسجل APPROVED: قرار نطاق المالك موجود، لكن الفحص المرئي واعتماد المرجع والمراجعين غير مكتملين.`,
);
write(
  "gate-2.md",
  `# GATE-2 — BLOCKED_PENDING_DOMAIN_REVIEW
${stamp}

| الشرط | النتيجة | المتبقي/المالك |
|---|---|---|
| الأنماط الستة والتشخيص المحافظ | السلوك المستهدف PASS؛17/18 مطابقة مرجعية | GOLD-DIAG-015 FAIL: مراد سيف +QA |
| H0…H4 وعدم الاستقلال بعد المساعدة | PASS تكامل ومحاكاة | مراجعة المحتوى الأوسع |
| قوالب PH08 المثبتة | ${demo.reviewedRows} صف reviewed بقاعدة العرض الدائمة؛ بصمات ومصدر وإعادة إدخال مثبتة | ليست اعتمادًا لبقية البنك |
| علاج ثم نقل مختلف وحجب الإجابة | PASS تقني/HTTPS | GOLD-TUTOR-017 BLOCKED لاعتماد البنك |
| فصل AI عن SymPy/التقدم | PASS؛ JSON خاطئ وتسريب/مهلة/503 وبديل مراجع | لا Gemini جديد |
| ERR05/SK06 | توليده محجوب؛ fallback فقط | القرار المنهجي pending؛ لا تسقط بقية ERR05 من الاختبار |

${evidence}

يوصى بقبول تقني محدود لـPH08 ضمن Desktop مع البديل؛ الدليل الحي السابق 2 نصوص ناجحة و2 أخطاء503، لا نجاح4/4 ولا ضمان توافر Gemini الحي عبر H1/H3. لا قبول تلقائي للبنك من27 بطاقة ولا توقيع باسم الأستاذ.`,
);
write(
  "gate-3.md",
  `# GATE-3 — TECHNICAL_EVIDENCE_READY_PENDING_SECURITY_QA
${stamp}

| الشرط | النتيجة الفعلية | المتبقي |
|---|---|---|
| ملكية/جلسات/CSRF/Origin/revision/idempotency | PASS تكامل وعقود | مراجعة محمد مراد/QA |
| انقطاع Python وAI دون فقد | PASS، إعادة آمنة وفصل الحكم | فحص React اليدوي |
| المعلم اصطناعي مستقل | PASS، artifact ثابت لا يقرأ محاولات الضيف | مراجعة المصدر/العينة |
| OWN-11/SEC-047 التطهير | dry-run، حذف graph، rollback، إعادة، صلاحيات منفصلة: PASS | مراجعة أمن مستقلة |
| الأسرار والمنافذ | ${security.leaks.length} تسريب لقيم الأسرار المحلية؛ DB/Python بلا ports؛ backend internal=${security.backendInternal} | ليس اختبار اختراق عام |
| نسخ احتياطية/استعادة بيانات حقيقية | NOT_APPLICABLE لهذه البيئة الاصطناعية؛ لم تنشأ أو تستعد | يلزم إجراء واختبار قبل تشغيل حقيقي |

${common}

${evidence}

لا APPROVED: اعتماد الأمن/QA والبوابات السابقة لم يكتمل. لا اختبار على بيانات حقيقية ولا migrations عليها.`,
);
write(
  "manual-acceptance-checklist.md",
  `# الفحص اليدوي المطلوب — Desktop فقط
${stamp}

افتح [العرض المحلي](https://localhost:8448/) واتبع [سيناريو العرض](../docs/18-DEMO-AND-DELIVERY.md). الحالة الحالية لكل بند أدناه NOT_RUN، لا PASS مستنتج من build/API.

- [ ] تعامل المالك مع شهادة localhost إن ظهرت شاشة أمان، دون تعطيل حماية النظام أو المتصفح.
- [ ] تحقق على Chrome من ٢س، ٢(س+٣)، −٣س+١٢، وس=١٢٣؛ الأرقام متعددة الخانات والأقواس والسالب تحافظ على المعنى.
- [ ] اكتب وانسخ والصق وعدل وسط السطر بلوحة المفاتيح، وقارن النص المحفوظ المعاد من API.
- [ ] نفذ J01…05: صحيح، خطأ ثم سؤال/تلميح/علاج/نقل، بديل صحيح، unsupported، معلم اصطناعي.
- [ ] عدل خطوة أثناء الانتظار؛ لا تبق بطاقة حكم/تشخيص قديمة فعالة، ولا تفقد المسودة.
- [ ] تحقق من التنقل Tab وتسميات الحقول ورسائل الانتظار والفشل. قارئ الشاشة إن أمكن يسجل منفصلًا.
- [ ] راجع وسوم القوالب والبيانات الاصطناعية والحدود، وتأكد من عدم وصف الكسور بدعم كامل.

${common}

سبب توقف الأداة: تعذر التحقق من URL على Windows بالثقة اللازمة لإنفاذ السياسة، قبل أي تفاعل مع المشروع. لم يستخدم مسار بديل لتجاوز الإيقاف. [مهارة computer-use](C:/Users/PC/.codex/plugins/cache/openai-bundled/computer-use/26.1023.51421/skills/computer-use/SKILL.md) تحيل إلى guidance: «If Computer Use reports that the turn ended or that the user stopped Computer Use, stop issuing app input.»`,
);
write(
  "open-blockers.md",
  `# عوائق القبول وعيوب النسخة
${stamp}

| المعرف | الشدة/الحالة | الأثر والدليل | المسؤول/المطلوب |
|---|---|---|---|
| CLOSE-01 | BLOCKER قبول؛ مفتوح | Chrome/RTL/نسخ ولصق ومسار React الفعلي غير منفذ؛ الهاتف مؤجل لا يغطيه | المالك +الواجهة +الرياضيات |
| CLOSE-02 | HIGH؛ FAIL مثبت | GOLD-DIAG-015 يتوقع needs_probe والتنفيذ tentative؛ نفس بنية004 التي تتوقع tentative. لا خطأ حسابي أو مرجع معدل | مراد سيف +QA؛ DATASET-ISSUE-PH06-01 |
| CLOSE-03 | BLOCKER محتوى؛ مفتوح | البنك والعائلات والتشخيص وH4 draft؛ GOLD-TUTOR-017 يحتاج بنكًا معتمدًا، وموافقة27 بطاقة لا تكفي | مراد سيف +مالك المنهج +QA |
| CLOSE-04 | HIGH قرار مجال؛ محجوب بأمان | ERR-ALG-05/calculation_divide→SK06 يخالف الحصر02/03؛ التوليد محجوب وfallback مثبت | مراد سيف؛ SPEC-CONFLICT-PH08-REVIEW-01 |
| CLOSE-05 | HIGH اعتماد؛ pending | أدلة التطهير/العزل جاهزة بلا مراجعة محمد مراد المستقلة | محمد مراد +QA |
| CLOSE-06 | HIGH اعتماد؛ pending | Golden draft والبوابات غير موقعة؛ لا عينة محجوبة معتمدة هنا | الرياضيات +QA +المالك |
| CLOSE-07 | MEDIUM؛ حد معلن | Gemini الحي H1/H3 غير مثبتين في الجولة السابقة503؛ fallback اجتاز، لا تفويض لاتصال جديد | يقبل المالك حدود التوافر أو يفوض لاحقًا |
| CLOSE-08 | MEDIUM؛ تحذير بناء | حزمة Vite كبيرة؛ build ناجح ولا ادعاء أداء هاتف | بعد الهاكثون ما لم يظهر أثر Desktop |

لم ترصد الحالات الرياضية الـ97 حكمًا جازمًا خاطئًا؛ ذلك ليس ضمانًا عامًا. لا عيب تنفيذ حرج مخفي بحذف اختبار. أخطاء أدوات الجولة الأولية (اسم مضيف proxy وصيغة status fixtures) أصلحت وأعيدت فحوصها؛ أدلتها محفوظة في مجلدات الجولات السابقة. لا تغلق PH10 أو GATE1…4 مع هذه العوائق.`,
);
const commands = integration.checks
  .map(
    (c) =>
      `| ${c.name} | ${c.exitCode === 0 ? "PASS" : "FAIL"} | ${Math.round(c.elapsedMs)} ms | [سجل](${relative}/${c.name}.log) |`,
  )
  .join("\n");
write(
  "ph10-delivery.md",
  `# PH-10 — منفذة تقنيًا، القبول محجوب
${stamp}

Task: A…F / MVP01…14، GOLD/QA-E2E/QA-DATA/QA-SEC/SEC047. الحالة: **مكتمل جزئيًا؛ جاهز لمراجعة موحدة، غير مقبول للإصدار**. الوثائق المالكة: AGENTS و00/01/02/04…17 وOpenAPI12 والعقد الداخلي؛ التغييرات الإضافية في قرار Desktop والصيانة والتشغيل، دون تعديل API/JSON أو Golden أو حكم SymPy.

151 حالة مصنفة: ${counts.PASS} PASS، ${counts.FAIL} FAIL، ${counts.BLOCKED} BLOCKED، ${counts.NOT_RUN} NOT_RUN، ${counts.NOT_APPLICABLE} NOT_APPLICABLE. PASS تشغيل تطويري؛ حالة مراجعة كل سجل محفوظة. مسارات TUTOR/STATE مرتبطة باختبارات محددة، وليست151 اختبارًا مستقلًا أو نسبة دقة تعليمية.

| الفحص | النتيجة | الزمن | الدليل |
|---|---|---|---|
${commands}

الفحوص الثابتة: ${staticChecks.checks.filter((c) => c.exitCode === 0).length}/${staticChecks.checks.length} مجموعات ناجحة؛ [الأوامر](mvp-static/checks.json)، lint/format/typecheck/build والعقود ووحدات API/React/Python. HTTPS: ${https.passed} تحقق، وJ01…05 API PASS؛ React Chrome NOT_RUN. Gemini محاكاة فقط، ${reviewed.checks.filter((c) => c.passed).length} حالات فرعية، ولا اتصال خارجي جديد. لا تحميل ثقيل.

قياس خفيف للمحرك HTTP: n=${math.performance.samples}، p50=${math.performance.p50Ms.toFixed(2)}ms، p95=${math.performance.p95Ms.toFixed(2)}ms. HTTPS الرحلة: n=${https.performance?.samples ?? "غير متاح"}، p50=${https.performance?.p50Ms.toFixed(2) ?? "غير متاح"}ms، p95=${https.performance?.p95Ms.toFixed(2) ?? "غير متاح"}ms؛ لهذه البيئة التسلسلية فقط، لا قياس Gemini حي أو تعميم إنتاجي.

${common}

الأمان/الخصوصية: قواعد الاختبار مؤقتة مع tmpfs، قاعدة العرض الاصطناعية منفصلة ودائمة؛ لا بيانات متعلمين أو نشر أو push. migration0010 فقط للقواعد المحلية المأذونة، delete role منفصل، بلا تعطيل immutable history للتطبيق. النسخ الاحتياطية الحقيقية NOT_APPLICABLE، لا وعد بمحوها.

المتبقي: [العيوب](open-blockers.md)، [الفحص اليدوي](manual-acceptance-checklist.md)، [مراجعة الرياضيات](math-tutoring-review-packet.md)، [الأمان](security-review-packet.md). حالة الاعتماد: بانتظار مراد سيف/محمد مراد/QA والمالك حسب المجال؛ لا توقيع منسوب. التقارير وRC نقطة التوقف المفوضة.`,
);
write(
  "math-tutoring-review-packet.md",
  `# حزمة مراجعة موحدة — الأستاذ مراد سيف +QA
${stamp}

1. GOLD-DIAG-015: س+٥=٨ → س+٥=٣؛ المتوقع ERR03/needs_probe، التنفيذ ERR03/tentative. GOLD-DIAG-004 له البنية نفسها بأعداد مختلفة ويتوقع tentative. يثبت اختلاف مجموعتي الحل في الحالتين، ولا قرينة منهجية مسجلة تفسر اختلاف شدة الفرضية. الخيارات: توحيد سياسة الحالة بعد اعتماد المراجع، أو إضافة سياق مميز معتمد. لم يعدل أي expected أو يستثن رقم الحالة. [طلب القرار](../planning/ph06-dataset-issue.md).
2. ERR05/calculation_divide إلى SK06: اختر اعتماد استثناء موثق في05/06، أو إبقاء الحجب وتحديد الربط الصحيح. لا يصنف الوكيل تلقائيًا إلى02/03. [التعارض](../planning/ph08-review-decisions.md).
3. راجع بنك العرض المكون من ${security.databaseReview?.problemRevisions ?? 36} نسخة مسألة، ${security.databaseReview?.diagnosticTemplates ?? 8} قوالب سؤال، والعائلات والحلول H4؛ pairings draft=${security.databaseReview?.draftPairings ?? "pending"} وreviewed=${security.databaseReview?.reviewedPairings ?? 0}. كلها اصطناعية؛ نشر fixture التقني لا يعني اعتمادها. حزمة27 بطاقة ذات بصمة محددة فقط هي المشمولة بإفادة المالك.
4. راجع مطابقة Golden الحرجة ومعنى الشواهد وفرضيات الأنماط الستة؛ المرجع151 ما زال draft. لا توقع عن QA ولا عن المراجع من نجاح التشغيل.

المرفقات: ${evidence}، [بطاقات PH08](../content/ph08-reviewed-2026-11-06.json)، [إفادة المالك](../planning/approvals/PH08-CONTENT-OWNER-ATTESTATION-2026-11-06.md). الاسم/التاريخ/القرار: **بانتظار المراجع**. أعدت الملفات ولم ترسل أي رسالة خارجية.`,
);
write(
  "security-review-packet.md",
  `# حزمة مراجعة موحدة — المهندس محمد مراد +QA
${stamp}

المطلوب مراجعة migration0010 وصلاحيات دالة NOLOGIN، CLI/dry-run والدفعات والجدولة، وحذف graph بأكمله دون المساس بالمحتوى. [نتائج التطهير](${relative}/retention-results.json) و[السجل](${relative}/retention.log) تثبت الحذف والتراجع والإعادة ومنع runtime من GUC bypass أو EXECUTE. حساب العرض runtimeCanPurge=${security.databaseReview?.runtimeCanPurge} وsuperuser=${security.databaseReview?.runtimeSuperuser}، والصيانة منفصلة.

ملكية وCSRF/Origin والجلسات والتكرار/السباقات وفشل Python/AI نفذت عبر NestJS/PostgreSQL/Python؛ الأسرار المحلية والمنافذ في [الفحص](mvp-demo/security-results.json). لا اتصال Gemini جديد أو بيانات حقيقية. المعلم artifact ثابت مستقل. لا اختبار نسخ احتياطية حقيقية أو استعادة أو اعتماد إنتاجي؛ يلزم إجراء منفصل قبل التشغيل الحقيقي. المتبقي المرئي في [قائمة المالك](manual-acceptance-checklist.md).

حالة اعتماد محمد مراد/QA: **بانتظار**؛ لا توقيع أو تاريخ مراجعة مختلق. أعدت الملفات ولم ترسل خارجيًا.`,
);
write(
  "ph11-draft-delivery.md",
  `# PH-11 — PREPARED_NOT_AUTHORIZED_FOR_FINAL_DELIVERY
${stamp}

TASK111…117: [RC](release-candidate.json)، [التشغيل والإيقاف والاستعادة والديمو والحدود](../docs/18-DEMO-AND-DELIVERY.md)، بيانات عرض اصطناعية دائمة ومحتوى مثبت، [اختبارات PH10](ph10-delivery.md)، سجل النسخ والبصمات. Gemini معطل في العرض؛ مصدر القالب مصرح به، لا نتيجة مزيفة.

الجاهزية: **مسودة مرشح للمراجعة، غير مؤهل بعد لاعتماد GATE-4**. يلزم إزالة عوائق القبول واعتماد GATE1/2/3 وPH10، ثم قرار مالك صريح للتسليم النهائي. متطلبات المنظم غير المقدمة والتجربة المباشرة أمامه غير منفذة. لا نشر أو tag إطلاق أو push أو تسليم خارجي.`,
);
const fingerprints = Object.fromEntries(
  [
    "package-lock.json",
    "services/math-engine/requirements.lock",
    "content/ph08-reviewed-2026-11-06.json",
    "docs/12-API-CONTRACT.yaml",
    "docs/14-GOLDEN-DATASET.cases.json",
    "apps/api/prisma/migrations/0010_guest_retention/migration.sql",
    "compose.mvp.yaml",
  ].map((f) => [f, sha(readFileSync(f))]),
);
const evidenceFiles = readdirSync(directory).filter((f) =>
  /\.(json|log)$/.test(f),
);
write(
  "release-candidate.json",
  JSON.stringify(
    {
      candidate: "khotwa-desktop-hackathon-rc-review",
      sourceCommit: integration.commit,
      branch: "codex/mvp-closure",
      runId: integration.runId,
      status: "REVIEW_ONLY_NOT_RELEASE_APPROVED",
      publicDeployment: false,
      ownerFinalDeliveryDecision: "pending",
      scope: "Desktop Web MVP; synthetic local demo",
      mobile: "DEFERRED_BY_APPROVED_SCOPE_CHANGE",
      fractions: "blocked_pending_visual_acceptance",
      gemini: "disabled; prior live evidence only; zero new calls",
      components: {
        api: read("apps/api/package.json").version,
        web: read("apps/web/package.json").version,
        math: "0.3.0",
        postgres: "17.6",
        migrationCount: 10,
        content: "ph08-reviewed-20261106-v1",
        diagnosis: "conservative-algebra-0.6.0",
        tutoring: "tutoring-p0-0.7.0",
      },
      fingerprints,
      evidence: Object.fromEntries(
        evidenceFiles.map((f) => [
          relative + "/" + f,
          sha(readFileSync(path.join(directory, f))),
        ]),
      ),
      golden: counts,
      approvals: {
        math: "pending",
        security: "pending",
        qa: "pending",
        gate1: "not_approved",
        gate2: "not_approved",
        gate3: "not_approved",
        gate4: "not_approved",
      },
    },
    null,
    2,
  ),
);
write(
  "MVP-CLOSURE-REPORT.md",
  `# إغلاق نسخة الهاكثون — Desktop Web MVP
${stamp}

**النتيجة: أعمال الإغلاق التقنية ومرشح PH11 أعدت؛ الإغلاق النهائي غير مؤهل للاعتماد بعد.** تبقى مراجعة المحتوى والتعارض المرجعي وفحص Chrome واعتمادات المجالات. لا نشر أو push أو Gemini جديد أو توقيع بشري مستحدث.

| البوابة/المرحلة | الحالة | الدليل | العائق والمسؤول |
|---|---|---|---|
| A / PH08 | جاهز لقبول تقني محدود مع fallback | [249 صف reviewed](mvp-demo/demo-content.json)، [التسليم السابق](ph08-final-delivery.md) | قبول حدود Gemini للمالك؛ لا اعتماد للبنك |
| B / GATE1 | BLOCKED | [التقرير](gate-1.md) | Chrome/RTL يدوي +رياضيات/QA |
| C / GATE2 | BLOCKED | [التقرير](gate-2.md) | DIAG015 وERR05/SK06 والبنك؛ مراد سيف +QA |
| D / GATE3 | أدلة تقنية جاهزة؛ اعتماد pending | [التقرير](gate-3.md) | محمد مراد +QA والبوابات السابقة |
| E / PH10 | نفذت، غير مقبولة نهائيًا | [التسليم](ph10-delivery.md)، [151 حالة](golden-results.json) | عوائق القبول المفتوحة |
| F / PH11 | PREPARED / REVIEW ONLY | [المسودة](ph11-draft-delivery.md)، [RC](release-candidate.json) | قرار المالك بعد القبول |
| GATE4 | NOT_APPROVED | [العيوب](open-blockers.md) | لا تسليم نهائي قبل الشروط |

## ما أغلق فعليًا

قرار Desktop سجل في مصادر النطاق والاختبار والخطة وAGENTS. المحتوى المراجع ثبت بقاعدة العرض الدائمة مع البصمات والإفادة وإعادة الإدخال دون تغيير التاريخ. نفذ التطهير المأذون باعتماد صيانة مستقل وحماية التاريخ واختبارات الحذف والتراجع والإعادة. اختبرت الجلسات والعقود والتزامن والأعطال والمعلم الاصطناعي. لم تغير API/JSON أو Golden أو أحكام SymPy.

Golden: **${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.BLOCKED} BLOCKED / ${counts.NOT_RUN} NOT_RUN / ${counts.NOT_APPLICABLE} NOT_APPLICABLE** من151. PASS تطويري، لا اعتماد دقة تربوية. تحليل/رياضيات97 مباشرة، وتشخيص18 مقارنة دقيقة، والباقي بتعيين صريح إلى assertions منفذة أو حجب. الفشل DIAG015 محفوظ؛ لا نتيجة متوقعة معدلة. ${staticChecks.checks.filter((c) => c.exitCode === 0).length}/${staticChecks.checks.length} مجموعات static ناجحة، و${https.passed} فحص HTTPS. القيم والأوامر والبيئة في PH10.

## ما يحتاج الاعتماد والفحص

- الأستاذ مراد سيف +QA: [حزمة واحدة](math-tutoring-review-packet.md) لتعارض DIAG015 والربط والبنك وGolden. موافقة27 بطاقة لا تغطي هذه العناصر.
- المهندس محمد مراد +QA: [حزمة الأمان](security-review-packet.md) للتطهير والعزل والتشغيل؛ لا توقيع منسوب.
- المالك: [فحص Chrome اليدوي](manual-acceptance-checklist.md) للرياضيات وRTL والنسخ والرحلات؛ الأداة أوقفت التحكم قبل اختبار المشروع لتعذر التحقق من URL. لا React E2E مرئي جديد.
- ما بقي BLOCKER أو HIGH مفصل في [سجل واحد](open-blockers.md)، مع المسؤول والأثر.

## المؤجل رسميًا والقرار المطلوب

${common}

يمكن تأجيل تحسين حجم الحزمة وقياس التوافر الحي الأوسع إلى متابعة معلنة؛ لا يؤجل خطأ رياضي أو تسريب أو شرط P0 دون قرار نطاق محدد. أُعد README وسيناريو العرض والبديل المحلي وRC ببصمات، ولم يعتمد GATE4.

**GATE1/2/3 وقبول PH10:** ليست APPROVED؛ GATE3 جاهزة للمراجعة التقنية، وGATE1/2 لهما عوائق موثقة. **PH11/GATE4:** مسودة جاهزة للمراجعة، لا قرار تسليم نهائي مؤهل بعد. توقف التنفيذ هنا لقرار المالك الموحد بعد البنود أعلاه.

العرض [https://localhost:8448/](https://localhost:8448/)، ببيانات اصطناعية وقوالب محلية. تقارير القياس لا تعمم على إنتاج أو طلاب حقيقيين. المصدر النظيف قبل المهمة defddb0 على codex/ph08-final-acceptance؛ commit أعلاه يثبت شيفرة القبول، وcommit الأدلة اللاحق يوثق التقارير فقط.`,
);
console.log(
  JSON.stringify({
    runId: integration.runId,
    commit: integration.commit,
    counts,
    release: "REVIEW_ONLY",
    reports: "qa-reports/MVP-CLOSURE-REPORT.md",
  }),
);
