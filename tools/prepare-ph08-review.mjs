import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const {
  generationRules,
  validateGeneratedMeaning,
  PH08_GENERATION_VERSION,
} = require("../apps/api/dist/ph08-generative.js");
const { buildHintContext } = require("../apps/api/dist/ai-tutor.js");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const profiles = [
  ["SK-ALG-04", "ERR-ALG-01", "التوزيع"],
  ["SK-ALG-02", "ERR-ALG-02", "الإشارة والطرفان"],
  ["SK-ALG-01", "ERR-ALG-03", "طرفا المساواة"],
  ["SK-ALG-06", "ERR-ALG-04", "العملية العكسية"],
  ["SK-ALG-03", "ERR-ALG-05", "الحساب العددي"],
  ["SK-ALG-04", "ERR-ALG-06", "المعامل السالب"],
  ["SK-ALG-04", null, "سبب غير محسوم"],
];
const candidates = [];
for (const [skillCode, errorCode, labelAr] of profiles) {
  for (const level of [1, 2, 3]) {
    const profile = {
      skillCode,
      errorCode,
      diagnosisMode: errorCode ? "possible" : "unresolved",
      phase: "remediation",
      transferExited: false,
    };
    const context = buildHintContext({
      level,
      templateId: "review-only",
      contentVersion: "draft-review-v1",
      textAr: "راجع خطوتك بهدوء.",
      variants: [],
      skillNameAr: labelAr,
      observationAr: "لا تشخيص جازم من خطأ واحد.",
      maxOutputTokens: 256,
    });
    const g = generationRules(profile, context.targetHintLevel).grammar;
    const generatedExampleAr =
      "خذ وقتك، " +
      g.starters[0] +
      " " +
      g.focus +
      (g.continuation[0] ?? "") +
      g.punctuation +
      g.endings[1];
    if (
      validateGeneratedMeaning(generatedExampleAr, context, profile).text !==
      generatedExampleAr
    )
      throw Error("Invalid review fixture");
    const fallbackTextAr =
      g.starters[0] + " " + g.focus + (g.continuation[0] ?? "") + g.punctuation;
    const content = {
      id: `PH08-FB-${errorCode ?? "UNRESOLVED"}-H${level}`,
      labelAr,
      profile,
      hintLevel: context.targetHintLevel,
      fallbackTextAr,
      generatedExampleAr,
      generationRules: g,
      source: "agent_authored_draft_for_human_review",
      reviewStatus: "draft",
      publicationBlockedBy: ["human_content_approval"],
      reviewDecision: null,
    };
    candidates.push({
      ...content,
      contentSha256: hash(JSON.stringify(content)),
    });
  }
}
const specialCases = [
  {
    id: "PH08-FB-SK08-H1",
    hintLevel: "H1",
    textAr: "راجع موضع البسط والمقام في الكسر الذي كتبته.",
  },
  {
    id: "PH08-FB-SK08-H2",
    hintLevel: "H2",
    textAr: "اسأل نفسك هل تمثل القسمة المقصودة بنفس ترتيب العددين.",
  },
  {
    id: "PH08-FB-SK08-H3",
    hintLevel: "H3",
    textAr: "راجع معنى الكسر بتتبع البسط والمقام، ثم افحص إجابتك بالتعويض.",
  },
].map((v) => ({
  ...v,
  skillCode: "SK-ALG-08",
  reviewStatus: "draft",
  eligibleForGeneration: false,
  publicationBlockedBy: [
    "human_content_approval",
    "fraction_math_and_visual_checks_DR007",
  ],
  reviewDecision: null,
  contentSha256: hash(JSON.stringify(v)),
}));
const payload = {
  formatVersion: "ph08-human-review-pack-v1",
  date: "2026-11-05",
  timezone: "Asia/Riyadh",
  status: "draft",
  reviewerRequestedAr: "الأستاذ مراد سيف",
  reviewerSigned: null,
  reviewedAt: null,
  approvalEvidence: null,
  actualGeminiCalls: 0,
  instructionAr:
    "هذه حزمة مراجعة فقط؛ لا تُحمّل إلى قاعدة البيانات ولا تحول إلى reviewed قبل قرار مختص موثق مرتبط بالبصمات.",
  generationVersion: PH08_GENERATION_VERSION,
  generationSourceSha256: hash(readFileSync("apps/api/src/ph08-generative.ts")),
  sharedPolicySha256: hash(readFileSync("apps/api/src/tutoring-policy.ts")),
  candidates,
  specialCases,
  temporaryMappingGate: {
    state: "owner_approved_temporary_block",
    date: "2026-11-05",
    skillCode: "SK-ALG-06",
    errorCode: "ERR-ALG-05",
    domainDecision: "pending",
  },
  mappingFallbackCandidates: [
    {
      id: "PH08-FB-MAPPING-PENDING-H1",
      hintLevel: "H1",
      textAr: "راجع ما تغير في خطوتك الأخيرة.",
    },
    {
      id: "PH08-FB-MAPPING-PENDING-H2",
      hintLevel: "H2",
      textAr: "راجع العملية العددية المكتوبة قبل أن تختار متابعة الحل.",
    },
    {
      id: "PH08-FB-MAPPING-PENDING-H3",
      hintLevel: "H3",
      textAr:
        "افصل مراجعة الحساب عن اختيار العملية، ثم تحقق من كل جزء على حدة.",
    },
  ].map((v) => ({
    ...v,
    reviewStatus: "draft",
    eligibleForGeneration: false,
    reviewDecision: null,
    skillCode: "SK-ALG-06",
    errorCode: "ERR-ALG-05",
    publicationBlockedBy: ["human_content_approval"],
    contentSha256: hash(JSON.stringify(v)),
  })),
  pendingDecisions: [
    {
      id: "SPEC-CONFLICT-PH08-REVIEW-01",
      state: "pending",
      questionAr:
        "هل يعتمد تخصيص ERR-ALG-05 / calculation_divide إلى SK-ALG-06، أم يوقف توليد هذه التركيبة في PH-08؟",
      options: [
        "اعتماد سياقي مع تعديل الوثائق المالكة",
        "حجب توليد التركيبة واستخدام fallback مراجع أو503",
      ],
      chosen: null,
    },
    {
      id: "PH08-REVIEW-SK08",
      state: "pending_human_release_review",
      questionAr:
        "الكسور مستبعدة من التوليد الحالي، وتبقى خارج النشر حتى فحوص العرض/الرياضيات والمحتوى؛ هل تعتمد بدائلها لاحقًا؟",
      chosen: null,
    },
  ],
  reviewChecklistAr: [
    "صحة المفهوم وعدم الجزم بسبب الخطأ",
    "مقدار المساعدة في كل H1–H3 دون جواب أو عملية كاشفة",
    "سلامة العربية والتدرج",
    "سلامة العودة من النقل بعد إنهاء القياس",
    "مراجعة كل بديل ثابت وتحديد ما يعتمد منه بالمعرف والبصمة",
  ],
  transferExampleAr:
    "بعد العودة إلى التدريب، خذ وقتك، تأمل الحدين داخل القوس. يمكنك تدوين ملاحظتك قبل المتابعة.",
  approvalTemplate: {
    state: "pending",
    approvedCandidateIds: [],
    approvedContentHashes: [],
    mappingDecision: null,
    fractionDecision: null,
    reviewerRole: null,
    reviewerName: null,
    reviewedAt: null,
    evidenceReference: null,
  },
};
const pack = { ...payload, packSha256: hash(JSON.stringify(payload)) };
writeFileSync(
  "qa-reports/ph08-content-review-pack.json",
  JSON.stringify(pack, null, 2) + "\n",
);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const rows = candidates
  .map(
    (c) =>
      `<tr><td><code>${esc(c.id)}</code><br>${esc(c.labelAr)} / ${esc(c.hintLevel)}</td><td>${esc(c.generatedExampleAr)}</td><td>${esc(c.fallbackTextAr)}</td><td>قبول / تعديل / رفض: ______<br>ملاحظات: ______<br><small>${esc(c.contentSha256)}</small></td></tr>`,
  )
  .join("");
