# 28 — خريطة الملفات التي يفحصها ويعدلها الوكيل (مقترحة)

> هذه أسماء مؤكدة من الأرشيف المراجع؛ أي ملف جديد مذكور في «الجديد المقترح» ليس موجودًا حتى يثبته الوكيل.

## وحدات المصدر الموجودة
| الملف الحالي | الوظيفة | تغيير C المحتمل |
|---|---|---|
| `apps/api/src/learning-path-payload.ts` | strict parser لدرس/مسار و`subject_lab_activity` | نشاط ref C1/C2، C3 metadata وvalidation constraints |
| `apps/api/src/learning-path-content.ts` | نشر/مراجعة/validation/teacher role | server-side authoring C4، content pinning، lesson links |
| `apps/api/src/content-studio.ts` | Studio أقدم للمشكلات وحالاته | إن لزم استيراد problem bank استخدمه مرجعًا؛ لا استوديو ثاني مكرر |
| `apps/api/src/intelligent-learning.ts` | A1 decision & mastery & diagnosis | C activity adapters/availability، reasonCode بدون تغيير verdict |
| `apps/api/src/intelligent-learning-experiences.ts` | A5..A8 | support/review/reflection bridge مشروط بالعلم |
| `apps/api/src/intelligent-learning-data.ts` | ARecords owner/CAS/idempotency | إضافة نوع session صغير على أساس قيود safe migration |
| `apps/api/src/knowledge-graph.ts` | A4 graph | prerequisites + coverage، وليس فرض cross-subject حتى اعتماده |
| `apps/api/src/learning-assessments.ts` | قياسات وإتقان canonical | no evidence rewrite؛ read-only analytics source |
| `apps/api/src/stem/lab-registry.ts` | B lab validation/public redaction | C1/C2 يتصلان عبر ref لا يكشف privateValidation |
| `apps/api/src/stem/lab-service.ts` | B session/submit/capability | adapters/links حين يدعم C1/C2 موضوعًا |
| `apps/api/src/stem/math-lab.ts` | مقارنة/رسم ومتحقق | C1 جبر، ضمن SK-ALG-01..07 فقط |
| `apps/api/src/stem/physics-inquiry.ts` | حركة 1D | C1/C2 استقصاء ومقادير ووحدات معتمدة |
| `apps/api/src/stem/coding-lab.ts` | trace/Parsons/debug | C1/C2 برمجة non-exec؛ لا Runner جديد |
| `apps/api/src/learning-access.ts` و`accounts.ts` | auth/consent/owner claims | توسيع purge/export/new records وعدم bypass |
| `apps/api/prisma/schema.prisma` | Prisma | migrations بعد 0024 وفهارس/RBAC/retention |
| `apps/web/src/LearningPaths.tsx` | واجهة مسارات | روابط أنشطة C وanalytics student |
| `apps/web/src/LessonRenderer.tsx` | شرح/blocks | rendering C refs + C3 variants وalt |
| `apps/web/src/PathStudio.tsx` | studio للمسارات | C4 editors/review/previews مدمجة |
| `apps/web/src/StemLabs.tsx` و`StemLabAuthoring.tsx` | B lab UI/editor | re-use B components داخل C1/C2 وC4 |
| `apps/web/src/IntelligentLearningPanel.tsx` | A UX | link supporting interventions، عدم خداع mastery |
| `apps/web/src/StudentProgress.tsx` | تقدم الطالب | C5 student dashboard مع source validity labels |
| `packages/contracts/src/learning-paths.d.ts` | lesson/track DTO | extension additive وpublic/author contract |
| `packages/contracts/src/intelligent-learning.d.ts` | A DTOs | adapters فقط إن لزم |
| `packages/contracts/src/stem-labs.d.ts` | B DTOs | reuse references & lab evidenceClass |
| `docs/12-API-CONTRACT.yaml` + `packages/contracts/openapi.yaml` | OpenAPI source & mirror | add C API and generate validators |

## ملفات جديدة محتملة (اقتراح توجيهي)
```text
apps/api/src/advanced-learning/            # NOT PRESENT IN SOURCE ZIP
    activity-registry.ts problem-service.ts project-service.ts
    project-artifacts.ts udl-representations.ts analytics-projection.ts
apps/web/src/advanced-learning/            # NOT PRESENT IN SOURCE ZIP
    ProblemJourney.tsx ProjectWorkspace.tsx RepresentationSwitcher.tsx
    AdvancedContentStudio.tsx LearningAnalyticsDashboard.tsx
packages/contracts/src/advanced-learning.d.ts
apps/api/prisma/migrations/0025_advanced_learning_c/
apps/api/tests/advanced-learning-*.test.mjs
apps/web/tests/advanced-learning-*.test.mjs
tools/test-advanced-learning.mjs           # optional, temporary DB only
qa/fixtures/advanced-learning-c/
qa-reports/C-ADVANCED-LEARNING/
```

## مهام التوافق
1. استكشف `apps/api/src/application.ts` و`main.ts` ومواضع تسجيل providers/routes الفعلية قبل إضافة Controller.
2. preserve global auth/error/envelope/CORS/CSRF, no direct `fetch` إلى Math Engine من الويب.
3. `content-payload.ts` لStudio مشاكل الفيزياء والبرمجة و`learning-path-payload.ts` للدروس؛ لا تخلط publishers/history.
4. ناقش نوع content revision للنشاط بدل فرض `kind=project` الذي يخرق strict parser.
5. ابق source deployment/test policy كما في `AGENTS.md`، واستخدم أسماء اختبارات وnpm scripts المحددة في package.json.
