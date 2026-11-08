# C4 — استوديو المحتوى التربوي المتقدم

## لماذا C4 أساس لبقية مراحل C؟
المشكلة أو المشروع ليس نصًا حرًا. يجب أن يكون **نشاطًا ذا أهداف ومهارات ومعايير وحالة مراجعة وبصمة إصدار**. نطوّر `ContentStudio.tsx` و`PathStudio.tsx` القائمين ولا ننشئ استوديوًا ثانيًا يتجاهل `learning_content_revisions`.

## أقسام الواجهة المقترحة
1. **مكتبة أنشطة:** فلاتر مادة، مهارات، نوع (`problem_based`, `project_based`, `representation`), حالة، إصدار، تحذير `mappingPending`.
2. **منشئ مشكلة C1:** السيناريو والقيود والمعطيات والأهداف، مسارات الحل المحتملة، التلميحات، rubrics، اختبار preview لطالب افتراضي.
3. **منشئ مشروع C2:** السؤال المحفز، milestones، متطلبات artifact، خيارات الطالب، Rubric، مراجعة.
4. **تمثيلات C3:** إضافة نص/رسم/جدول/محاكاة/كود مع وصف وصول، مواءمة مع الهدف وصحة النطاق.
5. **مراجع تربوي:** قائمة أخطاء validation وملاحظات تحقق متخصص وعرض ما يراه الطالب مقابل private keys.
6. **سجل الإصدار:** publish/rollback/archive وdiff للمحتوى، لا تغيّر جلسات pinned القديمة.
7. **معاينة القياس والأحداث:** preview بدون إرسال evidence حقيقي ولا events تحليلات حقيقية (flag synthetic).

## طريقة ربط المصدر
- B1/B2/B3 أضافت بالفعل `subject_lab_activity` و`parseLabBlock` و`publicLabActivity`؛ اربط C1/C2 عبر registry منفصل مرجعي مع مشغلات B عند الحاجة، وليس حقول lab عشوائية داخل أنواع C؛ لا تسلسلات if متناثرة جديدة.
- مقترح منخفض المخاطر: `LessonBlock` مراجع `activity_ref` إلى `ActivityRevision` منشور؛ لا تحمل lesson payload كل rubrics والملفات الخاصة.
- A1 يملك مسار `next-activity` و`activities/accept` وسجلات `decision/activity`؛ أضف محول اقتراح `problem` و`project` **خلف علم C** دون إعادة كتابة مسار A1 أو العبارات المرجعية واحفظ `originRevisionId` و`policyVersion`.
- استخدم validators ومكوّنات Preview التي أضافتها B (`StemLabAuthoring.tsx`) بعد التحقق من ملاءمتها للأنشطة الجديدة.

## سيناريو التحرير
teacher يضيف مسودة → يملأ الحقول ويتحقق → preview بوصف طالب → submit for review → reviewer يتأكد من الدقة والمجال والإنصاف والوصول → approved → authorized publish → تظهر نسخة للطالب مع hash.

## لا يُنشر عند
- مسألة بلا هدف/مهارة معتمدة، وحدات غير متسقة، جواب خاص كشف في public payload، نشاط برمجي يتطلب تشغيلًا غير مفعّل، غياب keyboard alternative، Rubric فارغ، self-approval غير مخوّل، أو references لأصل غير منشور.
