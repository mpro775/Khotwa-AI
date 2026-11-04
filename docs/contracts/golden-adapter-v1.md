# مقترح استيراد Golden — golden-adapter-v1

> PH-00 • 2026-11-04 • اعتماد QA والمختص معلق؛ لا تغيير في توقعات المرجع.

المصدر [cases.json](../14-GOLDEN-DATASET.cases.json) يبقى بإصداره `1.0-draft` وبصمته الأصلية. [JSON Schema](golden-fixtures-v1.schema.json) يثبت حقوله الست مجموعات وmetadata وأعداد snapshot الحالية، ولا يمنح اعتمادًا علميًا. حقلا math.note وdiagnosis.exclusion قد يكونان فارغين في المسودة؛ لا يملؤهما المستورد باجتهاده.

الأداة [golden_adapter.py](../../qa/golden_adapter.py) أداة QA محلية، لا جزء من تطبيق أو خدمة. تفحص JSON Schema وformat والتفرّد والمراجع ثم تنتج [golden-normalized.json](../../qa-reports/golden-normalized.json) كتوقعات اختبار، مع sourceRecord كامل غير معدل لكل حالة. 151 حالة و18 بذرة منفصلة؛ لا requests إلى API ولا actualResults أو pass/fail للمنتج.

## خريطة التحويل

| المصدر | التوقع الموحّد | القيد |
|---|---|---|
| parse.status=accepted | expected.parseStatus=parsed | قبول تحليل فقط؛ لا حكم صحة أو اعتماد مراجع |
| parse syntax_error/unsupported | الاسم نفسه | reasonCode يحفظ حرفيًا، والشرطة «—» فقط تتحول إلى null |
| math.status والمجموعات والشاهد | mathStatus وحقول نص التوقع كما هي | لا إعادة حساب/تصحيح أو تحويل guard إلى سؤال منشور |
| diagnosis.state=none | diagnosisPresent=false وdiagnosisState=null | لا اختراع قيمة none داخل تعداد API |
| بقية diagnosis | الحالة نفسها وcandidatePattern؛ «—»→null | لا ترقية tentative/needs_probe إلى supported_by_probe |
| H0…H4 | constraint exact مع المستوى نفسه | مستوى مساعدة متوقع لا نجاح تعلم |
| «H3 أو أقل» | at_most/H3 | لا يُختزل إلى H3 حصرًا |
| «لا كشف» / «—» | no_reveal / unspecified | لا يصنع مستوى H0 أو حلًا من عنده |
| expected/forbidden النصيان | expectedText/forbiddenText كما هما | يحتاجان اختبار سلوك ومراجعة؛ ليسا assertions ناجحة تلقائيًا |

sourceRecord وsourceMetadata يحفظان كل التوقعات والنصوص الأصلية؛ يمكن مقارنة النسختين للتحقق من عدم الفقد. subjectReview=unreviewed وproductExecution=not_run يخصان هذا snapshot، ولا يجوز استعمال إعادة التوليد لطمس محضر مراجعة بشري منفصل.

رموز الأسباب في fixture محفوظة كقاموس مقترح لـv1، بما فيها MISSING_EQUAL_SIGN وUNEXPECTED_ADJACENCY. MathIssue.reasonCode في API string؛ هذا **توافق نوعي** لا اعتمادًا تلقائيًا للمعاني. يراجع المختص/QA mapping قبل التجميد. المخطط يرفض status غير معروف وحقولًا زائدة، والأداة ترفض المراجع المفقودة والمعرفات المكررة بدل إسقاط الحالة.

للاستجابة الداخلية الفعلية لاحقًا: parseStatus=service_error يُحفظ في DB، ويظهر كـMathStatus=service_error مع Expression.parseStatus=not_checked؛ لا نحشر service_error في تعداد parseStatus العام. inconclusive يحتفظ بتصنيفه، وparsed لا يحدد الحكم الرياضي. المصدر الحالي لا يحتوي حالات parse service_error/inconclusive؛ لا نضيفها إليه ضمنيًا لتجميل التغطية.

## إعادة التشغيل

```powershell
python -X utf8 qa/golden_adapter.py --deps "$env:TEMP\khotwa-ph00-correction-deps"
python -X utf8 qa/validate_ph00_correction.py --deps "$env:TEMP\khotwa-ph00-correction-deps"
```

العينة المحجوبة وإجازة التلميحات والحلول والمراجعة العلمية ما زالت مطلوبة. توافق schema ونجاح تحويل 151 سجلًا لا يساوي اجتياز 151 حالة على المنتج.
