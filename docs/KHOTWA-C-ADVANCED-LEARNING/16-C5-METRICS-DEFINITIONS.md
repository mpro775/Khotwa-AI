# C5 — قاموس المؤشرات والتفسير العلمي

> الحسابات **تصاميم** لا نتائج بحثية. يجب نشر تعريف metricVersion ونافذة القياس ومعيار إدراج المحاولة، ولا نخترع «تحسن 85%» من أحداث اصطناعية.

| المؤشر | التعريف المقترح | شروط الصلاحية |
|---|---|---|
| `independent_success_rate` | نجاحات مستقلة موثقة / محاولات مستقلة مؤهلة | exclude helped/exposed and technical failures؛ denominator واضح |
| `pre_post_delta` | score(post) − score(pre) أو تغير مضبوط صعوبة | اختبارات متكافئة coverage/difficulty؛ عدم اختلاف تعرض العائلات |
| `delayed_retention` | نسبة النجاح المستقل في أسئلة جديدة بعد فترة محددة | `delayDays` مسجل؛ بغير اختبار متأخر = `not_measured`, لا صفر |
| `transfer_success` | حل مسائل جديدة تختلف في السياق/السطح وتقيس مهارة مدعومة | proof family/strategy novelty؛ مراجع تربوي |
| `assistance_dependency` | نسبة المحاولات المتحققة بمساعدة / المؤهلة، أو توزيع مستويات H | لا تقارن مواد أو مستويات دون contextualization |
| `remediation_effect` | أداء مستقل قبل/بعد تدخل محدد | تسجيل baseline/after، تغير صعوبة وتعرض، لا سببية بلا تصميم صالح |
| `project_rubric_progress` | تغير مستوى معيار rubric بين نسختين للمشروع | rubricRevision ثابت أو calibration؛ لا مساواة تلقائية بالإتقان |
| `problem_strategy_diversity` | تنوع استراتيجيات صحيحة مراجعة | لا تمجيد التنوع على حساب الصحة؛ التسمية بمراجعة |
| `accessibility_barriers` | معدلات فشل تفاعل/انقطاع مسار لا معلومات إعاقة | تجميع آمن وهدف تحسين UX فقط |
| `coverage_quality` | مهارات لديها بنك/عينات/تقييم مستقل كافٍ | لا تقارن معدل نجاح بلا coverage كافٍ |

## أمثلة معادلات قابلة للتنفيذ
```text
independent_success_rate = verified_independent_correct / eligible_independent_attempts
assist_rate = eligible_assisted_attempts / all_eligible_attempts
post_minus_pre = post_score_equated - pre_score_equated
```
إذا المقام صفر → `null` مع `reason=insufficient_data`، لا تعرض `0%`.

## نوافذ القياس والإحصاء
- حدد نوافذ 7/14/30 يومًا كنوافذ **للعرض** لا كعتبة استيعاب مضمونة؛ اختيار تأخر المراجعة A5 يخضع للسياسة المراجعة.
- اعرض `n`, نسبة missing, نافذة، `metricVersion`, وconfidence/uncertainty الملائمة.
- قارن أداء الفئات فقط بعد مراجعة التمثيل والخصوصية وخلوها من تحيز اختيار؛ لا تستنتج أثرًا سببيًا من correlation أو من اختيار الطلاب الأقوى للمشروعات.

## تحليل فاعلية التدخل
سجل `interventionId`, `reasonCode`, `policyVersion`, `targetSkill`, `offeredAt`, `acceptedAt`, `followupAssessment`, `followupWindow`, `validEvidence`. قياس association أولًا، والتجريب المنضبط لاحقًا بمراجعة أخلاقية وتصميم مسبق؛ دون تشغيل A/B تلقائيًا على قاصرين.

## اختبار KPI
سلسلة أحداث اصطناعية (نجاح بمساعدة+نجاح مستقل+فشل تقني+نجاح بعد تأخر) يجب أن تنتج مقامات صحيحة، `unknown` عند غياب baseline، وعدم تغيير استنتاج عندما يعاد تشغيل projector على الأحداث نفسها.
