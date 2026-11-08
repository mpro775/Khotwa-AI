# C1 — حالات الجلسة والقياس والتغذية الراجعة

## آلة الحالات المقترحة
```text
not_started -> framing -> planning -> exploring -> justification -> reflection -> completed
                           ↘ help_requested ↗     ↘ revision_requested ↗
(any active) -> paused -> resumed; any active -> abandoned (opt-in)
```
`help_requested` و`revision_requested` أحداث/علامات وليسا بالضرورة حالات تخزين منفصلة. لا تفرض تقدمًا خطيًا جامدًا؛ لا تسمح بالإجابة النموذجية قبل `reveal` المقصود.

## الطلبات والأحداث
`session_created`, `problem_stage_viewed`, `givens_submitted`, `plan_submitted`, `assumption_revised`, `strategy_selected`, `domain_result_verified`, `hint_revealed`, `answer_revealed`, `justification_submitted`, `reflection_saved`, `problem_completed`, `validator_abstained`.

كل حدث له `eventId`, `sessionId`, `ownerKey`, `contentRevisionId`, `timestamp`, `eventVersion`, `clientRequestKey`, `stage`, وتصنيف معلومات محدود. لا نسجل النصوص الكاملة في Analytics افتراضيًا؛ تبقى نصوص الإجابات في مخزن بيانات تعلم مملوك ومحمي عند الحاجة.

## استراتيجية الحكم
| مكوّن | مرجعية الحكم | ما يسجل |
|---|---|---|
| جبر محدود | SymPy gateway + verified algebra steps | صحة نتيجة/تحول حيث يغطي المحرك؛ غير مدعوم = `abstain` |
| فيزياء حركة 1D | physics gateway تحت model/units معتمدين | قيم ووحدات وسياق محدود؛ لا تفترض الاحتكاك أو القوى المركبة |
| برمجة | tracer/Parsons B3 عند توفرهما؛ Runner فقط بعد Gate-R | نتيجة تعلم/التصحيح، منفصلة عن الحكم المستقل |
| تفسير/خطة مفتوحة | rubric بشري أو قاعدة محددة؛ LLM اقتراح غير نهائي | feedback غير حاسم، `needs_review` عند عدم القدرة على التحقق |

## Rubric متوازن — مثال مبدئي 4 معايير
1. **تحديد المطلوب وفهم المعطيات** — 0/1/2.
2. **تسويغ الخطة وتحديد الافتراضات** — 0/1/2.
3. **سلامة الحساب/المنطق ضمن نطاق المتحقق** — 0/1/2 أو `not_verified`.
4. **تفسير النتيجة والتحقق من ملاءمتها** — 0/1/2 أو `needs_human_review`.

لا تجمع البنود المفتوحة إلى رقم تحصيلي تلقائي عندما لا توجد مراجعة، ولا تحوّل الدرجة إلى `independent_evidence` في A2.

## شروط الاتساق
- write transaction مع `expectedRevision`; طلب مكرر بـIdempotency-Key يعيد النتيجة نفسها دون مضاعفة الحدث.
- `verified/incorrect/inconclusive/unsupported/service_error` حالات متميزة؛ `service_error` لا يعاقب المتعلم.
- إذا أظهر hint مثالاً مكافئًا أو تم الكشف عن الخطوة، يُسجل exposure على المشكلة/عائلتها ويمنع اعتماد نفس المحاولة مستقلة.
- إيقاف كامل المنتج C1 عبر feature flag لا يحذف الجلسات؛ read-only لاستعادة العمل بعد التراجع.

## حالات اختبار حاسمة
المتغيرات الخاطئة وunit mismatch، خطتا حل صحيحتان، طلب تلميح ثم نتيجة صحيحة، إعادة إرسال 10 مرات، تغيير هوية الطالب في التبويب، خطأ محرك مؤقت، عدم نشر سيناريو، تغير نسخة أثناء جلسة، بيانات عربية مع أرقام/رموز LTR.
