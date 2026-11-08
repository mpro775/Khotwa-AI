# 11 — عقد البيانات وواجهات API المقترح لبرنامج A1–A8

> **حالة الوثيقة: Design Proposal / NOT CURRENT API.** لا تعتبر المسارات والجداول التالية منفذة. عند التنفيذ يجب على الوكيل فحص `docs/12-API-CONTRACT.yaml` و`packages/contracts/src/` وPrisma schema، وإجراء أي تغيير عام بتحديث العقد المالك والـgenerated types والاختبارات. لا تغيّر أسماء/حقول قديمة بصمت.

## 1) عقود موجودة ينبغي الحفاظ عليها

- `GET /api/v1/learning/tracks`, `/learning/tracks/:id`, `/learning/lessons/:id`, `/learning/skill-map`.
- `POST /api/v1/assessments/start`, `GET /api/v1/assessments/:id`, `POST /api/v1/assessments/:id/answer`, `POST /api/v1/assessments/:id/support`, `GET /api/v1/assessments/:id/summary`.
- `GET /api/v1/learning/progress?trackRevisionId=...`, `GET /api/v1/recommendations/next?trackRevisionId=...`, `POST /api/v1/learning/lessons/:id/progress`.
- ملفات العقود: `packages/contracts/src/learning-assessments.d.ts`, `learning-paths.d.ts`, و`docs/12-API-CONTRACT.yaml` مع fragments عند الحاجة.
- جدول evidence الحالي يحتوي حقائق المهارات والتقارير/المحاولات؛ جدول `learning_recommendation_events` يحمل توصية الدرس الحالية. لا تكتب نتيجة علمية أخرى كأنها المصدر المرجعي.

## 2) واجهات جديدة مقترحة

كل مسار يتطلب `ProductOwner` من الجلسة، CSRF/Origin وidempotency للكتابة، وقاعدة تحقق server-side، وenvelope/error موحد في `product-core.ts`. أسماء المسارات **قابلة للتكييف بعد فحص العقد**:

| العملية | Method / Path (مقترح) | المجال | قيد جوهري |
|---|---|---|---|
| النشاط التالي | `GET /api/v1/learning/next-activity?trackRevisionId=` | A1 | قراءة؛ لا تسجل كشف محتوى قياس بمجرد GET |
| قبول نشاط | `POST /api/v1/learning/activities/accept` | A1 | idempotencyKey + decisionId + expectedVersion؛ يفحص أهلية السؤال مجددًا |
| تفاصيل النشاط | `GET /api/v1/learning/activities/:id` | A1/A6/A7 | ملكية الطالب، عرض مشتقات آمنة فقط |
| أبعاد الإتقان | `GET /api/v1/learning/mastery?trackRevisionId=` | A2 | evidence/provenance دون حلول أو بيانات طالب آخر |
| اختبارات التشخيص | `POST /api/v1/learning/diagnostic-probes/:id/answer` | A3 | استخدام probe الأصلي إن يكفي؛ لا تكرر نماذج probe الحالية |
| خريطة المعرفة | `GET /api/v1/learning/knowledge-graph?trackRevisionId=` | A4 | published/reviewed graph فقط، ومنع كشف drafts |
| المراجعات المستحقة | `GET /api/v1/learning/reviews/due?trackRevisionId=` | A5 | لا يُرجع أسئلة المستقبل ولا hidden answers |
| بدء/تأجيل مراجعة | `POST /api/v1/learning/reviews/:id/start`, `.../defer` | A5 | موعد server-side، state/version، idempotency |
| تقديم دعم تدريجي | `POST /api/v1/learning/activities/:id/support` | A6 | event مساعدات قبل كشف أي محتوى يلوث القياس |
| دورة tutor | `POST /api/v1/learning/tutor-sessions`, `POST /api/v1/learning/tutor-sessions/:id/reply` | A7 | chat state bounded، خيار fallback محلي |
| الأهداف والتأمل | `GET/POST /api/v1/learning/goals`, `POST /api/v1/learning/reflections` | A8 | لا تؤثر self-report في المعايير العلمية |

**ملاحظة:** توجد بالفعل `diagnostic_probes/probe_responses` وخدمات tutoring. قبل إنشاء endpoint جديد للنشاط A3 أو A6، فضل **إعادة استخدام** مسار أعمال موجود أو تغليفه بأقل تعديل. لا تنشئ API مزدوجًا لسلوك واحد دون تبرير.

