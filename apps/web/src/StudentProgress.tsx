import { useEffect, useRef, useState } from "react";
import { ApiClient, ClientFault, type Schema } from "./api-client";
import {
  arabicNumber,
  statusLabels,
  canAdoptProgress,
} from "./workspace-model";
const labels = {
  not_assessed: "لم يتوفر دليل للتقييم بعد",
  needs_followup: "تحتاج المحاولات الحالية إلى متابعة",
  practice_with_support: "إكمال في سياق التدريب الموجّه",
  new_evidence_of_understanding: "دليل محدود في مسألة جديدة مستقلة",
};
export function StudentProgress({
  api,
  learningId,
}: {
  api: ApiClient;
  learningId: string;
}) {
  const [summary, setSummary] = useState<Schema<"ProgressSummary"> | null>(
      null,
    ),
    [selected, setSelected] = useState<Schema<"SkillProgress"> | null>(null),
    [sources, setSources] = useState<
      { attempt: Schema<"Attempt">; assignment: Schema<"Assignment"> }[]
    >([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, [api, learningId]);
  async function refresh() {
    const turn = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const data = await api.request(
        "/progress?learningSessionId=" + learningId,
        "ProgressEnvelope",
      );
      if (
        alive.current &&
        turn === generation.current &&
        canAdoptProgress(learningId, data)
      ) {
        setSummary(data);
        setSelected(null);
        setSources([]);
        setCursor(null);
      }
    } catch (e) {
      if (alive.current && turn === generation.current)
        setError(
          e instanceof ClientFault
            ? e.messageAr
            : "تعذر تحديث الملخص؛ بقي حلك محفوظًا.",
        );
    } finally {
      if (alive.current && turn === generation.current) setBusy(false);
    }
  }
  async function inspect(skill: Schema<"SkillProgress">, next?: string) {
    const turn = ++generation.current;
    setBusy(true);
    setError("");
    if (!next) {
      setSources([]);
      setCursor(null);
      setSelected(skill);
    }
    try {
      const current = await api.request(
        `/progress/skills/${skill.skillId}?learningSessionId=${learningId}`,
        "SkillProgressEnvelope",
      );
      const page = await api.request(
        "/attempts?learningSessionId=" +
          learningId +
          "&limit=15" +
          (next ? "&cursor=" + encodeURIComponent(next) : ""),
        "AttemptListEnvelope",
      );
      const episodes = new Map<string, Schema<"LearningEpisode">>(),
        found: typeof sources = [];
      for (const a of page.items) {
        if (!a.parentEpisodeId) continue;
        let e = episodes.get(a.parentEpisodeId);
        if (!e) {
          e = await api.request(
            "/learning-episodes/" + a.parentEpisodeId,
            "EpisodeEnvelope",
          );
          episodes.set(e.id, e);
        }
        const x = e.assignments.find((x) => x.attemptId === a.id);
        if (x && e.skillId === skill.skillId && e.state !== "cancelled")
          found.push({ attempt: a, assignment: x });
      }
      if (
        alive.current &&
        turn === generation.current &&
        current.skillId === skill.skillId
      ) {
        setSelected(current);
        setSources((old) => (next ? [...old, ...found] : found));
        setCursor(page.nextCursor);
      }
    } catch (e) {
      if (alive.current && turn === generation.current)
        setError(
          e instanceof ClientFault ? e.messageAr : "تعذر فتح مصادر الملخص.",
        );
    } finally {
      if (alive.current && turn === generation.current) setBusy(false);
    }
  }
  return (
    <section className="progress-card" aria-labelledby="progress-title">
      <h2 id="progress-title">ما الذي تعلّمته في هذه الجلسة؟</h2>
      <p>
        يعرض الملخص أدلة المحاولات الحالية، دون درجة افتراضية للمهارات غير
        المقاسة أو نسبة إتقان نهائية.
      </p>
      <button disabled={busy} onClick={() => void refresh()}>
        {busy ? "جارٍ تحديث الأدلة…" : "حدّث ملخصي"}
      </button>
      {summary && (
        <>
          <p className="helper">{summary.noteAr}</p>
          <div className="progress-skills">
            {summary.skills.map((s) => (
              <article key={s.skillId} data-progress-state={s.state}>
                <h3>{s.titleAr}</h3>
                <p>{labels[s.state]}</p>
                {s.state === "not_assessed" ? (
                  <p>
                    لا توجد بعد أدلة كافية للحكم على هذه المهارة؛ لا يعني ذلك
                    صفرًا أو إخفاقًا.
                  </p>
                ) : (
                  <p>
                    أدلة صالحة: {arabicNumber(s.evidenceCount)}. نقل مستقل:{" "}
                    {arabicNumber(s.independentTransferCount)}. إكمال في التعلم
                    الموجّه: {arabicNumber(s.assistedPracticeCount)}.
                  </p>
                )}
                <button disabled={busy} onClick={() => void inspect(s)}>
                  راجع مصدر هذا الوصف
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {selected && (
        <section aria-label="مصادر وصف المهارة">
          <h3>
            {selected.titleAr} — {labels[selected.state]}
          </h3>
          <p>
            المصدر هو سجلات التحقق الحالية للتدريب والنقل في هذه الجلسة. هذه
            قائمة مراجعة لمحاولات مرتبطة بالمهارة؛ ظهور محاولة هنا لا يعني أنها
            تدخل عدّاد الدليل، فالمحتوى القديم أو المتعذر أو المكشوف يُستبعد
            خادميًا.
          </p>
          {!sources.length && !busy && (
            <p>
              لم تظهر محاولات مسندة صالحة لهذه المهارة في الصفحة الحالية من
              السجل.
            </p>
          )}
          {sources.map(({ attempt: a, assignment: x }) => (
            <details key={a.id}>
              <summary>
                {x.phase === "transfer" ? "مسألة نقل" : "تدريب على المهارة"} —
                مراجعة {arabicNumber(a.revision)}
              </summary>
              <p>{x.problem.statementAr}</p>
              <bdi className="math-text" dir="ltr">
                {x.problem.originalEquation}
              </bdi>
              <p>
                صفة الإسناد:{" "}
                {x.assistancePolicy === "independent"
                  ? "قياس مستقل؛ لا تكفي الصفة وحدها لاحتساب الدليل"
                  : "تعلم موجّه مع تسجيل المساعدة"}
                .{" "}
                {a.status === "assisted_completed"
                  ? "اكتملت المحاولة بمساعدة."
                  : a.status === "completed"
                    ? "اكتملت السلسلة رياضيًا."
                    : "المحاولة قيد العمل."}
              </p>
              <ol>
                {a.steps.map((s) => (
                  <li key={s.id}>
                    <bdi className="math-text" dir="ltr">
                      {s.source.sourceRaw}
                    </bdi>
                  </li>
                ))}
              </ol>
              {a.currentVerification ? (
                <>
                  <p>{a.currentVerification.completion.explanationAr}</p>
                  <ul>
                    {a.currentVerification.transitions.map((t) => (
                      <li key={t.verificationResultId}>
                        {statusLabels[t.mathStatus]}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  لا توجد نتيجة تحقق حالية؛ لا تستعمل النسخة القديمة حكمًا على
                  التعديل.
                </p>
              )}
            </details>
          ))}
          {cursor && (
            <button
              disabled={busy}
              onClick={() => void inspect(selected, cursor)}
            >
              المزيد من محاولات الجلسة
            </button>
          )}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
