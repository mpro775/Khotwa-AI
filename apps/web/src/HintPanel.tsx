import { useEffect, useRef, useState } from "react";
import { ApiClient, ClientFault, Schema } from "./api-client";
import { canAdoptHint } from "./workspace-model";
import { ProductApi, numberField, record, textField } from "./product-api";
type Plan = {
  recommendation: string;
  reasonAr: string;
  recentVerifiedErrors: number;
  interpretation: string;
};
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
  const [plan, setPlan] = useState<Plan | null>(null);
  const [leaveMeasurement, setLeaveMeasurement] = useState(false);
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
  const independent =
    attempt.kind === "probe" ||
    (attempt.kind === "transfer" && !attempt.parentEpisodeId);
  const transfer = attempt.kind === "transfer" && !!attempt.parentEpisodeId;
  const canNext =
    !!report &&
    report.isCurrent &&
    report.scope === "current_sequence" &&
    !["H3", "H4"].includes(event?.hintLevel ?? "H0");
  useEffect(() => {
    let active = true;
    setPlan(null);
    if (report?.isCurrent)
      void new ProductApi()
        .request(`/attempts/${attempt.id}/tutoring-plan`, (value) => {
          const data = record(value);
          return {
            recommendation: textField(data.recommendation),
            reasonAr: textField(data.reasonAr),
            recentVerifiedErrors: numberField(data.recentVerifiedErrors),
            interpretation: textField(data.interpretation),
          };
        })
        .then((next) => {
          if (active) setPlan(next);
        })
        .catch(() => {
          /* Core reviewed assistance remains usable when the optional plan is unavailable. */
        });
    return () => {
      active = false;
    };
  }, [attempt.id, attempt.revision, report?.id, report?.isCurrent, event?.id]);
  async function request(action: "next_hint" | "show_full_solution") {
    if (action === "show_full_solution" && !confirmed) return;
    if (transfer && !leaveMeasurement) return;
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
      {plan && (
        <div className="hint-message">
          <p>{plan.reasonAr}</p>
          {plan.recommendation === "remediation" && (
            <p>
              يمكنك الانتقال إلى قسم «تدريب على المهارة ومسألة جديدة» لتجربة
              تدريب مناسب.
            </p>
          )}
          {plan.interpretation === "unknown" && (
            <p className="helper">لا تكفي الأدلة الحالية للجزم بسبب الخطأ.</p>
          )}
        </div>
      )}
      {independent ? (
        <p>لا تُكشف التلميحات أو الحل أثناء هذه المحاولة المستقلة.</p>
      ) : (
        <>
          {transfer && (
            <label className="measurement-exit">
              <input
                type="checkbox"
                checked={leaveMeasurement}
                disabled={busy}
                onChange={(e) => setLeaveMeasurement(e.target.checked)}
              />{" "}
              أحتاج مساعدة وأوافق على مغادرة القياس المستقل؛ لن تُحسب هذه
              المسألة نقلًا مستقلًا بعد الطلب.
            </label>
          )}
          {probeOpen && (
            <p role="status">أجب عن السؤال التأكيدي المفتوح أولًا.</p>
          )}
          <button
            disabled={
              busy || !canNext || probeOpen || (transfer && !leaveMeasurement)
            }
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
                busy ||
                !confirmed ||
                probeOpen ||
                (transfer && !leaveMeasurement) ||
                event?.hintLevel === "H4"
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
          <p className="helper">
            المصدر:{" "}
            {event.generationSource === "llm_validated"
              ? "صياغة آلية خضعت للفحص"
              : event.generationSource === "reviewed_template"
                ? "قالب تعليمي مراجع"
                : "محتوى يدوي"}
          </p>
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
