# 02 — معمارية المختبرات وحدود المسؤولية

## 1. المبادئ

- **Core common / specialized plugins:** NestJS يحتفظ بالهوية والتقدم والقرارات؛ B1/B2/B3 تتصرف كمزودي نشاط تخصصيين لهم validators وrenderers مستقلة، لا تطبيقات معزولة جديدة.
- **Activity ≠ Assessment:** كل تجربة محاكاة، مشاهدة مثال، تنفيذ كود في وضع التدريب، كشف خطوة أو عرض graph هو تعلم/تعرض، لا نجاح مستقل. التقييم يختار مهمة جديدة ويطبق شروط A2/A5 والتعرض.
- **Deterministic verification first:** لا LLM في حلقة الحكم، ولا تغيّر منزلق يفوض للواجهة إصدار إتقان. المسار الصارم الوحيد للحكم: محرك/متحقق تخصصي معتمد وقاعدة تجربة منشورة.
- **Version everything:** `contentRevisionId`, `activitySpecVersion`, `policyVersion`, `verificationVersion` حيث يلزم، وأحداث تعديلات لا تمحو المحاولات السابقة.
- **No blind A dependency:** تكامل A1–A8 اختياري خلف versioned adapter حتى يُعتمد على أحدث سورس. لا تعيد تعريف `ActivityKind` إذا كان منفذًا؛ وسّع registry فقط.

## 2. مخطط مسؤوليات نصي

```text
React StudentWorkspace / LearningPaths / LessonRenderer
   |  عرض RTL/LTR، تفاعل وتنبؤ، لا حكم علمي موثوق
   v
NestJS Learning Lab Facade (auth, ownership, idempotency, revision, consent)
   |--- Activity Registry / A1 adapter
   |--- A2/A3/A4/A5/A6/A7/A8 adapters (إن وجد الكود)
   |--- B1 Math Lab --> existing MathPort / Python/SymPy
   |--- B2 Physics Lab --> versioned deterministic models + PhysicsGateway
   |--- B3 Coding Lab --> nonexecuting trace/parsons validators
   |                   \--> existing ProgrammingService/RunnerCoordinator [GATE-R]
   v
PostgreSQL/Prisma: content revisions + activity sessions/events + exposures
```

## 3. مكونات مقترحة وليست أسماء إلزامية

- `LearningLabRegistry`: سجل content kind/subject/renderer/validator/version/fallback؛ يمنع تمرير نشاط من مادة إلى أخرى.
- `LabActivityService`: بدء/استئناف/إرسال/عرض نتيجة نشاط؛ يتحقق من النشر والمراجع وحالة التعرض، ويحمل مفاتيح `owner`, `revision`, `idempotency`.
- `LabEvidenceAdapter`: يرسل **أدلة مصنفة** لنموذج المتعلم فقط عندما يكون النشاط أهلًا؛ الفشل التقني ليس خطأ الطالب.
- `ContentLabValidator`: validation وقت استوديو المحتوى، ولغة عربية، ومجال أرقام/معادلات وتطابق الرسوم والوحدات وحالات الاختبار.
- `LabRenderer` لكل مجال منفصل مع fallback نصي قابل للوصول إذا تعذر الرسم أو المحاكاة؛ لا خام HTML/JS مؤلف.

## 4. خريطة الملفات المقترحة

| إضافة/تعديل | أمثلة مواضع في السورس | ضوابط |
|---|---|---|
| API ونماذج مختبر | `apps/api/src/` وحدات new `lab-*` صغيرة أو متناسبة مع module registration | لا تكدس آلاف الأسطر في `learning-assessments.ts` |
| Public contract | `docs/12-API-CONTRACT.yaml`، `packages/contracts/openapi.yaml` و`packages/contracts/src/` | توليد `npm run contracts` وفحص `contracts:check`؛ لا تصادم |
| Content schema | `apps/api/src/learning-path-payload.ts`, `learning-path-content.ts`, `packages/contracts/src/learning-paths.d.ts` | payload allowlist + مراجعة preview/publish + حفظ النسخ |
| React | `LessonRenderer.tsx`, `LearningPaths.tsx` + components مخصصة `math-lab/`, `physics-lab/`, `code-lab/` | Fallback، RTL + معادلة/كود LTR، تنقل بلوحة المفاتيح |
| Persistence | `apps/api/prisma/schema.prisma` + forward-only migration | تجنب تكرار evidence، ولا apply على prod |
| QA | `apps/api/tests/`, `apps/web/tests/`, `tools/` | وحدات، عقد، Golden regression، اختبارات نشر محتوى |

## 5. قواعد cross-cutting

1. تجنب استعلامات تحمل answers/hidden tests ضمن بيانات الدرس العام؛ الأجوبة في authoring/validation أو قياس منفصل.
2. حدود rendering/CPU/ذاكرة؛ لا تسمح بمصفوفة نقاط غير محدودة أو `user-authored JS` من Studio.
3. عند `service_error/unsupported/inconclusive` احتفظ بإدخال الطالب وامنحه retry أو شرحًا حياديًا بلا درجة.
4. عدم توفر منتج خارجي (PhET, Runner, LLM) لا يعطل مسارات الدرس الأساسية ولا يحول الحالة إلى إخفاق تعليمي.
5. الأسئلة المنشورة/المهارات legal/المتطلبات السابقة فقط؛ `mappingPending` يمنع توصية جازمة.
6. لا تدمج «سؤال التوقع» التابع لتجربة سبق كشف نتيجتها مع اختبار مستقل إلا بمهمة جديدة، وقيّد exposure family.

## 6. بوابات التوسع

- B1 math capabilities تبدأ بمجال المعادلات الخطية الحالي؛ graph/table تخصصية لا تُسوّق بأنها دعم كل Algebra.
- B2 يدعم نموذجًا أو نموذجين للحركة الخطية المحددة أولًا؛ إضافة قوى الاحتكاك والطاقة تتطلب **نسخة نموذج وتوثيق علمي وtest oracle** مستقل.
- B3 tracer subset **تعليمي صريح** لا مفسّر Python كامل؛ تنفيذ Python الحقيقي لا يُفتح إلا بوابة Runner مستقلة.
