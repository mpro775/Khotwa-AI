# C-00 — جرد وخطة تنفيذ C1–C5

- التاريخ: 2026-11-08؛ الطلب المباشر: «نفذ هذا الان كاملة» للحزمة 00…33.
- الفرع محفوظ: `codex/intelligent-learning-a`؛ HEAD: `6a4b6cb` (B). الجرد الأول: مجلد الحزمة C وحده غير متتبع، ولا تغييرات مصدر سابقة.
- A1–A8 وB1–B3 موجودة فعليًا. العقد قبل التعديل `1.5.0-development`؛ آخر migration `0024_stem_labs_b`؛ Prisma/PostgreSQL، NestJS وReact باقية.
- البيئة المرصودة: Windows/PowerShell، Node26.7.0، npm11.17.0، Docker29.9.1. هذه حقائق جاهزية أدوات لا نتائج قبول.
- الدلتا عن الأرشيف: نعمل فوق commit B النهائي وليس وصف V2.2 أو أرشيف مجهول؛ لم توجد وحدات `advanced-learning` في الجرد.

## الخطة قبل تعديل البيانات

1. C-01/C-02: DTO وstrict parser مشترك، OpenAPI additive ومولداته، أعلام OFF.
2. C4/C3: تمديد Studio والدروس الحالية؛ مراجعات منفصلة على hash الإصدار، تمثيلات بديلة قابلة للوصول.
3. C1/C2: جلسات مملوكة مثبتة إلى درس/فهرس/hash، CAS وعدم التكرار؛ إنتاجات صغيرة ذات نسخ ومراجعات صريحة.
4. C5: إسقاط آمن من سياق تقييم A2 canonical وسجلات النشاط، reconciliation قابل للإعادة، null/missingness، حجب cohort دون ربط وصلاحية.
5. اختبارات وحدة وعقود وSSR وانحدار A/B، typecheck/build/lint؛ اختبار HTTP/DB على قاعدة عشوائية مملوكة للأداة عند الإمكان. لا تشغيل بيئة المستخدم.

الملفات المتوقعة: `advanced-learning/` في API/Web، payload/Studio والدروس، business wiring، accounts export، ARecords وexposure، Prisma/migration0025، العقود ومولداتها، fixtures/tests/tools والتقارير.

## ADR-C01…C06 — قرار هندسة المصدر

- C1/C2 يبقيان blocks في `lesson` داخل `learning_content_revisions`؛ لا publisher أو content store موازٍ. الهوية `(lessonRevisionId,blockIndex,contentHash)`.
- C1 `problem_session` وC2 `project_run` حالة صغيرة في ARecords (حد64KiB باقٍ). إنتاجات المشروع مستقلة محدودة32KiB ولكل تسليم نسخة append-only ومراجع صاحب صلاحية. لا رفع ملفات أو تنفيذ كود.
- مراجعات Studio في `learning_content_reviews` مربوطة بالـhash والنطاق والدور؛ TEST_ONLY في البيئة الاصطناعية، دون ادعاء موافقة بشرية.
- C5 يعيد استخدام `LearningAssessmentService.context()` و`summarizeSkillEvidence()`؛ لا verifier أو mastery ثانٍ. canonical snapshots/events الدائمة هي مصدر replay؛ الإسقاط reconciliation ذري مع fingerprint/cursor محفوظ، ويستبدل التصحيحات الحالية بدل عدّ كل revision كمحاولة جديدة.
- ادعاءات pre/post/remediation causal والاحتفاظ بلا anchors مؤهلة تبقى `not_measured`؛ عتبة تجميع مجموعات لم تعتمد، لذلك usage aggregates محجوبة لا رقم k مخترع.
- claim ينقل ARecords والإسقاط ذريًا؛ artifacts تستمد المالك عبر run، purge يزيل المشتقات والأبناء أولًا في مسار retention القائم؛ لا مدة جديدة.

## الحدود والمعرّفات

C-00…C-FINAL، C1-01…03، C2-01…03، C3-01…02، C4-01…02، C5-01…02؛ تحافظ على FR الخاصة بالتحقق والتلميح والتقدم/الأمن وMVP-المحرر/المحرك/الجلسة، دون إعادة تعريف قبول الهاكثون. Golden وGOLD-DIAG-015/ERR-ALG-05 باقية.

المراجع: AGENTS بالكامل وملاحقه، الرؤية/النطاق/قرارات المالك، مواصفات C المالكة، baseline وتقارير A/B، المصدر والعقود الفعلية. القبول العلمي/التربوي/الخصوصية والإتاحة على أجهزة فعلية PENDING؛ ليست مانعًا لكتابة المصدر الاصطناعي المأذون، وتمنع الإطلاق.
