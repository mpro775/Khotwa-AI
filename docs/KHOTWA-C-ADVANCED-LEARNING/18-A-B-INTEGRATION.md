# 18 — خريطة التكامل الفعلي بين C والمراحل A1–A8 وB1–B3

> لا تفترض تشغيلًا حقيقيًا لأن الكود موجود: وثائق قبول A وB تقول PASS محلي/PARTIAL نهائي، وأعلام `.env.example` OFF.

| المكون الموجود | يفعله C1/C2/C3/C4/C5 | شرط السلامة والربط |
|---|---|---|
| A1 Pedagogy `next-activity`, `activities/accept` | C1/C2: اقتراح نشاط عند الحاجة | provider غير حتمي من AI **غير مسموح**؛ اختيار مبني على skill/coverage/availability مع reasonCode؛ fallback آمن |
| A2 `mastery` + `learning_assessments` | C1/C2: اطلب تقييمًا مستقلاً جديدًا؛ C5: اقرأ outcomes | `independent` لا تأتي من project completed؛ exposure/assistance وnovelty محفوظة |
| A3 `deep-diagnosis/probe` | C1: probe سبب خطأ عندما يغطي corpus | خطأ محتمل، لا حكم نفسي/شخصي؛ لا تعديل Golden المعطل |
| A4 `knowledge-graph` | C1/C2: prerequisites؛ C5: coverage | cross-subject graph **غير مثبت** بالكامل؛ project متداخل المواد فقط بعد مراجعة graph وخرائطها |
| A5 `reviews` | C5: احتفاظ مؤجل | مواعيد تجريبية policyVersion؛ لا تدعي «احتفاظ» عند عدم وجود مراجعة متأخرة جديدة |
| A6 `scaffolds` | C1/C2: worked example جزئي، دعم متدرج | سجل exposure عند reveal؛ لا استقلال من نفس المسألة بعد المساعدة |
| A7 `tutor-sessions` | C1: أسئلة حوارية offline reviewed | H4 بموافقة وأمان، خروج تقييم عند التعرض، لا LLM كحكم علمي |
| A8 `goals`, `reflections` | C1 reflection/C2 checkpoints؛ C5 goal progress | لا تصنع دليل تعلم من الثقة الذاتية أو reflection فقط |
| B1 `stem/math-lab.ts` | C1 model comparison + table/graph، C2 artifact | `SK-ALG-01..07` فقط؛ SymPy الحكم، لا كسور غير معتمدة |
| B2 `stem/physics-inquiry.ts` | C1 inquiry+C2 experiment | 1D motion فقط؛ وحدات/قيم ونماذج مقيّدة؛ PhET OFF |
| B3 `stem/coding-lab.ts` | C1 trace/Parsons، C2 prototype non-executing | لا تنفيذ كود دون Gate-R؛ Runner bridge OFF |
| C3 | كل ما سبق | alt+keyboard+RTL/LTR+text fallback أساس قبل نشر كل نوع جديد |
| C4 | source `learning_content_revisions` + B authoring | مراجعة/نشر ونسخ pin، public/private redaction، لا نوع `project` عشوائي بلا schema |
| C5 | canonical events + C events | read-only projection، dedupe، privacy+retention، لا ازدواج إتقان |

## قرار تخزين مهم
- للاختبارات الاصطناعية القصيرة C1 يمكن توسيع `ARecordKind` بـ`problem_session` بعد migration 0025 وتحديث check/claim/export/retention؛ تحقق من سقف `ARecords` 65536 بايت.
- لمشاريع C2 الأكبر اختر جدول `learning_project_runs`/`revisions` مملوكًا ومنفصلاً للأعمال الإنتاجية؛ أبق الحالة الخفيفة في ARecord أو احفظها في جدول واحد **بعد دراسة مسار claim/export/retention**. تجنب ازدواج نفس الجلسة بين مكانين بلا معرف مرجعي ثابت.
- أي اقتراح يتطلب وصول بيانات حقيقية يعرض بوابة تشغيل ولم يطلق ضمن خطة المصدر.

## توافق واجهات A/B
لا تُغيّر مسارات `/api/v1/learning/labs/*` و`/api/v1/learning/next-activity` القائمة أو دلالات نتائج `learning_only`. افحص `packages/contracts/src/intelligent-learning.d.ts`, `stem-labs.d.ts`, OpenAPI وجميع مراياه قبل اعتماد حقل جديد.

## اختبارات الربط الضرورية
1. C1 يستهلك معمل B ثم يسجل exposure، ولا يكتسب A2 دليلًا مستقلًا حتى لو صحّت النتيجة.
2. C1 يستدعي تلميحًا A6/A7، ثم اختبار جديد من عائلة مختلفة صالح فقط إذا تأكدت novel/exposure.
3. C2 يستطيع حفظ منتج فيه JSON ناتج B2 ولا يخزن `privateValidation` في الطالب.
4. A1 عندما لا يجد نشاط C منشورًا/معتمدًا يعود إلى النشاط القديم الآمن لا 500.
5. أغلق أعلام C كلها، وتحقق أن A/B/V2.2 ما زالت تتصرف كما كانت وأن API contracts القديمة سليمة.
