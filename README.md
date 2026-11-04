# Khotwa AI — خُطوة

أساس تطوير محلي للنسخة العربية التشخيصية. **PH-05 منفذة تقنيًا ومكتملة جزئيًا من حيث القبول**: واجهة ضيف وخطوات مرتبطة بـNestJS وPostgreSQL ومحرك Python الحقيقي. [تقرير PH-05](qa-reports/ph05-delivery.md) و[محضر GATE-1 المحجوبة](qa-reports/gate-1.md). فحص Chrome التفاعلي مؤجل بقرار المالك، والهاتف واختيار المحرر ومراجعة المحتوى وGolden وتوقيعات المختصين معلقة.

## قرار الدخول والنطاق

[GATE-0 معتمدة بتفويض مسؤول المشروع](qa-reports/gate-0.md)، مع [سجل القرار](planning/gate0-closure.json). المحضران صادران بتفويض المسؤول، وليسا توقيعين مباشرين من المراجعين. وافق المالك على PH-01 ثم أمر بالمراحل PH-02…05، واعتمد Prisma مع SQL المكمّل. تظل GATE-1…4 غير معتمدة؛ لا تنفيذ PH-06 وما بعدها.

## إعداد محلي

الأدوات المختبرة موثقة في [تقرير PH-01](qa-reports/ph01-delivery.md). npm lock وPython locks يثبتان الاعتماديات. Node 24.11.1 هو إصدار الحاويات وCI؛ استُخدم Node 26.7.0 على الجهاز أيضًا.

PowerShell من جذر المشروع:

```powershell
npm ci --no-audit --no-fund
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r services/math-engine/requirements-dev.lock
npm run contracts:check
npm run verify
```

على Linux يستبدل مسار Python بـ`.venv/bin/python`. بقية scripts تختار مسار البيئة تلقائيًا. `npm run contracts` يجدد نسخ العقود والأنواع؛ `contracts:check` يكشف الانحراف دون تغيير المصدر.

## تشغيل الحاويات

```powershell
npm run env:local
docker compose --env-file .local/compose.env up --build -d
npm run smoke:compose
```

