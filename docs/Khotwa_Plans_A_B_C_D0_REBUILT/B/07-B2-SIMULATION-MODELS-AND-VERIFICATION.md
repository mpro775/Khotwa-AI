# 07 — B2 | نموذج المحاكاة والأوراق المرجعية العلمية

## 1. متطلبات نموذج deterministic

أي محاكاة منشورة تُعرّف:

```json
{
  "schemaVersion": "physics-lab-v1",
  "modelCode": "constant_velocity_1d",
  "modelVersion": "1.0.0",
  "domain": "kinematics_1d",
  "assumptions": ["one_dimension", "constant_velocity", "no_direction_reversal_in_distance_example"],
  "parameters": {"v_mps": 3, "t_s": 4, "x0_m": 0},
  "outputs": ["position_time", "displacement_m", "distance_m"],
  "unitSystem": "SI"
}
```

هذه **مواصفة مقترحة فقط** وليست JSON مقبولًا في السورس حاليًا. عند تطبيقها يلزم DTO validation وحدود، واختبارات goldens علمية، وartifact snapshot ثابت.

## 2. العلاقات والافتراضات

**نموذج سرعة متجهة ثابتة:** `x(t)=x0+v*t`، `Δx=v*t`، `distance=abs(v)*t` إذا لم يحدث تغيير اتجاه خلال الفترة، `t>=0`. المحور والإشارة ظاهران. عند `v<0` الإزاحة سالبة والمسافة غير سالبة.

**نموذج تسارع ثابت:** `v(t)=v0+a*t`, `x(t)=x0+v0*t+0.5*a*t^2`، لكن المسافة الكلية ليست بالضرورة `abs(Δx)` إذا انقلب اتجاه الحركة؛ اختر مجال يمنع الانقلاب أو احسب نقطة الانقلاب بدقة بوثيقة علمية منفصلة. لا تُظهر `distance=abs(displacement)` دون تحقق شرط «لا انعكاس».

**التحويلات:** `km/h ↔ m/s` بعامل `5/18` في الاتجاه الأول؛ `m`, `s`, `m/s²` حسب SI. حافظ على دقة حساب داخلية ثم اعرض rounding موثق؛ لا تقارن ناتجًا مقربًا بمعيار مطابقة صارم بلا tolerance مراجعة.

## 3. محرك محاكاة آمن

- لا eval، ولا إدخال معادلات Python/JS مؤلفة في الطلب العام؛ قائمة `modelCode` صلبة ومصادق عليها.
- تحقق من finite, bounds, step counts, number of traces, units؛ حد points افتراضي ≤ 501 لكل series و≤ 4 series. اجعل الحد قابلًا لضبط في السياسة ويخضع لاختبارات حدية.
- simulation computes trajectory on reviewed formulas ثم تُولد DTO نصي/جدولي من عينات ضمن زمن محدد؛ المتصفح يرسم فقط مع إمكان التحقق من checksum/version.
- إذا كان العرض يمكنه الحساب محليًا لأجل responsiveness، لا يمنح ذلك حكمًا على محاولة الطالب؛ يعتمد الحفظ على verifier/server confirmation.
- لا تدخل تعابير الطالب النصية في Math Engine تلقائيًا ما لم تتطابق مع العقد التخصصي.

## 4. مقارنة محرك الفيزياء الحالي

راجع `services/math-engine/src/khotwa_math/physics.py` و`apps/api/src/physics-gateway.ts`: `physics-internal-v1` يحقق **قيمة ووحدة جواب لمشكلة مرجعية** وليس خدمة timestep simulation عامّة. ابْنِ `SimulationModelPort` جديدًا أو utility خادمية منضبطة للنماذج المراجعة **دون ادعاء أن PhysicsGateway الحالي يرسم المسار**. استعمل gateway الحالي للتحقق من أسئلة جوابها وبياناتها ضمن نطاقه.

لا توحد كود physics simulator وverifier دون إثبات التكافؤ؛ استخدم property tests بحالات حدودية ومراجعة معادلات؛ إذا اختلفا، منع نشر النموذج وتوثيق المشكلة.

## 5. حالات اختبار علمية حرجة

| الحالة | المدخل | المتوقع |
|---|---|---|
| حركة موجبة | v=3m/s,t=4s | displacement=12m,distance=12m |
| حركة سالبة | v=-3m/s,t=4s | displacement=-12m,distance=12m |
| زمن صفري | t=0 | لا حركة مع اشتراطات محددة |
| تسارع سالب دون انعكاس | v0=10,a=-2,t=3 | v=4m/s, displacement=21m |
| انقلاب اتجاه | v0=2,a=-2,t=3 | يتم التعامل مع نقطة الانقلاب؛ المسافة ≠ `abs(displacement)` |
| وحدة مختلفة | v=36km/h,t=2s | displacement=20m في الاتجاه الموجب |
| out of range | t<0, NaN, infinite, huge sample count | rejected/unsupported بلا حكم على فهم الطالب |

## 6. بوابة العلم والمراجعة

- راجع التفسير والرسوم والوحدات ونقطة الانقلاب والاستثناءات مع مختص الفيزياء قبل نشر نشاط.
- لا تُقبل «موافقة» مستنتجة من Jest أو من توقيع تقني؛ اضبط `reviewedBy/reviewedAt` الحقيقي.
- simulation دون simulation licensing يمكن نشرها إذا كانت مكتوبة أصلًا من الفريق وبمحتوى مسموح؛ لا تنسخ assets أو كودًا من طرف ثالث دون فحص تراخيصه.
