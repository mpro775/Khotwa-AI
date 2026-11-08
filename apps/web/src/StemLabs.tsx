import { useEffect, useId, useRef, useState } from "react";
import { ProductFault, messageOf, type ProductApi } from "./product-api";
import {
  labActivity,
  labCapabilities,
  labSession,
  type LabArtifact,
  type LabLine,
  type LabPublicSpec,
  type LabResult,
  type LabSession,
} from "./stem-lab-api";
import {
  moveLabLine,
  plotGeometry,
  resumeLabReflection,
  readLabResume,
  writeLabResume,
  type PlotPoint,
} from "./stem-lab-view";
import { MathInput } from "./MathInput";
import "./stem-labs.css";

const numberAr = (value: number) =>
  value.toLocaleString("ar", { maximumFractionDigits: 4 });
const parameterLabels: Record<string, string> = {
  a: "المعامل أ",
  b: "الثابت ب",
  v_mps: "السرعة المتجهة (m/s)",
  v0_mps: "السرعة الابتدائية (m/s)",
  a_mps2: "التسارع (m/s²)",
  t_s: "الزمن (s)",
  x0_m: "الموضع الابتدائي (m)",
};
const kindTitles: Record<string, string> = {
  math_linear_graph_v1: "المعادلة والجدول والرسم",
  math_method_comparison_v1: "قارن طريقتين للحل",
  math_first_error_v1: "أول انتقال يحتاج مراجعة",
  math_why_question_v1: "لماذا يصح هذا الانتقال؟",
  math_completion_v1: "أكمل خطوة بمساعدة",
  math_equivalence_probe_v1: "هل الانتقالان متكافئان؟",
  physics_prediction_experiment_v1: "توقّع، ثم جرّب وفسّر",
  predict_output: "توقّع المخرجات",
  code_trace: "تتبّع الكود خطوة خطوة",
  parsons_reorder: "رتّب أسطر البرنامج",
  debug_select_fix: "حدّد إصلاح الخطأ",
};

