/** Authoring utility only: creates unreviewed drafts, never publishes or seeds a DB. */
import { writeFileSync } from "node:fs";
const exercises = [
  [
    "print",
    "طباعة ترحيب",
    "اطبع مرحبًا بكلمة Hello.",
    "print('Hello')",
    [
      ["", "Hello", false],
      ["ignored", "Hello", true],
    ],
  ],
  [
    "print",
    "طباعة عدد",
    "اطبع العدد 7.",
    "print(7)",
    [
      ["", "7", false],
      ["anything", "7", true],
    ],
  ],
  [
    "print",
    "سطران",
    "اطبع Python ثم Khotwa في سطرين منفصلين.",
    "print('Python')\nprint('Khotwa')",
    [
      ["", "Python\nKhotwa", false],
      ["x", "Python\nKhotwa", true],
    ],
  ],
  [
    "variables",
    "متغير نصي",
    "اقرأ اسمًا من سطر واحد ثم اطبعه.",
    "name = input()\nprint(name)",
    [
      ["Ali", "Ali", false],
      ["Mona", "Mona", true],
    ],
  ],
  [
    "variables",
    "عدد مع زيادة",
    "اقرأ عددًا صحيحًا واطبع العدد الذي يليه.",
    "number = int(input())\nprint(number + 1)",
    [
      ["3", "4", false],
      ["-1", "0", true],
      ["12", "13", true],
    ],
  ],
  [
    "variables",
    "تبديل قيمتين",
    "اقرأ عددين في سطرين واطبعهما بترتيب معكوس كل في سطر.",
    "a = input()\nb = input()\nprint(b)\nprint(a)",
    [
      ["2\n9", "9\n2", false],
      ["-5\n0", "0\n-5", true],
    ],
  ],
  [
    "arithmetic",
    "جمع عددين",
    "اقرأ عددين صحيحين في سطرين واطبع مجموعهما.",
    "a = int(input())\nb = int(input())\nprint(a + b)",
    [
      ["2\n3", "5", false],
      ["-4\n9", "5", true],
      ["0\n0", "0", true],
    ],
  ],
  [
    "arithmetic",
    "مساحة مستطيل",
    "اقرأ طولًا وعرضًا صحيحين موجبين في سطرين واطبع المساحة.",
    "length = int(input())\nwidth = int(input())\nprint(length * width)",
    [
      ["3\n4", "12", false],
      ["9\n2", "18", true],
    ],
  ],
  [
    "arithmetic",
    "باقي القسمة",
    "اقرأ عددًا صحيحًا غير سالب واطبع باقي قسمته على 3.",
    "n = int(input())\nprint(n % 3)",
    [
      ["7", "1", false],
      ["0", "0", true],
      ["11", "2", true],
    ],
  ],
  [
    "conditions",
    "زوجي أم فردي",
    "اقرأ عددًا صحيحًا؛ اطبع even إن كان زوجيًا وإلا odd.",
    "n = int(input())\nif n % 2 == 0:\n    print('even')\nelse:\n    print('odd')",
    [
      ["4", "even", false],
      ["3", "odd", true],
      ["0", "even", true],
    ],
  ],
  [
    "conditions",
    "الأكبر",
    "اقرأ عددين صحيحين في سطرين واطبع الأكبر.",
    "a = int(input())\nb = int(input())\nif a >= b:\n    print(a)\nelse:\n    print(b)",
    [
      ["2\n9", "9", false],
      ["-3\n-7", "-3", true],
      ["5\n5", "5", true],
    ],
  ],
  [
    "conditions",
    "إشارة عدد",
    "اقرأ عددًا صحيحًا واطبع positive أو negative أو zero حسب إشارته.",
    "n = int(input())\nif n > 0:\n    print('positive')\nelif n < 0:\n    print('negative')\nelse:\n    print('zero')",
    [
      ["3", "positive", false],
      ["-2", "negative", true],
      ["0", "zero", true],
    ],
  ],
  [
    "conditions",
    "حد النجاح",
    "اقرأ درجة من 0 إلى 100 واطبع pass إذا بلغت 50 وإلا retry.",
    "grade = int(input())\nif grade >= 50:\n    print('pass')\nelse:\n    print('retry')",
    [
      ["75", "pass", false],
      ["50", "pass", true],
      ["49", "retry", true],
    ],
  ],
  [
    "loops",
    "المجموع المتدرج",
    "اقرأ n من 0 إلى 100 واطبع مجموع الأعداد من 1 إلى n.",
    "n = int(input())\ntotal = 0\nfor value in range(1, n + 1):\n    total += value\nprint(total)",
    [
      ["4", "10", false],
      ["0", "0", true],
      ["6", "21", true],
    ],
  ],
  [
    "loops",
    "عد تنازلي",
    "اقرأ n من 1 إلى 10 واطبع الأعداد من n إلى 1 كل في سطر.",
    "n = int(input())\nwhile n > 0:\n    print(n)\n    n -= 1",
    [
      ["3", "3\n2\n1", false],
      ["1", "1", true],
    ],
  ],
  [
    "loops",
    "عدد المضاعفات",
    "اقرأ n من 0 إلى 100 واطبع عدد الأعداد الزوجية بين 1 وn شاملًا الطرفين.",
    "n = int(input())\ncount = 0\nfor value in range(1, n + 1):\n    if value % 2 == 0:\n        count += 1\nprint(count)",
    [
      ["7", "3", false],
      ["0", "0", true],
      ["10", "5", true],
    ],
  ],
  [
    "loops",
    "تكرار كلمة",
    "اقرأ n من 0 إلى 5 واطبع go في n أسطر.",
    "n = int(input())\nfor _ in range(n):\n    print('go')",
    [
      ["2", "go\ngo", false],
      ["0", "", true],
      ["3", "go\ngo\ngo", true],
    ],
  ],
  [
    "functions",
    "دالة الجمع",
    "اكتب دالة add(a, b) تعيد مجموع عددين دون طباعته. يستدعيها الاختبار تلقائيًا.",
    "def add(a, b):\n    return a + b",
    [
      ["[2,3]", "5", false],
      ["[-4,7]", "3", true],
      ["[0,0]", "0", true],
    ],
    "add",
  ],
  [
    "functions",
    "دالة التربيع",
    "اكتب دالة square(n) تعيد مربع عدد صحيح دون طباعته.",
    "def square(n):\n    return n * n",
    [
      ["[3]", "9", false],
      ["[-4]", "16", true],
      ["[0]", "0", true],
    ],
    "square",
  ],
  [
    "functions",
    "دالة الزوجية",
    "اكتب دالة is_even(n) تعيد قيمة منطقية تدل على زوجية العدد.",
    "def is_even(n):\n    return n % 2 == 0",
    [
      ["[4]", "true", false],
      ["[3]", "false", true],
      ["[0]", "true", true],
    ],
    "is_even",
  ],
];
const lessons = {
  print: "الطباعة",
  variables: "المتغيرات والأنواع",
  arithmetic: "العمليات الحسابية",
  conditions: "الشروط",
  loops: "التكرار",
  functions: "الدوال",
};
const drafts = exercises.map(
  ([lesson, title, statement, reference, tests, functionName], index) => ({
    titleAr: title,
    statementAr: statement,
    subject: "programming",
    unitCode: "python_basics",
    unitTitleAr: "أساسيات Python",
    lessonCode: lesson,
    lessonTitleAr: lessons[lesson],
    skillCodes: ["PY-" + lesson.toUpperCase()],
    difficulty: index < 9 ? 1 : 2,
    kind: "main",
    familyCode: "PY-" + String(index + 1).padStart(3, "0"),
    hints: [
      {
        level: 1,
        textAr: "اقرأ المطلوب وحدد المدخل والمخرج أولًا.",
        source: "manual",
        reviewed: false,
      },
      {
        level: 2,
        textAr:
          lesson === "functions"
            ? "الدالة تعيد قيمة؛ فرّق بين return وprint."
            : lesson === "loops"
              ? "حدد بداية التكرار ونهايته وما الذي يتغير في كل دورة."
              : lesson === "conditions"
                ? "افحص الحالة الحدية وما إذا كانت تدخل في فرع الشرط."
                : "راجع نوع القيمة قبل تطبيق العملية المطلوبة.",
        source: "manual",
        reviewed: false,
      },
      {
        level: 3,
        textAr:
          lesson === "functions"
            ? "اكتب اسم الدالة والمعاملات كما وردت في السؤال، ثم أعد قيمة واحدة."
            : lesson === "loops"
              ? "ابدأ بمتغير يجمع النتيجة ثم حدّثه داخل الحلقة."
              : "جرّب تتبع مثال علني على الورق قبل تشغيل الكود.",
        source: "manual",
        reviewed: false,
      },
      {
        level: 4,
        textAr: "نموذج شرح كامل للمراجعة:\n" + reference,
        source: "manual",
        reviewed: false,
      },
    ],
    programming: {
      starterCode: functionName
        ? "def " +
          functionName +
          "(" +
          (functionName === "add" ? "a, b" : "n") +
          "):\n    pass\n"
        : "# اكتب حلك هنا\n",
      referenceCode: reference,
      tests: tests.map(([input, expectedOutput, hidden]) => ({
        input,
        expectedOutput,
        hidden,
      })),
      ...(functionName ? { functionName } : {}),
    },
  }),
);
writeFileSync(
  new URL("../apps/api/data/python-basics.draft.v1.json", import.meta.url),
  JSON.stringify(drafts, null, 2) + "\n",
);
console.log(
  "Created 20 unreviewed Python drafts; no database or runner accessed.",
);
