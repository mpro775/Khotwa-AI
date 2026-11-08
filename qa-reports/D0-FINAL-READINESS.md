# D0 — التقرير النهائي للجاهزية والقبول

- Task: D0-01…11. التاريخ: 2026-11-08 — Asia/Riyadh.
- الطلب: «نفذ هذا كاملاً» لملف `docs/Khotwa_Plans_A_B_C_D0_REBUILT/README-START-HERE.md` الذي يحدد D0 التالية، وA/B/C مراجع منفذة. نفذ العمل التقني والتوثيقي لـD0 فقط؛ لا D1/D2 أو إعادة بناء A/B/C.
- الفرع: `codex/d0-readiness`؛ baseline HEAD=`726adf6c7e6fd6183f9983e6ec0cfbf6031582cb`. التغييرات في working tree، دون commit/push/دمج/نشر جديد.
- الحالة: **D0_ENGINEERING_DELIVERABLES_READY_FOR_REVIEW / REAL_LEARNER_RELEASE_NOT_READY / HUMAN_ACCEPTANCE_PENDING**. اكتمال حزمة D0 للمراجعة لا يعني إغلاق الموانع البشرية أو اعتماد تجميد commit أو تشغيل حقيقي.

## النتيجة حسب نوع الدليل

| المجال          | الحالة                                                      | ما يثبته الدليل وما بقي                                                                                                      |
| --------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| SOURCE          | SOURCE_SNAPSHOT_READY_FOR_REVIEW                            | A/B/C موجودة ومحفوظة في Git؛ إصلاح أدوات الاختبار والتدقيق فقط، وmanifest مطابق للبايتات؛ اعتماد تجميد commit النهائي للمالك |
| AUTOMATED_TESTS | PASS_TARGETED_SYNTHETIC                                     | نتائج D0 الجديدة مبينة أدناه؛ لا نقل أعداد التاريخ إلى الجولة الحالية، ولا ادعاء تشغيل Golden الشامل                         |
| HUMAN_REVIEW    | PENDING                                                     | قرارات GOLD-DIAG-015 وERR05/SK06 وSK08 والمراجعات العلمية/التربوية وUDL/المقاييس لم تُوقع هنا                                |
| MANUAL_UI       | NOT_RUN                                                     | رحلة عربية محددة وخطة 12 فحصًا متاحة؛ لم يُشغّل Chrome تفاعلي أو هاتف/قارئ شاشة/zoom/slow network في D0                      |
| SECURITY        | TARGETED_AUTOMATION_PASS / RELEASE_REVIEW_PENDING           | ملكية/جلسة/replay/claim/export/delete/purge ضمن اختبارات اصطناعية؛ ليست مراجعة اختراق أو موافقة أمنية أو قبول تصميم real     |
| CONTENT         | DRAFT_TEST_ONLY / COMPLETE_UNIT_BLOCKED                     | 18 درسًا و76 مسودة سؤال و6 أنشطة C؛ C الجبرية الحالية SK07 لا وحدة توزيع SK04 مكتملة؛ لا اعتماد محتوى مختلق                  |
| STAGING         | NEW_TEST_DATABASES_ONLY / EXISTING_DATABASE_UPGRADE_NOT_RUN | ترحيلات على قواعد اختبار جديدة وbackup/restore داخل حاوية C فقط؛ لا نسخة من قاعدة قائمة أو بيئة المستخدم                     |
| REAL_BETA       | BLOCKED_NOT_ENABLED                                         | الحراس الاصطناعيون والأعلام الافتراضية كما هي؛ تصميم قناة real والسياسات وطلبات القرار جاهزة للمراجعة، دون تفعيل             |

## التسليمات المطلوبة

| الملف                                                        | ما أُنجز                                                                                                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [D0-RELEASE-INTEGRITY.md](D0-RELEASE-INTEGRITY.md)           | حالة Git وتفسير اختلاف ZIP غير المتكرر، CRLF في Prisma، مراجعة تغييرات الأدوات، BOM وبيان المصدر والأدلة                                                    |
| [D0-BLOCKERS-AND-OWNERS.md](D0-BLOCKERS-AND-OWNERS.md)       | D0-01…11 بمالكي أدوار ودليل إغلاق؛ قرارات الرياضيات والكسور والمحتوى والقياس منفصلة                                                                         |
| [D0-REAL-LEARNING-DESIGN.md](D0-REAL-LEARNING-DESIGN.md)     | أدلة authorizeA/requireAdvancedIdentity/TEST_ONLY؛ قناة مستقلة مقترحة، provenance ومراجعات حقيقية وسياسات/RBAC وstaging؛ 14 حالة قبول و5 طلبات قرار PENDING |
| [D0-MANUAL-ACCEPTANCE-PLAN.md](D0-MANUAL-ACCEPTANCE-PLAN.md) | رحلة ALG-L04 مع تشخيص/تلميح وC1…C5 الفعلية كأنشطة مجاورة، UUIDs ومقامات منفصلة وnovelty؛ 12 فحصًا موثقًا NOT_RUN                                            |
| هذا التقرير و[manifest](D0-RELEASE-MANIFEST.json)            | حالة نهائية منفصلة حسب المجال، وأدلة جديدة قابلة لإعادة التحقق                                                                                              |

