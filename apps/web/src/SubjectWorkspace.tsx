import { useEffect, useRef, useState } from "react";
import {
  ProductApi,
  type PublicItem,
  arrayField,
  booleanField,
  messageOf,
  numberField,
  optionalText,
  publicItem,
  record,
  strings,
  textField,
} from "./product-api";
import { continueCodeLine, indentCode } from "./code-editor-model";
import { isPendingExecution, pollExecution } from "./programming-poll";

interface PhysicsProblem {
  id: string;
  revisionId: string;
  titleAr: string;
  statementAr: string;
  lessonTitleAr: string;
  skillCodes: string[];
  givens: Record<string, string>;
  allowedUnits: string[];
  quantity: string;
}
interface PhysicsResult {
  id: string;
  problemRevisionId: string;
  revision: number;
  status: string;
  valueCorrect: boolean | null;
  unitCorrect: boolean | null;
  messageAr: string;
  independentEvidence: boolean;
  assistanceLevel: number;
  diagnosis: { state: string; messageAr: string };
}
interface CodeResult {
  attemptId: string;
  revision: number;
  mode: string;
  status: string;
  stdout: string;
  stderr: string;
  passed: number;
  total: number;
  allPassed: boolean;
  independent: boolean;
  createdAt: string;
}
interface SubjectHint {
  attemptId: string;
  revision: number;
  level: number;
  textAr: string;
  source: string;
  reasonAr: string | null;
}
function physicsProblem(value: unknown): PhysicsProblem {
  const r = record(value);
  return {
    id: textField(r.id),
    revisionId: textField(r.revisionId),
    titleAr: textField(r.titleAr),
    statementAr: textField(r.statementAr),
    lessonTitleAr: textField(r.lessonTitleAr),
    skillCodes: strings(r.skillCodes),
    givens: Object.fromEntries(
      Object.entries(record(r.givens)).map(([k, v]) => [k, textField(v)]),
    ),
    allowedUnits: strings(r.allowedUnits),
    quantity: textField(r.quantity),
  };
}
function physicsResult(value: unknown): PhysicsResult {
  const r = record(value),
    d = record(r.diagnosis);
  return {
    id: textField(r.id),
    problemRevisionId: textField(r.problemRevisionId),
    revision: numberField(r.revision),
    status: textField(r.status),
    valueCorrect: r.valueCorrect === null ? null : booleanField(r.valueCorrect),
    unitCorrect: r.unitCorrect === null ? null : booleanField(r.unitCorrect),
    messageAr: textField(r.messageAr),
    independentEvidence: booleanField(r.independentEvidence),
    assistanceLevel: numberField(r.assistanceLevel),
    diagnosis: { state: textField(d.state), messageAr: textField(d.messageAr) },
  };
}
function codeResult(value: unknown): CodeResult {
  const r = record(value);
  return {
    attemptId: textField(r.attemptId),
    revision: numberField(r.revision),
    mode: textField(r.mode),
    status: textField(r.status),
    stdout: textField(r.stdout),
    stderr: textField(r.stderr),
    passed: numberField(r.passed),
    total: numberField(r.total),
    allPassed: booleanField(r.allPassed),
    independent: booleanField(r.independent),
    createdAt: textField(r.createdAt),
  };
}
function savedProgram(value: unknown) {
  const r = record(value);
  return {
    problem: publicItem(r.problem),
    result: codeResult(r.result),
    sourceRaw: textField(r.sourceRaw),
    assistanceLevel: numberField(r.assistanceLevel),
  };
}
function subjectHint(value: unknown): SubjectHint {
  const r = record(value);
  return {
    attemptId: textField(r.attemptId),
    revision: numberField(r.revision),
    level: numberField(r.level),
    textAr: textField(r.textAr),
    source: textField(r.source),
    reasonAr: optionalText(r.reasonAr),
  };
}
const count = (value: number) => value.toLocaleString("ar");
const codeStatuses: Record<string, string> = {
  queued: "الطلب في الانتظار",
  running: "جارٍ تشغيل الاختبارات",
  succeeded: "اكتمل التشغيل",
  compile_error: "راجع بنية كود Python",
  runtime_error: "حدث خطأ أثناء التشغيل",
  timeout: "انتهت مهلة التشغيل",
  resource_limit: "وصل التشغيل إلى حد الموارد",
  service_error: "خدمة التشغيل غير متاحة الآن",
};

