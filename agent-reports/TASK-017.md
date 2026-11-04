# DELIVERY — TASK-017

- المرحلة PH-01؛ 2026-11-04 / Asia/Riyadh؛ الفرع codex/ph01-foundation.
- commit التنفيذ: `bf1acf23d9fde59aad969eaf3f43f90272b8c950`؛ الحالة **ready_for_review**، لا accepted أو GATE-1.
- الهدف المنفذ: seed اصطناعي خاص قابل للتكرار وغير منشور.
- المتطلبات والمالكون: MVP-09/11/13 تحضيرًا؛ 05/14/16؛ لا نشر محتوى؛ راجع AGENTS وPROJECT-DECISIONS و17 وخطة ph01-plan.
- الملفات والمبرر: tools/seed_demo.py؛ .local fixture غير متتبعة؛ بلا DB seed؛ تفصيل كامل في [فهرس الملفات](../qa-reports/ph01-files.json).
- العقود/DTO/migrations: لم يتغير canonical OpenAPI أو Golden؛ أضيفت health قائمة في العقد فقط، ولا migrations أو مخطط أعمال.
- أوامر الفحص الفعلية: npm run verify (contracts:check، format:check، lint، typecheck، build، check:foundation، smoke)، وdocker compose config/build/up --wait، وnpm run smoke:compose؛ النتائج النهائية exit 0.
- النتائج: 7 مجموعات محلية ناجحة، ضمنها 7 native smoke؛ 14 Compose smoke ناجحة؛ typecheck بلا أخطاء/تحذيرات؛ seed قابل للتكرار، مسودات غير منشورة فقط.
- البيئة: Windows/Node26/Python3.14؛ حاويات Node24/Python3.13/PostgreSQL17.6؛ إصدارات مكتبات مقيدة في locks.
- حالات Golden التي شغلت على منتج رياضي: 0؛ تحقق Schema للـ151 حالة فقط. لا واجهة تحرير رياضيات أو parser أو tutoring.
- ما لم يشغّل: E2E تعليمي، قبول أمن/RTL/هاتف/تحميل، CI عن بعد؛ هذه مراحل لاحقة ولم يفوض نشرها أو إكمالها هنا.
- مرئي/يدوي: وثيقة وأصول الويب HTTP 200 وlang=ar/dir=rtl؛ لا ادعاء فحص متصفح أو هاتف فعلي.
- حدود وأعطال: سطر lint و503 envelope صُححا ثم أعيدت الفحوص؛ seed fixture محلية وليست PostgreSQL؛ لا ORM مختار.
- مخاطر/تبعيات: اختبارات الحساب والعزل والمراجعات الذرية والمحتوى والاحتفاظ الفعلي في بواباتها؛ لا بيانات حقيقية أو LLM.
- الأدلة: [التسليم](../qa-reports/ph01-delivery.md)، [المحلية](../qa-reports/ph01-checks.json)، [الحاويات](../qa-reports/ph01-compose-checks.json)، [سلامة المصدر](../qa-reports/ph01-source-integrity.json).
- المراجع/الاعتماد: مسؤول المشروع والفريق المختص؛ قبول تسليم PH-01 **بانتظار المراجعة**؛ لا توقيع منسوب إليهم.
- الخطوة التالية: مراجعة هذه المرحلة فقط؛ لا PH-02 تلقائيًا. المهمة 017 خاصة بالـfixture، ودمج seed في DB يتبع نموذج البيانات/ORM في PH-04.
