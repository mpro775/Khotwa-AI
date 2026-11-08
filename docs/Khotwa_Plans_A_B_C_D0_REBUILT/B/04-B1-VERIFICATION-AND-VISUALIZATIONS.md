# 04 — B1 | قواعد التحقق الرياضي والتمثيل البياني

## 1. فصل ثلاثة أنواع أحكام

| المطلوب التحقق منه | المرجع المسؤول | ما لا يعنيه |
|---|---|---|
| تكافؤ انتقالين جبريًا | `MathPort` → Python/SymPy ونتائج `verification_reports`/العقد الداخلي | لا يعني أن الطالب يستطيع شرح السبب |
| صحة قيم جدول/رسم دالة مدعومة | حاسبة deterministic مؤلفة ومختبرة مع test oracle، ويمكن مقارنة نقاط مرجعية مع Python | لا تعني صحة تحويل عام لمعادلة |
| صحة تفسير/اختيار مبدأ | answer key/rubric مراجع أو feedback محتاط | لا تصدر LLM `verified_valid` |

## 2. أنظمة تحقّق متخصصة

**B1-01 المعادلة/الجدول/الرسم**
- نشاط من نوع `linear_function_graph` بمواصفات `a`, `b`, `xMin`, `xMax`, `step`; حدود صغيرة finite، دقة وrounding موحدان، نطاق عرض مناسب.
- `y = a*x + b`، جدول وقائمة النقاط من **مولّد حتمي واحد**؛ graph يستمد بياناته من ذات البيانات التي تنتج الجدول، لا يحسب كل واحد بمنطق آخر. استخدام Decimal/Rational في الخادم للتحقق إذا لزم، وJS للرسم فقط.
- معادلات `a*x + b = c` تمثل كنقطة حل أو تقاطع خط `y=ax+b` مع `y=c` مع تسمية صريحة؛ الحالة `a=0` تُعامل استثنائيًا (حلول معدومة أو غير محدودة) ولا قسمة على صفر.

**B1-02 مقارنة طرق الحل**
- مؤلف المحتوى يحدد حلين كاملين بنسخ معايير صالحة؛ validator يمر بكل transition عبر محرك MathPort، ويرفض النشر إن وجد `verified_invalid`, `unsupported`, `inconclusive` لا تغطيه سياسة العرض.
- إذا كان هناك حل بديل صحيح، لا ترفضه لمجرد اختلاف ترتيب الخطوات؛ rubrics تؤكد معنى الاختيار وليس نص الطريقة.

**B1-03 أول خطوة خاطئة**
- لكل سلسلة `from → step 1 ... step N`، اجمع verdict لكل انتقال بتتبع مستقل؛ أول `verified_invalid` هو **أول خطأ مثبت** فقط إذا كانت الانتقالات السابقة كلها `verified_valid`.
- `unsupported|syntax_error|inconclusive|service_error` قبل أول invalid تجعل النتيجة `cannot_determine`؛ لا تتجاوزها لتزعم «أول» خطأ.
- لا تعرض «الصحيح» من الـanswer key في وضع التقييم؛ أظهر السبب فقط بعد تسجيل التعرض/المساعدة.

**B1-04 لماذا تصح؟**
- أسئلة مغلقة محددة المبدأ `multiply_both_sides_nonzero`, `subtract_same_term`, `distribute_to_all_terms`, إلخ، مربوطة بمثال موثق؛ حقل «اشرح» لا يقوَّم تلقائيًا بمزود LLM على أنه معيار إتقان.

## 3. Verification sequence وdeadline

```text
validate published activity (hash + subject + revision)
  -> open session + exposure classification
  -> student action recorded (CAS / idempotency)
  -> verify via domain service OUTSIDE DB transaction
  -> confirm same activity/attempt revision
  -> persist domain result & neutral feedback
  -> if independently eligible: existing assessment evidence path only
```

- لا تكشف internal AST/private proof certificate في DTO العام إلا نسخة آمنة معتمدة.
- رياضيات الواجهة: استعمل `MathInput` وnotation profile الحالي، العربية والأرقام العربية عند العرض، ولا تعيد تفسير جملة الطالب عن طريق regex غير مؤهل.
- الرسوم SVG/Canvas محلية بمعاملات مصفاة، مع `aria-label` وقائمة النقاط/الجدول؛ لا تطلب مكتبات ثقيلة دون تقييم الأثر وحجم الحزمة.
- حد أقصى مبدئي للمدخلات: عدد نقاط ≤ 101 لكل trace، وعدد معادلات مرئية ≤ 4، وانتقالات ≤ 12؛ **حدود تصميمية قابلة للمعايرة** لا تدّعِ أنها مفروضة حاليًا.

## 4. التحقق/الاختبار

- حالات: `a>0`, `a<0`, `a=0`, `b=0`, نقطة تقاطع خارج نافذة العرض، السالب، 0، الترميز العربي، rounding.
- مثال أول خطأ: `2(x+3)=10 → 2x+3=10`; يجب `verified_invalid` عند التحول الأول. خطوة `2x+6=10` صحيحة؛ لا رفض حسب شكل النص.
- خطأ فني سابق لا يسمح بالمضي لحكم «أول خطأ» لاحق.
- graph/table تطابق 100% لنفس node list وحالات offline fallback.
- لا تقبل إصدار محتوى بمثال non-equivalent دون اختيار صريح لوضع `common_mistake` وتوثيق نية المثال؛ الموافقة التقنية لا تحل محل مراجعة مدرس رياضيات.
