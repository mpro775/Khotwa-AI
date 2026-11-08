# 31 — سياسة الأعلام والتفعيل والإطلاق الآمن

## سياق الحاضر
`.env.example` يحوي A1–A8 وB1–B3 OFF افتراضيًا، و`SOCRATIC_EXTERNAL_AI_ENABLED=false`, `CODING_LAB_RUNNER_BRIDGE_ENABLED=false`, `PHET_INTEGRATION_ENABLED=false`. **وجود السورس لا يكفي**؛ `requireAFeature` يرفض طلبات A على مخزن غير اصطناعي. لا تعدّل هذا القيد ضمن C.

## أعلام C المقترحة
```dotenv
C_PROBLEM_LEARNING_ENABLED=false
C_PROJECT_LEARNING_ENABLED=false
C_UDL_CONTENT_ENABLED=false
C_ADVANCED_STUDIO_ENABLED=false
C_LEARNING_ANALYTICS_ENABLED=false
C_COHORT_ANALYTICS_ENABLED=false
C_PROJECT_UPLOADS_ENABLED=false
```
تخضع الأسماء النهائية للاتساق مع source config؛ أعلام الميزات لا تكسر access/authorization والـprivacy gate. غير معنى flags القديمة بحذر شديد.

## تشغيل تجريبي اصطناعي
1. compile/source tests + contract checks.
2. migrate قاعدة اختبار **عشوائية جديدة فقط** بعد موافقة تشغيل sandbox، وseed fixtures مسودات TEST_ONLY؛ استخدم تنشيط A/B في **الاختبار فقط** بالتدرج.
3. افحص نتائج C1/C2/C3/C4/C5 والقبول اليدوي في بيئة لا بيانات حساسة فيها ولا تكلفة خارجية.
4. أوقف flags وتأكد أن legacy A/B/V2.2 يعمل كما سبق وC content/session history لم يمح.

## إطلاق لاحق للطلاب الحقيقيين
خارج هذه الخطة البرمجية دون أمر مستقل. يتطلب: مراجعة scope حراس `syntheticData` وتحليل امتدادها **موافقة صريحة**، مراجعة علمية وتربوية محتوى، شروط قاصرين وموافقة، RBAC للمعلمين، وتخطيط backups/migrations/metrics/monitoring. لا تجعل تجاوز synthetic lock شرطًا لاجتياز اختبارات مصدر C.

## ترتيبات gradual rollout (بعد الاعتماد فقط)
C3 accessibility baseline → C4 authoring/approval → C1 شريحة جبر ثم 1D/برمجة → C2 micro مشروع → C5 student dashboard. افتح cohorts/مرفقات/الربط بين المواد بعد gates منفصلة. هذا ترتيب إطلاق لا يمنع تنفيذ C1–C5 في السورس.
