import { useEffect, useRef, useState } from "react";
import type {
  LearningBankProblem,
  LearningContentPayload,
  LearningContentRevision,
  LearningSkillMap,
  LessonBlock,
  LessonPayload,
  TrackPayload,
} from "../../../packages/contracts/src/learning-paths";
import type {
  ContentStatus,
  PhysicsContent,
} from "../../../packages/contracts/src/product";
import {
  ProductApi,
  type Identity,
  type Subject,
  messageOf,
} from "./product-api";
import {
  bankItems,
  learningItems,
  learningRevision,
  skillMapData,
} from "./learning-path-api";
import { LessonRenderer } from "./LessonRenderer";

const statuses: Record<ContentStatus, string> = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد للنشر",
  published: "منشور",
  archived: "مؤرشف",
};
const subjects: Record<Subject, string> = {
  algebra: "الجبر",
  physics: "الفيزياء",
  programming: "Python",
};
const blockTitles: Record<LessonBlock["type"], string> = {
  paragraph: "فقرة شرح",
  heading: "عنوان",
  math_example: "مثال رياضي",
  worked_steps: "خطوات محلولة",
  key_point: "فكرة أساسية",
  common_mistake: "خطأ شائع",
  practice_link: "رابط تدريب",
  code_example: "مثال كود",
  physics_example: "مثال قيمة ووحدة",
};
function emptyLesson(subject: Subject): LessonPayload {
  return {
    kind: "lesson",
    subject,
    code: "",
    titleAr: "",
    descriptionAr: "",
    objectives: [""],
    skillCodes: [],
    prerequisiteSkillCodes: [],
    prerequisiteLessonIds: [],
    contentBlocks: [{ type: "paragraph", textAr: "" }],
    practiceProblemRevisionIds: [],
    assessmentProblemRevisionIds: [],
    errorCodes: [],
    mappingPending: [],
  };
}
function emptyTrack(subject: Subject): TrackPayload {
  return {
    kind: "track",
    subject,
    code: "",
    titleAr: "",
    descriptionAr: "",
    units: [{ code: "", titleAr: "", lessonRevisionIds: [] }],
  };
}
function moved<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items],
    target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
function toggle(items: string[], value: string): string[] {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}
function Text({
  label,
  value,
  change,
  code = false,
  multiline = false,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
  code?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className="studio-field">
      {label}
      {multiline ? (
        <textarea
          value={value}
          rows={code ? 5 : 3}
          dir={code ? "ltr" : "rtl"}
          className={code ? "code-editor" : undefined}
          onChange={(event) => change(event.target.value)}
        />
      ) : (
        <input
          value={value}
          dir={code ? "ltr" : "rtl"}
          onChange={(event) => change(event.target.value)}
        />
      )}
    </label>
  );
}
const defaultPhysics: PhysicsContent = {
  topic: "kinematics_1d",
  formula: "average_speed",
  quantity: "speed",
  expectedDimension: "speed",
  expectedValueSI: "",
  expectedUnit: "m/s",
  tolerance: "0",
  givens: { d: "", t: "" },
};
const formulaSpecs: Record<
  PhysicsContent["formula"],
  {
    quantity: PhysicsContent["quantity"];
    dimension: PhysicsContent["expectedDimension"];
    unit: PhysicsContent["expectedUnit"];
    givens: string[];
  }
> = {
  constant_speed_distance: {
    quantity: "distance",
    dimension: "length",
    unit: "m",
    givens: ["v", "t"],
  },
  constant_velocity_displacement: {
    quantity: "displacement",
    dimension: "length",
    unit: "m",
    givens: ["v", "t"],
  },
  average_speed: {
    quantity: "speed",
    dimension: "speed",
    unit: "m/s",
    givens: ["d", "t"],
  },
  average_velocity: {
    quantity: "velocity",
    dimension: "speed",
    unit: "m/s",
    givens: ["dx", "t"],
  },
  final_velocity: {
    quantity: "velocity",
    dimension: "speed",
    unit: "m/s",
    givens: ["v0", "a", "t"],
  },
  displacement: {
    quantity: "displacement",
    dimension: "length",
    unit: "m",
    givens: ["v0", "a", "t"],
  },
  acceleration: {
    quantity: "acceleration",
    dimension: "acceleration",
    unit: "m/s²",
    givens: ["v", "v0", "t"],
  },
  elapsed_time: {
    quantity: "time",
    dimension: "time",
    unit: "s",
    givens: ["v", "v0", "a"],
  },
};

