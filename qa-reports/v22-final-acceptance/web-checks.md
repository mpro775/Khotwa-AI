# فحوص الواجهة المستهدفة — قبول V2.2 المحلي

- التاريخ: 2026-11-08 — Asia/Riyadh.
- النطاق: إصلاح اتصال عميل المتصفح بالخادم أثناء تجهيز الاختبار اليدوي؛ لا مرحلة جديدة ولا تغيير في API أو الرياضيات أو صلاحيات البيانات.
- الحالة: **PASS للفحوص البرمجية المبينة؛ نتيجة رحلة Chrome الفعلية تسجل بصورة مستقلة في تقرير القبول النهائي**.
- البيئة: Windows وNode v26.7.0؛ React/TypeScript/Vite القائمان.

## العيب والإصلاح

أبلغت رحلة Chrome قبل الإصلاح عن ظهور خطأ اتصال عام دون وصول طلب `/me` إلى NestJS. فحص المصدر وجد أن العميلين يحفظان الدالة الافتراضية `fetch` ثم يستدعيانها بوصفها method عبر `this.transport(...)`؛ بذلك يصبح receiver كائن العميل. يشترط transport المتصفح ذو فحص receiver سياق global صالحًا، وإلا يرفض الاستدعاء بـ`Illegal invocation` قبل إرسال HTTP.

أصبح النقل الافتراضي `fetch.bind(globalThis)` في `ProductApi` و`ApiClient`. ما زال transport المحقون للاختبار يمر كما هو. لم يُبدل عنوان الطلب أو cookies أو CSRF أو Origin أو مهلات الاتصال أو التحقق من الاستجابة، ولم يستعمل الإصلاح أي تعطيل لحماية المتصفح أو TLS.

أضيف اختبار يستخدم global fetch تتحقق من `this === globalThis`، ويختبر عميل المنتج وعميل الجلسة القديم الافتراضيين: يقبل هوية `/me` الصحيحة، ويمرر رد403 المنظم إلى `ClientFault` بدل تحويله إلى `network_error`. يثبت هذا الاختبار الخلل وإصلاحه على مستوى العميل، ولا يعوض رحلة Chrome ذات الشبكة وقاعدة البيانات الفعليتين.

| الملف | التغيير |
|---|---|
| `apps/web/src/product-api.ts` | ربط fetch الافتراضي بسياق globalThis |
| `apps/web/src/api-client.ts` | الإصلاح نفسه لبدء/قراءة جلسة الجبر القديمة |
| `apps/web/tests/product-experience.test.mjs` | اختبار انحدار receiver لكلا العميلين مع استمرار الاختبارات المحقونة القائمة |
| `apps/web/src/ProductShell.tsx` | تعديل الجذر للنص الثابت «Beta محدودة» إلى «نسخة تجريبية»، كي لا يوحي العنوان بتفعيل Beta؛ لا يغير علم تشغيلها |

## الأوامر المنفذة ونتائجها

لم تُعد هذه الأوامر بعد التحقق النهائي من الفروق لأن المصدر المتأثر بقي كما اختُبر؛ القراءة الختامية للفروق أكدت اقتصار تعديلات الواجهة على الملفات الأربعة أعلاه.

| الأمر المنفذ حرفيًا | النتيجة وحدها |
|---|---|
| `node --test --test-name-pattern 'default browser fetch' apps/web/tests/product-experience.test.mjs` **قبل الإصلاح** | exit1؛0 PASS و1 FAIL؛ فشل `ProductApi.me` بـ`network_error` عند receiver غير صالح. هذه نتيجة إعادة إنتاج للعيب، وليست فشلًا متبقيًا |
| `node --test apps/web/tests/product-experience.test.mjs apps/web/tests/learning-paths.test.mjs` **بعد الإصلاح** | exit0؛**21/21 PASS**،0 failed/0 skipped؛ يشمل اختبار receiver وحفظ المسودة وعدم التكرار وخصوصية الإسقاطات وفصل أحكام المواد |
| `npm run typecheck --workspace @khotwa/web` | exit0؛ TypeScript بلا خطأ |
| `npx eslint apps/web/src/product-api.ts apps/web/src/api-client.ts apps/web/tests/product-experience.test.mjs` | exit0 |
| `npx prettier --check apps/web/src/product-api.ts apps/web/src/api-client.ts apps/web/tests/product-experience.test.mjs` | exit0؛ All matched files use Prettier code style |
| `npm run build --workspace @khotwa/web` | exit0؛52 modules؛ اكتمل Vite في3.93 ثانية، مع تحذير chunks الأكبر من500KB القائم دون رفع عتبته |
| `git diff --check -- apps/web/src/product-api.ts apps/web/src/api-client.ts apps/web/tests/product-experience.test.mjs` | exit0؛ لا أخطاء whitespace |

