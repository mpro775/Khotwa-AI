# A3 — فرضيات التشخيص وربط السؤال التأكيدي

- Task: TASK-A3-01…05؛ branch `codex/intelligent-learning-a`؛ baseline `51435ef863745a7145ee0c80927a56817cda7e67`.
- الحالة: **PARTIAL**؛ التكامل المصدري بالقوالب canonical موجود، وبعض المحتوى محجوب بقرار علمي معلّق.
- التتبع: A-GATE-3، A-SUB-01، A-COR-02/03، A-SEC-01/03، A-DEC-02/03/04.
- المواصفات: الحزمة 05/11/12/13/19؛ المصدر `diagnosis.ts` و`diagnosis-rules.ts` و`assistance.ts`، وقضية `planning/ph06-dataset-issue.md`.

## السلوك

`deep-diagnosis.ts` يعرض أسبابًا محتملة من candidates الحالية والأدلة المرتبطة، دون إصدار حكم رياضي أو نسبة يقين. الحالة المدعومة لا تظهر قبل probe answer canonical يدعمها؛ جواب لا يدعمها يجعلها unresolved. `syntax_error/unsupported/inconclusive/service_error` لا تولّد سببًا مفاهيميًا. الفيزياء wrong_unit/wrong_value وحدها تعطي unresolved/no_safe_probe، بلا اتهام بمفهوم حركة أو قانون غير مثبت.

GET `/api/v1/learning/deep-diagnosis?attemptId=` يعيد DTO محافظًا من أحدث نسخة مملوكة. POST `/api/v1/learning/deep-diagnosis/probe` يلتف على `DiagnosisService.createProbe` الأصلي، ولا ينشئ جدول إجابات موازٍ؛ الإجابة تبقى `/attempts/:id/probes/:probeId/responses`. لا ترجع private_rules_json في DTO. العرض يتطلب template وcatalog primary بحالة reviewed وتاريخ ومراجع مثبتين؛ enabled أو draft وحدهما لا يكفيان. قد يكون مراجع الاختبار اصطناعيًا موسومًا، لا موافقة بشرية. قبل إرجاع السؤال تسجل نهاية القياس الأصلي في assessment item ويزيد revision؛ يبقى probe نفسه H0 حتى لا تُكسر حراسة canonical للسؤال التأكيدي. المساعدة التعليمية الفعلية تستعمل exitMeasurement الكامل قبل الكشف.

## القرارات المعلّقة

`ERR-ALG-05/calculation_divide` محجوب في A3، دون تغيير mapping أو الحكم الأصلي. عائلة `ERR-ALG-03/balance` المتأثرة بخلاف GOLD-DIAG-015/004 تعامل review_blocked في الامتداد A3 إلى أن يراجع المختص فرق الشدة؛ لا استثناء بمعرف Golden ولا تعديل للمتوقع أو PH06. تظل دورة التوزيع متاحة في المختبر الاصطناعي. لا موافقة علمية جديدة منسوبة إلى شخص.

flag: `DEEP_DIAGNOSIS_ENABLED=false` + synthetic-only. لا LLM خارجي ولا تفسير يولد verdict.

## الدليل والحدود

TypeScript build وeslint الموجه: exit 0. الجولة النهائية ذات **25/25 PASS** تشمل المرشحات الممكنة، دعم probe مقابل عدم دعمه، رفض template غير مراجع، حالات الامتناع الخمس، القضية المعلقة، وعزل النشاط/أثر المساعدة. الاختبارات موجودة في `apps/api/tests/intelligent-core.test.mjs`؛ التكامل الحي إن شُغّل لدى قائد الدمج في التقرير الموحد. الاستوديو/Chrome/اعتماد قوالب فيزياء جديدة لم يشغلها هذا الوكيل. لا ترحيل A3 إضافي ولا تغيير Golden؛ الرجوع بإغلاق flag. حالة المراجع البشري: **بانتظار**.

## تصحيح التكامل الفعلي لمسارات التقييم

كشف التكامل الإيجابي أن path assessments تستعمل `attempt_kind=transfer`، الذي كان محجوبًا كليًا في PH06؛ لذلك لم تكن قوالب A3 المراجعة قابلة للوصول من هذه الواجهة. لم يتغير نوع المحاولة أو تاريخها. الاستثناء الجديد ضيق: `DEEP_DIAGNOSIS_ENABLED` وبيئة اصطناعية وجلسة اصطناعية وassessment item خرج صراحة من القياس، مع استبعاد أي native learning_assignment؛ المساعدة H1/H4 السابقة تظل مانعة لتشخيص H0 المستقل.

GET قبل الخروج يعرض فرضية محتملة فقط باستخدام حكم التقرير الحالي، وتحليل المدخل بالمحلل الداخلي نفسه خارج transaction، وقواعد observeTransition/contextualHypothesis الحالية، ثم يعيد فحص revision. POST هو إجراء طلب المساعدة المقصود من الطالب: يسجل item-only exit أولًا ثم يعيد التحقق بخدمة VerificationService canonical ومفتاح ثابت، ثم ينشئ probe الأصلي. لا يصبح LLM مصدر صحة، ولا يصدر المحلل حكم تكافؤ بديلًا، ولا يفتح القياس الأصلي أو native transfer. لا يكرر A1 سؤالًا أجيب عنه.

الأمر المنفذ بعد التصحيح: `node --test apps/api/tests/intelligent-core.test.mjs apps/api/tests/diagnosis.test.mjs apps/api/tests/learning-paths.test.mjs`، النتيجة **35/35 PASS**، مع build TypeScript exit 0. يشمل ذلك 16 اختبار A، و7 اختبارات PH06 الأصلية، و12 اختبار V2.2. نتيجة التكامل الإيجابي الفعلية اللاحقة تُوثق في تقرير قائد الدمج، ولا تُفترض من هذه الاختبارات.

## دليل قائد التكامل اللاحق

شُغّل التكامل النهائي فعليًا بعد التصحيحات: **14/14 PASS، 238 استجابة HTTP** مقابل العقد، مع PostgreSQL/SymPy وقياس جديد ودورة S0→S4 وتشخيص reviewed-for-test وربط حساب وتصدير وإيقاف الوصول. الأدلة في `A-INTEGRATION.json` والتقرير التجميعي. الفحص المرئي حاول الوصول إلى Chrome وتوقف بخطأ الشهادة؛ `A-BROWSER-CHECK.md`، وليس PASS للأجهزة أو المحتوى البشري. فحوص المصدر والوحدة والتوافق العامة في `A-CHECKS.json`.
