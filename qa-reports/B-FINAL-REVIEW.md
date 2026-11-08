# KHOTWA B — مراجعة أخيرة للتعرض والقياس

- التاريخ: 2026-11-08؛ مراجعة مصدرية قراءة فقط للـSQL في StemLabService.exposure ومستهلكيه في LearningAssessmentService ومحركات الحفظ الحالية.
- بدأت المراجعة قراءة فقط. بعد ظهور حالتين محددتين فُوض تصحيح helper واختبارات انحدار ضيقة. لم تتغير السياسة أو قاعدة البيانات، ولم تُشغل فحوص واسعة.

## SQL وترتيب الأحداث

`FOR UPDATE OF i,a` صالح مع LEFT JOIN على studio_revisions؛ القفل يخص learning_assessment_items وlearning_assessments، وهما الطرفان غير القابلين للغياب في الربط. لا محاولة لقفل الطرف nullable.

تستبعد NOT EXISTS السلسلة الجبرية الحالية المنتهية بحل مكتمل أو خطأ متحقق، والنتيجة الفيزيائية الحالية correct/wrong_value/wrong_unit. تبقى حالات الامتناع/التعطل بلا قياس مكتمل. اختيار الأسرة أو المعادلة أو context الفيزياء يتم قبل إرجاع العرض، ثم يثبت الخروج والمساعدة ويرفع revision للتقييم المتأثر.

السياسة الحالية محافظة: **طلب فتح المختبر أثناء تحقق قيد التنفيذ يُعد تعرضًا يخرج المحاولة من القياس، بدءًا من فعل التعرض الخادمي قبل الكشف**. لا تعاد أهلية الاستقلال إذا انتهى verifier أثناء انتظار الطلب؛ لحظة تسليم HTTP ليست حد السياسة. فتح نشاط بعد اكتمال النتيجة الحالية يحافظ على التصنيف التاريخي؛ وفحوص temporalLearningExposure تحافظ على هذا الفصل. المقترح الأولي بإعادة فحص أهلية math بعد انتظار القفل سُحب لأنه كان يفترض حدًا مختلفًا للحدث. **لا يوجد HIGH مؤكد في SQL بسبب ذلك الاقتراح.**

اختبارات التكامل وحالاتها النهائية موثقة في تقارير وكيل التكامل؛ ليست نتائج تشغيل لهذه المراجعة.

## ملاحظة محددة أرسلت لقائد التكامل

فحص utility محلي محدود دون شبكة/خدمات/DB أظهر أن physicsLabContextKeys لمحاكاة v=-3m/s,t=4s كان يغطي key لمسافة constant_speed_distance مع givens.v=3 فقط، دون givens.v=-3. متحقق Python الحالي يحسب المسافة abs(v)*t ويقبل هذه الإشارة. صحح helper بإضافة signed-v key إلى magnitude key القائمة مع dedup؛ بقيت مفاتيح الحركة الموجبة دون تغيير، ولم تختلط الإزاحة الموجبة والسالبة.

كذلك أضيف `subject?:SubjectCode` الاختياري إلى readLabExposures؛ يرشح كلًا من جلسات المختبر ومشاهدة الدروس بحسب المادة عند توفيرها. هذا يمنع تصادم familyCode النصي بين جبر وفيزياء؛ تتولى استدعاءات قائد التكامل وشرط SQL حصر المادة. لم تتغير دلالة الأسرة أو يجر تصنيف شامل لأدلة قديمة.

## نتيجة التصحيح — FIXED في المصدر المحدد

| الأمر | النتيجة الفعلية |
|---|---|
| `npm run build --workspace @khotwa/api` | PASS؛ يتضمن Prisma generate وTypeScript فقط، ولا يطبق migration |
| `node --test apps/api/tests/stem-lab-state.test.mjs` | PASS: 17/17، fail=0، skipped=0 |
| `npx eslint apps/api/src/stem/lab-exposure.ts apps/api/tests/stem-lab-state.test.mjs` | PASS |
| `npx prettier --check apps/api/src/stem/lab-exposure.ts apps/api/tests/stem-lab-state.test.mjs` | PASS |

يغطي الاختباران الجديدان signed/magnitude/Arabic negative givens وdedup وثبات الموجب، وتطابق familyCode بين مادتين مع فلترة session وGET-only لكل مادة. انتهى تعديل المصدر عند هذه النتيجة؛ إعادة قبول HTTP يملكها وكيل التكامل وتوثق منفصلة. لا نشر أو شهادة مراجعة علمية أو تشغيل Runner/PhET.
