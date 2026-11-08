import type {
  CActivity,
  CPrivateEvaluation,
  CPublicActivity,
  CRepresentation,
  CRepresentationSet,
  CRubricCriterion,
  CStage,
} from "../../../../packages/contracts/src/advanced-learning";
import type { SubjectCode } from "../../../../packages/contracts/src/product";
import type { LearningContentPayload } from "../../../../packages/contracts/src/learning-paths";
import { uuid } from "../contracts";
import { skillCodes } from "../learning-path-payload";
import { only, productInvalid, record, textField } from "../product-core";

export const C_ACTIVITY_SCHEMA = "c-activity-v1";
export const C_STAGES: CStage[] = [
  "frame",
  "plan",
  "investigate",
  "justify",
  "reflect",
];
export const C_REVIEW_SCOPES = [
  "subject",
  "pedagogy",
  "accessibility",
  "security",
] as const;

function safeText(value: unknown, max = 2000): string {
  const text = textField(value, max);
  if (/<\/?[a-z][^>]*>|javascript\s*:|data\s*:|https?:\/\//i.test(text))
    throw productInvalid(
      "استخدم نصًا تعليميًا دون HTML أو روابط تنفيذية أو خارجية.",
    );
  return text;
}
function code(value: unknown): string {
  const result = textField(value, 80);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(result)) throw productInvalid();
  return result;
}
function list<T>(
  value: unknown,
  max: number,
  parse: (value: unknown) => T,
  min = 0,
): T[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw productInvalid();
  return value.map(parse);
}
function unique(values: string[]): string[] {
  if (new Set(values).size !== values.length)
    throw productInvalid("لا تكرر الرموز أو المراجع.");
  return values;
}
function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw productInvalid();
  return value;
}
function index(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 49)
    throw productInvalid();
  return Number(value);
}
function sameSkills(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((skill) => right.includes(skill))
  );
}
export function parseRepresentation(
  value: unknown,
  subject: SubjectCode,
): CRepresentation {
  const b = record(value);
  only(b, [
    "code",
    "kind",
    "titleAr",
    "accessibleText",
    "learningObjective",
    "targetSkillCodes",
    "sameConstruct",
    "assistanceExposure",
    "evaluationMode",
    "textAr",
    "altText",
    "columns",
    "rows",
    "labBlockIndex",
    "codeText",
  ]);
  const kind = textField(b.kind, 20);
  if (
    !["text", "table", "diagram", "stem_lab", "code"].includes(kind) ||
    b.evaluationMode !== "learning_only"
  )
    throw productInvalid("التمثيل تعليمي فقط ومن الأنواع المدعومة.");
  const skills = skillCodes(b.targetSkillCodes, subject);
  if (!skills.length) throw productInvalid("حدد مهارة للتمثيل.");
  const result: CRepresentation = {
    code: code(b.code),
    kind: kind as CRepresentation["kind"],
    titleAr: safeText(b.titleAr, 160),
    accessibleText: safeText(b.accessibleText, 3000),
    learningObjective: safeText(b.learningObjective, 500),
    targetSkillCodes: skills,
    sameConstruct: flag(b.sameConstruct),
    assistanceExposure: flag(b.assistanceExposure),
    evaluationMode: "learning_only",
  };
  const fields: Record<CRepresentation["kind"], string[]> = {
    text: ["textAr"],
    table: ["columns", "rows"],
    diagram: ["altText"],
    stem_lab: ["labBlockIndex"],
    code: ["codeText"],
  };
  for (const property of [
    "textAr",
    "altText",
    "columns",
    "rows",
    "labBlockIndex",
    "codeText",
  ])
    if (!fields[result.kind].includes(property) && b[property] !== undefined)
      throw productInvalid();
  if (kind === "text") result.textAr = safeText(b.textAr, 5000);
  if (kind === "diagram") result.altText = safeText(b.altText, 3000);
  if (kind === "code") {
    if (subject !== "programming") throw productInvalid();
    result.codeText = textField(b.codeText, 6000);
  }
  if (kind === "stem_lab") result.labBlockIndex = index(b.labBlockIndex);
  if (kind === "table") {
    result.columns = list(b.columns, 8, (v) => safeText(v, 160), 1);
    result.rows = list(
      b.rows,
      40,
      (v) => list(v, 8, (cell) => safeText(cell, 200), 1),
      1,
    );
    if (result.rows.some((row) => row.length !== result.columns!.length))
      throw productInvalid("كل صف يحتاج خلية لكل عنوان.");
  }
  return result;
}
function variants(value: unknown, subject: SubjectCode): CRepresentation[] {
  const parsed = list(value, 8, (v) => parseRepresentation(v, subject), 1);
  unique(parsed.map((v) => v.code));
  if (!parsed.some((v) => v.kind === "text"))
    throw productInvalid("يلزم تمثيل نصي كامل بديل دائمًا.");
  return parsed;
}
export function parseRepresentationSet(
  value: unknown,
  subject: SubjectCode,
): CRepresentationSet {
  const b = record(value);
  only(b, [
    "schemaVersion",
    "learningObjective",
    "targetSkillCodes",
    "variants",
    "responseModes",
  ]);
  if (b.schemaVersion !== "udl-representation-v1") throw productInvalid();
  const targetSkillCodes = skillCodes(b.targetSkillCodes, subject);
  if (!targetSkillCodes.length) throw productInvalid();
  const learningObjective = safeText(b.learningObjective, 500);
  const parsed = variants(b.variants, subject);
  if (
    parsed.some(
      (v) =>
        v.learningObjective !== learningObjective ||
        !sameSkills(v.targetSkillCodes, targetSkillCodes),
    )
  )
    throw productInvalid("التمثيلات البديلة تشترك في الهدف والمهارات نفسها.");
  const responseModes = unique(
    list(b.responseModes, 4, (v) => textField(v, 20), 1),
  );
  if (
    responseModes.some(
      (v) => !["text", "choice", "equation", "code_text"].includes(v),
    ) ||
    (responseModes.includes("equation") && subject !== "algebra") ||
    (responseModes.includes("code_text") && subject !== "programming")
  )
    throw productInvalid();
  return {
    schemaVersion: "udl-representation-v1",
    learningObjective,
    targetSkillCodes,
    variants: parsed,
    responseModes: responseModes as CRepresentationSet["responseModes"],
  };
}
function rubric(value: unknown): CRubricCriterion[] {
  const result = list(
    value,
    10,
    (value): CRubricCriterion => {
      const c = record(value);
      only(c, ["code", "titleAr", "descriptionAr", "levels"]);
      const levels = list(
        c.levels,
        5,
        (value) => {
          const level = record(value);
          only(level, ["code", "labelAr", "descriptionAr"]);
          return {
            code: code(level.code),
            labelAr: safeText(level.labelAr, 160),
            descriptionAr: safeText(level.descriptionAr, 500),
          };
        },
        2,
      );
      unique(levels.map((l) => l.code));
      return {
        code: code(c.code),
        titleAr: safeText(c.titleAr, 160),
        descriptionAr: safeText(c.descriptionAr, 1000),
        levels,
      };
    },
    1,
  );
  unique(result.map((r) => r.code));
  return result;
}
function privateEvaluation(
  value: unknown,
  subject: SubjectCode,
  criteria: CRubricCriterion[],
): CPrivateEvaluation {
  const b = record(value);
  only(b, [
    "solutionKey",
    "privateRubric",
    "hints",
    "referenceCode",
    "hiddenTests",
  ]);
  const result: CPrivateEvaluation = {};
  if (b.solutionKey !== undefined)
    result.solutionKey = textField(b.solutionKey, 6000);
  if (b.privateRubric !== undefined) {
    result.privateRubric = list(b.privateRubric, 10, (value) => {
      const r = record(value);
      only(r, ["criterionCode", "noteAr"]);
      const criterionCode = code(r.criterionCode);
      if (!criteria.some((c) => c.code === criterionCode))
        throw productInvalid();
      return { criterionCode, noteAr: safeText(r.noteAr, 1000) };
    });
    unique(result.privateRubric.map((r) => r.criterionCode));
  }
  if (b.hints !== undefined) {
    result.hints = list(b.hints, 5, (value) => {
      const h = record(value);
      only(h, ["level", "textAr"]);
      if (!["H0", "H1", "H2", "H3", "H4"].includes(String(h.level)))
        throw productInvalid();
      return {
        level: h.level as "H0" | "H1" | "H2" | "H3" | "H4",
        textAr: safeText(h.textAr, 1600),
      };
    });
    unique(result.hints.map((h) => h.level));
  }
  if (b.referenceCode !== undefined || b.hiddenTests !== undefined) {
    if (subject !== "programming") throw productInvalid();
    if (b.referenceCode !== undefined)
      result.referenceCode = textField(b.referenceCode, 6000);
    if (b.hiddenTests !== undefined)
      result.hiddenTests = list(b.hiddenTests, 10, (value) => {
        const t = record(value);
        only(t, ["input", "expectedOutput"]);
        return {
          input: textField(t.input, 1000, 0),
          expectedOutput: textField(t.expectedOutput, 1000, 0),
        };
      });
  }
  return result;
}
export function parseCActivity(
  value: unknown,
  subject: SubjectCode,
): CActivity {
  const b = record(value);
  const commonKeys = [
    "schemaVersion",
    "type",
    "subject",
    "code",
    "titleAr",
    "objectives",
    "skillCodes",
    "prerequisiteSkillCodes",
    "publicBriefAr",
    "familyCode",
    "supportPolicy",
    "representations",
    "publicRubric",
    "privateEvaluation",
  ];
  if (b.schemaVersion !== C_ACTIVITY_SCHEMA || b.subject !== subject)
    throw productInvalid();
  const skills = skillCodes(b.skillCodes, subject);
  if (!skills.length) throw productInvalid();
  const support = record(b.supportPolicy);
  only(support, ["hintsAllowed", "revealMode"]);
  if (!["after_submit", "teacher_only"].includes(String(support.revealMode)))
    throw productInvalid();
  const publicRubric = rubric(b.publicRubric),
    representations = variants(b.representations, subject);
  if (
    representations.some((v) =>
      v.targetSkillCodes.some((s) => !skills.includes(s)),
    )
  )
    throw productInvalid("مهارات التمثيل يجب أن تغطيها مهارات النشاط.");
  const base = {
    schemaVersion: C_ACTIVITY_SCHEMA as "c-activity-v1",
    subject,
    code: code(b.code),
    titleAr: safeText(b.titleAr, 160),
    objectives: list(b.objectives, 8, (v) => safeText(v, 500), 1),
    skillCodes: skills,
    prerequisiteSkillCodes: skillCodes(b.prerequisiteSkillCodes, subject),
    publicBriefAr: safeText(b.publicBriefAr, 3000),
    familyCode: code(b.familyCode),
    supportPolicy: {
      hintsAllowed: flag(support.hintsAllowed),
      revealMode: support.revealMode as "after_submit" | "teacher_only",
    },
    representations,
    publicRubric,
    ...(b.privateEvaluation === undefined
      ? {}
      : {
          privateEvaluation: privateEvaluation(
            b.privateEvaluation,
            subject,
            publicRubric,
          ),
        }),
  };
  let result: CActivity;
  if (b.type === "problem_based") {
    only(b, [
      ...commonKeys,
      "scenarioAr",
      "constraints",
      "stages",
      "verification",
    ]);
    const stages = list(b.stages, 5, (v) => textField(v, 20), 5);
    if (stages.some((v, i) => v !== C_STAGES[i]))
      throw productInvalid("رتب مراحل الفهم والخطة والتحقق والتبرير والتأمل.");
    const v = record(b.verification);
    if (v.kind === "none") only(v, ["kind"]);
    else if (v.kind === "bank_problem") only(v, ["kind", "problemRevisionId"]);
    else if (v.kind === "stem_lab") only(v, ["kind", "blockIndex"]);
    else throw productInvalid();
    const verification =
      v.kind === "bank_problem"
        ? {
            kind: "bank_problem" as const,
            problemRevisionId: uuid(textField(v.problemRevisionId, 36)),
          }
        : v.kind === "stem_lab"
          ? { kind: "stem_lab" as const, blockIndex: index(v.blockIndex) }
          : { kind: "none" as const };
    result = {
      ...base,
      type: "problem_based",
      scenarioAr: safeText(b.scenarioAr, 5000),
      constraints: list(b.constraints, 10, (v) => safeText(v, 500)),
      stages: [...C_STAGES],
      verification,
    };
  } else if (b.type === "project_based") {
    only(b, [
      ...commonKeys,
      "projectLevel",
      "drivingQuestionAr",
      "milestones",
      "lessonRevisionIds",
    ]);
    if (!["micro", "multi_lesson"].includes(String(b.projectLevel)))
      throw productInvalid("المشاريع متعددة المواد تحتاج قرارًا مستقلاً.");
    const milestones = list(
      b.milestones,
      12,
      (value) => {
        const m = record(value);
        only(m, [
          "code",
          "titleAr",
          "descriptionAr",
          "requiredArtifactKind",
          "required",
        ]);
        if (!["text", "json"].includes(String(m.requiredArtifactKind)))
          throw productInvalid("المنتجات نص أو JSON فقط دون رفع ملفات.");
        return {
          code: code(m.code),
          titleAr: safeText(m.titleAr, 160),
          descriptionAr: safeText(m.descriptionAr, 1000),
          requiredArtifactKind: m.requiredArtifactKind as "text" | "json",
          required: flag(m.required),
        };
      },
      3,
    );
    unique(milestones.map((m) => m.code));
    if (!milestones.some((m) => m.required)) throw productInvalid();
    const lessonRevisionIds = unique(
      list(b.lessonRevisionIds, 20, (v) => uuid(textField(v, 36))),
    );
    if (
      (b.projectLevel === "micro" && lessonRevisionIds.length > 1) ||
      (b.projectLevel === "multi_lesson" && lessonRevisionIds.length < 2)
    )
      throw productInvalid();
    result = {
      ...base,
      type: "project_based",
      projectLevel: b.projectLevel as "micro" | "multi_lesson",
      drivingQuestionAr: safeText(b.drivingQuestionAr, 2000),
      milestones,
      lessonRevisionIds,
    };
  } else throw productInvalid();
  if (Buffer.byteLength(JSON.stringify(result)) > 32768)
    throw productInvalid("قلل حجم النشاط إلى ٣٢ كيلوبايت.");
  return result;
}
/** Author-side solution material is never copied to learner content or analytics. */
export function publicCActivity(value: CActivity): CPublicActivity {
  const { privateEvaluation: hidden, ...visible } = value;
  void hidden;
  return structuredClone(visible);
}
export function containsAdvancedContent(
  payload: LearningContentPayload,
): boolean {
  return (
    payload.kind === "lesson" &&
    payload.contentBlocks.some((b) =>
      ["problem_activity", "project_activity", "representation_set"].includes(
        b.type,
      ),
    )
  );
}
