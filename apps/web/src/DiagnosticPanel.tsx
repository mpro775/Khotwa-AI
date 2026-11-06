import { useEffect, useRef, useState } from "react";
import { ApiClient, ClientFault, Schema } from "./api-client";
import { canAdoptProbe } from "./workspace-model";
import { arabicNumber } from "./workspace-model";
const skillLabels: Record<string, string> = {
  "ERR-ALG-01": "خاصية التوزيع",
  "ERR-ALG-02": "الأعداد الصحيحة والإشارات",
  "ERR-ALG-03": "معنى المساواة وطرفا المعادلة",
  "ERR-ALG-04": "التحويل المتكافئ والعملية العكسية",
  "ERR-ALG-05": "حساب الأعداد الصحيحة داخل الحل",
  "ERR-ALG-06": "خاصية التوزيع ومعامل سالب",
};

export function DiagnosticPanel({
  api,
  report,
  onAnswer,
  onProbeOpenChange,
  canRequestProbe = true,
}: {
  api: ApiClient;
  report: Schema<"VerificationReport">;
  onAnswer: (evaluation: Schema<"ProbeEvaluation">) => void;
  onProbeOpenChange?: (open: boolean) => void;
  canRequestProbe?: boolean;
}) {
  const [probe, setProbe] = useState<Schema<"Probe"> | null>(null);
  const [evaluation, setEvaluation] =
    useState<Schema<"ProbeEvaluation"> | null>(null);
  const [option, setOption] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    createKey = useRef(crypto.randomUUID());
  const answerKey = useRef({ option: "", key: "" });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      onProbeOpenChange?.(false);
    };
  }, []);
  const candidate = evaluation?.diagnosis ?? report.diagnosisCandidate;
  const first = report.firstBlockingTransitionIndex;
  const source = first !== null ? report.transitions[first] : null;
  if (
    !report.diagnosisCandidate ||
    !candidate ||
    !report.isCurrent ||
    report.scope !== "current_sequence" ||
    source?.mathStatus !== "verified_invalid"
  )
    return null;
  const fail = (e: unknown) =>
    setError(
      e instanceof ClientFault
        ? e.messageAr
        : "تعذرت العملية؛ لم يتغير الحكم الرياضي أو مسودتك.",
    );
  async function ask() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/attempts/${report.attemptId}/probes`,
        "ProbeEnvelope",
        "POST",
        {
          expectedRevision: report.attemptRevision,
          verificationResultId: source.verificationResultId,
        },
        createKey.current,
      );
      if (alive.current && canAdoptProbe(report, next)) {
        setProbe(next);
        onProbeOpenChange?.(true);
      }
    } catch (e) {
      if (alive.current) fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function answer() {
    if (!probe || !option) return;
    if (answerKey.current.option !== option)
      answerKey.current = { option, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const result = await api.request(
        `/attempts/${report.attemptId}/probes/${probe.id}/responses`,
        "ProbeAnswerEnvelope",
        "POST",
        {
          expectedRevision: report.attemptRevision,
          answer: { kind: "choice", optionId: option },
        },
        answerKey.current.key,
      );
      if (alive.current && canAdoptProbe(report, result, probe.id)) {
        setEvaluation(result);
        onProbeOpenChange?.(false);
        onAnswer(result);
      }
    } catch (e) {
      if (alive.current) fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <aside className="diagnostic-card" aria-labelledby="diagnosis-title">
      <h3 id="diagnosis-title">سبب محتمل يحتاج دليلًا إضافيًا</h3>
      {candidate.errorCode && (
        <p>المهارة ذات القرينة: {skillLabels[candidate.errorCode]}</p>
      )}
      <p className="helper">
        يستند إلى دليل التحقق الرياضي للانتقال رقم{" "}
        {arabicNumber((first ?? 0) + 1)}.
      </p>
      <p>{candidate.explanationAr}</p>
      <p className="helper">
        الحكم الرياضي يثبت عدم تكافؤ الانتقال. هذا التفسير يخص المحاولة الحالية،
        ولا يثبت ضعفًا دائمًا أو إتقانًا.
      </p>
      {candidate.needsProbe && !probe && canRequestProbe && (
        <button disabled={busy} onClick={() => void ask()}>
          {busy ? "جارٍ طلب السؤال…" : "افحص السبب بسؤال قصير"}
        </button>
      )}
      {!canRequestProbe && (
        <p className="helper">
          المساعدة مسجلة؛ لا نعد سؤالًا لاحقًا دليلًا مستقلًا لهذه المحاولة.
        </p>
      )}
      {probe && !evaluation && (
        <fieldset disabled={busy}>
          <legend>{probe.questionAr}</legend>
          {probe.options.map((o) => (
            <label className="probe-option" key={o.id}>
              <input
                type="radio"
                name={probe.id}
                value={o.id}
                checked={option === o.id}
                onChange={() => setOption(o.id)}
              />{" "}
              <bdi dir="auto">{o.labelAr}</bdi>
            </label>
          ))}
          <button disabled={busy || !option} onClick={() => void answer()}>
            {busy ? "جارٍ حفظ الإجابة…" : "احفظ إجابة السؤال"}
          </button>
        </fieldset>
      )}
      {evaluation && <p role="status">{evaluation.feedbackAr}</p>}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
