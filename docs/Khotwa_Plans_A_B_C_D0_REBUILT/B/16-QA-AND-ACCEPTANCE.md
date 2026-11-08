# 16 — خطة اختبارات وقبول B1–B3

**الهدف:** إثبات وظائف السورس الجديدة دون تضخيم الاختبارات. لا يُطلب تشغيل خدمات مدفوعة أو بيئة إنتاج أو تحميل بنوك بيانات حقيقة. اختبارات الوحدة والتكامل المحلية الاصطناعية هي الأصل؛ نتائج التشغيل الفعلي تُذكر فقط إذا أُجريت.

## 1. G0 قبل البرمجة

- [ ] تثبيت source SHA وقراءة `AGENTS.md` والعقود والإصدارات.
- [ ] تحديد ما إذا كانت A1–A8 منفذة؛ وثيقة `13` تطبق على الواقع، لا افتراضات.
- [ ] جرد نقاط ملكية الحكم ومصادر المساعدة والتعرض.
- [ ] قرار schema للـblocks وراجع data migration لا تنشئ duplicate tracking.
- [ ] بوابة ترخيص PhET موثقة وOFF افتراضيًا.

## 2. B1 math acceptance

| TC | الحالة | المتوقع |
|---|---|---|
| B1-T01 | رسم `y=2x+1` بقيم x=-1,0,1 | الجدول والرسم: -1,1,3 بنفس الدقة |
| B1-T02 | تغيير `a` إلى 0 | خط أفقي وتفسير مناسب، لا قسمة على صفر |
| B1-T03 | خطأ توزيع `2(x+3)=10 → 2x+3=10` | first invalid transition verified by MathPort |
| B1-T04 | حل بديل متكافئ | مقبول ضمن math domain، لا فرض ترتيب فريد |
| B1-T05 | محرك math `unsupported/inconclusive/service_error` | لا «أول خطأ» زائف، ولا خفض evidence |
| B1-T06 | worked example + reveal + subsequent same question | مشاهدات/مساعدات، لا independent |
| B1-T07 | موضوع كسور/دوال غير مدعوم | blocked by content gate وليس حكم خاطئ |
| B1-T08 | payload XSS في عنوان block | text escaped، لا script execution |
| B1-T09 | student B accesses A's saved lab session | 404/forbidden according contract بلا leakage |

## 3. B2 physics acceptance

| TC | الحالة | المتوقع |
|---|---|---|
| B2-T01 | توقع قبل reveal ثم simulation | لا وصول للنتيجة قبل حفظ التوقع؛ مشهد صحيح |
| B2-T02 | `v=-3m/s`, `t=4s` | displacement=-12m,distance=12m |
| B2-T03 | تغيير المتغير مرتين، ثم الرجوع | state وevent sequence متسقة بعد reload |
| B2-T04 | نموذج يتضمن انعكاس اتجاه | لا `distance=abs(displacement)` زائف |
| B2-T05 | تحويل 36km/h إلى 10m/s | قيمة ووحدة صحيحتان بمتحقق النموذج |
| B2-T06 | wrong unit مع قيمة صحيحة | feedback للتعلم، احتمال A3 لا جزم |
| B2-T07 | نموذج غير معتمد/out of range | cannot_publish/unsupported neutral |
| B2-T08 | PhET flag OFF / no license | لا embed/download/assets من PhET في خُطوة |
| B2-T09 | graphics blocked/reduced-motion | جدول ونص متاحان ومقروءان |

## 4. B3 programming acceptance

