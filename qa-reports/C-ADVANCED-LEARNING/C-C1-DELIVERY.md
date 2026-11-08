# تقرير C1 — التعلم القائم على المشكلات

التاريخ: 2026-11-08. الفرع: `codex/intelligent-learning-a`؛ التغيير في working tree فوق `6a4b6cb`. الحالة: `SOURCE_PASS` للفحوص المصدرية أدناه، وقبول التشغيل والمحتوى `PARTIAL / PENDING`.

المهمة: C1-01…03، G-C1 وG-SEC؛ امتداد محلي اصطناعي إلى FR/MVP الموروثة دون تغيير صحة المحرك أو Golden. راجعت حزمة C ولا سيما 03–05 و18–24 و27–32، وعقود ودوال ARecords وStudio وA1/A2/A6/A7/A8 ومختبرات B.

| المصدر | السلوك |
|---|---|
| `apps/api/src/advanced-learning/workflows.ts` | قائمة وقراءة محتوى منشور، بدء جلسة بإصدار ثابت، حفظ مراحل، إيقاف واستئناف وانسحاب، تلميح وكشف مضبوط، تغذية راجعة، إكمال، محولات الخدمات الأصلية |
| `apps/api/src/advanced-learning/workflow-state.ts` | آلة حالات تسمح بالرجوع إلى استراتيجية سابقة، إبطال التغذية الراجعة بعد التعديل، حد 200 تفاعل وسقف الإجابات |
| `apps/api/src/pedagogy-context.ts`, `pedagogy-engine.ts`, `intelligent-learning.ts` | اقتراح C1/C2 اختياري ضمن A1، مع مرجع `advancedActivity` وقابلية التفعيل؛ المسار القديم محفوظ عند إغلاق C |
| `packages/contracts/src/advanced-learning-sessions.d.ts` | DTO الطالب دون مفاتيح الحل أو الأدلة الداخلية |
| `qa/fixtures/advanced-learning-c/fixtures.synthetic.json` | ثلاثة سياقات جبر/فيزياء/Python غير تنفيذي؛ `TEST_ONLY` بلا اعتماد بشري |

تخزن الجلسة كـ`problem_session` داخل ARecords بحد 65536 بايت وبإصدار وتاريخ append-only. لا تنسخ مفاتيح الحل إلى الجلسة أو التحليلات. المحتوى مثبت بـlesson revision/block index/content hash ويقبل الأرشفة للاستعادة. الكتابات تستخدم `aMutation` وCAS وعدم التكرار. قارئ الجلسة يعمل read-only عند إغلاق العلم.

التحقق يعيد استخدام `MathPort.checkFinal` للجبر، `PhysicsGateway.verify` للقيمة والوحدة، أو جلسة B المالكة نفسها مع تطابق track/lesson/block/subject. النص المفتوح يعيد `needs_review`؛ الخدمات غير المتاحة تعيد `cannot_determine` دون عقوبة. الدرجة تظل `learning_only` دائمًا، حتى عندما يكون الحساب صحيحًا. لا يختزل قبول الجزء العلمي صحة الخطة والتفسير.

تسجل قراءة brief أو بدء النشاط أو المساعدة التعرض قبل إرجاع المحتوى، وتعطل القياس المعلق المطابق بالعائلة/المعادلة/سياق الفيزياء دون تغيير الأدلة المستقلة المكتملة. تُحفظ عائلات المصدر الأصلية أيضًا كي يفحص A2 حداثة المهمة التالية. التلميح H1–H3 مراجَع من المحتوى؛ H4 يتطلب تسليمًا و`after_submit`. محولات scaffold/tutor/reflection تبدأ خدمات A6/A7/A8 الأصلية تحت أعلامها، وتربط الجلسات بمالكها. طلب تقييم مستقل جديد يمر بخدمة A2 الأصلية وحراس novelty/exposure/capability؛ لا يصنع C دليلاً موازيًا.

التحقق الخارجي خارج معاملات قاعدة البيانات. تسجل prepare مع CAS أولاً، ثم تنفذ الخدمة الأصلية بمفتاح مشتق، ثم تحفظ الرابط/النتيجة فقط إن لم تتغير المراجعة. إعادة الطلب لا تنشئ جلسة أصلية ثانية. الاستجابة المتأخرة ترفض بـ409.

الفحوص المنفذة محليًا على Node/Windows:

- `npm run build --workspace @khotwa/api`: exit 0 بعد توليد Prisma وTypeScript.
- `npx tsc -p apps/api/tsconfig.json`: exit 0.
- `node --test apps/api/tests/advanced-learning-workflows.test.mjs`: 13/13 PASS؛ fixtures/redaction/stages/limits/alternative math/native abstention/nonexec/owner context/A1 guards/native gates.
- `npx eslint apps/api/src/advanced-learning/workflows.ts apps/api/src/advanced-learning/workflow-state.ts apps/api/src/intelligent-learning.ts apps/api/src/pedagogy-context.ts apps/api/src/pedagogy-engine.ts`: exit 0.
- تنسيق Prettier للملفات المتأثرة نُفذ. النتائج التجميعية واختبارات HTTP/DB التي ينفذها قائد التكامل موثقة منفصلة في `C-TESTS.json` والتقرير النهائي؛ لا تعد نتيجة المحاكاة هنا اختبار SymPy حيًا.

القيود: قبول المحتوى/العربية العلمية/القياس ومراجعات الأجهزة وقارئ الشاشة `PENDING / NOT_RUN` ضمن هذه المهمة. لا AI خارجي، لا Runner، لا PhET، لا متعلمين حقيقيين، لا نشر. الأعلام مغلقة افتراضيًا. التراجع: أغلق C واحتفظ بالسجلات والنسخ؛ لا rollback هدّام. لا تعديل Golden أو اعتماد توقيع متخصص. حالة الاعتماد: بانتظار المختصين ومالك التشغيل.
