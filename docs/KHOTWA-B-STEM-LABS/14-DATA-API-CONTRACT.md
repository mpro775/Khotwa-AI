# 14 — B1–B3 | عقود المحتوى وAPI وقاعدة البيانات (Proposal / NOT CURRENT)

**تنبيه:** جميع الـpaths والـDTOs والجداول أدناه **مقترحات للتنفيذ** وليست موجودة في V2.2. عند وصول الوكيل يجب قراءة `docs/12-API-CONTRACT.yaml` (المالك)، ومزامنته مع `packages/contracts/openapi.yaml`, `packages/contracts/src/`، ومراجعة عقد A1–A8 المنفذ إن وُجد. أي إعادة تسمية يحتاج migration وتحديث مستهلكين واختبارات انحدار.

## 1. العقود التي لا تُمس

- `GET /api/v1/learning/tracks`, `/learning/lessons/:id`, `/learning/skill-map`.
- `POST /api/v1/assessments/start`, `.../:id/answer`, `.../:id/support`, `GET .../:id/summary`، و`GET /learning/progress`, `/recommendations/next`.
- واجهات `GET /api/v1/physics/problems`, `POST /api/v1/physics/attempts` وخدمة الحكم الفيزيائي.
- واجهات `GET /api/v1/programming/problems`, `POST /api/v1/programming/attempts`, و`POST /api/v1/programming/attempts/:id/hints`؛ Runner Coordinator صاحب إدارة الاستئناف والنتيجة.
- `POST /api/v1/studio/learning-content`, `.../validate`, `.../transition` ضمن نظام revisons.

## 2. Content schema المقترح

أضف *تمييزًا* بين المحتوى المرئي والمحتوى الخاص بالمراجعة. لا ترسل `privateValidation`, `expectedAnswer`, `correctOrder`, `hiddenTests`, `privateRubric` ضمن `GET /learning/lessons/:id` أو `GET /lab/activities/:id`.

```ts
// Author-side proposal only
interface LabContentBlock {
  type: "subject_lab_activity";
  schemaVersion: "subject-lab-v1";
  subject: "algebra" | "physics" | "programming";
  labKind: string;               // strict allowlist by subject
  activitySpecRef: string;       // immutable reviewed revision
  skillCodes: string[];          // legal, reviewed codes
  objectives: string[];
  reviewState: "draft" | "in_review" | "approved" | "published";
}
```

بديل جائز: أنواع `math_*`, `physics_*`, `code_*` منفصلة على `LessonBlock` بشرط تجنّب duplicate data وهنالك typed parsing/Studio preview. اختيار الشكل يثبته الوكيل بعد فحص A6/A1.

## 3. Public routes المقترحة

| الطلب المقترح | الغرض | متطلبات رئيسية |
|---|---|---|
| `GET /api/v1/learning/labs/capabilities` | أنواع المختبرات ومتاحة/معطلة للمالك | auth, features, لا secrets أو تفاصيل خدمات داخلية |
| `GET /api/v1/learning/labs/activities/:revisionId` | public spec آمن لنشاط منشور ومسموح | published/pinned rule, origin, ownership where session-specific |
| `POST /api/v1/learning/labs/sessions` | إنشاء جلسة نشاط | Idempotency-Key, contentRevision, owner, exposure gating, CAS |
| `GET /api/v1/learning/labs/sessions/:sessionId` | استئناف حالة الطالب | owner, private no-store, redacted answer key |
| `POST /api/v1/learning/labs/sessions/:sessionId/events` | تنبؤ/خطوة/كشف دعم/ملاحظة | expectedRevision, allowlist event, sequence, size bound |
| `POST /api/v1/learning/labs/sessions/:sessionId/submit` | تحقق domain أو rubric | idempotency, version, no user verdict, result abstain |
| `GET /api/v1/learning/labs/sessions/:sessionId/result` | نتيجة النشاط والتفسير العام | لا hidden answers، لا بيانات طالب آخر |

**ليس كل نوع بحاجة بكل endpoint.** إذا A1/A6 وفّرا `learning/activities/:id` أو `support` فالأفضل **reuse/extend**. لا تنشئ مسارين يقبلان نفس الفعل بمصادر حكم مختلفة. لا تعتمد `/labs/capabilities` للبرمجة قبل تعريف capabilities حساسة دون كشف العزل الداخلي.

## 4. Public DTO أمثلة

### B1: Math graph activity (GET آمن)

```json
{
  "schemaVersion": "subject-lab-v1",
  "activityRevisionId": "uuid-placeholder",
  "subject": "algebra",
  "labKind": "math_linear_graph_v1",
  "targetSkillCodes": ["SK-ALG-05"],
  "model": {"expression": "y = a*x + b", "a": 2, "b": 1, "xMin": -3, "xMax": 3, "step": 1},
  "display": {"showTable": true, "showGraph": true},
  "measurementMode": "learning_only"
}
```

### B2: Physics session (بعد حفظ التوقع)

```json
{
  "schemaVersion": "subject-lab-v1",
  "sessionId": "uuid-placeholder",
  "sessionRevision": 2,
  "activityRevisionId": "uuid-placeholder",
  "subject": "physics",
  "labKind": "physics_prediction_experiment_v1",
  "stage": "prediction_saved",
  "modelVersion": "constant-velocity-v1",
  "prediction": {"kind": "increase", "submittedAt": "2026-11-08T02:00:00Z"},
  "resultRevealed": false,
  "assistanceClass": "none"
}
```