## الفحوص المنفذة فعليًا

Windows، Node26.7.0، npm11.17.0، Python3.14.3، Docker29.9.1 عبر Docker Desktop المحلي `desktop-linux`؛ PostgreSQL17.6 وصورة SymPy المحلية بربط المصدر الحالي read-only. نسخ الصور وبصماتها في [environment.json](D0-evidence/environment.json). بيانات اصطناعية وحسابات TEST_ONLY فقط، دون اتصال بمزود AI أو SMTP أو Runner أو PhET أو بيانات أشخاص.

| الأمر المنفذ من جذر المستودع                                                                                                         | النتيجة                                                                                      | الدليل الجديد                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:intelligent`                                                                                                           | PASS؛ 66/66، 0 skipped                                                                       | [source-A.log](D0-evidence/source-A.log)                                                                                                             |
| `npm run test:labs`                                                                                                                  | PASS؛ 74/74، 0 skipped                                                                       | [source-B.log](D0-evidence/source-B.log)                                                                                                             |
| `npm run test:advanced`                                                                                                              | PASS؛ 58/58، 0 skipped                                                                       | [source-C.log](D0-evidence/source-C.log)                                                                                                             |
| `node --test` على اختبارات انحدار V2.2/الحسابات/المحتوى/الأمن/MathGateway/التشخيص/التلميحات                                          | PASS؛ 114/114، 0 skipped؛ أسماء الملفات الكاملة في ملخص التشغيل                              | [source-regression.log](D0-evidence/source-regression.log)                                                                                           |
| `node --test tools/tests/d0-release-integrity.test.mjs tools/tests/integration-test-options.test.mjs`                                | PASS؛ 7/7، تشمل منع الأسرار ومسارات غير آمنة وكشف تغير الجرد وWindows casing والتنظيف الفاشل | [d0-tools-tests.log](D0-evidence/d0-tools-tests.log)                                                                                                 |
| `node tools/python-task.mjs -X utf8 -m unittest discover -s services/math-engine/tests -p test_stem_math.py -v` مع PYTHONPATH للمصدر | PASS؛ 5/5                                                                                    | [python-B.log](D0-evidence/python-B.log)                                                                                                             |
| `npm run test:intelligent:integration -- --report-dir qa-reports/D0-evidence`                                                        | PASS؛ 14/14، وفحص 238 استجابة HTTP بالعقد                                                    | [A-INTEGRATION.json](D0-evidence/A-INTEGRATION.json)                                                                                                 |
| `npm run test:labs:integration -- --report-dir qa-reports/D0-evidence`                                                               | PASS؛ 15/15                                                                                  | [B-INTEGRATION.json](D0-evidence/B-INTEGRATION.json)                                                                                                 |
| `npm run test:advanced:integration -- --report-dir qa-reports/D0-evidence`                                                           | PASS؛ 15/15 وbackup/restore إلى قاعدة جديدة داخل الحاوية؛ counts=`10:6:2` قبل/بعد            | [C-INTEGRATION.json](D0-evidence/C-INTEGRATION.json)                                                                                                 |
| `npm run contracts:check`، `npm run typecheck`، `npm run build`                                                                      | PASS؛ pyright صفر أخطاء/تحذيرات؛ تحذير Vite لحجم chunks مسجل ولم ترفع عتبته                  | [quality-checks.json](D0-evidence/quality-checks.json)                                                                                               |
| `node tools/check-c-backward-compatibility.mjs`                                                                                      | PASS؛ حفظ 114 مسارًا و282 مخططًا قديمًا مع إضافات C المعتمدة في المصدر                       | [contract-compatibility.log](D0-evidence/contract-compatibility.log)                                                                                 |
| ESLint للأدوات السبعة المتأثرة؛ Prettier لها؛ `git diff --check`                                                                     | PASS؛ فحص Markdown الجديد صريح مع تجاوز قائمة التجاهل للتقارير فقط                           | [lint.log](D0-evidence/lint.log) و[format-check.log](D0-evidence/format-check.log) و[reports-format-check.log](D0-evidence/reports-format-check.log) |
| `node tools/d0-release-integrity.mjs --record` ثم `--check`                                                                          | PASS؛ snapshot متطابق للمصدر والأدلة والمراجع؛ ليس اعتماد تجميد أو إطلاق                     | [بيان الإصدار](D0-RELEASE-MANIFEST.json)                                                                                                             |

اختبارات المصدر الأصلية والانحدار = **312/312**؛ أدوات D0 = **7/7** إضافية، أي **319/319 Node source/unit/regression**. Python **5/5** منفصل، والتكامل **44/44** عبر A/B/C. لا تجمع تشغيل A الأول وإعادته بعد إصلاح casing، ولا تحسب test الأب مرتين فوق ما يخرجه Node. جميع النتائج التفصيلية والأوامر وexit codes في [check-summary.json](D0-evidence/check-summary.json).

تكامل A/B/C يمر عبر NestJS/PostgreSQL ومحرك المجال الفعلي. ترحيلات السلسلة الـ24 تطبق داخل قواعد أنشأتها الأدوات لهذه الجولة وحدها، مع أسماء عشوائية وtmpfs ومنافذ loopback. قاعدة C المستعادة جديدة داخل نفس الحاوية. لم تُطبق migrations على قاعدة المستخدم أو staging قائمة، ولم يتغير Golden أو أسماء API أو خيارات خدمة خارجية.

## الإصلاحات والتحقق من حدودها

حفظت الأدوات نتائجها الجديدة تحت `D0-evidence` بدل الكتابة فوق تقارير A/B/C. أضيف منع تنزيل الصور، مهلات A، فصل البيئة الموروثة وإغلاق الخدمات الحساسة، وتنظيف يسجل النتيجة الحقيقية. كشف اختبار Windows بمفاتيح وهمية أن المطابقة الحساسة لحالة الأحرف تترك أسماء credentials مختلطة الحالة؛ عولجت الأسماء بصورتها canonical واختبرت داخل child Node. أعيد تكامل A بعد هذا التغيير، وحفظ تشغيله الأول في ملفات `*-before-casing` دون جمع أعداده.

أضيفت أداة جرد قابلة للإعادة مع اختبارات لكشف التغير والإضافة والحذف ومنع المسارات الخاصة. مراجعة مستقلة أضافت مراجع التسليم التاريخية إلى الجرد، حتى لا يفشل التدقيق في اكتشاف تعديل مرجع استندت إليه D0. مراجعة ثانية صححت خطة UI لتستخدم revision تدريب موجودًا وتطلب trackRevisionId الصحيح لكل مسار C5، مع فصل SK04 عن SK07؛ لا fixtures أو mapping معدلة لتجميل التغطية.

## ما لم يُشغّل وما بقي

- قبول Chrome/الهاتف/التكبير/لوحة المفاتيح/قارئ الشاشة والشبكة البطيئة: **NOT_RUN**؛ المطلوب في D0 خطة موثقة، لا PASS من SSR. لا تجاوز لشهادة أو إعداد أمان متصفح.
- Golden الشامل/تسوية GOLD-DIAG-015 أو ERR05/SK06 وSK08: **NOT_RUN/PENDING_DOMAIN_DECISION**؛ لا expected تغيّر أو استثناء صامت. نجاح انحدار diagnosis المصدر لا يعني تطابق كل Golden أو موافقة المختص.
- مراجعات المحتوى والفيزياء/البرمجة والتربية/UDL/المقاييس والأمن/الخصوصية والقاصرين: **PENDING**. الأدوار المطلوبة لا تعني تعيين شخص أو توقيعًا باسمه.
- ترقية staging من نسخة قاعدة قائمة وbackup/restore لها بصلاحيات التشغيل: **NOT_RUN**، وتحتاج البيئة والتفويض المخصصين. اختبار قاعدة جديدة لا يغلق D0-08.
- REAL_BETA وGemini وRunner/PhET وcohort/uploads واختبارات أثر التعلم والحمل: **NOT_RUN/OFF**. لا بيانات متعلم حقيقي ولا ادعاء تحسن أو إتقان بشري من fixtures.
- تجميد commit نهائي ومراجعة manifest: **PENDING_OWNER_REVIEW**؛ لا commit أو push مأذون مستنتج من نجاح الفحص. تغير المصدر/الأدلة لاحقًا يستلزم جردًا وإعادة فحص ما تأثر.

لا BLOCKER/HIGH جديد معروف في أدوات D0 بعد الفحوص المحددة؛ **موانع الإطلاق الحقيقي القائمة لم تغلق**. المخاطر الباقية محددة بأصحاب أدوار وأدلة إغلاق في سجل الموانع، خصوصًا المحتوى غير المكتمل وتغيير provenance/الحراس أو خلط TEST_ONLY بالاعتماد. التراجع مصدر أدوات فقط ولا يتطلب حذف بيانات أو ترحيلًا عكسيًا.

## المراجع والاعتماد

المراجع المقروءة: `AGENTS.md` كاملًا، الرؤية `00` والنطاق `02` وسجل المالك وخطة `17`، متطلبات PRD وفحوص `15` ذات الصلة، عقد `12` والأمن `16` ووثائق A/B/C المالكة للتأليف والحالات والتحليلات والخصوصية، تقارير قبول A/B/C وmanifest C، جرد V2.2 وقائمة مراجعة مراد، رحلة C23 وملفا D0. الربط الأساسي: `MVP-12/13/14` و`FR-048…054`، مع FR/MVP التعليمية وفحوص AN/MATH/SEC/UX المرتبطة في تقارير المجال.

الملفات المتغيرة وأسبابها والقيود والتراجع موثقة في تقرير السلامة؛ العقود/الترحيلات/المحتوى لم تتغير. مراجعة المالك وقائد التكامل وQA والمادة/التربية والأمن/الخصوصية/الإتاحة: **بانتظار**. المخرج التالي مراجعة هذه الحزمة وتعيين أصحاب القرارات؛ لا تفعيل تلقائي أو تنفيذ D1 بعد هذا التقرير.