| TC | الحالة | المتوقع |
|---|---|---|
| B3-T01 | `range(1,4)` trace | iter totals 1,3,6؛ output 6 |
| B3-T02 | ترتيب Parsons صحيح + indentation | correct reviewed rule، practice evidence فقط |
| B3-T03 | أكثر من ترتيب صالح للـParsons | لا يُرفض واحد صحيح بداعي ترتيب مختلف |
| B3-T04 | reveal line/hint ثم submit على نفس النشاط | مساعدة تمنع independent eligibility |
| B3-T05 | Runner غير فعّال | tracing/Parsons/closed-debug تعمل، Python execution disabled |
| B3-T06 | Runner متاح دون isolation attestation | تشغيل blocked server-side، لا bypass via browser |
| B3-T07 | Gate-R مفتوحة في بيئة مصرح بها | `run` vs `submit`/hidden/public separation + polling idempotent |
| B3-T08 | runner timeout, uncertain, stale result | code محفوظ، لا حُكم سلبي زائف، ولا overwrite |
| B3-T09 | hidden test/exam answer in public DTO | طلب يفشل مراجعة العقد، لا تسرّب |
| B3-T10 | keyboard-only Parsons | ترتيب وتراجع وتسليم دون drag |

## 5. اختبارات تكامل عامة

- [ ] V2.2 algebra diagnostic/practice/post-remediation القديم لا يتغير، وعناوين API القديمة تعمل.
- [ ] Archiving/publish version: جلسة طالب مثبتة على v1 لا تتبدل عند نشر v2؛ طالب جديد يرى المنشور الحالي فقط.
- [ ] Guest→account claim ينقل ملكية كل events الجديدة ولا يعرض معلومات مستخدم آخر.
- [ ] Duplicate submit/refresh/retry لا ينتج double evidence أو duplicate Runner job.
- [ ] `A` غير منفذة: B يعمل من الدرس دون crash؛ `A` منفذة: activity registry يختار المختبر المناسب وإلا fallback.
- [ ] واجهة RTL هاتف/حواسيب متوسطة، code LTR، graph data table، keyboard، focus/aria، أخطاء الشبكة.
- [ ] Graph/physics snapshots bounded، برمجيات غير موثوقة لا تُنفذ في المتصفح أو NestJS.

## 6. أوامر الفحوص المسموح بها

- Existing: `npm run contracts:check`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` **عند توافر البيئة** وبلا تغيير secrets.
- API targeted tests in `apps/api/tests/`، web targeted in `apps/web/tests/`; أضف سكربت مستهدف `test:labs` إن كان مناسبًا. لا تعيد تشغيل مجموعات ثقيلة غير لازمة.
- Math/Physics targeted tests يستخدمان fixtures curated وmock transport أو Python internal محلي **إذا كان جاهزًا وغير مكلف**؛ لا تفتح public port للمحرك.
- Runner isolation tests **مقفلة حتى Gate-R**؛ يمكن فحص unit mock وflag-off دون تشغيل شيفرة عدائية.
- لا تنفذ Prisma migrations على قاعدة إنتاج أو shared DB. يسمح `prisma validate` وmigration diff على schema؛ apply على قاعدة اختبار منفصلة يحتاج تحقق من السلامة والتصريح المحلي.

## 7. بوابات القبول

| بوابة | معيار PASS | إن غاب |
|---|---|---|
| G-B1 | 6 أنواع B1 صالحة مع domain/oracle tests، studio preview، UX، regression | PARTIAL/FAILED |
| G-B2 | محاكاة أصلية deterministic + predict/observe/explain + unit/graph tests، PhET flag off | PARTIAL؛ لا تُسقط B2 بسبب عدم ترخيص PhET إذا البديل يعمل |
| G-B3-N | trace/parsons/debug working بدون Runner، UI وcontent review | NON_EXECUTING_PASS |
| G-B3-R | isolation attested ومصرح، تشغيل/submit مع hidden tests، probes اختبار آمنة | BLOCKED_GATE_R حتى التصريح |
| G-A-INTEGRATION | A actual adapter compatible أو documented pending مع B standalone | لا ادعاء تنفيذ A مفقود |
| G-REVIEW | موافقات مختصين **حقيقية** على content قبل real learner rollout | REVIEW_PENDING لا Release |

كل تقرير يرفق commit وcommands وtests count ونتائج pass/fail ولقطات أو عقود مثال موثوقة. لا تقل «PASS» على بند لم يُختبر ولا تخلط code completeness بنتائج تعلم المستخدمين.
