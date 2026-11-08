# 21 — الأمن والخصوصية وقصّر السن والحدود التشغيلية

## الأساس الموروث
حراس `accounts.ts` و`learning-access.ts` و`productMutation` و`ARecords` وB `lab-service.ts`: auth, CSRF, Origin, Idempotency-Key, `owner_key`, CAS, synthetic mode، عرض student projection خاص. **كل endpoint جديد يجب أن يثبت عدم الالتفاف عليها**.

## مخاطر C1/C2
- Prompt injection من نص سيناريو/منتج طالب أو ملاحظات مشروع: لا يدخل أدوات إدارية/LLM كتعليمات موثوقة؛ sanitize output وhuman approve.
- تسرّب solution key/hidden tests/privateRubric في JSON أو SSR أو logs أو export: strict DTO whitelist واختبار snapshot للطالب.
- IDOR: طالب يحاول قراءة مشروع طالب آخر أو reviewer يتجاوز scope، يجب 404/403 دون بيانات داخل الخطأ.
- Concurrent submissions: `expectedRevision`, atomic status transition, dedup idempotency لكل POST، لا overwrite late response.
- Code text artifacts: تعامل معها كبيانات نصية فقط؛ no exec/eval/HTML render ولا Runner بغير ترخيص وعزل مُثبت.
- الملفات: النسخة الأولى بدون upload UGC؛ أي فتح لاحق يحتاج malware/MIME/storage/quarantine/presigned URL policy وموافقة أمن.

## مخاطر C3
التمثيلات المرئية والنصية يجب أن لا تختلف في حكم التقييم دون مراجعة construct validity؛ لا تجعل الرسم يكشف الجواب الصحيح مبكرًا لو كان المطلوب اشتقاقه باستقلال. تفضيلات تكبير النص/تقليل الحركة ليست دليلًا على الإعاقة ولا بيانات تستخدم للتمييز.

## مخاطر C5
- لا أسماء/بريد/IP أو raw answer/code/chat في analytics event افتراضيًا؛ تقليل البيانات من المصدر، وليس «إخفاء الأعمدة في UI» فقط.
- Pseudonymization ليست إخفاء هوية كاملًا؛ لازم owner scoping وaccess audit وretention/deletion.
- teacher dashboard: تأكد من وجود cohort/assignment scope؛ **المصدر الذي فُحص لا يمنحنا دليلًا على teacher↔student cohort association صالحًا لكل الطالب**، لذا لا تعرض تقارير فردية لمعلم بلا علاقة مصرح بها.
- الجماعات الصغيرة: اختبر إعادة التعرف عبر الفلاتر؛ اخفِ aggregations الصغيرة والتقاطعات النادرة. عتبات k تحددها سياسة مراجعة الخصوصية.
- لا تعرف الطالب عبر مستويات «ذكاء» أو أحكام سلبية أو traits؛ لا تدخل بيانات حساسة أو تجارب سلوكية غير مصرحة.

## موافقة/تشغيل
- إن كان المستخدم قاصرًا، يلزم قرار قانوني/تنظيمي خاص بالسن والولاية القضائية وآلية الوالد/ولي الأمر حسب المنطقة، وليس افتراضاً أن جميع المستخدمين بالغون.
- لا تضع مفاتيح Gemini/Runner/SMTP في Markdown أو logs. flags OFF في env.example. لا اتصالات خارجية/تكلفة تشغيل تلقائيًا.
- C config جديدة مثل `C_PROBLEM_LEARNING_ENABLED=false`, `C_PROJECT_LEARNING_ENABLED=false`, `C_UDL_STUDIO_ENABLED=false`, `C_LEARNING_ANALYTICS_ENABLED=false`, مع حراسة synthetic-only خادمية وواجهة؛ تسمية/قيم نهائية توثق في `.env.example`.
- تحقق من backup وrestore على قاعدة اختبار، وسيناريو إغلاق Feature مع الجلسات القائمة دون محو الأثر.

## قبول الأمن
مصفوفة auth/IDOR/public-private/export/claim/deletion/races/duplicate submission/content injection/quota/retention/publish gating، والنتائج الفعلية مع dates وcommands وhashes. أي blocker عالي لا يُغلق بتغيير expected test.
