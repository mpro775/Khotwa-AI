# C-C5 — تحليلات التعلم

التاريخ: 2026-11-08؛ الفرع محفوظ `codex/intelligent-learning-a`؛ baseline `6a4b6cb`؛ التغيير working tree دون push أو نشر. المهمة C5-01/C5-02 وADR-C03/06/07، وفق ملفات الحزمة15–17/19–22/30. الأعلام OFF، ومصدر البيانات اصطناعي.

## المصدر المنفذ

- `analytics-projection.ts`: normalization بقائمة حقول محصورة؛ استخدام `summarizeSkillEvidence` وcanonical A2 observations بدل حكم جديد. dedupe المحتوى/المسألة من A2، ومفتاح المصدر/revision يحمي replay وتصحيح verdict المتأخر.
- `analytics-service.ts`: سياق `LearningAssessmentService.context` داخل معاملة مملوكة، cursor fingerprint وreconciliation ذري للأحداث المشتقة، snapshots للنافذة7/14/30. لا polling يفقد أحداثًا: مصادر canonical الدائمة يعاد قراءتها عند الاستعادة، ولا نحتفظ بتاريخ أداء متقادم كحقيقة حالية.
- مؤشرات النجاح المستقل، استخدام المساعدة، الاحتفاظ المؤجل المؤهل ونقل الفهم. كل مؤشر يعرض n/numerator/denominator وversion/status ومصدره، وقيمة `null` مع سبب عند غياب قياس صالح.
- إكمال المشكلات/المشاريع والتسليمات نشاط منفصل `learning_only`. زمن الإكمال من أول حدث completed الثابت، لا updated_at الذي قد يتغير بعد ربط التقييم.
- pre/post/remediation/rubric-calibration/strategy-diversity/accessibility-aggregate/coverage لا تختلق لها درجة عند غياب تعريف/مصدر صالح؛ أسباب الغياب معروضة صراحة. لا ادعاء سببي أو نسبة إتقان.
- لوحة ذاتية للطالب، وجودة بنية المحتوى للمشرف. usage aggregates محجوبة `privacy_threshold_pending` وcohort403 دائم حتى يوجد ربط وسياسة معتمدان، حتى لو تغير علم وحده.

## البيانات والحقوق

الترحيل0025 إضافي: learning_analytics_events/cursor/snapshots مشتقة ومحدودة؛ لا raw answer أو code أو email أو IP أو private rubric في الإسقاط أو API. owner_key لا يرسل للويب. claim ينقل canonical history ثم يبطل إسقاط الطرفين لإعادة البناء دون تكرار؛ export يعيد كتابات المالك وإنتاجاته ومراجعته العامة دون evaluator snapshots؛ طلب الحذف يوقف الوصول ويحفظ سياسة الحذف الفعلية؛ purge القائم يشمل المشتقات والأبناء دون مدة جديدة.

الأعلام والهوية الاصطناعية تفحص قبل replay كذلك، ولا يكفي global syntheticData للسماح لحساب غير داخلي.

## الدليل والحدود

`advanced-learning-analytics.test.mjs`:14 اختبارًا موجهًا ناجحًا ضمن الجولة التجميعية الحالية: المقامات، null، replay10، التصحيح المتأخر والتعارض متساوي النسخة، التعرض/المساعدة، الاحتفاظ المؤهل مقابل المبكر، منع PII، منع cohort، منع الهوية الحقيقية ومنع replay خارج التفويض، ورفض معاملات النافذة المتكررة. `C-INTEGRATION.json` يسجل HTTP/DB الفعلي: replay10، حق المالك، claim/export/deletion/purge. النتائج الموحدة والأوامر النهائية في `C-TESTS.json` و`C-FINAL-ACCEPTANCE.md`؛ لا تجمع إعادة تشغيل الاختبار نفسه مرتين.

الإتاحة التفاعلية/قارئ الشاشة/الهواتف وفعالية التدريس ومراجعة القياس البشرية NOT_RUN/PENDING. لا مصدر حساب cohorts أو عتبة k معتمدة، لذلك لم تُفتح. القبول التشغيلي PARTIAL، لا تفويض لطلاب حقيقيين.

التراجع: إغلاق C_LEARNING_ANALYTICS_ENABLED يعطل القراءة التحليلية، دون حذف canonical أو إيقاف رحلة التعلم. الإسقاطات قابلة لإعادة البناء؛ لا rollback هدام ولا تطبيق على قاعدة قائمة. المراجع المختص/الأمن/القياس: PENDING.
