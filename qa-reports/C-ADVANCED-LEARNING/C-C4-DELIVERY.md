# تقرير C-C4 — الاستوديو والمراجعة وإصدارات المحتوى

**التاريخ:** 2026-11-08 | **الفرع:** `codex/intelligent-learning-a` | **الحالة:** working tree فوق `6a4b6cb`.

## النتيجة

`SOURCE_PASS` للفحوص المبينة أدناه؛ قبول الإطلاق `PARTIAL / BLOCKED_LAUNCH`. تمت توسعة استوديو المسارات القائم، مع إبقاء `LearningContentPayload.kind=track|lesson`. لا اعتماد علمي أو تربوي أو أمني بشري مستنتج من هذه النتيجة. الأعلام مغلقة افتراضيًا والبرنامج اصطناعي فقط.

المهام: `C-02`, `C4-01`, `C4-02` والجزء المشترك من `C3-01/C3-02`، دون تغيير أحكام Golden أو قضايا `GOLD-DIAG-015` و`ERR-ALG-05` المعلقة. الوثائق المالكة: AGENTS، الرؤية/نطاق المنتج، حزمة C خاصة `02`, `09`–`14`, `18`–`22`, `24`–`28`، والعقد العام ومصدر الاستوديو القائم.

## تغييرات المصدر

| الملف | المسؤولية |
|---|---|
| `apps/api/src/advanced-learning/activity-payload.ts` | محلل صارم للنشاط/التمثيل/rubric، حد ٣٢ كيلوبايت، فصل `privateEvaluation`، ووسم كل التمثيلات `learning_only` |
| `apps/api/src/learning-path-payload.ts` | كتل `problem_activity`, `project_activity`, `representation_set`، وتحقق المادة/تغطية المهارات/مراجع مختبر B داخل الدرس |
| `apps/api/src/learning-path-content.ts` | تنقيح DTO الطالب، مراجعات ذات hash وscope وCAS، حماية النشر، تحقق المراجع، وتسجيل التعرض منذ عرض سيناريو C |
| `packages/contracts/src/advanced-learning.d.ts` | أنواع التأليف/العرض، UDL، rubrics، مراجعات المحتوى والتحليلات |
| `apps/web/src/PathStudio.tsx` و`apps/web/src/advanced-learning/AdvancedContentStudio.tsx` | محررات C المنظّمة والمعاينة وإجراءات المراجعة داخل الاستوديو القائم؛ التحقق المرئي في تقرير C3 |
| `apps/api/tests/advanced-learning-studio.test.mjs` | ١٤ اختبارًا موجّهًا للحدود الخاصة والعامة، المراجع، الوصول، الصلاحيات، المراجعة والتعرض |

هوية النشاط `(lessonRevisionId, blockIndex)`؛ hash النسخة المنشورة مثبت في الجلسة. لا جدول محتوى موازٍ ولا publisher بديل. المشاريع متعددة الدروس في مادة واحدة فقط؛ الربط متعدد المواد محجوب.

## المراجعة والنشر

حالات `draft → in_review → approved → published/archived` و`revise` الموروثة مستمرة. API المراجعة الجديد داخل الخدمة نفسها:

- `GET /api/v1/studio/learning-content/{id}/reviews`.
- `POST` للمسار نفسه مع `expectedRevision`, `scope`, `decision`, `notesAr`.

المراجعات للمادة والتربية والوصول والأمن منفصلة، مرتبطة بالـhash الحالي، محفوظة بصورة immutable. أحدث طلب تعديل يحجب النشر حتى مراجعة لاحقة. المؤلف لا يراجع نفسه؛ الموافقة والنشر يبقيان admin مع فصل المؤلف عن الموافق النهائي. يثبت الخادم `reviewMode=TEST_ONLY`، ولا يقبل من العميل اسم مراجع أو ادعاء `HUMAN_REVIEW`.

يتطلب تعديل محتوى C `C_ADVANCED_STUDIO_ENABLED=true` و`C_UDL_CONTENT_ENABLED=true` وبيئة اصطناعية. هذه حراسة تطوير مصدر، وليست تصريح تشغيل حقيقي. الترحيل الجديد يضيف سجل المراجعات بعد 0024؛ انظر تقرير التكامل لقاعدة الاختبار المؤقتة فقط.

لا تكفي قيمة `syntheticData` العامة وحدها: تأليف C ومراجعته يفحصان حسابًا داخليًا نشطًا وجلسة مصادقة صالحة داخل المعاملة، قبل قراءة cache الخاص بـIdempotency أيضًا. يتكرر قيد الهوية في قراءة مسودات C ومراجعاتها وقراءة كتل C عبر مسارات الدرس/المسار الموروثة؛ تفعيل سياسة التعلم الحقيقي لا يتجاوز هذا القيد. يبقى الضيف الاصطناعي مسموحًا في مسار الطالب، ولا يمتد قيد التأليف الجديد إلى المحتوى القديم الخالي من C.

## الفحوص المنفذة

| الأمر | النتيجة | الحدود |
|---|---|---|
| `npm run build --workspace @khotwa/api` | PASS، exit 0 | Node v26.7.0 / Windows؛ توليد Prisma وترجمة TypeScript |
| `node --test apps/api/tests/advanced-learning-studio.test.mjs apps/api/tests/learning-paths.test.mjs apps/api/tests/stem-contracts.test.mjs` | PASS، 37/37، exit 0 | منها 14 اختبار C4/C3؛ لا يشكل فحص أجهزة أو اعتماد محتوى |
| `node tools/check-c-backward-compatibility.mjs` | PASS، 114 كائن مسار قديم و282 schema محفوظة باستثناء الإضافات الست المصرح بها | مقارنة دلالية مع `6a4b6cb` |
| ESLint للملفات المملوكة و`git diff --check` | PASS، exit 0 | تحذير Git خاص بتحويل LF/CRLF في Prisma لا إخفاق فحص |
| `node tools/test-advanced-learning.mjs`، دليل `C-INTEGRATION.json` | PASS، 9/9 في تشغيل التكامل المحفوظ عند المراجعة | NestJS + PostgreSQL مؤقت + SymPy؛ يتضمن نشر C4 بأربع مراجعات، منع self-approval، وimmutability/نسخ؛ يحدّث قائد التكامل الدليل النهائي بعد آخر تغييرات المصدر |

الإخفاق السابق في `stem-contracts.test.mjs` كان مقارنة metadata للنسخة `1.5.0-development` بعد رفعها إلى 1.6. تغيّر فحص metadata إلى قبول الإصدارات الإضافية المتوافقة `1.x >=1.5` مع إبقاء كل فحوص المسارات والمخططات ونتائجها. لم يتغير Golden أو حكم علمي متوقع.

## الحدود والتراجع

المراجعات البشرية للمادة/rubric/عدالة التمثيلات `PENDING`، واختبارات الهاتف وقارئ الشاشة والتكبير اليدوي ليست نتيجة هذه الفحوص. لا إطلاق أو AI خارجي أو Runner/PhET أو بيانات متعلمين حقيقية. تعطيل الأعلام يغلق الكتابات الجديدة، مع الحفاظ على الحالة المثبتة وحقوق التصدير؛ لا rollback يحذف آثار الطلاب أو يعيد كتابة النسخ المنشورة.

**حالة الاعتماد:** مراجعة تخصصية بشرية `PENDING`؛ `PRODUCTION_ENABLED=false`. تفاصيل QA النهائية والبصمات في التقرير الموحد وmanifest.
