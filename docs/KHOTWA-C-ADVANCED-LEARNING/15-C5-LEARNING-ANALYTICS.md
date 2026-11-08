# C5 — مواصفة تحليلات التعلم Learning Analytics

## الهدف
قياس «هل تعلم الطالب فعلاً؟» بشكل قابل للتفسير، لا «كم نقر؟». C5 طبقة **قراءة/اشتقاق** فوق أحداث التقدم والتقييمات والمحركات ولا تحل محل A2 أو معلم بشري.

## البيانات المناسبة
- محاولات مستقلة مؤكدة بعائلة سؤال جديدة، صعوبة، نتيجة، مهارة، نوع تقييم، مساعدة، وقت تحقق.
- محاولات بمساعدة H1-H4/A6/A7، وعرض حل مع exposure family.
- النشاط التعليمي C1 وC2: بداية/انتهاء/تسليم مراجعة وسبب feedback، مع تسجيل rubric structured إذا معتمد.
- خيارات C3 على مستوى aggregate «نوع التمثيل الذي أتيح واستخدم» لتحسين التصميم، **لا استنتاج إعاقات أو أنماط شخصية**.
- قرار محرك A1 الموجود مصدرًا عندما تكون البوابة مفعلة (`reasonCode`, `policyVersion`) وتحقق لاحق بمهارة مشابهة.

## Event pipeline موصى به
`canonical source tables / outbox` → `event normalization v1` → `idempotent projector` → `privacy-safe aggregates/materialized views` → dashboards.
لا تتطلب أول نسخة Kafka؛ يمكن Postgres transactional outbox + async worker من البيئة القائمة إذا توافق المصدر. لا تبنِ جداول `learning_evidence` ثانية تُصدر أحكامًا.

## الحد الأدنى لسجل Analytics
`eventId`, `ownerPseudonym` server-side, `eventType`, `subjectCode`, `skillCode(s)`, `contentRevisionId`, `activityKind`, `policyVersion`, `occurredAt`, `sourceId`, `evidenceClass` (`independent|assisted|learning_only|abstained`), `consentBasis`, `syntheticFlag`.

## حماية البيانات
**افتراضيًا لا تخزن** اسم/بريد الطالب، IP كامل، المحادثة الكاملة مع AI، أجوبة خام، كود كامل، تسجيل صوت/فيديو، تفاصيل إعاقات أو تشخيص نفسي داخل events أو جداول aggregate. تدقق إمكان إعادة التعريف من pseudo IDs وتطبق حد أدنى للحجم في تقارير المدرسين/المجموعات.

## مؤشر لا يساوي اكتساب علم
`completed`, `active_minutes`, `hints_clicked`, `project_delivered`, `graph_viewed` = نشاط/سلوك فقط؛ لا تضعها بديلًا عن فهم مستقل، واستعن بها لفهم تجربة الاستخدام دون وصم طالب.

## حالات الامتناع
لا قياس قبلي/بعدي متكافئ → `insufficient_data`؛ حدث ناقص origin → `unknown`; خدمة تحقق فشلت → `technical_abstain`; خريطة مهارة pending → لا تشخيص مهاري جازم.
