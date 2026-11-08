# 32 — التشغيل والمراقبة والتراجع دون فقد أدلة

## ما يجب مراقبته حين يؤذن باختبار/إطلاق
- `C_API_errors_by_route` وowner access denies، `409 revision_conflict` و`idempotency_conflict`, `content_not_reviewed`.
- `C1_validator_abstain_rate`، عدد الاستراتيجيات alternate، تسرب private content = 0 مطلوب.
- `C2_review_queue_pending_age` وأخطاء artifact type/size، لا عرض أسماء الطلاب علنًا.
- `C3_keyboard_blockers`, missing alt, fallback usage المجمع فقط.
- `C5_projection_lag`, missing event fields, replay divergences, small-n suppression, retention/purge, consent failures.
- `MathGateway/PhysicsValidator/B3` high-level availability بلا payloads حساسة.

## عند تعطل نظام فرعي
- فشل التحقق العلمي: يظل النص محفوظًا ويظهر `cannot_determine/try_later`؛ لا تضع خطأ في سجل الطالب.
- فشل C5: تعطّل اللوحات أو تظهر بيانات آخر snapshot موسومة بتاريخ؛ لا توقف حل المسألة أو المشروع.
- فشل B2 المحاكاة: قدّم نصًا/جدولاً بديلًا إذا يغطي نفس الهدف، دون القول إن simulation نفذت.
- فشل reviewer: المشروع يبقى `review_pending` وتاريخ التسليم محفوظ.

## خطة تراجع
1. أغلق أعلام C، ولا تحذف revisions أو project submissions أو تعرضات A/B.
2. أبق readers قادرين على قراءة sessions pinned أو أعط استعادة read-only؛ لا تطبق rollback database هدّام في الإنتاج.
3. أكّد في اختبارات regression أن C OFF يعود بمسارات A/B/V2.2 كما قبل.
4. إن كانت مشكلة تسرب أو هوية، اعزل endpoint/capability وأوقف نشر المحتوى المصاب بعد توثيق/استجابة أمنية.
5. migrations: forward-compatible؛ أي purge/store change يحتاج خطة منفصلة وتجربة restore.

## Disaster recovery المبدئي
- backups وrestore على بيئة اختبار مملوكة فقط، دون نسخ بيانات طالب حقيقي إلى بيئة تطوير.
- تقرير `RPO/RTO` مؤجل إلى مالك التشغيل؛ لا تدعي SLA غير مقاس.
- token/role/feature configuration يجب ألا تُعطى ضمن repo secrets.

## فحوص توقف نهائية
No hidden content exposure; no cross-owner disclosure; no grading by LLM alone; no automated C real enablement; no unreviewed public content; C5 dashboards show honest missingness/coverage.
