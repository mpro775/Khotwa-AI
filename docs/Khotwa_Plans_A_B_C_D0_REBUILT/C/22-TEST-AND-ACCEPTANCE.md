# 22 — خطة الاختبارات وبوابات القبول C1–C5

## مبدأ
لا يُعتبر «تنفيذ الملفات» نجاحًا. لكل مرحلة: parser→schema→API→state→UX→accessibility→role/security→full integration→pedagogical review. اعتمد test doubles للقسم السريع، وتحقق HTTP/DB/SymPy ببيئة اختبار **مؤقتة فقط وبعد إذن التشغيل**. كل تقرير يميز `PASS_TESTED`, `BLOCKED_GATE`, `NOT_RUN`, `PARTIAL`, `FAILED`.

## C1 Golden
- مشكلة واقعية لا تصرح بالقانون؛ استخراج المعطيات والخطة ثم تجربة استراتيجية صحيحة بديلة.
- أول خطأ مضبوط مقابل احتمال سوء الفهم؛ لا تشخيص مفترض بدون probe.
- نتيجة رياضيات صحيحة بحل مختلف، مسألة فيزياء وحدة خاطئة، كود Parsons غير تنفيذي؛ `unsupported`/`service_error` لا يحسبان خطأ طالب.
- reveal/hint يجعل النشاط بمساعدة؛ لا evidence مستقل من نفس عائلة السؤال حتى لو أعاد الإجابة.
- project/lesson revision pinned، محاولة student GET للمسودة أو حل سري تفشل.

## C2 Golden
- إنشاء مشروع، ثلاثة milestones، artifacts سابقة ولاحقة، طلب مراجعة، rubric reviewer، تعديل موثق، إصدار نهائي.
- Rubric مفتوح غير قابل للحكم الآلي -> `needs_human_review` لا درجة حاسمة مولدة.
- مشروع متعدد مهارات، تعثر في prerequisite مع استكمال عمله دون لوم؛ غياب cross-subject graph لا يفعّل ربطاً زائفًا.
- نقل guest→account، حذف/تصدير، حفظ حين يعود المستخدم، 2 concurrent reviewers، duplicate POST، late feedback.

## C3 Accessibility
- Keyboard only للبطاقات، إجراءات المشروع، اختيار تمثيل، Parsons، المحاكاة B2؛ مؤشرات focus وlabels وأخطاء نماذج.
- Mobile ضيق + zoom 200% و400% حيث ينطبق، Dark/Light، reduced motion، RTL Arabic plus LTR Python، وصف بديل للرسم البياني والجدول.
- اختبار screen reader يدوي (NVDA/VoiceOver إن تيسر) بنتيجة موقعة، لا ادعاء بناءً على SSR فقط.
- طالبة/طالب يعطل الصور أو يفقد الشبكة: بديل النص لا يحوّل هذا إلى فشل معرفي.

## C4 Content Workflow
- strict schema/enum/revisionRefs/private fields؛ editor preview لا يكتب student evidence.
- صلاحيات teacher/content_manager/admin؛ `approve/publish/archive` admin وفق المصدر حتى تُقر سياسة جديدة.
- approve بدون مراجعة علمية أو alt -> blocked؛ revise منشور ينشئ نسخة لا يعدّل القديم؛ session pinned آمنة.
- source agreement بين `docs/12-API-CONTRACT.yaml`, `packages/contracts/openapi.yaml`, generated TS/validators؛ `npm run contracts:check` PASS.

## C5 Metrics and privacy
- نسبة النجاح المستقل تنفي نجاح المساعدة وفشل الخدمة/البيانات الناقصة من المقام الصحيح.
- delayed retention فقط لمراجعة مؤهلة متأخرة؛ دون بيانات -> `not_measured`, ليس صفر.
- event duplicate/replay/order/late arrivals لا تضاعف النتائج، privacy projection لا تحتوي raw answers.
- coach/teacher بدون cohort scope -> رفض؛ aggregate صغير -> suppressed؛ owner الآخر -> 404.
- البيانات الاصطناعية labeled synthetic، dashboards لا تخلطها ببيانات حقيقية.

## انحدار إلزامي على A+B
- `npm run test:intelligent`, `npm run test:labs`، وملفات الاختبارات الحالية ذات الصلة؛ تكامل A/B فقط في اختبار sandbox مخول.
- `npm run contracts:check`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, `git diff --check` بحسب التغيرات.
- Golden الأصلي وقرارات `GOLD-DIAG-015`, `ERR-ALG-05…` لا تعدّل بلا مراجعة بشرية موثقة.

## شروط G-C-FINAL
`C1/C2/C3/C4/C5 code gates PASS` + `A/B regression PASS` + `no high severity safety leaks` + `no fabricated approvals` + `source diff/report` + `manual UX pending or approved accurately labeled` + `human science/UDL/privacy signoffs documented`. إن غاب توقيع/اختبار حقيقي، الحالة **PARTIAL** وليس DONE_PRODUCTION.
