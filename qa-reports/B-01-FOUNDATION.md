# KHOTWA B — B-01 foundations

- التاريخ: 2026-11-08؛ baseline `f210aec`؛ الفرع `codex/intelligent-learning-a`.
- الحالة: جاهز لمراجعة المصدر؛ القبول العلمي/التشغيلي مستقل.
- المعرفات: B-01، B1-T09، B2-T01/03، B3-T04/09؛ نفس ثوابت الملكية والإصدارات والأمن للمنتج.

## المنفذ

`subject_lab_activity` يحمل schema/subject/kind/objective/family/skills وdomainSpec مؤلفة داخل نسخة الدرس. parser مغلق حسب المادة، ويمنع SK-ALG-08 والأنواع والحقول غير المعروفة. DTO الطالب يحذف domainSpec كلها؛ activity endpoint يعرض إسقاطًا عامًا مخصصًا دون rubrics/مفاتيح إجابة. Studio يستخدم author schemas منفصلة ودورة المراجعة القائمة؛ لا نشر آلي للمسودات.

العقد `1.5.0-development`: سبعة مسارات تحت `/api/v1/learning/labs`؛ capabilities، activity، إنشاء/استئناف session، events، submit، result. كل كتابة CSRF/Origin وIdempotency، وكل قراءة/كتابة مملوكة وخلف synthetic-only. التفعيل مغلق افتراضيًا؛ إعادة الطلب من cache لا تتجاوز إغلاق العلم لاحقًا.

الحالة والأحداث في `intelligent_learning_records/events` القائمة بنوع `lab`. الترحيل 0024 يوسع allowlist وفهرسًا فقط؛ أُثبت تطبيقه على قاعدة Docker جديدة يملكها الاختبار، دون قاعدة قائمة أو إنتاج. claim وretention يستخدمان المسار القائم؛ تصدير الحساب يضيف projection آمنة لبيانات المختبر دون المواصفات الخاصة أو proofs.

الإجابة تُحفظ أولًا بمعاملة قصيرة؛ Math/Physics خارج المعاملة، ثم CAS قبل حفظ النتيجة. تحفظ تقارير المجال الحقيقية خصوصيًا بحد حجم، وتعرض نتيجة حيادية عند التعطل. تعديل المعاملات يبطل المشتقات، والتوقع لا يتغير بعد تثبيته. تسجيل التعرض يشمل GET-only ونسخ المعاملات المتعاقبة، ويحترم توقيت الدليل السابق.

## الأدلة

`B-CONTRACTS.md`، `B-INTEGRATION.json` (14/14 تكامل فعلي)، واختبارات `stem-lab-state.test.mjs` و`stem-contracts.test.mjs`. الفحوص الشاملة وأعدادها النهائية في `B-FINAL-CHECKS.json`. لا أسرار أو توقيع بشري في fixtures؛ البيئة مصطنعة وموارد الاختبار أزيلت.
