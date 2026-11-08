import type {
  CActivity,
  CRepresentation,
  CRepresentationSet,
  CRubricCriterion,
} from "../../../../packages/contracts/src/advanced-learning";
import type { Subject } from "../product-api";

const lines = (value: string) =>
  value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
function Text({
  label,
  value,
  onChange,
  code = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  code?: boolean;
}) {
  return (
    <label>
      {label}
      <textarea
        value={value}
        dir={code ? "ltr" : "rtl"}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function newRepresentation(
  skills: string[],
  kind: CRepresentation["kind"] = "text",
): CRepresentation {
  return {
    code: "R-" + crypto.randomUUID().slice(0, 8),
    kind,
    titleAr: "تمثيل نصي",
    accessibleText: "",
    learningObjective: "",
    targetSkillCodes: skills,
    sameConstruct: true,
    assistanceExposure: false,
    evaluationMode: "learning_only",
    ...(kind === "text"
      ? { textAr: "" }
      : kind === "table"
        ? { columns: ["القيمة", "التفسير"], rows: [["", ""]] }
        : kind === "diagram"
          ? { altText: "" }
          : kind === "code"
            ? { codeText: "" }
            : { labBlockIndex: 0 }),
  };
}
export function newRepresentationSet(skills: string[]): CRepresentationSet {
  return {
    schemaVersion: "udl-representation-v1",
    learningObjective: "",
    targetSkillCodes: skills,
    variants: [newRepresentation(skills)],
    responseModes: ["text"],
  };
}
const criterion = (): CRubricCriterion => ({
  code: "criterion-" + crypto.randomUUID().slice(0, 8),
  titleAr: "",
  descriptionAr: "",
  levels: [
    { code: "needs_support", labelAr: "يحتاج دعمًا", descriptionAr: "" },
    { code: "partial", labelAr: "جزئي", descriptionAr: "" },
    { code: "met", labelAr: "متحقق", descriptionAr: "" },
  ],
});
export function newActivity(
  subject: Subject,
  skills: string[],
  type: CActivity["type"],
): CActivity {
  const common = {
    schemaVersion: "c-activity-v1" as const,
    subject,
    code: "C-" + crypto.randomUUID().slice(0, 8),
    titleAr: "",
    objectives: [""],
    skillCodes: skills,
    prerequisiteSkillCodes: [],
    publicBriefAr: "",
    familyCode: "C-FAMILY-" + crypto.randomUUID().slice(0, 8),
    supportPolicy: { hintsAllowed: true, revealMode: "teacher_only" as const },
    representations: [newRepresentation(skills)],
    publicRubric: [criterion()],
    privateEvaluation: {},
  };
  return type === "problem_based"
    ? {
        ...common,
        type,
        scenarioAr: "",
        constraints: [],
        stages: ["frame", "plan", "investigate", "justify", "reflect"],
        verification: { kind: "none" },
      }
    : {
        ...common,
        type,
        projectLevel: "micro",
        drivingQuestionAr: "",
        milestones: ["plan", "build", "review"].map((code) => ({
          code,
          titleAr: "",
          descriptionAr: "",
          requiredArtifactKind: "text" as const,
          required: true,
        })),
        lessonRevisionIds: [],
      };
}
export function RepresentationAuthoring({
  value,
  subject,
  skills,
  onChange,
}: {
  value: CRepresentation[];
  subject: Subject;
  skills: string[];
  onChange: (next: CRepresentation[]) => void;
}) {
  const update = (i: number, representation: CRepresentation) =>
    onChange(value.map((item, index) => (index === i ? representation : item)));
  return (
    <fieldset className="advanced-learning">
      <legend>التمثيلات وبدائل الوصول</legend>
      <p>
        النص البديل مطلوب دائمًا. اختيارات التمثيل لا تحدد أسلوب تعلم أو إعاقة.
        تثبت مراجعة الوصول تكافؤ الهدف قبل النشر.
      </p>
      {value.map((r, i) => (
        <fieldset key={i}>
          <legend>تمثيل {(i + 1).toLocaleString("ar")}</legend>
          <Text
            label="رمز التمثيل"
            code
            value={r.code}
            onChange={(code) => update(i, { ...r, code })}
          />
          <label>
            نوع العرض
            <select
              value={r.kind}
              onChange={(event) =>
                update(i, {
                  ...newRepresentation(
                    r.targetSkillCodes,
                    event.target.value as CRepresentation["kind"],
                  ),
                  code: r.code,
                  titleAr: r.titleAr,
                  accessibleText: r.accessibleText,
                  learningObjective: r.learningObjective,
                })
              }
            >
              {(
                [
                  "text",
                  "table",
                  "diagram",
                  "stem_lab",
                  ...(subject === "programming" ? ["code"] : []),
                ] as CRepresentation["kind"][]
              ).map((kind) => (
                <option key={kind} value={kind}>
                  {
                    {
                      text: "نص",
                      table: "جدول",
                      diagram: "وصف رسم",
                      stem_lab: "مختبر مرتبط",
                      code: "كود نصي",
                    }[kind]
                  }
                </option>
              ))}
            </select>
          </label>
          <Text
            label="اسم العرض"
            value={r.titleAr}
            onChange={(titleAr) => update(i, { ...r, titleAr })}
          />
          <Text
            label="وصف نصي كامل قابل للقراءة عند تعذر الرسم أو المختبر"
            value={r.accessibleText}
            onChange={(accessibleText) => update(i, { ...r, accessibleText })}
          />
          <Text
            label="الهدف التعليمي لهذا التمثيل"
            value={r.learningObjective}
            onChange={(learningObjective) =>
              update(i, { ...r, learningObjective })
            }
          />
          <Text
            label="المهارات المستهدفة — رمز في كل سطر"
            code
            value={r.targetSkillCodes.join("\n")}
            onChange={(text) =>
              update(i, { ...r, targetSkillCodes: lines(text) })
            }
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={r.sameConstruct}
              onChange={(event) =>
                update(i, { ...r, sameConstruct: event.target.checked })
              }
            />
            يقصد الحفاظ على الكفاية نفسها — يحتاج مراجعة
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={r.assistanceExposure}
              onChange={(event) =>
                update(i, { ...r, assistanceExposure: event.target.checked })
              }
            />
            يكشف دعمًا أو مثالًا يساعد في الحل
          </label>
          {r.kind === "text" && (
            <Text
              label="النص المعروض"
              value={r.textAr ?? ""}
              onChange={(textAr) => update(i, { ...r, textAr })}
            />
          )}
          {r.kind === "diagram" && (
            <Text
              label="وصف الرسم ومحاوره واتجاه التغير — لا رفع صورة"
              value={r.altText ?? ""}
              onChange={(altText) => update(i, { ...r, altText })}
            />
          )}
          {r.kind === "code" && (
            <Text
              label="كود للتتبع، دون تنفيذ"
              code
              value={r.codeText ?? ""}
              onChange={(codeText) => update(i, { ...r, codeText })}
            />
          )}
          {r.kind === "stem_lab" && (
            <label>
              ترتيب فقرة المختبر في الدرس (يبدأ من صفر)
              <input
                type="number"
                min={0}
                max={49}
                value={r.labBlockIndex ?? 0}
                onChange={(event) =>
                  update(i, { ...r, labBlockIndex: Number(event.target.value) })
                }
              />
            </label>
          )}
          {r.kind === "table" && (
            <>
              <Text
                label="عناوين الأعمدة — عنوان في كل سطر"
                value={(r.columns ?? []).join("\n")}
                onChange={(text) =>
                  update(i, { ...r, columns: text.split("\n") })
                }
              />
              <Text
                label="صفوف الجدول — صف في كل سطر، والخلايا مفصولة بعلامة |"
                value={(r.rows ?? []).map((row) => row.join(" | ")).join("\n")}
                onChange={(text) =>
                  update(i, {
                    ...r,
                    rows: text
                      .split("\n")
                      .map((row) => row.split("|").map((cell) => cell.trim())),
                  })
                }
              />
            </>
          )}
          <button
            type="button"
            onClick={() => onChange(value.filter((_, index) => index !== i))}
          >
            أزل هذا التمثيل
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, newRepresentation(skills)])}
      >
        أضف تمثيلًا نصيًا
      </button>
    </fieldset>
  );
}
export function RepresentationSetAuthoring({
  value,
  subject,
  skills,
  onChange,
}: {
  value: CRepresentationSet;
  subject: Subject;
  skills: string[];
  onChange: (next: CRepresentationSet) => void;
}) {
  return (
    <div className="c-workspace">
      <Text
        label="هدف مجموعة التمثيلات"
        value={value.learningObjective}
        onChange={(learningObjective) =>
          onChange({ ...value, learningObjective })
        }
      />
      <Text
        label="مهارات المجموعة — رمز في كل سطر"
        code
        value={value.targetSkillCodes.join("\n")}
        onChange={(text) =>
          onChange({ ...value, targetSkillCodes: lines(text) })
        }
      />
      <RepresentationAuthoring
        value={value.variants}
        subject={subject}
        skills={skills}
        onChange={(variants) => onChange({ ...value, variants })}
      />
      <fieldset>
        <legend>طرق التعبير المتاحة للتعلّم</legend>
        {(["text", "choice", "equation", "code_text"] as const).map((mode) => (
          <label key={mode} className="check-row">
            <input
              type="checkbox"
              checked={value.responseModes.includes(mode)}
              disabled={
                (mode === "equation" && subject !== "algebra") ||
                (mode === "code_text" && subject !== "programming")
              }
              onChange={() =>
                onChange({
                  ...value,
                  responseModes: value.responseModes.includes(mode)
                    ? value.responseModes.filter((m) => m !== mode)
                    : [...value.responseModes, mode],
                })
              }
            />
            {
              {
                text: "تفسير مكتوب",
                choice: "اختيار",
                equation: "معادلة",
                code_text: "نص كود",
              }[mode]
            }
          </label>
        ))}
      </fieldset>
    </div>
  );
}
export function CActivityAuthoring({
  value: a,
  onChange,
  skills,
}: {
  value: CActivity;
  onChange: (next: CActivity) => void;
  skills: string[];
}) {
  return (
    <div className="advanced-learning c-workspace">
      <p>
        نشاط بإصدار داخل استوديو الدروس نفسه. مسودة اصطناعية تحتاج مراجعة المادة
        والتربية والوصول والأمن؛ لا تمنح الحقول وحدها اعتمادًا.
      </p>
      <Text
        label="رمز النشاط"
        code
        value={a.code}
        onChange={(code) => onChange({ ...a, code })}
      />
      <Text
        label="عنوان النشاط"
        value={a.titleAr}
        onChange={(titleAr) => onChange({ ...a, titleAr })}
      />
      <Text
        label="أهداف التعلم — هدف في كل سطر"
        value={a.objectives.join("\n")}
        onChange={(text) => onChange({ ...a, objectives: text.split("\n") })}
      />
      <Text
        label="المهارات — رمز في كل سطر"
        code
        value={a.skillCodes.join("\n")}
        onChange={(text) => onChange({ ...a, skillCodes: lines(text) })}
      />
      <Text
        label="المهارات السابقة — رمز في كل سطر"
        code
        value={a.prerequisiteSkillCodes.join("\n")}
        onChange={(text) =>
          onChange({ ...a, prerequisiteSkillCodes: lines(text) })
        }
      />
      <Text
        label="موجز الطالب ومتطلبات النجاح العامة"
        value={a.publicBriefAr}
        onChange={(publicBriefAr) => onChange({ ...a, publicBriefAr })}
      />
      <Text
        label="رمز عائلة التعرض"
        code
        value={a.familyCode}
        onChange={(familyCode) => onChange({ ...a, familyCode })}
      />
      {a.type === "problem_based" ? (
        <>
          <Text
            label="الموقف والسؤال الواقعي — دون تلقين القانون"
            value={a.scenarioAr}
            onChange={(scenarioAr) => onChange({ ...a, scenarioAr })}
          />
          <Text
            label="القيود والمعطيات والوحدات — بند في كل سطر"
            value={a.constraints.join("\n")}
            onChange={(text) => onChange({ ...a, constraints: lines(text) })}
          />
          <label>
            مصدر التغذية الراجعة
            <select
              value={a.verification.kind}
              onChange={(event) =>
                onChange({
                  ...a,
                  verification:
                    event.target.value === "none"
                      ? { kind: "none" }
                      : event.target.value === "bank_problem"
                        ? { kind: "bank_problem", problemRevisionId: "" }
                        : { kind: "stem_lab", blockIndex: 0 },
                })
              }
            >
              <option value="none">مراجعة بشرية؛ لا حكم آلي</option>
              <option value="bank_problem">سؤال منشور من بنك المادة</option>
              <option value="stem_lab">مختبر منشور في هذا الدرس</option>
            </select>
          </label>
          {a.verification.kind === "bank_problem" && (
            <Text
              label="مرجع إصدار السؤال المنشور"
              code
              value={a.verification.problemRevisionId}
              onChange={(problemRevisionId) =>
                onChange({
                  ...a,
                  verification: { kind: "bank_problem", problemRevisionId },
                })
              }
            />
          )}
          {a.verification.kind === "stem_lab" && (
            <label>
              ترتيب فقرة المختبر (يبدأ من صفر)
              <input
                type="number"
                min={0}
                max={49}
                value={a.verification.blockIndex}
                onChange={(event) =>
                  onChange({
                    ...a,
                    verification: {
                      kind: "stem_lab",
                      blockIndex: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
          )}
        </>
      ) : (
        <>
          <Text
            label="السؤال المحفز للمشروع"
            value={a.drivingQuestionAr}
            onChange={(drivingQuestionAr) =>
              onChange({ ...a, drivingQuestionAr })
            }
          />
          <label>
            مدى المشروع
            <select
              value={a.projectLevel}
              onChange={(event) =>
                onChange({
                  ...a,
                  projectLevel:
                    event.target.value === "micro" ? "micro" : "multi_lesson",
                })
              }
            >
              <option value="micro">مشروع مصغّر</option>
              <option value="multi_lesson">عبر دروس المادة</option>
            </select>
          </label>
          <Text
            label="مراجع إصدارات الدروس المرتبطة — مرجع في كل سطر"
            code
            value={a.lessonRevisionIds.join("\n")}
            onChange={(text) =>
              onChange({ ...a, lessonRevisionIds: lines(text) })
            }
          />
          <fieldset>
            <legend>مراحل المشروع والمنتج</legend>
            {a.milestones.map((m, i) => (
              <fieldset key={i}>
                <legend>مرحلة {(i + 1).toLocaleString("ar")}</legend>
                {(["code", "titleAr", "descriptionAr"] as const).map(
                  (field) => (
                    <Text
                      key={field}
                      label={
                        {
                          code: "رمز المرحلة",
                          titleAr: "اسم المرحلة",
                          descriptionAr: "المطلوب والخيارات المتاحة للطالب",
                        }[field]
                      }
                      code={field === "code"}
                      value={m[field]}
                      onChange={(text) =>
                        onChange({
                          ...a,
                          milestones: a.milestones.map((item, index) =>
                            index === i ? { ...m, [field]: text } : item,
                          ),
                        })
                      }
                    />
                  ),
                )}
                <label>
                  نوع المنتج
                  <select
                    value={m.requiredArtifactKind}
                    onChange={(event) =>
                      onChange({
                        ...a,
                        milestones: a.milestones.map((item, index) =>
                          index === i
                            ? {
                                ...m,
                                requiredArtifactKind:
                                  event.target.value === "text"
                                    ? "text"
                                    : "json",
                              }
                            : item,
                        ),
                      })
                    }
                  >
                    <option value="text">نص صغير</option>
                    <option value="json">JSON منظم</option>
                  </select>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={m.required}
                    onChange={(event) =>
                      onChange({
                        ...a,
                        milestones: a.milestones.map((item, index) =>
                          index === i
                            ? { ...m, required: event.target.checked }
                            : item,
                        ),
                      })
                    }
                  />
                  مرحلة مطلوبة
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...a,
                      milestones: a.milestones.filter(
                        (_, index) => index !== i,
                      ),
                    })
                  }
                >
                  أزل المرحلة
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...a,
                  milestones: [
                    ...a.milestones,
                    {
                      code: "stage-" + crypto.randomUUID().slice(0, 8),
                      titleAr: "",
                      descriptionAr: "",
                      requiredArtifactKind: "text",
                      required: true,
                    },
                  ],
                })
              }
            >
              أضف مرحلة
            </button>
          </fieldset>
        </>
      )}
      <fieldset>
        <legend>معايير الطالب العامة</legend>
        {a.publicRubric.map((c, i) => (
          <fieldset key={i}>
            <legend>معيار {(i + 1).toLocaleString("ar")}</legend>
            {(["code", "titleAr", "descriptionAr"] as const).map((field) => (
              <Text
                key={field}
                label={
                  {
                    code: "رمز المعيار",
                    titleAr: "اسم المعيار",
                    descriptionAr: "وصف المعيار",
                  }[field]
                }
                value={c[field]}
                onChange={(text) =>
                  onChange({
                    ...a,
                    publicRubric: a.publicRubric.map((item, index) =>
                      index === i ? { ...c, [field]: text } : item,
                    ),
                    ...(field === "code" && a.privateEvaluation?.privateRubric
                      ? {
                          privateEvaluation: {
                            ...a.privateEvaluation,
                            privateRubric:
                              a.privateEvaluation.privateRubric.map((item) =>
                                item.criterionCode === c.code
                                  ? { ...item, criterionCode: text }
                                  : item,
                              ),
                          },
                        }
                      : {}),
                  })
                }
              />
            ))}
            {c.levels.map((level, j) => (
              <Text
                key={j}
                label={`وصف مستوى ${level.labelAr}`}
                value={level.descriptionAr}
                onChange={(descriptionAr) =>
                  onChange({
                    ...a,
                    publicRubric: a.publicRubric.map((item, index) =>
                      index === i
                        ? {
                            ...c,
                            levels: c.levels.map((entry, levelIndex) =>
                              levelIndex === j
                                ? { ...level, descriptionAr }
                                : entry,
                            ),
                          }
                        : item,
                    ),
                  })
                }
              />
            ))}
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...a,
                  publicRubric: a.publicRubric.filter(
                    (_, index) => index !== i,
                  ),
                  ...(a.privateEvaluation?.privateRubric
                    ? {
                        privateEvaluation: {
                          ...a.privateEvaluation,
                          privateRubric:
                            a.privateEvaluation.privateRubric.filter(
                              (item) => item.criterionCode !== c.code,
                            ),
                        },
                      }
                    : {}),
                })
              }
            >
              أزل المعيار
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({ ...a, publicRubric: [...a.publicRubric, criterion()] })
          }
        >
          أضف معيارًا
        </button>
      </fieldset>
      <RepresentationAuthoring
        value={a.representations}
        subject={a.subject}
        skills={skills}
        onChange={(representations) => onChange({ ...a, representations })}
      />
      <details>
        <summary>حقول المراجع الخاصة — لا تظهر للطالب أو في المعاينة</summary>
        <Text
          label="مفتاح مراجعة الحل"
          value={a.privateEvaluation?.solutionKey ?? ""}
          onChange={(solutionKey) => {
            const next = { ...a.privateEvaluation };
            if (solutionKey.trim()) next.solutionKey = solutionKey;
            else delete next.solutionKey;
            onChange({ ...a, privateEvaluation: next });
          }}
        />
        {a.publicRubric.map((criterion) => (
          <Text
            key={criterion.code}
            label={`ملاحظة خاصة للمراجع: ${criterion.titleAr || criterion.code}`}
            value={
              a.privateEvaluation?.privateRubric?.find(
                (item) => item.criterionCode === criterion.code,
              )?.noteAr ?? ""
            }
            onChange={(noteAr) =>
              onChange({
                ...a,
                privateEvaluation: {
                  ...a.privateEvaluation,
                  privateRubric: [
                    ...(a.privateEvaluation?.privateRubric ?? []).filter(
                      (item) => item.criterionCode !== criterion.code,
                    ),
                    ...(noteAr.trim()
                      ? [{ criterionCode: criterion.code, noteAr }]
                      : []),
                  ],
                },
              })
            }
          />
        ))}
        {a.subject === "programming" && (
          <>
            <Text
              label="كود مرجعي خاص للمراجع — دون تنفيذ"
              code
              value={a.privateEvaluation?.referenceCode ?? ""}
              onChange={(referenceCode) => {
                const next = { ...a.privateEvaluation };
                if (referenceCode.trim()) next.referenceCode = referenceCode;
                else delete next.referenceCode;
                onChange({ ...a, privateEvaluation: next });
              }}
            />
            <fieldset>
              <legend>حالات مرجعية خاصة — لا تظهر للطالب</legend>
              {(a.privateEvaluation?.hiddenTests ?? []).map((test, index) => (
                <fieldset key={index}>
                  <legend>حالة {(index + 1).toLocaleString("ar")}</legend>
                  <Text
                    label="مدخل الحالة"
                    code
                    value={test.input}
                    onChange={(input) =>
                      onChange({
                        ...a,
                        privateEvaluation: {
                          ...a.privateEvaluation,
                          hiddenTests: (
                            a.privateEvaluation?.hiddenTests ?? []
                          ).map((item, i) =>
                            i === index ? { ...test, input } : item,
                          ),
                        },
                      })
                    }
                  />
                  <Text
                    label="ناتج مرجعي للمراجعة"
                    code
                    value={test.expectedOutput}
                    onChange={(expectedOutput) =>
                      onChange({
                        ...a,
                        privateEvaluation: {
                          ...a.privateEvaluation,
                          hiddenTests: (
                            a.privateEvaluation?.hiddenTests ?? []
                          ).map((item, i) =>
                            i === index ? { ...test, expectedOutput } : item,
                          ),
                        },
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...a,
                        privateEvaluation: {
                          ...a.privateEvaluation,
                          hiddenTests: (
                            a.privateEvaluation?.hiddenTests ?? []
                          ).filter((_, i) => i !== index),
                        },
                      })
                    }
                  >
                    أزل الحالة
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...a,
                    privateEvaluation: {
                      ...a.privateEvaluation,
                      hiddenTests: [
                        ...(a.privateEvaluation?.hiddenTests ?? []),
                        { input: "", expectedOutput: "" },
                      ],
                    },
                  })
                }
              >
                أضف حالة مرجعية
              </button>
            </fieldset>
          </>
        )}
        <label className="check-row">
          <input
            type="checkbox"
            checked={a.supportPolicy.hintsAllowed}
            onChange={(event) =>
              onChange({
                ...a,
                supportPolicy: {
                  ...a.supportPolicy,
                  hintsAllowed: event.target.checked,
                },
              })
            }
          />
          السماح بتلميحات تعليمية
        </label>
        <label>
          الكشف المقصود
          <select
            value={a.supportPolicy.revealMode}
            onChange={(event) =>
              onChange({
                ...a,
                supportPolicy: {
                  ...a.supportPolicy,
                  revealMode:
                    event.target.value === "teacher_only"
                      ? "teacher_only"
                      : "after_submit",
                },
              })
            }
          >
            <option value="teacher_only">للمراجع فقط</option>
            <option value="after_submit">بعد إرسال نتيجة وبطلب صريح</option>
          </select>
        </label>
        {(["H0", "H1", "H2", "H3", "H4"] as const).map((level) => (
          <Text
            key={level}
            label={`نص دعم ${level}`}
            value={
              a.privateEvaluation?.hints?.find((hint) => hint.level === level)
                ?.textAr ?? ""
            }
            onChange={(textAr) =>
              onChange({
                ...a,
                privateEvaluation: {
                  ...a.privateEvaluation,
                  hints: [
                    ...(a.privateEvaluation?.hints ?? []).filter(
                      (hint) => hint.level !== level,
                    ),
                    ...(textAr.trim() ? [{ level, textAr }] : []),
                  ],
                },
              })
            }
          />
        ))}
      </details>
    </div>
  );
}
