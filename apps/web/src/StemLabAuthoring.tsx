import { useEffect, useState } from "react";
import type { StemLabBlock } from "../../../packages/contracts/src/stem-labs";
import { jsonValue, record, type Subject } from "./product-api";

const kinds: Record<Subject, { kind: string; title: string }[]> = {
  algebra: [
    { kind: "math_linear_graph_v1", title: "دالة خطية وجدول ورسم" },
    { kind: "math_method_comparison_v1", title: "مقارنة طريقتين للحل" },
    { kind: "math_first_error_v1", title: "أول انتقال غير مكافئ" },
    { kind: "math_why_question_v1", title: "لماذا تصح الخطوة؟" },
    { kind: "math_completion_v1", title: "إكمال خطوة بمساعدة" },
    { kind: "math_equivalence_probe_v1", title: "فحص التكافؤ" },
  ],
  physics: [
    { kind: "physics_prediction_experiment_v1", title: "توقع وتجربة وملاحظة" },
    {
      kind: "physics_parameter_simulation_v1",
      title: "تغيير متغير في نموذج حركة",
    },
    { kind: "physics_graph_to_physics_v1", title: "قراءة رسم الحركة" },
    { kind: "physics_units_v1", title: "القيمة والوحدة" },
    {
      kind: "physics_misconception_contrast_v1",
      title: "مقارنة تفسيرين للحركة",
    },
  ],
  programming: [
    { kind: "predict_output", title: "توقع المخرجات" },
    { kind: "code_trace", title: "تتبع أثر كود مراجع" },
    { kind: "parsons_reorder", title: "ترتيب الأسطر" },
    { kind: "debug_select_fix", title: "اختيار إصلاح مراجع" },
  ],
};
export function stemDomainTemplate(
  subject: Subject,
  kind: string,
): Record<string, unknown> {
  if (subject === "algebra") {
    const originalRaw = "٣(س + ٢) = ٩";
    if (kind === "math_linear_graph_v1")
      return {
        kind,
        model: {
          modelVersion: "linear_function_v1",
          a: 2,
          b: 1,
          xMin: -3,
          xMax: 3,
          step: 1,
        },
      };
    if (kind === "math_method_comparison_v1")
      return {
        kind,
        originalRaw,
        methods: [
          {
            id: "distribute",
            titleAr: "التوزيع أولًا",
            steps: ["٣س + ٦ = ٩", "٣س = ٣", "س = ١"],
            mode: "solution",
          },
          {
            id: "divide",
            titleAr: "القسمة أولًا",
            steps: ["س + ٢ = ٣", "س = ١"],
            mode: "solution",
          },
        ],
        privateValidation: {
          acceptedMethodIds: ["distribute", "divide"],
          rubricAr: "الطريقتان تحفظان حلول المعادلة.",
        },
      };
    if (kind === "math_first_error_v1")
      return {
        kind,
        originalRaw,
        steps: ["٣س + ٢ = ٩", "٣س = ٧"],
        privateValidation: {
          expectedFirstInvalidStep: 1,
          reasonAr:
            "في هذا المثال المصطنع، يحتاج توزيع العدد على جميع حدود القوس إلى مراجعة.",
        },
      };
    if (kind === "math_why_question_v1")
      return {
        kind,
        fromRaw: originalRaw,
        toRaw: "٣س + ٦ = ٩",
        choices: [
          { id: "all_terms", textAr: "نضرب العدد في جميع حدود القوس" },
          { id: "first_only", textAr: "نضرب الحد الأول فقط" },
        ],
        privateValidation: {
          acceptedChoiceIds: ["all_terms"],
          reasonAr: "التوزيع يشمل جميع الحدود داخل القوس.",
        },
      };
    if (kind === "math_completion_v1")
      return {
        kind,
        originalRaw,
        visibleSteps: ["٣س + ٦ = ٩"],
        privateValidation: {
          completionRaw: "٣س = ٣",
          workedSteps: ["س = ١"],
          reasonAr: "اطرح المقدار نفسه من طرفي المعادلة.",
        },
      };
    return { kind, fromRaw: originalRaw, toRaw: "٣س + ٦ = ٩" };
  }
  if (subject === "physics")
    return {
      kind,
      model: {
        schemaVersion: "physics-lab-v1",
        modelCode: "constant_velocity_1d",
        modelVersion: "1.0.0",
        parameters: { v_mps: 3, t_s: 4, x0_m: 0 },
        sampleCount: 5,
      },
      predictionPromptAr: "ما أثر مضاعفة الزمن مع ثبات السرعة؟",
      observationPromptAr: "ماذا تغير؟",
      explanationPromptAr: "كيف تفسّر النتيجة؟",
      assumptionsAr: ["حركة على محور واحد بسرعة متجهة ثابتة"],
      controlledVariables: ["v_mps", "t_s"],
      ...(kind === "physics_units_v1"
        ? {
            privateValidation: {
              reference: {
                topic: "kinematics_1d",
                formula: "constant_velocity_displacement",
                quantity: "displacement",
                expectedDimension: "length",
                expectedValueSI: "12",
                expectedUnit: "m",
                tolerance: "0.01",
                givens: { v: "3", t: "4" },
              },
            },
          }
        : {}),
    };
  const sourceCode =
      "total = 0\nfor n in range(1, 4):\n    total += n\nprint(total)",
    base = {
      schemaVersion: "coding-lab-v1",
      kind,
      language: "python",
      sourceCode,
    };
  if (kind === "predict_output")
    return {
      ...base,
      privateValidation: { rubricVersion: "draft-v1", expectedOutput: "6" },
    };
  if (kind === "code_trace")
    return {
      ...base,
      privateValidation: {
        rubricVersion: "draft-v1",
        expectedOutput: "6",
        traceSteps: [
          {
            lineId: "start",
            sourceLine: 1,
            event: "assignment",
            variablesDisplay: { total: 0 },
            stdoutCumulative: "",
            explanationAr: "نهيئ المجموع بصفر.",
          },
          ...[1, 3, 6].map((total, index) => ({
            lineId: `iteration${index + 1}`,
            sourceLine: 3,
            event: "iteration",
            variablesDisplay: { n: index + 1, total },
            stdoutCumulative: "",
            explanationAr: "نضيف قيمة العدد الحالي إلى المجموع.",
          })),
          {
            lineId: "output",
            sourceLine: 4,
            event: "output",
            variablesDisplay: { total: 6 },
            stdoutCumulative: "6",
            explanationAr: "نطبع المجموع النهائي.",
          },
        ],
      },
    };
  if (kind === "parsons_reorder")
    return {
      ...base,
      lineItems: [
        { lineId: "D", text: "print(total)", indentationLevel: 0 },
        { lineId: "B", text: "for n in range(1, 4):", indentationLevel: 0 },
        { lineId: "A", text: "total = 0", indentationLevel: 0 },
        { lineId: "C", text: "total += n", indentationLevel: 4 },
      ],
      privateValidation: {
        rubricVersion: "draft-v1",
        validOrders: [["A", "B", "C", "D"]],
      },
    };
  return {
    ...base,
    sourceCode: sourceCode.replace("range(1, 4)", "range(1, 3)"),
    patchOptions: [
      {
        patchId: "include_three",
        labelAr: "غيّر الحد الأعلى ليشمل العدد ٣",
        replacementCode: sourceCode,
      },
      {
        patchId: "skip_one",
        labelAr: "ابدأ من العدد ٢",
        replacementCode: sourceCode.replace("range(1, 4)", "range(2, 4)"),
      },
    ],
    privateValidation: {
      rubricVersion: "draft-v1",
      correctPatchIds: ["include_three"],
    },
  };
}
export function newStemLab(subject: Subject): StemLabBlock {
  const kind = kinds[subject][0]!.kind;
  return {
    schemaVersion: "subject-lab-v1",
    subject,
    labKind: kind,
    objectiveAr: "",
    familyCode: "",
    skillCodes: [],
    domainSpec: stemDomainTemplate(subject, kind),
  };
}