export function PathStudio({
  api,
  identity,
}: {
  api: ProductApi;
  identity: Identity | null;
}) {
  const [items, setItems] = useState<LearningContentRevision[]>([]),
    [lessonOptions, setLessonOptions] = useState<LearningContentRevision[]>([]),
    [selected, setSelected] = useState<LearningContentRevision | null>(null),
    [payload, setPayload] = useState<LearningContentPayload>(() =>
      emptyLesson("algebra"),
    ),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [subject, setSubject] = useState<Subject>("algebra"),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [map, setMap] = useState<LearningSkillMap | null>(null),
    [bank, setBank] = useState<LearningBankProblem[]>([]),
    [bankSkill, setBankSkill] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [query, setQuery] = useState("");
  const epoch = useRef(0),
    pending = useRef(0),
    listVersion = useRef(0),
    bankVersion = useRef(0),
    authorized =
      !!identity?.user &&
      ["teacher", "content_manager", "admin"].includes(identity.user.role),
    publisher = identity?.user?.role === "admin";
  const editable = !selected || selected.status === "draft";
  async function work(action: () => Promise<void>) {
    pending.current++;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      pending.current--;
      setBusy(pending.current > 0);
    }
  }
  async function load() {
    const version = ++listVersion.current;
    const filters = new URLSearchParams({ subject });
    if (status) filters.set("status", status);
    if (kind) filters.set("kind", kind);
    const [next, lessons] = await Promise.all([
      api.request("/studio/learning-content?" + filters, learningItems),
      api.request(
        "/studio/learning-content?" +
          new URLSearchParams({ subject, kind: "lesson" }),
        learningItems,
      ),
    ]);
    if (version === listVersion.current) {
      setItems(next);
      setLessonOptions(lessons);
    }
  }
  async function loadBank() {
    const version = ++bankVersion.current;
    const filters = new URLSearchParams({ subject: payload.subject });
    if (bankSkill) filters.set("skillCode", bankSkill);
    if (difficulty) filters.set("difficulty", difficulty);
    const next = await api.request(
      "/studio/learning-bank?" + filters,
      bankItems,
    );
    if (version === bankVersion.current) setBank(next);
  }
  useEffect(() => {
    if (authorized)
      void work(async () => {
        await load();
        setMap(await api.request("/learning/skill-map", skillMapData));
      });
  }, [authorized, subject, status, kind]);
  useEffect(() => {
    if (authorized) void work(loadBank);
  }, [authorized, payload.subject, bankSkill, difficulty]);
  function change(next: LearningContentPayload) {
    epoch.current++;
    setPayload(next);
    setDirty(true);
  }
  function open(item: LearningContentRevision) {
    epoch.current++;
    setSelected(item);
    setPayload(structuredClone(item.payload));
    setDirty(false);
    setNotice("");
    setError("");
  }
  function create(nextKind: "lesson" | "track") {
    epoch.current++;
    setSelected(null);
    setPayload(
      nextKind === "lesson" ? emptyLesson(subject) : emptyTrack(subject),
    );
    setDirty(true);
    setNotice("مسودة جديدة؛ لن يراها الطالب قبل المراجعة والنشر.");
  }
  async function save() {
    const before = epoch.current;
    await work(async () => {
      const saved = await api.request(
        selected
          ? `/studio/learning-content/${selected.id}`
          : "/studio/learning-content",
        learningRevision,
        selected ? "PUT" : "POST",
        selected
          ? { expectedRevision: selected.editRevision, payload }
          : payload,
      );
      if (epoch.current === before) {
        open(saved);
        setNotice(
          "حُفظت المسودة. راجعها ثم تحقّق من أمثلتها قبل طلب الاعتماد.",
        );
      }
      await load();
    });
  }
  async function action(
    name: "validate" | "submit" | "approve" | "publish" | "archive" | "revise",
  ) {
    if (!selected) return;
    await work(async () => {
      const next = await api.request(
        `/studio/learning-content/${selected.id}/${name === "validate" ? "validate" : "transition"}`,
        learningRevision,
        "POST",
        {
          expectedRevision: selected.editRevision,
          ...(name === "validate" ? {} : { action: name }),
        },
      );
      open(next);
      setNotice(
        name === "revise"
          ? "أُنشئت مسودة إصدار جديد؛ تبقى الجلسات السابقة مرتبطة بإصدارها."
          : "حُفظت العملية وفق صلاحية حسابك. فحص المحرك لا يحل محل المراجعة التربوية.",
      );
      await load();
    });
  }
  function blockChange(index: number, block: LessonBlock) {
    if (payload.kind === "lesson")
      change({
        ...payload,
        contentBlocks: payload.contentBlocks.map((item, i) =>
          i === index ? block : item,
        ),
      });
  }
  const availableLessons = lessonOptions.filter(
    (item) => item.payload.subject === payload.subject,
  );
  const visibleBank = bank.filter(
    (problem) =>
      !query ||
      (
        problem.titleAr +
        " " +
        problem.statementAr +
        " " +
        problem.skillCodes.join(" ")
      ).includes(query),
  );
  const legalSkills =
    map?.skills.filter((skill) =>
      payload.subject === "algebra"
        ? skill.skillCode.startsWith("SK-ALG-")
        : payload.subject === "physics"
          ? /PHY|PHYS/i.test(skill.skillCode)
          : /PY|PROG/i.test(skill.skillCode),
    ) ?? [];
  if (!authorized)
    return (
      <div className="product-card">
        <h2>يلزم حساب مخوّل لتأليف المسارات</h2>
        <p>الصلاحيات والمراجعة والنشر يفحصها الخادم في كل عملية.</p>
      </div>
    );
  return (
    <section
      className="path-studio"
      aria-label="المسارات والدروس"
      aria-busy={busy}
    >
      <p>
        المحتوى الجديد مسودة. الناشر المخوّل يعتمد النسخة بعد المراجعة، ولا يعني
        اجتياز المحرك اعتماد الشرح تربويًا.
      </p>
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
          <h2>المسارات والدروس وإصداراتها</h2>
          <label>
            المادة
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value as Subject)}
            >
              {Object.entries(subjects).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            النوع
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="">الكل</option>
              <option value="lesson">دروس</option>
              <option value="track">مسارات</option>
            </select>
          </label>
          <label>
            الحالة
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">كل الحالات</option>
              {Object.entries(statuses).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button disabled={busy} onClick={() => create("lesson")}>
              درس جديد
            </button>
            <button disabled={busy} onClick={() => create("track")}>
              مسار جديد
            </button>
            <button disabled={busy} onClick={() => void work(load)}>
              حدّث القائمة
            </button>
          </div>
          <button
            disabled={busy}
            onClick={() =>
              void work(async () => {
                const drafts = await api.request(
                  "/studio/learning-content/seed",
                  learningItems,
                  "POST",
                  {},
                );
                await load();
                setNotice(
                  `أُعدّت ${drafts.length.toLocaleString("ar")} نسخة للمراجعة؛ لم تُنشر تلقائيًا.`,
                );
              })
            }
          >
            أعدّ حزم V2.2 كمسودات
          </button>
          {!items.length && <p>لا توجد نسخ تطابق التصفية.</p>}
          <ul className="path-studio-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  disabled={busy}
                  className={selected?.id === item.id ? "selected" : ""}
                  onClick={() => open(item)}
                >
                  {item.payload.kind === "track" ? "مسار" : "درس"} ·{" "}
                  {item.payload.titleAr}
                  <small>
                    إصدار {item.version.toLocaleString("ar")} ·{" "}
                    {statuses[item.status]}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="product-card">
          <h2>{payload.kind === "lesson" ? "تأليف الدرس" : "تنظيم المسار"}</h2>
          <fieldset disabled={busy || !editable} className="path-editor">
            <legend>
              {selected
                ? `الإصدار ${selected.version.toLocaleString("ar")} — ${statuses[selected.status]}`
                : "مسودة جديدة"}
            </legend>
            <Text
              label="رمز ثابت للمحتوى"
              value={payload.code}
              code
              change={(code) => change({ ...payload, code })}
            />
            <Text
              label="العنوان"
              value={payload.titleAr}
              change={(titleAr) => change({ ...payload, titleAr })}
            />
            <Text
              label="وصف مختصر"
              value={payload.descriptionAr}
              multiline
              change={(descriptionAr) => change({ ...payload, descriptionAr })}
            />
            {payload.kind === "track" ? (
              <>
                <h3>الوحدات بالترتيب</h3>
                {payload.units.map((unit, unitIndex) => (
                  <fieldset key={unitIndex}>
                    <legend>وحدة {(unitIndex + 1).toLocaleString("ar")}</legend>
                    <Text
                      label="رمز الوحدة"
                      value={unit.code}
                      code
                      change={(code) =>
                        change({
                          ...payload,
                          units: payload.units.map((item, i) =>
                            i === unitIndex ? { ...unit, code } : item,
                          ),
                        })
                      }
                    />
                    <Text
                      label="عنوان الوحدة"
                      value={unit.titleAr}
                      change={(titleAr) =>
                        change({
                          ...payload,
                          units: payload.units.map((item, i) =>
                            i === unitIndex ? { ...unit, titleAr } : item,
                          ),
                        })
                      }
                    />
                    <ol>
                      {unit.lessonRevisionIds.map((id, lessonIndex) => (
                        <li key={id}>
                          {items.find((item) => item.id === id)?.payload
                            .titleAr ?? id}
                          <div className="actions">
                            <button
                              disabled={lessonIndex === 0}
                              onClick={() =>
                                change({
                                  ...payload,
                                  units: payload.units.map((item, i) =>
                                    i === unitIndex
                                      ? {
                                          ...unit,
                                          lessonRevisionIds: moved(
                                            unit.lessonRevisionIds,
                                            lessonIndex,
                                            -1,
                                          ),
                                        }
                                      : item,
                                  ),
                                })
                              }
                            >
                              الدرس لأعلى
                            </button>
                            <button
                              disabled={
                                lessonIndex ===
                                unit.lessonRevisionIds.length - 1
                              }
                              onClick={() =>
                                change({
                                  ...payload,
                                  units: payload.units.map((item, i) =>
                                    i === unitIndex
                                      ? {
                                          ...unit,
                                          lessonRevisionIds: moved(
                                            unit.lessonRevisionIds,
                                            lessonIndex,
                                            1,
                                          ),
                                        }
                                      : item,
                                  ),
                                })
                              }
                            >
                              الدرس لأسفل
                            </button>
                            <button
                              onClick={() =>
                                change({
                                  ...payload,
                                  units: payload.units.map((item, i) =>
                                    i === unitIndex
                                      ? {
                                          ...unit,
                                          lessonRevisionIds:
                                            unit.lessonRevisionIds.filter(
                                              (value) => value !== id,
                                            ),
                                        }
                                      : item,
                                  ),
                                })
                              }
                            >
                              أزل الربط
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <label>
                      أضف نسخة درس
                      <select
                        value=""
                        onChange={(event) => {
                          if (event.target.value)
                            change({
                              ...payload,
                              units: payload.units.map((item, i) =>
                                i === unitIndex
                                  ? {
                                      ...unit,
                                      lessonRevisionIds: [
                                        ...unit.lessonRevisionIds,
                                        event.target.value,
                                      ],
                                    }
                                  : item,
                              ),
                            });
                        }}
                      >
                        <option value="">اختر من نسخ الدروس</option>
                        {availableLessons
                          .filter(
                            (lesson) =>
                              !unit.lessonRevisionIds.includes(lesson.id),
                          )
                          .map((lesson) => (
                            <option value={lesson.id} key={lesson.id}>
                              {lesson.payload.titleAr} ·{" "}
                              {statuses[lesson.status]} ·{" "}
                              {lesson.version.toLocaleString("ar")}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="actions">
                      <button
                        disabled={unitIndex === 0}
                        onClick={() =>
                          change({
                            ...payload,
                            units: moved(payload.units, unitIndex, -1),
                          })
                        }
                      >
                        الوحدة لأعلى
                      </button>
                      <button
                        disabled={unitIndex === payload.units.length - 1}
                        onClick={() =>
                          change({
                            ...payload,
                            units: moved(payload.units, unitIndex, 1),
                          })
                        }
                      >
                        الوحدة لأسفل
                      </button>
                      <button
                        onClick={() =>
                          change({
                            ...payload,
                            units: payload.units.filter(
                              (_, i) => i !== unitIndex,
                            ),
                          })
                        }
                      >
                        أزل الوحدة
                      </button>
                    </div>
                  </fieldset>
                ))}
                <button
                  onClick={() =>
                    change({
                      ...payload,
                      units: [
                        ...payload.units,
                        { code: "", titleAr: "", lessonRevisionIds: [] },
                      ],
                    })
                  }
                >
                  أضف وحدة
                </button>
                <p className="helper">
                  يمكن ربط المسودات أثناء التأليف؛ يمنع الخادم نشر المسار قبل
                  نشر الدروس المرتبطة.
                </p>
              </>
            ) : (
              <>
                <Text
                  label="أهداف التعلم — هدف في كل سطر"
                  value={payload.objectives.join("\n")}
                  multiline
                  change={(value) =>
                    change({ ...payload, objectives: value.split("\n") })
                  }
                />
                <fieldset>
                  <legend>المهارات القانونية والمقدمات</legend>
                  {!legalSkills.length && (
                    <p>
                      لا توجد مهارات قانونية محمّلة لهذه المادة؛ لا تُخترع رموز
                      جديدة. راجع الحزمة المسودة والمراجع قبل النشر.
                    </p>
                  )}
                  {legalSkills.map((skill) => (
                    <div key={skill.skillCode} className="skill-selection">
                      <label>
                        <input
                          type="checkbox"
                          checked={payload.skillCodes.includes(skill.skillCode)}
                          onChange={() =>
                            change({
                              ...payload,
                              skillCodes: toggle(
                                payload.skillCodes,
                                skill.skillCode,
                              ),
                            })
                          }
                        />
                        {skill.titleAr} <bdi dir="ltr">{skill.skillCode}</bdi>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={payload.prerequisiteSkillCodes.includes(
                            skill.skillCode,
                          )}
                          onChange={() =>
                            change({
                              ...payload,
                              prerequisiteSkillCodes: toggle(
                                payload.prerequisiteSkillCodes,
                                skill.skillCode,
                              ),
                            })
                          }
                        />
                        مقدمة لازمة
                      </label>
                    </div>
                  ))}
                  {payload.skillCodes
                    .filter(
                      (code) =>
                        !legalSkills.some((skill) => skill.skillCode === code),
                    )
                    .map((code) => (
                      <p key={code}>
                        <bdi dir="ltr">{code}</bdi> — ربط محفوظ؛ يتحقق الخادم من
                        مصدره.
                      </p>
                    ))}
                </fieldset>
                <fieldset>
                  <legend>دروس سابقة لازمة</legend>
                  {availableLessons
                    .filter((item) => item.id !== selected?.id)
                    .map((item) => (
                      <label className="check-row" key={item.id}>
                        <input
                          type="checkbox"
                          checked={payload.prerequisiteLessonIds.includes(
                            item.id,
                          )}
                          onChange={() =>
                            change({
                              ...payload,
                              prerequisiteLessonIds: toggle(
                                payload.prerequisiteLessonIds,
                                item.id,
                              ),
                            })
                          }
                        />
                        {item.payload.titleAr} · {statuses[item.status]}
                      </label>
                    ))}
                </fieldset>
                <fieldset>
                  <legend>الشرح والأمثلة</legend>
                  {payload.contentBlocks.map((block, index) => (
                    <fieldset key={index} className="lesson-block-editor">
                      <legend>
                        {(index + 1).toLocaleString("ar")} ·{" "}
                        {blockTitles[block.type]}
                      </legend>
                      <label>
                        نوع الفقرة
                        <select
                          value={block.type}
                          onChange={(event) => {
                            const type = event.target
                              .value as LessonBlock["type"];
                            blockChange(index, {
                              type,
                              textAr: block.textAr,
                              ...(["math_example", "worked_steps"].includes(
                                type,
                              )
                                ? {
                                    raw: "",
                                    steps: [{ raw: "", explanationAr: "" }],
                                  }
                                : {}),
                              ...(type === "code_example" ? { code: "" } : {}),
                              ...(type === "physics_example"
                                ? { physics: structuredClone(defaultPhysics) }
                                : {}),
                            });
                          }}
                        >
                          {Object.entries(blockTitles)
                            .filter(([type]) =>
                              payload.subject === "algebra"
                                ? !["code_example", "physics_example"].includes(
                                    type,
                                  )
                                : payload.subject === "physics"
                                  ? ![
                                      "code_example",
                                      "math_example",
                                      "worked_steps",
                                    ].includes(type)
                                  : ![
                                      "physics_example",
                                      "math_example",
                                      "worked_steps",
                                    ].includes(type),
                            )
                            .map(([type, title]) => (
                              <option key={type} value={type}>
                                {title}
                              </option>
                            ))}
                        </select>
                      </label>
                      <Text
                        label="النص العربي"
                        value={block.textAr}
                        multiline
                        change={(textAr) =>
                          blockChange(index, { ...block, textAr })
                        }
                      />
                      {["math_example", "worked_steps"].includes(
                        block.type,
                      ) && (
                        <>
                          <Text
                            label="المعادلة الأصلية للمثال"
                            code
                            value={block.raw ?? ""}
                            change={(raw) =>
                              blockChange(index, { ...block, raw })
                            }
                          />
                          {block.steps?.map((step, stepIndex) => (
                            <div key={stepIndex} className="worked-step-editor">
                              <Text
                                label={`التحويل ${(stepIndex + 1).toLocaleString("ar")}`}
                                code
                                value={step.raw}
                                change={(raw) =>
                                  blockChange(index, {
                                    ...block,
                                    steps: block.steps!.map((value, i) =>
                                      i === stepIndex
                                        ? { ...step, raw }
                                        : value,
                                    ),
                                  })
                                }
                              />
                              <Text
                                label="تفسير الخطوة"
                                value={step.explanationAr}
                                change={(explanationAr) =>
                                  blockChange(index, {
                                    ...block,
                                    steps: block.steps!.map((value, i) =>
                                      i === stepIndex
                                        ? { ...step, explanationAr }
                                        : value,
                                    ),
                                  })
                                }
                              />
                              <button
                                onClick={() =>
                                  blockChange(index, {
                                    ...block,
                                    steps: block.steps!.filter(
                                      (_, i) => i !== stepIndex,
                                    ),
                                  })
                                }
                              >
                                أزل الخطوة
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              blockChange(index, {
                                ...block,
                                steps: [
                                  ...(block.steps ?? []),
                                  { raw: "", explanationAr: "" },
                                ],
                              })
                            }
                          >
                            أضف خطوة محلولة
                          </button>
                        </>
                      )}
                      {block.type === "code_example" && (
                        <Text
                          label="كود المثال — لا يُشغّل في المتصفح"
                          code
                          multiline
                          value={block.code ?? ""}
                          change={(code) =>
                            blockChange(index, { ...block, code })
                          }
                        />
                      )}
                      {block.type === "practice_link" && (
                        <label>
                          السؤال المرتبط
                          <select
                            value={block.problemRevisionId ?? ""}
                            onChange={(event) =>
                              blockChange(index, {
                                ...block,
                                problemRevisionId: event.target.value,
                              })
                            }
                          >
                            <option value="">اختر سؤالًا منشورًا</option>
                            {bank.map((problem) => (
                              <option
                                value={problem.revisionId}
                                key={problem.revisionId}
                              >
                                {problem.titleAr}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {block.physics && (
                        <>
                          <label>
                            القانون
                            <select
                              value={block.physics.formula}
                              onChange={(event) => {
                                const formula = event.target
                                    .value as PhysicsContent["formula"],
                                  spec = formulaSpecs[formula];
                                blockChange(index, {
                                  ...block,
                                  physics: {
                                    ...block.physics!,
                                    formula,
                                    quantity: spec.quantity,
                                    expectedDimension: spec.dimension,
                                    expectedUnit: spec.unit,
                                    givens: Object.fromEntries(
                                      spec.givens.map((key) => [
                                        key,
                                        block.physics!.givens[key] ?? "",
                                      ]),
                                    ),
                                  },
                                });
                              }}
                            >
                              {Object.keys(formulaSpecs).map((formula) => (
                                <option value={formula} key={formula}>
                                  {formula}
                                </option>
                              ))}
                            </select>
                          </label>
                          {Object.entries(block.physics.givens).map(
                            ([key, value]) => (
                              <Text
                                key={key}
                                label={`المعطى ${key} بوحدة SI`}
                                code
                                value={value}
                                change={(next) =>
                                  blockChange(index, {
                                    ...block,
                                    physics: {
                                      ...block.physics!,
                                      givens: {
                                        ...block.physics!.givens,
                                        [key]: next,
                                      },
                                    },
                                  })
                                }
                              />
                            ),
                          )}
                          <Text
                            label="القيمة المرجعية بوحدة SI"
                            code
                            value={block.physics.expectedValueSI}
                            change={(expectedValueSI) =>
                              blockChange(index, {
                                ...block,
                                physics: { ...block.physics!, expectedValueSI },
                              })
                            }
                          />
                          <Text
                            label="سماحية القيمة"
                            code
                            value={block.physics.tolerance}
                            change={(tolerance) =>
                              blockChange(index, {
                                ...block,
                                physics: { ...block.physics!, tolerance },
                              })
                            }
                          />
                          <label>
                            الوحدة المرجعية
                            <select
                              value={block.physics.expectedUnit}
                              onChange={(event) =>
                                blockChange(index, {
                                  ...block,
                                  physics: {
                                    ...block.physics!,
                                    expectedUnit: event.target
                                      .value as PhysicsContent["expectedUnit"],
                                  },
                                })
                              }
                            >
                              {["m", "s", "m/s", "m/s²", "km/h"].map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}
                      <div className="actions">
                        <button
                          disabled={index === 0}
                          onClick={() =>
                            change({
                              ...payload,
                              contentBlocks: moved(
                                payload.contentBlocks,
                                index,
                                -1,
                              ),
                            })
                          }
                        >
                          لأعلى
                        </button>
                        <button
                          disabled={index === payload.contentBlocks.length - 1}
                          onClick={() =>
                            change({
                              ...payload,
                              contentBlocks: moved(
                                payload.contentBlocks,
                                index,
                                1,
                              ),
                            })
                          }
                        >
                          لأسفل
                        </button>
                        <button
                          onClick={() =>
                            change({
                              ...payload,
                              contentBlocks: payload.contentBlocks.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          أزل الفقرة
                        </button>
                      </div>
                    </fieldset>
                  ))}
                  <button
                    onClick={() =>
                      change({
                        ...payload,
                        contentBlocks: [
                          ...payload.contentBlocks,
                          { type: "paragraph", textAr: "" },
                        ],
                      })
                    }
                  >
                    أضف فقرة
                  </button>
                </fieldset>
                <fieldset>
                  <legend>ربط أنماط الخطأ والتوصية</legend>
                  {payload.subject === "algebra" &&
                    map?.errors.map((entry) => (
                      <label className="check-row" key={entry.errorCode}>
                        <input
                          type="checkbox"
                          checked={payload.errorCodes.includes(entry.errorCode)}
                          disabled={entry.mappingPending}
                          onChange={() =>
                            change({
                              ...payload,
                              errorCodes: toggle(
                                payload.errorCodes,
                                entry.errorCode,
                              ),
                            })
                          }
                        />
                        <bdi dir="ltr">{entry.errorCode}</bdi>{" "}
                        {entry.mappingPending
                          ? "— الربط معلق للمراجعة"
                          : `— ${entry.candidateSkills.join("، ")}`}
                      </label>
                    ))}
                  <p className="helper">
                    GOLD-DIAG-015 وربط ERR-ALG-05/calculation_divide لا يُغلقان
                    تلقائيًا. التوصية احتمالية ولا تثبت ضعفًا دائمًا.
                  </p>
                  <Text
                    label="قضايا ربط معلقة — قضية في كل سطر"
                    value={payload.mappingPending.join("\n")}
                    multiline
                    change={(value) =>
                      change({
                        ...payload,
                        mappingPending: value.split("\n").filter(Boolean),
                      })
                    }
                  />
                </fieldset>
              </>
            )}
          </fieldset>
          {payload.kind === "lesson" && (
            <fieldset disabled={busy || !editable}>
              <legend>بنك الأسئلة المنشورة وربط القياس</legend>
              <p>
                اختر سؤالين أو أكثر للتدريب وسؤالًا مختلفًا للتقييم. لا تمنح
                المشاهدة أو التدريب بالمساعدة دليل فهم مستقل.
              </p>
              <div className="product-grid">
                <label>
                  المهارة
                  <select
                    value={bankSkill}
                    onChange={(event) => setBankSkill(event.target.value)}
                  >
                    <option value="">كل المهارات</option>
                    {legalSkills.map((skill) => (
                      <option key={skill.skillCode} value={skill.skillCode}>
                        {skill.titleAr}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  الصعوبة
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value)}
                  >
                    <option value="">كل الصعوبات</option>
                    {[1, 2, 3].map((level) => (
                      <option key={level} value={level}>
                        {level.toLocaleString("ar")}
                      </option>
                    ))}
                  </select>
                </label>
                <Text
                  label="ابحث في الأسئلة المنشورة"
                  value={query}
                  change={setQuery}
                />
              </div>
              {!visibleBank.length && (
                <p>
                  لا توجد أسئلة منشورة تطابق التصفية. تبقى المراجع المسودة
                  محجوبة حتى اعتمادها ونشرها.
                </p>
              )}
              <div className="path-question-list">
                {visibleBank.map((problem) => (
                  <div key={problem.revisionId} className="lesson-callout">
                    <h4>{problem.titleAr}</h4>
                    <p>{problem.statementAr}</p>
                    <p className="helper">
                      منشور · {problem.primarySkillCode} · صعوبة{" "}
                      {problem.difficulty.toLocaleString("ar")}
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={payload.practiceProblemRevisionIds.includes(
                          problem.revisionId,
                        )}
                        onChange={() =>
                          change({
                            ...payload,
                            practiceProblemRevisionIds: toggle(
                              payload.practiceProblemRevisionIds,
                              problem.revisionId,
                            ),
                          })
                        }
                      />
                      تدريب
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={payload.assessmentProblemRevisionIds.includes(
                          problem.revisionId,
                        )}
                        onChange={() =>
                          change({
                            ...payload,
                            assessmentProblemRevisionIds: toggle(
                              payload.assessmentProblemRevisionIds,
                              problem.revisionId,
                            ),
                          })
                        }
                      />
                      قياس مستقل
                    </label>
                  </div>
                ))}
              </div>
              <p className="helper">
                روابط محفوظة: تدريب{" "}
                {payload.practiceProblemRevisionIds.length.toLocaleString("ar")}{" "}
                · تقييم{" "}
                {payload.assessmentProblemRevisionIds.length.toLocaleString(
                  "ar",
                )}
                . يتحقق الخادم من نشر السؤال وتوافق مادته.
              </p>
            </fieldset>
          )}
          <div className="actions">
            <button
              className="primary"
              disabled={busy || !editable || (!dirty && !!selected)}
              onClick={() => void save()}
            >
              احفظ المسودة
            </button>
            {selected && (
              <button
                disabled={busy || dirty}
                onClick={() => void action("validate")}
              >
                تحقّق من المحتوى بالمحرك
              </button>
            )}
            {selected?.status === "draft" && (
              <button
                disabled={busy || dirty}
                onClick={() => void action("submit")}
              >
                أرسل للمراجعة
              </button>
            )}
            {selected?.status === "in_review" && publisher && (
              <button disabled={busy} onClick={() => void action("approve")}>
                اعتمد بعد مراجعتك التربوية
              </button>
            )}
            {selected?.status === "approved" && publisher && (
              <button disabled={busy} onClick={() => void action("publish")}>
                انشر للطلاب
              </button>
            )}
            {selected && selected.status !== "draft" && (
              <button disabled={busy} onClick={() => void action("revise")}>
                أنشئ إصدارًا جديدًا
              </button>
            )}
            {selected?.status === "published" && publisher && (
              <button disabled={busy} onClick={() => void action("archive")}>
                أرشف دون حذف التاريخ
              </button>
            )}
          </div>
          <p className="helper" role="status">
            {dirty
              ? "توجد تعديلات لم يحفظها الخادم بعد."
              : selected
                ? "مطابق لآخر إصدار محفوظ من الخادم."
                : "لم تُحفظ المسودة بعد."}
          </p>
          <details className="content-preview">
            <summary>معاينة الطالب</summary>
            {payload.kind === "lesson" ? (
              <LessonRenderer
                payload={payload}
                validation={dirty ? null : selected?.validation}
              />
            ) : (
              <>
                <h3>{payload.titleAr}</h3>
                <p>{payload.descriptionAr}</p>
                {payload.units.map((unit, index) => (
                  <div key={index}>
                    <h4>{unit.titleAr}</h4>
                    <ol>
                      {unit.lessonRevisionIds.map((id) => (
                        <li key={id}>
                          {items.find((item) => item.id === id)?.payload
                            .titleAr ?? "نسخة درس مرتبطة"}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </>
            )}
            <p className="helper">
              هذه معاينة للمحتوى المؤلف؛ لا تعرض مفاتيح الأسئلة أو الاختبارات
              المخفية.
            </p>
          </details>
          {selected?.validation && (
            <section className="content-validation" role="status">
              <h3>
                {selected.validation.valid
                  ? "اجتاز التحقق الآلي المحدود"
                  : "يلزم تصحيح المحتوى قبل النشر"}
              </h3>
              <ul>
                {selected.validation.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
              <p className="helper">
                {selected.validation.engine} ·{" "}
                {new Date(selected.validation.checkedAt).toLocaleString("ar")}
              </p>
            </section>
          )}
          {selected && (
            <details>
              <summary>الإصدار والبصمة</summary>
              <p>
                إصدار {selected.version.toLocaleString("ar")} · مراجعة تحرير{" "}
                {selected.editRevision.toLocaleString("ar")}
              </p>
              <code className="content-hash">{selected.contentHash}</code>
              <p>
                {selected.reviewedAt
                  ? `وقت المراجعة: ${new Date(selected.reviewedAt).toLocaleString("ar")}`
                  : "بانتظار المراجعة"}
              </p>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
