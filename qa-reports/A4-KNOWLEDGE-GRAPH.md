# A4 — خريطة المتطلبات ونسختها

- Task: TASK-A4-01…05؛ branch `codex/intelligent-learning-a`؛ baseline `51435ef863745a7145ee0c80927a56817cda7e67`.
- الحالة: **PARTIAL**؛ الخدمة والvalidator والفحوص جاهزة للمراجعة، وعلاقات منهجية جديدة عبر المواد غير معتمدة.
- التتبع: A-GATE-4، A-DATA-01، A-CONT-01، A-DEC-02/04/06.
- المواصفات: الحزمة 06/11/12/13/19؛ skill_prerequisites وLearningSkillMap ونسخ الدروس المنشورة الحالية.

## التغيير

`knowledge-graph.ts` يبني لقطة ذات mappingSnapshotHash من الروابط canonical ونسخ الدروس، ويكشف required cycles مع مسارها، ويحد closure بعمق وترتيب ثابت. لا ينشئ جدول حواف ينافس المصدر الموجود. قيمة قاعدة البيانات الفعلية `recommended` تقابل helpful في DTO، ولا تتحول إلى required. الحواف pending لا تستخدم كgating، والمهارة غير المختبرة لا توصف بأنها فاشلة.

`learning-path-content.ts` يمنع اعتماد/نشر track يحتوي required cycle في بيانات متطلبات الدروس؛ لا يعدّل النسخة المنشورة السابقة. `pedagogy-context.ts` يستخدم إصلاح المتطلب فقط مع دليل مستقل يحتاج مراجعة ودرس primary منشور وحالة mapping سليمة. SK-ALG-03 بلا درس primary ضمن السياق يبقى missing_coverage، حتى لو ورد ثانويًا في درس آخر. لا حافة جبر↔فيزياء جديدة مفترضة من مثال المواصفات.

GET `/api/v1/learning/knowledge-graph?trackRevisionId=` يعرض published فقط، دون drafts. اللقطات السابقة في أحداث القرار محفوظة بالبصمة؛ تغير الخريطة يبطل قبول القرار القديم. flag `KNOWLEDGE_GRAPH_A_ENABLED=false` + synthetic-only. الروابط التحريرية وواجهة PathStudio في تغيير الواجهة لدى وكيل UX.

## الفحوص والقبول

بناء TypeScript exit 0 وeslint موجه exit 0. الجولة النهائية `node --test apps/api/tests/intelligent-core.test.mjs apps/api/tests/learning-paths.test.mjs` سجلت **25/25 PASS**، وتشمل A→B→A، helpful/pending، closure depth، غياب primary، اختلاف hash، ورفض نشر track دائري. عدد الحواف المراجعة/المعلقة ليس رقمًا ثابتًا مفبركًا؛ يعاد من graph API الفعلي ويتغير حسب البنك المنشور؛ جرد البيئة الفعلي في تقرير التكامل الموحد.

التكامل PostgreSQL والواجهة المرئية ومراجعة منهجية للحواف عبر المواد لا تُنسب إلى هذا الوكيل دون دليل تشغيل قائد الدمج. لا migration لحواف جديدة؛ الرجوع بإغلاق flag دون حذف تاريخ. المراجع/التاريخ: **بانتظار**.

## دليل قائد التكامل اللاحق

شُغّل التكامل النهائي فعليًا بعد التصحيحات: **14/14 PASS، 238 استجابة HTTP** مقابل العقد، مع PostgreSQL/SymPy وقياس جديد ودورة S0→S4 وتشخيص reviewed-for-test وربط حساب وتصدير وإيقاف الوصول. الأدلة في `A-INTEGRATION.json` والتقرير التجميعي. الفحص المرئي حاول الوصول إلى Chrome وتوقف بخطأ الشهادة؛ `A-BROWSER-CHECK.md`، وليس PASS للأجهزة أو المحتوى البشري. فحوص المصدر والوحدة والتوافق العامة في `A-CHECKS.json`.
