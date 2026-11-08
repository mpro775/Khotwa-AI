# 11 — B3 | مواصفات تتبع الكود وParsons والتصحيح

## 1. حدود النطاق

**ليس مشروع مترجم/مفسر Python:** أنشطة tracing v1 تعتمد على **سيناريوهات مراجعة ذات أثر مُعدّ مسبقًا**، بما في ذلك variable states، sourceLine، output after step. لا تقبل source عشوائيًا لتتبعه على الخادم. أي توسيع لتوليد trace لكود عشوائي يدخل Gate-R وأمنه.

## 2. `predict_output`

- محتوى `sourceCode` readonly، `stdin` ثابت/فارغ، answer options أو جواب نصي قصير، `reviewedExpectedOutput` محفوظ في author-only schema.
- validation وقت النشر يثبت أن المخرجات تطابق تشغيلًا آمنًا/تحليلًا مراجعًا؛ إن كان Runner غير متاح، تُسجّل موافقة يدوية للمحتوى ويتوقف الأتمتة لا صحة التصنيف.
- عند عرض السؤال للطالب، لا يُعاد حقل expectedOutput حتى يسلم/يتخلى عن الاستقلال.

مثال:

```python
total = 0
for n in range(1, 4):
    total += n
print(total)
```

المخرجات المرجعية: `6`، trace للحالات بعد كل تكرار: 1، 3، 6. اختبار `range(1,4)` لا يشمل 4.

## 3. `code_trace`

- `traceSteps[]`: `(lineId, event, variablesDisplay, stdoutCumulative, explanationAr)` مؤلف ومراجع، لا raw Python evaluation في المتصفح.
- اللاعب يختار «الخطوة التالية» أو «أظهر القيمة»، وتسجل أفعال reveal/support. المرحلة S0–S3 بمساعدة؛ قياس مستقل منفصل ببرنامج مختلف.
- اجعل snapshot trace pinned إلى content revision؛ تبديل revision لا يعيد كتابة محاولات سابقة.
- لا تعرض stack/traces الحقيقيين الناتجين عن Runtime system أو secrets؛ النموذج مُراجع ومحدود.

## 4. `parsons_reorder`

- عناصر: `{lineId, text, indentationLevel, isDistractor?, groupId?}`؛ الصياغة العربية للتعليمات والكود إنجليزي.
- grading server-side against reviewed solution **equivalence class** أو DAG precedence (عندما يوجد ترتيبان صحيحان) بدل افتراض ترتيب وحيد دائمًا.
- إذا كان ترتيب واحد فقط مطلوبًا، يجب على مؤلف الدرس إثبات أن ترتيب الحل الوحيد هو المقصود، أو إضافة أكثر من ordering valid.
- `distractors` اختيارية ومراجعة؛ مع كل طلب إرشاد/إزالة distract يجب تسجيل كشف الدعم؛ قياس مستقل بنسخة مختلفة.
- اختبارات tie-order وindentation والسرعة والوسائل المساعدة.

مثال Parsons آمن:

```text
A: total = 0
B: for n in range(1, 4):
C:     total += n
D: print(total)
```

الترتيب الصالح `A,B,C,D` في هذا التمرين؛ يجب الحفاظ على indentation لـC. لا يظهر ترتيب الإجابة في public DTO إلا بعد حالة disclosure مسموح.

## 5. `debug_select_fix`

- أنشئ قائمة أخطاء مراجعة، مثل استعمال `range(1, 3)` بدل `range(1, 4)` عند هدف جمع 1..3؛ اسأل عن أثرها أولًا.
- اعرض عدة patches reviewed، وتأكد أن patch المقصود يُصلح test cases المرجعية بدون كسر أخرى. في الوضع الأول تُعطى إصلاحات مغلقة؛ تحرير النص الحر يتطلب Runner.
- **لا تصدر تشخيصًا قطعيًا** من `stderr` وحده عن عجز الطالب؛ debugger feedback يشرح رسالة الخطأ/نتيجة التشغيل لا يفترض سببًا معرفيًا.

## 6. schema مقترح (proposal)

```json
{
  "kind": "code_parsons_v1",
  "subject": "programming",
  "skillCodes": ["PY-LOOPS"],
  "activityId": "opaque-id",
  "codeLanguage": "python",
  "lineItems": [{"lineId": "L1", "code": "total = 0", "indent": 0}],
  "answerMode": "ordered_lines",
  "rubricVersion": "parsons-1"
}
```

**مهم:** public response لا يتضمن `correctOrder`, `hiddenTests`, `privateRubric`. يبقى auth+revision+idempotency للقرارات.

## 7. الحالات الخاصة

- إذا كانت مسألة tracing تتطلب side effects، imports أو network، لا تنشرها ضمن static tracing v1؛ تظل out of scope حتى مراجعة Runner.
- مثال syntax error يُعرض بوضوح وأنه خطأ مصطنع ضمن التعليم؛ لا يُسجل خطأ «مفاهيمي دائم».
- أداة إعادة ترتيب الأسطر لا تعتمد على drag and drop فقط؛ قدّم بدائل keyboard/touch وتراجع/إعادة.
