# C4 — عقود النشاط والتحقق والمراجعة العلمية

> جميع interfaces أمثلة تصميمية، **ليست** أنواعًا موجودة في الأرشيف الجديد. A/B منفذتان بالمصدر؛ دقق عقودهما الحالية، ثم وسّعها بإصدارات additive.

## Schema مميِّز (authoring side)
```ts
type CActivityDraft = {
  schemaVersion: "c-activity-v1";
  type: "problem_based" | "project_based";
  subjectCodes: Array<"algebra" | "physics" | "programming">;
  titleAr: string;
  objectives: string[];
  skillCodes: string[];
  prerequisiteSkillCodes: string[];
  publicBriefAr: string;
  supportPolicy: { hintsAllowed: boolean; revealMode: "after_submit" | "teacher_only" };
  representationRefs: string[]; // C3, public reviewed
  privateEvaluationRef: string; // server-only, never learner DTO
  contentRevisionRef?: string; // previous revision
};

type ProblemDraft = CActivityDraft & {
  type: "problem_based";
  scenarioAr: string;
  constraints: string[];
  stages: Array<"frame" | "plan" | "investigate" | "justify" | "reflect">;
};
type ProjectDraft = CActivityDraft & {
  type: "project_based";
  drivingQuestionAr: string;
  milestones: { code: string; titleAr: string; requiredArtifactKind?: string }[];
  rubricRevisionRef: string;
};
```
لا تسمح بـ`kind` جديد لدرس/مسار في `parseLearningPayload` قبل تقويم ripple effect على importers/contract; يحتاج خطة توافق وتغيير parsers/DTOs مع شرط ألا تُفسد الأنواع `track|lesson` الموجودة.

## Validation layers
1. Structural: strict fields/size/depth/version/allowed subject/required stage; reject untrusted HTML/JS/API urls.
2. Reference: IDs منشورة وقانونية وimmutable، skillCoverage، prerequisites و`mappingPending`, صلاحية reviewer.
3. Scientific: اختبار أمثلة/الوحدات/الأوامر على validators في النطاق المدعوم؛ لا تخترع حلولًا في الفيزياء غير 1D.
4. Pedagogy: عدم كشف الاستراتيجية مبكرًا في C1، milestones حقيقية في C2، Rubric بنطاق ومستويات، ومهمات مستقلة جديدة عند القياس.
5. Accessibility C3: alt/description/table/script transcript، label وkeyboard fallback، معاينة RTL/LTR.
6. Security: strip private key من learner DTO، provenance للمؤلف والمراجع، فحص capability gate Runner/media.

## نتيجة validator (proposal)
```json
{
  "schemaVersion": "c-validation-v1",
  "valid": false,
  "errors": [{"code":"private_answer_exposure","path":"privateEvaluationRef","blocking":true}],
  "warnings": [{"code":"insufficient_novel_questions","path":"skillCodes","blocking":false}],
  "scientificVerification":"not_run",
  "reviewRequired":["subject_reviewer","accessibility_review"],
  "generatedAt":"2026-11-08T00:00:00Z"
}
```
`scientificVerification:not_run` **لا يساوي** صحيح. Content validation لا يمنح موافقة بشرية، ولا يجوز للمحرر override `blocking` دون قرار موثق.

## إدارة التوافق
`schemaVersion`, `rubricVersion`, `validatorVersion`, `publishedHash`, `inputDomainVersion`; migration forward-only، وإصدار reader يستطيع قراءة مراجع قديمة دون تحويلها الصامت.
