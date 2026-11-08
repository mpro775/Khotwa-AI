# تقرير تسليم برنامج التعلم الذكي A1–A8

- Task IDs: TASK-A-00، TASK-A1…A8-01…05، TASK-A-FINAL.
- الفرع: codex/intelligent-learning-a؛ baseline: 51435ef863745a7145ee0c80927a56817cda7e67؛ النتيجة في working tree، دون commit أو push أو merge.
- التاريخ: 2026-11-08؛ Windows / v26.7.0، بيانات اصطناعية فقط.
- الحالة: **جاهز للمراجعة المصدرية — PASS تقني محلي، PARTIAL للقبول النهائي**. فحص Chrome محجوب بالشهادة، والمحتوى/العتبات والإطلاق تحتاج مراجعاتها البشرية المستقلة.
- النطاق المأذون: تنفيذ الحزمة كاملة فوق V2.2، دون تفعيل تعلم حقيقي أو AI خارجي أو Runner أو نشر. لم يبدأ B/C أو إصدار آخر.
- المرجع المصدر: طلب المستخدم «نفذ هذا المطلوب كاملا» مع الحزمة ذات 21 ملفًا؛ المراجع المالكة AGENTS.md والرؤية والنطاق وPROJECT-DECISIONS و04…16 و20، وسجل الامتداد docs/21-INTELLIGENT-LEARNING-A.md.
- بصمة المصدر: 2b05427486a731592620c8f0cad9eceb6c8ccbd65f58f320f9e84fe6e26291cb؛ التفاصيل في A-RELEASE-CANDIDATE.json. Golden الأصلي مطابق بايتًا للبداية في الملفين.

## ما نُفذ

| المرحلة | المصدر والسلوك الفعلي | الدليل |
|---|---|---|
| A1 | pedagogy-engine/context وintelligent-learning: نشاط حتمي بسبب وبدائل، صلاحية وبصمة، قبول مملوك/CAS/idempotency، بديل no_safe_activity، استمرار V2.2 | A1-PEDAGOGY-ENGINE.md؛ قواعد 12 سياقًا واختبارات HTTP |
| A2 | mastery-model مشتق من تقارير حالية؛ تعرض/دعم/استقلال/نقل حقيقي/احتفاظ/جودة أدلة، دون نسبة إتقان أو دليل من الثقة الذاتية | A2-MASTERY-MODEL.md؛ استقلالان حقيقيان وتغير المساعدة/النسخة |
| A3 | أسباب ممكنة وقوالب reviewed، canonical probe/answer بعد خروج القياس؛ الحُكم الأصلي باقٍ، وقياس النقل الأصلي والقضايا المعلقة محجوبة | A3-DEEP-DIAGNOSIS.md؛ خطأ توزيع→فرضية→probe→دليل داعم في PostgreSQL/SymPy |
| A4 | رسم بإصدارات/بصمة، required مقابل helpful، كشف دورات عند النشر، نقص primary coverage وmappingPending صريحان | A4-KNOWLEDGE-GRAPH.md؛ اختبارات دورة/علاقات/روابط |
| A5 | schedule/due/start/defer/finish بحالة محفوظة وتوقيت خادمي، فواصل تجريبية ذات نسخ، إعادة فحص دليل الإرساء ونتائج المراجعة الحالية | A5-RETRIEVAL-SPACING.md؛ fake-clock أيام 0/1/3/7/14 وجدولة وتأجيل HTTP |
| A6 | مثال واحد بمعادلته، كشف متدرج وسجل دعم، S0→S4 ومحاولات native جديدة، خروج القياس قبل الدعم | A6-SCAFFOLDING.md؛ دورة فعلية بأربع جلسات وأربع مسائل مستقلة متمايزة |
| A7 | حوار offline محدود، يتكيف مع حكم المحرك الحالي فقط، تأكيد H4، safe_handoff عند غياب الحل، استئناف وعزل ورفض stale | A7-SOCRATIC-TUTOR.md؛ H4 محلي وخروج من قياس فعلي قبل tutor |
| A8 | هدف قابل للتعديل، checkin من أدلة جديدة فقط، predict/monitor/reflect اختياري، مقارنة بالحكم الحالي مع منع stale | A8-METACOGNITION.md؛ HTTP goal/edit/predict/reflect/claim/export/deletion |

واجهة React مدمجة في LearningPaths وLessonRenderer وPathStudio، مع decoders محددة، استئناف بمراجع خادمية، وRTL/اتجاه الكود وفق المكونات القائمة. الأعلام مستقلة وتبقى القيم الافتراضية مغلقة. تقرير الواجهة A-UI.md؛ نجاح SSR/decoders ليس ادعاء فحص مرئي.

## العقود والبيانات والحماية