const special = specialCases
  .map(
    (c) =>
      `<tr><td>${esc(c.id)}</td><td>${esc(c.textAr)}</td><td>draft — حظر النشر إلى فحص الكسور واعتماد المحتوى</td></tr>`,
  )
  .join("");
const mappingRows = payload.mappingFallbackCandidates
  .map(
    (c) =>
      `<tr><td>${esc(c.id)}</td><td>${esc(c.textAr)}</td><td>draft</td></tr>`,
  )
  .join("");
writeFileSync(
  "qa-reports/ph08-content-review-pack.html",
  `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>PH-08 — حزمة مراجعة الأستاذ مراد سيف</title><style>body{font:17px/1.8 Tahoma,Arial,sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;color:#172b35}h1,h2{line-height:1.4}aside{background:#fff1cc;padding:18px;border-right:5px solid #b87809}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccd5d9;padding:12px;vertical-align:top}th{background:#eaf1f3}small{font-size:10px;word-break:break-all}code{direction:ltr;unicode-bidi:isolate;font-size:12px}li{margin:8px 0}@media print{body{font-size:11pt;margin:0}tr{break-inside:avoid}th{display:table-cell}}</style><h1>PH-08 — حزمة المراجعة التربوية</h1><p>2026-11-05 / Asia/Riyadh — المراجع المقترح: الأستاذ مراد سيف</p><aside><b>جميع النصوص والقواعد draft وغير معتمدة.</b> هذه أمثلة مؤلفة للمراجعة، وليست مخرجات Gemini حقيقية. لم يجر إرسال الحزمة أو تسجيل توقيع. لا تُستخدم مع الطلاب ولا تُحمّل إلى DB قبل اعتماد النصوص المحددة وبصماتها.</aside><h2>ما يطلب من المختص</h2><ol>${payload.reviewChecklistAr.map((t) => `<li>${esc(t)}</li>`).join("")}</ol><p>سبب الخطأ يبقى فرضية. H4 يظل من المحتوى الرياضي المتحقق مع طلب صريح؛ لا توليد حر أثناء قياس النقل المستقل.</p><h2>القراران المفتوحان</h2><ul>${payload.pendingDecisions.map((d) => `<li><code>${esc(d.id)}</code>: ${esc(d.questionAr)}<br>قرار المختص: ______</li>`).join("")}</ul><h2>الأمثلة والبدائل المقترحة — ${candidates.length} بطاقة</h2><table><thead><tr><th>المهارة / المستوى</th><th>مثال صياغة مركبة</th><th>بديل ثابت مقترح</th><th>قرار المراجع وبصمة البطاقة</th></tr></thead><tbody>${rows}</tbody></table><h2>ERR-ALG-05 / SK-ALG-06</h2><p>حجب مؤقت بموافقة المالك، دون إعادة تصنيف؛ هذه بدائل draft تنتظر اعتماد المحتوى.</p><table>${mappingRows}</table><h2>الكسور: مقترحات محجوبة — ليست توسعة للتوليد</h2><table>${special}</table><h2>العودة من النقل</h2><p>${esc(payload.transferExampleAr)}</p><p>يظهر فقط بعد تسجيل الخروج الصريح من القياس، ولا يحسب النجاح اللاحق مستقلًا.</p><h2>توثيق الاعتماد لاحقًا</h2><p>معرفات البطاقات المقبولة وبصماتها: ______<br>التعديلات المطلوبة: ______<br>اسم المراجع/الدور: ______<br>التاريخ ومرجع الموافقة: ______</p><p>يبقى كل حقل في ملف JSON بحالة pending/null إلى ورود اعتماد فعلي. نجاح اختبار برمجي لا يعتمد النص تربويًا.</p><small>بصمة الحزمة: ${pack.packSha256}<br>بصمة الشيفرة محل المراجعة: ${pack.generationSourceSha256}</small></html>\n`,
);
console.log(
  JSON.stringify({
    draftCandidates: candidates.length,
    blockedFractionCandidates: specialCases.length,
    packSha256: pack.packSha256,
    actualGeminiCalls: 0,
  }),
);
