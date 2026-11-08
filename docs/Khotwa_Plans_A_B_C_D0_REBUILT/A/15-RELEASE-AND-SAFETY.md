# 15 — الإطلاق المرحلي، الأمان، المرونة، والرجوع للخلف

## نموذج تفعيل

كل ميزة جديدة تُقفل افتراضيًا خارج بيانات الاختبار الاصطناعية، وتكون مستقلة عن الإعدادات القائمة. الأسماء المقترحة لا تثبت حتى مراجعة سياسة env الحالية:

| مفتاح مقترح | الوضع الافتراضي في خارج الاختبار | وظيفة |
|---|---|---|
| `PEDAGOGY_ENGINE_ENABLED` | false | A1 القرار التربوي الجديد |
| `MASTERY_PROJECTION_ENABLED` | false | A2 عرض أبعاد الإتقان |
| `DEEP_DIAGNOSIS_ENABLED` | false | A3 probe متعدد الفرضيات |
| `KNOWLEDGE_GRAPH_A_ENABLED` | false | A4 Graph المعتمد |
| `SPACED_REVIEW_ENABLED` | false | A5 جدولة المراجعات |
| `FADING_SCAFFOLD_ENABLED` | false | A6 تسلسل الدعم |
| `SOCRATIC_TUTOR_ENABLED` | false | A7 القوالب الحوارية المحلية |
| `SOCRATIC_EXTERNAL_AI_ENABLED` | false **دائمًا حتى موافقة مستقلة** | مسار LLM الخارجي (ليس شرط PASS المحلي) |
| `METACOGNITION_ENABLED` | false | A8 أهداف وتأمل |

تفعيل الميزات A1..A8 في **بيئة اختبار معزولة** ممكن للمطور بعد نجاح فحوصه، أما تفعيلها على بيانات حقيقية أو نشر نموذج جديد فيحتاج قرار مالك المنتج، مراجعة المحتوى المختص، سياسة الأمن والاحتفاظ، وتقييم واجهة الأجهزة.

## مسار إصدار تدريجي مقترح

- **Stage 0 / Local synthetic:** وحدات + عقود + تكامل بقاعدة اصطناعية، دون طلبات AI أو Python runner غير محصّن.
- **Stage 1 / Internal pilot:** حسابات داخلية وبيانات اختبار، flags محددة، مراجعة تربوية وQA للمحتوى المرتبط، مراقبة no-safe decisions والتسريبات والأخطاء.
- **Stage 2 / Human review gate:** شهادة محتوى لكل revision في الجبر/الفيزياء/Python وفق نطاقها، مراجعة عربية وخصوصية وأجهزة، وموافقة صريحة على سياسات retention.
- **Stage 3 / Limited real learners:** لا تبدأ إلا بتفويض منفصل وموافقة طلاب واضحة وآلية حذف/سحب موافقة، وخطة تقييم أثر خالية من ادعاءات مبالغ فيها.

## المخاطر وكيف يعالجها النظام

| الخطر | التخفيض المطلوب | ما يحدث عند الفشل |
|---|---|---|
| تلميح يكشف الجواب في قياس مستقل | revoke eligibility **قبل** كشفه، تقيد families/exposures | استئناف كتدريب، لا شهادة استقلال |
| AI hallucination أو نقاش طويل | قوالب reviewed، bounded turns، domain verifier، limits/cost | local fallback أو safe handoff |
| محتوى draft غير متاح | published/reviewed gating وتثبيت revisions | no_safe_activity أو درس منشور بديل |
| تكرار POST/فصل الشبكة | idempotency + optimistic revision + event unique | يعاد نفس الرد أو 409، لا حدث مضاعف |
| قراءة بيانات مستخدم آخر | owner authorization في read/write، DTO safe | 404/403 دون كشف وجود المحتوى الشخصي |
| Graph خاطئ أو حلقات | validation قبل التفعيل ولقطات رسم بياني | rollback للـrevision الأخير المعتمد |
| نفاد بنك مراجعة | coverage guard + novelty preservation | مراجعة مؤجلة لا خسارة إتقان أو كشف |
| تحديث mastery مبني على خطأ خادم | مصدر الحقيقة الحالي + invalidation + recompute | unassessable، لا negative concept |
| كثرة reminders/الضغط على الطالب | سقوف عرض قابلة للتهيئة ومراجعة وتأجيل | واجهة هادئة، لا badges عقابية |
| استغلال code runner | لا تمكين إلا بعد مراجعة العزل وlimiting | برمجة reading-only كما V2.2 |

## الأداء وإمكانية التوسع

- تجنب استعلامات N+1 عبر مهارات الطالب؛ اجلب الأدلة في دفعات ومؤشرات محددة، مع عدم cache باسم `ownerKey` في متصفح عام.
- لا تفعل compute لGraph traversal غير محدود؛ depth وmax nodes، وفهارس بحسب `(releaseId, skillCode)`.
- cache projection قابل لإعادة الاشتقاق وTTL/invalidations حسب evidenceFingerprint؛ حافظ على قواعد حالات concurrent requests.
- حدد حدود طول reflection والرسائل والـprobes وturn count ورصيد الطلبات وفق سياسات محلية معلنة، لا يفترض معدل دقيق حتى اختبار الأداء.
- أي scheduled job للمراجعات يستخدم استرجاعًا قابلاً للإعادة idempotent؛ الجدولة يجب أن لا تحتاج تشغيل ساعة دائمة لإنشاء evidence وهمي عند غياب الطالب.

## الرجوع للخلف

- flags يمكنها إخفاء الواجهات/إيقاف الكتابة الجديدة مع استمرار صلاحية سجلات قديمة للقراءة أو الاحتفاظ، لا حذفها.
- migrations expand-only قدر الإمكان، مع snapshot/backup قبل تطبيقها في بيئات اختبار مشتركة؛ rollback لا يحذف evidence أو history تلقائيًا.
- قد تنتهي صلاحية decision pending بعد تعطيل flag؛ تظهر رسالة عربية وتعود توصيات V2.2 دون كسر progress.
- عند اكتشاف خطأ تربوي جسيم: عطل المسار المعني، ثبّت القضية والنسخة المسببة، راجع تأثيرها على قرارات المتعلمين، ثم أصلح policy بنسخة جديدة بدل محو السجل.
