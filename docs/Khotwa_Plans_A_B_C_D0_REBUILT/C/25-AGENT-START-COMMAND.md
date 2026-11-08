# 25 — أمر بدء تنفيذ خطة C1–C5 للوكيل (انسخ هذا النص إليه)

## تكليف الوكيل

أنت وكيل تطوير داخل مستودع **Khotwa AI**. المطلوب تنفيذ برنامج **C1–C5 بالكامل برمجيًا** بناءً على وثائق `docs/KHOTWA-C-ADVANCED-LEARNING/`، وليس مجرد إعداد خطة أو واجهات وهمية. **المرجع المرفوع** الذي بُنيت عليه هذه الحزمة هو `Khotwa-AI-codex-intelligent-learning-a.zip` (يحتوي A1–A8 وB1–B3 منفذة مصدرًا). لكن الحكم على الواقع يبدأ بـHEAD الحالي؛ اعمل re-audit وأثبت الفرق في تقرير C-00.

### تسلسل القراءة الملزم
1. اقرأ `AGENTS.md`, `README.md`, `docs/12-API-CONTRACT.yaml`, `docs/11-DATA-MODEL.md`، وتقارير `qa-reports/A-INTELLIGENT-LEARNING-FINAL-ACCEPTANCE.md` و`qa-reports/B-FINAL-ACCEPTANCE.md`، وأي تقرير أحدث موجود.
2. اقرأ `00-START-HERE.md` و`01-SOURCE-BASELINE.md` و`02-SCOPE-AND-ARCHITECTURE.md` و`18-A-B-INTEGRATION.md` و`19-DATA-API-CONTRACT.md` و`20-DATA-MODEL-MIGRATIONS.md` و`21-SECURITY-PRIVACY-CHILDREN.md`.
3. اقرأ جميع المواصفات `03`–`17`، ثم `24-EXECUTION-ORDER-AND-GATES.md` و`27-DECISIONS-AND-BLOCKERS.md` و`28-SOURCE-CHANGE-MAP.md` و`22-TEST-AND-ACCEPTANCE.md` و`23-STUDENT-JOURNEYS-AND-REVIEW.md`.

### التعليمات الحاسمة
- نفّذ **C1 مشكلة واقعية** (تحليل/خطة/تجربة/تفسير/تأمل)، **C2 مشروعًا فعليًا** (معالم/منتج/تسليم/مراجعة/تحسين)، **C3 UDL قابلًا للوصول**، **C4 Studio authoring/review/publish**، **C5 learning analytics**. لا تعتبر عمل route placeholder أو demo UI إنجازًا.
- **لا تعِد تنفيذ** A1–A8 أو B1–B3 أو store/reviewer/assessment/MathGateway؛ اعمل adapters واحفظ single source of truth. ابنِ على `learning_content_revisions`, `ARecords`, `stem/*`, `learning-assessments` مع معالجة الحدود المدرجة.
- احتفظ بفصل `learning_only` عن `independent_evidence`. لا يمنح إنجاز مشكلة/مشروع إتقانًا مستقلًا؛ ولا LLM حكمًا رياضيًا/فيزيائيًا/برمجيًا نهائيًا.
- استخدم versioned content وCAS/idempotency وowner scoping/CSRF/Origin/RBAC وstrict allowlists؛ لا تسرب solution keys/privateRubric/hidden tests في student DTO أو logs أو export.
- نفّذ الاختبارات المطلوبة مع fixtures اصطناعية، واختبارات انحدار A/B. احفظ failing evidence ووضح الإصلاح، ولا تغير Golden أو تقلل توقعات الاختبار لتصنيع النجاح.
- لا تنفذ migrations على قاعدة إنتاج أو قاعدة قائمة دون تفويض؛ لا تشغيل AI خارجي/Runner/PhET أو ربط حسابات حقيقية؛ لا تغيير secrets أو دفع/مشاركة عامة. Flags الجديدة OFF حتى Gate-RELEASE.
- لا تنسب موافقات علمية/تربوية/خصوصية/أمن أو نتائج تفاعل على أجهزة/طلاب حقيقيين لنفسك. وثّق صراحة `PARTIAL` أو `NOT_RUN` أو `BLOCKED_*` عند الحاجة.
- إن وجدت تصميمًا في الخطة يناقض المصدر، وثّق ADR ودلتا في تقرير قبل التعديل؛ اختر الحفاظ على التوافق والسلوك الآمن. **أكمل المراحل المصدرية المأمونة** حتى عند بقاء بوابات نشر بشرية غير محسومة.

### مخرجات كل مرحلة
في `qa-reports/C-ADVANCED-LEARNING/`: `C-00-BASELINE.md`, `C-C1-DELIVERY.md`, `C-C2-DELIVERY.md`, `C-C3-DELIVERY.md`, `C-C4-DELIVERY.md`, `C-C5-DELIVERY.md`, `C-CONTRACTS.md`, `C-TESTS.json`, `C-DECISIONS.md`, `C-FINAL-ACCEPTANCE.md` مع المصدر/الاختبارات/الحواجز/الملفات المتغيرة/الأوامر والنتائج والبصمات؛ اتبع `26-DELIVERY-REPORT-TEMPLATE.md`.

### تعريف الإنجاز
`SOURCE_CODE_COMPLETE` فقط إذا نجح البناء والأنواع والعقود ومصفوفة الاختبارات/التكامل حيث أمكن، واستُوفيت C1–C5 كوظائف مصدرية؛ و`RELEASE_APPROVED` لا يثبت إلا بموافقات موقعة واختبارات تشغيل/إتاحة مناسبة. اترك جميع الأعلام مغلقة، توقف عند تقرير C-FINAL، ولا تبدأ C6 أو نشرًا أو push أو migrations دون أمر منفصل.
