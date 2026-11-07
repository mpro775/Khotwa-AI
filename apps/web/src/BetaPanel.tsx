import { useState } from "react";
import {
  ProductApi,
  type Identity,
  arrayField,
  booleanField,
  messageOf,
  numberField,
  optionalText,
  record,
  textField,
} from "./product-api";

interface BetaMetrics {
  day: string;
  noteAr: string;
  database: string;
  samples: number;
  status4xx: number;
  status5xx: number;
  p50Ms: number | null;
  p95Ms: number | null;
  usage: { name: string; value: number }[];
  ai: { name: string; value: number | null }[];
  feedback: {
    id: string;
    kind: string;
    message: string;
    requestId: string | null;
    createdAt: string;
  }[];
}
const nullableNumber = (value: unknown) =>
  value === null ? null : numberField(value);
function betaMetrics(value: unknown): BetaMetrics {
  const r = record(value),
    api = record(r.api);
  return {
    day: textField(r.day),
    noteAr: textField(r.noteAr),
    database: textField(r.database),
    samples: numberField(api.sampleCount),
    status4xx: numberField(api.status4xx),
    status5xx: numberField(api.status5xx),
    p50Ms: nullableNumber(api.p50Ms),
    p95Ms: nullableNumber(api.p95Ms),
    usage: Object.entries(record(r.usage)).map(([name, value]) => ({
      name,
      value: numberField(value),
    })),
    ai: Object.entries(record(r.ai)).map(([name, value]) => ({
      name,
      value: nullableNumber(value),
    })),
    feedback: arrayField(r.feedback, (value) => {
      const f = record(value);
      return {
        id: textField(f.id),
        kind: textField(f.kind),
        message: textField(f.message),
        requestId: optionalText(f.requestId),
        createdAt: textField(f.createdAt),
      };
    }),
  };
}
const metricLabels: Record<string, string> = {
  sessionsToday: "جلسات الحساب اليوم",
  attemptsToday: "محاولات الجبر اليوم",
  hintsToday: "طلبات التلميح اليوم",
  calls: "استدعاءات AI",
  fallback: "مرات البديل المراجع",
  fallbackRatio: "نسبة البديل",
  inputTokens: "رموز الإدخال",
  outputTokens: "رموز الإخراج",
  estimatedCostMicros: "تكلفة تقديرية (وحدات ميكرو)",
  unknownCostCalls: "استدعاءات بتكلفة غير معلومة",
  timeouts: "المهل المنتهية",
};

