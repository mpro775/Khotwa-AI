import { useEffect, useRef, useState } from "react";
import type {
  ContentPayload,
  ContentStatus,
  PhysicsContent,
  ProgrammingValidation,
  StudioItem,
} from "../../../packages/contracts/src/product";
import {
  ProductApi,
  type Identity,
  type Subject,
  arrayField,
  booleanField,
  jsonValue,
  messageOf,
  numberField,
  optionalText,
  record,
  strings,
  subjectField,
  textField,
} from "./product-api";
import { MathInput } from "./MathInput";

function emptyPayload(subject: Subject = "algebra"): ContentPayload {
  const base = {
    subject,
    titleAr: "",
    statementAr: "",
    unitCode:
      subject === "algebra"
        ? "linear_equations"
        : subject === "physics"
          ? "kinematics_1d"
          : "python_basics",
    unitTitleAr:
      subject === "algebra"
        ? "المعادلات الخطية"
        : subject === "physics"
          ? "الحركة في خط مستقيم"
          : "أساسيات Python",
    lessonCode: "",
    lessonTitleAr: "",
    skillCodes: [] as string[],
    difficulty: 1 as const,
    kind: "main" as const,
    familyCode: "",
    hints: [1, 2, 3, 4].map((level) => ({
      level: level as 1 | 2 | 3 | 4,
      textAr: "",
      source: "manual" as const,
      reviewed: false,
    })),
  };
  if (subject === "algebra")
    return {
      ...base,
      algebra: {
        equationRaw: "",
        answerRaw: "",
        validStepRaw: "",
        invalidStepRaw: "",
      },
    };
  if (subject === "physics")
    return {
      ...base,
      physics: {
        topic: "kinematics_1d",
        formula: "final_velocity",
        quantity: "velocity",
        expectedDimension: "speed",
        expectedValueSI: "",
        expectedUnit: "m/s",
        tolerance: "0",
        givens: { v0: "", a: "", t: "" },
      },
    };
  return {
    ...base,
    programming: {
      starterCode: "",
      referenceCode: "",
      tests: [
        { input: "", expectedOutput: "", hidden: false },
        { input: "", expectedOutput: "", hidden: true },
      ],
    },
  };
}
const givenLabels: Record<string, string> = {
  d: "المسافة",
  dx: "الإزاحة",
  v: "السرعة",
  v0: "السرعة الابتدائية",
  a: "التسارع",
  t: "الزمن",
};
function formulaContent(
  current: PhysicsContent,
  formula: PhysicsContent["formula"],
): PhysicsContent {
  const defaults: Record<
    PhysicsContent["formula"],
    {
      keys: string[];
      quantity: PhysicsContent["quantity"];
      dimension: PhysicsContent["expectedDimension"];
      unit: PhysicsContent["expectedUnit"];
    }
  > = {
    constant_speed_distance: {
      keys: ["v", "t"],
      quantity: "distance",
      dimension: "length",
      unit: "m",
    },
    constant_velocity_displacement: {
      keys: ["v", "t"],
      quantity: "displacement",
      dimension: "length",
      unit: "m",
    },
    average_speed: {
      keys: ["d", "t"],
      quantity: "speed",
      dimension: "speed",
      unit: "m/s",
    },
    average_velocity: {
      keys: ["dx", "t"],
      quantity: "velocity",
      dimension: "speed",
      unit: "m/s",
    },
    final_velocity: {
      keys: ["v0", "a", "t"],
      quantity: "velocity",
      dimension: "speed",
      unit: "m/s",
    },
    displacement: {
      keys: ["v0", "a", "t"],
      quantity: "displacement",
      dimension: "length",
      unit: "m",
    },
    acceleration: {
      keys: ["v", "v0", "t"],
      quantity: "acceleration",
      dimension: "acceleration",
      unit: "m/s²",
    },
    elapsed_time: {
      keys: ["v", "v0", "a"],
      quantity: "time",
      dimension: "time",
      unit: "s",
    },
  };
  const next = defaults[formula];
  return {
    ...current,
    formula,
    quantity: next.quantity,
    expectedDimension: next.dimension,
    expectedUnit: next.unit,
    givens: Object.fromEntries(
      next.keys.map((key) => [key, current.givens[key] ?? ""]),
    ),
  };
}
const algebraErrorCodes = [
  "ERR-ALG-01",
  "ERR-ALG-02",
  "ERR-ALG-03",
  "ERR-ALG-04",
  "ERR-ALG-05",
  "ERR-ALG-06",
] as const;
function hintSlots(payload: ContentPayload): ContentPayload {
  return {
    ...payload,
    hints: [
      ...([1, 2, 3, 4] as const).map(
        (level) =>
          payload.hints.find(
            (hint) => hint.level === level && !hint.errorCode,
          ) ?? {
            level,
            textAr: "",
            source: "manual" as const,
            reviewed: false,
          },
      ),
      ...payload.hints.filter((hint) => !!hint.errorCode),
    ],
  };
}
function enumField<T extends string>(value: unknown, values: readonly T[]): T {
  const text = textField(value);
  const found = values.find((x) => x === text);
  if (!found) throw new Error("invalid_response");
  return found;
}
function contentPayload(value: unknown): ContentPayload {
  const r = record(value),
    difficulty = numberField(r.difficulty);
  if (difficulty !== 1 && difficulty !== 2 && difficulty !== 3)
    throw new Error("invalid_response");
  const p: ContentPayload = {
    subject: subjectField(r.subject),
    titleAr: textField(r.titleAr),
    statementAr: textField(r.statementAr),
    unitCode: textField(r.unitCode),
    unitTitleAr: textField(r.unitTitleAr),
    lessonCode: textField(r.lessonCode),
    lessonTitleAr: textField(r.lessonTitleAr),
    skillCodes: strings(r.skillCodes),
    difficulty,
    kind: enumField(r.kind, ["main", "remediation", "transfer"]),
    familyCode: textField(r.familyCode),
    hints: arrayField(r.hints, (value) => {
      const h = record(value),
        level = numberField(h.level);
      if (level !== 1 && level !== 2 && level !== 3 && level !== 4)
        throw new Error("invalid_response");
      return {
        level,
        textAr: textField(h.textAr),
        source: enumField(h.source, ["manual", "ai_suggested"]),
        reviewed: booleanField(h.reviewed),
        ...(h.errorCode === undefined
          ? {}
          : {
              errorCode:
                h.errorCode === null
                  ? null
                  : enumField(h.errorCode, algebraErrorCodes),
            }),
      };
    }),
  };
  if (r.algebra) {
    const a = record(r.algebra);
    p.algebra = {
      equationRaw: textField(a.equationRaw),
      answerRaw: textField(a.answerRaw),
      validStepRaw: textField(a.validStepRaw),
      invalidStepRaw: textField(a.invalidStepRaw),
    };
  }
  if (r.programming) {
    const c = record(r.programming);
    p.programming = {
      starterCode: textField(c.starterCode),
      referenceCode: textField(c.referenceCode),
      tests: arrayField(c.tests, (value) => {
        const t = record(value);
        return {
          input: textField(t.input),
          expectedOutput: textField(t.expectedOutput),
          hidden: booleanField(t.hidden),
        };
      }),
      ...(typeof c.functionName === "string"
        ? { functionName: c.functionName }
        : {}),
    };
  }
  if (r.physics) {
    const ph = record(r.physics),
      constraint =
        ph.constraints === undefined ? undefined : record(ph.constraints);
    p.physics = {
      topic: enumField(ph.topic, ["kinematics_1d"]),
      formula: enumField(ph.formula, [
        "constant_speed_distance",
        "constant_velocity_displacement",
        "average_speed",
        "average_velocity",
        "final_velocity",
        "displacement",
        "acceleration",
        "elapsed_time",
      ]),
      quantity: enumField(ph.quantity, [
        "distance",
        "displacement",
        "speed",
        "velocity",
        "acceleration",
        "time",
      ]),
      expectedDimension: enumField(ph.expectedDimension, [
        "length",
        "time",
        "speed",
        "acceleration",
      ]),
      expectedValueSI: textField(ph.expectedValueSI),
      expectedUnit: enumField(ph.expectedUnit, [
        "m",
        "s",
        "m/s",
        "m/s²",
        "km/h",
      ]),
      tolerance: textField(ph.tolerance),
      givens: Object.fromEntries(
        Object.entries(record(ph.givens)).map(([k, v]) => [k, textField(v)]),
      ),
      ...(constraint
        ? {
            constraints: {
              nonNegativeAnswer: booleanField(constraint.nonNegativeAnswer),
            },
          }
        : {}),
    };
  }
  return p;
}
const runnerStatuses = [
  "queued",
  "running",
  "succeeded",
  "compile_error",
  "runtime_error",
  "timeout",
  "resource_limit",
  "service_error",
] as const;
const runnerLabels: Record<ProgrammingValidation["status"], string> = {
  queued: "لم يُنفذ",
  running: "قيد التنفيذ",
  succeeded: "اكتمل التنفيذ",
  compile_error: "خطأ في ترجمة الكود",
  runtime_error: "خطأ أثناء التنفيذ",
  timeout: "انتهت المهلة",
  resource_limit: "تجاوز حد الموارد",
  service_error: "تعذر التنفيذ",
};
function programmingValidation(value: unknown): ProgrammingValidation {
  const r = record(value);
  const count = (value: unknown) => {
    const n = numberField(value);
    if (!Number.isSafeInteger(n) || n < 0 || n > 12)
      throw new Error("نتيجة اختبارات غير صالحة.");
    return n;
  };
  const summary = (value: unknown) => {
    const s = record(value),
      passed = count(s.passed),
      total = count(s.total);
    if (passed > total) throw new Error("نتيجة اختبارات غير صالحة.");
    return { passed, total };
  };
  const cases = arrayField(r.cases, (value) => {
    const c = record(value);
    return {
      index: count(c.index),
      visibility: enumField(c.visibility, ["public", "hidden"]),
      status: enumField(c.status, runnerStatuses),
      passed: booleanField(c.passed),
      executed: booleanField(c.executed),
    };
  });
  const result = {
    status: enumField(r.status, runnerStatuses),
    ...summary(r),
    allPassed: booleanField(r.allPassed),
    public: summary(r.public),
    hidden: summary(r.hidden),
    cases,
  };
  if (
    cases.length !== result.total ||
    cases.some((c, i) => c.index !== i || (c.passed && !c.executed)) ||
    result.public.total + result.hidden.total !== result.total ||
    result.public.passed + result.hidden.passed !== result.passed
  )
    throw new Error("نتيجة اختبارات غير صالحة.");
  return result;
}
function studioItem(value: unknown): StudioItem {
  const r = record(value),
    v = r.validation === null ? null : record(r.validation);
  return {
    id: textField(r.id),
    itemId: textField(r.itemId),
    version: numberField(r.version),
    editRevision: numberField(r.editRevision),
    status: enumField(r.status, [
      "draft",
      "in_review",
      "approved",
      "published",
      "archived",
    ]),
    payload: contentPayload(r.payload),
    contentHash: textField(r.contentHash),
    validation: v
      ? {
          valid: booleanField(v.valid),
          issues: strings(v.issues),
          checkedAt: textField(v.checkedAt),
          engine: textField(v.engine),
          ...(v.programming === undefined
            ? {}
            : { programming: programmingValidation(v.programming) }),
        }
      : null,
    createdAt: textField(r.createdAt),
    reviewedAt: optionalText(r.reviewedAt),
    publishedAt: optionalText(r.publishedAt),
  };
}
function Field({
  id,
  label,
  value,
  onChange,
  multiline = false,
  code = false,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  code?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="studio-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={code ? 6 : 3}
          dir={code ? "ltr" : "rtl"}
          className={code ? "code-editor" : undefined}
          disabled={disabled}
          spellCheck={!code}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={code ? "ltr" : "rtl"}
          disabled={disabled}
        />
      )}
    </div>
  );
}
const statuses: Record<ContentStatus, string> = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد للنشر",
  published: "منشور",
  archived: "مؤرشف",
};
type Preview = {
  accepted: number;
  rejected: number;
  results: { index: number; valid: boolean; issues: string[] }[];
};
const previewData = (value: unknown): Preview => {
  const r = record(value);
  return {
    accepted: numberField(r.accepted),
    rejected: numberField(r.rejected),
    results: arrayField(r.results, (value) => {
      const i = record(value);
      return {
        index: numberField(i.index),
        valid: booleanField(i.valid),
        issues: strings(i.issues),
      };
    }),
  };
};

