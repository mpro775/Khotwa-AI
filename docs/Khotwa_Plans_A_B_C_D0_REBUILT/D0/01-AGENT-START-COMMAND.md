# أمر الوكيل التالي — KHOTWA D0 Readiness / Acceptance

أنت تعمل على **سورس Khotwa AI الأحدث الذي يضم A1–A8 وB1–B3 وC1–C5**. اقرأ أولًا:

- `qa-reports/A-INTELLIGENT-LEARNING-FINAL-ACCEPTANCE.md`
- `qa-reports/B-FINAL-ACCEPTANCE.md`
- `qa-reports/C-ADVANCED-LEARNING/C-FINAL-ACCEPTANCE.md`
- `qa-reports/C-ADVANCED-LEARNING/C-RELEASE-CANDIDATE.json`
- `qa-reports/V2.2-CONTENT-INVENTORY.md`
- `qa-reports/V2.2-MURAD-REVIEW-CHECKLIST.md`
- `docs/KHOTWA-C-ADVANCED-LEARNING/23-STUDENT-JOURNEYS-AND-REVIEW.md`
- وقائمة التدقيق `Khotwa-AI-ABC-Audit-and-Next-Steps-2026-11-08.md` إن وُضعت بجذر docs.

## الهدف الآن

**لا تبدأ ميزات D جديدة.** مهمتك هي تدقيق اكتمال وتسليم A/B/C، وتحديد طريق قبولها مع بيانات/طلاب حقيقيين، ثم إغلاق ما يمكن إغلاقه برمجيًا ضمن بيئة اصطناعية فقط. لا يعتبر source-complete = release-approved.

## العمل المطلوب

1. تحقق من `git status`, baseline, branch, source diff، واصنع manifest نهائيًا مطابقًا للمصدر؛ فحص خارجي وجد اختلافات في SHA256 لـ`.env.example`, `AGENTS.md`, `README.md` مقارنة بـ`C-RELEASE-CANDIDATE.json` (96/99 متطابقًا). اشرح السبب، ولا تكتف بتغيير SHA إذا كانت تعديلات حساسة لم تُراجع.
2. افحص فعليًا `apps/api/src/intelligent-learning-data.ts:authorizeA()` وحارس `requireAdvancedIdentity()` في `learning-path-content.ts` والـflags. أخرج تصميمًا تقنيًا آمنًا لانتقال تدريجي من synthetic-only إلى approved-real-learning، بالسياسات والصلاحيات وسجلات اعتماد بشرية منفصلة؛ **لا تفتح الإنتاج أو تحذف حارسات الأمان الآن**.
3. جهز سجل blockers مع المسؤول ودليل الإغلاق لكل من GOLD-DIAG-015، ERR-ALG-05/SK-ALG-06، SK-ALG-08، بنك الأسئلة وتغطية المناهج، المراجعات البشرية للمختبرات والمشكلات والمشاريع وUDL/التحليلات.
4. حدد رحلة قبول عربية قصيرة في جبر توزيع الأقواس مع اختبار تشخيصي وتلميح ومسألة C1 ومشروع C2 وتمثيل C3 ومراجعة C4 ومؤشر C5، ثم قياس مستقل مؤهل؛ دون التلاعب بـnovelty أو المراجعات. استخدم fixtures فقط حتى الاعتماد.
5. إن سمحت بيئة الوكيل وخوّل المالك استخدام بيئة اصطناعية، شغّل الاختبارات الموجهة `npm run test:intelligent`, `npm run test:labs`, `npm run test:advanced`، واختبارات تكاملها بعد التأكد من أنها تنشئ قواعدها الجديدة فقط. لا تدّع تشغيل اختبار لم تنفذه، واكتب البيئة والأوامر والنتيجة.
6. خطط لاختبار Chrome/RTL/LTR/keyboard/mobile/zoom/screen reader/slow network بطريقة موثقة؛ لا تعتمد SSR وحده. لا تتجاوز شهادة متصفح أو سياسة حوسبة آمنة.
7. أنشئ سياسة مقترحة للانتقال التجريبي تحدد موافقة القاصرين عند اللزوم، الخصوصية، RBAC، النسخ الاحتياطية، تطبيق migrations على staging من نسخة قاعدة قائمة، وتعطيل الميزات الحساسة افتراضيًا. اترك ما يحتاج اعتماد مالك/مختص في status PENDING ولا توقّع نيابة عنهم.

## الملفات المطلوبة من الوكيل

- `qa-reports/D0-RELEASE-INTEGRITY.md`
- `qa-reports/D0-BLOCKERS-AND-OWNERS.md`
- `qa-reports/D0-REAL-LEARNING-DESIGN.md`
- `qa-reports/D0-MANUAL-ACCEPTANCE-PLAN.md`
- `qa-reports/D0-FINAL-READINESS.md`

تقرير النهاية يميز `SOURCE`, `AUTOMATED_TESTS`, `HUMAN_REVIEW`, `MANUAL_UI`, `SECURITY`, `CONTENT`, `STAGING`, `REAL_BETA`. لا تضع PASS لأي بند لم يثبت. **توقف بعد D0 وأرسل التقرير للمراجعة؛ لا push/deploy/production migration أو تفعيل خدمة خارجية دون إذن مستقل**.
