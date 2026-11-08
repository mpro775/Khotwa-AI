# 20 — نموذج البيانات والترحيلات المقترحة (بعد 0024)

## حقائق قائمة لا نكررها
`learning_content_items/revisions/events`, `learning_assessments/items`, `learning_lesson_events`, `learning_recommendation_events`, `intelligent_learning_records/events` و`studio_items/revisions/events` موجودة في Prisma. 0023 أضاف سجل A؛ 0024 وسع kind لـ`lab`. على الوكيل مراجعة constraints/retention/claim/export فعليًا قبل أي migration.

## المقترح C1
- خزن C1 **سيناريو منشورًا في منظومة مراجعات المحتوى** وليس داخل session؛ إما C type content revision مع ref block، أو activity registry مراجع مستندة إلى revised lesson، بعد قرار ADR-C01.
- `problem_session` إن أُضيف إلى ARecords: `owner_key`, `trackRevisionId`, `lessonRevisionId`, `contentRevisionId`, `policyVersion`, `stage`, `supportExposure`, `stepAnswers`, `feedbackState`, `createdAt/updatedAt` ضمن سقف حجم A؛ يحفظ CAS/نسخة.
- أضف kind إلى constraint 0025، وربط `account claim`, `export`, `deletion`, `guest purge` صراحة. إذا لم يكف سقف الحجم، جدول owner-scope جديد، ولا ترفع الحد دون تحليل مخاطر.

## المقترح C2
- `learning_project_runs(id, owner_key, project_revision_id, track_revision_id, status, revision, created_at, updated_at)`؛ owner index.
- `learning_project_milestone_revisions(id, project_run_id, code, revision, data, changed_at)`؛ immutable revisions + constraints.
- `learning_project_submissions(id, project_run_id, artifact_kind, artifact_json, revision, submitted_at, status)`؛ لا رفع ملفات/رموز سرية.
- `learning_project_reviews(id, submission_id, rubric_revision_id, reviewer_id, reviewer_role, rubric_results, feedback, review_timestamp)`؛ مراجع مخوّل ومصدر كل حكم.
- `project_artifact` size allowlist، limit حسب النوع، sanitization، استعلام owner للدوال العامة؛ الصفوف التي تُعرض للطالب هي إسقاطات لا raw database.
- ملكية guest/user والتحويل والحذف والاحتفاظ والتصدير إلزامية، لا تكفي FK ومؤشرات شكلية.

## المقترح C3
- `representation_set` ضمن revision payload، يربط `learningObjective`, `variantKind`, `accessibleText`, `altText`, `dataTable`, `domainLabRef`, `responseMode` حسب النوع.
- تفضيلات العرض يمكن أن تكون محلية في C3 التجريبية لتجنب إضافة بيانات هوية دون حاجة؛ إذا استلزم الحفظ حسابًا، سياسة مستقلة ومحددة لحق الوصول والحذف.

## المقترح C5
- `learning_analytics_events`: حقول محصورة **مشتقة** من الأحداث canonical، مفتاح `(source_table, source_id, source_revision, metric_event_type)` للتفريد ومنع double count، مع subject/skill/evidence class pseudonym + eventVersion + occurredAt؛ لا Raw text.
- `learning_analytics_projection_cursor` أو outbox مع high watermark/retry؛ لا تعتمد polling فقط إن ضاع وقت التنفيذ؛ اختبر late arrivals.
- `learning_metrics_snapshots`: `(owner_key or authorized aggregate scope, metric_version, window, filters_hash, n, numerator, denominator, value nullable, missing_reason, generated_at)`؛ تحديث idempotent.
- `retention/legal deletion/claim` متسقة مع `accounts.ts` و`purge_expired_guests`; لا إضافة event store أبدي بلا سياسة.

## صلاحيات وتصميم migration
1. migrations additive ومُسماة التالية بعد `0024_stem_labs_b`، لا تغير 0001–0024.
2. عدّل `apps/api/prisma/schema.prisma` وDDL مع قيود owner وCHECK وFK وفهارس وعزل reviewer.
3. اعمل `EXPLAIN` للاستعلامات الأكثر استخدامًا على بيانات صناعية بحجم معقول عندما يقرر الوكيل، وتجنب full scan لكل dashboard request.
4. اختبر forward migrate لقاعدة **جديدة مؤقتة فقط** وكذلك upgrade من snapshot اختبارية بعد إذن؛ لا `migrate deploy` إلى بيئة قائمـة تلقائيًا.
5. retention/claim/export/deletion/rollback أصعب من إنشاء table: لا Pass للبنية حتى إثباتها؛ لا delete عدواني.

## حظر الصلاحيات المضللة
`ON DELETE CASCADE` وحده ليس سياسة بيانات قاصرين؛ لا تستخدم SQL migration تعدل السجلات التاريخية أو تمحو نتائج قديمة دون قرار مالك. C5 projections مشتقة يمكن إعادة بنائها، لكن يجب ألا تبقى معلومات قابلة للتعريف بعد حذف/نقل الحساب خلاف السياسة.
