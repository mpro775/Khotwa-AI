import { useRef, useState } from "react";
import { ApiClient, ClientFault } from "./api-client";
import type { Schema } from "./api-client";
import { MathInput } from "./MathInput";
import { DiagnosticPanel } from "./DiagnosticPanel";
import { HintPanel } from "./HintPanel";
import { StudentProgress } from "./StudentProgress";
import { EpisodePanel } from "./EpisodePanel";
import { canAdoptHint } from "./workspace-model";
import {
  canAdoptVerification,
  statusLabels,
  arabicNumber,
} from "./workspace-model";
import { visibleRaw } from "./editor-model";

interface PendingMutation {
  path: string;
  method: string;
  body:
    | Schema<"CreateStepInput">
    | Schema<"EditStepInput">
    | Schema<"DeleteStepInput">;
  key: string;
  epoch: number;
}
export function StudentWorkspace() {
  const [probeOpen, setProbeOpen] = useState(false),
    [assistedSeen, setAssistedSeen] = useState(false);
  const [helpEpoch, setHelpEpoch] = useState(0);
  const api = useRef(new ApiClient()).current;
  const [started, setStarted] = useState(false),
    [busy, setBusy] = useState(false),
    [verifying, setVerifying] = useState(false);
  const [learning, setLearning] = useState<Schema<"LearningSession"> | null>(
    null,
  );
  const [skills, setSkills] = useState<Schema<"Skill">[]>([]),
    [problems, setProblems] = useState<Schema<"ProblemSummary">[]>([]),
    [skillId, setSkillId] = useState("");
  const [problem, setProblem] = useState<Schema<"ProblemDetail"> | null>(null),
    [attempt, setAttempt] = useState<Schema<"Attempt"> | null>(null);
  const attemptRef = useRef<Schema<"Attempt"> | null>(null),
    epoch = useRef(0),
    pending = useRef<PendingMutation | null>(null),
    verifyKey = useRef<{ identity: string; key: string } | null>(null);
  const [raw, setRaw] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [dirty, setDirty] = useState(false),
    [retry, setRetry] = useState(false);
  const [report, setReport] = useState<Schema<"VerificationReport"> | null>(
      null,
    ),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  function adopt(next: Schema<"Attempt">) {
    if (
      attemptRef.current &&
      attemptRef.current.id === next.id &&
      attemptRef.current.revision > next.revision
    )
      return;
    attemptRef.current = next;
    setAttempt(next);
  }
  function invalidate() {
    epoch.current++;
    setReport(null);
    verifyKey.current = null;
    setNotice("تغيّرت المسودة؛ يلزم حفظها وإعادة التحقق قبل عرض حكم عليها.");
  }
  function edit(next: string) {
    invalidate();
    setRaw(next);
    setDirty(true);
    setRetry(false);
    pending.current = null;
    setError("");
  }
  async function refresh() {
    const current = attemptRef.current;
    if (current) {
      const latest = await api.request(
        "/attempts/" + current.id,
        "AttemptEnvelope",
      );
      adopt(latest);
      return latest;
    }
    return null;
  }
  function failure(e: unknown) {
    setErrorCode(e instanceof ClientFault ? e.code : "unknown");
    setError(
      e instanceof ClientFault
        ? e.messageAr
        : "تعذرت العملية. بقيت المسودة كما كتبتها.",
    );
  }
  async function start() {
    setBusy(true);
    setError("");
    try {
      await api.start();
      setStarted(true);
      setSkills((await api.request("/skills", "SkillListEnvelope")).items);
      let restored = false;
      try {
        const saved = sessionStorage.getItem("khotwa-active-attempt");
        if (saved) {
          const ids: unknown = JSON.parse(saved);
          if (
            ids &&
            typeof ids === "object" &&
            "attemptId" in ids &&
            "problemId" in ids &&
            typeof ids.attemptId === "string" &&
            typeof ids.problemId === "string" &&
            /^[\da-f-]{36}$/i.test(ids.attemptId) &&
            /^[\da-f-]{36}$/i.test(ids.problemId)
          ) {
            const previous = await api.request(
              "/attempts/" + ids.attemptId,
              "AttemptEnvelope",
            );
            const question = await api.request(
              "/problems/" + ids.problemId,
              "ProblemEnvelope",
            );
            if (previous.problemRevisionId === question.revisionId) {
              const session = await api.request(
                "/learning-sessions/" + previous.learningSessionId,
                "LearningSessionEnvelope",
              );
              setLearning(session);
              setProblem(question);
              adopt(previous);
              setReport(previous.currentVerification);
              restored = true;
              setNotice("استُعيدت المحاولة المحفوظة من الخادم.");
            }
          }
        }
      } catch {
        /* Previous guests/resources may expire. UUIDs never grant access. */
      }
      if (!restored)
        setLearning(
          await api.request(
            "/learning-sessions",
            "LearningSessionEnvelope",
            "POST",
            {},
            crypto.randomUUID(),
          ),
        );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function chooseSkill(id: string) {
    setBusy(true);
    setError("");
    setSkillId(id);
    try {
      setProblems(
        (
          await api.request(
            "/problems?skillId=" + encodeURIComponent(id),
            "ProblemListEnvelope",
          )
        ).items,
      );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function openProblem(item: Schema<"ProblemSummary">) {
    if (!learning) return;
    const openingEpoch = epoch.current;
    setBusy(true);
    setError("");
    try {
      const detail = await api.request(
        "/problems/" + item.id,
        "ProblemEnvelope",
      );
      const created = await api.request(
        "/attempts",
        "AttemptEnvelope",
        "POST",
        {
          learningSessionId: learning.id,
          source: { kind: "catalog", problemRevisionId: detail.revisionId },
        },
        crypto.randomUUID(),
      );
      const preserveDraft = dirty || epoch.current !== openingEpoch;
      invalidate();
      setProblem(detail);
      setAssistedSeen(false);
      adopt(created);
      if (!preserveDraft) setRaw("");
      setDirty(preserveDraft);
      setEditing(null);
      setRetry(false);
      pending.current = null;
      setNotice(
        preserveDraft
          ? "بدأت مسألة جديدة، وبقيت مسودتك غير مرسلة. راجعها قبل حفظها في هذه المسألة."
          : "حُفظت بداية المحاولة. أضف أول خطوة.",
      );
      try {
        sessionStorage.setItem(
          "khotwa-active-attempt",
          JSON.stringify({ attemptId: created.id, problemId: detail.id }),
        );
      } catch {
        /* Optional resource IDs only; no learner text or bearer secret. */
      }
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function sendMutation(operation: PendingMutation) {
    setBusy(true);
    setError("");
    setRetry(false);
    setReport(null);
    try {
      await api.request(
        operation.path,
        "StepMutationEnvelope",
        operation.method,
        operation.body,
        operation.key,
      );
      await refresh();
      pending.current = null;
      if (epoch.current === operation.epoch) {
        setRaw("");
        setEditing(null);
        setDirty(false);
        setNotice("حُفظ التغيير. أعد التحقق من السلسلة الحالية.");
      }
    } catch (e) {
      failure(e);
      if (e instanceof ClientFault && e.status === 409) {
        pending.current = null;
        await refresh().catch(() => {});
        setNotice("تحدّثت المحاولة؛ مسودتك باقية. راجعها ثم احفظها من جديد.");
      } else {
        pending.current = operation;
        setRetry(true);
      }
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const current = attemptRef.current;
    if (!current || !raw.length || [...raw].length > 256) return;
    const operation: PendingMutation = {
      path:
        "/attempts/" + current.id + "/steps" + (editing ? "/" + editing : ""),
      method: editing ? "PUT" : "POST",
      body: editing
        ? {
            expectedRevision: current.revision,
            sourceRaw: raw,
            inputOrigin: "math_editor",
          }
        : {
            expectedRevision: current.revision,
            position: current.steps.length + 1,
            sourceRaw: raw,
            inputOrigin: "math_editor",
          },
      key: crypto.randomUUID(),
      epoch: epoch.current,
    };
    pending.current = operation;
    await sendMutation(operation);
  }
  function editStep(step: Schema<"Step">) {
    invalidate();
    setEditing(step.id);
    setRaw(step.source.sourceRaw);
    setDirty(true);
    pending.current = null;
    setRetry(false);
    setError("");
    document.getElementById("step-draft")?.focus();
  }
  async function removeStep(step: Schema<"Step">) {
    const current = attemptRef.current;
    if (!current) return;
    invalidate();
    const operation: PendingMutation = {
      path: "/attempts/" + current.id + "/steps/" + step.id,
      method: "DELETE",
      body: { expectedRevision: current.revision },
      key: crypto.randomUUID(),
      epoch: epoch.current,
    };
    pending.current = operation;
    await sendMutation(operation);
  }
  async function verify(target: string | null = null) {
    const current = attemptRef.current;
    if (!current || dirty || !current.steps.length) return;
    const ticket = {
      attemptId: current.id,
      revision: current.revision,
      problemRevisionId: current.problemRevisionId,
      editEpoch: epoch.current,
    };
    const identity = [current.id, current.revision, target ?? "sequence"].join(
      ":",
    );
    if (verifyKey.current?.identity !== identity)
      verifyKey.current = { identity, key: crypto.randomUUID() };
    setVerifying(true);
    setError("");
    setNotice(
      "جارٍ التحقق. يمكنك تحرير خطوة أثناء الانتظار؛ لن نعتمد ردًا يخص نسخة قديمة.",
    );
    try {
      const result = await api.request(
        "/attempts/" + current.id + "/verify",
        "VerificationEnvelope",
        "POST",
        {
          expectedRevision: current.revision,
          scope: target ? "target_edge" : "current_sequence",
          targetStepId: target,
        },
        verifyKey.current!.key,
      );
      if (
        canAdoptVerification(ticket, attemptRef.current, epoch.current, result)
      ) {
        const refreshed = await api.request(
          "/attempts/" + current.id,
          "AttemptEnvelope",
        );
        if (attemptRef.current?.id === refreshed.id) adopt(refreshed);
        if (
          canAdoptVerification(
            ticket,
            attemptRef.current,
            epoch.current,
            result,
          )
        ) {
          setReport(result);
          setNotice("اكتمل التحقق من النسخة المحفوظة.");
        } else setReport(null);
      }
    } catch (e) {
      if (epoch.current === ticket.editEpoch) {
        failure(e);
        if (e instanceof ClientFault && e.status === 409) {
          setReport(null);
          await refresh().catch(() => {});
        }
      }
    } finally {
      setVerifying(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("نُسخ النص الأصلي حرفيًا.");
    } catch {
      setNotice("حدد النص الأصلي واستخدم النسخ في جهازك.");
    }
  }
  return (
    <main className="student-workspace">
      <header>
        <span className="brand">
          خُطوة <span lang="en">AI</span>
        </span>
        <a href="/editor-lab">مختبر المحرر</a>
      </header>
      <nav aria-label="التنقل">
        <a href="/demo/teacher">عرض المعلم — بيانات اصطناعية</a>
      </nav>
      <div className="intro">
        <span className="eyebrow">الجبر الخطي بمجهول واحد: س</span>
        <h1>حلّك، خطوة بخطوة.</h1>
        <p>
          اكتب خطواتك بالعربية، ثم تحقق من تكافؤها. الحكم الرياضي مستقل عن تفسير
          سبب الخطأ.
        </p>
        <p className="helper">
          نسخة الهاكثون للحاسوب. عرض الكسور غير معتمد في هذه النسخة؛ استخدم
          مسائل الأعداد الصحيحة المتاحة. التلميحات قد تأتي من قوالب ثابتة.
        </p>
      </div>
      {learning?.isSynthetic && (
        <p className="test-banner" role="note">
          بيانات اختبار اصطناعية — هذه المسائل لفحص التكامل، وليست محتوى
          تعليميًا معتمدًا.
        </p>
      )}
      <div className="session-line">
        <button
          className="primary"
          disabled={busy}
          onClick={() => void start()}
        >
          {started ? "استعد الجلسة والمحاولة المحفوظة" : "ابدأ جلسة ضيف"}
        </button>
        <p className="helper">
          لا نطلب اسمًا أو بريدًا أو هاتفًا. عمر الجلسة ٢٤ ساعة، وتنتهي بعد
          ساعتين من الخمول.
        </p>
      </div>
      {error && (
        <div
          className="service-notice"
          role="alert"
          data-status={
            errorCode === "math_unavailable" ? "service_error" : undefined
          }
        >
          <strong>
            {errorCode === "math_unavailable"
              ? "تعذر التحقق الآن"
              : "لم تكتمل العملية"}
          </strong>
          <p>{error}</p>
          <small>لا يعد تعذر الخدمة خطأً رياضيًا أو ضعفًا في المفهوم.</small>
        </div>
      )}
      <p role="status" aria-live="polite" className="workspace-notice">
        {notice}
      </p>
      {started && learning && !dirty && !busy && !verifying && (
        <StudentProgress
          key={`${learning.id}:${attempt?.id ?? "none"}:${attempt?.revision ?? 0}:${report?.id ?? "none"}:${helpEpoch}:${epoch.current}`}
          api={api}
          learningId={learning.id}
        />
      )}
      {started && (
        <section className="catalog-card" aria-label="كتالوج الجبر">
          <h2>اختر مهارة ومسألة</h2>
          <div className="choices">
            {skills.map((s) => (
              <button
                key={s.id}
                disabled={busy || s.availability === "unavailable"}
                aria-pressed={skillId === s.id}
                onClick={() => void chooseSkill(s.id)}
              >
                {s.titleAr}
              </button>
            ))}
          </div>
          {!skills.length && (
            <p>لا تتوفر مهارات بمحتوى منشور بعد المراجعة حاليًا.</p>
          )}
          <div className="problem-choices">
            {problems.map((p) => (
              <button
                key={p.revisionId}
                disabled={busy}
                onClick={() => void openProblem(p)}
              >
                {p.titleAr}
              </button>
            ))}
          </div>
        </section>
      )}
      {problem && attempt && (
        <>
          <section className="question-card" aria-labelledby="question-title">
            <h2 id="question-title">المسألة الحالية</h2>
            <p>{problem.statementAr}</p>
            <bdi className="math-text question-equation" dir="ltr">
              {problem.originalEquation}
            </bdi>
          </section>
          <div className="workspace live-workspace">
            <section
              className="editor-card"
              aria-labelledby="live-editor-title"
            >
              <h2 id="live-editor-title">
                {editing ? "تحرير خطوة محفوظة" : "أضف خطوة جديدة"}
              </h2>
              <MathInput value={raw} onChange={edit} />
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy || !raw.length || [...raw].length > 256}
                  onClick={() => void save()}
                >
                  {editing ? "احفظ نسخة التعديل" : "احفظ الخطوة"}
                </button>
                <button onClick={() => void copy(raw)}>انسخ المسودة</button>
                {editing && (
                  <button
                    onClick={() => {
                      invalidate();
                      setRaw("");
                      setEditing(null);
                      setDirty(false);
                      setNotice("عُدت إلى إضافة خطوة جديدة.");
                    }}
                  >
                    أضف خطوة أخرى
                  </button>
                )}
              </div>
              {retry && pending.current && (
                <button
                  disabled={busy}
                  onClick={() =>
                    pending.current && void sendMutation(pending.current)
                  }
                >
                  أعد إرسال الطلب نفسه
                </button>
              )}
              <p className="helper">
                {dirty
                  ? "لديك مسودة لم تؤكد الخدمة حفظها بعد."
                  : "تظهر الخطوات المؤكدة في سجل الحل."}
              </p>
            </section>
            <section className="preview-card" aria-labelledby="steps-heading">
              <div className="card-heading">
                <h2 id="steps-heading">خطواتك المحفوظة</h2>
                <span className="badge">
                  إصدار {arabicNumber(attempt.revision)}
                </span>
              </div>
              {!attempt.steps.length && (
                <p>ابدأ بخطوة مكافئة للمعادلة الأصلية.</p>
              )}
              <ol className="saved-steps">
                {attempt.steps.map((step) => (
                  <li key={step.id}>
                    <div className="step-line">
                      <strong>الخطوة {arabicNumber(step.position)}</strong>
                      <small>النسخة {arabicNumber(step.currentVersion)}</small>
                    </div>
                    <span className="helper">النص الأصلي</span>
                    <code dir="ltr" className="math-text">
                      {visibleRaw(step.source.sourceRaw)}
                    </code>
                    {step.source.parseStatus === "parsed" &&
                      step.source.displayAr && (
                        <>
                          <span className="helper">العرض بعد قراءة الصيغة</span>
                          <bdi dir="ltr" className="math-text parsed-equation">
                            {step.source.displayAr}
                          </bdi>
                        </>
                      )}
                    <div className="step-actions">
                      <button disabled={busy} onClick={() => editStep(step)}>
                        حرّر الخطوة {arabicNumber(step.position)}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void copy(step.source.sourceRaw)}
                      >
                        انسخ الأصل
                      </button>
                      <button
                        disabled={busy || verifying || dirty}
                        onClick={() => void verify(step.id)}
                      >
                        تحقق من هذا الانتقال
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void removeStep(step)}
                      >
                        احذف الخطوة {arabicNumber(step.position)}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                className="primary verify-sequence"
                disabled={busy || verifying || dirty || !attempt.steps.length}
                onClick={() => void verify()}
              >
                {verifying ? "جارٍ التحقق…" : "تحقق من سلسلة الحل"}
              </button>
              {dirty && (
                <p className="helper">
                  احفظ المسودة أولًا للتحقق من النسخة الجديدة.
                </p>
              )}
            </section>
          </div>
          {(assistedSeen || attempt.status === "assisted_completed") && (
            <p className="assistance-badge" role="note">
              سُجلت مساعدة لهذه المحاولة؛ اكتمالها لا يُعد حلًا مستقلًا.
            </p>
          )}
          {!dirty && !busy && !verifying && (
            <EpisodePanel
              key={`episode:${attempt.id}:${attempt.revision}:${report?.id ?? "none"}:${epoch.current}:${helpEpoch}`}
              api={api}
              attempt={attempt}
              report={report}
              onOpen={(next, question) => {
                invalidate();
                setProblem(question);
                adopt(next);
                setRaw("");
                setDirty(false);
                setEditing(null);
                setRetry(false);
                pending.current = null;
                setReport(next.currentVerification);
                setAssistedSeen(next.status === "assisted_completed");
                setProbeOpen(false);
                try {
                  sessionStorage.setItem(
                    "khotwa-active-attempt",
                    JSON.stringify({
                      attemptId: next.id,
                      problemId: question.id,
                    }),
                  );
                } catch {
                  /* Optional IDs only. */
                }
                setNotice(
                  next.kind === "transfer"
                    ? "هذه مسألة مختلفة؛ اكتب الحل دون مساعدة إن أردت دليلًا مستقلًا."
                    : "اكتب حل التدريب؛ يمكنك طلب مساعدة مع تسجيلها.",
                );
              }}
            />
          )}
          {!dirty && (
            <HintPanel
              key={`${attempt.id}:${attempt.revision}:${report?.id ?? "original"}:${epoch.current}`}
              api={api}
              attempt={attempt}
              report={report}
              probeOpen={probeOpen}
              onServed={(event) => {
                if (canAdoptHint(attemptRef.current, event)) {
                  setAssistedSeen(true);
                  setHelpEpoch((n) => n + 1);
                }
              }}
            />
          )}
          {report && !dirty && (
            <section
              className="verification-card"
              aria-labelledby="verification-heading"
            >
              <h2 id="verification-heading">نتيجة التحقق الرياضي</h2>
              {report.transitions.map((t, i) => (
                <article
                  key={t.verificationResultId}
                  className={"verdict verdict-" + t.mathStatus}
                  data-status={t.mathStatus}
                >
                  <div className="step-line">
                    <h3>{statusLabels[t.mathStatus]}</h3>
                    <span>
                      {t.from.kind === "problem"
                        ? "من المسألة الأصلية"
                        : "من الخطوة " +
                          arabicNumber(
                            attempt.steps.find((s) => s.id === t.from.stepId)
                              ?.position ?? 0,
                          )}{" "}
                      إلى الخطوة{" "}
                      {arabicNumber(
                        attempt.steps.find((s) => s.id === t.to.stepId)
                          ?.position ?? i + 1,
                      )}
                    </span>
                  </div>
                  {report.firstBlockingTransitionIndex !== null &&
                    i > report.firstBlockingTransitionIndex && (
                      <p className="helper">
                        هذه نتيجة انتقال محلي؛ السلسلة السابقة لم تُثبت كاملة.
                      </p>
                    )}
                  {t.issue && <p>{t.issue.messageAr}</p>}
                  {[
                    "syntax_error",
                    "unsupported",
                    "inconclusive",
                    "service_error",
                  ].includes(t.mathStatus) && (
                    <p>هذه الحالة لا تعني تعثرًا مفاهيميًا للطالب.</p>
                  )}
                  {t.mathStatus === "verified_invalid" && (
                    <p>
                      ثبت اختلاف مجموعتي الحل؛ لا يحدد ذلك وحده سبب الخطأ أو
                      مستوى فهمك.
                    </p>
                  )}
                  {t.evidence?.witness && (
                    <details>
                      <summary>اعرض الشاهد الرياضي</summary>
                      <p>
                        عند{" "}
                        <bdi dir="ltr">
                          س = {arabicNumber(t.evidence.witness.value.num)}
                          {t.evidence.witness.value.den === "1"
                            ? ""
                            : "/" + arabicNumber(t.evidence.witness.value.den)}
                        </bdi>
                        ،{" "}
                        {t.evidence.witness.satisfiesPrevious
                          ? "تتحقق"
                          : "لا تتحقق"}{" "}
                        المعادلة السابقة، و
                        {t.evidence.witness.satisfiesNext
                          ? "تتحقق"
                          : "لا تتحقق"}{" "}
                        المعادلة التالية.
                      </p>
                    </details>
                  )}
                </article>
              ))}
              <DiagnosticPanel
                onProbeOpenChange={setProbeOpen}
                canRequestProbe={
                  !assistedSeen && attempt.status !== "assisted_completed"
                }
                key={report.id}
                api={api}
                report={report}
                onAnswer={(result) => {
                  if (
                    attemptRef.current?.id === result.attemptId &&
                    attemptRef.current.revision === result.attemptRevision &&
                    !dirty
                  )
                    setReport((current) =>
                      current?.id === report.id
                        ? { ...current, diagnosisCandidate: result.diagnosis }
                        : current,
                    );
                }}
              />
              <div
                className={
                  "completion " +
                  (report.completion.canMarkAttemptCompleted ? "complete" : "")
                }
                role="status"
              >
                <h3>
                  {report.completion.canMarkAttemptCompleted
                    ? "اكتمل الحل رياضيًا"
                    : report.scope === "target_edge"
                      ? "نتيجة انتقال واحد"
                      : "لم يُعتمد اكتمال الحل"}
                </h3>
                <p>{report.completion.explanationAr}</p>
                {report.completion.canMarkAttemptCompleted && (
                  <small>
                    هذه نتيجة لهذه المحاولة، ولا تثبت وحدها إتقانًا دائمًا
                    للمفهوم.
                  </small>
                )}
              </div>
            </section>
          )}
        </>
      )}
      <footer>
        نطاق التحقق: معادلة خطية في س ومعاملات صحيحة أو كسور عددية محددة. الدوال
        والمقامات المتغيرة خارج الدعم الحالي.
      </footer>
    </main>
  );
}
