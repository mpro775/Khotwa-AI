# C2 — حفظ وتسليم منتجات المشاريع بأمان

## السياسة الآمنة قبل التوسع
النسخة الأساسية تدعم artifacts بنيوية **text/json/code-as-text** بحجم محدود وصور/رسم بيانات يولده المحرك دون رفع ملفات عامة. **رفع ملفات المستخدمين اختيار لاحق بعد مراجعة أمان**؛ لا تمنح upload حر ولا روابط عامة من البداية.

## أنواع مسموحة (proposal)
- `math_model_json_v1`: معاملات محكومة، جدول نقاط ضمن حد، شرح وتبرير.
- `physics_experiment_json_v1`: معطيات ومحاكاة معتمدة B2، توقع/نتائج/تفسير؛ مع الوحدات.
- `code_source_text_v1`: نص كود ومخرجات توقع/اختبارات، **بلا تنفيذ عند غياب Gate-R**.
- `narrative_report_v1`: نص عربي منظّم بحد طول ومراجعة escaped/plain-text.

## إذا فُعل رفع الملفات لاحقًا
- MIME allowlist وsignature check وmaxSize، quarantine/virus scan، تخزين خاص، presigned URLs قصيرة، فحص owner على الخادم، Content-Disposition آمن، عدم تقديم HTML/SVG/JS نشطًا، عدم إدراج أسرار أو credentials داخل artifacts.
- سياسة حذف/احتفاظ واضحة حسب موافقة المستخدم ومقتضيات حماية القُصّر؛ لا معرض عام ولا مشاركة مباشرة خارج المجموعة دون موافقة مستقلة.
- فصل reviewer comments عن artifact public view، وتدوين access audit دون تخزين المحتوى الخام في logs.

## بنية النسخ
`projectId` -> `projectSpecRevisionId` -> `projectRunId(ownerKey)` -> `submissionId` -> `artifactRevisionId` -> `reviewRecordId`؛ جميع العلاقات تثبت الملكية والإصدار.

## رسائل الفشل
`invalid_artifact_type`, `artifact_too_large`, `unsupported_domain`, `runner_unavailable`, `review_pending`؛ لا يحول فشل الرفع أو فشل التنفيذ الفني إلى `student_incorrect`.

## الخصوصية
لا طباعة أسماء مستخدمين في معرض عام افتراضي. تعاون/تعليقات/عرض منتج للعموم **خارج C2 الأولى**؛ حتى «public product» في منهجية المشاريع يمكن تحقيق جوهر التقديم عبر جمهور آمن/محاكاة وظيفية مع مراعاة الخصوصية.
