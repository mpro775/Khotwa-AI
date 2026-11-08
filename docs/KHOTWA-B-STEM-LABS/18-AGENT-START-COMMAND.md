# أمر مباشر للوكيل البرمجي — KHOTWA AI B1–B3

أنت الوكيل المنفذ في مستودع **KHOTWA AI**. لديك تفويض لتنفيذ **المحور B فقط** كما في هذه الحزمة: **B1 مختبر الرياضيات التفاعلي + B2 مختبر الفيزياء الاستقصائي + B3 مختبر التفكير البرمجي**، مع التكامل الصحيح مع A1–A8 إن كان قد نُفذ، وإتاحة fallback آمن إذا كان بعض A لا يزال خطة.

## قبل لمس السورس

1. اقرأ `AGENTS.md` و`docs/PROJECT-DECISIONS.md` و`docs/20-LEARNING-PATHS.md` و`docs/12-API-CONTRACT.yaml` في هذا المستودع.
2. اقرأ ملفات هذه الحزمة بالترتيب من `00-START-HERE.md` إلى `24-MANUAL-STUDENT-ACCEPTANCE.md`؛ **لا تكتفِ بالعناوين**.
3. أنجز baseline يشمل git SHA وA status والمراحل المسبقة والملفات والـAPI، وسجل أي تعارض بين الحزمة وبين المصدر الفعلي.
4. افترض أن مخططات وAPI هذه الحزمة **proposal** لا تطبيقات قائمة. أعد استخدام المكونات V2.2 والعقود المالكة.

## نفذ مباشرة وفق `17-AGENT-EXECUTION-GATES.md`

- B-00 baseline، B-01 registry/content contracts/storage، B-02 B1، B-03 B2، B-04 B3 بدون Runner، B-05 Runner gated، B-06 A integration، B-07 QA/acceptance.
- اكمل شيفرة NestJS/React/Prisma/contract tests حيث يسمح المحيط، مع مراجعة مستخدم/محتوى منفصلة. لا تنتقل بين بوابات خطرة بالمجاراة؛ وثّق blocked ثم استمر في أجزاء مستقلة.
- احتفظ بأحكام Python/SymPy والفيزياء وتقييم Python في الخدمات الأصلية. **الواجهة لا تُقيّم علميًا بمصدر حقيقة خاص بها**، وLLM لا يصدر verdict.
- اعرض المحتوى المراجع والمنشور فقط؛ أغلق hidden answers والأحداث المساعدة، واحفظ ownership/idempotency/attempt revision/exposure novelty في جميع المواد.
- B3 start **non-executing**؛ لا تفعّل `PROGRAMMING_RUNNER_ENABLED` أو bridge أو Judge0 إلا بعد Gate-R وقبول أمني صريح.
- PhET **OFF** افتراضيًا؛ لا تنسخ أو تضمّن المحاكيات أو أصولها تجاريًا قبل توثيق الترخيص الساري.
- حافظ على وضع V2.2 القديم عند flags off، وعلى توافق A1–A8 إن وجدت بالفعل.

## أمان التنفيذ وعمق الاختبارات

لا تستخدم بيئة إنتاج، لا تنفذ ترحيلات على قاعدة حقيقية، لا تنشر، لا تشغل خدمات مدفوعة/مزود AI خارجي، ولا تعدّل `.env` أو مفاتيح حساسة. نفّذ unit/contract tests محددة وtypecheck/lint/format/build بقدر البيئة، وتوقف عند غياب تصريح Gate-R؛ لا ترفع الادعاءات.

## طريقة التقرير

لكل phase سلّم `qa-reports/B-XX-*.md` حسب `19-DELIVERY-REPORT-TEMPLATE.md`. التقرير النهائي `qa-reports/B-FINAL-ACCEPTANCE.md` يحتوي الملفات/commits، API/contracts changes، نتائج tests **الفعلية**، screenshots عند توفرها، قيود المحتوى، Gate-R وPhET، integrations A، والمهام اليدوية للمراجعين.

**التوقف:** بعد تقرير B-07. لا تبدأ C1…C7، ولا إنتاج/اختبار طلاب حقيقيين، إلا بأمر جديد.