**مهم:** لا تتضمن الاستجابة قبل `reveal` قيم الناتج التي يستطيع الطالب الاستفادة منها لتخمين التوقع. يحق للمتصفح الحصول على sample data **بعد** تسجيل القرار/التعرض في الخادم.

### B3: Parsons public activity

```json
{
  "schemaVersion": "subject-lab-v1",
  "activityRevisionId": "uuid-placeholder",
  "subject": "programming",
  "labKind": "code_parsons_v1",
  "language": "python",
  "lineItems": [
    {"id": "L2", "code": "print(total)", "indent": 0},
    {"id": "L1", "code": "total = 1", "indent": 0}
  ],
  "interaction": "reorder",
  "revealsSolution": false
}
```

### B1/B2/B3 submission result

```json
{
  "sessionId": "uuid-placeholder",
  "sessionRevision": 3,
  "submissionId": "uuid-placeholder",
  "result": "correct_practice",
  "domainVerifier": "reviewed_rule_v1",
  "evidenceClass": "learning_only",
  "reasonCode": "correct_under_given_activity_rule",
  "feedbackAr": "تفسيرك مناسب للنشاط، وسنتحقق لاحقًا في سؤال جديد.",
  "revealState": "feedback_only"
}
```

`result` لا يغير `LearningEvidenceState` الأصلي؛ يحتاج adapter مؤهل لإضافة دليل في A2 أو التقييم القائم فقط. `correct_practice` ليس محرك `verified_valid` الرياضي. مفاتيح UUID والتاريخ هنا توضيحية.

## 5. جداول/امتدادات البيانات المقترحة

| التخزين | وظيفة مميزة | ملاحظة |
|---|---|---|
| `learning_lab_activity_revisions` أو امتداد `learning_content_revisions` | مواصفة نشاط منقحة، reviewed/published + private rubric | اختر **واحدًا** حسب تصميم content الحالي ولا تنسخ lessons مرتين |
| `learning_lab_sessions` أو A1 `learning_activities` | owner, pinned activity, stage, expectedRevision, assistance/exposure | لا جدول ثانٍ إذا A1 يدعمها |
| `learning_lab_events` أو A6 `learning_support_events` | expectation/reveal/parameter_change/submit في حدود retention | أي حدث يكشف حلًا يغير eligibility |
| `lab_submission_results` أو extension events | المرجع للنتيجة verified/abstain/neutral، reviewer/engine versions | مصدر verdict المختص **واحد**؛ ليس cache خفي يُسمي نفسه evidence |
| `lab_content_validation_reports` | نتيجة validation time, rules, subject reviewer, snapshot hash | لا تُرجع DTO خاص للطالب |

**قواعد التخزين:** مفاتيح فريدة لعدم تكرار `(owner, session, requestScope, idempotencyKey)`، indices owner+stage+revision، transaction بإصدار متوقع، foreign keys على المراجع، snapshots تمنع retroactive changes، ومراجعة حذف الحساب/guest claim/archived access. لا تستدعي Math/Runner/LLM داخل معاملة حجز طويل.

## 6. Event semantics

| الحدث | الكشف/القيمة التربوية |
|---|---|
| `lab_opened` | تعرض للنشاط؛ صفر دليل إتقان |
| `prediction_submitted` | يتثبت قبل `simulation_revealed`، ولا يُعاد تعديل قبل reveal إلا سياسة مدونة |
| `simulation_parameter_changed` | تفاعل تدريب؛ لا وزن إتقان حتى لو وصل قيمة محددة |
| `scaffold_revealed` | مساعدة مؤثرة على المحاولة ذات الصلة/العائلة |
| `trace_step_revealed` | كشف جزئي؛ لا استقلال لنفس السؤال |
| `parsons_order_submitted` | حكم reviewed rule، وقد يضيف دليل ممارسة مفهوم محدود |
| `programming_run_requested` | تجربة بالتنفيذ، غير مستقل |
| `programming_submit_verified` | مرشح دليل مستقل **فقط** بعد اكتمال اختبارات/novelty/assistance |
| `domain_abstained` | تعطّل أو unsupported؛ حيادي |

## 7. أمان العقد وأخطاء HTTP

- `400 invalid_request`: input أو حدود مرفوضة، دون stack.
- `401/403 unauthorized/forbidden`: اتبع العقد الفعلي؛ مفاتيح الوصول لا تظهر في response.
- `404 not_found`: نشاط غير منشور أو غير مملوك أو محفوظ لا يجوز لطالب آخر عرضه.
- `409 revision_conflict/stale_activity`: تغيير snapshot بعد قبول؛ لا write صامت.
- `422 unsupported_activity` (إذا العقد يقبل): نموذج غير مدعوم/بيانات علمية غير صالحة **وليست حكمًا على الطالب**.
- `429 rate_limited`: الإفراط في submit/trace/simulation، fair queue.
- `503 service_unavailable`: تعطّل math/physics/runner؛ احتفظ بالمسودة/المحاولة دون تقييم سلبي.

اتبع naming وresponse envelope الفعلي في `product-core.ts` و`http.ts` ولا تخترع error جديدة إن كانت code قائمة معادلة.
