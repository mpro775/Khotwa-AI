# V2.2 — فحوص أداة الاختبار اليدوي المحفوظة

- التاريخ: 2026-11-08، Asia/Riyadh.
- الحالة: **PASS للفحوص المصدرية المحددة أدناه**؛ نتائج رحلة Chrome يملكها التقرير الموحد `qa-reports/V2.2-FINAL-ACCEPTANCE.md`، وليست مفترضة من نجاح هذه الفحوص.
- المرجع: `TASK-LP-04/05/06/07` والاستعداد للاختبار اليدوي ضمن V2.2؛ لا V2.3 ولا Beta حقيقي.
- النطاق: أداة محلية على Windows، PostgreSQL اختبار محفوظ، NestJS فعلي ومحرك Python/SymPy الخاص، وملفات React المبنية من المصدر.

## الملفات التي راجعها هذا الفحص

| الملف | المسؤولية |
|---|---|
| `tools/serve-v22.mjs` | تشغيل/إيقاف بيئة محلية مستقلة، إعداد عشوائي خاص محفوظ بـACL، named volume، استئناف، وتصدير دليل محدود |
| `qa/v22-manual-seed.mjs` | fixtures اصطناعية عبر البنك والمتحققات الفعلية، حسابات اختبار داخلية، seed ذو marker محفوظ؛ لا استبدال مراجعات أو محاولات |
| `qa/v22-manual-http.mjs` | HTTPS على localhost8462، built React assets، وكيل إلى NestJS loopback، helpers اختبار محلية، وسجل طلبات بلا cookies أو أجسام طلبات |
| `docs/V2.2-WINDOWS-MANUAL-TESTING.md` | أوامر Windows وروابط الطالب والمعلم، الصلاحيات الاصطناعية، الشهادة وإلغاء ثقتها لاحقًا، الحفظ وعدم حذف volume |
| `apps/web/src/ProductShell.tsx` | تأخير طلب البنك حتى فتحه صراحة، وإبطال الرد القديم عند تبديل الهوية |
| `apps/web/tests/legacy-catalog-exposure.test.mjs` | انحدار موجّه لتحميل البنك والتحديث وتبديل الهوية |

## الأوامر التي نُفذت فعليًا

البيئة: Windows، Node v26.7.0، تبعيات المستودع المثبتة. كل أمر أدناه انتهى بـexit code0.

| الأمر | النتيجة |
|---|---|
| `node --check tools/serve-v22.mjs` | PASS، لا أخطاء syntax |
| `node --check qa/v22-manual-http.mjs` | PASS، لا أخطاء syntax |
| `node --check qa/v22-manual-seed.mjs` | PASS، لا أخطاء syntax |
| `node node_modules/eslint/bin/eslint.js tools/serve-v22.mjs qa/v22-manual-http.mjs qa/v22-manual-seed.mjs` | PASS، لا مخالفات |
| `node node_modules/prettier/bin/prettier.cjs --check tools/serve-v22.mjs qa/v22-manual-http.mjs qa/v22-manual-seed.mjs` | PASS؛ `All matched files use Prettier code style!` |

لم تُشغّل في جولة الفحص هذه اختبارات حمل، أو build شامل جديد، أو أي requests تعدّل البيانات. لم توقف البيئة أو تغيّر قاعدة البيانات أثناء متابعة رحلة Chrome.

## مراجعة التشغيل والاحتفاظ

