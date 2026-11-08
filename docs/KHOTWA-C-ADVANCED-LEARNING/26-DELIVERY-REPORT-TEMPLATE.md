# 26 — قالب تقرير تسليم المرحلة/التقرير النهائي

# تقرير C-[مرحلة] — [عنوانها]

**التاريخ:** YYYY-MM-DD | **الفرع و commit:** … | **حالة التغيير:** working tree / commit | **source reference:** … | **الأمر الأصلي:** …

## 1. الملخص
- الحالة: `SOURCE_PASS / PARTIAL / FAILED / NOT_RUN`.
- النطاق المكتمل، والمستبعد المبرر، والحواجز البشرية/التشغيلية.
- هل بقيت flags OFF وهل البيانات Synthetic فقط؟

## 2. تغييرات المصدر (بالملف والمسؤولية)
| الملف | سبب التغيير | مدى التأثير على A/B | الاختبار |
|---|---|---|---|
| `apps/api/src/...` | … | … | … |

## 3. عقود/قاعدة بيانات
- OpenAPI version وschema/DTO generated hashes؛ retrocompatibility.
- migrations الجديدة: الاسم، forward/rollback/rbac/owner/claim/export/purge؛ هل طُبقت؟ على أي قاعدة؟
- private vs public DTO، flags، policy/revision ids.

## 4. رحلة المستخدم والحكم العلمي
- سيناريو جبر/فيزياء/برمجة: خطوات، verifiers، نتائج sample، حالات امتناع.
- كيف حفظت المساعدة والتعرض/independence؟
- الحالات التي تحتاج مراجعة بشرية وأسماء reviewers التي وافقت بالفعل (أو `PENDING`).

## 5. الفحوص
| الأمر حرفيًا | النتيجة (exit code/tests) | البيئة | الدليل | الحدود |
|---|---|---|---|---|
| `npm run contracts:check` | … | … | … | … |

## 6. الأمن والخصوصية والإتاحة
- حالات 401/403/404/409، idempotency + concurrent writes.
- اختبارات التسرب وأمان artefacts/CSP/Runner.
- keyboard/RTL/LTR/zoom/screen reader؛ `NOT_RUN` حين لا توجد أداة أو بشر.

## 7. الحواجز/القرارات المفتوحة
| ID | الوصف | الخطر | من يقرر؟ | الأثر على release | البديل الآمن |
|---|---|---|---|---|---|

## 8. التراجع والإطلاق
- flags/off، compatibility، no destructive rollback، retention والتصدير، runbook مراجعة إنتاج منفصل.

## 9. المخرجات النهائية
- `CODE_COMPLETE` = yes/no بناءً على أدلة المصدر.
- `HUMAN_SCIENCE_ACCEPTANCE` = approved/pending.
- `SECURITY_PRIVACY_APPROVAL` = approved/pending.
- `MANUAL_DEVICE_ACCESSIBILITY` = approved/not_run/failed.
- `PRODUCTION_ENABLED` = true/false (لا تُخمّن).
- SHA256 للملفات والتقرير؛ توقيع/تاريخ إذا توفر.