function ProgressiveHelp({
  busy,
  hint,
  level,
  onHint,
}: {
  busy: boolean;
  hint: SubjectHint | null;
  level: number;
  onHint: (level: number, confirm: boolean) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="product-card" aria-labelledby="subject-help">
      <h2 id="subject-help">خطوة مساعدة</h2>
      <p className="helper">
        المساعدة مسجلة؛ الحل بعدها يُعرض بوصفه حلًا مع مساعدة. لا يغيّر التلميح
        حكم محرك التحقق.
      </p>
      <button
        disabled={busy || level >= 3}
        onClick={() => onHint(Math.min(3, level + 1), false)}
      >
        {busy ? "جارٍ طلب المساعدة…" : "أعطني تلميحًا تدريجيًا"}
      </button>
      <details>
        <summary>أحتاج شرح الحل كاملًا</summary>
        <label className="check-line">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            disabled={busy}
          />{" "}
          أفهم أنه سيُسجل مساعدة كاملة.
        </label>
        <button
          disabled={busy || !confirm || level === 4}
          onClick={() => onHint(4, true)}
        >
          أكد طلب الشرح الكامل
        </button>
      </details>
      {hint && (
        <article className="hint-message" role="status">
          <span className="badge">المستوى H{hint.level}</span>
          <p>{hint.textAr}</p>
          {hint.reasonAr && <p className="helper">{hint.reasonAr}</p>}
          <small>
            المصدر:{" "}
            {hint.source === "reviewed_template"
              ? "محتوى مراجع"
              : "صياغة فُحصت خادميًا"}
          </small>
        </article>
      )}
    </section>
  );
}

