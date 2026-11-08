# 19 — نموذج تقرير التسليم / يُنسخ لكل مرحلة ثم تقرير نهائي

> املأ القيم بالأدلة الحقيقية فقط. لا تُبقِ PASS افتراضيًا. الحالات: `PASS`, `PARTIAL`, `BLOCKED`, `FAIL`, `NOT_RUN`.

```markdown
# KHOTWA B — [B-00 / B-01 / ... / B-07 / FINAL]

- التاريخ:
- git branch / commit SHA:
- المصدر baseline:
- المرحلة:
- حالة المرحلة:
- حالة أكواد A1–A8 في المستودع:

## المنفذ بالفعل
| ID | الميزة | الملفات المعدلة | contract/schema change | evidence/tests | الحالة |
|----|--------|-----------------|------------------------|----------------|--------|

## حالات قبل/بعد
- رحلة مستخدم (synthetic owner):
- المعادلة/الفيزياء/البرنامج المثال:
- نتيجة domain verdict:
- سجل assistance + novelty + disclosure:
- هل يُعد evidence مستقلًا؟ ولماذا؟

## نتائج الفحوص الحقيقية
| command / test | نتيجة فعلية | وقت/ملاحظة |
|----------------|------------|------------|

## فحص استقرار V2.2 وأي A
- القديمة ما تزال تعمل:
- A adapters المتوفرة:
- flags OFF:
- owner cross-access denied:
- guest claim:
- read-only/archived revision behavior:

## بوابات متبقية
- G-B1:
- G-B2:
- G-B3-N:
- G-B3-R (Runner isolation):
- PhET license:
- content scientific approvals:
- device/real learner pilot:

## مخاطر وقرارات (مع owner)
- ...

## تعليمات الفحص اليدوي للمالك
1. ...
2. ...

## ما لم يتم
- ... (لا تصف placeholders بأنها منفذة)
```

## عند التقرير النهائي

- اذكر رقم إجمالي الاختبارات التي نُفذت ونجحت وفشلت؛ العدد ليس قياس جودة تعليمية.
- ألحق أسماء الملفات والتغييرات في `packages/contracts`, `schema.prisma`, migrations، وأسماء routes الجديدة الفعلية.
- اذكر أين توجد أمثلة/أنشطة content **draft** وأيها **published فقط داخل المختبر**؛ لا تخلط الموافقة التقنية بالمراجعة التربوية.
- إن بقيت PhET/Runner/A modules blocked، اكتبها صراحة مع أثرها وما يعمل بدونها.
- لا تضع أسرارًا أو PII أو مقتطفات من hidden tests أو raw prompts خارج مسار موافقات الأمن.
