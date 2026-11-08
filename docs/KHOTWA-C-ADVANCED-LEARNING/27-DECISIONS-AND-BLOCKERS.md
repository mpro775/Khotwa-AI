# 27 — سجل القرارات الأساسية والبوابات غير البرمجية

| ID | المسألة | قرار الخطة الحالي | المطلوب من الوكيل |
|---|---|---|---|
| ADR-C01 | تمثيل C1/C2 في المحتوى | نشاط مراجَع بإصدار في Studio، lesson block/reference بدل JSON خاص بلا schema؛ C2 يدعم multi-lesson | اقترح wire-format واحدًا بعد مسح parser/registry واثبت توافق V2.2/A/B |
| ADR-C02 | الجلسات | C1 صغيرة عبر ARecords synthetic مع kind مراجع، C2 تحتاج artifact revisions منفصلة مع owner | اختبر سقف 65536 بايت وclaim/export/purge ثم وثق البديل |
| ADR-C03 | proof of mastery | A2 وlearning_assessments فقط؛ C events `learning_only` | اختبارات novelty/exposure/assistance، لا evidence موازية |
| ADR-C04 | مراجعة المشاريع | human review إلزامي للأحكام المفتوحة؛ LLM مساعد اقتراح فقط | واجهة reviewer/admin وrubric provenance، لا self-certification |
| ADR-C05 | UDL | CAST 3.0 + هدف WCAG2.2 AA، لا VAK | مكونات مشتركة، فحص keyboard/Arabic/text fallback |
| ADR-C06 | Analytics | مصدر canonical + projection allowlist + metricVersion ونقص بيانات ظاهر | دليل denominator وretention/privacy وreplay |
| ADR-C07 | لوحة المعلم | لا student-level/cohort dashboard بدون ربط cohort موثوق | إذا غير موجود يترك محجوبًا، ويعمل student dashboard + admin content aggregates |
| ADR-C08 | حماية الطلاب | synthetic-only مصدرًا، مراجعة مستقلّة قبل التفعيل الحقيقي | flags OFF؛ لا تسريب raw answers أو صعود إلى production |
| ADR-C09 | مشروع متعدد المواد | **لاحق** إلى أن تقبل A4 روابط cross-subject وفحوصها العلمية | Micro single-subject يعمل الآن، ولا تدّعِ cross-subject مكتملًا تلقائيًا |
| ADR-C10 | ملفات المشروع | النص/JSON صغير فقط في v1؛ uploads العامة محجوبة | أمثلة خفيفة آمنة، gate مستقل للمرفقات |
| ADR-C11 | PhET وRunner | حارس B قائم، PhET license OFF وRunner Gate-R | لا تنشئ مسار تنفيذ بديلًا؛ عرض non-exec للطلاب |
| ADR-C12 | معايير التقييم | Rubric لكل إصدار، حكم جزئي قابل للتفسير، `needs_review` عند النص المفتوح | لا تحوّل كل rubric إلى رقم اتوماتيكي |

## بوابات بشرية موروثة
- A-DEC-02/05: مراجعة محتوى A وإتقان العتبات والفواصل لا تتلقّى اعتمادًا تلقائيًا من CODE PASS.
- B G-REVIEW: محاكيات/أنشطة تحتاج متخصصين وشاشات/أجهزة؛ Gate-R وPhET يظلان OFF.
- `GOLD-DIAG-015`, `ERR-ALG-05/calculation_divide↔SK-ALG-06`: قرارات مصدر علمي غير محسومة؛ لا تنشئ mapping لإخفائها.
- مشاريع C1/C2 الجديدة والعروض البديلة تحتاج مراجعة math/physics/programming + تربوي + وصول، بحسب كل نوع.

## مسؤولية اتخاذ القرار
- الوكيل: هندسة المصدر، الموازنة، الاختبارات، توثيق المخاطر.
- مختص المادة: صحة المحتوى والنطاق والحل البديل.
- متخصص التربية/القياس: عدالة rubric والتدخلات وتفسير المؤشرات.
- صاحب المشروع/الأمن/الخصوصية: تشغيل البيانات الحقيقية والقاصرين والاحتفاظ/النفاذ/الترخيص.

**سياسة التعارض:** إذا كان قرار من هذه الوثيقة يخالف HEAD أو شرط أمني، دوّن ADR جديدًا وسببًا ودليل اختبار؛ لا تعطل تنفيذ الجزء الآمن ولا تتجاوز gates.
