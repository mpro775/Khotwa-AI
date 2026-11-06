# DELIVERY — TASK-031

- التاريخ: 2026-11-04 / Asia/Riyadh؛ الفرع codex/ph03-math-engine، HEAD الأساس 70c946c؛ التعديلات محلية دون commit.
- الحالة: جاهز للمراجعة الفنية؛ لا قبول بشري أو GATE-1.
- الهدف: lexer عربي محدود ومحارف Unicode؛ FR-011/015/016؛ MVP-03؛ AN-001…024/030/031، GOLD-PARSE-001…040، SEC-024/025/026.
- الوثائق: AGENTS و00/01/02/04/10/12/14/15/16/17 وسجل المالك والعقد الداخلي الحالي وموافقته التصميمية.
- الملفات: services/math-engine/src/khotwa_math/lexer.py وmodel.py واختبارات services/math-engine/tests وأدلة QA المرتبطة؛ المسارات الدقيقة في [الجرد](../qa-reports/ph03-files.json).
- المنفذ: تمييز أعداد متعددة الخانات، aliases المعتمدة فقط، ورفض المحارف الخفية/الدوال/المتغيرات الغريبة مع source spans. لا NFKC أو تحويل x إلى س.
- الاختبارات الفعلية: npm run verify:ph03؛ 10 مجموعات ناجحة، 41 unittest و97 حالة Golden تطويرية، و109 أزواج schema و20 HTTP داخليًا و7 native smoke. [الأوامر والمخرجات](../qa-reports/ph03-checks.json)، [Golden](../qa-reports/ph03-golden-results.json)، [العقد](../qa-reports/ph03-contract-results.json). هذه أدلة المرحلة المشتركة وليست ادعاء أن كل حالة تخص هذه المهمة وحدها.
- فحوص الحاويات: npm run verify:ph03:container؛ 14 Compose و13 probe Linux ناجحة؛ [الأوامر](../qa-reports/ph03-container-commands.json) و[الموارد](../qa-reports/ph03-container-checks.json).
- العقود/الترحيلات/المحتوى: لم يتغير API/AST schema أو expected Golden، لا migrations أو بيانات طلاب أو نشر، ولا تنفيذ PH-04/05.
- غير المشغل: قبول 151 حالة كاملًا أو مجموعة محجوبة/مجمدة أو CI بعيد أو حمل ثقيل أو تكامل جلسات/DB/طالب. الهاتف والمحرر في PH-02 ما زالا معلقين.
- BLOCKER/HIGH: لا إخفاق نهائي معروف في الحالات المنفذة؛ مراجعة المختص وQA/الأمن لازمة قبل القبول، وحالة المسودة لا تساوي اعتمادًا علميًا.
- القرارات/المخاطر: [SEC-DEC-10 وإعداد الموارد التجريبي](../planning/ph03-resource-decision.md) pending؛ حد ذاكرة OS مثبت في Linux لا Windows. لا تشخيص من خطأ أو امتناع. لم يظهر SPEC-CONFLICT أو DATASET-ISSUE من التشغيل.
- خطوات المراجعة: إعادة الفحوص ومراجعة AST والدليل والامتناع في [تقرير المرحلة](../qa-reports/ph03-delivery.md)؛ لا انتقال تلقائي.
- حالة الاعتماد: بانتظار مالك المنتج/مختص الرياضيات/QA والأمن في مجاله؛ لا توقيع منسوب إليهم.
