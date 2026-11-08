import { useEffect, useId, useRef, useState } from "react";
import type { CProblemActivity } from "../../../../packages/contracts/src/advanced-learning";
import type { CProblemSession } from "../../../../packages/contracts/src/advanced-learning-sessions";
import type { AssessmentSession } from "../../../../packages/contracts/src/learning-assessments";
import {
  ProductApi,
  ProductFault,
  messageOf,
  record,
  textField,
} from "../product-api";
import { assessmentSession, enumField } from "../learning-path-api";
import { MathInput } from "../MathInput";
import { readLabResume } from "../stem-lab-view";
import { problemSession } from "./advanced-api";
import { RepresentationSwitcher } from "./RepresentationSwitcher";
import { StudentPreferencesPanel } from "./StudentPreferencesPanel";
import {
  draftKey,
  readLocalDraft,
  writeLocalDraft,
  type ProblemDraft,
} from "./draft-cache";
import {
  defaultDisplayPreferences,
  displayClass,
  stageLabels,
  type ProblemStage,
} from "./display-preferences";

const prompts: Record<ProblemStage, string> = {
  frame: "ما المعطيات والمطلوب؟ ما الوحدات والقيود؟",
  plan: "ما الخطة التي اخترتها ولماذا؟ وما الافتراض الذي تحتاج فحصه؟",
  investigate: "سجّل تجربتك وحساباتك، وما الذي غيّرته في خطتك.",
  justify: "كيف تجيب نتيجتك عن السؤال؟ افحص الوحدة وملاءمة النتيجة للسياق.",
  reflect: "ما الذي تغيّر في تفكيرك؟ وما الذي ستفعله في مشكلة جديدة؟",
};
export function ProblemJourney({
  api,
  activity,
  trackRevisionId,
  lessonRevisionId,
  blockIndex,
  onClose,
  onLab,
  onIndependent,
  onNativeSupport,
}: {
  api: ProductApi;
  activity: CProblemActivity;
  trackRevisionId: string;
  lessonRevisionId: string;
  blockIndex: number;
  onClose: () => void;
  onLab?: (blockIndex: number) => void;
  onIndependent?: (assessment: AssessmentSession) => void;
  onNativeSupport?: (support: {
    kind: "scaffold" | "tutor" | "reflection";
    id: string;
  }) => void;
}) {
  const [session, setSession] = useState<CProblemSession | null>(null),
    [stage, setStage] = useState<ProblemStage>("frame"),
    [drafts, setDrafts] = useState<Partial<Record<ProblemStage, string>>>({}),
    [answer, setAnswer] = useState(""),
    [unit, setUnit] = useState("m/s"),
    [submittedAnswer, setSubmittedAnswer] = useState(""),
    [submittedUnit, setSubmittedUnit] = useState("m/s"),
    [pendingDraft, setPendingDraft] = useState<ProblemDraft | null>(null),
    [preferences, setPreferences] = useState(defaultDisplayPreferences),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [resultStale, setResultStale] = useState(false);
  const epoch = useRef(0),
    localEdit = useRef(0),
    heading = useRef<HTMLHeadingElement>(null),
    id = useId();
  const key = `khotwa-path:c:problem:${trackRevisionId}:${lessonRevisionId}:${blockIndex}`;
  const localKey = draftKey(
    "problem",
    trackRevisionId,
    lessonRevisionId,
    blockIndex,
  );
  function restoreDraft(draft: ProblemDraft, current: CProblemSession) {
    setDrafts({ ...current.answers, ...draft.answers });
    setAnswer(draft.answer);
    setUnit(draft.unit);
    setResultStale(true);
    setPendingDraft(null);
    setNotice(
      "استُعيد النص المحلي بوصفه مسودة غير متحققة. احفظه ثم اطلب تحققًا جديدًا؛ لم نُعد أي نتيجة قديمة.",
    );
  }
  function adopt(next: CProblemSession, restore = false) {
    if (
      next.trackRevisionId !== trackRevisionId ||
      next.lessonRevisionId !== lessonRevisionId ||
      next.blockIndex !== blockIndex
    )
      throw new Error("invalid_response");
    setSession(next);
    if (restore) {
      setDrafts(next.answers);
      setStage(next.stage);
      let cached: ReturnType<typeof readLocalDraft> = null;
      try {
        cached = readLocalDraft(sessionStorage, localKey, next.id);
      } catch {
        /* Optional local draft. */
      }
      if (cached?.schemaVersion === "c-local-problem-draft-v1") {
        if (
          cached.baseRevision === next.revision &&
          next.status === "active" &&
          !next.readOnly
        )
          restoreDraft(cached, next);
        else setPendingDraft(cached);
      }
    }
    try {
      sessionStorage.setItem(key, next.id);
    } catch {
      /* Optional resource ID, never a credential. */
    }
  }
  useEffect(() => {
    const ticket = ++epoch.current;
    heading.current?.focus();
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(key);
    } catch {
      /* Optional resume. */
    }
    if (saved && /^[a-zA-Z0-9-]{1,100}$/.test(saved)) {
      setBusy(true);
      void api
        .request(
          `/learning/problem-sessions/${encodeURIComponent(saved)}`,
          problemSession,
        )
        .then((next) => {
          if (ticket === epoch.current) adopt(next, true);
        })
        .catch((error) => {
          if (
            ticket === epoch.current &&
            !(error instanceof ProductFault && error.status === 404)
          )
            setError(messageOf(error));
        })
        .finally(() => {
          if (ticket === epoch.current) setBusy(false);
        });
    }
    return () => {
      epoch.current++;
    };
  }, [api, key]);
  async function work(
    action: () => Promise<CProblemSession>,
    restore = false,
    verified = false,
  ) {
    if (busy) return;
    const ticket = epoch.current,
      draftVersion = localEdit.current,
      sentAnswer = answer,
      sentUnit = unit;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await action();
      if (ticket === epoch.current) {
        adopt(next, restore);
        if (verified) {
          setSubmittedAnswer(sentAnswer);
          setSubmittedUnit(sentUnit);
          if (draftVersion === localEdit.current) setResultStale(false);
        }
        setNotice("حُفظت النسخة المرسلة. أي كتابة أحدث باقية في المسودة.");
      }
    } catch (error) {
      if (ticket === epoch.current) setError(messageOf(error));
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  const save = (action = "save") => {
    if (!session) return;
    void work(() =>
      api.request(
        `/learning/problem-sessions/${session.id}/steps`,
        problemSession,
        "POST",
        {
          expectedRevision: session.revision,
          stage,
          textAr: drafts[stage] ?? "",
          action,
        },
      ),
    );
  };
  function feedback() {
    if (!session) return;
    let labSessionId: string | null = null;
    if (activity.verification.kind === "stem_lab") {
      try {
        labSessionId = readLabResume(
          sessionStorage,
          trackRevisionId,
          lessonRevisionId,
          activity.verification.blockIndex,
        );
      } catch {
        /* Server determines availability. */
      }
      if (!labSessionId) {
        setError(
          "افتح أداة الاستكشاف المرتبطة وأرسل نتيجتك أولًا. تبقى مسودتك محفوظة هنا.",
        );
        return;
      }
    }
    void work(
      () =>
        api.request(
          `/learning/problem-sessions/${session.id}/feedback`,
          problemSession,
          "POST",
          {
            expectedRevision: session.revision,
            ...(labSessionId
              ? { labSessionId }
              : {
                  answer:
                    activity.subject === "algebra"
                      ? { raw: answer }
                      : activity.subject === "physics"
                        ? { value: answer, unit }
                        : { output: answer },
                }),
          },
        ),
      false,
      true,
    );
  }
  async function nativeSupport(kind: "scaffold" | "tutor" | "reflection") {
    if (!session || busy) return;
    const ticket = epoch.current;
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/learning/problem-sessions/${session.id}/support`,
        (value) => {
          const r = record(value),
            s = record(r.support);
          return {
            session: problemSession(r.session),
            support: {
              kind: enumField(s.kind, ["scaffold", "tutor", "reflection"]),
              id: textField(s.id),
            },
          };
        },
        "POST",
        { expectedRevision: session.revision, kind },
      );
      if (ticket === epoch.current) {
        adopt(next.session);
        onNativeSupport?.(next.support);
        setNotice(
          "فُتحت مساحة الدعم المحفوظة أعلى صفحة الدرس. تبقى هذه المشكلة ومسودتك كما هي.",
        );
      }
    } catch (error) {
      if (ticket === epoch.current) setError(messageOf(error));
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  async function independent() {
    if (!session || busy) return;
    const ticket = epoch.current;
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/learning/problem-sessions/${session.id}/assessment`,
        (value) => {
          const r = record(value);
          return {
            session: problemSession(r.session),
            assessment: assessmentSession(r.assessment),
          };
        },
        "POST",
        { expectedRevision: session.revision },
      );
      if (ticket === epoch.current) {
        adopt(next.session);
        onIndependent?.(next.assessment);
      }
    } catch (error) {
      if (ticket === epoch.current) setError(messageOf(error));
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  const locked =
    busy || !session || session.readOnly || session.status !== "active";
  const dirty =
    !!session &&
    Object.keys(stageLabels).some(
      (key) =>
        (drafts[key as ProblemStage] ?? "") !==
        (session.answers[key as ProblemStage] ?? ""),
    );
  const answerDirty = answer !== submittedAnswer || unit !== submittedUnit;
  useEffect(() => {
    if (!session || pendingDraft) return;
    const answers = Object.fromEntries(
      (Object.keys(stageLabels) as ProblemStage[])
        .filter((key) => (drafts[key] ?? "") !== (session.answers[key] ?? ""))
        .map((key) => [key, drafts[key] ?? ""]),
    );
    try {
      writeLocalDraft(
        sessionStorage,
        localKey,
        Object.keys(answers).length || (answerDirty && answer.length)
          ? {
              schemaVersion: "c-local-problem-draft-v1",
              sessionId: session.id,
              baseRevision: session.revision,
              answers,
              answer: answerDirty ? answer : "",
              unit,
            }
          : null,
      );
    } catch {
      /* Local caching is optional. */
    }
  }, [session, drafts, answer, unit, answerDirty, localKey, pendingDraft]);
  useEffect(() => {
    if (!dirty && !answerDirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, answerDirty]);
  useEffect(() => {
    if (
      !session ||
      session.readOnly ||
      session.status !== "active" ||
      busy ||
      error
    )
      return;
    const changed = (Object.keys(stageLabels) as ProblemStage[]).find(
      (key) => (drafts[key] ?? "") !== (session.answers[key] ?? ""),
    );
    if (!changed) return;
    const timer = window.setTimeout(() => {
      void work(() =>
        api.request(
          `/learning/problem-sessions/${session.id}/steps`,
          problemSession,
          "POST",
          {
            expectedRevision: session.revision,
            stage: changed,
            textAr: drafts[changed] ?? "",
            action: "save",
          },
        ),
      );
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [drafts, session, busy, error]);
  return (
    <section
      className={`${displayClass(preferences)} c-workspace`}
      style={{ fontSize: `${preferences.textScale}em` }}
      aria-labelledby={id}
      dir="rtl"
    >
      <h3 id={id} ref={heading} tabIndex={-1}>
        {activity.titleAr}
      </h3>
      <p>{activity.scenarioAr}</p>
      <p>{activity.publicBriefAr}</p>
      <p className="helper">
        تجربة اصطناعية للتعلّم. إكمال المشكلة أو طلب الدعم لا يمنح دليل إتقان
        مستقلًا.
      </p>
      <StudentPreferencesPanel value={preferences} onChange={setPreferences} />
      <ul>
        {activity.constraints.map((constraint, i) => (
          <li key={i}>{constraint}</li>
        ))}
      </ul>
      <RepresentationSwitcher
        variants={activity.representations}
        onLab={onLab}
      />
      {activity.publicRubric.length > 0 && (
        <details>
          <summary>كيف أراجع جودة عملي؟</summary>
          <dl>
            {activity.publicRubric.map((criterion) => (
              <div key={criterion.code}>
                <dt>{criterion.titleAr}</dt>
                <dd>{criterion.descriptionAr}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {!session ? (
        <button
          disabled={busy}
          onClick={() =>
            void work(
              () =>
                api.request(
                  "/learning/problem-sessions",
                  problemSession,
                  "POST",
                  { trackRevisionId, lessonRevisionId, blockIndex },
                ),
              true,
            )
          }
        >
          {busy ? "جارٍ استعادة العمل…" : "ابدأ بتفكيك المشكلة"}
        </button>
      ) : (
        <>
          {session.readOnly && (
            <p role="status">
              بدء العمل والتعديل متوقفان حاليًا. هذه نسختك المحفوظة للقراءة.
            </p>
          )}
          {pendingDraft && (
            <aside className="c-feedback" aria-label="مسودة محلية لنسخة سابقة">
              <h4>لديك نص محلي مرتبط بنسخة سابقة</h4>
              <p>
                تحقق الخادم من ملكيتك للمحاولة، لكن مراجعتها أو حالتها تغيّرت.
                لا ندمج النص أو نتيجة قديمة تلقائيًا.
              </p>
              <details>
                <summary>راجع النص المحلي غير المتحقق</summary>
                {Object.entries(pendingDraft.answers).map(([stage, text]) => (
                  <p key={stage}>
                    {stageLabels[stage as ProblemStage]}: {text}
                  </p>
                ))}
                <pre dir="auto">{pendingDraft.answer}</pre>
              </details>
              <button
                disabled={
                  busy || session.readOnly || session.status !== "active"
                }
                onClick={() => restoreDraft(pendingDraft, session)}
              >
                استعد النص للمراجعة والحفظ على النسخة الحالية
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setPendingDraft(null);
                  try {
                    writeLocalDraft(sessionStorage, localKey, null);
                  } catch {
                    /* Optional cache. */
                  }
                }}
              >
                تخلّص من هذه المسودة المحلية
              </button>
            </aside>
          )}
          <nav className="c-stage-nav" aria-label="مراحل التفكير">
            {activity.stages.map((item) => (
              <button
                key={item}
                type="button"
                aria-current={item === stage ? "step" : undefined}
                onClick={() => {
                  setStage(item);
                  setError("");
                }}
              >
                {stageLabels[item]}
              </button>
            ))}
          </nav>
          <label htmlFor={`${id}-draft`}>{stageLabels[stage]}</label>
          <p id={`${id}-prompt`}>{prompts[stage]}</p>
          <textarea
            id={`${id}-draft`}
            aria-describedby={`${id}-prompt ${id}-saved`}
            maxLength={3000}
            value={drafts[stage] ?? ""}
            readOnly={session.readOnly || session.status !== "active"}
            onChange={(event) => {
              localEdit.current++;
              setResultStale(true);
              setError("");
              setDrafts((previous) => ({
                ...previous,
                [stage]: event.target.value,
              }));
            }}
          />
          <p id={`${id}-saved`} role="status">
            {dirty
              ? "توجد كتابة تنتظر الحفظ التلقائي. يمكنك حفظ المرحلة يدويًا؛ لا تغلق قبل تأكيد الحفظ."
              : "مطابق للنسخة المحفوظة."}
          </p>
          <div className="actions">
            <button disabled={locked} onClick={() => save()}>
              احفظ المرحلة
            </button>
            {activity.supportPolicy.hintsAllowed && (
              <button disabled={locked} onClick={() => save("hint")}>
                اطلب دعمًا تعليميًا
              </button>
            )}
            {session.status === "active" && (
              <button disabled={locked || dirty} onClick={() => save("pause")}>
                أوقف مؤقتًا بعد الحفظ
              </button>
            )}
            {session.status === "paused" && (
              <button
                disabled={busy || session.readOnly}
                onClick={() => save("resume")}
              >
                استأنف العمل
              </button>
            )}
            <button
              disabled={busy}
              onClick={() =>
                void work(() =>
                  api.request(
                    `/learning/problem-sessions/${session.id}`,
                    problemSession,
                  ),
                )
              }
            >
              حدّث حالة النسخة
            </button>
          </div>
          {session.supportAr && (
            <aside className="c-feedback" aria-label="دعم تعليمي">
              <p>{session.supportAr}</p>
              <p>سُجّل استخدام المساعدة.</p>
            </aside>
          )}
          {session.status !== "completed" && session.status !== "abandoned" && (
            <details>
              <summary>التوقف عن هذه المحاولة</summary>
              <p>
                يمكنك ترك هذه المحاولة مع الاحتفاظ بتاريخها؛ لا يُحسب ذلك فشلًا
                مفاهيميًا.
              </p>
              <button
                disabled={busy || session.readOnly || dirty}
                onClick={() => save("abandon")}
              >
                اترك المحاولة الحالية بعد حفظ العمل
              </button>
            </details>
          )}
          {activity.supportPolicy.revealMode === "after_submit" &&
            session.result && (
              <button disabled={locked || dirty} onClick={() => save("reveal")}>
                اطلب كشف الحل بعد المحاولة — مساعدة H4
              </button>
            )}
          {onNativeSupport && (
            <fieldset disabled={locked || dirty}>
              <legend>مساحات دعم مرتبطة بخطتك</legend>
              <p>
                تُفتح الأدوات المفعّلة فقط. تتبع المساعدة سياسة التعلم القائمة،
                ولا تضيف إتقانًا مستقلًا.
              </p>
              <div className="actions">
                {activity.supportPolicy.hintsAllowed && (
                  <>
                    <button onClick={() => void nativeSupport("scaffold")}>
                      دعم متدرّج ثم محاولة جديدة
                    </button>
                    <button onClick={() => void nativeSupport("tutor")}>
                      حوار توجيهي حول الفكرة
                    </button>
                  </>
                )}
                <button
                  disabled={
                    !session.answers.reflect ||
                    session.answers.reflect.length > 1000
                  }
                  onClick={() => void nativeSupport("reflection")}
                >
                  احفظ تأملي في سجل التعلم
                </button>
              </div>
            </fieldset>
          )}
          {stage === "investigate" && (
            <fieldset disabled={locked}>
              <legend>افحص النتيجة ضمن النطاق المدعوم</legend>
              {activity.verification.kind === "stem_lab" ? (
                <>
                  <p>
                    التجربة تُراجع بأداة المادة المرتبطة؛ لا تُصدر هذه الصفحة
                    حكمًا محليًا.
                  </p>
                  <button
                    onClick={() =>
                      onLab?.(
                        activity.verification.kind === "stem_lab"
                          ? activity.verification.blockIndex
                          : 0,
                      )
                    }
                    disabled={!onLab}
                  >
                    افتح أداة التجربة
                  </button>
                </>
              ) : activity.subject === "algebra" ? (
                <MathInput
                  id={`${id}-answer`}
                  value={answer}
                  onChange={(value) => {
                    localEdit.current++;
                    setResultStale(true);
                    setAnswer(value);
                  }}
                />
              ) : (
                <label>
                  {activity.subject === "physics"
                    ? "القيمة التي توصلت إليها"
                    : "الناتج الذي تتوقعه — دون تشغيل كود"}
                  <textarea
                    dir="ltr"
                    value={answer}
                    onChange={(event) => {
                      localEdit.current++;
                      setResultStale(true);
                      setAnswer(event.target.value);
                    }}
                  />
                </label>
              )}
              {activity.subject === "physics" &&
                activity.verification.kind !== "stem_lab" && (
                  <label>
                    وحدة النتيجة
                    <select
                      value={unit}
                      onChange={(event) => {
                        localEdit.current++;
                        setResultStale(true);
                        setUnit(event.target.value);
                      }}
                    >
                      {["m", "s", "m/s", "m/s²", "km/h"].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              <button disabled={dirty} onClick={feedback}>
                اطلب تغذية راجعة بعد حفظ المراحل
              </button>
            </fieldset>
          )}
          {session.result && !resultStale && !dirty && (
            <aside className="c-feedback" aria-label="نتيجة التحقق">
              <h4>
                {session.result.result === "needs_review"
                  ? "تحتاج مراجعة بشرية"
                  : session.result.result === "cannot_determine"
                    ? "تعذر إصدار حكم"
                    : session.result.result === "correct_practice"
                      ? "نتيجة تدريب متحققة"
                      : "راجع نتيجة التدريب"}
              </h4>
              <p>{session.result.feedbackAr}</p>
              <p>
                الخطة والتفسير المفتوحان يحتاجان مراجعة؛ الحكم المحدود لا يعني
                تشخيصًا مؤكدًا.
              </p>
            </aside>
          )}
          {resultStale && (
            <p role="status">
              تغيّرت المسودة؛ اطلب تحققًا جديدًا بعد حفظ جميع مراحل تفكيرك.
            </p>
          )}
          <div className="actions">
            <button
              disabled={locked || dirty || resultStale || !session.result}
              onClick={() =>
                void work(() =>
                  api.request(
                    `/learning/problem-sessions/${session.id}/finish`,
                    problemSession,
                    "POST",
                    { expectedRevision: session.revision },
                  ),
                )
              }
            >
              أنهِ نشاط التعلّم بعد حفظ المراحل والتحقق
            </button>
            {session.status === "completed" && onIndependent && (
              <button
                disabled={busy || session.readOnly}
                onClick={() => void independent()}
              >
                ابحث عن تقييم جديد مستقل
              </button>
            )}
          </div>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {answerDirty && !!answer && (
        <p role="status">
          إجابتك غير المرسلة محفوظة كمسودة محلية في علامة التبويب هذه عند توفر
          التخزين. لا تمثل نتيجة تحقق.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button onClick={onClose} disabled={busy || dirty}>
        ارجع للدرس{dirty ? " — انتظر حفظ المسودة" : ""}
      </button>
    </section>
  );
}
