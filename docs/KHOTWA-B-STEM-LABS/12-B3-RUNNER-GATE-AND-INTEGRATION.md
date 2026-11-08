# 12 — B3 | بوابة تشغيل Python وربط مساحة البرمجة بالمسارات

## 1. الوضع الحالي الواجب احترامه

المستودع V2.2 يحوي `ProgrammingService`, `Judge0Runner`, `RunnerCoordinator`, `sourceForTest`, و`evaluateProgram` مع حدود زمن/ذاكرة/مخرجات وخيار `PROGRAMMING_RUNNER_ENABLED` و`RUNNER_ISOLATION_ATTESTED`. لكنه **لا يقدم شهادة بأن خدمة الإنتاج معزولة فعليًا**. تقارير V2.2 عطلّت Runner في الاختبار، و`LearningPaths.tsx` يعطل تقييم البرمجة.

## 2. Gate-R — شروط إلزامية قبل تشغيل كود الطالب

- موافقة مالك التشغيل على مزود Judge0 خاص/مماثل؛ فصل حقيقي عن host ونطاق شبكة الإنتاج (network egress disabled)، وعدم السماح بوصول runner إلى database/secrets/internal endpoints/metadata.
- container/VM غير مميّز privileges محدودة، read-only/base image أو FS مؤقت، user non-root، حدود CPU/time/memory/pids/files/open descriptors وrate per owner، cleanup after execution. لا تفترض أن `enable_network=false` في body وحده ضمان كامل.
- secrets/runner token على الخادم فقط، TLS/private network أو قناة آمنة مناسبة، `JUDGE0_BASE_URL` allowlist، استجابات bounded ومقاسة.
- فصل `run` (public tests) عن `submit` (hidden tests) والأدلة المستقلة، وتقييم الحكم **خارج معاملة DB** كما في المصدر.
- تأكيد معالجة فقد الاتصال بعد قبول job remotely، timeout, duplicate job, cancellation, retry, stale revision، والتخلص من artifacts المؤقتة.
- اختبارات هجوم معزولة: file access، attempts to read env/secrets، infinite loop، fork/bomb، output flood، sleep timeout، network attempts، non-UTF8، large inputs. **تُجرى فقط في بيئة اختبار مصرح بها وآمنة**؛ لا تشغل شيفرة عدائية على host.
- سجل Gate-R مكتوب مع مسؤول أمني/تقني، revision وبيئة ونطاق الموافقة؛ flag افتراضي off دون هذا السجل.

## 3. التكامل المطلوب مع LearningPaths

1. لا تفتح أزرار `practice`/`lesson_check` لمادة programming بمجرد وجود runner URL. استعمل capability API من الخادم يعكس `ready|disabled|not_attested|maintenance` **دون معلومات داخلية حساسة**.
2. إذا كان Gate-R مغلقًا: يستمر tracing/parsons/debugging static، وتبقى كتابة/تشغيل Python الاختيارية disabled مع شرح عربي.
3. إذا اجتازت البوابة: اربط زر «جرّب» بخدمة `POST /api/v1/programming/attempts` `mode=run` عبر `ProductApi`/session existing؛ و«سلّم مستقلًا» بـ`mode=submit` لكن **بفحص novelty/assistance/eligibility لخدمة learning** عند البدء والحفظ. لا تقبل نص حكم مخترع من client.
4. حافظ على `attemptId`, `expectedRevision`, `Idempotency-Key`، والحالة pending/running/result واستئناف polling من `programming-poll.ts`، وعدم إعادة إرسال job بلا معرفة حالة آخر job.
5. لا توسع `LearningAssessmentService` لقبول programming دون تنفيذ selection/verification/evidence special path واختبارات تمنع تسريب hidden tests. قد يكون أسلم نشاط coding lab منفصل مع mapping events إلى learning evidence حسب ما يسمح contract.
6. بعد كشف الحل أو التلميح يسقط `independent` للمحاولة المتأثرة، ولا يعود صحيحًا بإخفاء الدعم من الواجهة.

## 4. نتائج الحكم

- `allPassed=true` يعني مرور الاختبارات الموجودة فقط، **لا** إثبات مهارة عامة أو برنامج صحيح لكل المدخلات.
- `service_error/timeout/runner_unavailable/uncertain` محايدة ولا يُستنتج منها ضعف الطالب؛ تبقى الشيفرة محفوظة ضمن retention policy.
- أخطاء runtime/compile لا تصبح سوء فهم محددًا آليًا دون تفسير تربوي معتمد أو A3 probe.
- لا تُظهر أسماء/تفاصيل حالات hidden tests أو رموز token في outputs أو سجلات الطالب.

## 5. قابلية التسليم مع Gate-R مغلق

يجوز إعلان `B3_NON_EXECUTING_PASS` عند اكتمال tracing/parsons/debugging وUX/Studio/QA. يجب إبقاء `B3_CODE_EXECUTION_BLOCKED_GATE_R` إلى أن يثبت عزله ويمر QA على runner. لا تلتف باستخدام `exec`, `subprocess`, WebWorker, JS eval, Node child_process داخل web أو NestJS.
