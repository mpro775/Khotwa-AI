# تسليم PH-04 — NestJS وPostgreSQL وسلامة المحاولات

- التاريخ: 2026-11-04 / Asia/Riyadh؛ المهام **TASK-041…048**؛ الحالة **جاهز للمراجعة الفنية**، دون اعتماد GATE-1 أو تنفيذ PH-05.
- الفرع `codex/ph04-api-data`؛ HEAD الأساس `70c946cf8881ed3c8d110bc409dbc8bf42a540a6`. التنفيذ محلي في working tree، دون commit/push/merge أو نشر. تغييرات PH-02/03 السابقة ومحذوفات المالك محفوظة؛ [الجرد والبصمات](ph04-files.json) و[فحص السلامة](ph04-integrity.json).
- التفويض: أمر المالك «نفذ الان PH-04»، ثم اعتماده الصريح «أعتمد Prisma مع SQL المكمل لتنفيذ PH-04» بعد 14 فحص PoC. [DR-006](../planning/ph04-orm-decision.md)؛ لا توقيع مختص أو بوابة مستنتج.
- المراجع: AGENTS و00/01/02/09/11/12/13/15/16/17 وسجل المالك والعقد الداخلي الموجود. المتطلبات المعنية FR-001…008 و048…054، MVP-01/04/12، وحالات DATA/QA-DATA وQA-SEC المرتبطة. هذه روابط نطاق وليست إعلان اجتياز كل حالات تلك الوثائق.

## النتيجة

نُفذت عمليات bootstrap وجلسة الضيف والجلسة التعليمية وكتالوج المهارات والمسائل والمحاولات وإضافة/تحرير/حذف الخطوات عبر NestJS، بأسماء ومسارات وأغلفة OpenAPI الحالية. المتصفح لا يرسل AST موثوقًا ولا يتصل بـPython أو DB مباشرة. لا تغيير في API/JSON schema أو النطاق الرياضي أو Golden.

يحفظ الخادم HMAC لرمز ضيف opaque ذي 256 بت؛ الرمز لا يظهر في JSON أو logs. Cookie تحمل Secure/HttpOnly/SameSite=Lax وPath=/ دون Domain. bootstrap موقع ومحدود المدة، وطلبات التعديل تتطلب Origin مطابقًا وCSRF مرتبطًا بالجلسة وJSON. العمر المطلق 24 ساعة والخمول ساعتان وفق OWN-11، وتُعاد مراجعة الصلاحية داخل معاملات الكتابة. UUID وحده لا يثبت الملكية، وموارد ضيف آخر تعيد 404 دون كشف محتواها.

كل تعديل يضيف step_version ويحافظ على source_raw حرفيًا؛ الحذف منطقي ويعيد ترتيب المواقع النشطة مع احترام الفهرس الجزئي. revision يرتفع مرة واحدة في transaction، وتُزال صلاحية completion القديم. Idempotency-Key محصور بالضيف والعملية وبصمة المورد والحمولة؛ retry المتطابق يعيد بيانات النتيجة نفسها مع meta جديدة، وتغيير الحمولة يعيد 409. أثبت سباق طلبين بإصدار واحد نجاح عملية واحدة فقط.

إبطال النتائج محافظ على مستوى إصدار المحاولة كله؛ invalidatedFromPosition=1. current_verification_runs وrequireCurrentDependency يرفضان الدليل القديم بعد تعديل، بينما يبقى تاريخ الإثبات محفوظًا. نتيجة Mock متأخرة حُفظت تاريخيًا مع isCurrent=false. لا تشخيص أو تلميح أو ملخص تقدم بُني في هذه المرحلة؛ يلزم أن تستعمل مكوناتها اللاحقة بوابة السياق نفسها. currentVerification يبقى null حتى PH-05.

المحتوى المنشور فقط يظهر في الكتالوج، دون answer_spec أو حلول أو مسائل نقل/علاج غير مسندة. الترحيلات لا تنشر بنك الأسئلة المرجعي. fixtures المنشورة في الاختبار اصطناعية ومعزولة وموسومة test_fixture_not_human_review؛ ليست إجازة تربوية. إنشاء إسنادات assignment وتوليد التدريب والنقل مؤجل إلى مرحلته، والفرع غير المتاح يعيد 404.

## المهام والملفات

| المهمة | المخرج والسبب | أبرز الملفات |
|---|---|---|
| TASK-041 | Prisma مع 3 ترحيلات SQL و16 جدولًا، FK/CHECK وفهارس جزئية وقيود تاريخ/نشر وview حالية؛ rollback/replay حقيقي | apps/api/prisma، prisma.config.ts، qa/ph04-down.sql، qa/orm-poc |
| TASK-042 | جلسات وCookie وbootstrap/CSRF/Origin وملكية وانتهاء وإبطال | security.ts، business.ts، store.ts |
| TASK-043 | كتالوج منشور، pagination موقعة، فصل البيانات الآمنة عن الحلول المحجوبة | business.ts وstore.ts |
| TASK-044 | محاولات وخطوات append/edit/delete وexpectedRevision ذري | store.ts، اختبارات integration |
| TASK-045 | idempotency بمعاملة وقيد فريد وبصمات HMAC ومنع أثر مكرر | store.ts وidempotency_records |
| TASK-046 | نسخ غير قابلة للاستبدال وإبطال حالي ورفض اعتماد الرد القديم | step_versions وcurrent_verification_runs وrepository snapshot helpers |
| TASK-047 | MathGateway مضبوط المخطط/النسخ والسياق والمهلة والحجم؛ AI معطل بتعذر آمن | math-gateway.ts وai-port.ts واختبارات Mock |
| TASK-048 | DTO validation من العقد نفسه وأغلفة HTTP عربية دون تفاصيل داخلية | contracts.ts، http.ts، business.ts، integration.test.mjs |