## 3) DTOs — نماذج توضيحية للعقد الجديد

### NextActivityDecision (قراءة، لا يمارس نشاطًا)

```json
{
  "decisionId": "uuid",
  "trackRevisionId": "uuid",
  "policyVersion": "pedagogy-a1-v1",
  "evidenceFingerprint": "opaque-hash",
  "contentRevisionId": "uuid",
  "skillCode": "SK-ALG-04",
  "activityKind": "diagnostic_probe",
  "reasonCode": "confirm_possible_misconception",
  "reasonAr": "لنجرّب سؤالًا قصيرًا للتحقق من السبب المحتمل.",
  "eligibility": "eligible",
  "expiresAt": "2026-11-08T10:00:00Z",
  "alternatives": [
    {"activityKind": "explanation", "reasonCode": "study_before_retry"}
  ]
}
```

`expiresAt` في المثال قيمة توضيحية فقط. في الإنتاج يحسبه الخادم وفق سياسة قابلة للتهيئة. ممنوع إرسال `privateRules`, `correctAnswer`, `hiddenTests` أو `internalEvidence` داخل DTO.

### LearnerSkillProjection

```json
{
  "skillCode": "SK-ALG-04",
  "modelVersion": "mastery-a2-v1",
  "computedAt": "2026-11-08T09:00:00Z",
  "dimensions": {
    "supportedPractice": "observed",
    "independentPerformance": "limited_evidence",
    "transfer": "not_tested",
    "retention": "not_due",
    "evidenceQuality": "partial"
  },
  "counts": {"assisted": 2, "eligibleIndependent": 1},
  "reasonCodes": ["more_independent_examples_needed"]
}
```

الدقة هنا وصفية؛ لا `masteryProbability` أو `confidencePercent` إلا مع بيانات معايرة وسياسة اعتماد لاحقة.

### ActivityEvent (داخلي)

```json
{
  "eventId": "uuid",
  "ownerKey": "internal-owner-key",
  "activityId": "uuid",
  "eventKind": "scaffold_step_revealed",
  "policyVersion": "scaffold-a6-v1",
  "contentRevisionId": "uuid",
  "attemptRevision": 3,
  "assistanceClass": "revealed_worked_step",
  "occurredAt": "2026-11-08T09:10:00Z"
}
```

`ownerKey` هنا **حق داخلي** وليس ضمن DTO الطالب. لا تُسجّل إجابة السؤال أو نص prompt كاملًا في telemetry العامة.

## 4) التغيرات المقترحة في البيانات — يجب مراجعتها

> استخدم migrations إضافية غير هدامة، واجعل المصدر مشتقًا من الحقائق الموجودة. **لا تعِد تصميم جداول V2.2 ولا تنقل بيانات المستخدمين تلقائيًا.** الأسماء التالية مرشحة هندسيًا وليست شرطًا حرفيًا.

| كيان جديد/امتداد | غرضه | علاقات يجب تثبيتها |
|---|---|---|
| `pedagogy_decisions` | قرارات A1 القابلة للتتبع | owner, track/lesson revision, evidenceFingerprint, policyVersion, candidate/reason, acceptedAt/invalidatedAt |
| `learning_activities` | نشاط يُنفذ ويستأنف | decisionId, owner, activityKind, snapshot, attempt/assessment ref, status, revision, startedAt |
| `learner_skill_projections` **اختياري** | cache مشتق لا مصدر | owner, skill, modelVersion, evidenceFingerprint, computedAt, invalidatedAt؛ يمكن عدم إنشائه والحساب on demand |
| `diagnostic_probe_outcomes` **اختياري** | توسيع probe الأصلي | probe_response_id + candidate versions؛ لا يكرر diagnosis في جدول لا يرتبط به |
| `knowledge_graph_revisions` أو `graph_edges` عند الحاجة | مراجعة حواف عابرة للمواد | skillCode + release context + reviewed status + hash؛ منع الدورات |
| `learning_review_schedules` | مواعيد وتاريخ A5 | owner+skill+sourceEvidence+reviewPolicy; dueAt, state, reschedule reason, unique key |
| `learning_support_events` | المساعدات خارج hint_requests | owner, activity, attempt, contentRev, supportKind, time, assessment contamination |
| `socratic_tutor_sessions/turns` | جلسة A7 قابلة للاستئناف | owner+activity, bounded turn index, version, hint state, safety outcome, redacted logs |
| `learning_goals` و`learning_reflections` | A8 | owner, goal measurable reference, timestamps, student text limited, deleted/retained status |

