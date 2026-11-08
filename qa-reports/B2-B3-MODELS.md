# KHOTWA B — B2/B3 domain models

- التاريخ: 2026-11-08.
- Task: B-03/B-04؛ الفرع `codex/intelligent-learning-a`، baseline `f210aec134c7cc7a32c6888ac8d66ee0e13642ca` (تغييرات عمل غير committed).
- الحالة: **جاهز لمراجعة المصدر / PARTIAL على مستوى المختبر الكامل**؛ هذا التقرير يثبت نماذج المجال فقط، ولا يمنح قبول واجهة أو تشغيل قاعدة بيانات.
- الوثائق: AGENTS، الرؤية/النطاق، حزمة B: 00/01/02، 06–17، 19/20/22/23/24؛ عقود PhysicsGateway ومتحقق physics-internal-v1 القائمة. A1–A8 موجودة فعليًا ويملك التكامل قائد المهمة.

## المنفذ

| المصدر | التغيير | مرجع القبول |
|---|---|---|
| `apps/api/src/stem/physics-inquiry.ts` | نماذج أصلية constant_velocity_1d وconstant_acceleration_1d بإصدار ثابت، SI، نقاط/جدول من snapshot واحد، SHA-256، موارد محدودة | B2-T02/04/05/07 |
| `apps/api/src/stem/coding-lab.ts` | static predict/trace/Parsons/debug؛ إسقاط عام صريح لا يعرض المفاتيح؛ ترتيب متعدد أو DAG، مسافات بادئة، closed patches | B3-T01/02/03/04/09 |
| `apps/api/tests/fixtures/stem-models.v1.json` | fixtures اصطناعية draft؛ ليست محتوى منشورًا أو اعتماد خبير | B-03/04 |
| `apps/api/tests/stem-models.test.mjs` | 14 اختبارًا محليًا، يشمل 27 مجموعة بارامترية ضمن اختبار الخصائص | خطة 16 |

لم يتغير OpenAPI أو Prisma أو physics.py أو Golden ضمن هذه المهمة الفرعية. لا تنفيذ شيفرة ولا اتصال شبكي أو خدمة مدفوعة في الوحدتين.

## أمثلة فعلية

- `v=-3 m/s,t=4 s` ينتج displacement=-12m,distance=12m.
- `v0=2 m/s,a=-2 m/s²,t=3 s` ينتج reversalTime=1s,displacement=-3m,distance=5m,finalVelocity=-4m/s. يحسب المسافة على جزأي الحركة؛ لا يستعمل القيمة المطلقة للإزاحة عند الانعكاس.
- `36 km/h` يحول إلى `10 m/s` مع الاحتفاظ ببعد speed. هذه utility تحويل، وليست حكم إجابة الطالب؛ يبقى PhysicsGateway صاحب التحقق من القيمة والوحدة.
- أثر حلقة `range(1,4)` ثابت ومؤلف: total=1,3,6 ثم output=6. لم يُشغّل Python لتوليد الأثر.
- النتائج البرمجية `conceptual_practice` و`independentEligible=false` دائمًا، بما فيها النجاح. يجب أن يسجل caller كشف trace كمساعدة قبل إرجاع الخطوة.

## الفحوص المنفذة فعليًا

بيئة المصدر: Windows/PowerShell، Node test runner، TypeScript من تبعيات المستودع.

| الأمر | النتيجة |
|---|---|
| `npx tsc --target ES2022 --module CommonJS --moduleResolution Node --strict --noUncheckedIndexedAccess --skipLibCheck --outDir apps/api/dist/stem apps/api/src/stem/physics-inquiry.ts apps/api/src/stem/coding-lab.ts` | PASS بعد آخر تعديل |
| `node --test apps/api/tests/stem-models.test.mjs` | PASS: 14/14، fail=0، skipped=0؛ آخر تشغيل 2026-11-08 |
| `npx eslint apps/api/src/stem/physics-inquiry.ts apps/api/src/stem/coding-lab.ts apps/api/tests/stem-models.test.mjs` | PASS |
| `npx prettier --check apps/api/src/stem/physics-inquiry.ts apps/api/src/stem/coding-lab.ts apps/api/tests/stem-models.test.mjs apps/api/tests/fixtures/stem-models.v1.json` | PASS |
| `npx tsc --noEmit -p apps/api/tsconfig.json` | تعذر نجاح المشروع أثناء الدمج: math-lab.ts الأسطر 124/416/593؛ لا أخطاء في ملفي هذه المهمة، وأُبلغ قائد التكامل. يرجع لتقرير B النهائي إن أصلحت لاحقًا. |

## القيود والبوابات

- نماذج المحاكاة الأصلية لا تحتاج PhET؛ لا assets أو iframe منه. PhET: BLOCKED_LICENSE/OFF.
- جميع الأنشطة أمثلة draft ولم تُنسب موافقة علمية أو تربوية بشرية لأي شخص. مصدر المخرجات الرياضية هو قواعد نماذج موثقة تقنيًا، ولا تعني الاختبارات اعتماد النشر للطلاب.
- G-B3-R: BLOCKED_GATE_R؛ لا Runner أو host execution أو مفاتيح/شبكات في هذه الوحدات.
- التنبؤ قبل reveal، CAS/idempotency/ownership، مراجع الجلسة، claim/retention، Studio/React والأحداث: مسؤولية تكامل الخدمة، وتُراجع في تقرير B الموحد؛ ليست نتائج نجاح من اختبارات المجال.
- NOT_RUN هنا: قبول أجهزة/قارئ شاشة، قاعدة بيانات، تكامل حي مع PhysicsGateway، قياس مستقل جديد، وتجربة متعلم حقيقي.
- لا ادعاء إتقان أو تحسن تعليمي من نجاح 14 اختبارًا.

## مراجعة تالية

1. مراجعة فيزيائي للفرضيات والمدى والانقلاب والوحدات، ومختص برمجة للأثر والـrubrics قبل النشر.
2. تحقق قائد التكامل من استدعاء إسقاط publicCodingActivity فقط في DTO العام، وتسجيل reveal/assistance قبل trace.
3. اختبار رحلة predict→reveal→explanation كاملة وkeyboard Parsons عبر الواجهة بعد دمج الخدمة.

حالة الاعتماد البشري: **بانتظار**. لا نشر أو تشغيل migrations أو تفعيل Runner/PhET بهذه المهمة.

## متابعة التكامل والعقد

بعد إصلاح math-lab أثناء التكامل، نجح `npx tsc -p apps/api/tsconfig.json`. أضيف إصلاح Parsons الذي يمنع تسريب sourceCode المرتب، ثم نجحت اختبارات المجال والعقد معًا: 25/25. تفاصيل العقد والمرايا في [B-CONTRACTS.md](B-CONTRACTS.md). لا يحول ذلك القيود التشغيلية أو المراجعات البشرية أعلاه إلى PASS.
