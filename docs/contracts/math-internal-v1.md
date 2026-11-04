# مقترح العقد الداخلي math-internal-v1

> PH-00 • 2026-11-04 • proposed / ready_for_review؛ **غير معتمد بشريًا، ولا خدمة منفذة**.
> الملاك: التكامل وNestJS وPython/Math والبيانات وQA؛ الأمن لمصادقة الخدمة وحدودها، والمختص للمعنى الرياضي.

المصدر الآلي: [JSON Schema Draft 2020-12](math-internal-v1.schema.json). [الأمثلة](math-internal-v1.examples.json) مصطنعة للتحقق من العقد فقط. المرجع الرياضي [10](../10-MATH-ENGINE.md) والبيانات [11](../11-DATA-MODEL.md). العقد العام [12](../12-API-CONTRACT.yaml) باقٍ كما هو، بنسخته `1.0.0-draft`؛ لا مسار داخلي أضيف إلى paths العامة.

## النسخ والتوافق

- wire=`math-internal-v1` وAST=`math-ast-v1`؛ الإضافة في PH-00 **مقترح** لا تفعيلًا لنسخة معتمدة. يجب تجميد البصمة مع الموافقات قبل استخدام عميل وخدمة حقيقيين.
- نُسخت InternalMathContext/TransitionRequest/TransitionResult/Evidence وتبعياتها من `12` دون تغيير الدلالة؛ تبدلت مراجع `$ref` محليًا إلى `$defs` فقط. يفحص QA التطابق آليًا لمنع الانحراف.
- `operation` حقل تمييز **للعمليتين الجديدتين فقط**؛ لا يضاف إلى حمولة verify-transition الحالية ذات additionalProperties=false.
- المتغير `س`، المجال `reals`، العدد النسبي num/den كسلسلتين وفق `12`، وattemptRevision عدد صحيح Int32 غير سالب؛ لا BigInt عابر لـJSON ولا float للحساب الدقيق.
- لا fallback لنسخة schema/AST مجهولة ولا استنتاج نسخة من أسماء الحقول. يرفض NestJS الاستجابة المخالفة قبل حفظ مشتق، ويعامل تعذر الخدمة كحالة تقنية، لا كخطأ طالب.
- على الطلب والرد الجديدين إعادة context وrequestId ومراجع الخطوة/المصدر؛ NestJS يقارنها بلقطة الطلب ثم بالنسخ النشطة في DB عند الاعتماد الذري. الرد القديم لا يحدّث الحالة الحالية.

## العمليات الخاصة المقترحة

| العملية | schema الطلب / الرد | السلوك |
|---|---|---|
| POST /internal/v1/math/parse | InternalMathParseRequest / InternalMathParseResult | raw من NestJS مع context ومصدر problem/step؛ parsed أو سبب تعذر دون حكم انتقال |
| POST /internal/v1/math/verify-transition | InternalMathTransitionRequest / InternalMathTransitionResult | المخططان الحاليان في 12؛ مجموعتا الحل ودليل الاختلاف |
| POST /internal/v1/math/check-final | InternalMathCheckFinalRequest / InternalMathCheckFinalResult | الأصل والخطوة الأخيرة بإصداراتها؛ تكافؤ وعزل وتعويض دقيق، دون قرار completed |
| GET /internal/health | خارج هذه الحمولات التعليمية | فحص داخلي محمي بلا بيانات طالب؛ تفاصيل تشغيله ومصادقته تعتمد في مرحلته |

هذه أسماء **خاصة**، لا منافذ أو routes منشأة. NestJS هو backend المتصفح الوحيد. لا DB أو cookies أو أسرار طالب داخل Python؛ الاتصال بمضيف الخدمة من إعداد موثوق ومصادقة مستقلة ومهلة/حجم محدودين وفق 16. آلية المصادقة وقيم الموارد النهائية ما زالت تتطلب مراجعة الأمن والقياس.

## parse وAST

مصدر `problem` يفرض stepVersionId=null، و`step` يفرض UUID نسخة الخطوة. لا تكفي UUID لإثبات الملكية؛ يفوض NestJS قبل الطلب. raw لا يتجاوز 256 Unicode code points وفق العقد الحالي، ولا يُصلح إدخالًا ملتبسًا بالتخمين.

عند parsed: AST وnormalizedText وdisplayAr إلزامية وغير فارغة؛ reasonCode وissue يساويان null. عند الفشل: AST والعرض المشتق والتطبيع null، مع reasonCode، وMathIssue كامل عند syntax_error/unsupported. يحفظ النص الخام الأصلي مستقلًا حتى عند العطل. `service_error` ممكن داخليًا وفي DB؛ ليس parseStatus عامًا جديدًا.