الاختيار بين جدول جديد أو توسيع الحدث الموجود يتبع: **مصدر الحقيقة، القابلية للاستئناف، كثافة الاستعلامات، سياسة الاحتفاظ، والتزامن**. تجنّب بناء «نسخة ثانية من `skill_evidence`» أو `assessments`.

### قيود معاملات/فهرسة

- فهارس `(owner_key, status, due_at)` للمراجعة، `(owner_key, activity_id)` للنشاط، وunique عند قبول decision/evidence event dedup. تجنب فهرس عالمي يكشف guest/account عند التخمين.
- check constraints للنوع/status/revision والتحقق من foreign keys قدر الإمكان، خاصة روابط المحاولة والنشاط والـcontentRevision.
- `expectedRevision` أو CAS لكل write متنازع عليها؛ عالج 409 وretry الصريح للعميل، لا كتابة صامتة.
- لا تنفذ محرك Python أو LLM أثناء transaction؛ خزّن state آمنًا، شغّل العمل ثم اعتمد النتيجة إذا ما زالت current.
- عند claim guest → account، راجع `guest_account_claims` وتأكد من نقل ملكية كل كيان جديد atomically، مع معالجة التعارضات ومنع رؤية بيانات ملكية قديمة.
- مسارات حذف الحساب/الاحتفاظ تمس كل الجداول الجديدة؛ اتبع السياسة الفعلية والتشفير حيث يلزم، ولا تخترع مدة احتفاظ جديدة.

## 5) التوافق الخلفي والعقود

- لا تغيّر معنى `LearningEvidenceState` القديم (`independent_evidence`, إلخ). أضف DTO مستقل للـmastery dimensions؛ لا تحوّل `LearningRecommendation.nextAction="study_lesson"` بصمت إلى enum جديد.
- عند تعطيل flags تعمل صفحات V2.2 وتقييماتها كما قبل التغيير؛ يمكن عرض نشاط A1 بجانب التوصية القديمة، لكن لا ترسل نسختين متناقضتين دون توضيح.
- التحقق من DTO في الخادم (AJV أو النهج المعتمد) والواجهة؛ تحديث `packages/contracts` و`docs/12-API-CONTRACT.yaml` والفحوص التعاقدية `npm run contracts:check`.
- نسخ الحقول العامة `schemaVersion`, `policyVersion`, `contentRevisionId`, `mappingSnapshotHash` مضمونة حيث تنطبق، مع تعريف دقيق للفروق بين hash لحالة الطالب وhash للمحتوى.

## 6) أخطاء API المتوقعة

| HTTP | code | مثال |
|---|---|---|
| 400 | `invalid_request` | حقل غير مدعوم/طول زائد/validation |
| 401/403 | `unauthenticated` / `forbidden` | جلسة/موافقة غير متوفرة |
| 404 | `not_found` | مورد غير مملوك أو مسودة لا يجوز رؤيتها |
| 409 | `revision_conflict` / `stale_decision` | تغير المحتوى أو محاولة الطالب |
| 409/422 وفق العقد القائم | `no_safe_activity` / `insufficient_question_coverage` | لا سؤال صالح دون تسريب قياس |
| 429 | `rate_limited` | حدود محادثة/طلب |
| 503 | `service_unavailable` | فشل خدمة التحقق؛ لا يشير لخطأ الطالب |

هذه **أمثلة مقترحة**، وتُصالح مع أكواد الأخطاء الموجودة قبل تطبيقها. تجنّب تحويل القيود المتوقعة إلى 500.

## 7) مراجعة إلزامية قبل دمج تغييرات العقد

- [ ] لا تصادم مع paths/controllers القائمة.
- [ ] مصدر verdict واحد، ومعاينة الطالب لا تكشف مفاتيح/hidden/solution.
- [ ] authorization + ownership في كل read/write + guest claims + consent.
- [ ] schema/types/codegen وcontract tests متسقة؛ لا تعديل عشوائي على API الحالي.
- [ ] migration forward آمنة، وrollback plan **دون حذف أدلة**.
- [ ] السياسة والأكواد والأمثلة عربية صحيحة، وRTL/LTR مضبوطان.