export function PhysicsWorkspace({
  api,
  selectedRevision,
  resumeAttemptId,
  resumeVersion,
}: {
  api: ProductApi;
  selectedRevision?: string | null;
  resumeAttemptId?: string | null;
  resumeVersion?: number;
}) {
  const [problems, setProblems] = useState<PhysicsProblem[]>([]),
    [problem, setProblem] = useState<PhysicsProblem | null>(null),
    [value, setValue] = useState(""),
    [unit, setUnit] = useState(""),
    [result, setResult] = useState<PhysicsResult | null>(null),
    [hint, setHint] = useState<SubjectHint | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [draftChanged, setDraftChanged] = useState(false);
  const generation = useRef(0);
  const problemIdentity = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    void api
      .request("/physics/problems", (value) =>
        arrayField(record(value).items, physicsProblem),
      )
      .then((items) => {
        if (active) setProblems(items);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [api]);
  useEffect(() => {
    if (resumeAttemptId) void restore(resumeAttemptId);
    else if (selectedRevision) void open(selectedRevision);
  }, [selectedRevision, resumeAttemptId, resumeVersion]);
  async function restore(id: string) {
    setBusy(true);
    setError("");
    const ticket = ++generation.current;
    try {
      const restored = await api.request(`/physics/attempts/${id}`, (value) => {
        const r = record(value);
        return {
          problem: physicsProblem(r.problem),
          result: physicsResult(r.result),
          value: textField(r.value),
          unit: textField(r.unit),
        };
      });
      if (ticket !== generation.current) return;
      problemIdentity.current = restored.problem.revisionId;
      setProblem(restored.problem);
      setResult(restored.result);
      setValue(restored.value);
      setUnit(restored.unit);
      setHint(null);
      setDraftChanged(false);
    } catch (e) {
      if (ticket === generation.current) setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setBusy(true);
    setError("");
    const ticket = ++generation.current;
    try {
      const next = await api.request(
        "/physics/problems/" + encodeURIComponent(id),
        physicsProblem,
      );
      if (ticket !== generation.current) return;
      problemIdentity.current = next.revisionId;
      setProblem(next);
      setValue("");
      setUnit("");
      setResult(null);
      setHint(null);
      setDraftChanged(false);
    } catch (e) {
      if (ticket === generation.current) setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!problem) return;
    setBusy(true);
    setError("");
    const ticket = generation.current;
    try {
      await api.me();
      const next = await api.request(
        "/physics/attempts",
        physicsResult,
        "POST",
        {
          problemRevisionId: problem.revisionId,
          value,
          unit,
          ...(result
            ? { attemptId: result.id, expectedRevision: result.revision }
            : {}),
        },
      );
      if (next.problemRevisionId === problemIdentity.current) {
        setResult(next);
        if (ticket === generation.current) setDraftChanged(false);
      }
    } catch (e) {
      if (ticket === generation.current) setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function help(level: number, confirm: boolean) {
    if (!result) return;
    setBusy(true);
    setError("");
    const ticket = generation.current;
    try {
      const next = await api.request(
        `/physics/attempts/${result.id}/hints`,
        subjectHint,
        "POST",
        {
          level,
          confirmFullSolution: confirm,
          expectedRevision: result.revision,
        },
      );
      if (result.problemRevisionId === problemIdentity.current) {
        if (ticket === generation.current) setHint(next);
        setResult(
          (current) =>
            current && {
              ...current,
              revision: next.revision,
              assistanceLevel: Math.max(current.assistanceLevel, next.level),
              independentEvidence: false,
            },
        );
      }
    } catch (e) {
      if (ticket === generation.current) setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="product-page"
      aria-labelledby="physics-title"
      aria-busy={busy}
    >
      <div className="page-heading">
        <span className="eyebrow">الفيزياء · الحركة في خط مستقيم</span>
        <h1 id="physics-title">قيمة ووحدة ومعنى.</h1>
        <p>
          نراجع القيمة والوحدة بمحرك فيزيائي مستقل. لا يصدر النموذج اللغوي حكم
          صحة الإجابة.
        </p>
      </div>
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      <div className="subject-layout">
        <aside className="product-card">
          <h2>مسائل منشورة</h2>
          {!problems.length && (
            <p>لا توجد مسائل فيزياء منشورة بعد المراجعة حاليًا.</p>
          )}
          <div className="lesson-list">
            {problems.map((p) => (
              <button
                key={p.revisionId}
                aria-pressed={problem?.revisionId === p.revisionId}
                disabled={busy}
                onClick={() => void open(p.revisionId)}
              >
                {p.titleAr}
                <small>{p.lessonTitleAr}</small>
              </button>
            ))}
          </div>
        </aside>
        <div>
          {problem ? (
            <>
              <section className="product-card">
                <h2>{problem.titleAr}</h2>
                <p>{problem.statementAr}</p>
                <dl className="givens-list">
                  {Object.entries(problem.givens).map(([name, quantity]) => (
                    <div key={name}>
                      <dt>
                        <bdi>{name}</bdi>
                      </dt>
                      <dd>
                        <bdi dir="ltr">{quantity}</bdi>
                      </dd>
                    </div>
                  ))}
                </dl>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <div className="quantity-inputs">
                    <div>
                      <label htmlFor="physics-value">القيمة</label>
                      <input
                        id="physics-value"
                        value={value}
                        onChange={(e) => {
                          setValue(e.target.value);
                          setDraftChanged(true);
                          generation.current++;
                        }}
                        dir="ltr"
                        inputMode="decimal"
                        maxLength={64}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="physics-unit">الوحدة</label>
                      <select
                        id="physics-unit"
                        value={unit}
                        onChange={(e) => {
                          setUnit(e.target.value);
                          setDraftChanged(true);
                          generation.current++;
                        }}
                        dir="ltr"
                      >
                        <option value="">اختر الوحدة</option>
                        {[
                          ...new Set([
                            ...problem.allowedUnits,
                            "m",
                            "s",
                            "m/s",
                            "m/s²",
                            "km/h",
                          ]),
                        ].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    className="primary"
                    disabled={busy || !value}
                    type="submit"
                  >
                    {busy ? "جارٍ التحقق…" : "تحقق من القيمة والوحدة"}
                  </button>
                  <p className="helper">
                    تبقى القيمة والوحدة كما كتبتها عند تعذر الاتصال.
                  </p>
                </form>
              </section>
              {result && (
                <section
                  className={
                    "product-card subject-result " +
                    (draftChanged
                      ? "result-stale"
                      : result.status === "correct"
                        ? "result-success"
                        : "result-review")
                  }
                  role="status"
                >
                  <h2>
                    {draftChanged
                      ? "تغيّرت المسودة؛ أعد التحقق"
                      : result.status === "correct"
                        ? "القيمة والوحدة صحيحتان"
                        : result.status === "wrong_unit" && result.valueCorrect
                          ? "راجع الوحدة؛ القيمة متوافقة"
                          : "نتيجة التحقق"}
                  </h2>
                  {!draftChanged && (
                    <>
                      <p>{result.messageAr}</p>
                      {result.diagnosis.messageAr && (
                        <p>
                          {result.diagnosis.state === "possible"
                            ? "سبب محتمل: "
                            : ""}
                          {result.diagnosis.messageAr}
                        </p>
                      )}
                      <p className="helper">
                        {result.independentEvidence
                          ? "دليل مستقل جديد في هذه المسألة؛ لا يثبت إتقانًا دائمًا."
                          : result.assistanceLevel > 0
                            ? "محاولة مع مساعدة مسجلة."
                            : "لم يثبت دليل مستقل من هذه الإجابة."}
                      </p>
                    </>
                  )}
                </section>
              )}
              {result && !draftChanged && (
                <ProgressiveHelp
                  key={problem.revisionId}
                  busy={busy}
                  hint={hint}
                  level={result.assistanceLevel}
                  onHint={(level, confirm) => void help(level, confirm)}
                />
              )}
            </>
          ) : (
            <div className="product-card">
              <h2>اختر مسألة قصيرة للبدء</h2>
              <p>
                اقرأ المعطيات، وحدد الكمية المطلوبة، ثم اكتب قيمتها ووحدتها.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ProgrammingWorkspace({
  api,
  selectedRevision,
  resumeAttemptId,
  resumeVersion,
}: {
  api: ProductApi;
  selectedRevision?: string | null;
  resumeAttemptId?: string | null;
  resumeVersion?: number;
}) {
  const [problems, setProblems] = useState<PublicItem[]>([]),
    [problem, setProblem] = useState<PublicItem | null>(null),
    [source, setSource] = useState(""),
    [result, setResult] = useState<CodeResult | null>(null),
    [history, setHistory] = useState<CodeResult[]>([]),
    [hint, setHint] = useState<SubjectHint | null>(null),
    [level, setLevel] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [draftChanged, setDraftChanged] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null),
    generation = useRef(0),
    draft = useRef("");
  const problemIdentity = useRef<string | null>(null);
  const [polling, setPolling] = useState(false),
    [pollEpoch, setPollEpoch] = useState(0),
    [pollNotice, setPollNotice] = useState("");
  const pendingId =
    result && isPendingExecution(result.status) ? result.attemptId : null;
  useEffect(() => {
    if (!pendingId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    let active = true;
    setPolling(true);
    setPollNotice("");
    void pollExecution(
      async (signal) => {
        const saved = await api.request(
          `/programming/attempts/${pendingId}`,
          savedProgram,
          "GET",
          undefined,
          undefined,
          signal,
        );
        return { ...saved, status: saved.result.status };
      },
      controller.signal,
      (saved) => {
        if (!active || saved.problem.id !== problemIdentity.current) return;
        setResult((current) =>
          current &&
          current.attemptId === saved.result.attemptId &&
          current.revision <= saved.result.revision
            ? saved.result
            : current,
        );
        setLevel((previous) => Math.max(previous, saved.assistanceLevel));
        setDraftChanged(draft.current !== saved.sourceRaw);
        if (!isPendingExecution(saved.result.status))
          setHistory((old) =>
            [
              saved.result,
              ...old.filter(
                (item) =>
                  item.attemptId !== saved.result.attemptId ||
                  item.revision !== saved.result.revision,
              ),
            ].slice(0, 12),
          );
      },
    )
      .then((outcome) => {
        if (active && outcome === "aborted")
          setPollNotice(
            "لم تصل نتيجة نهائية بعد. نصك باقٍ؛ حدّث نتيجة الطلب نفسه بدل تشغيل نسخة أخرى.",
          );
      })
      .catch((e) => {
        if (active) setPollNotice(messageOf(e));
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (active) setPolling(false);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      setPolling(false);
    };
  }, [api, pendingId, pollEpoch]);
  useEffect(() => {
    let active = true;
    void api
      .request("/programming/problems", (value) =>
        arrayField(record(value).items, publicItem),
      )
      .then((items) => {
        if (active) setProblems(items);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [api]);
  useEffect(() => {
    if (resumeAttemptId) void restore(resumeAttemptId);
    else if (selectedRevision) void open(selectedRevision);
  }, [selectedRevision, resumeAttemptId, resumeVersion]);
  async function restore(id: string) {
    setBusy(true);
    setError("");
    const ticket = ++generation.current;
    try {
      const restored = await api.request(
        `/programming/attempts/${id}`,
        savedProgram,
      );
      if (ticket !== generation.current) return;
      problemIdentity.current = restored.problem.id;
      draft.current = restored.sourceRaw;
      setProblem(restored.problem);
      setSource(restored.sourceRaw);
      setResult(restored.result);
      setLevel(restored.assistanceLevel);
      setHint(null);
      setDraftChanged(false);
    } catch (e) {
      if (ticket === generation.current) setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  function edit(next: string) {
    draft.current = next;
    setSource(next);
    setDraftChanged(true);
    generation.current++;
  }
  async function open(id: string) {
    setBusy(true);
    setError("");
    const ticket = ++generation.current;
    try {
      const next = await api.request(
        "/programming/problems/" + encodeURIComponent(id),
        publicItem,
      );
      if (ticket !== generation.current) return;
      problemIdentity.current = next.id;
      setProblem(next);
      const initial = next.programming?.starterCode ?? "";
      draft.current = initial;
      setSource(initial);
      setResult(null);
      setHint(null);
      setLevel(0);
      setHistory([]);
      setDraftChanged(false);
    } catch (e) {
      if (ticket === generation.current) setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function execute(mode: "run" | "submit") {
    if (!problem) return;
    setBusy(true);
    setError("");
    const ticket = generation.current,
      sent = source;
    try {
      await api.me();
      const next = await api.request(
        "/programming/attempts",
        codeResult,
        "POST",
        {
          problemRevisionId: problem.id,
          sourceRaw: sent,
          mode,
          ...(result
            ? { attemptId: result.attemptId, expectedRevision: result.revision }
            : {}),
        },
      );
      setHistory((old) => [next, ...old].slice(0, 12));
      if (problem.id === problemIdentity.current) {
        setResult(next);
        if (ticket === generation.current && draft.current === sent)
          setDraftChanged(false);
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function help(nextLevel: number, confirm: boolean) {
    if (!result) return;
    setBusy(true);
    setError("");
    const ticket = generation.current;
    try {
      const next = await api.request(
        `/programming/attempts/${result.attemptId}/hints`,
        subjectHint,
        "POST",
        {
          level: nextLevel,
          confirmFullSolution: confirm,
          expectedRevision: result.revision,
        },
      );
      if (problem?.id === problemIdentity.current) {
        if (ticket === generation.current) setHint(next);
        setLevel(Math.max(level, next.level));
        setResult(
          (current) =>
            current && {
              ...current,
              revision: next.revision,
              independent: false,
            },
        );
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="product-page"
      aria-labelledby="programming-title"
      aria-busy={busy}
    >
      <div className="page-heading">
        <span className="eyebrow">البرمجة · أساسيات Python</span>
        <h1 id="programming-title">فكرتك، ثم كودك.</h1>
        <p>
          جرّب على أمثلة معلنة، ثم سلّم للاختبارات. ينفّذ الخادم الكود عبر خدمة
          معزولة عند تهيئتها.
        </p>
      </div>
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      <div className="subject-layout">
        <aside className="product-card">
          <h2>تمارين منشورة</h2>
          {!problems.length && (
            <p>لا توجد تمارين Python منشورة بعد المراجعة حاليًا.</p>
          )}
          <div className="lesson-list">
            {problems.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                aria-pressed={problem?.id === p.id}
                onClick={() => void open(p.id)}
              >
                {p.titleAr}
                <small>{p.lessonCode}</small>
              </button>
            ))}
          </div>
        </aside>
        <div>
          {problem ? (
            <>
              <section className="product-card">
                <h2>{problem.titleAr}</h2>
                <p>{problem.statementAr}</p>
                {!!problem.programming?.publicTests.length && (
                  <details>
                    <summary>أمثلة الاختبار المعلنة</summary>
                    {problem.programming.publicTests.map((t, i) => (
                      <div className="public-test" key={i}>
                        <p>المدخل</p>
                        <pre dir="ltr">{t.input || "(فارغ)"}</pre>
                        <p>المخرج المتوقع</p>
                        <pre dir="ltr">{t.expectedOutput}</pre>
                      </div>
                    ))}
                  </details>
                )}
                <label htmlFor="python-source">كودك بلغة Python</label>
                <p id="code-editor-help" className="helper">
                  Tab للمسافة البادئة وShift + Tab لإزالتها. اضغط Escape ثم Tab
                  للخروج من المحرر بلوحة المفاتيح.
                </p>
                <textarea
                  id="python-source"
                  ref={editor}
                  className="code-editor"
                  dir="ltr"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={source}
                  onChange={(e) => edit(e.target.value)}
                  aria-describedby="code-editor-help code-size"
                  onKeyDown={(e) => {
                    const area = e.currentTarget;
                    if (e.key === "Escape") {
                      area.dataset.escapeTab = "true";
                      return;
                    }
                    if (e.key === "Tab") {
                      if (area.dataset.escapeTab === "true") {
                        delete area.dataset.escapeTab;
                        return;
                      }
                      e.preventDefault();
                      const next = indentCode(
                        source,
                        area.selectionStart,
                        area.selectionEnd,
                        e.shiftKey,
                      );
                      edit(next.raw);
                      requestAnimationFrame(() =>
                        area.setSelectionRange(next.start, next.end),
                      );
                    } else {
                      delete area.dataset.escapeTab;
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const next = continueCodeLine(
                          source,
                          area.selectionStart,
                          area.selectionEnd,
                        );
                        edit(next.raw);
                        requestAnimationFrame(() =>
                          area.setSelectionRange(next.caret, next.caret),
                        );
                      }
                    }
                  }}
                />
                <p id="code-size" className="helper">
                  {count(source.length)} من ١٢٬٠٠٠ محرف. نصك يبقى في المحرر
                  أثناء الانتظار وعند فشل التشغيل.{" "}
                  {source.length > 12000 &&
                    "تجاوز النص الحد؛ اختصره قبل التشغيل أو التسليم."}
                </p>
                <div className="actions">
                  <button
                    disabled={
                      busy ||
                      !!pendingId ||
                      !source.trim() ||
                      source.length > 12000
                    }
                    onClick={() => void execute("run")}
                  >
                    {busy ? "جارٍ التشغيل…" : "تشغيل تجريبي"}
                  </button>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !!pendingId ||
                      !source.trim() ||
                      source.length > 12000
                    }
                    onClick={() => void execute("submit")}
                  >
                    تحقق من الحل
                  </button>
                </div>
              </section>
              {pendingId && (
                <section className="product-card" role="status">
                  <h2>
                    {polling
                      ? "جارٍ متابعة الطلب نفسه…"
                      : "الطلب ينتظر نتيجة نهائية"}
                  </h2>
                  <p>
                    {pollNotice ||
                      "يمكنك تعديل مسودتك أثناء الانتظار؛ لن ننسب النتيجة القديمة إلى الكود المعدّل."}
                  </p>
                  <button
                    disabled={polling}
                    onClick={() => setPollEpoch((epoch) => epoch + 1)}
                  >
                    حدّث نتيجة التشغيل المحفوظ
                  </button>
                </section>
              )}
              {result && (
                <section
                  className={
                    "product-card subject-result " +
                    (draftChanged
                      ? "result-stale"
                      : result.allPassed
                        ? "result-success"
                        : "result-review")
                  }
                  aria-live="polite"
                >
                  <h2>
                    {draftChanged
                      ? "تغيّر الكود؛ النتيجة تخص النسخة السابقة"
                      : (codeStatuses[result.status] ?? result.status)}
                  </h2>
                  {!draftChanged && (
                    <>
                      <p>
                        {result.mode === "submit"
                          ? "الاختبارات المجتازة: " +
                            count(result.passed) +
                            " من " +
                            count(result.total)
                          : "هذا تشغيل تجريبي، ولا يُثبت اجتياز الاختبارات المخفية."}
                      </p>
                      {result.allPassed && (
                        <p>
                          {result.independent
                            ? "نجحت جميع الاختبارات المحددة دون مساعدة مسجلة؛ دليل مستقل جديد."
                            : "نجحت الاختبارات مع مساعدة مسجلة."}
                        </p>
                      )}
                      {result.status === "service_error" && (
                        <p>
                          بقي الكود محفوظًا في المحرر. أعد التشغيل بعد تهيئة
                          الخدمة أو عودتها؛ لا تُحسب هذه الحالة خطأً في فهمك.
                        </p>
                      )}
                      <h3>المخرج</h3>
                      <pre className="code-output" dir="ltr">
                        {result.stdout || "لا يوجد مخرج معروض."}
                      </pre>
                      {result.stderr && (
                        <>
                          <h3>رسالة Python المنقّحة</h3>
                          <pre className="code-output" dir="ltr">
                            {result.stderr}
                          </pre>
                        </>
                      )}
                    </>
                  )}
                </section>
              )}
              {result && !draftChanged && !pendingId && (
                <ProgressiveHelp
                  key={problem.id}
                  busy={busy}
                  hint={hint}
                  level={level}
                  onHint={(n, confirm) => void help(n, confirm)}
                />
              )}
              {!!history.length && (
                <details className="product-card">
                  <summary>سجل التشغيل في هذه الصفحة</summary>
                  <ol>
                    {history.map((run, i) => (
                      <li key={run.attemptId + ":" + run.revision + ":" + i}>
                        {codeStatuses[run.status] ?? run.status} ·{" "}
                        {new Date(run.createdAt).toLocaleTimeString("ar")} ·{" "}
                        {count(run.passed)}/{count(run.total)}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          ) : (
            <div className="product-card">
              <h2>اختر تمرينًا للبدء</h2>
              <p>
                الشرح بالعربية، وأسماء Python والكود بالإنجليزية. لا تُحمّل
                الحلول المرجعية أو الاختبارات المخفية في هذه الصفحة.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