- الـrunbook يحدد متطلبات PowerShell7 وOpenSSL وNode/npm وDocker والصور المحلية، وبدء التشغيل من جذر المستودع.
- الروابط الفعلية: الطالب أ `https://localhost:8462/__v22/student-a`، المعلم `https://localhost:8462/__v22/teacher`، الطالب ب `https://localhost:8462/__v22/student-b`.
- حساب المعلم الاصطناعي `admin` في قاعدة اختبار فقط حتى يمكن فحص دورة المراجعة والنشر الموجودة. الشريط الأصفر يوضح أن هذا لا يمثل اعتمادًا تربويًا بشريًا.
- أداة التشغيل تقصر host والوكيل على loopback والوجهة الخاصة المحددة. لا تقبل absolute-form أو network-path request targets، ولا تمرر `/internal/*` إلى الخدمة الخاصة، ولا تختار هوية عبر خصائص prototype.
- static assets مقيدة بمجلد `apps/web/dist` مع فحص المسار الحقيقي؛ يحل ذلك تعثر عرض CommonJS المحلي من وضع Vite dev دون تغيير منطق التحقق في React.
- الإيقاف يستخدم stop file ثم يغلق الخدمة ويوقف الحاويتين المملوكتين للأداة، دون remove/delete للـvolume أو البيانات. يجب انتظار رسالة التوقف قبل إعادة التشغيل.
- أسرار البيئة وcookies تبقى في `.local/v22-manual/private-config.json` المحمي للمستخدم الحالي وSYSTEM؛ لا تُدرج في Git أو هذا التقرير.
- ترجع البيانات والمراجعات والمحاولات من PostgreSQL named volume. علامة الـseed تمنع إعادة النشر أو الكتابة فوق تعديلات المختبر عند إعادة التشغيل.
- `--evidence` يصدّر نسخ المحتوى والتقييم وتقارير المحرك وledger HTTP دون raw answers أو مفاتيح حلول أو tokens. يؤخذ snapshot النهائي بعد انتهاء رحلة Chrome.

## فحوص التشغيل السابقة لرحلة Chrome

أُجريت أثناء تجهيز البيئة وقبل بدء جولة المتصفح الحالية: rootHTTPS200 بتدقيق شهادة Windows الطبيعي، helper المعلم302 مع cookie تحمل `HttpOnly; Secure; SameSite=Lax`، و`GET /api/v1/me` أعاد دورadmin داخليًا من PostgreSQL. رفض helper الطلب الموصوف cross-site403. سجل الوكيل احتفظ بـ`X-Request-Id` الصادر من NestJS. هذه فحوص نقل وهوية محدودة، ولا تُعرض بديلًا لنتائج Chrome.

أُوقف التشغيل وأعيد قبل بدء الاختبار الحالي مع استمرار نفس named volume وهويات المحتوى؛ ثم تُركت البيئة عاملة بعملية Windows مخفية. لم يُنفذ إيقاف أو طلب تعديل في جولة مراجعة الـrunbook والفحوص المصدرية أعلاه.

لا تمنح هذه النتائج اعتماد محتوى، أو قبول عزل Runner، أو إذن تشغيل بيانات حقيقية. وضع Python للقراءة، وAI وRunner وBeta متوقفة.

## انحدار كُشف في Chrome — تحميل البنك قبل الطلب

لاحظت رحلة الفيزياء أن القياس الجديد امتنع رغم وجود6 أسئلة مختلفة. الاستعلام القرائي أثبت اختلاف جميع `context_key` لكن وجود12 تعرضًا (كل الأسئلة الستة لهويتين). كان `ProductShell` يجلب `/catalog` تلقائيًا عند المصادقة، و`ContentStudioService.catalog` يسجل تعرضًا لكل سؤال فيزياء أرسله؛ لذلك كان رفض novelty سليمًا. لم تُمسح تلك التعرضات ولم تُخفف القاعدة.

الإصلاح في `apps/web/src/ProductShell.tsx` يؤخر طلب catalog حتى فتح البنك القديم صراحة أو تحديثه؛ يُغلق البنك ويُرفض رده المتأخر عند تبديل الهوية. أُضيفت هوية الطالب ج الاصطناعية إلى أداة الاختبار، مع بقاء هوية أ وب وجميع محاولاتهما.

الفحوص المنفذة بعد الإصلاح:

| الأمر | النتيجة |
|---|---|
| `node --test apps/web/tests/legacy-catalog-exposure.test.mjs` |2/2 PASS؛ لا fetch تلقائي عند المصادقة، فتح البنك يطلبه مرة، التحديث يبقى متاحًا، والرد القديم لا يظهر لهوية جديدة |
| `node --test apps/web/tests/learning-paths.test.mjs apps/web/tests/product-experience.test.mjs apps/web/tests/legacy-catalog-exposure.test.mjs` |23/23 PASS |
| `node node_modules/eslint/bin/eslint.js apps/web/src/ProductShell.tsx apps/web/tests/legacy-catalog-exposure.test.mjs tools/serve-v22.mjs qa/v22-manual-http.mjs qa/v22-manual-seed.mjs` |PASS، exit0 |
| `npm run build --workspace @khotwa/web` |PASS؛ TypeScript وفحص Vite، تحذير حجم chunks المعروف فقط |