/** A single server-supplied point list feeds both accessible views. No domain verdict here. */
export function LabPlot({
  points,
  xLabel = "س",
  yLabel = "ص",
  caption,
}: {
  points: readonly PlotPoint[];
  xLabel?: string;
  yLabel?: string;
  caption: string;
}) {
  const [tableOnly, setTableOnly] = useState(false),
    geometry = plotGeometry(points),
    id = useId();
  return (
    <section className="lab-plot">
      <button aria-pressed={tableOnly} onClick={() => setTableOnly(!tableOnly)}>
        {tableOnly ? "أظهر الرسم مع الجدول" : "اكتفِ بالجدول النصي"}
      </button>
      {!tableOnly && geometry && (
        <svg viewBox="0 0 460 270" role="img" aria-labelledby={id}>
          <title
            id={id}
          >{`${caption}؛ القيم نفسها معروضة في الجدول التالي.`}</title>
          <line
            x1="46"
            x2="412"
            y1={geometry.origin.y}
            y2={geometry.origin.y}
            className="lab-axis"
          />
          <line
            x1={geometry.origin.x}
            x2={geometry.origin.x}
            y1="28"
            y2="222"
            className="lab-axis"
          />
          <polyline
            points={geometry.coordinates
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
            className="lab-curve"
          />
          {geometry.coordinates.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="3"
              className="lab-dot"
            />
          ))}
          <text x="425" y="250" textAnchor="end">
            {xLabel}
          </text>
          <text x="26" y="20">
            {yLabel}
          </text>
          <text x="46" y="250">
            {numberAr(geometry.xMin)}
          </text>
          <text x="385" y="250">
            {numberAr(geometry.xMax)}
          </text>
          <text x="6" y="222">
            {numberAr(geometry.yMin)}
          </text>
          <text x="6" y="43">
            {numberAr(geometry.yMax)}
          </text>
        </svg>
      )}
      {!geometry && (
        <p role="status">تعذر عرض الرسم؛ لم تُنتج الخدمة بيانات قابلة للعرض.</p>
      )}
      <div className="table-scroll">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{xLabel}</th>
              <th scope="col">{yLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={index}>
                <td>
                  <bdi dir="ltr">{numberAr(point.x)}</bdi>
                </td>
                <td>
                  <bdi dir="ltr">{numberAr(point.y)}</bdi>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LabOutcome({ result }: { result: LabResult }) {
  const title = {
    correct_practice: "استجابة مناسبة لهذا التدريب",
    incorrect_practice: "راجع استجابتك لهذا التدريب",
    needs_review: "يحتاج تفسيرك إلى مراجعة",
    cannot_determine: "لم نتمكن من التحقق آليًا",
  }[result.result];
  return (
    <aside className="lab-outcome" role="status">
      <h4>{title}</h4>
      <p>{result.feedbackAr}</p>
      <p className="helper">
        نتيجة نشاط تعلّم محدودة؛ لا تُحتسب نجاحًا مستقلًا أو إتقانًا دائمًا.
      </p>
      {result.result === "cannot_determine" && (
        <p>إجابتك باقية، ولم نعتبر تعذر التحقق خطأً في فهمك.</p>
      )}
    </aside>
  );
}

export function ParsonsEditor({
  lines,
  onChange,
  disabled = false,
}: {
  lines: LabLine[];
  onChange: (lines: LabLine[]) => void;
  disabled?: boolean;
}) {
  const [past, setPast] = useState<LabLine[][]>([]);
  function move(index: number, direction: -1 | 1) {
    setPast((old) => [...old.slice(-19), lines]);
    onChange(moveLabLine(lines, index, direction));
  }
  return (
    <section
      className="parsons-editor"
      aria-label="ترتيب أسطر Python بلوحة المفاتيح"
    >
      <p>استخدم زري «لأعلى» و«لأسفل»؛ تبقى المسافة البادئة مرتبطة بالسطر.</p>
      <ol>
        {lines.map((line, index) => (
          <li key={line.id}>
            <pre dir="ltr">
              <code>
                {" ".repeat(Math.max(0, Math.min(16, line.indent))) + line.code}
              </code>
            </pre>
            <div className="actions">
              <button
                disabled={disabled || index === 0}
                aria-label={`حرّك السطر ${numberAr(index + 1)} لأعلى`}
                onClick={() => move(index, -1)}
              >
                لأعلى
              </button>
              <button
                disabled={disabled || index === lines.length - 1}
                aria-label={`حرّك السطر ${numberAr(index + 1)} لأسفل`}
                onClick={() => move(index, 1)}
              >
                لأسفل
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        disabled={disabled || !past.length}
        onClick={() => {
          const last = past.at(-1);
          if (last) {
            onChange(last);
            setPast((old) => old.slice(0, -1));
          }
        }}
      >
        تراجع عن آخر ترتيب
      </button>
    </section>
  );
}

function CodeListing({ source }: { source: string }) {
  return (
    <ol
      className="lab-code-lines"
      dir="ltr"
      aria-label="الكود للقراءة، دون تشغيل"
    >
      {source.split("\n").map((line, index) => (
        <li key={index}>
          <code>{line || " "}</code>
        </li>
      ))}
    </ol>
  );
}
function RevealedArtifact({
  artifact,
  subject,
}: {
  artifact: LabArtifact;
  subject: string;
}) {
  if (subject === "physics" && artifact.physicsPoints)
    return (
      <>
        <LabPlot
          points={artifact.physicsPoints.map((point) => ({
            x: point.t_s,
            y: point.x_m,
          }))}
          xLabel="الزمن (s)"
          yLabel="الموضع (m)"
          caption="عينات نموذج الحركة الخطية بوحدات النظام الدولي"
        />
        <dl className="lab-measurements">
          {(
            [
              ["displacement_m", "الإزاحة", "m"],
              ["distance_m", "المسافة", "m"],
              ["finalVelocity_mps", "السرعة المتجهة النهائية", "m/s"],
            ] as const
          ).map(([key, label, unit]) =>
            artifact[key] === undefined ? null : (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <bdi dir="ltr">
                    {numberAr(artifact[key]!)} {unit}
                  </bdi>
                </dd>
              </div>
            ),
          )}
        </dl>
        <p className="helper">
          النتائج مرتبطة بنموذج حركة على محور واحد وافتراضاته؛ المسافة لا تُساوى
          تلقائيًا بمقدار الإزاحة عند انعكاس الاتجاه.
        </p>
      </>
    );
  if (artifact.points)
    return (
      <LabPlot
        points={artifact.points}
        caption="جدول الدالة الخطية والرسم من قائمة قيم واحدة"
      />
    );
  if (artifact.traceSteps)
    return (
      <section className="lab-trace">
        <h4>الخطوات التي طلبت كشفها</h4>
        {artifact.traceSteps.map((step, index) => (
          <article key={index}>
            <h5>الخطوة {numberAr(index + 1)}</h5>
            <dl>
              {Object.entries(step.variablesDisplay).map(([name, value]) => (
                <div key={name}>
                  <dt>
                    <bdi dir="ltr">{name}</bdi>
                  </dt>
                  <dd>
                    <bdi dir="ltr">{value}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
            <p>{step.explanationAr}</p>
            <pre dir="ltr">{step.stdoutCumulative}</pre>
          </article>
        ))}
      </section>
    );
  if (artifact.reasonAr || artifact.workedSteps || artifact.completionRaw)
    return (
      <aside className="lesson-callout">
        <h4>الدعم الذي طلبت كشفه</h4>
        <p>{artifact.reasonAr}</p>
        {artifact.completionRaw && (
          <bdi className="math-text" dir="ltr">
            {artifact.completionRaw}
          </bdi>
        )}
        {artifact.workedSteps && (
          <ol>
            {artifact.workedSteps.map((step, index) => (
              <li key={index}>
                <bdi className="math-text" dir="ltr">
                  {step}
                </bdi>
              </li>
            ))}
          </ol>
        )}
        <p className="helper">سُجل هذا الكشف مساعدةً في النشاط.</p>
      </aside>
    );
  return artifact.feedbackAr ? <p>{artifact.feedbackAr}</p> : null;
}

export function StemLabPlayer({
  api,
  trackRevisionId,
  lessonRevisionId,
  blockIndex,
  onClose,
  onIndependent,
}: {
  api: ProductApi;
  trackRevisionId: string;
  lessonRevisionId: string;
  blockIndex: number;
  onClose: () => void;
  onIndependent?: () => void;
}) {
  const [activity, setActivity] = useState<LabPublicSpec | null>(null),
    [session, setSession] = useState<LabSession | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [disabled, setDisabled] = useState(false),
    [notice, setNotice] = useState("");
  const [prediction, setPrediction] = useState(""),
    [observation, setObservation] = useState(""),
    [explanation, setExplanation] = useState(""),
    [answerText, setAnswerText] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [transition, setTransition] = useState(0),
    [lines, setLines] = useState<LabLine[]>([]),
    [parameters, setParameters] = useState<Record<string, number>>({}),
    [parametersDirty, setParametersDirty] = useState(false),
    [draftChanged, setDraftChanged] = useState(false);
  const generation = useRef(0),
    alive = useRef(true),
    localEdit = useRef(0),
    lastSession = useRef<LabSession | null>(null),
    id = useId();
  function edit(change: () => void) {
    localEdit.current++;
    setDraftChanged(true);
    change();
  }
  function adopt(next: LabSession, resetDraft = false) {
    lastSession.current = next;
    setSession(next);
    setActivity(next.activity);
    if (resetDraft) {
      const resumed = resumeLabReflection(next);
      setPrediction(next.prediction ?? "");
      setObservation(resumed.observation);
      setExplanation(resumed.explanation);
      setParameters(next.parameters);
      setParametersDirty(false);
      setLines(next.activity.domainSpec.lineItems ?? []);
      setDraftChanged(resumed.stale);
      const saved = next.answer ?? {};
      if (typeof saved.raw === "string") setAnswerText(saved.raw);
      else if (typeof saved.output === "string") setAnswerText(saved.output);
      else if (typeof saved.value === "string") setAnswerText(saved.value);
      if (Array.isArray(saved.methodIds))
        setSelected(saved.methodIds as string[]);
      else if (Array.isArray(saved.choiceIds))
        setSelected(saved.choiceIds as string[]);
      else if (typeof saved.patchId === "string") setSelected([saved.patchId]);
      else if (typeof saved.unit === "string") setSelected([saved.unit]);
      else if (typeof saved.equivalent === "boolean")
        setSelected([String(saved.equivalent)]);
      if (typeof saved.transitionIndex === "number")
        setTransition(saved.transitionIndex - 1);
      if (Array.isArray(saved.lines)) {
        const byId = new Map(
          (next.activity.domainSpec.lineItems ?? []).map((line) => [
            line.id,
            line,
          ]),
        );
        setLines(
          saved.lines.flatMap((value) => {
            const l = value as { lineId: string; indentationLevel: number };
            const line = byId.get(l.lineId);
            return line ? [{ ...line, indent: l.indentationLevel }] : [];
          }),
        );
      }
    }
    try {
      writeLabResume(
        sessionStorage,
        trackRevisionId,
        lessonRevisionId,
        blockIndex,
        next.id,
      );
    } catch {
      /* Optional resource ID only; server owns the content. */
    }
  }
  useEffect(() => {
    alive.current = true;
    const ticket = ++generation.current,
      controller = new AbortController();
    setBusy(true);
    void (async () => {
      const flags = await api.request(
        "/learning/labs/capabilities",
        labCapabilities,
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (!flags.math && !flags.physics && !flags.codingNonExecuting) {
        if (alive.current && ticket === generation.current) setDisabled(true);
        return;
      }
      const spec = await api.request(
        `/learning/labs/activities/${encodeURIComponent(lessonRevisionId)}?blockIndex=${blockIndex}`,
        labActivity,
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (!alive.current || ticket !== generation.current) return;
      if (
        !(spec.subject === "algebra"
          ? flags.math
          : spec.subject === "physics"
            ? flags.physics
            : flags.codingNonExecuting)
      ) {
        setDisabled(true);
        return;
      }
      setActivity(spec);
      setLines(spec.domainSpec.lineItems ?? []);
      let saved: string | null = null;
      try {
        saved = readLabResume(
          sessionStorage,
          trackRevisionId,
          lessonRevisionId,
          blockIndex,
        );
      } catch {
        /* Optional tab cache. */
      }
      if (saved) {
        try {
          const next = await api.request(
            `/learning/labs/sessions/${encodeURIComponent(saved)}`,
            labSession,
            "GET",
            undefined,
            undefined,
            controller.signal,
          );
          if (alive.current && ticket === generation.current) adopt(next, true);
        } catch (e) {
          if (!(e instanceof ProductFault && e.status === 404)) throw e;
        }
      }
    })()
      .catch((e) => {
        if (alive.current && !controller.signal.aborted) {
          if (e instanceof ProductFault && [403, 404].includes(e.status))
            setDisabled(true);
          else setError(messageOf(e));
        }
      })
      .finally(() => {
        if (alive.current && ticket === generation.current) setBusy(false);
      });
    return () => {
      alive.current = false;
      generation.current++;
      controller.abort();
    };
  }, [api, trackRevisionId, lessonRevisionId, blockIndex]);
  async function work(
    action: () => Promise<LabSession>,
    reset = false,
    submitted = false,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    const ticket = generation.current,
      draft = localEdit.current;
    try {
      const next = await action();
      if (alive.current && ticket === generation.current) {
        adopt(next, reset);
        if (draft !== localEdit.current) {
          setDraftChanged(true);
          setNotice(
            "وصلت نتيجة النسخة المرسلة؛ مسودتك المعدلة باقية وتحتاج إرسالًا جديدًا.",
          );
        } else if (submitted) setDraftChanged(false);
      }
    } catch (e) {
      if (alive.current && ticket === generation.current)
        setError(messageOf(e));
    } finally {
      if (alive.current && ticket === generation.current) setBusy(false);
    }
  }
  const event = (eventKind: string, payload: unknown = {}) => {
    const current = lastSession.current;
    if (!current) return Promise.reject(new Error("missing_session"));
    return api.request(
      `/learning/labs/sessions/${current.id}/events`,
      labSession,
      "POST",
      { expectedRevision: current.revision, eventKind, payload },
    );
  };
  async function refresh() {
    await work(async () => {
      if (!lastSession.current) throw new Error("missing_session");
      return api.request(
        `/learning/labs/sessions/${lastSession.current.id}`,
        labSession,
      );
    });
  }
  function submit() {
    if (!session || !activity) return;
    const kind = activity.domainSpec.kind;
    let answer: unknown;
    if (kind === "math_method_comparison_v1")
      answer = { methodIds: selected, explanationAr: explanation };
    else if (kind === "math_first_error_v1")
      answer = { transitionIndex: transition + 1 };
    else if (kind === "math_why_question_v1")
      answer = { choiceIds: selected, explanationAr: explanation };
    else if (kind === "math_completion_v1") answer = { raw: answerText };
    else if (kind === "math_equivalence_probe_v1")
      answer = { equivalent: selected[0] === "true" };
    else if (kind === "math_linear_graph_v1")
      answer = { observationAr: observation };
    else if (kind === "parsons_reorder")
      answer = {
        lines: lines.map((line) => ({
          lineId: line.id,
          indentationLevel: line.indent,
        })),
      };
    else if (kind === "debug_select_fix") answer = { patchId: selected[0] };
    else if (kind === "predict_output" || kind === "code_trace")
      answer = { output: answerText };
    else
      answer = spec?.allowedUnits?.length
        ? { value: answerText, unit: selected[0] }
        : {
            ...(observation.trim() ? { observationAr: observation } : {}),
            ...(explanation.trim() ? { explanationAr: explanation } : {}),
          };
    void work(
      () =>
        api.request(
          `/learning/labs/sessions/${session.id}/submit`,
          labSession,
          "POST",
          { expectedRevision: session.revision, answer },
        ),
      false,
      true,
    );
  }
  const spec = activity?.domainSpec,
    kind = spec?.kind,
    isPhysics = activity?.subject === "physics",
    isCode = activity?.subject === "programming",
    graph = kind === "math_linear_graph_v1",
    revealed = !!session?.resultRevealed;
  function toggle(value: string, multiple = false) {
    edit(() =>
      setSelected((old) =>
        multiple
          ? old.includes(value)
            ? old.filter((item) => item !== value)
            : [...old, value]
          : [value],
      ),
    );
  }
  return (
    <section
      className="stem-lab product-card"
      aria-labelledby={id + "-title"}
      aria-busy={busy}
      dir="rtl"
    >
      <div className="lab-heading">
        <div>
          <span className="eyebrow">نشاط للتجربة والفهم</span>
          <h3 id={id + "-title"}>
            {kindTitles[kind ?? ""] ?? "المختبر التخصصي"}
          </h3>
        </div>
        <button onClick={onClose}>العودة إلى الدرس</button>
      </div>
      <p className="lab-learning-badge">
        هذا نشاط للتجربة والفهم، ولا يُعد اختبار إتقان مستقلًا.
      </p>
      {activity && <p>{activity.objectiveAr}</p>}
      {disabled ? (
        <p role="status">
          المختبر غير مفعّل أو لا يتوفر نشاط منشور مراجع في هذه النسخة. يمكنك
          متابعة شرح الدرس الأصلي.
        </p>
      ) : (
        <>
          {error && (
            <div className="product-error" role="alert">
              <p>{error}</p>
              <p>بقي إدخالك كما كتبته؛ لم نحوله إلى نتيجة سلبية.</p>
              {session && (
                <button disabled={busy} onClick={() => void refresh()}>
                  حدّث الجلسة المحفوظة
                </button>
              )}
            </div>
          )}
          <p role="status" aria-live="polite">
            {busy ? "جارٍ الاتصال بالمختبر…" : notice}
          </p>
          {activity && !session && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void work(
                  () =>
                    api.request("/learning/labs/sessions", labSession, "POST", {
                      trackRevisionId,
                      lessonRevisionId,
                      blockIndex,
                    }),
                  true,
                )
              }
            >
              ابدأ النشاط
            </button>
          )}
          {session && spec && (
            <>
              {(isPhysics || isCode) && (
                <ol className="lab-stages" aria-label="مراحل النشاط">
                  <li
                    aria-current={
                      session.stage === "opened" ? "step" : undefined
                    }
                  >
                    توقّع
                  </li>
                  <li aria-current={revealed ? "step" : undefined}>
                    جرّب ولاحظ
                  </li>
                  <li>فسّر</li>
                  <li>تحقّق بسؤال جديد</li>
                </ol>
              )}
              {spec.originalRaw && (
                <p className="math-text">
                  <bdi dir="ltr">{spec.originalRaw}</bdi>
                </p>
              )}
              {graph && spec.model && (
                <p className="math-text">
                  <bdi dir="ltr">
                    ص = {numberAr(parameters.a ?? Number(spec.model.a))} × س + (
                    {numberAr(parameters.b ?? Number(spec.model.b))})
                  </bdi>
                  {parameters.a === 0 && (
                    <span> · المعامل صفر؛ الدالة ثابتة وخطها أفقي.</span>
                  )}
                </p>
              )}
              {spec.assumptionsAr && (
                <details>
                  <summary>افتراضات نموذج التجربة</summary>
                  <ul>
                    {spec.assumptionsAr.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                </details>
              )}
              {spec.sourceCode && <CodeListing source={spec.sourceCode} />}
              {spec.fromRaw && (
                <p className="math-text">
                  <bdi dir="ltr">{spec.fromRaw}</bdi>
                  <span> ← </span>
                  <bdi dir="ltr">{spec.toRaw}</bdi>
                </p>
              )}
              {(isPhysics || isCode) && !revealed && (
                <fieldset>
                  <legend>
                    {spec.predictionPromptAr ?? "ما توقعك قبل كشف النتيجة؟"}
                  </legend>
                  <label htmlFor={id + "-prediction"}>
                    توقعك — يمكنك قول «لا أعرف»
                  </label>
                  <textarea
                    id={id + "-prediction"}
                    maxLength={1000}
                    value={prediction}
                    disabled={session.stage !== "opened"}
                    onChange={(e) => edit(() => setPrediction(e.target.value))}
                  />
                  <div className="actions">
                    <button
                      disabled={
                        busy || session.stage !== "opened" || !prediction.trim()
                      }
                      onClick={() =>
                        void work(() =>
                          event("prediction_submitted", { textAr: prediction }),
                        )
                      }
                    >
                      احفظ توقعي
                    </button>
                    <button
                      disabled={busy || session.stage !== "opened"}
                      onClick={() => {
                        setPrediction("لا أعرف");
                        void work(() =>
                          event("prediction_submitted", { textAr: "لا أعرف" }),
                        );
                      }}
                    >
                      لا أعرف
                    </button>
                  </div>
                  <p className="helper">
                    النتائج لا تظهر قبل حفظ التوقع. اختيار «لا أعرف» لا يُعاقب.
                  </p>
                </fieldset>
              )}
              {session.prediction && <p>توقعك المحفوظ: {session.prediction}</p>}
              {(graph || isPhysics) && (
                <fieldset>
                  <legend>
                    {graph
                      ? "معاملات الدالة الخطية"
                      : "قيم التجربة بوحدات النظام الدولي"}
                  </legend>
                  {Object.entries(parameters).map(([name, value]) => (
                    <div key={name} className="lab-parameter">
                      <label htmlFor={id + "-parameter-" + name}>
                        {parameterLabels[name] ?? name}
                      </label>
                      <div className="lab-number-controls">
                        <button
                          aria-label={`أنقص ${parameterLabels[name] ?? name}`}
                          onClick={() =>
                            edit(() => {
                              setParameters((old) => ({
                                ...old,
                                [name]: value - 1,
                              }));
                              setParametersDirty(true);
                            })
                          }
                        >
                          −
                        </button>
                        <input
                          id={id + "-parameter-" + name}
                          type="number"
                          step="any"
                          dir="ltr"
                          value={value}
                          onChange={(e) => {
                            const n = e.target.valueAsNumber;
                            if (Number.isFinite(n))
                              edit(() => {
                                setParameters((old) => ({
                                  ...old,
                                  [name]: n,
                                }));
                                setParametersDirty(true);
                              });
                          }}
                        />
                        <button
                          aria-label={`زد ${parameterLabels[name] ?? name}`}
                          onClick={() =>
                            edit(() => {
                              setParameters((old) => ({
                                ...old,
                                [name]: value + 1,
                              }));
                              setParametersDirty(true);
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="actions">
                    <button
                      disabled={
                        busy || !parametersDirty || (!revealed && !graph)
                      }
                      onClick={() =>
                        void work(async () => {
                          const before = localEdit.current;
                          const next = await event(
                            "simulation_parameter_changed",
                            { parameters },
                          );
                          if (before === localEdit.current) {
                            setParametersDirty(false);
                            setObservation("");
                            setExplanation("");
                            setNotice(
                              "حُفظت القيم الجديدة. سجّل ملاحظتك وتفسيرك لهذه التجربة.",
                            );
                          }
                          return next;
                        })
                      }
                    >
                      طبّق تغيير القيم
                    </button>
                    {parametersDirty && (
                      <button
                        onClick={() => {
                          setParameters(session.parameters);
                          setParametersDirty(false);
                        }}
                      >
                        تراجع عن القيم غير المرسلة
                      </button>
                    )}
                  </div>
                  <p className="helper">
                    يؤكد الخادم حدود القيم والنموذج. التغيير استكشاف ولا يزيد
                    دليل الإتقان.
                  </p>
                </fieldset>
              )}
              {(isPhysics || kind === "code_trace") && !revealed && (
                <button
                  disabled={busy || session.stage === "opened"}
                  onClick={() =>
                    void work(() =>
                      event(
                        kind === "code_trace"
                          ? "trace_step_revealed"
                          : "simulation_revealed",
                        kind === "code_trace" ? { index: 0 } : {},
                      ),
                    )
                  }
                >
                  {isPhysics
                    ? "شغّل التجربة المحلية"
                    : "أظهر أول خطوة من التتبع"}
                </button>
              )}
              {(revealed || graph) && session.artifact && !parametersDirty && (
                <RevealedArtifact
                  artifact={session.artifact}
                  subject={activity.subject}
                />
              )}
              {parametersDirty && (
                <p role="status">
                  تغيرت القيم؛ العرض السابق لا يمثل القيم الجديدة حتى تؤكدها
                  الخدمة.
                </p>
              )}
              {kind === "code_trace" && revealed && (
                <button
                  disabled={
                    busy ||
                    (session.artifact?.traceSteps?.length ?? 0) >=
                      (spec.traceStepCount ?? 0)
                  }
                  onClick={() =>
                    void work(() =>
                      event("trace_step_revealed", {
                        index: session.artifact?.traceSteps?.length ?? 0,
                      }),
                    )
                  }
                >
                  {(session.artifact?.traceSteps?.length ?? 0) >=
                  (spec.traceStepCount ?? 0)
                    ? "اكتمل التتبع المتاح"
                    : "الخطوة التالية من التتبع"}
                </button>
              )}
              {(spec.steps || spec.visibleSteps) && (
                <ol className="worked-steps">
                  {(spec.steps ?? spec.visibleSteps ?? []).map((raw, index) => (
                    <li key={index}>
                      <bdi dir="ltr" className="math-text">
                        {raw}
                      </bdi>
                      {kind === "math_first_error_v1" && (
                        <label>
                          <input
                            type="radio"
                            name={id + "-transition"}
                            checked={transition === index}
                            onChange={() => edit(() => setTransition(index))}
                          />
                          هذا أول انتقال يحتاج مراجعة
                        </label>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {spec.methods && (
                <div className="lab-methods">
                  {spec.methods.map((method) => (
                    <section key={method.id}>
                      <h4>{method.titleAr}</h4>
                      <ol>
                        {method.steps.map((raw, index) => (
                          <li key={index}>
                            <bdi className="math-text" dir="ltr">
                              {raw}
                            </bdi>
                          </li>
                        ))}
                      </ol>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.includes(method.id)}
                          onChange={() => toggle(method.id, true)}
                        />
                        أرى أن هذه الطريقة صحيحة
                      </label>
                    </section>
                  ))}
                </div>
              )}
              {(spec.choices || spec.options) && (
                <fieldset>
                  <legend>
                    {kind === "debug_select_fix"
                      ? "اختر الإصلاح المناسب"
                      : "اختر المبرر المناسب"}
                  </legend>
                  {(spec.choices ?? spec.options ?? []).map((option) => (
                    <label className="lab-choice" key={option.id}>
                      <input
                        type={
                          kind === "math_why_question_v1" ? "checkbox" : "radio"
                        }
                        name={id + "-choices"}
                        checked={selected.includes(option.id)}
                        onChange={() =>
                          toggle(option.id, kind === "math_why_question_v1")
                        }
                      />
                      <span>
                        {option.textAr}
                        {option.code && (
                          <pre dir="ltr">
                            <code>{option.code}</code>
                          </pre>
                        )}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {kind === "math_equivalence_probe_v1" && (
                <fieldset>
                  <legend>هل يحفظ هذا الانتقال مجموعة الحلول؟</legend>
                  {[
                    { id: "true", text: "نعم، متكافئان" },
                    { id: "false", text: "لا، غير متكافئين" },
                  ].map((choice) => (
                    <label className="lab-choice" key={choice.id}>
                      <input
                        type="radio"
                        name={id + "-equiv"}
                        checked={selected.includes(choice.id)}
                        onChange={() => toggle(choice.id)}
                      />
                      {choice.text}
                    </label>
                  ))}
                </fieldset>
              )}
              {kind === "math_completion_v1" && (
                <MathInput
                  id={id + "-math"}
                  value={answerText}
                  onChange={(next) => edit(() => setAnswerText(next))}
                />
              )}
              {kind === "parsons_reorder" && (
                <ParsonsEditor
                  lines={lines}
                  onChange={(next) => edit(() => setLines(next))}
                />
              )}
              {(kind === "predict_output" || kind === "code_trace") && (
                <label>
                  المخرج الذي تتوقعه
                  <textarea
                    dir="ltr"
                    className="code-editor"
                    maxLength={1000}
                    value={answerText}
                    onChange={(e) => edit(() => setAnswerText(e.target.value))}
                  />
                </label>
              )}
              {isPhysics && spec.allowedUnits?.length && revealed && (
                <fieldset>
                  <legend>
                    {spec.quantity
                      ? `احسب ${{ distance: "المسافة المقطوعة", displacement: "الإزاحة على المحور", velocity: "السرعة المتجهة النهائية" }[spec.quantity]} ثم اختر وحدتها`
                      : "قيمة ووحدة ضمن هذا التدريب"}
                  </legend>
                  <label>
                    القيمة التي حسبتها
                    <input
                      inputMode="decimal"
                      dir="ltr"
                      value={answerText}
                      onChange={(event) =>
                        edit(() => setAnswerText(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    الوحدة
                    <select
                      value={selected[0] ?? ""}
                      onChange={(event) => toggle(event.target.value)}
                    >
                      <option value="">اختر وحدة</option>
                      {spec.allowedUnits.map((unit) => (
                        <option value={unit} key={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              )}
              {(revealed || graph) && (
                <label>
                  {spec.observationPromptAr ?? "ماذا لاحظت؟"}
                  <textarea
                    maxLength={1000}
                    value={observation}
                    onChange={(e) => edit(() => setObservation(e.target.value))}
                  />
                  <button
                    disabled={busy || !observation.trim()}
                    onClick={() =>
                      void work(() =>
                        event("observation_saved", { textAr: observation }),
                      )
                    }
                  >
                    احفظ الملاحظة
                  </button>
                </label>
              )}
              <label>
                {spec.explanationPromptAr ?? "كيف تفسّر اختيارك؟"}
                <textarea
                  maxLength={1000}
                  value={explanation}
                  onChange={(e) => edit(() => setExplanation(e.target.value))}
                />
              </label>
              {isPhysics && (
                <button
                  disabled={busy || !revealed || !explanation.trim()}
                  onClick={() =>
                    void work(() =>
                      event("explanation_saved", { textAr: explanation }),
                    )
                  }
                >
                  احفظ التفسير
                </button>
              )}
              <div className="actions">
                <button
                  className="primary"
                  disabled={
                    busy ||
                    parametersDirty ||
                    (isPhysics && !revealed) ||
                    (graph && !observation.trim()) ||
                    (isPhysics &&
                      !spec.allowedUnits?.length &&
                      !observation.trim() &&
                      !explanation.trim()) ||
                    (isPhysics &&
                      !!spec.allowedUnits?.length &&
                      (!answerText.trim() || !selected.length)) ||
                    ([
                      "math_equivalence_probe_v1",
                      "math_why_question_v1",
                      "math_method_comparison_v1",
                      "debug_select_fix",
                    ].includes(kind ?? "") &&
                      !selected.length)
                  }
                  onClick={submit}
                >
                  {busy ? "جارٍ التحقق…" : "تحقق من استجابتي للتدريب"}
                </button>
                {!isPhysics && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void work(async () => {
                        const next = await event("scaffold_revealed");
                        if (!next.artifact)
                          setNotice(
                            "سُجل طلب الدعم. لا تتوفر مادة دعم إضافية مراجعة لهذا النشاط حاليًا.",
                          );
                        return next;
                      })
                    }
                  >
                    أحتاج دعمًا للنشاط
                  </button>
                )}
              </div>
              {session.result && !draftChanged && (
                <LabOutcome result={session.result} />
              )}
              {session.result && draftChanged && (
                <p role="status">
                  تغيرت استجابتك؛ نتيجة التحقق السابقة تخص المسودة المرسلة.
                </p>
              )}
              {session.transfer.available && onIndependent ? (
                <button disabled={busy} onClick={onIndependent}>
                  انتقل إلى سؤال مستقل جديد
                </button>
              ) : (
                <p className="helper">
                  لا يوجد سؤال مستقل جديد مؤهل في البنك حاليًا. يبقى هذا النشاط
                  تدريبًا، ولا نعرض نتيجة إتقان مفترضة.
                </p>
              )}
              {isCode && (
                <>
                  <button disabled>تشغيل Python — معطل</button>
                  <p className="helper">
                    التنفيذ البرمجي معطل حتى التحقق من أمان بيئة التشغيل. تستطيع
                    استخدام تتبع الكود وترتيب الأسطر والتصحيح الآن.
                  </p>
                </>
              )}
              {isPhysics && (
                <p className="helper">
                  تجربة خُطوة المحلية؛ لا تحتاج خدمة محاكاة خارجية.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
