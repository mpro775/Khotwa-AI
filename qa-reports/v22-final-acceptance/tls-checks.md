# فحوص HTTPS المحلية — قبول V2.2 على Windows

- التاريخ: **2026-11-08 — Asia/Riyadh**.
- الحالة: **PASS لثقة Windows، وإزالة عائق HTTPS في Chrome الفعلي**.
- المصدر: طلب المستخدم تجهيز V2.2 للاختبار اليدوي دون تجاوز تحذير المتصفح أو تعطيل الحماية.
- الأداة الجديدة: [`tools/v22-local-https.ps1`](../../tools/v22-local-https.ps1).
- الأدلة العامة: [`V2.2-HTTPS-SETUP.json`](../V2.2-HTTPS-SETUP.json) و[`browser-results.json`](browser-results.json).

## الإصلاح ونطاق الثقة

أُنشئت شهادة خادم محلية ذاتية التوقيع، **وليست CA**؛ الامتداد `BasicConstraints` حرج ويحمل `CA:false`. أسماء SAN الوحيدة هي `DNS:localhost` و`IP:127.0.0.1`، والغرض الوحيد `TLS Web Server Authentication`. مفتاح RSA2048 مع SHA256 وصلاحية30 يومًا.

ثُبّتت **الشهادة المحددة وحدها** في `CurrentUser\Root` للمستخدم الحالي عبر الأمر الموثق `certutil.exe -f -user -addstore Root <managed cert.cer>`، بعد تحقق الأداة من البصمة ومطابقة PEM/DER والمفتاح العام وSAN والغرض وكونها غير CA. خيار `-user` يحصر التغيير في المستخدم، ولا يتغير مخزن الجهاز أو Chrome policies. لا wildcard ولا CA واسعة الصلاحية، ولا `ignore-certificate-errors` أو `NODE_TLS_REJECT_UNAUTHORIZED=0` أو إلغاء تحقق TLS.

ملفات الشهادة الجديدة في `.local/v22-tls/` منفصلة عن الشهادة السابقة في `.local/ph09-tls/`. المفتاح الخاص `key.pem` متجاهل من Git؛ صلاحيات الدليل محصورة بالمستخدم الحالي وSYSTEM، وفحص ACL المفتاح لم يجد أي Allow إضافي. لم يُضم المفتاح أو محتواه إلى الأدلة. لم تُعدّل أو تُحذف شهادات أخرى.

| الخاصية العامة | القيمة الفعلية |
|---|---|
| Thumbprint | `F4519BB5984D42A84540A8D167332CDE6CDBDD25` |
| SHA256 للشهادة DER | `C46DB9BDD5BC14B84CB0F19CBADA85E43607F2F479D4944265996DB98DF79271` |
| Subject / Issuer | `O=Khotwa AI local development, CN=localhost` |
| بداية الصلاحية | `2026-11-08T00:21:44Z` |
| نهاية الصلاحية | `2026-12-08T00:21:44Z`، الموافق03:21:44 صباحًا بتوقيت الرياض |
| اسم الاختبار | `https://localhost:8462` |
| المتجر المتغير | `CurrentUser\Root` فقط |

## الأوامر المنفذة والنتائج

| الأمر/الفحص | النتيجة الفعلية |
|---|---|
| `pwsh -NoProfile -File tools/v22-local-https.ps1 -Action Prepare` | exit0؛ أُنشئت شهادة جديدة والمفتاح ذو ACL محدود؛ قبل الثقة: `installedInCurrentUserRoot=false` وسلسلة Windows تفشل بـ`UntrustedRoot` |
| `pwsh -NoProfile -File tools/v22-local-https.ps1 -Action Trust` | exit0 عبر certutil؛ بعد التثبيت: `installedInCurrentUserRoot=true` و`windowsChainValidForServerAuth=true` و`chainStatus=[]` |
| `pwsh -NoProfile -File tools/v22-local-https.ps1 -Action Status` | exit0؛ أُعيد فحص الحالة في `2026-11-08T00:43:50Z`، دون تعديل ثقة الشهادات؛ ما زالت السلسلة صالحة للغرض serverAuth |
| محلل PowerShell AST للأداة |0 أخطاء تحليل |
| فحص ACL المفتاح الخاص |0 قواعد Allow خارج المستخدم الحالي وSYSTEM |
| `git check-ignore .local/v22-tls/key.pem` | المفتاح متجاهل فعليًا من Git |
| `git diff --check` للملفات المعنية | ناجح |

يعرض `eventHistory` في ملف JSON حدث التثبيت الأصلي الحقيقي: **قبل: false / UntrustedRoot، بعد: true / سلسلة صالحة**. لا تُستبدل هذه النتيجة التاريخية بنتيجة Status اللاحقة التي تكون فيها الثقة قائمة من البداية.

محاولة الاستيراد الأولية عبر `X509Store.Add` استدعت حوار أمان Windows؛ لم يُضغط عليه آليًا. تحقق الوكيل من أن العملية المعلقة تخص أداة Trust الخاصة به ثم أوقفها، واستُخدم استيراد certutil الأصلي المحدد أعلاه ضمن تفويض المستخدم الصريح لإصلاح HTTPS. الأداة النهائية تستعمل الطريقة الأصلية دون الحاجة إلى تجاوز تحذير Chrome.

## نتيجة Chrome الفعلية

أثبتت رحلة الفريق على **Chrome** في `https://localhost:8462` تحميل التطبيق الفعلي دون interstitial. يسجل [`browser-results.json`](browser-results.json) `tlsInterstitial:false`، ثم عمليات المعلم والتقييم والتدريب وإعادة القياس من الواجهة. هذه نتيجة متصفح حقيقية، وليست استنتاجًا من فحص الشهادة وحده. لا تتضمن هذه الوثيقة حكمًا مستقلًا بقبول محتوى الدروس تربويًا.

## التشغيل والاسترجاع

من جذر المشروع، في PowerShell7:

```powershell
pwsh -NoProfile -File tools/v22-local-https.ps1 -Action Prepare
pwsh -NoProfile -File tools/v22-local-https.ps1 -Action Trust
pwsh -NoProfile -File tools/v22-local-https.ps1 -Action Status
```

`Prepare` يعيد استخدام الشهادة المُدارة المطابقة ولا يكتب فوق ملفات قائمة. بعد انتهاء صلاحيتها يتوقف إعداد الثقة بدل استبدالها صامتًا. يعرض Status البصمة والصلاحية وحالة Windows دون كشف المفتاح.

عند إنهاء اختبار التطوير نهائيًا يمكن إزالة **هذه الشهادة وحدها** من ثقة المستخدم:

```powershell
pwsh -NoProfile -File tools/v22-local-https.ps1 -Action RemoveTrust
```

الاسترجاع يتحقق من الشهادة المُدارة وبصمتها الكاملة ثم يستخدم `certutil.exe -user -delstore Root <exact thumbprint>`، ويترك الملفات وبيانات الاختبار والشهادات الأخرى محفوظة. **لم يُنفذ RemoveTrust في التسليم الحالي** حتى تبقى نسخة الاختبار اليدوي جاهزة للمستخدم؛ لا يُدّعى اختبار إزالة وإعادة تثبيت لم يحدث.
