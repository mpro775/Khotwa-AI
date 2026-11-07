/** Supplemental unreviewed practice/transfer content. Never seeds or publishes. */
import { readFileSync, writeFileSync } from "node:fs";
const base = JSON.parse(
  readFileSync(
    new URL(
      "../apps/api/data/physics-kinematics.draft.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const rows = [
  [
    "constant_motion",
    "constant_speed_distance",
    "distance",
    "length",
    "m",
    [{ v: "17", t: "11" }, "187"],
    [{ v: "19", t: "13" }, "247"],
    "المسافة تساوي مقدار السرعة الثابتة مضروبًا في الزمن.",
  ],
  [
    "distance_displacement",
    "constant_velocity_displacement",
    "displacement",
    "length",
    "m",
    [{ v: "-7", t: "9" }, "-63"],
    [{ v: "-11", t: "8" }, "-88"],
    "الإزاحة تساوي السرعة المتجهة مضروبة في الزمن، وإشارتها تتبع اتجاه المحور.",
  ],
  [
    "average_speed",
    "average_speed",
    "speed",
    "speed",
    "m/s",
    [{ d: "132", t: "11" }, "12"],
    [{ d: "221", t: "13" }, "17"],
    "السرعة المتوسطة تساوي المسافة الكلية مقسومة على الزمن المنقضي.",
  ],
  [
    "acceleration",
    "acceleration",
    "acceleration",
    "acceleration",
    "m/s²",
    [{ v: "41", v0: "5", t: "12" }, "3"],
    [{ v: "74", v0: "14", t: "15" }, "4"],
    "التسارع يساوي تغير السرعة المتجهة مقسومًا على الزمن المنقضي.",
  ],
  [
    "final_velocity",
    "final_velocity",
    "velocity",
    "speed",
    "m/s",
    [{ v0: "7", a: "4", t: "11" }, "51"],
    [{ v0: "-5", a: "3", t: "12" }, "31"],
    "السرعة النهائية تساوي السرعة الابتدائية مضافًا إليها حاصل ضرب التسارع في الزمن.",
  ],
  [
    "displacement",
    "displacement",
    "displacement",
    "length",
    "m",
    [{ v0: "6", a: "2", t: "11" }, "187"],
    [{ v0: "-3", a: "2", t: "13" }, "130"],
    "الإزاحة مع التسارع الثابت تجمع أثر السرعة الابتدائية وأثر نصف التسارع في مربع الزمن.",
  ],
];
const quantityNames = {
  distance: "المسافة",
  displacement: "الإزاحة",
  speed: "السرعة المتوسطة",
  velocity: "السرعة النهائية",
  acceleration: "التسارع",
};
const unitNames = { v: "m/s", v0: "m/s", a: "m/s²", t: "s", d: "m", dx: "m" };
const drafts = rows.flatMap(
  ([lesson, formula, quantity, dimension, unit, rem, transfer, concept]) => {
    const source = base.find((x) => x.lessonCode === lesson);
    if (!source) throw Error("missing_lesson");
    return [rem, transfer].map(([givens, value], index) => ({
      titleAr:
        source.lessonTitleAr + (index ? " — نقل فهم مستقل" : " — تدريب علاجي"),
      statementAr:
        "في حركة على محور محدد وبمعطيات ثابتة، أوجد " +
        quantityNames[quantity] +
        ". القيم المعطاة بوحدات النظام الدولي: " +
        Object.entries(givens)
          .map(([k, v]) => k + " = " + v + " " + unitNames[k])
          .join("، ") +
        ".",
      subject: "physics",
      unitCode: source.unitCode,
      unitTitleAr: source.unitTitleAr,
      lessonCode: lesson,
      lessonTitleAr: source.lessonTitleAr,
      skillCodes: source.skillCodes,
      difficulty: index ? 2 : 1,
      kind: index ? "transfer" : "remediation",
      familyCode: "PHYS-" + (index ? "TRANSFER-" : "PRACTICE-") + lesson,
      hints: [
        {
          level: 1,
          textAr: "حدد الكمية المطلوبة ووحدتها قبل اختيار العلاقة.",
          source: "manual",
          reviewed: false,
        },
        { level: 2, textAr: concept, source: "manual", reviewed: false },
        {
          level: 3,
          textAr:
            "عوّض المعطيات مع إشاراتها ووحداتها في العلاقة ثم افصل الحساب العددي عن فحص الوحدة.",
          source: "manual",
          reviewed: false,
        },
        {
          level: 4,
          textAr:
            "أولًا: " +
            concept +
            "\nثانيًا: استعمل المعطيات بوحدات النظام الدولي كما هي مع حفظ إشارة المحور.\nثالثًا: النتيجة المرجعية بعد التعويض والتحقق: " +
            value +
            " " +
            unit +
            ".",
          source: "manual",
          reviewed: false,
        },
      ],
      physics: {
        topic: "kinematics_1d",
        formula,
        quantity,
        expectedDimension: dimension,
        expectedValueSI: value,
        expectedUnit: unit,
        tolerance: "0",
        givens,
      },
    }));
  },
);
writeFileSync(
  new URL("../apps/api/data/physics-learning.draft.v1.json", import.meta.url),
  JSON.stringify(drafts, null, 2) + "\n",
);
console.log(
  "Created 12 unreviewed physics practice/transfer drafts; no service accessed.",
);
