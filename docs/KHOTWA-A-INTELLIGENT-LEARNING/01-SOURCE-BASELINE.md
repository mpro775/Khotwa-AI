# 01 — تدقيق مصدر V2.2 والفجوات التي يعالجها A1–A8

## مصدر الحقيقة

تمت مراجعة الأرشيف المرفوع `Khotwa-AI-codex-v2.2-learning-paths (1).zip`، خصوصًا:

| نطاق موجود فعلًا | ملفات أساسية | ما ينبغي الاحتفاظ به |
|---|---|---|
| التقييم والتوصية | `apps/api/src/learning-assessments.ts` و`packages/contracts/src/learning-assessments.d.ts` | أنواع `diagnostic_pretest`, `lesson_check`, `post_remediation`, `practice`، ملكية الجلسة، قياس الاستقلال وحداثة المسائل |
| المسارات والمحتوى | `apps/api/src/learning-path-content.ts`, `learning-path-payload.ts`, `apps/web/src/LearningPaths.tsx`, `LessonRenderer.tsx` | `learning_content_items/revisions/events`، نشر النسخ، العارض، مراجع المسألة، حجب المسودات |
| مهارات ومقدمات | `skills`, `skill_prerequisites`, `problem_skills` داخل `apps/api/prisma/schema.prisma` و`GET /api/v1/learning/skill-map` | خريطة المهارات الحالية وحالة `mappingPending` |
| التشخيص والتلميحات | `diagnosis.ts`, `diagnosis-rules.ts`, `tutoring.ts`, `adaptive-tutoring.ts`, `learning.ts` | الفرضية المتحفظة، سؤال probe الحالي، التلميحات H1–H4، شروط الحل الكامل |
| التحقق التخصصي | `verification.ts`, `math-gateway.ts`, `physics.ts`, `physics-learning.ts`, `programming.ts`, `programming-runner.ts` | مصدر حكم منفصل لكل مادة، الامتناع عن الحكم الفني عند تعذر التحقق |
| أحداث التعلم | `learning_episodes`, `learning_assignments`, `content_exposures`, `skill_evidence`, `learning_assessments`, `learning_assessment_items`, `learning_recommendation_events` | عدم كتابة سجل إتقان مكرر يختلف مع الحقيقة المصدرية |
| واجهة وتجربة | `apps/web/src/LearningPaths.tsx`, `StudentProgress.tsx`, `StudentWorkspace.tsx`, `ContentStudio.tsx`, `PathStudio.tsx` | المسارات والدرس والقياس وحفظ الحالة والاستئناف |
| أمن وصلاحيات | `apps/api/src/learning-access.ts`, `business.ts`, `security.ts`, `accounts.ts` | شرط التهيئة والموافقة للحساب الحقيقي، حراسة الضيف، الملكية، CSRF وOrigin والأحداث |

## واقع الإصدار الذي لا يجوز تجاوزه

- نتيجة قبول `V2.2-FINAL-ACCEPTANCE.md`: تجربة **محلية اصطناعية** لرحلة الجبر/الفيزياء المحدودة، لا نشر إنتاجي. ثلاث مسارات وستة دروس لكل مسار **مسودات** في حزمة المصدر؛ 76 مسودة سؤال ضمن ملفات مستقلة.
- `qa-reports/V2.2-CONTENT-INVENTORY.md`: 3 دروس افتتاحية مكتملة بنيويًا في حدها، 5 شروح جبر موجزة، 10 هياكل عامة؛ المراجع النهائية للشرح/الاختبار **غير معتمدة** تلقائيًا. معظم مصفوفات ربط الأسئلة والمقدمات في ملف الدروس فارغة، والاستيراد يعتمد على بنك منشور.
- `summarizeSkillEvidence()` في `learning-assessments.ts` يحدد `independent_evidence` بنجاحين حديثين مستقلين بمسألتين متمايزتين وصعوبة متساوية. هذه **شهادة دليل محدودة**، ليست إثبات إتقان ثابت أو احتفاظ لاحق.
- `recommendLesson()` يعطي `nextAction: "study_lesson"` وتوصية متحفظة قائمة على الحالات والأخطاء؛ A1 يضيف **توصية بنوع النشاط** دون كسر العقد السابق.
- V2.2 أوقف تقييم Python وتشغيل كود الطالب عبر واجهة المسارات؛ لا تسمح A1/A7/A8 بفتح هذا الباب بحجة توحيد المواد.
- تجربة Chrome في `qa-reports/V2.2-FINAL-ACCEPTANCE.md` أثبتت عدم جلب بنك الأسئلة تلقائيًا بعد إصلاح التسرب؛ كل نشاط جديد يجب أن يصون تمييز السؤال المعروض والمستخدم في القياس المستقل.
- تعارضات `GOLD-DIAG-015` و`ERR-ALG-05/calculation_divide ↔ SK-ALG-06` تتطلب قرار مراجعة؛ لا تحسمهما حزمة A برأي الوكيل.

## إعادة الاستخدام مقابل الإضافة

| المحور | إعادة استخدام | إضافة A |
|---|---|---|
| A1 | recommendLesson + progress | قرار versioned بنوع النشاط وسبب اختيار قابل للتتبع |
| A2 | verification_reports + current_skill_evidence + subject_attempts + assessments | عرض متعدد الأبعاد للإتقان مشتق من أدلة حالية، بذاكرة الاحتفاظ والنقل |
| A3 | diagnoses + diagnostic_probes + probe_responses | probe مراجع متعدد الفرضيات وربط نتيجة probe بخطة نشاط |
| A4 | skills + skill_prerequisites + learning skill-map | حواف محدثة ومراجعة تربط المسار/المادة، وتكشف نقص المتطلبات |
| A5 | exposures + assessment scheduler & evidence | مواعيد مراجعة ومحاولات استرجاع متباعدة مع حماية جِدة الأسئلة |
| A6 | tutoring levels + worked_steps + LessonRenderer | تسلسل أمثلة/خطوات ناقصة/مستقل وأحداث دعم عابرة للأنشطة |
| A7 | tutoring policy + template + AI adapter | حوار ذو حالة وسياسة آمنة بدل محادثة حرة حاسمة للصحة |
| A8 | learning progress + events | أهداف الطالب وتوقعاته ومذكرات انعكاس ومقارنة قبل/بعد، دون خلطها بالدليل |

## معايير إطلاق التصميم الهندسي

- قبل لمس المصدر: يسجل الوكيل commit/baseline، ويفتح سجل تعارضات، ويتحقق من حالة الفروع والملفات والاختبارات الموجودة؛ لا يفترض أن نسخة الأرشيف تساوي HEAD الحالي.
- إذا تغيّر المصدر بعد V2.2: يحدّث جدول الدلتا، ولا ينسخ أسماء/مهاجرات قديمة من هذه الخطة دون مطابقة المصدر الفعلي.
- **الاصطلاحات المقترحة في هذه الحزمة عقود تصميم مبدئية**؛ أسماء الجداول والأوامر لا تصبح حقائق منفذة حتى ينشئها الوكيل ويتحقق منها وفق `AGENTS.md`.
