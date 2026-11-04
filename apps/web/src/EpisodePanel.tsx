import { useEffect, useRef, useState } from "react";
import { ApiClient, ClientFault, type Schema } from "./api-client";
import { arabicNumber } from "./workspace-model";
export function EpisodePanel({
  api,
  attempt,
  report,
  onOpen,
}: {
  api: ApiClient;
  attempt: Schema<"Attempt">;
  report: Schema<"VerificationReport"> | null;
  onOpen: (
    attempt: Schema<"Attempt">,
    problem: Schema<"ProblemDetail">,
  ) => void;
}) {
  const [episode, setEpisode] = useState<Schema<"LearningEpisode"> | null>(
      null,
    ),
    [progress, setProgress] = useState<Schema<"ProgressSummary"> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [paused, setPaused] = useState(false);
  const alive = useRef(true),
    pending = useRef<{ identity: string; key: string } | null>(null);
  const assessed =
    !!report &&
    report.isCurrent &&
    report.scope === "current_sequence" &&
    report.transitions.length > 0 &&
    report.transitions.every((t) =>
      ["verified_valid", "verified_invalid"].includes(t.mathStatus),
    );
  useEffect(() => {
    alive.current = true;
    void (async () => {
      try {
        let id = attempt.parentEpisodeId;
        if (!id) {
          try {
            id = sessionStorage.getItem("khotwa-episode:" + attempt.id);
          } catch {
            /* Optional resource IDs only. */
          }
        }
        if (id && /^[\da-f-]{36}$/i.test(id)) {
          const e = await api.request(
            "/learning-episodes/" + id,
            "EpisodeEnvelope",
          );
          if (alive.current) setEpisode(e);
        }
        const p = await api.request(
          "/progress?learningSessionId=" + attempt.learningSessionId,
          "ProgressEnvelope",
        );
        if (alive.current) setProgress(p);
      } catch {
        /* PH08 is opt-in; an unavailable panel does not erase the learner's work. */
      }
    })();
    return () => {
      alive.current = false;
    };
  }, [api, attempt.id, attempt.parentEpisodeId, attempt.learningSessionId]);
  async function action(mode: "remediation" | "transfer") {
    if (mode === "transfer" && !episode) return;
    setBusy(true);
    setError("");
    try {
      const root =
        mode === "transfer"
          ? await api.request(
              "/attempts/" + episode!.rootAttemptId,
              "AttemptEnvelope",
            )
          : attempt;
      const identity =
        mode + ":" + root.id + ":" + root.revision + ":" + (episode?.id ?? "");
      if (pending.current?.identity !== identity)
        pending.current = { identity, key: crypto.randomUUID() };
      if (!alive.current) return;
      const e = await api.request(
        `/attempts/${root.id}/${mode}`,
        "EpisodeEnvelope",
        "POST",
        {
          expectedRevision: root.revision,
          ...(mode === "transfer" ? { episodeId: episode!.id } : {}),
        },
        pending.current.key,
      );
      if (!alive.current) return;
      setEpisode(e);
      pending.current = null;
      try {
        sessionStorage.setItem("khotwa-episode:" + e.rootAttemptId, e.id);
      } catch {
        /* Optional IDs only. */
      }
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof ClientFault
            ? e.messageAr
            : "تعذر إسناد النشاط؛ بقيت محاولتك محفوظة.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function open(x: Schema<"Assignment">) {
    const identity = "open:" + x.id;
    if (pending.current?.identity !== identity)
      pending.current = { identity, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const a = x.attemptId
        ? await api.request("/attempts/" + x.attemptId, "AttemptEnvelope")
        : await api.request(
            "/attempts",
            "AttemptEnvelope",
            "POST",
            {
              learningSessionId: attempt.learningSessionId,
              source: { kind: "assignment", assignmentId: x.id },
            },
            pending.current.key,
          );
      if (alive.current) {
        pending.current = null;
        onOpen(a, x.problem);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof ClientFault ? e.messageAr : "تعذر فتح النشاط.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  if (paused)
    return (
      <section className="episode-card">
        <p>
          يمكنك التوقف هنا والعودة إلى العمل المحفوظ. لا نسجل نجاحًا أو إخفاقًا
          بسبب التوقف.
        </p>
        <button onClick={() => setPaused(false)}>متابعة التعلم</button>
      </section>
    );
  const states = {
    not_assessed: "لم يتوفر دليل قابل للتقييم بعد",
    needs_followup: "تحتاج هذه المحاولات إلى متابعة",
    practice_with_support: "إكمال ضمن سياق التدريب الموجّه",
    new_evidence_of_understanding:
      "دليل جديد على تطبيق المهارة في مسألة مختلفة",
  };
  const target = progress?.skills.find((s) => s.skillId === episode?.skillId);
  return (
    <section className="episode-card" aria-labelledby="episode-title">
      <h2 id="episode-title">تدريب على المهارة ومسألة جديدة</h2>
      <p>
        اختر التدريب على مهارة واحدة، ثم جرّب مسألة مختلفة. التدريب لا يعني
        تشخيص ضعف مؤكد.
      </p>
      {(!episode || episode.state === "cancelled") && (
        <button
          disabled={busy || !assessed}
          onClick={() => void action("remediation")}
        >
          ابدأ تدريبًا على المهارة
        </button>
      )}
      {episode && (
        <>
          <p role="status">
            {episode.state === "cancelled"
              ? "تغير أصل الحلقة؛ ابدأ تدريبًا من النسخة الحالية."
              : episode.nextAction === "start_transfer"
                ? "التدريب مكتمل؛ يمكنك طلب مسألة جديدة."
                : episode.nextAction === "review_progress"
                  ? "اكتملت المسألة؛ هذا دليل محدود من هذه المحاولة."
                  : "تابع النشاط المسند واكتب حلك بنفسك."}
          </p>
          <ol>
            {episode.assignments.map((x) => (
              <li key={x.id}>
                <strong>
                  {x.phase === "remediation"
                    ? "تدريب علاجي"
                    : "مسألة نقل جديدة"}
                </strong>
                {" — "}
                {x.assistancePolicy === "independent"
                  ? "قياس دون تلميحات"
                  : "تعلم مع إتاحة المساعدة"}
                <p>{x.problem.statementAr}</p>
                <button
                  disabled={busy || x.attemptId === attempt.id}
                  onClick={() => void open(x)}
                >
                  {x.attemptId === attempt.id
                    ? "النشاط الحالي"
                    : x.attemptId
                      ? "العودة إلى النشاط"
                      : "افتح النشاط"}
                </button>
              </li>
            ))}
          </ol>
          {episode.nextAction === "start_transfer" && (
            <button disabled={busy} onClick={() => void action("transfer")}>
              اطلب مسألة نقل جديدة
            </button>
          )}
          {assessed &&
            report?.transitions.some(
              (t) => t.mathStatus === "verified_invalid",
            ) &&
            attempt.parentEpisodeId && (
              <button
                disabled={busy}
                onClick={() => void action("remediation")}
              >
                أحتاج تدريبًا آخر على المهارة
              </button>
            )}
          {target && (
            <p role="status">
              {states[target.state]} — أدلة قابلة للتقييم:{" "}
              {arabicNumber(target.evidenceCount)}، نقل مستقل:{" "}
              {arabicNumber(target.independentTransferCount)}، أنشطة مكتملة
              بمساعدة: {arabicNumber(target.assistedPracticeCount)}.
            </p>
          )}
        </>
      )}
      <p className="helper">
        عدم التقييم لا يعني صفرًا في المهارة. مشاهدة الحل أو الإكمال بمساعدة لا
        يثبت الاستقلال، ومسألة واحدة لا تثبت إتقانًا دائمًا.
      </p>
      <button disabled={busy} onClick={() => setPaused(true)}>
        أتوقف هنا الآن
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
