# 30 — عقد الأحداث والتحليلات والاتساق والخصوصية (C5)

## مصادر يمكن الوثوق بها من السورس
1. `learning_assessments`/`learning_assessment_items` + نتائج المحركات لنجاح/فشل التقييم **المؤهل**.
2. `intelligent_learning_records` لأحداث A1..A8 وB `lab` synthetic، و`intelligent_learning_events` تاريخ السجلات؛ **data JSON يحتوي snapshot وقد يحمل نص إجابة، فلا ينسخ wholesale إلى C5**.
3. `learning_lesson_events`, `learning_recommendation_events` لرحلة الطالب، وليست بذاتها حكم إتقان.
4. C1/C2 new events تعلّمية، rubric review موثق، reveal/support; كل نوع يربط owner/consent/science/version.

## عقد normalized event — Proposal
```json
{
  "eventVersion": "c-analytics-event-v1",
  "source": {"table": "learning_assessments", "id": "uuid", "revision": 2},
  "eventType": "independent_assessment_verified",
  "ownerPseudonym": "server-derived-nonpublic-key",
  "subject": "algebra",
  "skillCode": "SK-ALG-04",
  "contentRevisionId": "uuid",
  "policyVersion": "version",
  "occurredAt": "2026-11-08T00:00:00Z",
  "evidenceClass": "independent",
  "validity": "verified",
  "synthetic": true
}
```
**ممنوع:** raw_answer, full_chat, full_code, email, ip_address, reviewer_note_text, hidden_tests, secret_keys داخل هذا JSON. `ownerPseudonym` لا يظهر للويب؛ حتى لو لم يكن PII مباشرة لا تعرضه للطلاب الآخرين.

## Dedupe and replay
- مفتاح مصدر فريد: `(source_table, source_id, source_revision, event_type)` أو UUID immutable من transactional outbox.
- الـprojector يعيد تطبيق offsets بترتيب ثابت، ويعامل late arrivals/updated verdict/tombstone بدلالة موثقة.
- late  `validator_abstained` ثم verdict لاحق: لا مضاعفة الحدث أو احتساب الاثنين في denominator؛ state correction source revision باحترام التوقيت.
- انتقال Guest→User ينبغي إعادة ربط projection دون عدّ حدثين للمحاولة نفسها؛ لا تطبع كلا المالكين في لوحة واحدة.
- deletion/retention يجب أن يشمل projections؛ snapshots يمكن إعادة بنائها من canonical source عند سماح سياسة الاحتفاظ.

## أرقام مغرية لكنها مضللة
- `activeMinutes` و`projectFinished` و`hintsOpened` لا تتحول إلى درجة فهم.
- `prePostDelta`: لا تحسب إذا لم تكن الاختبارات متكافئة/ذو صعوبة متقاربة، أو إذا كان `n` صغيرًا بطريقة مضللة.
- `retentionRate`: يحتاج تقييمًا متأخرًا جديدًا **مستقلاً** مع delta زمني مسجل؛ عدم وجود review = `not_measured`, لا `0%`.
- `remediationEffect`: في الإصدار الأول علاقة ارتباط فقط، لا نطلق أثرًا سببيًا أو «AI حسّن 50%» دون تصميم بحثي.

## شكل KPI مع أسباب غياب البيانات
```json
{
  "metric": "independent_success_rate",
  "metricVersion": "1.0",
  "window": {"from": "2026-11-01", "to": "2026-11-08"},
  "numerator": 2,
  "denominator": 3,
  "value": 0.666667,
  "status": "observed",
  "missingReason": null,
  "synthetic": true
}
```
عند denominator صفر: `value:null, status:"not_measured", missingReason:"no_eligible_independent_attempts"`.

## Security tests
مالك A لا يرى history مالك B؛ tutor/student بلا cohort لا يعرض aggregate فردي؛ events projection لا raw text؛ replays 10 مرات تنتج نفس النسبة؛ retention/claim قانونيان؛ عينة1 لا تظهر في cohort report قابل للتعرف.
