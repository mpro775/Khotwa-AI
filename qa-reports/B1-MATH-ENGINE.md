# تقرير تنفيذ B1 — التحقق الرياضي والتمثيل الخطي

- Task IDs: B1-01…B1-06؛ B1-T01…T07، ومعرّفات العربية وحالات MATH الحالية ذات الصلة. الفرع: `codex/intelligent-learning-a`؛ baseline commit: `f210aec`. لا commit جديد من هذا العمل.
- الحالة: **SOURCE_TESTED / REVIEW_PENDING**. هذا تقرير المكوّن التخصصي؛ لا يحل محل قبول API/Studio/UX والتكامل الذي يجمعه التقرير الرئيسي.
- الهدف: ستة أنواع نشاط محدودة للمختبر، مع الحفاظ على Python/SymPy صاحب حكم تكافؤ المعادلات، وفصل الممارسة عن القياس المستقل.
- الوثائق المراجعة: `AGENTS.md`، الرؤية والنطاق، 04 و10، العقد الداخلي الحالي، وحزمة B: 00–05، 13–17، 20، 22، 23. لا تغيير Golden أو parser أو API الرياضيات الداخلية.

## الملفات والتغيير

- `apps/api/src/stem/math-lab.ts`: اتحاد أنواع strict، عرض عام يحذف كل مفاتيح المراجعة الخاصة، وكشف منفصل بعد حدث الدعم. يشمل رسم الدالة الخطية، مقارنة طرق، تحديد أول خطأ، اختيار المبرر، إكمال الخطوة، واختبار التكافؤ.
- مولّد الرسم نفسه يزوّد الجدول والرسم بنقاط واحدة. يحسب بست منازل عشرية للمدخلات وBigInt ثابت الدقة، ثم يحوّل الناتج مرة واحدة للعرض؛ من نقطتين إلى 101 نقطة. يعالج معامل الصفر، الحلول المعدومة وغير المحدودة، والتقاطع خارج النافذة.
- التحقق الجبري يعيد استعمال `MathPort.verify/checkFinal` الأصلي؛ ليس في Node محلل معادلات أو حكم جبري بديل. يشمل مرجع requestId لكل تقرير تحقق، دون نشر الشاهد الخاص أو AST.
- أول خطأ هو أول `verified_invalid` بعد انتقالات كلها صالحة. عند syntax/unsupported/inconclusive/service_error أو عطل سابق، يعود `cannot_determine` ويتوقف دون اتهام الطالب.
- author validator يرفض دعوى طريقة صحيحة ناقصة أو خاطئة، ويتطلب `common_mistake` صريحًا للخطأ التعليمي مع نتيجة عدم تكافؤ مثبتة. المراجعة التقنية لا تمنح نشرًا أو اعتمادًا بشريًا.
- `apps/api/tests/fixtures/stem-math.v1.json`: ستة أنشطة اصطناعية `draft`، تسع حالات تحويل، وسبعة نماذج رسم؛ ليست محتوى منشورًا.
- `apps/api/tests/stem-math-lab.test.mjs`: اختبارات حدود/حجب/امتناع/مقارنة طرق/مفاتيح خاصة، ومطابقة نقاط Node مع oracle مستقل من Python Fraction.
- `services/math-engine/tests/stem_math_oracle.py` و`test_stem_math.py`: oracle محدود للاختبار فقط وحالات تستخدم محرك Python الحقيقي كما هو، دون فتح خدمة أو تشغيل كود طالب.

## الفحوص المنفذة فعليًا — Windows محلي، 2026-11-08

| الأمر | النتيجة |
|---|---|
| `npx tsc -p apps/api/tsconfig.json` | PASS؛ توليد TypeScript للمكوّنات الحالية وقت التشغيل |
| `node --test apps/api/tests/stem-math-lab.test.mjs` | PASS، 21 اختبارًا؛ oracle Python يقارن جميع نقاط النماذج السبعة |
| `$env:PYTHONPATH='services/math-engine/src'; node tools/python-task.mjs -m unittest discover -s services/math-engine/tests -p test_stem_math.py -v` | PASS، 5 اختبارات؛ تشمل 9 transitions، إتمام طريقتين، وامتناع لغة غير مدعومة |
| `npx eslint apps/api/src/stem/math-lab.ts apps/api/tests/stem-math-lab.test.mjs` | PASS |
| `npx prettier --check apps/api/src/stem/math-lab.ts apps/api/tests/stem-math-lab.test.mjs apps/api/tests/fixtures/stem-math.v1.json` | PASS |
| `node tools/python-task.mjs -m black --check services/math-engine/tests/stem_math_oracle.py services/math-engine/tests/test_stem_math.py` | PASS |
| `node tools/python-task.mjs -m pycodestyle --max-line-length=88 --ignore=E203,W503 services/math-engine/tests/stem_math_oracle.py services/math-engine/tests/test_stem_math.py` | PASS |

محاولات تطوير صُححت: typecheck الأول كشف ثلاث قراءات array محتملة undefined، ثم صححت؛ lint الأول كشف escaping زائدًا ثم صحح. تشغيل Python الأول افتقد `PYTHONPATH`؛ التشغيل الموثق أعلاه حدده ونجح. لا يُعد أي تشغيل أول فاشل نتيجة نجاح.

## أمثلة وحدود القبول

- `٣(س+٢)=٩ → ٣س+٦=٩`: `verified_valid` بالمحرك الحالي؛ `٣س+٢=٩`: `verified_invalid` مع counterexample مختلف الصدق بين مجموعتي الحلول.
- `y=2x+1` عند x=-1,0,1 يعطي y=-1,1,3. حالات الحد الأقصى ذات 101 نقطة، الكسور العشرية الدقيقة، القيم الكبيرة المسموحة، والمعامل السالب مغطاة بالـoracle.
- تظل كل نتيجة `learning_only`، حتى صحة الاختيار أو إكمال خطوة؛ سؤال القياس المستقل يتبع assessments القائمة وجدّة العائلة والمساعدة. التعليق الحر `needs_review` ولا يمنح LLM حكمًا.
- الصيغ الكسرية و`جا/جتا` ممتنع عنها في مختبر B1 ولا توسع مجال المحرك. `SK-ALG-08` والمرجع المعلق `ERR-ALG-05` لم يُغيرا.

## المتبقي والمراجعة

- لم تُشغل قاعدة بيانات أو خدمة HTTP أو Runner أو AI أو migrations أو نشر. فحوص ownership/CAS/idempotency/الاستوديو ومراجعة الرسوم وRTL تجمع في عمل التكامل الرئيسي، وليست PASS بهذا التقرير.
- يلزم اعتماد مختص حقيقي للأمثلة وrubrics قبل نشرها للمتعلمين، وقياس يدوي للأجهزة/قارئ الشاشة. الحالة **بانتظار**؛ لا توقيع منسوب للمراجعين.
- A6: الإكمال مساعدة `completion_step` في العرض؛ تكامل أحداث/جلسة A6 والأثر على التعرض مسؤولية الواجهة المشتركة، دون مخزن أو دليل إتقان موازٍ في هذا المكوّن.
- لا blocker داخلي معروف في اختبارات المكوّن المنفذة. قبول المنتج النهائي والبيانات الحقيقية لم يُمنحا.
