# 24 — تسلسل التنفيذ، المهام وبوابات الانتقال

> نفذوا المصدر الاصطناعي الكامل C1–C5، لكن **لا تفعّلوا** التعلم الحقيقي أو AI خارجيًا أو Runner/PhET أو نشر المحتوى دون موافقات. إذا تعذر Gate بشري، أكملوا الأجزاء البرمجية المأمونة وسجلوا BLOCKED_LAUNCH، لا تختلقوا نجاحًا.

| المهام | المطلوب | التبعيات | بوابة قبول الكود |
|---|---|---|---|
| C-00 | re-audit HEAD والفجوات/flag الحالية ومسار DB/contract | لا شيء | manifest + no assumptions + source SHA |
| C-01 | ADR: نوع النشاط وتخزين session/project + قرارات reviewer/RBAC + event schema | C-00 | القرار مكتوب وتحليل backward compatibility |
| C-02 | العقود المشتركة والـparser والمصدر schema + event types + flags default OFF | C-01 | compile/contracts + security redaction test |
| **C4-01** | Studio extension لتأليف/معاينة C1/C2/C3 | C-02 | roundtrip draft/validate/preview |
| **C4-02** | مراجعة science/UDL، صلاحيات وحالات نشر ونسخ immutability | C4-01 | reviewer/gate/publish/archive/version regression |
| **C3-01** | أدوات accessibility المشتركة وRTL/LTR/preferences | C-02 | keyboard+labels+focus+text fallback |
| **C3-02** | UDL variants داخل الدروس والمختبرات والمشاريع | C3-01, C4-01 | equivalence/construct validity review checklist |
| **C1-01** | problem registry/schema/scenario review، owner sessions/state | C4-01, C3-01 | session/start/restart/CAS/idempotency |
| **C1-02** | stage workflow، تكامل محركات A/B وfeedback | C1-01 | golden algebra/physics/python + training-only |
| **C1-03** | واجهة الطالب (فهم→خطة→تحقق→تبرير→تأمل) | C1-02, C3-02 | 3 مسارات synthetic + accessibility |
| **C2-01** | project spec/milestones/limited artifacts/revision storage | C4-01, C3-01 | submission revision/owner/retention |
| **C2-02** | rubric review/feedback/revision + milestones | C2-01 | reviewer authority, no fake autonomous grade |
| **C2-03** | واجهة المشروع (micro→multi-lesson) و3 fixtures | C2-02, C3-02 | completion vs mastery clearly separated |
| **C5-01** | event normalizer/outbox/projection + dictionary/version | C-02 ويمكن موازاته بالبقية | replay/dedup/owner/retention PASS |
| **C5-02** | student dashboard + studio content quality aggregates | C5-01, C1-03, C2-03 | denominators/null/missingness/privacy |
| C-VERIFY | full regressions A+B/V2.2/contracts/QA/accessibility/security | جميع الملفات | no critical/high known, honest NOT_RUNs |
| C-FINAL | reports + source diff + manifest + restore/flags instructions | C-VERIFY | CODE COMPLETE / RELEASE PARTIAL separated |

## قواعد الانتقال
- **G-0:** لا تكتب migration قبل توثيق baseline وتوافق نوع النشاط وأثره على ARecords وStudio.
- **G-C4:** محرك تأليف ونشر صالح C1/C2/C3. يجوز إدخال fixtures للاختبارات مع TEST_ONLY؛ لا موافقة بشرية اصطناعية.
- **G-C1:** حالات C1 والتغذية الراجعة والـnovelty صحيحة؛ لا إتقان من نشاط تعلّمي.
- **G-C2:** المشروع يملك مراجعات ونسخًا وحقًا واضحًا للوصول والتراجع؛ لا تنفيذ كود غير معزول.
- **G-C3:** كل نشاط جديد يستخدم ARIA وkeyboard وfallback، لا تخطي وصول بحجة المختبر تجريبي.
- **G-C5:** metrics مستندة إلى مصادر إثبات مصرح بها، no raw PII، n/denominator/status واضح، replay idempotent.
- **G-SEC:** ownership, claim/export/deletion/purge/consent, private-leak, concurrency; لا ينسب لعدم وجود حوادث.
- **G-RELEASE:** منفصل عن CODE COMPLETE؛ فيه اختبار هواتف وقارئ شاشة، وتوقيع اختصاصيين، وقرار تشغيل/خصوصية.

## حالات توقف
- Contract core أو math/physics verdict تنحرف عن Golden → توقف الدمج وحدد السبب، لا تغيّر expected عشوائيًا.
- أمن عالي (IDOR/hidden solution leakage/unsafe Runner) → BLOCKED، لا تنشر ولا تفتح flag.
- فجوة بيانات تربوية أو reviewer sign-off → SOURCE_TEST_PASS ممكن، **لا** تحولها إلى PRODUCTION_ACCEPTED.

## اختبار خفيف في كل milestone
بعد كل تعديل: format/lint/typecheck للملفات المتأثرة، contract/unit tests ثم في نهاية المجموعة build/regression. تجنب تشغيل منتج/خدمة خارجية أو عمليات migrations فعلية على إنتاج. يمكن استخدام أدوات test integration التي تنشئ قاعدة عشوائية مؤقتة **فقط إذا سمحت البيئة والتفويض**، وإلا دوّن NOT_RUN.
