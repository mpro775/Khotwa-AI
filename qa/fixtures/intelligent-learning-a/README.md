# البرنامج A — حالات اصطناعية مستقلة

`scenarios.synthetic.json` يضم 10 سيناريوهات A1–A8 تشمل حدود الجبر والفيزياء وقراءة Python. التوقعات حالات تصميم للاختبار، وليست نتائج تشغيل أو موافقات بشرية. `scientificReviewStatus=not_human_reviewed` و`publicationAllowed=false` ملزمان لهذه الحزمة؛ لا تستخدمها لبنك متعلم حقيقي ولا تعدّل Golden الأصلي لتوافقها.

تحقق A5–A8 المستهدف موثق في `qa-reports/A5-A8-TARGETED.json`. يختبر fake clock بحقن وقت الخادم، وعدم التكرار والملكية وCAS وخروج القياس والدعم وH4 والأهداف والتأمل. مستودع SQL في هذا الاختبار محاكاة داخل الذاكرة؛ الدليل التشغيلي المنفصل في `qa-reports/A-INTEGRATION.json` يخص تشغيل `qa/intelligent-learning-a-journey.mjs`، ولا تُستنتج نتيجته من وجود fixtures.

`evidenceTest` يرشد إلى الاختبار/سيناريو التكامل ذي الصلة؛ لا يعني أن كل سيناريو في JSON نُفذ آليًا بمجرد قراءة الملف.