- عقد OpenAPI 1.4.0-development، DTOs مشتركة وعقود مولدة ومرايا متطابقة. التدقيق الدلالي أبقى **83 مسارًا قديمًا** دون تغيير؛ توسعات schema الأربع الصريحة: ErrorDetail وAccountExportEnvelope وLPAssessmentKind وLPLessonBlock.
- الترحيل 0023 إضافي: intelligent_learning_records/events، ملكية وparent مملوك وCAS وتاريخ، unique لقبول القرار ومراجعة دليل الإرساء، فهارس، ونوعا independent_check/retrieval_review. ليس مخزن صحة أو إتقان جديدًا.
- طُبق على قاعدة Docker مؤقتة جديدة للاختبار فقط ضمن سلسلة 22 ترحيلًا. لم يطبق على قاعدة عرض قائمة أو إنتاج. أداة الاختبار أزالت حاوياتها فقط؛ لم تمس خدمات العرض القائمة.
- CSRF/Origin وجلسة المالك والموافقة القائمة خادمية. اختُبر الطالب الثاني، التكرار والحمولة المختلفة والإصدارات القديمة. حارس اصطناعي إضافي يمنع تشغيل A على بيانات حقيقية حتى من endpoints التقييم القديمة.
- claim نقل السجلات والأحداث atomically إلى الحساب، وexport أعاد بيانات التخطيط الخاصة فقط دون snapshots أو baseline خاص. طلب الحذف أوقف الوصول مع حفظ السجلات لحين سياسة الاحتفاظ القائمة؛ لم ندّع محوًا فوريًا أو تغييرًا في المدة.
- التعرض لتمرين من درس آخر يحجب هويته/عائلته/معادلته زمنيًا عن قياس لاحق، دون إعادة وصف نتيجة مستقلة سبقت التعرض. لا كشف لحلول/اختبارات hidden في DTO الطالب.

## الفحوص المنفذة

| الأمر | النتيجة المرصودة | الدليل |
|---|---|---|
| node tools/check-intelligent-learning.mjs | contracts/format/lint/typecheck/build PASS، وتدقيق توافق دلالي PASS، **66/66 اختبارات** | A-CHECKS.json |
| node --test apps/api/tests/diagnosis.test.mjs apps/api/tests/tutoring.test.mjs | **17/17 PASS**؛ حراسة النقل/H4 وAI-off الأصلية | A-LEGACY-REGRESSION.json |
| node tools/test-learning-paths.mjs --intelligent-learning | **14/14 PASS**؛ **238 استجابة HTTP** تحققها AJV مقابل العقد، NestJS/PostgreSQL17.6/SymPy فعلي | A-INTEGRATION.json |
| tsc -p apps/api/tsconfig.json ثم التكامل أعلاه؛ eslint intelligent-learning.ts وgit diff --check | exit 0 بعد إسقاط حالة النشاط/المساعدة من التقييم الأصلي | آخر تحقق تكاملي؛ لا دفتر درجات موازٍ |
| محاولة Chrome على preview اصطناعي | BLOCKED_CERTIFICATE: ERR_CERT_AUTHORITY_INVALID | A-BROWSER-CHECK.md |

الجولات الأولى كشفت عيوبًا موثقة في A-INTEGRATION-first/run3/run4.json: فلتر main/transfer، توافق math_example، منفذ تجريبي عشوائي محجوب، وحارس A3 القديم. صُححت في المصدر/المختبر وأعيد الاختبار؛ النتيجة الحالية الناجحة منفصلة عن آثار الفشل. لا تعديل expected/Golden لإخفاء الفشل.

لم تُشغل اختبارات حمل، أو هاتف/قارئ شاشة فعلي، أو تجربة أثر تعليمي بطلاب حقيقيين، أو AI خارجي، أو Runner. فواصل المراجعة ليست إثبات فعالية، والاختبارات الاصطناعية ليست موافقة مختص مادة. فحص purge الخاص بجداول A/استعادة backup في بيئة تشغيل واعتماد المحتوى والمخاطر التشغيلية يبقى قبل إطلاق حقيقي.

## العوائق والقرارات والتراجع

- A-DEC-02/05: مراجعة محتوى A3/A4/A6/A7 والعتبات/الفواصل لم تحصل تلقائيًا. مواد reviewed-for-test تحمل دور اختبار اصطناعي، لا توقيع شخص.
- GOLD-DIAG-015 وERR-ALG-05/SK06 باقية؛ الجزء المتأثر review_blocked. A-SPEC-CONFLICTS.md يصف المواءمة دون إسقاط القضايا العلمية.
- فحص المتصفح لم يصل للواجهة بسبب الشهادة. [مهارة computer-use](C:/Users/PC/.codex/plugins/cache/openai-bundled/computer-use/26.1023.51421/skills/computer-use/SKILL.md) و[سياسة التأكيد](C:/Users/PC/.codex/plugins/cache/openai-bundled/computer-use/26.1023.51421/docs/confirmations.md) تضع “Bypass Windows/browser/web safety barriers” ضمن Hand-Off Required؛ معالجة ثقة الشهادة محليًا عمل صاحب الجهاز، ولم تُتجاوز آليًا.
- لا BLOCKER مصدري معروف متبقٍ من الفحوص المسجلة؛ ليست شهادة أمان/تعليم أو قبول إنتاجي. حالة اعتماد المالك/مختص المادة/QA/الأمن: **بانتظار**.
- التراجع: إغلاق أعلام A1…A8 يعيد واجهة V2.2 دون حذف سجل أو تعرض أو أدلة. لا rollback هدام أو drop أو migrations على بيئة قائمة.

**DONE — STOP عند A8.** المصدر والعقود والاختبارات والتقارير سلمت للمراجعة؛ لا نشر أو تشغيل بيانات حقيقية مستنتج من هذا التقرير.