الواجهة المحلية: [http://127.0.0.1:8080](http://127.0.0.1:8080). هذا تطوير محلي عبر HTTP، وليس نشر demo عامًا أو إعداد production/HTTPS. API خلف proxy، و`/internal` محجوب من الواجهة العامة. لا منفذ host لـPostgreSQL أو Python أو API. فحوص الصحة الداخلية تتطلب bearer token منفصلًا، وready يعتمد اتصال DB وخدمة Python فعلًا.

الأسرار المحلية تولد في `.local/compose.env` ولا تطبع قيمها أو تدخل Git. `.env.example` حقوله السرية فارغة. لا مفاتيح AI أو حسابات طلاب؛ AI معطل. لإيقاف بيئة هذا المشروع دون حذف بيانات volume:

```powershell
docker compose --env-file .local/compose.env down
```

لواجهة Vite مستقلة: `npm run dev:web` (loopback). يمكن تشغيل API بعد build باستخدام `node --env-file=.local/compose.env apps/api/dist/main.js`؛ دون DB/math متصلين يعيد ready خطأ 503 مطابقًا للعقد، ولا يدعي الجاهزية.

## العقود والبذور

المصدر العام الوحيد [docs/12-API-CONTRACT.yaml](docs/12-API-CONTRACT.yaml). النسخة تحت packages/contracts مشتقة مطابقة بالبايت، والأنواع مولدة لا تعدل يدويًا. لا استدعاء مباشر من المتصفح إلى Python. PH-05 توصل React بالعمليات العامة الموجودة وتجمع نتائج parse/verify/check-final الخاصة دون تغيير العقد أو AST. مدققات الويب مولدة مسبقًا لتعمل مع CSP دون unsafe-eval.

`npm run seed:demo` يولد seed اصطناعيًا خاصًا في `.local/synthetic-seed.json` بصورة قابلة للتكرار: 3 معرفات توضيحية و18 بذرة غير مراجعة وغير منشورة؛ publishedProblems فارغة. هذه fixture محلية وليست seed لقاعدة PostgreSQL، ولا تظهر في حزمة الويب أو API. ترحيلات PH-04 مستقلة ولا تنشر هذه المسائل أو تمنحها مراجعة بشرية.

## الفحوص

`npm run verify` يشغل فحص نسخ العقود والتنسيق وlint والأنواع والبناء وفحص التأسيس وnative smoke، ويسجل النتائج في `qa-reports/ph01-checks.json`. `smoke:compose` يفحص شبكة الحاويات وreadiness الحقيقية وحجب المسارات والأصول الثابتة، دون اختبارات تحميل أو قبول تربوي أو أمني شامل. CI يستخدم scripts نفسها؛ لا نشر أو اتصال بطلاب حقيقيين.

تعليمات العمل [AGENTS.md](AGENTS.md)، وخطة المرحلة [planning/ph01-plan.md](planning/ph01-plan.md)، والتسليم [qa-reports/ph01-delivery.md](qa-reports/ph01-delivery.md).

## تجربة محرر PH-02

```powershell
npm run dev --workspace @khotwa/web -- --port 5173
npm run verify:ph02
```

افتح [مختبر المحرر](http://127.0.0.1:5173/editor-lab). يمكن تعديل النص الأصلي والنسخ واللصق واستخدام لوحة الأرقام والرموز. قسم «مختبر MathLive القابل للتفاعل» يفتح المرشح الأول. المختبر مستقل عن رحلة PH-05، وكل المصادر والخطوط محلية؛ لا AI أو إرسال محاولات من هذا المختبر.

المعاينات المنظمة ووصف المعنى مقصوران على أمثلة PoC المحددة، والرسائل حراس سطحية/عينات واجهة؛ ليسا محللًا عامًا أو حكمًا رياضيًا. الصيغة الجديدة في المحرر تبقى مسودة دون اتصال بالمحرك. صورة web على 8080 ما زالت من PH-01؛ حاوية الرياضيات وحدها حدثت في PH-03. [خطة PH-02](planning/ph02-plan.md)، [دليل الأجهزة](qa-reports/rtl-device-checklist.md)، [حالة DR-007](planning/ph02-editor-decision.md).

## محرك PH-03

بعد تثبيت متطلبات إعداد PH-01 أعلاه، ومع توفر بناء API التأسيسي لفحص smoke:

```powershell
npm run test:math
npm run verify:ph03
npm run verify:ph03:container
```

الأمر الأول يشغل اختبارات المحرك فقط. الثاني يفحص التنسيق وlint والأنواع والتجميع والوحدة والأمان و97 حالة Golden تطويرية والعقد/HTTP الداخلي وsmoke التأسيسي. عند غياب `apps/api/dist/main.js` في checkout جديد نفذ `npm run build --workspace @khotwa/api` أولًا. فحص الحاويات اختياري أثناء التطوير: يبني ويحدّث math-engine المحلي فقط، ثم يشغل probe Linux مؤقتًا دون شبكة أو منافذ. لا DB migrations أو نشر عام. CI أضيف إليه الفحص المستهدف، ولم ينفذ CI البعيد في هذا التسليم.

المحرك `0.3.0`، وwire=`math-internal-v1` وAST=`math-ast-v1`، والمتغير س والمجال reals. Python لا يخزن محاولات ولا يصدر حكمًا تعليميًا أو completed. حدود وقت/ذاكرة التجربة موثقة في [سجل الموارد](planning/ph03-resource-decision.md) ولا تعني اعتماد تشغيل إنتاجي. [الفحوص](qa-reports/ph03-checks.json)، [نتائج Golden التطويرية](qa-reports/ph03-golden-results.json)، [العقد](qa-reports/ph03-contract-results.json)، [تقرير التسليم](qa-reports/ph03-delivery.md).

## بيانات وAPI المرحلة PH-04

```powershell
npm run verify:ph04
npm run verify:ph04:container
```

Prisma 7.10.1 وSQL المكمّل معتمدان من المالك لتنفيذ هذه المرحلة. نُفذت جلسات الضيف وCSRF/Origin والملكية والكتالوج وصفحات المحاولات وعمليات الخطوات مع revision وIdempotency-Key والتاريخ والإبطال. لا محتوى مرجعي نشرته الترحيلات، ولا مزود AI مفعل. [دليل التشغيل والحدود](planning/ph04-local-run.md)، [التسليم](qa-reports/ph04-delivery.md).

فحص الحاويات ينشئ PostgreSQL وشبكة معزولين بلا منافذ أو بيانات حقيقية، ويختبر migrations وrollback وNestJS HTTP ثم يزيل موارده. تشغيل API الجديد يتطلب `PH04_API_ENABLED=true` بعد تهيئة migrations وأصل HTTPS والأسرار والإعدادات الصريحة. Compose التأسيسي يظل false افتراضيًا؛ لا يُضعف Cookie Secure أو Origin/CSRF لأجل HTTP المحلي.

## تكامل PH-05

```powershell
npm run verify:ph05
npm run verify:ph05:container
npm run dev:ph05
```

بيئة HTTPS مستقلة على [https://localhost:8443/](https://localhost:8443/)، ببيانات اختبار اصطناعية صريحة؛ تعزل منافذ Python وDB وتحفظ الخام وAST والعرض منفصلة. التحقق يربط النتيجة بالنسخ، ويرفض الرد المتأخر، ولا يعتمد اكتمال السلسلة من جواب نهائي صحيح بعد انتقال خاطئ. لا تشخيص أو تلميح أو تقدم مهارة في هذه المرحلة.

شهادة localhost ذاتية التوقيع ولا يغير التشغيل مخزن الثقة. Chrome توقف عند تحذير الشهادة، واختار المالك إكماله يدويًا لاحقًا؛ لا اختبار تفاعلي أو صور PH-05 حتى ذلك. الهاتف غير متاح. [دليل التشغيل والفحص المتبقي](planning/ph05-local-run.md)، [الأدلة](qa-reports/ph05-delivery.md). نجاح HTTPS البرمجي واختبارات المسودة لا يعتمدان GATE-1.
