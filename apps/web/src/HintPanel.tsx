import { useEffect, useRef, useState } from "react";
import { ApiClient, ClientFault, Schema } from "./api-client";
import { canAdoptHint } from "./workspace-model";
export function HintPanel({
  api,
  attempt,
  report,
  probeOpen,
  onServed,
}: {
  api: ApiClient;
  attempt: Schema<"Attempt">;
  report: Schema<"VerificationReport"> | null;
  probeOpen: boolean;
  onServed: (event: Schema<"TutoringEvent">) => void;
}) {
  const [event, setEvent] = useState<Schema<"TutoringEvent"> | null>(null);
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{
      action: "next_hint" | "show_full_solution";
      key: string;
    } | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const independent = attempt.kind === "transfer" || attempt.kind === "probe";
  const canNext =
    !!report &&
    report.isCurrent &&
    report.scope === "current_sequence" &&
    !["H3", "H4"].includes(event?.hintLevel ?? "H0");
  async function request(action: "next_hint" | "show_full_solution") {
    if (action === "show_full_solution" && !confirmed) return;
    if (pending.current?.action !== action)
      pending.current = { action, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/attempts/${attempt.id}/hints`,
        "HintEnvelope",
        "POST",
        {
          expectedRevision: attempt.revision,
          action,
          ...(action === "show_full_solution"
            ? { confirmAssistedCompletion: true }
            : {}),
        },
        pending.current.key,
      );
      if (alive.current && canAdoptHint(attempt, next)) {
        setEvent(next);
        onServed(next);
        pending.current = null;
        setConfirmed(false);
      }
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof ClientFault
            ? e.messageAr
            : "تعذر طلب المساعدة؛ بقيت خطواتك كما كتبتها.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const titles = {
    H0: "دون تلميح جديد",
    H1: "توجيه الانتباه",
    H2: "تذكير بالقاعدة",
    H3: "توضيح جزئي",
    H4: "حل بمساعدة كاملة",
  };
  return (
    <section className="hint-card" aria-labelledby="hint-title">
      <h2 id="hint-title">مساعدة متدرجة</h2>
      <p className="helper">
        يحدد الخادم التلميح التالي. تبقى المساعدة السابقة مسجلة عند التعديل أو
        إعادة فتح المحاولة.
      </p>
      {independent ? (
        <p>لا تُكشف التلميحات أو الحل أثناء هذه المحاولة المستقلة.</p>
      ) : (
        <>
          {probeOpen && (
            <p role="status">أجب عن السؤال التأكيدي المفتوح أولًا.</p>
          )}
          <button
            disabled={busy || !canNext || probeOpen}
            onClick={() => void request("next_hint")}
          >
            {busy ? "جارٍ طلب المساعدة…" : "أعطني التلميح التالي"}
          </button>
          <details>
            <summary>أرني الحل كاملًا</summary>
            <p>
              عرض الحل مساعدة كاملة، ولن تُحسب هذه المسألة محاولة مستقلة. يمكنك
              بعدها التعلم بمسألة مختلفة.
            </p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy || probeOpen}
              />{" "}
              أفهم أثر عرض الحل وأريد المتابعة.
            </label>
            <button
              disabled={
                busy || !confirmed || probeOpen || event?.hintLevel === "H4"
              }
              onClick={() => void request("show_full_solution")}
            >
              أكد عرض الحل بمساعدة
            </button>
          </details>
        </>
      )}
      {event && (
        <article role="status">
          <h3>{titles[event.hintLevel]}</h3>
          <p>{event.textAr}</p>
          {!!event.solutionStepsAr.length && (
            <ol>
              {event.solutionStepsAr.map((step, i) => (
                <li key={i}>
                  <bdi dir="ltr" className="math-text">
                    {step}
                  </bdi>
                </li>
              ))}
            </ol>
          )}
          <p className="helper">
            هذه مساعدة مسجلة لهذه المحاولة؛ لا تثبت إتقانًا أو حلًا مستقلًا.
          </p>
        </article>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
