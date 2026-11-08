# 02 — النطاق والمعمارية بعد وصول السورس إلى A+B

## ما نبنيه
**منصة تعلم علمي** تعتمد مصدر منهج/تحقق واحد وتضيف: مشكلة واقعية قابلة للتبرير (C1)، مشروعًا له منتج ومراحل مراجعة (C2)، تمثيلًا ومشاركة وتعبيرًا متنوعًا قابلاً للوصول (C3)، تحريرًا منظّمًا واعتمادًا للإصدارات (C4)، وقراءة مؤشرات أثر قابلة للتفسير (C5).

```text
PathStudio / StemLabAuthoring (C4 extension)
    -> parser/validators -> role review -> immutable published revision
                  |                    |                 |
                  +-> C1 problem ref   +-> C2 project ref+-> C3 representation refs
StudentWorkspace / LessonRenderer / IntelligentLearningPanel
    -> C Activity Facade (session owner + CAS + idempotency + version pinning)
                  |                             |
                  +-> C1 reasoning stages       +-> C2 milestones/submissions
                  |                             |
                  +--------- A1–A8 gated adapters ---------+
                  +--------- B1–B3 lab services gated ------+
                  +--------- canonical verification --------+

canonical assessments + A/B sessions + C activity events
  -> C5 normalization/projection (allowlisted fields only)
  -> student aggregates / authorized educator aggregates / ops quality
```

## قرارات إلزامية للمعمارية
1. `learning_content_revisions` مصدر الحقيقة للمحتوى؛ الإصدارات الجديدة immutable بعد النشر. `LearningContentPayload` و`LPLessonBlock` لا يقبلان حقولًا مرتجلة.
2. A1 يحدد سياق النشاط وreasonCode عندما تتوفر المهارة والمحتوى؛ **لا تغير قواعد A1 العامة** لتعتبر كل مشروع نجاحًا. C1/C2 providers محكومة بـfeature/capabilities وحالة مراجعة.
3. A2 + assessments هو مصدر الإتقان. `learning_only` لـC1/C2 حتى يثبت تقييم مستقل عبر API القديم/الجديد المراجَع؛ التأمل والثقة الذاتية ليست evidence.
4. المحاكاة والرسم والتحقق من B1/B2/تمارين B3 عناصر تعلم متخصصة **مثبتة برخصة ونطاق**، ولا تغطي كل STEM. تنفيذ كود الطالب يتوقف على Gate-R الخارجي؛ PhET ليست تبعية.
5. C3 معيار عبر جميع الواجهات، وليس إضافة قسيمة مستخدم تنسب له نمطًا بصريًا/سمعيًا ثابتًا.
6. C4 يوسع صلاحيات سير العمل القائمة، مع مراجعات subject/pedagogy/accessibility منفصلة مثبتة لا افتراضية، ودون تجاوز قرار أن `approve/publish/archive` محصور admin.
7. C5 تقرأ/تشتق ولا تعدّل canonical rows. لا تعطِ teacher حقًا عامًا لرؤية الطلاب لمجرد دوره؛ authorisation يتطلب ارتباطًا فعليًا أو aggregate منقحًا.
8. جميع الوحدات الجديدة إما synthetic-only ضمن البنية القائمة، أو تعطّل للطلاب الحقيقيين حتى موافقة مالك الخصوصية/الأمن/التربوي وإعادة التحقق.

## نطاق أولي مقصود
- ثلاثة سيناريوهات C1 + ثلاثة مشاريع micro C2 تمثّل الجبر والحركة الخطية وPython غير التنفيذي، **Fixtures للاختبار فقط**.
- C2 فردي؛ لا فرق أو شبكة اجتماعية أو معرض عام أو رفع UGC حر.
- C3 يدعم نصًا، وصفًا بديلاً، جدولًا، تمثيلًا تفاعليًا مدعومًا، وخيارات إدخال تناسب هدف القياس؛ صوت/فيديو لاحقًا فقط بضوابط الوصول.
- C5 لوحات الطالب والتقارير التشغيلية التجريبية؛ تحليلات المعلم متعددة الطلاب **تُحجب** إلى أن يوجد ربط مجموعة/صف حقيقي مصرح به.
- لا توصيف C1 ≡ C2 رغم التباس اختصار PBL بالإنجليزية؛ استخدم `problem_based` مقابل `project_based` في كل السجلات.

## ما لا نبنيه
لا «شخصيات تعلم» ثابتة، ولا احكام LLM نهائية، ولا نماذج تنبؤية عالية المخاطر/تجارب غير مأذونة على الطلاب، ولا بيانات طبية/إعاقة، ولا GPA وهمي من عدد الأنشطة.