مخرجات البناء التي جاهزت إعادة تحميل Chrome في هذه الجولة: `apps/web/dist/assets/index-Cop0AufC.js` و`ArabicEditor-BCVgwTe8.js`؛ ملفات dist محلية مولدة ولا تُنشر في Git. التغيير النصي في ProductShell كان موجودًا قبل هذا البناء، فشمله أيضًا.

## مراجعة عبارات اعتماد المحتوى

راجعت [جرد المحتوى](../V2.2-CONTENT-INVENTORY.md) و[قائمة الأستاذ مراد](../V2.2-MURAD-REVIEW-CHECKLIST.md). لا تنسب الوثيقتان موافقة بشرية أو توقيعًا:

- الجرد يصنف3 مقدمات مكتملة بنيويًا و5 شروح موجزة و10 هياكل عامة، ويفصل draft المصدر عن published في DB اختبار.
- قائمة GOLD-DIAG-015 وERR05 ومحتوى الجبر تبقي القرارات **PENDING** وتطلب اسم المراجع/تاريخ المراجعة الفعلي/النسخة عند صدور القرار.
- محضر PH08 القديم يبقى مقيدًا ببطاقاته وبصمته؛ لا يُعمم على دروس V2.2 الجديدة.
- التحقق الحسابي ونجاح test fixture لا يساويان اعتمادًا تربويًا أو إذن نشر في بيئة مستخدمين.

لم تُعدل UI أو DB أثناء هذه المراجعة الختامية، ولم تُشغّل اختبارات حمل أو Runner أو Gemini. دليل Chrome الفعلي وطلبات NestJS وسجلات PostgreSQL والمتحقق مسؤولية الرحلة المحفوظة وتقرير `V2.2-FINAL-ACCEPTANCE.md`؛ لا يصف هذا الملف تلك الرحلة بأنها ناجحة نيابة عنه.

## متابعة لاحقة: تسمية تقييم Python

أظهرت رحلة Chrome لاحقًا أن زر تحديد المستوى المعطل في مسار Python يحمل اسم الفيزياء بسبب فرع `else` ثنائي. عُدل نص `LearningPaths.tsx` إلى اختيار ثلاثي: الجبر/الفيزياء/Python. بقي الزر البرمجي معطلًا بالشرط نفسه؛ لا تفعيل Runner أو تغيير تقييم أو API.

| الأمر المنفذ بعد تعديل التسمية | النتيجة |
|---|---|
| `npx eslint apps/web/src/LearningPaths.tsx` | exit0 |
| `npx prettier --check apps/web/src/LearningPaths.tsx` | exit0 |
| `npm run typecheck --workspace @khotwa/web` | exit0 |
| `node --test apps/web/tests/learning-paths.test.mjs apps/web/tests/product-experience.test.mjs` | exit0؛21/21 PASS،0 failed/0 skipped |

لم يُضف اختبار يكرر النص حرفيًا لهذا التعديل الشكلي. نُسق البناء النهائي مع إصلاح تحميل الكتالوج الذي ظهر في رحلة Chrome كي يشمل التغييرين في بناء واحد؛ نتيجة ذلك البناء توثق مع تسليم وكيل التشغيل. أسماء ملفات البناء المذكورة في الجدول السابق تخص إصلاح fetch الأول، ولا تُستعمل لإثبات أن نسخة Chrome اللاحقة أعيد تحميلها.