export function ContentStudio({
  api,
  identity,
}: {
  api: ProductApi;
  identity: Identity | null;
}) {
  const [items, setItems] = useState<StudioItem[]>([]),
    [selected, setSelected] = useState<StudioItem | null>(null),
    [payload, setPayload] = useState<ContentPayload>(() => emptyPayload()),
    [skillText, setSkillText] = useState(""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [filter, setFilter] = useState(""),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [filterSkill, setFilterSkill] = useState(""),
    [filterDifficulty, setFilterDifficulty] = useState(""),
    [importText, setImportText] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null);
  const editEpoch = useRef(0);
  const authorized =
      !!identity?.user &&
      ["teacher", "content_manager", "admin"].includes(identity.user.role),
    publisher = identity?.user?.role === "admin",
    editable = !selected || selected.status === "draft";
  useEffect(() => {
    if (authorized) void load();
  }, [authorized]);
  async function work(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    await work(async () => {
      const search = new URLSearchParams();
      if (filter) search.set("subject", filter);
      if (status) search.set("status", status);
      if (query) search.set("q", query);
      if (filterSkill.trim()) search.set("skillCode", filterSkill.trim());
      if (filterDifficulty) search.set("difficulty", filterDifficulty);
      setItems(
        await api.request("/studio/items?" + search, (value) =>
          arrayField(record(value).items, studioItem),
        ),
      );
    });
  }
  function change(next: ContentPayload) {
    editEpoch.current++;
    setPayload(next);
    setDirty(true);
  }
  function open(item: StudioItem) {
    editEpoch.current++;
    setSelected(item);
    setPayload(hintSlots(item.payload));
    setSkillText(item.payload.skillCodes.join(", "));
    setDirty(false);
    setError("");
    setNotice(
      "حُمّلت نسخة المحتوى. الحلول والاختبارات هنا محمية بصلاحية إدارة المحتوى.",
    );
  }
  async function save() {
    await work(async () => {
      const persisted = {
        ...payload,
        hints: payload.hints.filter((hint) => hint.textAr.trim().length > 0),
      };
      const next = selected
        ? await api.request("/studio/items/" + selected.id, studioItem, "PUT", {
            expectedRevision: selected.editRevision,
            payload: persisted,
          })
        : await api.request("/studio/items", studioItem, "POST", persisted);
      setSelected(next);
      setPayload(hintSlots(next.payload));
      setSkillText(next.payload.skillCodes.join(", "));
      setDirty(false);
      setItems((old) => [next, ...old.filter((item) => item.id !== next.id)]);
      setNotice("حُفظت المسودة. يلزم التحقق والمراجعة قبل إتاحتها للطلاب.");
    });
  }
  async function transition(
    action:
      | "submit"
      | "approve"
      | "publish"
      | "archive"
      | "revise"
      | "rollback",
  ) {
    if (!selected || (action === "submit" && dirty)) return;
    const submitted = selected,
      epoch = editEpoch.current;
    await work(async () => {
      let target = submitted;
      if (action === "submit") {
        const checked = await api.request(
          `/studio/items/${submitted.id}/validate`,
          studioItem,
          "POST",
          { expectedRevision: submitted.editRevision },
        );
        if (editEpoch.current !== epoch) {
          setNotice(
            "تغيّرت المسودة أثناء التحقق؛ بقيت تغييراتك ولم تُرسل للمراجعة.",
          );
          return;
        }
        setSelected(checked);
        setItems((old) => [
          checked,
          ...old.filter((item) => item.id !== checked.id),
        ]);
        if (!checked.validation?.valid) {
          setNotice(
            "بقيت المسألة مسودة؛ صحح ملاحظات فحص المرجع قبل إرسالها للمراجعة.",
          );
          return;
        }
        target = checked;
      }
      const next = await api.request(
        `/studio/items/${target.id}/transition`,
        studioItem,
        "POST",
        { expectedRevision: target.editRevision, action },
      );
      if (editEpoch.current !== epoch) {
        setNotice(
          "اكتملت العملية للنسخة السابقة؛ بقيت المسودة المفتوحة كما كتبتها.",
        );
        return;
      }
      setSelected(next);
      setPayload(hintSlots(next.payload));
      setSkillText(next.payload.skillCodes.join(", "));
      setDirty(false);
      setItems((old) => [next, ...old.filter((item) => item.id !== next.id)]);
      setNotice(
        action === "revise"
          ? "أُنشئت مسودة إصدار جديد مع حفظ النسخة السابقة."
          : action === "rollback"
            ? "نُشر إصدار رجوع دون حذف محاولات الطلاب."
            : "حُدّثت حالة المحتوى: " + statuses[next.status],
      );
    });
  }
  async function removeDraft() {
    if (!selected || selected.status !== "draft" || dirty) return;
    await work(async () => {
      const next = await api.request(
        `/studio/items/${selected.id}`,
        studioItem,
        "DELETE",
        { expectedRevision: selected.editRevision },
      );
      setSelected(next);
      setPayload(hintSlots(next.payload));
      setSkillText(next.payload.skillCodes.join(", "));
      setDirty(false);
      setItems((old) => [next, ...old.filter((item) => item.id !== next.id)]);
      setNotice("أزيلت المسودة من التحرير مع حفظ سجلها مؤرشفًا.");
    });
  }
  function parsedImport(): unknown[] {
    const value: unknown = JSON.parse(importText);
    if (Array.isArray(value)) return value;
    const r = record(value);
    if (!Array.isArray(r.items)) throw new Error("invalid_import");
    return r.items;
  }
  async function previewImport() {
    await work(async () => {
      let values: unknown[];
      try {
        values = parsedImport();
      } catch {
        setError("أدخل JSON صحيحًا يحتوي قائمة items أو مصفوفة مسائل.");
        return;
      }
      setPreview(
        await api.request("/studio/import/preview", previewData, "POST", {
          items: values,
        }),
      );
    });
  }
  async function importItems() {
    await work(async () => {
      const result = await api.request("/studio/import", jsonValue, "POST", {
        items: parsedImport(),
      });
      setNotice(
        "حُفظ الاستيراد كمسودات للمراجعة. " +
          (result === null ? "" : "راجع قائمة المحتوى."),
      );
      setPreview(null);
    });
    await load();
  }
  async function download() {
    await work(async () => {
      const value = await api.request("/studio/export", jsonValue);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "khotwa-content.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  const previous = selected
    ? items.find(
        (item) =>
          item.itemId === selected.itemId &&
          item.version === selected.version - 1,
      )
    : undefined;
  return (
    <section
      className="product-page"
      aria-labelledby="studio-title"
      aria-busy={busy}
    >
      <div className="page-heading">
        <span className="eyebrow">للمعلم ومدير المحتوى</span>
        <h1 id="studio-title">مساحة إعداد الدروس.</h1>
        <p>
          أنشئ مسودة، تحقق من مرجع الإجابة، ثم راجع وانشر إصدارًا محفوظ التاريخ.
          لا تعرض هذه الصفحة محاولات المتعلمين.
        </p>
      </div>
      {!authorized ? (
        <div className="product-card">
          <h2>يلزم حساب مخوّل</h2>
          <p>
            سجّل الدخول بحساب معلّم أو مدير محتوى. تُفحص الصلاحية داخل الخادم
            لكل قراءة وتعديل ونشر.
          </p>
        </div>
      ) : (
        <>
          {error && (
            <p className="product-error" role="alert">
              {error}
            </p>
          )}
          <p role="status" aria-live="polite">
            {notice}
          </p>
          <div className="studio-layout">
            <aside className="product-card">
              <h2>الوحدات والمسائل</h2>
              <label htmlFor="studio-search">ابحث بالعنوان أو المهارة</label>
              <input
                id="studio-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label htmlFor="studio-subject-filter">المادة</label>
              <select
                id="studio-subject-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">كل المواد</option>
                <option value="algebra">الجبر</option>
                <option value="physics">الفيزياء</option>
                <option value="programming">البرمجة</option>
              </select>
              <label htmlFor="studio-skill-filter">المهارة</label>
              <input
                id="studio-skill-filter"
                list="studio-skill-options"
                dir="ltr"
                value={filterSkill}
                onChange={(e) => setFilterSkill(e.target.value)}
                placeholder="SK-ALG-04"
              />
              <datalist id="studio-skill-options">
                {[...new Set(items.flatMap((item) => item.payload.skillCodes))]
                  .sort()
                  .map((skill) => (
                    <option key={skill} value={skill} />
                  ))}
              </datalist>
              <label htmlFor="studio-difficulty-filter">الصعوبة</label>
              <select
                id="studio-difficulty-filter"
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
              >
                <option value="">كل الصعوبات</option>
                <option value="1">١ — تمهيدية</option>
                <option value="2">٢ — متوسطة</option>
                <option value="3">٣ — تحدٍّ بسيط</option>
              </select>
              <label htmlFor="studio-status-filter">الحالة</label>
              <select
                id="studio-status-filter"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">كل الحالات</option>
                {Object.entries(statuses).map(([key, text]) => (
                  <option key={key} value={key}>
                    {text}
                  </option>
                ))}
              </select>
              <div className="actions">
                <button disabled={busy} onClick={() => void load()}>
                  بحث وتحديث
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    editEpoch.current++;
                    setSelected(null);
                    setPayload(emptyPayload());
                    setSkillText("");
                    setDirty(false);
                    setNotice("مسودة جديدة غير محفوظة.");
                  }}
                >
                  مسألة جديدة
                </button>
              </div>
              <div className="lesson-list">
                {items.map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={selected?.id === item.id}
                    onClick={() => open(item)}
                    disabled={busy}
                  >
                    <strong>{item.payload.titleAr}</strong>
                    <small>
                      {item.payload.unitTitleAr} / {item.payload.lessonTitleAr}
                    </small>
                    <small>
                      {item.payload.skillCodes.join(" · ")} · الصعوبة{" "}
                      {item.payload.difficulty.toLocaleString("ar")}
                    </small>
                    <span>
                      {statuses[item.status]} · إصدار{" "}
                      {item.version.toLocaleString("ar")}
                    </span>
                  </button>
                ))}
              </div>
              {!items.length && <p>لا توجد مسائل في القائمة الحالية.</p>}
            </aside>
            <div className="product-card">
              <div className="card-heading">
                <h2>{selected ? selected.payload.titleAr : "إنشاء مسألة"}</h2>
                {selected && (
                  <span className="badge">
                    {statuses[selected.status]} · v{selected.version}
                  </span>
                )}
              </div>
              {!editable && (
                <p className="test-banner">
                  هذه نسخة محفوظة خارج المسودة. أنشئ إصدارًا جديدًا لتعديلها دون
                  تغيير المحاولات السابقة.
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <fieldset
                  disabled={busy || !editable}
                  className="studio-fields"
                >
                  <legend>المادة والدرس</legend>
                  <label htmlFor="studio-subject">المادة</label>
                  <select
                    id="studio-subject"
                    value={payload.subject}
                    onChange={(e) => {
                      const subject = subjectField(e.target.value);
                      setSkillText("");
                      change({
                        ...emptyPayload(subject),
                        titleAr: payload.titleAr,
                        statementAr: payload.statementAr,
                      });
                    }}
                  >
                    <option value="algebra">الجبر</option>
                    <option value="physics">الفيزياء</option>
                    <option value="programming">Python</option>
                  </select>
                  <div className="product-grid">
                    <Field
                      id="unit-code"
                      label="رمز الوحدة الثابت"
                      value={payload.unitCode}
                      onChange={(unitCode) => change({ ...payload, unitCode })}
                      code
                    />
                    <Field
                      id="unit-title"
                      label="اسم الوحدة بالعربية"
                      value={payload.unitTitleAr}
                      onChange={(unitTitleAr) =>
                        change({ ...payload, unitTitleAr })
                      }
                    />
                    <Field
                      id="lesson-code"
                      label="رمز الدرس"
                      value={payload.lessonCode}
                      onChange={(lessonCode) =>
                        change({ ...payload, lessonCode })
                      }
                      code
                    />
                    <Field
                      id="lesson-title"
                      label="اسم الدرس"
                      value={payload.lessonTitleAr}
                      onChange={(lessonTitleAr) =>
                        change({ ...payload, lessonTitleAr })
                      }
                    />
                  </div>
                  <Field
                    id="content-title"
                    label="عنوان المسألة"
                    value={payload.titleAr}
                    onChange={(titleAr) => change({ ...payload, titleAr })}
                  />
                  <Field
                    id="content-statement"
                    label="نص المسألة بالعربية"
                    value={payload.statementAr}
                    onChange={(statementAr) =>
                      change({ ...payload, statementAr })
                    }
                    multiline
                  />
                  <Field
                    id="skill-codes"
                    label="رموز المهارات (افصل بفاصلة)"
                    value={skillText}
                    onChange={(value) => {
                      setSkillText(value);
                      change({
                        ...payload,
                        skillCodes: value
                          .split(/[,،]/)
                          .map((x) => x.trim())
                          .filter(Boolean),
                      });
                    }}
                    code
                  />
                  <Field
                    id="family-code"
                    label="رمز عائلة المسألة للعلاج والنقل"
                    value={payload.familyCode}
                    onChange={(familyCode) =>
                      change({ ...payload, familyCode })
                    }
                    code
                  />
                  <div className="product-grid">
                    <div>
                      <label htmlFor="content-difficulty">الصعوبة</label>
                      <select
                        id="content-difficulty"
                        value={payload.difficulty}
                        onChange={(e) => {
                          const difficulty = Number(e.target.value);
                          if (
                            difficulty === 1 ||
                            difficulty === 2 ||
                            difficulty === 3
                          )
                            change({ ...payload, difficulty });
                        }}
                      >
                        <option value={1}>تمهيدية</option>
                        <option value={2}>متوسطة</option>
                        <option value={3}>تحدٍّ بسيط</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="content-kind">دور المسألة</label>
                      <select
                        id="content-kind"
                        value={payload.kind}
                        onChange={(e) =>
                          change({
                            ...payload,
                            kind: enumField(e.target.value, [
                              "main",
                              "remediation",
                              "transfer",
                            ]),
                          })
                        }
                      >
                        <option value="main">مسألة درس</option>
                        <option value="remediation">تدريب علاجي</option>
                        <option value="transfer">نقل فهم مستقل</option>
                      </select>
                    </div>
                  </div>
                  {payload.algebra && (
                    <fieldset>
                      <legend>مرجع التحقق الجبري</legend>
                      <MathInput
                        id="studio-equation"
                        value={payload.algebra.equationRaw}
                        onChange={(equationRaw) =>
                          change({
                            ...payload,
                            algebra: { ...payload.algebra!, equationRaw },
                          })
                        }
                      />
                      <Field
                        id="algebra-answer"
                        label="الحل المرجعي (مثل س = ٢)"
                        value={payload.algebra.answerRaw}
                        onChange={(answerRaw) =>
                          change({
                            ...payload,
                            algebra: { ...payload.algebra!, answerRaw },
                          })
                        }
                        code
                      />
                      <Field
                        id="algebra-valid"
                        label="مثال انتقال صحيح"
                        value={payload.algebra.validStepRaw}
                        onChange={(validStepRaw) =>
                          change({
                            ...payload,
                            algebra: { ...payload.algebra!, validStepRaw },
                          })
                        }
                        code
                      />
                      <Field
                        id="algebra-invalid"
                        label="مثال انتقال خاطئ"
                        value={payload.algebra.invalidStepRaw}
                        onChange={(invalidStepRaw) =>
                          change({
                            ...payload,
                            algebra: { ...payload.algebra!, invalidStepRaw },
                          })
                        }
                        code
                      />
                    </fieldset>
                  )}
                  {payload.physics && (
                    <fieldset>
                      <legend>القيمة والوحدة والقيود الفيزيائية</legend>
                      <label htmlFor="physics-formula">العلاقة</label>
                      <select
                        id="physics-formula"
                        value={payload.physics.formula}
                        onChange={(e) =>
                          change({
                            ...payload,
                            physics: formulaContent(
                              payload.physics!,
                              enumField(e.target.value, [
                                "constant_speed_distance",
                                "constant_velocity_displacement",
                                "average_speed",
                                "average_velocity",
                                "final_velocity",
                                "displacement",
                                "acceleration",
                                "elapsed_time",
                              ]),
                            ),
                          })
                        }
                      >
                        {[
                          ["constant_speed_distance", "المسافة بسرعة ثابتة"],
                          [
                            "constant_velocity_displacement",
                            "الإزاحة بسرعة ثابتة",
                          ],
                          ["average_speed", "السرعة المتوسطة"],
                          ["average_velocity", "السرعة المتجهة المتوسطة"],
                          ["final_velocity", "السرعة النهائية"],
                          ["displacement", "الإزاحة بتسارع ثابت"],
                          ["acceleration", "التسارع"],
                          ["elapsed_time", "الزمن"],
                        ].map(([code, title]) => (
                          <option key={code} value={code}>
                            {title}
                          </option>
                        ))}
                      </select>
                      <div className="product-grid">
                        <div>
                          <label htmlFor="physics-quantity">
                            الكمية المطلوبة
                          </label>
                          <select
                            id="physics-quantity"
                            value={payload.physics.quantity}
                            onChange={(e) =>
                              change({
                                ...payload,
                                physics: {
                                  ...payload.physics!,
                                  quantity: enumField(e.target.value, [
                                    "distance",
                                    "displacement",
                                    "speed",
                                    "velocity",
                                    "acceleration",
                                    "time",
                                  ]),
                                },
                              })
                            }
                          >
                            {[
                              "distance",
                              "displacement",
                              "speed",
                              "velocity",
                              "acceleration",
                              "time",
                            ].map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="physics-dimension">
                            البعد المرجعي
                          </label>
                          <select
                            id="physics-dimension"
                            value={payload.physics.expectedDimension}
                            onChange={(e) =>
                              change({
                                ...payload,
                                physics: {
                                  ...payload.physics!,
                                  expectedDimension: enumField(e.target.value, [
                                    "length",
                                    "time",
                                    "speed",
                                    "acceleration",
                                  ]),
                                },
                              })
                            }
                          >
                            {["length", "time", "speed", "acceleration"].map(
                              (v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      </div>
                      <Field
                        id="physics-reference-value"
                        label="القيمة المرجعية بوحدات SI"
                        value={payload.physics.expectedValueSI}
                        onChange={(expectedValueSI) =>
                          change({
                            ...payload,
                            physics: { ...payload.physics!, expectedValueSI },
                          })
                        }
                        code
                      />
                      <label htmlFor="physics-reference-unit">
                        الوحدة المرجعية
                      </label>
                      <select
                        id="physics-reference-unit"
                        dir="ltr"
                        value={payload.physics.expectedUnit}
                        onChange={(e) =>
                          change({
                            ...payload,
                            physics: {
                              ...payload.physics!,
                              expectedUnit: enumField(e.target.value, [
                                "m",
                                "s",
                                "m/s",
                                "m/s²",
                                "km/h",
                              ]),
                            },
                          })
                        }
                      >
                        {["m", "s", "m/s", "m/s²", "km/h"].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <Field
                        id="physics-tolerance"
                        label="التسامح العددي"
                        value={payload.physics.tolerance}
                        onChange={(tolerance) =>
                          change({
                            ...payload,
                            physics: { ...payload.physics!, tolerance },
                          })
                        }
                        code
                      />
                      <h3>المعطيات</h3>
                      {Object.entries(payload.physics.givens).map(
                        ([key, value]) => (
                          <div key={key} className="given-editor">
                            <label htmlFor={"given-" + key}>
                              {givenLabels[key] ?? key}{" "}
                              <bdi dir="ltr">({key})</bdi>
                            </label>
                            <input
                              id={"given-" + key}
                              dir="ltr"
                              value={value}
                              onChange={(e) =>
                                change({
                                  ...payload,
                                  physics: {
                                    ...payload.physics!,
                                    givens: {
                                      ...payload.physics!.givens,
                                      [key]: e.target.value,
                                    },
                                  },
                                })
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                change({
                                  ...payload,
                                  physics: {
                                    ...payload.physics!,
                                    givens: Object.fromEntries(
                                      Object.entries(
                                        payload.physics!.givens,
                                      ).filter(([name]) => name !== key),
                                    ),
                                  },
                                })
                              }
                            >
                              احذف المعطى
                            </button>
                          </div>
                        ),
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const key = ["d", "dx", "v", "v0", "a", "t"].find(
                            (key) => payload.physics!.givens[key] === undefined,
                          );
                          if (!key) return;
                          change({
                            ...payload,
                            physics: {
                              ...payload.physics!,
                              givens: {
                                ...payload.physics!.givens,
                                [key]: "",
                              },
                            },
                          });
                        }}
                      >
                        أضف معطى
                      </button>
                      <p className="helper">
                        تُكتب المعطيات بوحدات SI. يهيئ اختيار العلاقة المعطيات
                        المطلوبة؛ يُرفض المرجع المتعارض عند التحقق.
                      </p>
                      <label className="check-line">
                        <input
                          type="checkbox"
                          checked={
                            payload.physics.constraints?.nonNegativeAnswer ??
                            false
                          }
                          onChange={(e) =>
                            change({
                              ...payload,
                              physics: {
                                ...payload.physics!,
                                constraints: {
                                  nonNegativeAnswer: e.target.checked,
                                },
                              },
                            })
                          }
                        />{" "}
                        الإجابة غير سالبة وفق سياق هذه المسألة
                      </label>
                    </fieldset>
                  )}
                  {payload.programming && (
                    <fieldset>
                      <legend>تمرين Python واختباراته المحمية</legend>
                      <Field
                        id="python-starter"
                        label="بداية الكود للطالب"
                        value={payload.programming.starterCode}
                        onChange={(starterCode) =>
                          change({
                            ...payload,
                            programming: {
                              ...payload.programming!,
                              starterCode,
                            },
                          })
                        }
                        multiline
                        code
                      />
                      <Field
                        id="python-reference"
                        label="الحل المرجعي — لا يظهر للطالب"
                        value={payload.programming.referenceCode}
                        onChange={(referenceCode) =>
                          change({
                            ...payload,
                            programming: {
                              ...payload.programming!,
                              referenceCode,
                            },
                          })
                        }
                        multiline
                        code
                      />
                      <Field
                        id="python-function"
                        label="اسم الدالة إن كان الاختبار دالة (اختياري)"
                        value={payload.programming.functionName ?? ""}
                        onChange={(functionName) =>
                          change({
                            ...payload,
                            programming: {
                              ...payload.programming!,
                              functionName: functionName || undefined,
                            },
                          })
                        }
                        code
                      />
                      <h3>حالات الاختبار</h3>
                      {payload.programming.tests.map((test, index) => (
                        <fieldset key={index}>
                          <legend>
                            الحالة {(index + 1).toLocaleString("ar")}
                          </legend>
                          <Field
                            id={"test-input-" + index}
                            label="المدخل"
                            value={test.input}
                            onChange={(input) =>
                              change({
                                ...payload,
                                programming: {
                                  ...payload.programming!,
                                  tests: payload.programming!.tests.map(
                                    (t, i) =>
                                      i === index ? { ...t, input } : t,
                                  ),
                                },
                              })
                            }
                            multiline
                            code
                          />
                          <Field
                            id={"test-output-" + index}
                            label="المخرج المتوقع"
                            value={test.expectedOutput}
                            onChange={(expectedOutput) =>
                              change({
                                ...payload,
                                programming: {
                                  ...payload.programming!,
                                  tests: payload.programming!.tests.map(
                                    (t, i) =>
                                      i === index
                                        ? { ...t, expectedOutput }
                                        : t,
                                  ),
                                },
                              })
                            }
                            multiline
                            code
                          />
                          <label className="check-line">
                            <input
                              type="checkbox"
                              checked={test.hidden}
                              onChange={(e) =>
                                change({
                                  ...payload,
                                  programming: {
                                    ...payload.programming!,
                                    tests: payload.programming!.tests.map(
                                      (t, i) =>
                                        i === index
                                          ? { ...t, hidden: e.target.checked }
                                          : t,
                                    ),
                                  },
                                })
                              }
                            />{" "}
                            اختبار مخفي عن الطالب
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              change({
                                ...payload,
                                programming: {
                                  ...payload.programming!,
                                  tests: payload.programming!.tests.filter(
                                    (_, i) => i !== index,
                                  ),
                                },
                              })
                            }
                          >
                            احذف الحالة
                          </button>
                        </fieldset>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          change({
                            ...payload,
                            programming: {
                              ...payload.programming!,
                              tests: [
                                ...payload.programming!.tests,
                                { input: "", expectedOutput: "", hidden: true },
                              ],
                            },
                          })
                        }
                      >
                        أضف اختبارًا
                      </button>
                      <p className="helper">
                        لن يُنشر التمرين حتى يجتاز الحل المرجعي جميع الاختبارات
                        في خدمة التشغيل المعزولة.
                      </p>
                    </fieldset>
                  )}
                  <fieldset>
                    <legend>التلميحات المتدرجة</legend>
                    {payload.hints.map((hint, index) => (
                      <div key={index} className="hint-editor">
                        <Field
                          id={"content-hint-" + index}
                          label={
                            "H" +
                            hint.level +
                            (hint.level === 4
                              ? " — شرح كامل بتأكيد صريح"
                              : " — تلميح تدريجي")
                          }
                          value={hint.textAr}
                          onChange={(textAr) =>
                            change({
                              ...payload,
                              hints: payload.hints.map((h, i) =>
                                i === index
                                  ? { ...h, textAr, reviewed: false }
                                  : h,
                              ),
                            })
                          }
                          multiline
                        />
                        <div className="actions">
                          {payload.subject === "algebra" && (
                            <>
                              <label>
                                نمط الخطأ{" "}
                                <select
                                  value={hint.errorCode ?? ""}
                                  onChange={(e) =>
                                    change({
                                      ...payload,
                                      hints: payload.hints.map((h, i) =>
                                        i === index
                                          ? {
                                              ...h,
                                              errorCode:
                                                e.target.value === ""
                                                  ? null
                                                  : enumField(
                                                      e.target.value,
                                                      algebraErrorCodes,
                                                    ),
                                              reviewed: false,
                                            }
                                          : h,
                                      ),
                                    })
                                  }
                                >
                                  <option value="">عام — دون تشخيص محدد</option>
                                  {algebraErrorCodes.map((code) => (
                                    <option
                                      key={code}
                                      value={code}
                                      disabled={payload.hints.some(
                                        (h, i) =>
                                          i !== index &&
                                          h.level === hint.level &&
                                          h.errorCode === code,
                                      )}
                                    >
                                      {code}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {!!hint.errorCode && (
                                <>
                                  <label>
                                    المستوى{" "}
                                    <select
                                      value={hint.level}
                                      onChange={(e) =>
                                        change({
                                          ...payload,
                                          hints: payload.hints.map((h, i) =>
                                            i === index
                                              ? {
                                                  ...h,
                                                  level: Number(
                                                    e.target.value,
                                                  ) as 1 | 2 | 3 | 4,
                                                  reviewed: false,
                                                }
                                              : h,
                                          ),
                                        })
                                      }
                                    >
                                      {([1, 2, 3, 4] as const).map((level) => (
                                        <option
                                          key={level}
                                          value={level}
                                          disabled={payload.hints.some(
                                            (h, i) =>
                                              i !== index &&
                                              h.level === level &&
                                              h.errorCode === hint.errorCode,
                                          )}
                                        >
                                          H{level}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      change({
                                        ...payload,
                                        hints: payload.hints.filter(
                                          (_, i) => i !== index,
                                        ),
                                      })
                                    }
                                  >
                                    احذف التلميح المخصص
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          <label>
                            المصدر{" "}
                            <select
                              value={hint.source}
                              onChange={(e) =>
                                change({
                                  ...payload,
                                  hints: payload.hints.map((h, i) =>
                                    i === index
                                      ? {
                                          ...h,
                                          source: enumField(e.target.value, [
                                            "manual",
                                            "ai_suggested",
                                          ]),
                                          reviewed: false,
                                        }
                                      : h,
                                  ),
                                })
                              }
                            >
                              <option value="manual">كتابة يدوية</option>
                              <option value="ai_suggested">اقتراح AI</option>
                            </select>
                          </label>
                          <label className="check-line">
                            <input
                              type="checkbox"
                              checked={hint.reviewed}
                              onChange={(e) =>
                                change({
                                  ...payload,
                                  hints: payload.hints.map((h, i) =>
                                    i === index
                                      ? { ...h, reviewed: e.target.checked }
                                      : h,
                                  ),
                                })
                              }
                            />{" "}
                            راجعت النص وحدود كشف الإجابة
                          </label>
                        </div>
                      </div>
                    ))}
                    {payload.subject === "algebra" && (
                      <button
                        type="button"
                        disabled={payload.hints.length >= 28}
                        onClick={() => {
                          const next = algebraErrorCodes
                            .flatMap((errorCode) =>
                              ([1, 2, 3, 4] as const).map((level) => ({
                                errorCode,
                                level,
                              })),
                            )
                            .find(
                              (candidate) =>
                                !payload.hints.some(
                                  (h) =>
                                    h.level === candidate.level &&
                                    h.errorCode === candidate.errorCode,
                                ),
                            );
                          if (next)
                            change({
                              ...payload,
                              hints: [
                                ...payload.hints,
                                {
                                  ...next,
                                  textAr: "",
                                  source: "manual",
                                  reviewed: false,
                                },
                              ],
                            });
                        }}
                      >
                        أضف تلميحًا مخصصًا لنمط خطأ
                      </button>
                    )}
                    {payload.subject === "algebra" && (
                      <p className="helper">
                        يُستخدم القالب المخصص عند توافق التشخيص مع نمطه؛ أبقِ
                        التلميحات العامة للحالات غير المحسومة. يجب أن يرتبط
                        النمط بكتالوج المهارة المراجع قبل النشر.
                      </p>
                    )}
                  </fieldset>
                </fieldset>
                <div className="actions">
                  <button
                    className="primary"
                    type="submit"
                    disabled={busy || !editable || (!dirty && !!selected)}
                  >
                    احفظ المسودة
                  </button>
                  {selected?.status === "draft" && (
                    <button
                      type="button"
                      disabled={busy || dirty}
                      onClick={() => void transition("submit")}
                    >
                      تحقق وأرسل للمراجعة
                    </button>
                  )}
                  {selected?.status === "draft" && (
                    <button
                      type="button"
                      disabled={busy || dirty}
                      onClick={() => void removeDraft()}
                    >
                      أزل المسودة من التحرير
                    </button>
                  )}
                  {selected?.status === "in_review" && publisher && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void transition("approve")}
                    >
                      اعتمد بعد المراجعة
                    </button>
                  )}
                  {selected?.status === "approved" && publisher && (
                    <button
                      type="button"
                      className="primary"
                      disabled={busy}
                      onClick={() => void transition("publish")}
                    >
                      انشر للطلاب
                    </button>
                  )}
                  {selected && selected.status !== "draft" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void transition("revise")}
                    >
                      أنشئ إصدارًا جديدًا للتعديل
                    </button>
                  )}
                  {selected?.status === "published" && publisher && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void transition("archive")}
                    >
                      أرشف الإصدار
                    </button>
                  )}
                  {selected &&
                    selected.status === "archived" &&
                    selected.reviewedAt !== null &&
                    publisher && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void transition("rollback")}
                      >
                        انشر هذا الإصدار كرجوع
                      </button>
                    )}
                </div>
                <p className="helper" role="status">
                  {dirty
                    ? "توجد تعديلات لم يؤكد الخادم حفظها بعد."
                    : selected
                      ? "المحتوى المعروض مطابق لآخر رد محفوظ من الخادم."
                      : "المسودة لم تُحفظ بعد."}
                </p>
              </form>
              <details className="content-preview">
                <summary>معاينة ما يراه الطالب</summary>
                <h3>{payload.titleAr}</h3>
                <p>{payload.statementAr}</p>
                {payload.algebra && (
                  <bdi className="math-text" dir="ltr">
                    {payload.algebra.equationRaw}
                  </bdi>
                )}
                {payload.programming && (
                  <pre dir="ltr">{payload.programming.starterCode}</pre>
                )}
                <p className="helper">
                  لا تظهر مراجع الإجابات أو التلميحات غير المطلوبة في معاينة
                  الطالب.
                </p>
              </details>
              {selected?.validation && (
                <section className="content-validation" role="status">
                  <h3>
                    {selected.validation.valid
                      ? "اجتاز مرجع المسألة فحص المحرك"
                      : "يلزم تصحيح المحتوى"}
                  </h3>
                  <ul>
                    {selected.validation.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                  {selected.validation.programming && (
                    <div>
                      <p>
                        الاختبارات العلنية:{" "}
                        {selected.validation.programming.public.passed.toLocaleString(
                          "ar",
                        )}{" "}
                        من{" "}
                        {selected.validation.programming.public.total.toLocaleString(
                          "ar",
                        )}{" "}
                        · الاختبارات المخفية:{" "}
                        {selected.validation.programming.hidden.passed.toLocaleString(
                          "ar",
                        )}{" "}
                        من{" "}
                        {selected.validation.programming.hidden.total.toLocaleString(
                          "ar",
                        )}
                      </p>
                      <div className="table-scroll">
                        <table>
                          <caption>
                            نتائج فحص الحل المرجعي للمؤلف والمراجع
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">الحالة</th>
                              <th scope="col">النوع</th>
                              <th scope="col">التنفيذ</th>
                              <th scope="col">النتيجة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.validation.programming.cases.map((c) => (
                              <tr key={c.index}>
                                <th scope="row">
                                  {(c.index + 1).toLocaleString("ar")}
                                </th>
                                <td>
                                  {c.visibility === "public" ? "علني" : "مخفي"}
                                </td>
                                <td>{runnerLabels[c.status]}</td>
                                <td>
                                  {!c.executed
                                    ? "لم يُنفذ"
                                    : c.passed
                                      ? "اجتاز"
                                      : "لم يجتز"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="helper">
                        الحالة التي لم تُنفذ لا تُعد اجتيازًا. هذه التفاصيل خاصة
                        بمراجعة المحتوى.
                      </p>
                    </div>
                  )}
                  <p className="helper">
                    المحرك: <bdi dir="ltr">{selected.validation.engine}</bdi> ·{" "}
                    {new Date(selected.validation.checkedAt).toLocaleString(
                      "ar",
                    )}
                  </p>
                </section>
              )}
              {selected && (
                <details>
                  <summary>النسخ والبصمة والمراجعة</summary>
                  <p>
                    إصدار {selected.version} · مراجعة تحرير{" "}
                    {selected.editRevision}
                  </p>
                  <p>
                    بصمة المحتوى:{" "}
                    <code className="content-hash">{selected.contentHash}</code>
                  </p>
                  <p>
                    وقت المراجعة:{" "}
                    {selected.reviewedAt
                      ? new Date(selected.reviewedAt).toLocaleString("ar")
                      : "لم يعتمد بعد"}
                  </p>
                  {previous ? (
                    <div className="version-diff">
                      <div>
                        <h3>الإصدار السابق</h3>
                        <pre dir="ltr">
                          {JSON.stringify(previous.payload, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <h3>الإصدار الحالي</h3>
                        <pre dir="ltr">{JSON.stringify(payload, null, 2)}</pre>
                      </div>
                    </div>
                  ) : (
                    <p>
                      حمّل قائمة دون تصفية للاطلاع على الإصدار السابق إن وجد.
                    </p>
                  )}
                </details>
              )}
            </div>
          </div>
          <details className="product-card">
            <summary>استيراد وتصدير JSON</summary>
            <p>
              المعاينة لا تنشئ سجلات. يُحفظ الاستيراد كمسودات معزولة عن بنك
              الطالب حتى المراجعة والنشر.
            </p>
            <label htmlFor="content-import-file">اختر ملف محتوى JSON</label>
            <input
              id="content-import-file"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 256000) {
                  setError(
                    "حجم ملف الاستيراد أكبر من الحد المسموح (٢٥٦ كيلوبايت).",
                  );
                  return;
                }
                void file
                  .text()
                  .then((value) => {
                    setImportText(value);
                    setPreview(null);
                  })
                  .catch(() => setError("تعذر قراءة الملف."));
              }}
            />
            <Field
              id="content-import-json"
              label="JSON للمراجعة قبل الاستيراد"
              value={importText}
              onChange={(value) => {
                setImportText(value);
                setPreview(null);
              }}
              multiline
              code
            />
            <div className="actions">
              <button
                disabled={busy || !importText}
                onClick={() => void previewImport()}
              >
                عاين دون حفظ
              </button>
              <button
                disabled={
                  busy ||
                  !preview ||
                  preview.rejected > 0 ||
                  preview.accepted === 0
                }
                className="primary"
                onClick={() => void importItems()}
              >
                استورد المسودات المقبولة
              </button>
              <button disabled={busy} onClick={() => void download()}>
                صدّر المحتوى فقط
              </button>
            </div>
            {preview && (
              <div role="status">
                <p>
                  صالح: {preview.accepted.toLocaleString("ar")} · مرفوض:{" "}
                  {preview.rejected.toLocaleString("ar")}
                </p>
                <ul>
                  {preview.results.map((r) => (
                    <li key={r.index}>
                      السجل {(r.index + 1).toLocaleString("ar")}:{" "}
                      {r.valid ? "صالح بنيويًا" : r.issues.join("؛ ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        </>
      )}
    </section>
  );
}
