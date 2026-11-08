# 20 — أمثلة التحقق ورحلات الطلاب B1–B3 (Fixtures — ليست محتوى منشورًا)

**الغرض:** تزويد الوكيل بعينات محددة ومتنوعة تساعد الاختبار. هذه أمثلة تشغيل **اصطناعية**، لا تُعد موافقة بشرية على المناهج أو بديلًا عن Golden Dataset الأصلي. لا تغير `docs/14-GOLDEN-DATASET.*` الموجود إلا بموافقة مالكه.

## 1. الرياضيات — الطالب م1

**المهارة:** `SK-ALG-04` توزيع الأقواس.

| الحالة | الدخل | المتوقع |
|---|---|---|
| صيغة صحيحة | `٣(س+٢)=٩ → ٣س+٦=٩` | verified_valid (ضمن parser المتاح) |
| خطأ التوزيع | `٣(س+٢)=٩ → ٣س+٢=٩` | verified_invalid، أول تحول غير مكافئ |
| حل صحيح بديل | `٣(س+٢)=٩ → س+٢=٣ → س=١` | اختبارات تحويل مكافئ في النطاق، إن كان parser يقبل الصياغة |
| محرك ممتنع | syntax/unsupported/inconclusive في مرحلة سابقة | cannot_determine لأول خطأ، لا تعويض بحكم LLM |
| تمثيل خطي | `y=2x+1` عند x=-1,0,1 | y=-1,1,3 في جدول ورسم واحد |
| أثر دعم | كشف H2 أو worked step | مستقل=false للمسألة المكشوفة |

**خط الرحلة:** `درس منشور -> B1 compare -> first invalid step -> feedback -> worked step -> طلب assessment مستقل -> سؤال مختلف من بنك منشور -> evidence خاضع للقواعد`. انعدام بنك جديد = رسالة تغطية محدودة، لا إنشاء سؤال فورًا من AI.

## 2. الفيزياء — الطالب ف1

**المهارة:** `PHYS-CONSTANT_MOTION` ثم `PHYS-DISPLACEMENT`.

### حركة موجبة

- الموقف: سرعة متجهة `v=3 m/s` وزمن `t=4 s`، البداية `x0=0`.
- قبل reveal: توقع أن مضاعفة الزمن تضاعف الإزاحة مع ثبات السرعة.
- بعد reveal: عند t=4، x=12m؛ عند t=8، x=24m. distance=displacement هنا لأن v موجبة وثابتة.
- اسأل: ما الذي بقي ثابتًا وما الذي تغير؟ feedback تفسيرية لا استدلال على سمة شخصية.
- قياس منفصل: كود/مسألة أخرى من family مختلفة بقيم أخرى؛ لا تستعمل هذه المعطيات بوصفها سؤالًا جديدًا.

### اتجاه سالب

- `v=-3 m/s, t=4 s`, `Δx=-12 m`, distance=`12 m` في نموذج الحركة بسرعة ثابتة.
- اختبار: لا يسمي المسافة سالبة، ولا يلغي إشارة الإزاحة عند اختيار اتجاه المحور.

### انعكاس الاتجاه

- `v0=2 m/s, a=-2 m/s², t=3 s`, نقطة الانعكاس t=1s، `Δx=-3m`, `distance=5m`، السرعة المتجهة النهائية -4m/s.
- إذا رفض النموذج هذا السيناريو لعدم دعمه inversion، يجب `unsupported` موثق **بدل رقم مسافة خاطئ**.

**خط الرحلة:** `نشاط predict -> save prediction -> reveal -> compare -> explanation -> transfer problem on server -> verdict physics domain -> A2/A5 eligibility`.

## 3. البرمجة — الطالب ب1

### توقع تتبع

```python
total = 0
for n in range(1, 4):
    total += n
print(total)
```

- الحالات المتوقعة: عند n=1، `total=1`؛ n=2، `total=3`؛ n=3، `total=6`؛ output `6`.
- خطأ تربوي شائع: الاعتقاد أن `range(1,4)` يدخل 4؛ يُختبر probe مراجع لا تشخيص دائم.

### ترتيب Parsons

```text
A total = 0
B for n in range(1, 4):
C     total += n
D print(total)
```

- expected ordering `A,B,C,D`، وC indent=4 spaces. في هذه fixture ترتيب وحيد مقصود؛ اختبار آخر يجب تغطية أكثر من ترتيب صحيح.

### تصحيح خطأ

```python
total = 0
for n in range(1, 3):
    total += n
print(total)
```

- الناتج الحالي 3 لا 6؛ إصلاح مقترح `range(1,4)` لضم 3. اجعل الهدف في نص النشاط واضحًا: جمع الأعداد 1,2,3؛ لا تحوّل هذا السطر المطابق إلى سؤال قياس مستقل جديد بعد عرضه.
- Runner disabled: تعرض static traces/rubrics فقط، ولا تنفذ source في الواجهة.
- Gate-R approved only: run public cases/submit hidden cases عبر البنية القائمة، بمدخلات أخرى ومراجع جديدة.

## 4. بيانات اصطناعية مشتركة

| حالة | سيناريو | دليل القبول |
|---|---|---|
| cross-owner | طالب A ينشئ جلسة، طالب B يرسل same id | 404/403، لا يطّلع B على حالة A |
| staleness | student edits submission after launching verifier | نتيجة verifier قديمة لا تُكتب فوق الأحدث |
| double click | حدث `prediction_submitted` مرتين بنفس idempotency key | حدث واحد وstate deterministic |
| content revision | activity v1 pinned ثم نشر v2 | صاحب v1 يستأنف v1، القادم يرى v2 |
| hint contamination | reveal answer then post-test same family | no independent credit، يطلب fresh novel family |
| network outage | verifier 503 أو runner down | الإدخال محفوظ وresult neutral |
| 3rd party blocked | PhET license not approved | B2 native sim يعمل دون طرف ثالث |
| A absent | B feature enabled / A1 missing | learning manual route works، لا crash |

## 5. نصوص عربية للواجهة

- «هذا نشاط للتجربة والفهم، ولا يُعد اختبار إتقان مستقلًا.»
- «ما توقعك قبل تشغيل التجربة؟ يمكنك اختيار (لا أعرف).»
- «قد يكون السبب مرتبطًا بهذه الخطوة؛ لنتحقق بسؤال قصير.»
- «نتيجة المحاكاة تعتمد على نموذج الحركة الخطية والافتراضات الموضحة.»
- «التنفيذ البرمجي معطل حتى التحقق من أمان بيئة التشغيل. تستطيع استخدام تمارين تتبع الكود وترتيب الأسطر الآن.»
- «لم نتمكن من التحقق آليًا؛ إجابتك محفوظة، ولم نعتبرها خطأ.»
