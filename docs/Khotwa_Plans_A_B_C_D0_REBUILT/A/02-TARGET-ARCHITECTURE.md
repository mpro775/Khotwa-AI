# 02 — المعمارية المستهدفة لدورة التعلم الذكية

## المبدأ

تحويل «توصية درس» إلى **دورة قرار تربوي صريحة ومثبتة وقابلة لإعادة الاحتساب**. كل قرار يستند إلى أدلة متحققة، حالة محتوى منشورة، تفضيلات صريحة مقيّدة، وسياق المادة، ثم ينتج نشاطًا واحدًا ذا صلاحية واضحة.

```mermaid
flowchart TD
  UI[React / Student Learning Workspace] --> API[NestJS: owner + consent + idempotency]
  API --> CONTEXT[Learning Context Resolver]
  CONTEXT --> EVIDENCE[Verified Evidence Adapter / A2]
  CONTEXT --> GRAPH[Knowledge Graph / A4]
  CONTEXT --> REVIEW[Retrieval Queue / A5]
  CONTEXT --> CONTENT[Published Content Eligibility]
  EVIDENCE --> POLICY[Pedagogy Engine / A1]
  GRAPH --> POLICY
  REVIEW --> POLICY
  CONTENT --> POLICY
  POLICY --> DECISION[Versioned Decision + Alternatives]
  DECISION --> ACTIVITIES[Explanation / Probe / Scaffold / Review / Check / Reflection]
  ACTIVITIES --> VERIFIER[Math | Physics | Approved Runner]
  VERIFIER --> EVENTS[Canonical Attempts + Reports + Assistance Events]
  EVENTS --> CONTEXT
  AI[Optional LLM: only dialogue/rephrasing A7] --> ACTIVITIES
```

## الوحدات والمسؤوليات

| الوحدة | الملف المقترح بعد تدقيق المصدر | مسؤوليتها وحدودها |
|---|---|---|
| Learning Context Resolver | `apps/api/src/pedagogy-context.ts` | جلب أدلة الطالب **من المالك**، إصدارات المحتوى، الصلاحية، الجِدة؛ لا تعيد احتساب حكم رياضي |
| Pedagogy Policy | `apps/api/src/pedagogy-engine.ts` | قواعد قرار حتمية ذات نسخ وسبب وقائمة مرشحين وبديل آمن |
| Learner Projection | `apps/api/src/mastery-model.ts` | اشتقاق أبعاد حالة المهارة وإسناد الأدلة إليها مع دقة مصدرها |
| Diagnosis Orchestrator | `apps/api/src/deep-diagnosis.ts` | إدارة فرضيات متعددة وسؤال تحقق مراجع دون حسم مرجع العلوم |
| Knowledge Graph | `apps/api/src/knowledge-graph.ts` | متطلبات المهارات وحالة التحقق من العلاقات، كشف الدوران والحواف المعلّقة |
| Retrieval Planner | `apps/api/src/retrieval-scheduler.ts` | تواريخ المراجعات والمزج ضمن الجِدة ونوع الدليل وخفض التعثر المصطنع |
| Scaffold Orchestrator | `apps/api/src/scaffolding.ts` | مستويات الدعم والمساعدة ومرحلة النشاط حسب تقدم الطالب |
| Socratic Tutor | `apps/api/src/socratic-tutor.ts` | دورات سؤال→جواب→تحقق→توجيه، قوالب مراجعة وLLM اختياري آمن |
| Reflection/Goals | `apps/api/src/metacognition.ts` | أهداف وتوقعات وتقييم ذاتي وقواعد منع تحويل الإقرار الذاتي إلى إتقان |
| UI integration | `apps/web/src/LearningPaths.tsx` + وحدات أصغر عند الحاجة | عرض النشاط وسبب التوصية وبدائل/اختيار الطالب دون فقد الاستئناف |

هذه **أسماء مقترحة**؛ للوكيل حرية تفكيك الوحدات حسب الهيكل الفعلي مع التزام فصل المسؤوليات وعدم إنشاء خدمة أو قاعدة بيانات جديدة بلا حاجة.

## دورة القرار — ملزمة

1. **Authorize:** صاحب الجلسة وموافقة التعلم، نوع المادة، revision المنشورة، وقيود AI/Runner.
2. **Collect:** أحدث تقرير تحقق حالي صالح، استقلال المحاولة، مقدار المساعدة، تاريخ التعرض، مواعيد المراجعة، رابط المهارة ودليل الطالب؛ إن تعطل المصدر يعاد سياق `unknown` دون تقليل المستوى.
3. **Candidates:** أنشطة من محتوى منشور ومراجع وملائم للمادة؛ يستبعد candidate غير مؤهل، وأسئلة القياس المكشوفة، والمسار الموقوف.
4. **Prioritize:** سلامة المحتوى أولًا، ثم probe عند تشخيص قابل للفحص، ثم معالجة متطلب مثبت، ثم مراجعة مستحقة، ثم scaffolding أو فحص مستقل أو تحدٍّ مناسب؛ التفاصيل في A1. **ليست قواعد تصنيف شخصية ثابتة**.
5. **Decide:** `decisionId`, `policyVersion`, `evidenceVersion/fingerprint`, `contentRevisionIds`, `reasonCode`, `alternatives`, `expiresAt`, `fallback`؛ البيانات الحساسة داخلية.
6. **Accept & run:** عند قبول الطالب، تعاد صلاحية القرار والتحقق من أحدث السياق داخل معاملة قصيرة، ثم إنشاء activity محكومة بـidempotency. عمليات التحقق/AI خارج المعاملة، وتُرفض نتائج stale.
7. **Observe & repeat:** تحفظ المحاولات والتقارير وأحداث الدعم/التعرض ثم تعاد قراءة السياق من المصدر. تعاد الحسابات المشتقة عند تغيير نسخة المحاولة أو السياسة.

## حواجز تصميمية

- **Authority:** `verified report → evidence adapter → learner projection → policy`، ولا تسلك بيانات LLM مسار الحكم أو تحديث الإتقان.
- **Consistency:** تفضيل append-only للأحداث ذات الأثر التربوي؛ snapshot للإصدار ورابط chain-of-custody؛ قبول النتائج النهائية فقط عند تطابق revision.
- **Idempotency:** قبول النشاط والجواب والتلميح والعرض لا ينشئ ازدواجية عند إعادة إرسال الشبكة.
- **Fallback:** فشل AI/الوقت/المحتوى يعرض شرحًا أو سؤالًا من قوالب منشورة، أو `no_safe_activity` مع سبب واضح، ولا يكشف اختبارًا مستقلًا.
- **Subject adapters:** Algebra وPhysics ينفذان داخل نطاق التحقق الموجود. Programming يدعم القراءة/التمارين غير التنفيذية المعتمدة، ويبقى تنفيذ الكود gated.
- **Analytics:** مقاييس مركبة من أحداث موثقة فقط، دون جمع prompts الحساسة أو الإجابات في أدوات مراقبة طرف ثالث.

## نجاح معماري قابل للاختبار

نفس `contextSnapshot + policyVersion + approved-content-set` ينتج القرار نفسه (باستثناء معرف الطلب والزمن المجمّد). إعادة تشغيل الخدمة أو refresh لا تخلق نشاطًا إضافيًا ولا تضيع المساعدة؛ وتغيير evidence أو revision يبطل القرار القديم دون تغيير أدلة محاولات سابقة.
