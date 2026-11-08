# 17 — خطة مراحل تنفيذ الوكيل وبوابات التوقف

هذه وثيقة تنفيذية **لتطوير الكود**، لا خارطة نشر تلقائي. لا تشغّل أعمالًا ثقيلة أو خدمات طرف ثالث دون تفويض.

## ترتيب التنفيذ الملزم

| phase | العمل | شروط الاكتمال | لا تفعل |
|---|---|---|---|
| **B-00** | Baseline: جرد السورس/A status/contract، حصر content gaps وlicensing | `qa-reports/B-00-BASELINE.md`, G0 clear | لا تغير المصدر قبل فهم نسخه |
| **B-01** | تأسيس lab content schema وregistry والـAPI المالك والأحداث والـflags | العقود typed + backward compatibility + migration draft | لا تُنشئ API ثان لأحداث A1/A6 |
| **B-02** | B1 math interactive: render + graph/table + first error/methods/why + studio | اختبارات B1 + تقرير `B1-MATH-LAB.md` | لا تطور SymPy لدوال غير معتمدة |
| **B-03** | B2 native physics simulation + inquiry + studio | اختبار نموذجين نطاق 1D + `B2-PHYSICS-LAB.md` | لا تشحن PhET بغير ترخيص |
| **B-04** | B3 nonexecuting: trace, predict, Parsons, closed debug + studio | `B3-NONEXECUTING.md` + G-B3-N | لا تشغيل كود على NestJS أو browser |
| **B-05** | B3 optional Runner bridge gated | تحقق Gate-R واتفاقية تشغيل؛ إذا غير متاح أبقِ off ودوّن blocked | لا تخترق Gate-R باسم إكمال المشروع |
| **B-06** | A1–A8 adapter حسب السورس الموجود، fallback، artifacts/review | تقرير `B-A-INTEGRATION.md`, regression pass | لا تختلق أن A مكتملة |
| **B-07** | مراجعة QA والأمان وعينة end-to-end صناعية، consolidation | `B-FINAL-ACCEPTANCE.md`, statuses واضحة | لا نشر إنتاجي ولا شارة «learning proven» |

## الأولويات إن كانت الموارد محدودة

1. baseline + content safety + domain-specific math/physics + nonexecuting programming — **لا تستغنِ** عن سلامة القياس.
2. لا تعطل B1/B2 بسبب Runner غير موجود؛ أنجز B3 nonexecuting دون تشغيل.
3. لا تجعل رفض ترخيص PhET blocker للمحاكيات الأصلية.
4. إن كان المحتوى المنشور غير كافٍ للقياس المستقل، نفذ النشاط وسمه `practice_only` ولا تخترع أسئلة لتمرير QA.

## Governance وتسليم المرحلة

- اكتب plan صغيرًا قبل كل phase يذكر الملفات التي ستتغير والعقود وtests.
- أنجز source implementation + unit/contract tests + bounded UI، ثم سجّل report واضح (`PASS/PARTIAL/BLOCKED/FAIL`).
- يمنع تغيير المرجع التربوي/Golden و`SK-ALG-08` أو `ERR-ALG-05` المعلق دون اعتماد.
- لا تشغل migrations إلا في قاعدة اختبار جديدة مملوكة للمهمة مع إذن/تحقق؛ SQL forward migration لا تُطبَّق على الإنتاج.
- أي external AI أو runner أو provider تكامله معطل افتراضيًا؛ عدم وجود API key ليس خطأ إكمال B1/B2/B3-N.

## إشارات توقف فوري

- عدم قدرة النظام على منع كشف hidden tests أو mislabeling assessed evidence.
- تعارض جوهري في contract مع كود A مدمج أو حذف تاريخ المحاولات.
- محاولة تشغيل كود الطالب على host، أو PhET تجاري دون ترخيص، أو publishing لمحتوى بلا مراجعة.
- رابط جلسة أو DTO يكشف بيانات الطالب الآخر.

## مخرج نهائي مطلوب

**لا تكتفِ بعبارة «تم التنفيذ».** أنتج تقريرًا تفصيليًا مبنيًا على source+tests يوضح: ماذا نُفذ، ماذا مغطى بقبول محلي، ما الذي بقي بوابة تشغيل/ترخيص/اعتماد، وما الذي يجب أن يختبره المالك يدويًا. عند اكتمال B-07 **توقف** ولا تبدأ C1–C7.
