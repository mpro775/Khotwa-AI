# 15 — أمان المختبرات وخصوصية الطالب والإطلاق التدريجي

## 1. مصفوفة مخاطر

| الخطر | التحكم المطلوب | اختبار يثبت |
|---|---|---|
| نشر answer key أو hidden tests | فصل public DTO عن author-only rubric، مراجعة serialize | GET الدرس/المختبر لا يحتوي answerKey/correctOrder/hiddenTest/private fields |
| كشف تقييم من نشاط تدريب مشابه | novelty policy by family/identity/exposure، قفل عند reveal | كشف حل قبل القياس يُخرج المادة من بنكه مستقلة |
| تجاوز الملكية عبر UUID | owner authorization بكل GET/POST، رد 404 ملائم | الطالب ب لا يستطيع استئناف جلسة أ |
| تعديل revision ماضية | immutable published revision/pinned snapshot | جلسة محفوظة لا تتغير بعد نشر v2 |
| XSS في شرح/كود/رسم | React escaped text؛ strict content types؛ لا `dangerouslySetInnerHTML`, no arbitrary HTML/JS | payload `<script>` يظهر نصًا خامًا دون تنفيذ |
| إرهاق السيرفر | bounded points/events/code length، throttles، timeouts، quotas | 10^6 samples أو flood يرفض بأمان |
| Runner escape | private sandbox attestation + isolation checks + secrets isolation | Gate-R مغلقة عند غياب الإثبات |
| تسريب خصوصية عبر PhET | integration off افتراضيًا، license & privacy gate، no PII third-party | لا iframe/requests خارجية عند flag off |
| content poisoning/LLM hallucination | reviewed rules + verifiers only؛ LLM feedback non-authoritative | LLM لا يمكنه تعديل verdict أو content publication |
| تسرب تلميح من جلسة قديمة | event ownership+version، invalidate stale derived messages | سطر مساعدة قديم لا يظهر لنسخة سؤال جديدة |

## 2. البيانات المسموح تسجيلها

الأفضل: نوع النشاط، skillCode، نسخة المحتوى، timestamp، سؤال سياق محدود، كشف المساعدة، ونتيجة المختص المصنفة. **لا تسجل** source code أو تعليقات شخصية أو prompts AI أو outputs الخام في تحليلات عامة. إذا احتاج `subject_attempts` حفظ codeRaw لدعم الاستئناف، اتبع سياسة الخصوصية/الاحتفاظ الأصلية؛ لا تنسخه كـtelemetry ثانية.

- توضيح للطالب أن نتائج المحاكاة والتدريب لا تساوي قياسًا مستقلًا.
- حذف الحساب وguest account claim يعالجان جلسات/أحداث B الجديدة كاملة.
- لا تنقل قراءات/سجل نشاط إلى PhET أو مقدمات سحابية دون سياسة/موافقة مستقلة.
- الحسابات الحقيقية تحتاج سياسات التعلم/AI consent القائمة؛ لا تعتبر موافقة جلسة اختبار إذنًا على بيانات حقيقة.

## 3. Flags مقترحة

| flag | افتراضيًا | أثر التعطيل |
|---|---|---|
| `MATH_LAB_ENABLED` | false خارج التطوير | يعرض الدرس الأصلي ويمتنع عن واجهة graph التفاعلية |
| `PHYSICS_LAB_ENABLED` | false خارج التطوير | يعرض مثال الفيزياء ونتيجته المنشورة دون محاكاة |
| `CODING_LAB_NONEXEC_ENABLED` | false خارج التطوير | يعرض أمثلة Python فقط دون trace/parsons |
| `CODING_LAB_RUNNER_BRIDGE_ENABLED` | false | لا يُفعل submit/run في المسارات مهما كان origin |
| `PHET_INTEGRATION_ENABLED` | false | لا يرسل المستخدم للخدمة الخارجية ولا يحمّل assets |

هذه **أسماء مقترحة**؛ عند وجود feature flags من A أو config مشتركة، التزمها بدل نسخ config. جميعها لا تستبدل `RUNNER_ISOLATION_ATTESTED` أو permission server-side.

## 4. مراحل الإفراج

1. **Code complete local:** واجهات محتوى وواجهات طلب، اختبارات mocks وغير تنفيذية، build.
2. **Lab pilot synthetic:** قاعدة اختبار منفصلة + بيانات مصطنعة + محاكيات أصلية؛ لا تفعيل خارجي/مدفوع.
3. **Scientific review:** اعتماد مختص رياضيات/فيزياء/برمجة للنماذج والأمثلة وrubrics؛ لا يصدر الوكيل تلك الموافقات.
4. **Security review:** Gate-R وdata retention وأمن الطرف الثالث تُراجع منفصلة؛ يمكن بقاء Runner/PhET مغلقين.
5. **Supervised learner pilot:** تفويض منفصل لجمع بيانات طلاب حقيقيين وقياس تعلم؛ لا تدعي نجاحًا تعليميا من unit tests.
6. **Production rollout:** تفويض عمليات ومراقبة وrollback والتحقق من توافق A1–A8؛ خارج هذا التكليف.

## 5. الاسترجاع والتراجع

- flags off تعيد `LearningPaths` و`LessonRenderer` إلى سلوك V2.2 وأي A modules من دون كسر المسارات المنشورة.
- migrations forward-only غير هدامة؛ لا تُسقط schema أو تمس أدلة محاولات قديمة، وخطة backfill منفصلة وdry-run فقط.
- تعرضات المحتوى المسجلة لا تُحذف لتجاوز novelty؛ إن اضطر النموذج لتعطيل محتوى قديم فالطالب يحتفظ بتاريخ الأداء.
- عند عطل verifier: حافظ على input و`pending/neutral` مع retry idempotent.
