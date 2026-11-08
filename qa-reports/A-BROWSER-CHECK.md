# A-UX-01 — محاولة الفحص في Chrome

- التاريخ: 2026-11-08، Chrome عبر computer-use، تبويب اختبار مستقل.
- الهدف: واجهة الطالب في بيئة PostgreSQL/Math/NestJS/Vite الاصطناعية المؤقتة، لا بيئة العرض القائمة.
- URL: `https://127.0.0.1:8461/__v22_test_student`.
- النتيجة الفعلية: **BLOCKED_CERTIFICATE**؛ أبلغ المتصفح `net::ERR_CERT_AUTHORITY_INVALID` عند التنقل، فلم تصل الأداة إلى واجهة التطبيق.
- لم يُتجاوز التحذير ولم تتغير ثقة الشهادات أو إعدادات الأمان، ولم يُنفذ إدخال طالب أو اعتماد محتوى من المتصفح.
- [مهارة computer-use](C:/Users/PC/.codex/plugins/cache/openai-bundled/computer-use/26.1023.51421/skills/computer-use/SKILL.md) تلزم بقراءة [سياسة التأكيد](C:/Users/PC/.codex/plugins/cache/openai-bundled/computer-use/26.1023.51421/docs/confirmations.md)؛ بند Hand-Off Required يقول: “Bypass Windows/browser/web safety barriers” ويشمل “site not secure” HTTPS interstitial bypass. لذلك يحتاج صاحب الجهاز إلى معالجة الشهادة المحلية بنفسه قبل استئناف الفحص المرئي، وليس إذنًا عامًا للوكيل بتجاوز التحذير.

اختبارات React/SSR/decoders والبناء مسجلة في A-UI وA-CHECKS، واختبارات HTTP مع محرك المجال والقاعدة في A-INTEGRATION. لا تسمى هذه النتائج قبول Chrome بصريًا أو اختبار هاتف/قارئ شاشة فعلي. أُوقف preview بعلامة الإيقاف الخاصة به، وتزيل أداة الاختبار حاوياتها المؤقتة؛ لم تُمس خدمات العرض القائمة.