الملفات الدقيقة وبصماتها في [ph04-files.json](ph04-files.json). تقارير المهام الفردية في agent-reports/TASK-041.md…TASK-048.md. Dockerfile ينسخ مخططات runtime وعميل Prisma، وCompose يمرر الإعدادات دون تفعيل تلقائي. أضيف فحص API وDB إلى CI؛ لم يُشغّل CI البعيد. [دليل التشغيل](../planning/ph04-local-run.md) و[الخطة](../planning/ph04-plan.md).

## الفحوص المنفذة

| الأمر/السياق | النتيجة الفعلية | الدليل |
|---|---|---|
| npm run verify:ph04 | 7 مجموعات ناجحة: contracts وformat وlint وtypecheck وbuild وtest:api وsmoke | [ph04-checks.json](ph04-checks.json) |
| npm run test:api ضمن الفحص | 29 اختبار Node ناجحًا، دون skips؛ تتكرر ضمن مجموعة الحاوية ولا تجمع كحالات مستقلة إضافية | المصدر نفسه |
| npm run smoke ضمن الفحص | 7 فحوص health/عامل الرياضيات التأسيسية ناجحة | المصدر نفسه |
| Prisma PoC منفصل | 12 فحص قيود/معاملات/سباقات/rollback + فحصان لإعادة الترحيل = 14 ناجحًا | [ph04-orm-poc.json](ph04-orm-poc.json) |
| npm run verify:ph04:container | بناء صورتي api-test وapi ناجح، ثم migrations وdown وreplay و51 اختبار Node ناجحًا، دون skips | [البناء والتشغيل الكامل](ph04-container-build.json) |
| node tools/verify-ph04-container.mjs --skip-build بعد تشديد عزل التخزين | 51 اختبارًا ناجحًا على PG بذاكرة tmpfs فقط؛ جميع أوامر التشغيل والتنظيف ناجحة | [آخر تشغيل معزول](ph04-container.json) |
| OpenAPI HTTP run | 91 استجابة مطابقة للـstatus/schema؛ تشمل 200/201/204/400/401/403/404/409/410/422/429/500 | [ph04-http-contracts.json](ph04-http-contracts.json) |
| صورة API النهائية بعد pruning | 7 فحوص ناجحة للجلسة والكتالوج والمحاولة والخطوات وحد PH-05؛ UID=1000 وroot filesystem للقراءة فقط | runtimeProof في تقرير الحاويات |
| توليد الأسرار الناقصة وCompose config --quiet وlint مستهدف | نجاح؛ المفاتيح السابقة محفوظة ولا قيم سرية مطبوعة | [ph04-final-checks.json](ph04-final-checks.json) |

البيئة: Windows PowerShell وNode v26.7.0 للفحوص المحلية؛ Linux/Node v24.11.1 وPostgreSQL 17.6 وPrisma 7.10.1 داخل Docker. اختبارات DB تنشئ شبكتها الداخلية وقاعدتها المؤقتة دون منافذ host. أزيلت حاويتا التجربة الأوليتان وvolumes التابعة لهما، وبقيت حاويات التأسيس كما كانت: [التنظيف](ph04-local-cleanup.json). لم تُطبق migrations على قاعدة Compose الأساسية أو بيئة منشورة، ولم تستخدم بيانات حقيقية.

## القيود والمراجعة المتبقية

لا إخفاق BLOCKER/HIGH معروف في نطاق الاختبارات المنفذة. هذا تسليم تقني للمراجعة وليس اعتماد إنتاج أو جودة تربوية. لم يُشغّل حمل ثقيل أو Golden كامل أو اختبارات محجوبة، ولم تُعَد اختبارات المحرك الثقيلة. لم يتغير محرر PH-02 أو يُختبر هاتف غير متاح، ولا صور واجهة جديدة لأن PH-04 لم تغيّر الواجهة.

MathGateway اختُبر بـHTTP Mocks ومهلات فعلية، وليس بدورة حكم عامة NestJS↔Python↔React؛ هذه PH-05. AI بلا مزود أو اتصال خارجي أو قوالب تعليمية تدعي المراجعة؛ غياب قالب آمن ينتج تعذر مساعدة، ولا يغيّر حكم الرياضيات. لا تنفيذ لمراحل التشخيص والتلميحات والتقدم.

اختبارات HTTP أرسلت Origin HTTPS صريحًا عبر عميل محلي وفحصت خصائص Cookie؛ لا تدعي قبول متصفح HTTPS أو نشر demo. العلم PH04_API_ENABLED يظل false في Compose التأسيسي حتى تهيئة migrations والأصل والأسرار والإعدادات. لا تعطيل لحماية Secure/Origin/CSRF. قيم bootstrap/rate/timeouts و4KiB/64KiB حدود تجربة موثقة في دليل التشغيل؛ مراجعة الأمن/QA وحدود الحافة النهائية معلقة. إبطال Cookie لا يحذف سجلات DB؛ جدولة تطهير الاحتفاظ واستعادة النسخ الاحتياطية لم تُنفّذ أو تُختبر هنا، وتبقى مطلوبة قبل بيانات حقيقية.

لم يظهر SPEC-CONFLICT أو DATASET-ISSUE جديد. حُسم اختيار ORM بأمر المالك فقط ضمن PH-04؛ مراجعة المحتوى والأمن والقبول المتخصص باقية. خطوات المراجع: فحص الترحيلات وحدود النشر، وإعادة الأمرين أعلاه، ومراجعة حالات A/B والسباق وstale، ثم تسجيل القرار البشري. **توقف التنفيذ عند PH-04 للمراجعة؛ لا اعتماد GATE-1 ولا انتقال تلقائي.**
