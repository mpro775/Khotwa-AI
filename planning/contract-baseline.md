> **تحديث نافذ:** GATE-0 APPROVED على أساس [قرار مسؤول المشروع بتفويض الوكيل](../planning/GATE0-OWNER-DELEGATED-DECISION.md). شرط الأصلين والتجميد المرتبط بهما مسقط لهذه البوابة؛ النص أدناه يحفظ الحالة السابقة. لا توقيع مباشر أنشئ باسم المراجعين. [المحضر الرياضي](../planning/approvals/MATH-SCOPE-OWNER-DELEGATED-APPROVAL.md)، [الإقرار الهندسي](../planning/approvals/ENGINEERING-QA-SECURITY-OWNER-DELEGATED-APPROVAL.md)، [سجل الإغلاق](../planning/gate0-closure.json). PH-01 مأذون للمهام 011…017، ثم التوقف للمراجعة.

# سجل نسخ العقود — TASK-006 / تصحيح PH-00

> 2026-11-04 • المقترح جاهز للمراجعة؛ **لا تجميد بشري أو تكامل حي**.

السلطة: [تكليف التصحيح](approval-evidence.md). [12](../docs/12-API-CONTRACT.yaml) مطابق بالبايت لنسخته السابقة؛ لا paths أو DTO أو أكواد استجابة عامة تغيرت.

| المكون | النسخة/المرجع | الحالة |
|---|---|---|
| API عام | OpenAPI 3.1.0 / info.version=1.0.0-draft؛ 27 path و89 schema | فحص معياري بلا أخطاء؛ الاعتماد البشري معلق |
| الانتقال الداخلي | InternalMathContext/TransitionRequest/TransitionResult/Evidence وتبعياتها في 12 | نسخ إلى $defs بتغيير المراجع المحلية فقط؛ التطابق مفحوص |
| parse وcheck-final | [math-internal-v1](../docs/contracts/math-internal-v1.md) و[Schema](../docs/contracts/math-internal-v1.schema.json) | طلب/رد مُنسَّخان ومقترحان؛ check-final لا يقرر completed |
| AST | AstDocument / math-ast-v1 | أشكال وعقد وsourceSpan/groupSpans/implicit؛ إجازة الدلالة والموارد معلقة |
| الأمثلة | [8 أمثلة JSON](../docs/contracts/math-internal-v1.examples.json)، أربعة منشورة في 10 | مقبولة بنيويًا؛ ليست استجابات محرك منفذ |
| Golden | cases.json=1.0-draft؛ fixtures_schema الأصلي | [Schema](../docs/contracts/golden-fixtures-v1.schema.json) و[adapter v1](../docs/contracts/golden-adapter-v1.md) جاهزان للمراجعة |
| البيانات | 11 و12 و16 | mapping موثق: Int32 للـwire، JSONB بغلاف AST، والملكية والمراجعات خادمية |

## التوافق المفحوص

- **openapi-spec-validator 0.7.2 / OpenAPIV31SpecValidator** فحص المواصفة العامة كاملة؛ صفر أخطاء. هذا فحص معياري، لا اعتماد بشري.
- **jsonschema 4.25.1** فحص Draft 2020-12 والأمثلة وUUID/date، مع فحوص سلبية للنسخ والحقول والنسخ المرجعية وإشارات النجاح عند العطل.
- الأنواع المشتركة طوبقت مع 12؛ أمثلة 10 §6.2/14.2–14.4 مطابقة لأمثلة JSON ومخططاتها.
- Python↔Node نقل JSON وInt32 وعدّ Unicode code points؛ **ليس اختبار NestJS**. Node دليل على تمثيل JavaScript الذي سيستهلكه NestJS لاحقًا.
- حقول mapping موجودة في 11، وربط الطلب/الرد بالإصدار والمصدر مفحوص على أمثلة. **لا PostgreSQL أو معاملات أو migrations اختبرت**.
- Golden: جميع السجلات تمر بـSchema والتحويل دون فقد؛ حالات مستورد سلبية ترفض. **صفر Golden على المنتج**.

الدليل: [التقرير الآلي](../qa-reports/ph00-correction-validation.json). [المقترح الداخلي](../docs/contracts/math-internal-v1.md) يحدد رفض النسخ، إبطال الرد القديم، الحراس الدلالية بعد Schema، التفويض ومصادقة الخدمة. المصدر الحالي وبصماته في [source-baseline](source-baseline.json)؛ السابق محفوظ في أرشيف التصحيح.

## شروط الاعتماد والاستهلاك

1. إجازة NestJS/Python/البيانات/الواجهة وQA للنسخ والأنواع، والمختص للمعنى الرياضي وAST وcheck-final.
2. مراجعة الأمن لمصادقة الخدمة وCSRF/Origin والحدود والاحتفاظ؛ الأرقام المقترحة لا تصبح نتائج قياس.
3. توقيع النسخ والبصمات وخطة توافقها. DR-005 يظل pending_human_review رغم إغلاق فجوة الملفات.
4. تكامل الخدمات والمحرك والحفظ والعزل في مراحلها بعد الإذن؛ لم يبدأ PH-01، ولا يسمح هذا السجل ببدئه.

## مطابقة قرار الإغلاق النهائي

أفاد المالك باعتماد محمد مراد وتثبيت العقود. [جرد البصمات الحالية](gate0-current-contract-inventory.json) يثبت 10 ملفات مطابقة للنسخة السابقة المتاحة، لكنه **ليس manifest تجميد معتمدًا**. لم يوجد إقرار مباشر أو بصمات مربوطة به للمقارنة، لذلك لا نسجل mismatch مع نسخة موقعة ولا اعتمادًا للتجميد. [التقرير النهائي](../qa-reports/GATE0-FINAL-RECONCILIATION.md) يحدد الدليل الناقص؛ المصدر العام وملفات العقود لم تتغير.
