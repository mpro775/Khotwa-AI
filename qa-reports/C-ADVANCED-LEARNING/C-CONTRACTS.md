# عقد C — التوافق والحدود العامة/الخاصة

**التاريخ:** 2026-11-08. **المصدر السابق:** `6a4b6cb`. **العقد:** `1.6.0-development`؛ مسودة مصدر محلية اصطناعية، دون تصريح إطلاق.

المصدر المالك `docs/12-API-CONTRACT.yaml`، والمرآة `packages/contracts/openapi.yaml`، وأنواع وvalidators مولدة بواسطة `npm run contracts`. أضيفت 25 هوية مسار C و42 schema إلى العقد. بقيت 114 هوية مسار سابقة وكامل كائنات عملياتها دون تغيير دلالي.

الفحص القابل للإعادة `node tools/check-c-backward-compatibility.mjs` يقارن 282 schema قديمة. الاستثناءات الإضافية المصرح بها فقط:

- `LPLessonBlock` و`LPAuthorLessonBlock`: أنواع كتل C الثلاثة وحقلا `activity`, `representation` بشروط مرتبطة بالنوع.
- `AActivityAlternative`, `ANextActivityDecision`, `ALearningActivity`: الحقل الاختياري `advancedActivity`؛ نوع النشاط الموروث يبقى `guided_practice` ولا يمنح دليلًا مستقلاً.
- `AccountExportEnvelope.data.advancedLearning`: إسقاط عمل المالك والمنتجات والمراجعات العامة الآمنة؛ اختياري لحفظ التوافق.

## الهوية والإصدارات

لا تغيير في أنواع المحتوى `track|lesson`. نشاط C يملك `schemaVersion=c-activity-v1` ونوع `problem_based|project_based` وهوية `(lessonRevisionId,blockIndex)`؛ الجلسة تثبت hash الدرس المنشور. إعداد UDL `udl-representation-v1`، والتحليلات `learning-metrics-v1` مع `metricVersion=c-metrics-1.0`.

المراجع العلمية لا تعاد كتابتها: `bank_problem` يُحل عبر البنك الموروث، و`stem_lab` يشير إلى block قانوني داخل الدرس. مراحل C1 الخمس مرتبة؛ C2 يحدد معالم وrubric منشورًا لا درجات مولدة آليًا. المراجعة المفتوحة `needs_review` والتقييم المستقل يمران عبر A2.

## الفصل الأمني

`CAuthorActivity` وحده يسمح `privateEvaluation`؛ `CPublicActivity` يرفضه تمامًا. تنقيح الخادم يحذف الكائن الخاص كاملًا قبل عرض الدرس أو النشاط أو الجلسة. لا solution keys أو privateRubric أو referenceCode أو hiddenTests في DTO الطالب، التصدير أو analytics.

إغلاق schema متصفح C يبدأ من envelopes العامة فقط، ولا يحتوي `CAuthor*` أو `CPrivate*`. تم فحص ذلك باختبار فعلي. تنفذ الكتابات CSRF/Origin ومفتاح Idempotency ونطاق المالك وCAS من الآليات الموروثة، ومراجعات الاستوديو admin/content_manager محددة وموسومة `TEST_ONLY`. يبقى المعلم دون حق عام في طلاب آخرين؛ مسار cohort يرفض الطلب.

## الأوامر والأدلة

| الأمر | النتيجة المشاهدة |
|---|---|
| `npm run contracts` | PASS، توليد المرايا والأنواع وvalidators |
| `node tools/check-c-backward-compatibility.mjs` | PASS: 114 مسارًا سابقًا و282 schema، والإضافات 25 مسارًا/42 schema |
| `node --test apps/api/tests/advanced-learning-studio.test.mjs apps/api/tests/learning-paths.test.mjs apps/api/tests/stem-contracts.test.mjs` | PASS 37/37؛ جميع C schemas تُجمّع عبر AJV، وLP/B regression محفوظ |

العدّ يصف هوية path وليس عدد HTTP operations. `tools/update-c-contracts.mjs` مساعد تأليف idempotent يحافظ على أجزاء العقد السابقة، ولا يفعّل مسارات أو يشغّل ترحيلات. تغييرات المصدر والتقرير لا تمنح موافقات رياضيات/تربية/خصوصية أو قبولًا تشغيليًا. نتيجة `contracts:check` والتكامل الشامل النهائية محفوظة في `C-TESTS.json` و`C-INTEGRATION.json` لدى قائد التكامل.
