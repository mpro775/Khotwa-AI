# KHOTWA B — عقد المختبرات

- التاريخ: 2026-11-08؛ baseline `f210aec134c7cc7a32c6888ac8d66ee0e13642ca`، الفرع `codex/intelligent-learning-a`.
- الحالة: جاهز لمراجعة المصدر؛ العقد `1.5.0-development`، وليس اعتماد إطلاق أو مراجعة علمية بشرية.
- المراجع: AGENTS، حزمة B 02/13/14/15/16/17/20/22/23، العقد العام السابق ومصادر StemLabService/registry/state وأنواع المختبرات الفعلية.

## التغيير

- أضيفت المسارات السبعة تحت `/api/v1/learning/labs/`: capabilities، activities/{id} مع blockIndex، sessions، sessions/{id}، events، submit، result. تنجح جميعها بـ200 وفق controller؛ cookies للضيف/الحساب، CSRF وIdempotency للكتابة، وexpectedRevision لأحداث/إجابات الجلسة.
- مخططات عامة صارمة لأنواع B1 الستة وB2 الخمسة وB3 الأربعة، مع حدود النقاط/النصوص/المعاملات، أنواع إجابات محددة، ونتائج learning_only. مخططات العرض لا تقبل privateValidation/expectedOutput/hiddenTests أو أحكامًا يمررها العميل.
- `LPLessonBlock` العام يعرض lab metadata فقط. `LPAuthorLessonBlock` و`LPAuthorLessonPayload` و`LPAuthorLearningContentPayload/Revision` تخص استوديو المحتوى وتحمل domainSpec الخاصة. مراجع Studio فقط تستعمل النسخ المؤلفة؛ تفاصيل دروس الطالب تبقى عامة.
- نسخة activity العامة لا تقبل revealedSupport؛ مخطط artifact منفصل يقبله بعد resultRevealed=true فقط. كشف الأثر البرمجي لا يعيد expectedOutput أو key الخاصة.
- أصلح تسريب الحل المرتب في Parsons: `publicCodingActivity` يحذف sourceCode لهذا النوع ويبقي العناصر المخلوطة فقط؛ اختبار مجال وعقد يثبتان ذلك.
- تكييف A1: labBlockIndex/labKind اختياريان في AActivityAlternative وANextActivityDecision وALearningActivity؛ بقي enum ActivityKind القائم.
- تصدير الحساب يتضمن `intelligentLearning.labs` بملخص صاحب السجل فقط: refs/stage/prediction/observation/explanation/assistance/revision/time. لا answer/artifact/domainSpec في الملخص.
- transfer.available يعلن توافر بنك فقط. true يقتضي assessment_service_rechecks_novelty؛ false يوضح insufficient_novel_bank أو runner_gate_blocked. لا يمنح المختبر استقلالًا بنفسه.

## الفحوص الفعلية

| الأمر | النتيجة |
|---|---|
| `npm run contracts` | PASS؛ توليد OpenAPI mirror وpublic-api.d.ts وapi-schemas.json وstandalone validators |
| `npm run contracts:check` | PASS بعد آخر تعديل انتقال/تصدير |
| `node --test apps/api/tests/stem-contracts.test.mjs apps/api/tests/stem-models.test.mjs` | PASS: 25/25، fail=0، skipped=0؛ 11 عقد +14 مجال |
| `npx tsc -p apps/api/tsconfig.json` | PASS؛ ينسخ التقرير هذا التشغيل فقط، ولا يدعي اختبار قاعدة بيانات أو متصفح |
| `npx eslint tools/contracts.mjs apps/api/tests/stem-contracts.test.mjs apps/api/src/stem/coding-lab.ts apps/api/tests/stem-models.test.mjs` | PASS |
| `npx prettier --check tools/contracts.mjs apps/api/tests/stem-contracts.test.mjs apps/api/src/stem/coding-lab.ts apps/api/tests/stem-models.test.mjs` | PASS |

اختبارات العقد قارنت metadata الـcontroller الحقيقي، والتحقق من كل مخطط STEM/author، والإسقاط الفعلي لكل مجال، وتناسق المادة/نوع النشاط، وفصل Studio/lesson، وCAS/حدود الأحداث، وحجب حلول Parsons، ومنع artifact مبكر، ومفاتيح browser validators، وكشف دعم الرياضيات، وملخص تصدير الحساب.

## الملفات

المصدر المالك `docs/12-API-CONTRACT.yaml`؛ توليد/اختيار browser roots في `tools/contracts.mjs`؛ المرايا والأنواع في `packages/contracts/` و`apps/web/src/api-schemas.json`؛ الاختبارات `apps/api/tests/stem-contracts.test.mjs` وregression في stem-models؛ إصلاح الإسقاط في `apps/api/src/stem/coding-lab.ts`.

لم يُعدل Golden أو Prisma أو migrations في هذه المهمة الفرعية. اختبارات HTTP على قاعدة اختبار يملكها وكيل التكامل توثق في تقريرها المستقل. Runner وPhET OFF، والمراجعة العلمية والأجهزة وتجربة متعلم حقيقي **بانتظار/لم تُشغل هنا**.

أعيد بناء النص النهائي من HEAD مع استبدال المقاطع المتغيرة فقط، وفُحص تطابقه البنيوي مع العقد قبل ذلك دون اختلاف. `git diff --minimal --numstat` يعطي 3898 إضافة و8 حذف لكل من المصدر والمرآة؛ المقاطع غير المتغيرة محفوظة حرفيًا. خوارزمية diff الافتراضية قد تعرض تبديلًا أوسع بسبب تكرار أسطر YAML. نجح `npm run contracts:check` مجددًا بعد هذه الخطوة.