AstDocument يضم schemaVersion وnotationProfileVersion وsourceRaw وEquation root. العقد المسموحة: Integer، Variable، Negate، Add، Subtract، Multiply، Divide، Equation. كل عقدة لها sourceSpan، وgroupSpans اختياري للأقواس، وMultiply يحمل implicit لحفظ شكل المصدر. لا Function/Power/اسم متغير آخر، ولا AST يرسله المتصفح بوصفه مرجعًا موثوقًا.

JSON Schema يتحقق من الأنواع والحقول والنسخ. **بعده يلزم حارس دلالي** قبل الحفظ والحساب: start≤end≤عدد code points في raw، spans الأب/الابن ومجالات الأقواس متسقة، AST مطابق للنص المحلل، المقام ثابت مقيم وغير صفري، الضرب لا يجمع تعبيرين متغيرين، والحساب خطي. لا يثبت JSON Schema وحده هذه الحقائق. حدود العمق 16 والعقد 128 وحجم الأعداد المذكورة في 10 تبقى مقترحات guard للمراجعة والقياس، وليست نتائج تحميل فعلية.

## check-final وفصل القرار

الطلب يعين originalRaw وfinalStep.stepVersionId/raw مع problemRevisionId وattemptRevision. يقرأ NestJS الأصل والنسخة من DB، لا من قيم يختارها الطالب. الرد يعيد context وfinalStepVersionId والحالة ومجموعتي الحل والدليل، وإشارات isIsolated وsubstitutionValid وsolution.

- verified_valid يعني تكافؤًا رياضيًا فقط. `٢س=٤` يمكن أن تكون متكافئة وisIsolated=false؛ solution/substitutionValid عندئذ null، والمحاولة ليست مكتملة بسبب هذا الرد وحده.
- عند isIsolated=true تكون solution نسبة دقيقة وsubstitutionValid نتيجة تعويض. اكتمال الحل يتطلب أيضًا حلًا وحيدًا، والتكافؤ، وسلامة السلسلة الحالية، ونسخة المحتوى والمساعدة المسجلة.
- في syntax_error/unsupported/inconclusive/service_error تكون إشارات النجاح والحل والمجموعات والدليل null. verified_invalid يتطلب دليلًا مناسبًا؛ فشل بناء دليل موثوق يوجب الامتناع، وفق 10.
- لا حقول completed أو mastery أو independence في هذا العقد. NestJS وحده يجمع أحكام السلسلة الفعالة ويقرر حالة المحاولة؛ Python لا يكتبها في DB.

## الربط مع البيانات والمتصفح

| wire | حقل/قيد 11 | مسؤولية NestJS |
|---|---|---|
| context.attemptId/attemptRevision | verification_runs.attempt_id/attempt_revision_requested، attempts.revision | تفويض ثم قراءة لقطة؛ مقارنة ذرية عند رجوع الرد |
| context.problemRevisionId | problem_revision_id وإصدار المحتوى الأصلي | المرجع نفسه في المحاولة والطلب والنتيجة |
| source.stepVersionId / finalStep.stepVersionId | step_versions.id وstep_slots.current_version | انتماء المحاولة والموضع والنسخة الحالية؛ لا استبدال Step.id بمعرف النسخة |
| transition.fromKind/fromStepVersionId/toStepVersionId | from_kind وfrom_step_version_id وto_step_version_id | مصدر problem يفرض null؛ مصدر step يفرض نسخة صحيحة من المحاولة |
| AST wrapper + engineVersion + notationProfileVersion | parse_results.ast/engine_version/notation_profile_version | تخزين الغلاف المُنسَّخ داخل jsonb؛ لا migration هنا؛ لا اعتماد AST من العميل |
| evidence + schemaVersion | verification_results.evidence_json/schema_version | تحقق schema والأصل والإصدار قبل إدخال المشتق |
| parseStatus=service_error | parse_results.parse_status=service_error | العرض العام MathStatus=service_error، وExpression.parseStatus=not_checked؛ يحفظ raw ولا دليل سلبي |

بقية حالات parse العامة: parsed/syntax_error/unsupported/inconclusive تطابق تعداد Expression الحالي. parsed لا ينتج verified_valid تلقائيًا. AST داخلي ولا يُسرّب للواجهة؛ تعاد DTOs العامة القائمة فقط.

## حدود دليل PH-00

الفحص الحالي يثبت صحة المخططات والأمثلة، وتطابق الأنواع المشتركة، وبعض حراس البنية والنسخ، ونقل JSON/Unicode بين Python وNode، وربط الحقول الموثق بـ11. **لم توجد خدمات NestJS/Python أو DB** لاختبار تكامل حي أو معاملات أو صحة محلل/تعويض. تبقى هذه أدلة GATE-1 وما بعدها، مع اعتماد المراجعين قبل تجميد المقترح.
