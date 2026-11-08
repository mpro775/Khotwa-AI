# 13 — تكامل B1–B3 مع A1–A8 دون تكرار

**اعتماد مهم:** ملفات A1–A8 التي سلمت سابقًا تمثل خطة تنفيذ مستقلة؛ لا تفترض أنها نُفذت دون رؤية أحدث commit وتقاريرها. عند غيابها أنجز مختبرات B بمعاييرها الأساسية مع adapter مؤجل، وعند حضورها اربط الأنشطة ضمن **محركها نفسه**.

| مرحلة A | نقطة تكامل B | ما يجب تجنبه |
|---|---|---|
| A1 Pedagogy Engine | تسجيل أنواع أنشطة B1/2/3 في Activity Registry مع شروط الإتاحة/المادة والنطاق، وإخراج whyNow | كتابة محرك توصية ثانٍ داخل كل مختبر |
| A2 Mastery Model | نشر evidence `assisted_practice`, `conceptual_check`, `independent_assessment`, `retention` حسب تحقق كل نوع | جعل slider أو ترتيب سطر واحد إتقانًا شاملًا |
| A3 Deep Diagnosis | تحويل خطأ أول انتقال جبري أو سوء وحدة فيزيائية أو خطأ code trace إلى **فرضيات ثم probe مراجع** | تشخيص سوء فهم مؤكد من خطأ واحد أو stderr |
| A4 Knowledge Graph | ربط مختبر skillCode/lessonRevisionId والمتطلبات؛ fallback لنشاط أساسي عند نقص خريطة | إضافة skill code وهمي أو إعادة بناء graph |
| A5 Retrieval + Spacing | مراجعة قصيرة مختلفة عن نشاط سبق كشف حله وبعائلة جديدة، وتُقاس بعد الزمن | إعادة عرض نفس simulation/example واعتبارها قياس احتفاظ |
| A6 Fading Scaffolding | في B1 أمثلة ثم فراغات، B2 توقع موجه ثم مستقل، B3 trace ثم كتابة؛ سجل مراحل reveal | خلط S0–S4 مع hint H0–H4 أو إعادة الاستقلال بعد كشف |
| A7 Socratic Tutor | prompts مراجعة لكل مجال تعتمد على verified domain outcomes وتخاطب الطالب بسؤال تالٍ | السماح للـLLM بتغيير verdict أو إخراج code hidden solution |
| A8 Metacognition | قبل/بعد التجربة: توقع، ثقة متحفظة، ماذا غيرت؟ كيف تحققت؟ هدف للمرة القادمة | اعتبار self-report دليل صحة علمية |

## 1. تصميم `PedagogyActivityProvider` المقترح

```ts
interface LabActivityProvider {
  subject: "algebra" | "physics" | "programming";
  activityKinds: readonly string[];
  canOffer(context: { /* learner evidence and content revision */ }):
    Promise<{ eligible: boolean; reasonCode: string }>;
  preparePublishedActivity(/* owner + id + snapshot */): Promise<unknown>;
  verifyOrAbstain(/* response + pinned activity */): Promise<unknown>;
  classifyEvidence(/* verified response + exposure */):
    "learning_only" | "assisted" | "independent_candidate" | "neutral";
}
```

هذا **مثال توضيحي**؛ لا تخلق API parallel إذا صمم A1 registry آخر. واجهة `verifyOrAbstain` ليست تفويضًا لخدمة Node لتحكم بمعادلات SymPy؛ تختار المستدعي المختص.

## 2. نوع النشاط ومصدر القياس

- A1 الأصلي: `explanation|worked_example|diagnostic_probe|guided_practice|prerequisite_repair|independent_check|retrieval_review|challenge|reflection`.
- B activities ليست بالضرورة قيمًا جديدة للـActivityKind؛ يمكن أن تكون `activityKind=guided_practice` مع `labKind=math_first_error_v1`. استخدم discriminated union لمنع الانفجار في enum والتضارب.
- B2 simulation and B3 trace غالبًا `learning_only`، ويمكن لجزء rubric reviewed منها أن يكون دليلًا مفاهيميًا محدودًا، لكن **لا يُستبدل به** مسار إثبات أداء Python مستقل أو قيمة/وحدة فيزياء.
- `A5` يطلب bank مختلفًا، وV2.2 يخزن exposure؛ تأكد أن عمل material/render لا يكشف مادة القياس للمرة الأولى دون تسجيل exposure.

## 3. التوافق مع تعطيل A

| الحالة | السلوك المتوقع |
|---|---|
| A كلها غير منفذة | المختبرات تفتح من درس منشور يدويًا وتستخدم verification/assessment الحالي؛ بطاقة «النشاط التالي» تبقى V2.2 |
| A1 موجودة وA2 غائبة | يوفر B eligible candidates لـA1؛ evidence الحالي متحفظ بلا ادعاء mastery multidimensional |
| A2/5 مفعّلتان | بُعد supported vs independent ومراجعة مستحقة يستهلك أحداث B المسموح فقط |
| A6 مفعّلة | يستعمل B scaffold session/events الفعلية بدل نمط parallel |
| A7 أو مزود AI disabled | يكتفي بتلميحات عربية مراجعَة وقواعد مختبر محلية |

## 4. بوابة عقد تكامل قبل الدمج

- طلب change proposal يحدد أنواع B الجديدة ونسخة contracts.
- لا تُحدّث كل A/B en masse دون اختبار استرجاع V2.2 وقبول نسخة A مستقلة إن وجدت.
- اختبر feature flags حالات off/on لكل مختبر، وتعارضات rollout المتدرج.
- إن غيرت stage B دلالة أدلة A2 فهذه **مراجعة تربوية** لا مجرد refactor.
