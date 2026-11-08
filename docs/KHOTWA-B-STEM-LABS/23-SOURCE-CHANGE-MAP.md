# 23 — خريطة ملفات التعديل للوكيل (Targeted source changes)

هذه خريطة مبدئية تربط كل ميزة بالملف **الذي يوجد فعلًا في V2.2** وأمثلة الملفات الجديدة. في أحدث سورس عدّل الخريطة حسب اختلاف بنية المستودع. تجنّب تعديل ملف عام ضخم إذا كانت طبقة module منفصلة أو A1 adapter قائمة.

| المجال | ابدأ بقراءة | العمل المسموح والمطلوب | تحقق ضروري |
|---|---|---|---|
| B Common API | `apps/api/src/application.ts`, `business.ts`, `product-core.ts`, `http.ts` | register new lab service/controller، auth وbody limit وownership؛ reuse product mutation | route collision، CSRF, idempotency, error envelope |
| B Common storage | `apps/api/prisma/schema.prisma`, `accounts.ts`, `learning-access.ts` | tables عند الحاجة فقط، refs وrevisions وguest claim/deletion | migration safe, schema validate, ownership |
| B Common types | `packages/contracts/src/learning-paths.d.ts`, `learning-assessments.d.ts`, `product.d.ts` | discr. unions للأنشطة ومخرجاتها | `npm run contracts:check` وتناسق generated contract |
| B Content | `learning-path-payload.ts`, `learning-path-content.ts`, `ContentStudio.tsx`, `PathStudio.tsx` | parse/validate/preview/review/publish lab blocks | private rubrics redacted, draft 404, pinned revision |
| B1 math | `math-gateway.ts`, `LessonRenderer.tsx`, `MathInput.tsx` | adapter لـMathPort، graph+table renderer، method/step activities | verifier أول خطأ، fallback، عدم المساس Golden |
| B1 math tests | `apps/api/tests/` و`apps/web/tests/` + `services/math-engine` | fixtures math transforms، table-graph property tests | valid/invalid/abstain، عدم إعلان «متقن» |
| B2 physics | `physics-gateway.ts`, `physics.ts`, `physics-learning.ts`, `services/math-engine/src/khotwa_math/physics.py` | model port منفصل للمحاكاة؛ reuse checker للقيمة/الوحدة | direction reversal/unit conversions، عدم فرض 2D |
| B2 physics UX | `LessonRenderer.tsx`, `LearningPaths.tsx`, `apps/web/src/*` | simulation player، predict-first، unit/graph/table، reduced motion | no reveal before prediction, mobile accessible |
| B3 coding | `programming.ts`, `programming-runner.ts`, `runner-coordinator.ts` | reuse runner interface، static activity validators، capability gate | no execution in API/browser, hidden tests hidden |
| B3 coding UX | `SubjectWorkspace.tsx`, `code-editor-model.ts`, `programming-poll.ts`, `LessonRenderer.tsx` | trace/parsons/debug/player/runner-bridge if approved | LTR code، keyboard ordering، no flag bypass |
| A integration | `learning-assessments.ts`, `adaptive-tutoring.ts`, أي modules A تظهر في branch | register lab kinds/evidence mapping دون duplicating A | evidence/exposure/assistance revision regressed? |
| Contract | `docs/12-API-CONTRACT.yaml`, `packages/contracts/openapi.yaml`, `tools/contracts.mjs` | edit owner YAML and build/generate artifacts | typed paths/DTO, no backwards breaking rename |
| Content seeds | `apps/api/data/learning-paths.draft.v1.json` أو seed جديد | **draft-only samples** للتدريس والاختبارات | reviewed vs synthetic labels and no hidden leak |
| Reports | `qa-reports/` | B-00 to B-07 + FINAL with evidence | PASS/PARTIAL/BLOCKED distinguished |

## قواعد ترتيب الـPRs المقترحة

1. **PR-B-00/01:** contracts+types+content/registry+tests دون UI واسعة.
2. **PR-B1:** math lab renderer, domain integration, authoring+tests.
3. **PR-B2:** simulation model, physics inquiry activities, authoring+tests.
4. **PR-B3-N:** trace/parsons/debug بدون تنفيذ.
5. **PR-B3-R:** Runner bridge تحت Gate-R، إذا موافقة موجودة؛ خلاف ذلك blocked دون PR تمكين.
6. **PR-B-INT:** A1–A8 adapters بناء على status، regression وfinal report.

**معايير المراجعة:** لا PR يجمع refactor واسعًا غير مطلوب مع تعديل الحكم العلمي؛ لا `migration` على DB إنتاج؛ لا إدخال dependencies heavy لتصميم بضع رسوم دون قرار. إذا فشل review يرجع PR متخصص بدل كسر التطبيق كله.
