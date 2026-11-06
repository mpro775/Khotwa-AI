# DELIVERY — TASK-021

- الفرع: codex/ph02-arabic-editor؛ base commit: 70c946c؛ التغييرات محلية.
- الحالة: مكتمل جزئيًا؛ DR-007 pending.
- الهدف: FR-011…017 / MVP-02؛ تجربة MathLive أولًا، وبديل عند فشل مسار مطلوب.
- الوثائق: AGENTS و00/01/02/04/08/10/12/14/15/17 وسجل القرارات.
- الملفات: apps/web/src/MathLiveProbe.tsx وArabicEditor.tsx وFormulaPreview.tsx، اعتماد MathLive في package/lock؛ [جرد الملفات](../qa-reports/ph02-files.json).
- المنفذ: تركيب وتحرير MathLive 0.111.4 على Chrome وإدخال س/أرقام/أقواس ولصق صيغة ملتبسة وأخرى ناقصة. النسخ الفعلي أضاف `$$`، وASCII Math أعاد تنسيق المسافات. البديل المحلي يحفظ raw ويعرض أمثلة MathML محددة؛ لا قرار نهائي برفض المكتبة أو اعتماد البديل.
- الاختبارات: [الفحوص المستهدفة](../qa-reports/ph02-checks.json) و[تفاعل المتصفح](../qa-reports/ph02-browser-checks.json). لا اختبار هاتف؛ المستخدم أكد عدم توفره. التهيئة الأولية كُشفت فيها ضرورة mount قبل inlineShortcuts وأُصلحت قبل التجربة الناجحة.
- العقود/الترحيلات/المحتوى: بلا تغيير؛ لا parser أو حكم رياضي أو API اتصال.
- BLOCKER/HIGH: دليل الهاتف، وانقطاع التحكم قبل اكتمال فحص المؤشر والحافظة النهائية للمرشحين؛ لا GATE-1.
- القرار/المخاطر: [DR-007](../planning/ph02-editor-decision.md)، pending لدى الواجهة + الرياضيات + QA؛ serialization لا يصبح أصلًا أو معنى متحققًا.
- المتابعة والاعتماد: [قائمة الأجهزة](../qa-reports/rtl-device-checklist.md)؛ بانتظار المراجعة. [تقرير المرحلة](../qa-reports/ph02-delivery.md).
