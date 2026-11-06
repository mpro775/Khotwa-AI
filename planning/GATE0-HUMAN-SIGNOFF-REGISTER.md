> **تحديث نافذ:** GATE-0 APPROVED على أساس [قرار مسؤول المشروع بتفويض الوكيل](../planning/GATE0-OWNER-DELEGATED-DECISION.md). شرط الأصلين والتجميد المرتبط بهما مسقط لهذه البوابة؛ النص أدناه يحفظ الحالة السابقة. لا توقيع مباشر أنشئ باسم المراجعين. [المحضر الرياضي](../planning/approvals/MATH-SCOPE-OWNER-DELEGATED-APPROVAL.md)، [الإقرار الهندسي](../planning/approvals/ENGINEERING-QA-SECURITY-OWNER-DELEGATED-APPROVAL.md)، [سجل الإغلاق](../planning/gate0-closure.json). PH-01 مأذون للمهام 011…017، ثم التوقف للمراجعة.

# سجل أدلة الاعتمادات البشرية — نتيجة المطابقة المحلية

> 2026-11-04 / Asia/Riyadh • الحالة: **OWNER_REPORTED_APPROVALS; DIRECT_SIGNOFF_EVIDENCE_NOT_PRESENT**.
> أسماء المراجعين وإفادة موافقتهما مثبتة من المالك. لا نعيد طلب اعتماد القرارات؛ نميزها عن الأصول اللازمة لمطابقة الإغلاق.

| المراجع | الصفة/النطاق بحسب المالك | حالة الموافقة المبلغ عنها | الدليل المتاح محليًا | تاريخ إقراره المباشر | نتيجة المطابقة |
|---|---|---|---|---|---|
| الأستاذ مراد سيف | معلم رياضيات ثانوي؛ DR-001 والجانب الرياضي من DR-002 | owner-reported approved | [محضر إفادة المالك](approvals/incoming/MATH-TEACHER-APPROVAL-GATE0.md)، وليس رسالة أو توقيعًا صادرًا من الأستاذ | غير مودع؛ 2026-11-04 تاريخ تسجيل الإفادة فقط | لا أصل مباشر مطابق للنطاق/التاريخ/النسخة |
| المهندس محمد مراد | عقود NestJS/Python وQA وتصميم الأمن؛ DR-003/004/005 | owner-reported approved and contracts frozen | [نموذج التوقيع](approvals/incoming/PH00-MOHAMMAD-MURAD-SIGNOFF-FORM.md) بحالة AWAITING_HUMAN_ATTESTATION وخانات فارغة، و[تدقيق فني](approvals/incoming/PH00-FINAL-CONTRACT-QA-SECURITY-REVIEW.md) ليس توقيعًا | غير مودع | لا أصل مباشر أو سجل تجميد معتمد مربوط به |
| مالك المنتج | النطاق وDR-010 والإذن المشروط لـPH-01 | OWNER_AUTHORIZED_CONDITIONAL | [قرار المالك](GATE0-OWNER-FINAL-DECISION.md) و[توضيحه أثناء المطابقة](GATE0-OWNER-EVIDENCE-CLARIFICATION.md) | 2026-11-04 تاريخ تسجيل الرسالة | التفويض مثبت؛ التفعيل ينتظر اكتمال أدلة البوابة |

## الأصول والملفات المساندة

نُقلت ستة ملفات مراجعة من التنزيلات دون تغيير إلى `planning/approvals/incoming/` لحفظ سلسلة المصدر؛ **نسخها إلى مجلد approvals لا يمنحها صفة توقيع**. فهرس المصدر والبصمات في [سجل الاستيراد](../qa-reports/gate0-overlay-import.json).

المراجعة الرياضية المحدّثة تصف أصلها كتقرير فني وملحق إفادة مالك، والتدقيق الهندسي JSON يحمل human_approval_received=false وhuman_signatures_found=0. لا نرفع هذه النتائج إلى اعتماد صادر من شخص.

المسارات المراد إيداع الأصول فيها: `planning/approvals/`، مع اسم المصدر/نوعه/تاريخ الإقرار/النطاق/الشروط/النسخة والبصمات التي راجعها. لا ملف جديد مسمى كتوقيع مباشر أنشأه الوكيل، ولا تواريخ signed_at مفترضة. لا تدل بصمة الملف وحدها على هوية كاتبه أو صحة توقيعه.

## الإحالات الفعلية الآن

- math_direct_evidence_path: **غير متاح**.
- engineering_direct_evidence_path: **غير متاح**.
- approved_contract_freeze_manifest: **غير موجود**؛ `planning/gate0-freeze-manifest.template.json` نموذج فقط.
- current_contract_hash_inventory: [جرد حالي غير معتمد](gate0-current-contract-inventory.json)، وليس سجل تجميد موقعًا.
- final_gate_decision: **BLOCKED_PENDING_SIGNOFF_EVIDENCE**.
- owner_permission_PH01: **موثق ومشروط؛ لا حاجة لإذن مكرر بعد استيفاء الشروط**.

أكد المالك أثناء العمل عدم حفظ محضرين مباشرين في الملفات المتداولة، وطلب البحث في planning/approvals؛ لم يعثر الفحص على أصلين آخرين. [تقرير المطابقة](../qa-reports/GATE0-FINAL-RECONCILIATION.md) يسجل النقص المحدد. لا إعادة فتح للخيارات أو إعادة المراجعات السابقة عند إيداع الأصول؛ يطابق الوكيل نطاقها وشروطها وبصماتها فقط.
