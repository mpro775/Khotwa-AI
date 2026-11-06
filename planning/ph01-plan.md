# خطة PH-01 — TASK-011…017

> شرط الدخول: GATE-0 APPROVED على أساس تفويض مسؤول المشروع في gate0-closure.json. التنفيذ محلي اصطناعي فقط على codex/ph01-foundation؛ لا PH-02 تلقائيًا.

- TASK-011: npm workspaces، React/TS/Vite في apps/web، NestJS/TS في apps/api، Python/SymPy في services/math-engine، وأنواع وعقود مشتقة في packages/contracts. المصدر العام الوحيد docs/12-API-CONTRACT.yaml.
- TASK-012: إقلاع محدود لأربع حاويات، PostgreSQL وPython بلا منافذ منشورة، وNestJS خلف web proxy. فحص صحة محمي فقط؛ لا جلسات أو parser أو تعليم أو محرر في هذه المرحلة.
- TASK-013: scripts فعلية للتنسيق وlint والأنواع والبناء، npm lock وPython locks؛ فحص native يختبر HTTP والتفويض وصحة DTO وحالة تعذر DB بصدق.
- TASK-014: نسخة مطابقة بالبايت من OpenAPI و3 JSONات وآلية توليد types وفحص drift؛ لا تغيير canonical API.
- TASK-015: .env.example فارغ القيم السرية؛ توليد أسرار محلية في .local/compose.env غير المتتبع؛ شبكة backend internal وحجب /internal في proxy.
- TASK-016: CI خفيف على Ubuntu/Node24/Python3.13 للبناء والعقود وsmoke دون نشر أو بيانات حقيقية.
- TASK-017: seed اصطناعي خاص ثابت وقابل للإعادة، مرتبط بنسخة Golden وبصمتها؛ مسودات غير منشورة فقط. لا مخطط DB أو migrations قبل قرار ORM، ولا نشر 18 بذرة غير مجازة.

التحقق المتوقع: البناء والأنواع والتنسيق، drift/schema، seed idempotence وعدم نشره، native smoke، docker compose config وبناء/إقلاع/health وعزل الشبكة. توثق النتائج الفعلية في qa-reports/ph01-delivery.md وملف JSON منفصل. لا دقة رياضية أو أمان تشغيل شامل مدعيان من هذه الفحوص.

تبقى Prisma مرشحًا قبل PoC، وMathLive لا يختار قبل PH-02، وAI معطل. مراجعة التسليم بواسطة مسؤول المشروع والمجالات المسماة سابقًا؛ الوكيل منفذ تكامل لا ينتحل توقيعات. لا push أو نشر خارجي أو تعديل حذوفات المستخدم.
