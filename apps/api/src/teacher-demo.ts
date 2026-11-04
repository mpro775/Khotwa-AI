import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import Ajv from "ajv";
import { output, type Schema } from "./contracts";
import { ApiFault } from "./http";
export const TEACHER_DATASET_SHA256 =
  "b56888b58552250bcba9ff89f42044def285039bdd03bb3b5a5f4db2655a0fd5";
interface DemoRow {
  key: string;
  studentKey: string;
  isSynthetic: true;
  mathStatus: Schema<"MathStatus">;
  hintLevel: Schema<"HintLevel">;
  phase: "main" | "remediation" | "transfer";
  errorCode: string | null;
  exampleId: string | null;
  independentTransfer: boolean;
}
export interface TeacherArtifact {
  datasetCode: string;
  isSynthetic: true;
  sourceKind: "authored_static_synthetic";
  generatedAt: string;
  rows: DemoRow[];
  examples: Schema<"TeacherDemoExample">[];
}
const validate = new Ajv({ strict: false }).compile({
  type: "object",
  additionalProperties: false,
  required: [
    "datasetCode",
    "isSynthetic",
    "sourceKind",
    "generatedAt",
    "rows",
    "examples",
  ],
  properties: {
    datasetCode: { const: "ph09-authored-synthetic-v1" },
    isSynthetic: { const: true },
    sourceKind: { const: "authored_static_synthetic" },
    generatedAt: { type: "string" },
    rows: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "studentKey",
          "isSynthetic",
          "mathStatus",
          "hintLevel",
          "phase",
          "errorCode",
          "exampleId",
          "independentTransfer",
        ],
        properties: {
          key: { type: "string", pattern: "^synthetic-attempt-[0-9]{2}$" },
          studentKey: {
            type: "string",
            pattern: "^synthetic-student-[0-9]{2}$",
          },
          isSynthetic: { const: true },
          mathStatus: {
            enum: [
              "verified_valid",
              "verified_invalid",
              "syntax_error",
              "unsupported",
              "inconclusive",
              "service_error",
            ],
          },
          hintLevel: { enum: ["H0", "H1", "H2", "H3", "H4"] },
          phase: { enum: ["main", "remediation", "transfer"] },
          errorCode: {
            anyOf: [
              {
                enum: [
                  "ERR-ALG-01",
                  "ERR-ALG-02",
                  "ERR-ALG-03",
                  "ERR-ALG-04",
                  "ERR-ALG-05",
                  "ERR-ALG-06",
                ],
              },
              { type: "null" },
            ],
          },
          exampleId: { anyOf: [{ type: "string" }, { type: "null" }] },
          independentTransfer: { type: "boolean" },
        },
      },
    },
    examples: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: { type: "object" },
    },
  },
});
const fail = () => {
  throw Error("Invalid fixed synthetic teacher dataset");
};
export function teacherArtifact(value: unknown): TeacherArtifact {
  if (!validate(value)) return fail();
  const data = value as TeacherArtifact;
  if (
    !Number.isFinite(Date.parse(data.generatedAt)) ||
    new Set(data.rows.map((r) => r.key)).size !== data.rows.length ||
    new Set(data.examples.map((e) => e.id)).size !== data.examples.length
  )
    return fail();
  for (const example of data.examples) {
    output("TeacherDemoExample", example);
    if (
      example.datasetCode !== data.datasetCode ||
      example.isSynthetic !== true ||
      example.problem.kind !== "main"
    )
      return fail();
  }
  for (const r of data.rows) {
    const independent =
      r.mathStatus === "verified_valid" &&
      r.phase === "transfer" &&
      r.hintLevel === "H0";
    if (
      r.independentTransfer !== independent ||
      (r.errorCode !== null && r.mathStatus !== "verified_invalid")
    )
      return fail();
    if (r.exampleId !== null) {
      const e = data.examples.find((e) => e.id === r.exampleId);
      if (
        !e ||
        e.mathStatus !== r.mathStatus ||
        e.diagnosis?.errorCode !== r.errorCode
      )
        return fail();
    }
  }
  if (data.examples.some((e) => !data.rows.some((r) => r.exampleId === e.id)))
    return fail();
  return data;
}
const names: Record<string, string> = {
  "ERR-ALG-01": "إغفال حد عند التوزيع",
  "ERR-ALG-02": "إشارة التحويل",
  "ERR-ALG-03": "تغيير طرف واحد",
  "ERR-ALG-04": "اختيار العملية العكسية",
  "ERR-ALG-05": "حساب عددي يحتاج مراجعة",
  "ERR-ALG-06": "توزيع معامل سالب",
};
export function teacherSummary(
  input: TeacherArtifact,
): Schema<"TeacherDemoSummary"> {
  const data = teacherArtifact(input),
    rows = data.rows;
  const count = (f: (r: DemoRow) => boolean) => rows.filter(f).length;
  return output("TeacherDemoSummary", {
    isSynthetic: true,
    datasetCode: data.datasetCode,
    generatedAt: data.generatedAt,
    sampleStudentCount: new Set(rows.map((r) => r.studentKey)).size,
    sampleAttemptCount: rows.length,
    metrics: [
      {
        code: "evaluable_attempts",
        titleAr: "محاولات قابلة للتقييم الرياضي",
        count: count((r) =>
          ["verified_valid", "verified_invalid"].includes(r.mathStatus),
        ),
      },
      {
        code: "non_assessable_attempts",
        titleAr: "محاولات تعذر تقييمها؛ لا تعني خطأً مفاهيميًا",
        count: count(
          (r) => !["verified_valid", "verified_invalid"].includes(r.mathStatus),
        ),
      },
      {
        code: "verified_invalid_attempts",
        titleAr: "انتقالات غير متكافئة ضمن العينة",
        count: count((r) => r.mathStatus === "verified_invalid"),
      },
      {
        code: "independent_transfer_attempts",
        titleAr: "إكمال نقل مستقل في سجلات العرض المؤلفة",
        count: count((r) => r.independentTransfer),
      },
      {
        code: "assisted_completions",
        titleAr: "إكمال بعد مساعدة في سجلات العرض",
        count: count(
          (r) => r.mathStatus === "verified_valid" && r.hintLevel !== "H0",
        ),
      },
    ],
    topMisconceptions: Object.entries(names)
      .map(([errorCode, nameAr]) => ({
        errorCode,
        nameAr,
        count: count((r) => r.errorCode === errorCode),
      }))
      .filter((r) => r.count > 0)
      .sort(
        (a, b) => b.count - a.count || a.errorCode.localeCompare(b.errorCode),
      ),
    exampleIds: data.examples.map((e) => e.id),
    disclaimerAr:
      "بيانات توضيحية اصطناعية فقط، قيد مراجعة المحتوى؛ لا تمثل فصلًا أو متعلمين حقيقيين ولا اعتمادًا لدورة التعلم. الأعداد مشتقة من سجلات الحزمة الثابتة، وليست نسب إتقان أو أثر تحسن. الأنماط فرضيات مؤلفة؛ عدد المحاولات ليس عدد الطلاب المتعثرين. التعذر منفصل عن الخطأ، ويمكن تتبع الأمثلة إلى هذه الحزمة.",
  });
}
function freeze(value: unknown) {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
}
/** No Store, database client, guest/session selector, or configurable source path. */
export class TeacherDemoService {
  private readonly data: TeacherArtifact | null;
  constructor(readonly active = false) {
    if (active) {
      const bytes = readFileSync(
        join(__dirname, "../data/teacher-demo.v1.json"),
      );
      if (
        createHash("sha256").update(bytes).digest("hex") !==
        TEACHER_DATASET_SHA256
      )
        fail();
      this.data = teacherArtifact(
        JSON.parse(bytes.toString("utf8")) as unknown,
      );
      freeze(this.data);
    } else this.data = null;
  }
  private current() {
    if (!this.active || process.env.PH09_API_ENABLED !== "true" || !this.data)
      throw new ApiFault(404, "not_found", "المورد غير متاح.");
    return this.data;
  }
  summary() {
    return teacherSummary(this.current());
  }
  example(id: string) {
    const e = this.current().examples.find((e) => e.id === id);
    if (!e) throw new ApiFault(404, "not_found", "المورد غير متاح.");
    return e;
  }
}