/** The author may edit bounded JSON data, never HTML/JS. NestJS owns validation/publication. */
export function StemLabAuthoring({
  value,
  subject,
  skills,
  onChange,
}: {
  value: StemLabBlock;
  subject: Subject;
  skills: string[];
  onChange: (value: StemLabBlock) => void;
}) {
  const [domainText, setDomainText] = useState(
      JSON.stringify(value.domainSpec ?? {}, null, 2),
    ),
    [error, setError] = useState("");
  const domain = JSON.stringify(value.domainSpec ?? {});
  useEffect(() => {
    setDomainText(JSON.stringify(value.domainSpec ?? {}, null, 2));
    setError("");
  }, [domain]);
  function updateDomain() {
    try {
      if (domainText.length > 32000) throw new Error("size");
      const parsed = record(jsonValue(JSON.parse(domainText)));
      if (parsed.kind !== value.labKind) throw new Error("kind");
      onChange({ ...value, domainSpec: parsed });
      setError("");
    } catch {
      setError(
        "تحقق من صيغة JSON ونوع النشاط وحدّ ٣٢٬٠٠٠ محرف. لم نستبدل آخر مواصفة سليمة.",
      );
    }
  }
  return (
    <fieldset className="stem-lab-authoring">
      <legend>تأليف المختبر — مسودة تحتاج مراجعة المادة</legend>
      <label>
        نوع النشاط
        <select
          value={value.labKind}
          onChange={(event) => {
            const kind = event.target.value;
            onChange({
              ...value,
              labKind: kind,
              domainSpec: stemDomainTemplate(subject, kind),
            });
          }}
        >
          {kinds[subject].map((item) => (
            <option value={item.kind} key={item.kind}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        الهدف التعليمي
        <input
          value={value.objectiveAr}
          maxLength={1000}
          onChange={(event) =>
            onChange({ ...value, objectiveAr: event.target.value })
          }
        />
      </label>
      <label>
        معرّف عائلة التعرض
        <input
          dir="ltr"
          value={value.familyCode}
          maxLength={80}
          onChange={(event) =>
            onChange({ ...value, familyCode: event.target.value })
          }
        />
      </label>
      <fieldset>
        <legend>المهارات المثبتة لهذا الدرس</legend>
        {skills.length ? (
          skills.map((skill) => (
            <label key={skill}>
              <input
                type="checkbox"
                checked={value.skillCodes.includes(skill)}
                onChange={() =>
                  onChange({
                    ...value,
                    skillCodes: value.skillCodes.includes(skill)
                      ? value.skillCodes.filter((item) => item !== skill)
                      : [...value.skillCodes, skill],
                  })
                }
              />
              <bdi dir="ltr">{skill}</bdi>
            </label>
          ))
        ) : (
          <p>حدد مهارات الدرس أولًا؛ لا تُنشئ مهارة جديدة من هذا النموذج.</p>
        )}
      </fieldset>
      <label>
        مواصفة النشاط ومفتاح المراجعة الخاص — JSON فقط
        <textarea
          className="code-editor"
          dir="ltr"
          rows={12}
          maxLength={32000}
          value={domainText}
          onChange={(event) => setDomainText(event.target.value)}
          onBlur={updateDomain}
        />
      </label>
      <button onClick={updateDomain}>طبّق بيانات المواصفة على المسودة</button>
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      <p className="helper">
        المفتاح الخاص لا يظهر في معاينة الطالب. حفظ JSON لا يعني التحقق من العلم
        أو اعتماد المحتوى؛ استخدم «تحقق من الأمثلة» ثم مسار المراجعة والنشر
        القائم. الأثر البرمجي مراجع ومعد مسبقًا؛ لا يُشغّل كود الطالب في
        التأليف.
      </p>
    </fieldset>
  );
}
