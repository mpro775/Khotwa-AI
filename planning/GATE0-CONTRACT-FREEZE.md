> **تحديث نافذ:** GATE-0 APPROVED على أساس [قرار مسؤول المشروع بتفويض الوكيل](../planning/GATE0-OWNER-DELEGATED-DECISION.md). شرط الأصلين والتجميد المرتبط بهما مسقط لهذه البوابة؛ النص أدناه يحفظ الحالة السابقة. لا توقيع مباشر أنشئ باسم المراجعين. [المحضر الرياضي](../planning/approvals/MATH-SCOPE-OWNER-DELEGATED-APPROVAL.md)، [الإقرار الهندسي](../planning/approvals/ENGINEERING-QA-SECURITY-OWNER-DELEGATED-APPROVAL.md)، [سجل الإغلاق](../planning/gate0-closure.json). PH-01 مأذون للمهام 011…017، ثم التوقف للمراجعة.

# التحقق من تجميد العقود في المستودع النهائي

> **حالة هذا الملف:** خطة تجميد ومقارنة، وليست توقيع المهندس محمد مراد.  
> **قاعدة حاسمة:** توقيع المراجع يجب أن يتعلق بالنسخة نفسها التي يبدأ الوكيل التطوير منها، لا نسخة قديمة من ZIP.

## الملفات والعقود التي يجب تثبيتها

1. `docs/12-API-CONTRACT.yaml` — OpenAPI العام ونسخته، دون تغيير صامت للمسارات/DTO.
2. `docs/contracts/math-internal-v1.schema.json` — طلب/رد `parse` و`verify-transition` و`check-final` وAST.
3. `docs/contracts/math-internal-v1.md` — دلالات Schema والمصادقة والإصدارات والحراس.
4. `docs/contracts/math-internal-v1.examples.json` — الأمثلة المعتمدة ضمن العقد.
5. `docs/contracts/golden-fixtures-v1.schema.json` و`docs/contracts/golden-adapter-v1.md` — عقد QA للـGolden.
6. `docs/14-GOLDEN-DATASET.cases.json` — مجموعة الحالات 151 المسجلة؛ **التجميد البنيوي لا يعني اعتمادها علميًا أو نجاحها**.
7. `docs/10-MATH-ENGINE.md` و`docs/04-ARABIC-NOTATION.md` و`docs/05-CURRICULUM.md` — معاني الرياضيّات التي يفسر وفقها العقد.

## آخر بصمات رأيتها في الأرشيف المرفق سابقًا — للاسترشاد فقط

| الملف | SHA-256 في آخر أرشيف فُحص هنا | ملاحظة |
|---|---|---|
| `docs/12-API-CONTRACT.yaml` | `c8b5027ec74ea9b960c3428a0d3f1e221320d46c320507713549f5892eb5ecf3` | آخر أرشيف مُتاح للفحص فقط؛ لا يُعتمد تجميدًا للإصدار الأحدث |
| `docs/contracts/math-internal-v1.schema.json` | `d72855a399c9100c5b1e54a5cdeb884a18da1e8bf53805ee23da2c05a8d874dc` | آخر أرشيف مُتاح للفحص فقط؛ لا يُعتمد تجميدًا للإصدار الأحدث |
| `docs/contracts/golden-fixtures-v1.schema.json` | `d328ee16d720ef80fb5181fec8d500fe2cc18523ab912e15a2e39d72434f72a3` | آخر أرشيف مُتاح للفحص فقط؛ لا يُعتمد تجميدًا للإصدار الأحدث |
| `docs/contracts/math-internal-v1.examples.json` | `6994a1b0723810a709a09a15a3e01959d766dd5cccb175db660577a5af0fb275` | آخر أرشيف مُتاح للفحص فقط؛ لا يُعتمد تجميدًا للإصدار الأحدث |
| `docs/14-GOLDEN-DATASET.cases.json` | `1c3e5fec509a8fad930a3d05e9f5b764b6b060281ec7277a32575511095b7f12` | آخر أرشيف مُتاح للفحص فقط؛ لا يُعتمد تجميدًا للإصدار الأحدث |
| `docs/10-MATH-ENGINE.md` | `dd6478d13520ac4da9d827b6ff1738edec125cd9d60da8c86a6537174cc339b0` | آخر أرشيف مُتاح للفحص فقط؛ لا يُعتمد تجميدًا للإصدار الأحدث |
| `AGENTS.md` | `1f0344fa4a569efbae5abc248227a4ccdcdd8eb72d08d52f7403a7208db07bb0` | آخر أرشيف مُتاح للفحص فقط؛ لا يُعتمد تجميدًا للإصدار الأحدث |

لا تعتبر هذه البصمات هي البصمات الموقعة في مستودعك الحالي: بحسب إفادة المالك هناك **تعديلات أحدث** لم تُرفع مع الرسالة الأخيرة. إذا اختلفت، فلا تقم بإرجاع الملفات إلى النسخة الأقدم. قارن النسخ الحالية مع وثيقة تثبيت المهندس محمد مراد؛ إذا كان توقيعه لنسخة سابقة، يلزم قرار تغيير/إعادة اعتماد **التغيير الدلالي المتأثر فقط**.

## تقرير التجميد الذي يجهزه الوكيل

لكل ملف: `relative_path`, `sha256`, `contract_version`, `signoff_evidence_path`, `signed_by`, `signed_at`, `scope`, `current_git_commit`. تحفظ البيانات في `planning/gate0-freeze-manifest.json` بعد التحقق البشري من التوقيع. **لا تملأ قيمًا وهمية من هذا الملف.**

## اختبار العقد اللاحق

مطابقة JSON Schema وOpenAPI في PH-00 لا تثبت عمل الشبكة أو التزامن أو مصادقة الخدمة وقت التشغيل. هذه اختبارات `PH-01` للتحضير و`GATE-1` للتكامل؛ لا تغلقها بوصفها ناجحة مسبقًا.

## نتيجة مطابقة النسخة المحلية — 2026-11-04

لا يوجد إقرار مباشر أو manifest تجميد معتمد في النسخة الحالية. [جرد 10 ملفات حالي](gate0-current-contract-inventory.json) يثبت البصمات والإصدارات فقط؛ signedBy/signedAt/signoffEvidencePath فيه null. لذلك لا ينشئ الوكيل gate0-freeze-manifest.json من النموذج ولا ينسب التجميد إلى محمد مراد. النقص موثق في [تقرير المطابقة](../qa-reports/GATE0-FINAL-RECONCILIATION.md).
