# 01 — إعادة فحص سورس `Khotwa-AI-codex-intelligent-learning-a.zip`

## معلومات الجرد
- فُتح الأرشيف ذو البصمة SHA256 `60c40f113162633ba5be95e3708e5b46f591f012d23e1c57ce5f51feb5f7999f`، وفيه **1054 ملفًا** في شجرة المشروع المراجعة؛ ليست مجرد تقارير.
- `README.md` و`package.json`: Node/NestJS API، React Web، Prisma/PostgreSQL وSymPy. افحص إصدارات البيئة الفعلية قبل التنفيذ، ولا تعِد بإعدادها أو تشغيلها في الإنتاج.
- `qa-reports/A-INTELLIGENT-LEARNING-FINAL-ACCEPTANCE.md`: A1–A8 منفذة مصدرًا، عقودها `1.4.0-development` في وقت تقرير A، اختبارات محلية، **PASS تقني وPARTIAL قبول نهائي**؛ لا توقيع متخصص أو إطلاق حقيقي.
- `qa-reports/B-FINAL-ACCEPTANCE.md`: B1–B3 منفذة فوق A، العقود `1.5.0-development` في وقت تقرير B، **195 اختبارًا** بحسب التقرير، وPARTIAL للمراجعات والأجهزة. Runner/PhET ما زالا محجوبين.
- المصدر المرفوع لا يثبت نشر C1–C5 أو اعتمادها أو جاهزية بيانات طلاب حقيقيين. لا تستنتج وجود Feature من اسم مستقبلي في وثيقة.

## ما يوجد في السورس وتكامل C معه
| الموجود فعليًا | دليل مصدر مباشر | الاستفادة المطلوبة في C |
|---|---|---|
| مسارات/دروس مراجعة ونشر وإصدارات | `apps/api/src/learning-path-content.ts`، `learning-path-payload.ts`، `apps/web/src/PathStudio.tsx` | C4 يوسع schema وstudio، مع `draft → in_review → approved → published → archived` |
| عقود lesson/track و13 نوع block منها `subject_lab_activity` | `packages/contracts/src/learning-paths.d.ts` و`apps/api/src/learning-path-payload.ts` | محتوى C1/C2 يمر بـstrict parser والعقود والpublic DTO لا بتخزين نص حر في درس |
| محرك القرار والتقدم والأنشطة A1–A8 | `intelligent-learning.ts`، `intelligent-learning-experiences.ts`، `intelligent-learning-data.ts` | C1/C2 يتصلان مع A1/A2/A3/A4/A5/A6/A7/A8 دون مكررات |
| السجل A: `intelligent_learning_records/events` | `apps/api/prisma/migrations/0023_intelligent_learning_a`، schema Prisma، `ARecords` | يمكن توسيع kinds/الـadapters لكن `ARecords` مقيد synthetic-only و64KiB، فلا نخزن فيه ملفات كبيرة |
| مختبرات B1–B3 | `apps/api/src/stem/`، `StemLabs.tsx`, `StemLabAuthoring.tsx`, `stem-labs.d.ts` | C1/C2 يستخدمان نشاط `learning_only` و`publicLabActivity`/المتحققات عند الملاءمة |
| B migration وحقول الحماية | `apps/api/prisma/migrations/0024_stem_labs_b` | migrations جديدة **بعد 0024**، عدم تعديل القديمة أو تجاوز kind check/retention |
| أدلة التقييم والمهارات | `learning-assessments.ts`, `knowledge-graph.ts`, `learning_assessments`, `learning_assessment_items`, `skill_evidence` | A2 مصدر حكم الإتقان وC5 طبقة تجميع/قراءة فقط؛ لا ندير دفتر درجات ثانويًا |
| التقديم العلمي | `math-gateway.ts`, `physics-gateway.ts`, `programming-runner.ts` و`apps/api/src/stem/*.ts` | نطاق محدود: جبر SK-ALG-01..07، فيزياء حركة 1D، برمجة غير تنفيذية ما لم Gate-R |
| الحساب والصلاحيات | `learning-access.ts`, `accounts.ts`, `product-core.ts`, `intelligent-learning-data.ts` | `owner_key`/CSRF/Origin/Idempotency/CAS والتحقق من actor؛ منع تسرب بيانات طالب إلى آخر |
| الاستوديو والصلاحيات | `learning-path-content.ts` | teacher/content_manager/admin يستطيعون التحرير؛ approve/publish/archive تتطلب admin في هذا المصدر |

## حقائق يجب ألا يسيء الوكيل تفسيرها
1. `.env.example`: **كل** `PEDAGOGY_ENGINE_ENABLED`, `MASTERY_PROJECTION_ENABLED`, `DEEP_DIAGNOSIS_ENABLED`, `KNOWLEDGE_GRAPH_A_ENABLED`, `SPACED_REVIEW_ENABLED`, `FADING_SCAFFOLD_ENABLED`, `SOCRATIC_TUTOR_ENABLED`, `METACOGNITION_ENABLED`, `MATH_LAB_ENABLED`, `PHYSICS_LAB_ENABLED`, `CODING_LAB_NONEXEC_ENABLED` = `false` مبدئيًا. كذلك `CODING_LAB_RUNNER_BRIDGE_ENABLED=false` و`PHET_INTEGRATION_ENABLED=false`.
2. `requireAFeature` و`authorizeA()` يرفضان A عند `!store.syntheticData` حتى إن تغيّر العلم؛ C لا يفتح هذه الحراسة خفية.
3. حدود `parseLearningPayload`: payload `kind=track|lesson`، `block` strict allowlist، مهارات معتمدة فقط. **توسيعها يتطلب تعديلًا واعيًا ومراجعة جميع المستهلكين**.
4. B يعيد نشاطًا بـ`evidenceClass: learning_only`، ويعالج exposure/novelty؛ أي نشاط C يستخدم المختبر لا يحوله إلى نجاح مستقل.
5. `intelligent_learning_records` بحد JSON تطبيقي **65536 بايت** في `ARecords` (حد SQL مختلف وأعلى)؛ لا يعتمد عليها المشروع لحفظ إنتاجات كبيرة أو مرفقات.
6. العقدان A وB مثبتان في تقاريرهما، لكن **نسخة العقد الحالية في HEAD** تُقاس من `docs/12-API-CONTRACT.yaml`؛ لا تثبت رقمًا جديدًا دون توليد وفحص.
7. القضايا المرجعية `GOLD-DIAG-015` و`ERR-ALG-05/calculation_divide ↔ SK-ALG-06` ما زالت محجوبة؛ لا تحسمها أو تغير Golden بحجة محتوى C.
8. ليست لدينا من المصدر إثباتات مستخدمين حقيقيين/هواتف/قارئ شاشة/مراجعات تعليمية بشرية أو تفعيل مدفوع.

## فحص delta في أول خطوة للوكيل (قراءة فقط)
```bash
git status --short
git branch --show-current
git log -1 --format='%h %s'
rg -n 'problem_based|project_based|learning_analytics|representation_set_v1' apps packages docs || true
rg -n 'intelligent_learning_records|learning_content_revisions|learning_assessment_items' apps/api/prisma
rg -n 'PEDAGOGY_ENGINE_ENABLED|MATH_LAB_ENABLED|PHET_INTEGRATION_ENABLED' .env.example
```
دوّن نتيجة هذه المقارنة في تقرير C-00؛ لا تنسب للمستودع وقت تنفيذ الوكيل ما رأيناه في الأرشيف فقط.
