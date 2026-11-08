# 19 — عقد API المقترح C1–C5 (ليس تنفيذًا موجودًا)

**لا توجد هذه المسارات حاليًا في السورس الذي فُحص.** افحص `docs/12-API-CONTRACT.yaml` و`packages/contracts/openapi.yaml` و`tools/contracts.mjs` واستعمل envelope/error/headers/CAS/idempotency وowner auth القائمة؛ لا تنشر DTO مختلفًا عن OpenAPI.

## C1 — المشكلات
| Method/route مقترح | الغرض | ملاحظات |
|---|---|---|
| GET `/api/v1/learning/problems/available?trackRevisionId=…` | السيناريوهات المنشورة والمؤهلة | لا private rubric ولا drafts، owner/capabilities |
| GET `/api/v1/learning/problems/{revisionId}` | public brief+stages | عرض منشور أو pinned archive مسموح للمشارك فقط |
| POST `/api/v1/learning/problem-sessions` | بدء مسألة ذات نسخة مثبتة | idempotency، track/lesson/context validation |
| GET `/api/v1/learning/problem-sessions/{id}` | استئناف جلسة الطالب | owner scoped، stage/redactions |
| POST `/api/v1/learning/problem-sessions/{id}/steps` | حفظ مرحلة/خطة/تفسير | `expectedRevision` وIdempotency-Key |
| POST `/api/v1/learning/problem-sessions/{id}/feedback` | تحقق/مراجعة اقتراح الحل | source verifier أو `needs_review`؛ لا LLM adjudication |
| POST `/api/v1/learning/problem-sessions/{id}/finish` | اكتمال تعلم مع نتيجة تدريب | `evidenceClass=learning_only`، optional independent handoff |

## C2 — المشاريع
| Method/route مقترح | الغرض |
|---|---|
| GET `/api/v1/learning/projects/available?trackRevisionId=…` | مشاريع منشورة ومؤهلة، مع مستويات وسياقات |
| GET `/api/v1/learning/projects/{revisionId}` | وصف المشروع/rubric العام والمعالم |
| POST `/api/v1/learning/project-runs` | بدء فردي مع lock للنسخة والمهارة |
| GET `/api/v1/learning/project-runs/{id}` | استئناف وحالات المراحل |
| POST `/api/v1/learning/project-runs/{id}/milestones/{code}` | حفظ حالة مرحلة، versioned |
| POST `/api/v1/learning/project-runs/{id}/submissions` | تسليم artifact محدود نوعًا وحجمًا |
| POST `/api/v1/studio/project-submissions/{id}/feedback` | reviewer مخول يسجل rubric/feedback مع provenance |
| POST `/api/v1/learning/project-runs/{id}/finish` | إغلاق واضح بعد المراجعة المطلوبة دون منح إتقان آلي |

## C3 — التفضيلات والتمثيلات
- `GET /api/v1/learning/representations/{lessonRevisionId}?blockIndex=…`: تمثيلات **مراجعة ومنشورة** ذات هدف تعليمي واحد، وبديل نصي دائم.
- `PUT /api/v1/account/learning-display-preferences`: عند توافر هوية وتفويض وصلاحية؛ في العرض الاصطناعي يكتفى بحالة واجهة، ولا تخزن مؤشرات إعاقة أو learning style.
- ليس كل تبديل تمثيل حدث تعلم؛ event صغير اختياري فقط ضمن تحليلات استهلاك لا شخصنة.

## C4 — الاستوديو
**أولوية لإعادة استخدام** `POST/PUT /api/v1/studio/learning-content`, `/validate`, `/transition` وإضافة نوع block/ref مضبوط. إن احتجت أنواع محتوى مستقلة أو projectRevision فأنشئ endpoints studio موازية **داخل Studio service نفسه** مع نفس RBAC/transaction/validation، لا تستعمل route الطالب للنشر.

## C5 — التحليلات
- `GET /api/v1/learning/analytics/me?trackRevisionId=…&window=…`: الطالب يرى بياناته مع `n`, `status`, `provenance`, `version`.
- `GET /api/v1/studio/learning-analytics/content?revisionId=…`: المشرف المخول يرى مؤشرات جودة مجمعة لا نصوص إجابات خام.
- `GET /api/v1/learning/analytics/cohort/{id}`: **محجوب افتراضيًا** حتى يوجد cohort enrollment/teacher association/consent/RBAC صالح.
- لا endpoint عام للبيانات الفردية؛ طلب Raw analytics للأدمن مقيد ومراقب.

## أخطاء متوقعة ثابتة
`feature_disabled` (أو نمط خطأ 403 القديم), `not_found` لغير المالك/المحتوى غير المنشور, `invalid_state`=409, `revision_conflict`=409, `idempotency_conflict`=409, `validator_unavailable`/`cannot_determine` دون عقاب طالب, `review_pending`, `content_not_reviewed`, `insufficient_data` بكمية `n`.

## متطلبات العقود
- تحديث مصدر OpenAPI ثم المرايا/المدققات المولدة كما يفعل `npm run contracts`; توثيق DTO author/public/result منفصلة.
- no `privateRubric`, `solutionKey`, `referenceCode`, `hiddenTests`, `privateValidation` في أي learner payload حتى عند فشل.
- versioning لأنواع الأنشطة: `problem-scenario-v1`, `student-project-v1`, `udl-representation-v1`, `learning-metrics-v1`؛ المراجع immutable، والحقول الإضافية optional للاستهلاك القديم حيث أمكن.
- التنسيق الافتراضي بالأرقام/معادلات جبر عربي في UI، دون تغيير canonical raw الذي يتحقق منه SymPy.
