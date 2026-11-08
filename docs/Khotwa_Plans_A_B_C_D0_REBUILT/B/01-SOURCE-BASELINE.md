# 01 — صورة المصدر الحالي والفراغات التي تعالجها B1–B3

## مصدر المعاينة

الأرشيف `Khotwa-AI-codex-v2.2-learning-paths (1).zip`؛ تقرير `qa-reports/V2.2-FINAL-ACCEPTANCE.md` و`qa-reports/V2.2-CONTENT-INVENTORY.md`. تقرير التسليم يصف **مختبرًا محليًا ببيانات اصطناعية** وليس نشرًا إنتاجيًا. إذا اختلف المستودع الفعلي الذي يستلمه الوكيل عن هذه النسخة، يكون السورس الحالي هو المرجع ويُسجل الاختلاف قبل أي تعديل.

## موجود فعليًا — تحقق من الملفات قبل إنشاء بدائل

| المجال | المصادر | الحالة المثبتة/الحد |
|---|---|---|
| مسارات ودروس | `apps/api/src/learning-path-content.ts`, `learning-path-payload.ts`, `apps/web/src/LearningPaths.tsx`, `LessonRenderer.tsx`, `packages/contracts/src/learning-paths.d.ts` | 3 مسارات و18 درسًا في **ملفات مسودات**. `LessonBlock` يقبل 9 أنواع منها `worked_steps`, `math_example`, `physics_example`, `code_example`؛ لا graph/simulation/parsons block بعد |
| الجبر | `apps/api/src/math-gateway.ts`, `services/math-engine/src/khotwa_math/`, `apps/web/src/MathInput.tsx` | parsing/verification خطوة بخطوة في نطاق الجبر المدعوم. لا تفترض محرك رسم أو جبر عام أو رسم هندسي |
| الفيزياء | `apps/api/src/physics-gateway.ts`, `physics.ts`, `services/math-engine/src/khotwa_math/physics.py` | تحقق من القيمة والوحدة في حركة 1D ضمن وحدات/formulas محددة؛ **ليس** محرك قوى واحتكاك أو تجربة فيزياء شاملة |
| البرمجة | `apps/api/src/programming.ts`, `programming-runner.ts`, `runner-coordinator.ts`, `apps/web/src/SubjectWorkspace.tsx`, `code-editor-model.ts` | دعم سابق لمساحة Python وتشغيل آمن مشروط بعزل Judge0 وإعدادات مفاتيح. **في LearningPaths.tsx الأزرار البرمجية معطلة** عمدًا، ويذكر تقرير V2.2 القراءة فقط |
| التقييم والأدلة | `apps/api/src/learning-assessments.ts`, `packages/contracts/src/learning-assessments.d.ts` | `diagnostic_pretest`, `practice`, `lesson_check`, `post_remediation`؛ شروط الجِدة والتعرض والمساعدة، توصية نسخة قاعدة؛ لا تحول نشاطًا مختبريًا إلى دليل مستقل دون مسألة جديدة |
| الاستوديو | `apps/web/src/ContentStudio.tsx`, `PathStudio.tsx`, `apps/api/src/learning-path-content.ts` | دورة draft → review → approved → published/archived، وقفل revisions؛ يحتاج authoring لأنواع blocks جديدة بتدقيق مخصص |
| البيانات | `apps/api/prisma/schema.prisma` | `learning_content_revisions`, `learning_assessments`, `subject_attempts`, `content_exposures` وغيرها؛ لا يُعاد إنشاء جداول مماثلة بدون حجة |
| العقد | `docs/12-API-CONTRACT.yaml`, `packages/contracts/openapi.yaml`, `packages/contracts/src/`, `tools/contracts.mjs` | العقد العام المرجعي، وأسماء المسارات يجب أن تتطابق بعد توليد العقود |

## الفجوات المحددة

**B1:** عرض الحل الحالي يقتصر غالبًا على المعادلة وخطوات النص؛ لا graph/table متزامنين، ولا activity «قارن طريقتين» أو «حدد أول خطأ» مؤلفة مع حكم آلي مضبوط. `MathInput` قائم للإدخال، لكن لا يُستنتج منه أن رسم الدوال أو المقارنة التخصصية منفذان.

**B2:** `physics_example` يعرض المعطيات والقيمة المرجعية ووحدتها؛ لا نموذج محاكاة قابل لتغيير المتغيرات ضمن واجهة درس وتسجيل توقع/ملاحظة/تفسير. نظرة مصدرية إلى `physics.py` تعطي نطاق الحركة 1D؛ أي مشروع عن احتكاك/قوة مائلة خارج هذا النطاق حتى اعتماده وتنفيذه صراحة.

**B3:** `code_example` هو مثال `pre/code`، ولا توجد في الدرس أنشطة code tracing أو Parsons أو debugging مؤلفة، ولا جسر مع Runner يفتح تقييم المسارات البرمجية تلقائيًا. لا تخلط `run` (تجربة تعليمية) مع `submit` (قياس مستقل مضبوط).

## قيود محتوى المصدر الحالية

- ملف المحتوى الافتتاحي: 21 عنصرًا (18 درسًا + 3 مسارات)، كلها ملفات مصدر مسودة. 3 مقدمات مكتملة بنيويًا، و5 شروح موجزة، و10 هياكل عامة. لا تضع الادعاء «كلها دروس مكتملة».
- `practiceProblemRevisionIds` و`assessmentProblemRevisionIds` في مسودات المصدر فارغة؛ الاستيراد قد يربط بنوكًا معتمدة إذا وجدت. إذا لم يوجد بنك مستقل لا تدّعي اختبار فهم.
- الفيزياء Python في المسارات read-only في قبول V2.2. المصدر يتيح ضمن وحدات أخرى Runner اختياري، وهذا **لا يساوي** قبولًا أمنيًا لتفعيله في المسارات.
- مسودتا مراجعة مراد `GOLD-DIAG-015` و`ERR-ALG-05/calculation_divide ↔ SK-ALG-06` معلقتان؛ لا تعدل مصدر الحقيقة لتعجيل B1.

## فحص «المصدر تغير» عند الوكيل

1. `git status`, `git branch --show-current`, `git log -1 --oneline`; سجّل SHA جديدًا.
2. ابحث عن ملفات/أنواع B أو A المنفذة فعلًا؛ إذا ظهرت، قدّم diff/reuse بدل التكرار.
3. راجع DTOs وأسماء حالات التحقق ومراجعات المحتوى وقواعد العرض؛ لا تنسخ أمثلة هذه الحزمة حرفيًا إذا تعارضت مع عقد أحدث.
4. تأكد هل `A1–A8` كود مدمج أم وثائق فقط، وهل Runner isolated فعّال/مجاز؛ سجل في `22-DECISIONS-AND-BLOCKERS.md`.

## ما لا نستطيع إثباته من الأرشيف

لا يمكن استنتاج أن مراجعات المحتوى تمت بشريًا، ولا أن مستخدمين حقيقيين تعلموا، ولا أن PhET أو Judge0 مرخصان/مهيآن في بيئة الإنتاج، ولا أن بنوك الاختبارات كافية لكل وحدة. هذه عناصر Gate مستقلة لا يحسمها Build.
