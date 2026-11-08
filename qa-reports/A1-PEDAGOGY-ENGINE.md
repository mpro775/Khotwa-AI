# A1 — محرك القرار التعليمي

- Task: TASK-A1-01…05؛ الفرع `codex/intelligent-learning-a`؛ baseline `51435ef863745a7145ee0c80927a56817cda7e67`؛ لا commit فرعي مستقل.
- الحالة: **PARTIAL**؛ السورس والفحوص الموجهة متاحة للمراجعة، والمحتوى/القبول التشغيلي النهائي لا يمنحه هذا التقرير.
- التتبع: A-GATE-1، A-SEC-01/03، A-NOV-01/02، A-IDM-01، A-COR-01/03، FR-029…042، MVP-07…14 بحدود الامتداد المصرح.
- المواصفات: الحزمة 01/02/03/11/12/13/14/19، AGENTS، وعقود التقييم/المحتوى الحالية.

## التغيير

`apps/api/src/pedagogy-engine.ts` سياسة حتمية مستقلة: ترتيب probe ثم إصلاح المتطلب المثبت ثم الاسترجاع المستحق ثم تقليل الدعم/فحص مستقل، مع tie-break ثابت ورفض المحتوى غير المنشور/غير المراجع/المعلّق والأسئلة المعروضة والبرمجة التنفيذية. `pedagogy-context.ts` يجمع سياق المالك دون استدعاء track/lesson اللذين يسجلان التعرض؛ لا يعيد بنك القياس في DTO.

`intelligent-learning.ts` يربط القرار بسجل حالة/أحداث PostgreSQL المشترك، ويحمي القبول بـidempotency وCAS والملكية ومقارنة بصمات الأدلة والخريطة والتعرضات والإصدارات، مع صلاحية تجريبية versioned مدتها 15 دقيقة وcooldown تجريبي 60 ثانية. لا تمثل هذه القيم معايرة تربوية. قبول متكرر يعيد النشاط نفسه؛ بدء القياس يعيد استخدام AssessmentService بمفتاح مشتق ثابت. تظل توصية V2.2 السابقة دون تغيير.

المسارات: GET next-activity، POST activities/accept، GET activities/:id، POST activities/:id/start-assessment تحت `/api/v1/learning`. عقدها المشترك وOpenAPI والترحيل الإضافي لدى قائد الدمج. flag: `PEDAGOGY_ENGINE_ENABLED=false` افتراضيًا؛ حاجز اصطناعي خادمي مستقل.

## دليل الفحص

- `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json`: exit 0 في بيئة Windows/Node الحالية.
- `node --test apps/api/tests/intelligent-core.test.mjs apps/api/tests/learning-paths.test.mjs`: الجولة النهائية **25/25 PASS** بعد إضافة منع تجاوز flags من المسار القديم والحواجز الأخيرة؛ 13 حالة A و12 حالة توافق V2.2.
- `node node_modules/eslint/bin/eslint.js apps/api/src/pedagogy-engine.ts apps/api/src/mastery-model.ts apps/api/src/deep-diagnosis.ts apps/api/src/knowledge-graph.ts apps/api/src/pedagogy-context.ts apps/api/src/intelligent-learning.ts apps/api/src/learning-assessments.ts apps/api/src/learning-path-content.ts apps/api/tests/intelligent-core.test.mjs`: exit 0.
- اختبار A1 يحتوي مصفوفة 12 سياقًا اصطناعيًا، وحالة stale/resume، وقراءة مورد لا يخص المالك. لا يُعرض ذلك كتجربة مستخدمين حقيقيين.
- التكامل PostgreSQL/SymPy/HTTP، وواجهة Chrome: أدلتهما إن شُغّلا في تقرير قائد الدمج؛ لم يشغلهما وكيل A1 منفردًا.

## المتبقي والرجوع

تدقيق لاحق: أُصلحت فجوة جِدة عند إعادة استعمال سؤال ظهر كتدريب في درس آخر. القراءة الصريحة للدرس تسجل تعرضات مراجع التدريب المعروضة فقط، والروابط inline من worked_example_ref، دون سؤال القياس المخفي. contamination يراعي زمن الكشف من lesson_viewed كي يبقى النجاح المستقل السابق له تاريخيًا صحيحًا. أضيف اختباران؛ أحدث جولة موجهة **27/27 PASS**، وtypecheck وlint الموجه بعدها exit 0.

لا نشر أو AI خارجي أو Runner أو تطبيق migration على بيانات قائمة. المحتوى والتوقيت النهائي والمراجعة البشرية بانتظار أصحابها. الرجوع بإغلاق flag دون مسح القرارات أو الأحداث. حالة اعتماد المجال: **بانتظار**؛ لا توقيع بشري منسوب.

## دليل قائد التكامل اللاحق

شُغّل التكامل النهائي فعليًا بعد التصحيحات: **14/14 PASS، 238 استجابة HTTP** مقابل العقد، مع PostgreSQL/SymPy وقياس جديد ودورة S0→S4 وتشخيص reviewed-for-test وربط حساب وتصدير وإيقاف الوصول. الأدلة في `A-INTEGRATION.json` والتقرير التجميعي. الفحص المرئي حاول الوصول إلى Chrome وتوقف بخطأ الشهادة؛ `A-BROWSER-CHECK.md`، وليس PASS للأجهزة أو المحتوى البشري. فحوص المصدر والوحدة والتوافق العامة في `A-CHECKS.json`.