يشمل البناء نفسه تصحيح أسماء المواد في `LearningPaths.tsx` المنسق مع وكيل المحتوى. أُعيد تشغيل البيئة بعد إذن قائد المهمة وحفظ snapshot ما قبل الإيقاف، دون مسح البيانات؛ نتائج استئناف Chrome والفيزياء بعد الإصلاح تسجّل في التقرير الموحد.

## الفحص النهائي بعد البناء وإعادة التشغيل

- البناء المنفذ هو `npm run build --workspace @khotwa/web`: انتهى بـexit code0، نجح TypeScript وVite، وحوّل Vite52 modules. التحذير الوحيد عن chunks أكبر من500kB؛ لم يُجرَ تغيير لإعدادات الحماية أو الاختبارات لإسكاته.
- أُعيد التشغيل بإذن قائد المهمة في عملية Windows مخفية، PID27996، وبقيت البيئة عاملة على `https://localhost:8462`. أضيف الطالب ج الاصطناعي دون تعديل محاولات أ وب أو تعرّضاتهما.
- مقارنة snapshot قبل الإيقاف وبعده في `persistence-restart-comparison.json` أعطت `CountsEqual/ContentEqual/AssessmentsEqual/ReportsEqual/SubjectsEqual: true`:8 نسخ محتوى،30 حدث محتوى،4 تقييمات،16 عنصر تقييم،15 محاولة جبر،16 نسخة خطوة،16 تقرير تحقق، ومحاولة مادة واحدة محفوظة حين المقارنة.
- بعد إعادة الاختبار الفعلي في Chrome، نفذ أمر `node tools/serve-v22.mjs --evidence` بنجاح في `2026-11-08T00:48:55.255Z`. أضاف التصدير روابط عناصر التقييم بالمحاولات وتقارير المحرك، ودرجات المساعدة والتوصيات، دون الإجابات الخام أو هويات المتعلمين. كانت محاولة التصدير الأولى بعد هذا التوسيع قد أخفقت بسبب `attempts.created_at` غير الموجود؛ صُحّح الاستعلام إلى `opened_at` وفق migration الفعلي ثم نجح التصدير. لم يتغير مخطط البيانات.
- الأعداد النهائية المصدرة:8 نسخ محتوى،30 حدث محتوى،5 تقييمات،18 عنصر تقييم،14 حدث درس،6 أحداث توصية،15 محاولة جبر،16 نسخة خطوة،16 تقرير تحقق،3 محاولات مادة. الزيادات ناتجة عن رحلة Chrome التالية لإعادة التشغيل، وليست من أمر التصدير القرائي.

الفحوص الختامية نُفذت بعد تعديل أداة التصدير؛ كلها exit code0:

```powershell
node --check tools/serve-v22.mjs
node --check qa/v22-manual-http.mjs
node --check qa/v22-manual-seed.mjs
node --check apps/web/tests/legacy-catalog-exposure.test.mjs
node node_modules/eslint/bin/eslint.js tools/serve-v22.mjs qa/v22-manual-http.mjs qa/v22-manual-seed.mjs apps/web/src/ProductShell.tsx apps/web/tests/legacy-catalog-exposure.test.mjs
node node_modules/prettier/bin/prettier.cjs --check tools/serve-v22.mjs qa/v22-manual-http.mjs qa/v22-manual-seed.mjs apps/web/src/ProductShell.tsx apps/web/tests/legacy-catalog-exposure.test.mjs
```

يوضح دليل Windows الآن اشتراك تبويبات Chrome profile نفسه في cookie الحساب، واستخدام روابط الشريط داخل الموقع عند رفض انتقال helper خارجي بكود403، وتسلسل إعادة قياس الجبر والفيزياء من المسارات دون فتح البنك قبل القياس. لا تحتاج هذه الفحوص إعادة تشغيل أخرى؛ بقيت الخدمة والبيانات محفوظتين.
