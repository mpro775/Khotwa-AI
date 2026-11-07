import type {
  ContentPayload,
  PhysicsContent,
  PublicItem,
} from "../../../packages/contracts/src/product";
import { only, productInvalid, record, textField } from "./product-core";

const code = (v: unknown): string => {
  const value = textField(v, 80);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value))
    throw productInvalid("رمز المحتوى غير صالح.");
  return value;
};
const numeric = (v: unknown): string => {
  const value = textField(v, 48);
  if (!/^-?\d{1,12}(?:\.\d{1,12}|\/\d{1,12})?$/.test(value))
    throw productInvalid("قيمة مرجعية عددية غير صالحة.");
  return value;
};
export function parsePayload(raw: unknown): ContentPayload {
  const p = record(raw);
  only(p, [
    "titleAr",
    "statementAr",
    "subject",
    "unitCode",
    "unitTitleAr",
    "lessonCode",
    "lessonTitleAr",
    "skillCodes",
    "difficulty",
    "kind",
    "familyCode",
    "hints",
    "algebra",
    "physics",
    "programming",
  ]);
  if (
    !["algebra", "physics", "programming"].includes(String(p.subject)) ||
    ![1, 2, 3].includes(Number(p.difficulty)) ||
    typeof p.difficulty !== "number" ||
    !["main", "remediation", "transfer"].includes(String(p.kind))
  )
    throw productInvalid();
  if (
    !Array.isArray(p.skillCodes) ||
    p.skillCodes.length < 1 ||
    p.skillCodes.length > 8 ||
    !Array.isArray(p.hints) ||
    p.hints.length > 28
  )
    throw productInvalid();
  const hints = p.hints.map((rawHint) => {
    const h = record(rawHint);
    only(h, ["level", "textAr", "source", "reviewed", "errorCode"]);
    if (
      ![1, 2, 3, 4].includes(Number(h.level)) ||
      typeof h.level !== "number" ||
      !["manual", "ai_suggested"].includes(String(h.source)) ||
      typeof h.reviewed !== "boolean" ||
      (h.errorCode !== undefined &&
        h.errorCode !== null &&
        (p.subject !== "algebra" ||
          typeof h.errorCode !== "string" ||
          !/^ERR-ALG-0[1-6]$/.test(h.errorCode)))
    )
      throw productInvalid();
    return {
      level: h.level as 1 | 2 | 3 | 4,
      textAr: textField(h.textAr, 1200),
      source: h.source as "manual" | "ai_suggested",
      reviewed: h.reviewed,
      ...(h.errorCode === undefined
        ? {}
        : {
            errorCode:
              h.errorCode as ContentPayload["hints"][number]["errorCode"],
          }),
    };
  });
  if (
    new Set(hints.map((h) => `${h.level}:${h.errorCode ?? "general"}`)).size !==
    hints.length
  )
    throw productInvalid(
      "لا تكرر المستوى ونمط الخطأ نفسيهما؛ يمكن إضافة قالب عام وآخر مخصص.",
    );
  const payload: ContentPayload = {
    titleAr: textField(p.titleAr, 160),
    statementAr: textField(p.statementAr, 3000),
    subject: p.subject as ContentPayload["subject"],
    unitCode: code(p.unitCode),
    unitTitleAr: textField(p.unitTitleAr, 160),
    lessonCode: code(p.lessonCode),
    lessonTitleAr: textField(p.lessonTitleAr, 160),
    skillCodes: p.skillCodes.map(code),
    difficulty: p.difficulty as 1 | 2 | 3,
    kind: p.kind as ContentPayload["kind"],
    familyCode: code(p.familyCode),
    hints,
  };
  if (payload.subject === "algebra") {
    if (payload.skillCodes.some((s) => !/^SK-ALG-0[1-7]$/.test(s)))
      throw productInvalid(
        "اختر مهارة جبر مدعومة من SK-ALG-01 إلى SK-ALG-07. مهارة الكسور غير مفعلة.",
      );
    if (p.physics !== undefined || p.programming !== undefined)
      throw productInvalid();
    const a = record(p.algebra);
    only(a, ["equationRaw", "answerRaw", "validStepRaw", "invalidStepRaw"]);
    payload.algebra = {
      equationRaw: textField(a.equationRaw, 500),
      answerRaw: textField(a.answerRaw, 500),
      validStepRaw: textField(a.validStepRaw, 500),
      invalidStepRaw: textField(a.invalidStepRaw, 500),
    };
    // Fractions remain unavailable pending the explicit Arabic editor acceptance.
    if (Object.values(payload.algebra).some((v) => /[/÷⁄]/.test(v)))
      throw productInvalid("الكسور غير متاحة للنشر في هذه النسخة.");
  } else if (payload.subject === "physics") {
    if (p.algebra !== undefined || p.programming !== undefined)
      throw productInvalid();
    const f = record(p.physics);
    only(f, [
      "topic",
      "formula",
      "quantity",
      "expectedDimension",
      "expectedValueSI",
      "expectedUnit",
      "tolerance",
      "givens",
      "constraints",
    ]);
    const formulas = [
      "constant_speed_distance",
      "constant_velocity_displacement",
      "average_speed",
      "average_velocity",
      "final_velocity",
      "displacement",
      "acceleration",
      "elapsed_time",
    ];
    if (
      f.topic !== "kinematics_1d" ||
      !formulas.includes(String(f.formula)) ||
      ![
        "distance",
        "displacement",
        "speed",
        "velocity",
        "acceleration",
        "time",
      ].includes(String(f.quantity)) ||
      !["length", "time", "speed", "acceleration"].includes(
        String(f.expectedDimension),
      ) ||
      !["m", "s", "m/s", "m/s²", "km/h"].includes(String(f.expectedUnit))
    )
      throw productInvalid();
    const g = record(f.givens);
    only(g, ["d", "dx", "v", "v0", "a", "t"]);
    const givens = Object.fromEntries(
      Object.entries(g).map(([k, v]) => [k, numeric(v)]),
    );
    const constraints =
      f.constraints === undefined ? undefined : record(f.constraints);
    if (constraints) {
      only(constraints, ["nonNegativeAnswer"]);
      if (typeof constraints.nonNegativeAnswer !== "boolean")
        throw productInvalid();
    }
    payload.physics = {
      topic: "kinematics_1d",
      formula: f.formula as PhysicsContent["formula"],
      quantity: f.quantity as PhysicsContent["quantity"],
      expectedDimension:
        f.expectedDimension as PhysicsContent["expectedDimension"],
      expectedValueSI: numeric(f.expectedValueSI),
      expectedUnit: f.expectedUnit as PhysicsContent["expectedUnit"],
      tolerance: numeric(f.tolerance),
      givens,
      ...(constraints
        ? {
            constraints: {
              nonNegativeAnswer: constraints.nonNegativeAnswer as boolean,
            },
          }
        : {}),
    };
  } else {
    if (p.algebra !== undefined || p.physics !== undefined)
      throw productInvalid();
    const c = record(p.programming);
    only(c, ["starterCode", "referenceCode", "tests", "functionName"]);
    if (!Array.isArray(c.tests) || c.tests.length < 1 || c.tests.length > 12)
      throw productInvalid("يلزم من اختبار واحد إلى ١٢ اختبارًا.");
    const tests = c.tests.map((rawTest) => {
      const t = record(rawTest);
      only(t, ["input", "expectedOutput", "hidden"]);
      if (typeof t.hidden !== "boolean") throw productInvalid();
      return {
        input: textField(t.input, 4096, 0),
        expectedOutput: textField(t.expectedOutput, 4096, 0),
        hidden: t.hidden,
      };
    });
    const functionName =
      c.functionName === undefined ? undefined : textField(c.functionName, 64);
    if (
      functionName &&
      (!/^[A-Za-z][A-Za-z0-9_]*$/.test(functionName) ||
        functionName.startsWith("__"))
    )
      throw productInvalid();
    if (functionName) {
      for (const test of tests) {
        let args: unknown;
        try {
          args = JSON.parse(test.input);
        } catch {
          throw productInvalid(
            "مدخل اختبار الدالة يجب أن يكون مصفوفة JSON للوسائط.",
          );
        }
        if (!Array.isArray(args) || args.length > 16)
          throw productInvalid(
            "اختبار الدالة يدعم مصفوفة لا تتجاوز ١٦ وسيطًا.",
          );
      }
    }
    payload.programming = {
      starterCode: textField(c.starterCode, 12000, 0),
      referenceCode: textField(c.referenceCode, 12000),
      tests,
      ...(functionName ? { functionName } : {}),
    };
  }
  return payload;
}
export function publicItem(
  id: string,
  itemId: string,
  version: number,
  p: ContentPayload,
): PublicItem {
  return {
    id,
    itemId,
    version,
    subject: p.subject,
    titleAr: p.titleAr,
    statementAr: p.statementAr,
    unitCode: p.unitCode,
    lessonCode: p.lessonCode,
    skillCodes: p.skillCodes,
    difficulty: p.difficulty,
    kind: p.kind,
    ...(p.algebra ? { algebra: { equationRaw: p.algebra.equationRaw } } : {}),
    ...(p.physics
      ? {
          physics: {
            givens: p.physics.givens,
            quantity: p.physics.quantity,
            units: ["m", "s", "m/s", "m/s²", "km/h"],
          },
        }
      : {}),
    ...(p.programming
      ? {
          programming: {
            starterCode: p.programming.starterCode,
            publicTests: p.programming.tests
              .filter((t) => !t.hidden)
              .map((t) => ({
                input: t.input,
                expectedOutput: t.expectedOutput,
              })),
            ...(p.programming.functionName
              ? { functionName: p.programming.functionName }
              : {}),
          },
        }
      : {}),
  };
}