export function BetaPanel({
  api,
  identity,
}: {
  api: ProductApi;
  identity: Identity | null;
}) {
  const [kind, setKind] = useState("bug"),
    [message, setMessage] = useState(""),
    [requestId, setRequestId] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [metrics, setMetrics] = useState<BetaMetrics | null>(null),
    [revokeId, setRevokeId] = useState(""),
    [confirmRevoke, setConfirmRevoke] = useState(false);
  async function work(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await api.me();
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="product-page"
      aria-labelledby="beta-title"
      aria-busy={busy}
    >
      <div className="page-heading">
        <span className="eyebrow">نسخة تجريبية محدودة</span>
        <h1 id="beta-title">ساعدنا في تحسين خُطوة.</h1>
        <p>
          هذه نسخة Beta للمدعوين والمختبرين الداخليين. قد تتعذر بعض الخدمات،
          ويظل الحكم العلمي مقيدًا بحدود كل مسار.
        </p>
      </div>
      <div className="product-card">
        <h2>حدود التجربة</h2>
        <p>
          الجبر الخطي في س، والحركة في خط مستقيم، وأساسيات Python هي المسارات
          المتاحة بحسب المحتوى المنشور والخدمات المهيأة.
        </p>
        <p>
          تُسجل المساعدة المستخدمة، ولا يُعد نجاح تمرين واحد إتقانًا دائمًا.
          تجنب إدخال أسماء أو بيانات حساسة في إجاباتك وملاحظاتك.
        </p>
      </div>
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {notice}
      </p>
      <form
        className="product-card narrow-card"
        onSubmit={(e) => {
          e.preventDefault();
          void work(async () => {
            await api.request(
              "/beta/feedback",
              (value) => textField(record(value).id),
              "POST",
              {
                kind,
                message,
                ...(requestId.trim() ? { requestId: requestId.trim() } : {}),
              },
            );
            setMessage("");
            setRequestId("");
            setNotice("وصلت ملاحظتك. شكرًا لمساعدتنا في تحسين التجربة.");
          });
        }}
      >
        <h2>أرسل ملاحظة</h2>
        <label htmlFor="feedback-kind">نوع الملاحظة</label>
        <select
          id="feedback-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="bug">مشكلة في الاستخدام</option>
          <option value="content">المحتوى أو الشرح</option>
          <option value="suggestion">اقتراح</option>
          <option value="other">أخرى</option>
        </select>
        <label htmlFor="feedback-message">ماذا حدث؟</label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minLength={3}
          maxLength={2000}
          required
          rows={5}
          aria-describedby="feedback-help"
        />
        <p id="feedback-help" className="helper">
          اكتب خطوات بسيطة لإعادة المشكلة. لا ترسل كلمة مرور أو رمز تحقق أو
          بيانات شخصية أو مفتاح API.
        </p>
        <label htmlFor="feedback-request">
          رقم الطلب إن ظهر في رسالة الخطأ (اختياري)
        </label>
        <input
          id="feedback-request"
          dir="ltr"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          maxLength={36}
        />
        <button
          disabled={busy || message.trim().length < 3}
          className="primary"
        >
          {busy ? "جارٍ الإرسال…" : "أرسل الملاحظة"}
        </button>
      </form>
      {identity?.user?.role === "admin" && (
        <section className="product-card">
          <h2>متابعة التشغيل للفريق</h2>
          <button
            disabled={busy}
            onClick={() =>
              void work(async () =>
                setMetrics(await api.request("/beta/metrics", betaMetrics)),
              )
            }
          >
            حدّث مؤشرات التشغيل
          </button>
          {metrics && (
            <>
              <p className="helper">{metrics.noteAr}</p>
              <p>
                اليوم: <bdi dir="ltr">{metrics.day}</bdi> · قاعدة البيانات:{" "}
                {metrics.database === "ready" ? "تستجيب" : "غير متاحة"}
              </p>
              <div className="metric-grid">
                {[
                  { name: "عينات زمن الطلب", value: metrics.samples },
                  { name: "أخطاء 4xx", value: metrics.status4xx },
                  { name: "أخطاء 5xx", value: metrics.status5xx },
                  { name: "زمن p50 (ms)", value: metrics.p50Ms },
                  { name: "زمن p95 (ms)", value: metrics.p95Ms },
                  ...metrics.usage.map((m) => ({
                    name: metricLabels[m.name] ?? m.name,
                    value: m.value,
                  })),
                  ...metrics.ai.map((m) => ({
                    name: metricLabels[m.name] ?? m.name,
                    value: m.value,
                  })),
                ].map((m) => (
                  <article key={m.name}>
                    <h3>{m.name}</h3>
                    <strong>
                      {m.value === null
                        ? "لا توجد عينات كافية"
                        : m.value.toLocaleString("ar", {
                            maximumFractionDigits: 4,
                          })}
                    </strong>
                  </article>
                ))}
              </div>
              <h3>الملاحظات الأخيرة</h3>
              {metrics.feedback.length ? (
                metrics.feedback.map((f) => (
                  <article className="feedback-entry" key={f.id}>
                    <strong>{f.kind}</strong>
                    <p>{f.message}</p>
                    <small>
                      {new Date(f.createdAt).toLocaleString("ar")}
                      {f.requestId && (
                        <>
                          {" "}
                          · <bdi dir="ltr">{f.requestId}</bdi>
                        </>
                      )}
                    </small>
                  </article>
                ))
              ) : (
                <p>لا توجد ملاحظات محفوظة بعد.</p>
              )}
            </>
          )}
          <details>
            <summary>سحب وصول حساب تجريبي</summary>
            <p>
              يُبطل هذا الإجراء جلسات الحساب ويمنع دخوله. لا يحذف محاولاته بوصفه
              إجراء محو.
            </p>
            <label htmlFor="revoke-user">معرف الحساب</label>
            <input
              id="revoke-user"
              dir="ltr"
              value={revokeId}
              onChange={(e) => {
                setRevokeId(e.target.value);
                setConfirmRevoke(false);
              }}
              maxLength={36}
            />
            <label className="check-line">
              <input
                type="checkbox"
                checked={confirmRevoke}
                onChange={(e) => setConfirmRevoke(e.target.checked)}
              />{" "}
              تحققت من الحساب المقصود وأريد سحب وصوله.
            </label>
            <button
              className="danger"
              disabled={
                busy || !confirmRevoke || !/^[0-9a-f-]{36}$/i.test(revokeId)
              }
              onClick={() =>
                void work(async () => {
                  await api.request(
                    "/beta/access/revoke",
                    (value) => booleanField(record(value).revoked),
                    "POST",
                    { userId: revokeId },
                  );
                  setNotice("أُبطل وصول الحساب وجلساته.");
                  setConfirmRevoke(false);
                })
              }
            >
              اسحب الوصول
            </button>
          </details>
        </section>
      )}
    </section>
  );
}
