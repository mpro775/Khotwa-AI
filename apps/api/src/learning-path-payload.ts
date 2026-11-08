import type {
  LearningContentPayload,
  LessonBlock,
  LessonPayload,
} from "../../../packages/contracts/src/learning-paths";
import type { SubjectCode } from "../../../packages/contracts/src/product";
import { parsePayload } from "./content-payload";
import { uuid } from "./contracts";
import { only, productInvalid, record, textField } from "./product-core";
import { parseLabBlock } from "./stem/lab-registry";
import {
  parseCActivity,
  parseRepresentationSet,
} from "./advanced-learning/activity-payload";

export const LEARNING_MAP_VERSION = "learning-path-map-1.0";
export const ALGEBRA_ERROR_SKILLS: Record<string, string[]> = {
  "ERR-ALG-01": ["SK-ALG-04"],
  "ERR-ALG-02": ["SK-ALG-02", "SK-ALG-05"],
  "ERR-ALG-03": ["SK-ALG-01", "SK-ALG-05"],
  "ERR-ALG-04": ["SK-ALG-05", "SK-ALG-06"],
  "ERR-ALG-05": ["SK-ALG-02", "SK-ALG-03"],
  "ERR-ALG-06": ["SK-ALG-02", "SK-ALG-04"],
};
export const ALGEBRA_SKILLS = [
  ["SK-ALG-01", "معنى المساواة وطرفا المعادلة"],
  ["SK-ALG-02", "الأعداد الصحيحة والإشارات"],
  ["SK-ALG-03", "جمع الحدود المتشابهة والتبسيط"],
  ["SK-ALG-04", "خاصية التوزيع ومعامل القوس"],
  ["SK-ALG-05", "التحويل المتكافئ بالجمع والطرح"],
  ["SK-ALG-06", "التحويل المتكافئ بالضرب والقسمة على ثابت"],
  ["SK-ALG-07", "حل معادلة متعددة الخطوات والتحقق"],
] as const;
export const PENDING_MAPPINGS = [
  "GOLD-DIAG-015",
  "ERR-ALG-05/calculation_divide ↔ SK-ALG-06",
];
const PHY_SKILLS = [
  "PHYS-ACCELERATION",
  "PHYS-AVERAGE_SPEED",
  "PHYS-CONSTANT_MOTION",
  "PHYS-DISPLACEMENT",
  "PHYS-DISTANCE_DISPLACEMENT",
  "PHYS-FINAL_VELOCITY",
];
const PY_SKILLS = [
  "PY-PRINT",
  "PY-VARIABLES",
  "PY-ARITHMETIC",
  "PY-CONDITIONS",
  "PY-LOOPS",
  "PY-FUNCTIONS",
];
export function learningSubject(value: unknown): SubjectCode {
  if (!["algebra", "physics", "programming"].includes(String(value)))
    throw productInvalid("المادة غير مدعومة.");
  return value as SubjectCode;
}
function strings(
  value: unknown,
  max: number,
  parse: (v: unknown) => string,
  min = 0,
): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw productInvalid();
  const result = value.map(parse);
  if (new Set(result).size !== result.length)
    throw productInvalid("لا تكرر المراجع أو الرموز.");
  return result;
}
function code(value: unknown): string {
  const v = textField(value, 80);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(v))
    throw productInvalid("رمز المحتوى غير صالح.");
  return v;
}
export function skillCodes(value: unknown, subject: SubjectCode): string[] {
  const codes = strings(value, 8, code);
  const legal: readonly string[] =
    subject === "algebra"
      ? ALGEBRA_SKILLS.map(([c]) => c)
      : subject === "physics"
        ? PHY_SKILLS
        : PY_SKILLS;
  if (codes.some((c) => !legal.includes(c)))
    throw productInvalid(
      "اختر مهارة قانونية مدعومة؛ الكسور SK-ALG-08 غير مفعلة.",
    );
  return codes;
}
function block(value: unknown, subject: SubjectCode): LessonBlock {
  const b = record(value);
  only(b, [
    "type",
    "textAr",
    "raw",
    "steps",
    "code",
    "physics",
    "problemRevisionId",
    "lab",
    "activity",
    "representation",
  ]);
  const type = textField(b.type, 30) as LessonBlock["type"];
  if (
    ![
      "paragraph",
      "heading",
      "math_example",
      "worked_steps",
      "key_point",
      "common_mistake",
      "practice_link",
      "code_example",
      "physics_example",
      "completion_step",
      "worked_example_ref",
      "self_check_prompt",
      "subject_lab_activity",
      "problem_activity",
      "project_activity",
      "representation_set",
    ].includes(type)
  )
    throw productInvalid();
  const result: LessonBlock = { type, textAr: textField(b.textAr, 3000) };
  if (type === "subject_lab_activity")
    result.lab = parseLabBlock(b.lab, subject);
  else if (b.lab !== undefined) throw productInvalid();
  if (type === "problem_activity" || type === "project_activity") {
    result.activity = parseCActivity(b.activity, subject);
    if (
      result.activity.type !==
      (type === "problem_activity" ? "problem_based" : "project_based")
    )
      throw productInvalid();
  } else if (b.activity !== undefined) throw productInvalid();
  if (type === "representation_set")
    result.representation = parseRepresentationSet(b.representation, subject);
  else if (b.representation !== undefined) throw productInvalid();
  if (["math_example", "worked_steps", "completion_step"].includes(type)) {
    if (subject !== "algebra")
      throw productInvalid("المثال الجبري لا ينتمي لهذه المادة.");
    result.raw = textField(b.raw, 256);
    if (/[/÷⁄]/.test(result.raw))
      throw productInvalid("الكسور غير متاحة للنشر.");
    if (!Array.isArray(b.steps) || b.steps.length < 1 || b.steps.length > 12)
      throw productInvalid("أضف خطوات المثال.");
    result.steps = b.steps.map((v) => {
      const s = record(v);
      only(s, ["raw", "explanationAr"]);
      const raw = textField(s.raw, 256);
      if (/[/÷⁄]/.test(raw)) throw productInvalid("الكسور غير متاحة للنشر.");
      return { raw, explanationAr: textField(s.explanationAr, 1200) };
    });
  } else if (b.raw !== undefined || b.steps !== undefined)
    throw productInvalid();
  if (type === "code_example") {
    if (subject !== "programming") throw productInvalid();
    result.code = textField(b.code, 6000);
  } else if (b.code !== undefined) throw productInvalid();
  if (type === "physics_example") {
    if (subject !== "physics") throw productInvalid();
    // Reuse the established strict physics reference validator.
    result.physics = parsePayload({
      titleAr: "مثال",
      statementAr: "مثال",
      subject: "physics",
      unitCode: "kinematics",
      unitTitleAr: "الحركة",
      lessonCode: "example",
      lessonTitleAr: "مثال",
      skillCodes: ["PHYS-CONSTANT_MOTION"],
      difficulty: 1,
      kind: "main",
      familyCode: "example",
      hints: [],
      physics: b.physics,
    }).physics;
  } else if (b.physics !== undefined) throw productInvalid();
  if (type === "practice_link" || type === "worked_example_ref")
    result.problemRevisionId = uuid(textField(b.problemRevisionId, 36));
  else if (b.problemRevisionId !== undefined) throw productInvalid();
  return result;
}
export function parseLearningPayload(value: unknown): LearningContentPayload {
  const p = record(value),
    subject = learningSubject(p.subject);
  const base = {
    subject,
    code: code(p.code),
    titleAr: textField(p.titleAr, 160),
    descriptionAr: textField(p.descriptionAr, 2000),
  };
  if (p.kind === "track") {
    only(p, ["kind", "subject", "code", "titleAr", "descriptionAr", "units"]);
    if (!Array.isArray(p.units) || p.units.length < 1 || p.units.length > 20)
      throw productInvalid();
    const units = p.units.map((v) => {
      const u = record(v);
      only(u, ["code", "titleAr", "lessonRevisionIds"]);
      return {
        code: code(u.code),
        titleAr: textField(u.titleAr, 160),
        lessonRevisionIds: strings(u.lessonRevisionIds, 60, (v) =>
          uuid(textField(v, 36)),
        ),
      };
    });
    if (new Set(units.map((u) => u.code)).size !== units.length)
      throw productInvalid();
    return { kind: "track", ...base, units };
  }
  if (p.kind !== "lesson") throw productInvalid();
  only(p, [
    "kind",
    "subject",
    "code",
    "titleAr",
    "descriptionAr",
    "objectives",
    "skillCodes",
    "prerequisiteSkillCodes",
    "prerequisiteLessonIds",
    "contentBlocks",
    "practiceProblemRevisionIds",
    "assessmentProblemRevisionIds",
    "errorCodes",
    "mappingPending",
  ]);
  if (
    !Array.isArray(p.contentBlocks) ||
    p.contentBlocks.length < 1 ||
    p.contentBlocks.length > 50
  )
    throw productInvalid();
  const skills = skillCodes(p.skillCodes, subject);
  if (!skills.length) throw productInvalid("يلزم تحديد مهارة أساسية.");
  const errorCodes = strings(p.errorCodes, 6, code);
  if (
    errorCodes.some(
      (e) =>
        subject !== "algebra" ||
        !ALGEBRA_ERROR_SKILLS[e] ||
        !ALGEBRA_ERROR_SKILLS[e]!.some((s) => skills.includes(s)),
    )
  )
    throw productInvalid("نمط الخطأ غير قانوني أو لا يطابق مهارة الدرس.");
  const result: LessonPayload = {
    kind: "lesson",
    ...base,
    objectives: strings(p.objectives, 12, (v) => textField(v, 500), 1),
    skillCodes: skills,
    prerequisiteSkillCodes: skillCodes(p.prerequisiteSkillCodes, subject),
    prerequisiteLessonIds: strings(p.prerequisiteLessonIds, 20, (v) =>
      uuid(textField(v, 36)),
    ),
    contentBlocks: p.contentBlocks.map((v) => block(v, subject)),
    practiceProblemRevisionIds: strings(p.practiceProblemRevisionIds, 20, (v) =>
      uuid(textField(v, 36)),
    ),
    assessmentProblemRevisionIds: strings(
      p.assessmentProblemRevisionIds,
      20,
      (v) => uuid(textField(v, 36)),
    ),
    errorCodes,
    mappingPending: strings(p.mappingPending, 12, (v) => textField(v, 200)),
  };
  if (
    result.contentBlocks.some((b) =>
      b.lab?.skillCodes.some((s) => !skills.includes(s)),
    )
  )
    throw productInvalid("مهارات المختبر يجب أن تنتمي إلى مهارات الدرس.");
  if (
    result.contentBlocks.some((b) =>
      [
        ...(b.activity?.skillCodes ?? []),
        ...(b.representation?.targetSkillCodes ?? []),
      ].some((s) => !skills.includes(s)),
    )
  )
    throw productInvalid(
      "مهارات النشاط والتمثيل يجب أن تنتمي إلى مهارات الدرس.",
    );
  for (const b of result.contentBlocks) {
    const labRefs = [
      ...(b.activity?.representations ?? []),
      ...(b.representation?.variants ?? []),
    ].flatMap((v) => (v.kind === "stem_lab" ? [v.labBlockIndex!] : []));
    if (
      b.activity?.type === "problem_based" &&
      b.activity.verification.kind === "stem_lab"
    )
      labRefs.push(b.activity.verification.blockIndex);
    if (
      labRefs.some(
        (i) => result.contentBlocks[i]?.type !== "subject_lab_activity",
      )
    )
      throw productInvalid("مرجع التمثيل يشير إلى مختبر قانوني في الدرس نفسه.");
  }
  if (
    result.practiceProblemRevisionIds.some((id) =>
      result.assessmentProblemRevisionIds.includes(id),
    )
  )
    throw productInvalid("يجب فصل أسئلة التدريب عن القياس المستقل.");
  return result;
}
