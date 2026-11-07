import { useEffect, useState } from "react";
import {
  ProductApi,
  booleanField,
  messageOf,
  optionalText,
  record,
  textField,
} from "./product-api";
interface Consent {
  enabled: boolean;
  policyVersion: string;
  updatedAt: string | null;
}
const consentData = (value: unknown): Consent => {
  const r = record(value);
  return {
    enabled: booleanField(r.enabled),
    policyVersion: textField(r.policyVersion),
    updatedAt: optionalText(r.updatedAt),
  };
};
interface ConsentProps {
  api: ProductApi;
  accountId: string;
}
export function AccountAiConsentPanel(props: ConsentProps) {
  return <AccountConsentPanel {...props} kind="ai" />;
}
export function AccountLearningConsentPanel(props: ConsentProps) {
  return <AccountConsentPanel {...props} kind="learning" />;
}
/** Neither consent grants permission to send learner code or private tests. */
function AccountConsentPanel({
  api,
  accountId,
  kind,
}: ConsentProps & { kind: "learning" | "ai" }) {
  const endpoint = kind === "ai" ? "/me/ai-consent" : "/me/learning-consent";
  const [consent, setConsent] = useState<Consent | null>(null);
  const [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let current = true;
    void api
      .request(endpoint, consentData)
      .then((value) => {
        if (current) {
          setConsent(value);
          setAccepted(value.enabled);
        }
      })
      .catch((e) => {
        if (current) setError(messageOf(e));
      });
    return () => {
      current = false;
    };
  }, [api, accountId, endpoint]);
  async function save(enabled: boolean) {
    if (!consent) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const identity = await api.me();
      if (identity.user?.id !== accountId)
        throw new Error("تغير الحساب؛ افتح إعداداته الحالية.");
      const value = await api.request(endpoint, consentData, "POST", {
        enabled,
        policyVersion: consent.policyVersion,
      });
      setConsent(value);
      setAccepted(value.enabled);
      setNotice(
        value.enabled
          ? "حُفظ اختيارك لهذه السياسة؛ التفعيل يخضع أيضًا لإعدادات الخدمة."
          : kind === "ai"
            ? "سُحبت الموافقة على الاستدعاءات الخارجية الجديدة. يبقى المحتوى المراجع متاحًا."
            : "سُحبت موافقة رحلة التعلم التكيفية. يبقى تصدير بياناتك وطلب المحو مسارين مستقلين.",
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="product-card"
      aria-label={
        kind === "ai" ? "موافقة المساعد الخارجي" : "موافقة رحلة التعلم"
      }
    >
      <h2>
        {kind === "ai"
          ? "المساعد الخارجي والخصوصية"
          : "رحلة التعلم وحفظ الأدلة"}
      </h2>
      {kind === "ai" ? (
        <>
          <p>
            عند تهيئة Gemini، يمكن إرسال التلميح المراجع والمهارة وتصنيف نتيجة
            التحقق وسابق مستوى المساعدة لإعادة صياغة التوجيه. لا يُرسل كودك أو
            نص إجابتك أو هويتك أو الحل المرجعي أو الاختبارات المخفية. لا تمنح
            هذه الموافقة إذنًا بإرسال كود خاص.
          </p>
        </>
      ) : (
        <>
          <p>
            أوافق على حفظ محاولاتي وخطواتي ونتائج المتحقق والمساعدة والأدلة
            المرتبطة بحسابي، لاستخدامها في التشخيص المحافظ والتلميحات والعلاج
            والنقل والتقدم. تبقى بياناتي معزولة عن الحسابات الأخرى وعن لوحة
            المعلم التجريبية الاصطناعية.
          </p>
          <p>
            هذه الموافقة لا تفعّل Gemini ولا تسمح بإرسال بياناتي إلى مزود خارجي.
            يمكن سحبها وإيقاف رحلة التعلم، أو تصدير البيانات وطلب محوها عبر
            حسابي. طلب المحو لا يعني محوًا فوريًا أو حذفًا مثبتًا من النسخ
            الاحتياطية؛ التشغيل الحقيقي يخضع لسياسة الخصوصية والموافقات
            المعتمدة.
          </p>
        </>
      )}
      {kind === "ai" && (
        <p>
          يمكنك سحب الموافقة للاستدعاءات الجديدة، ومتابعة التعلم بالقوالب
          المراجعة. السحب لا يعني حذف بيانات سبق إرسالها من مزود خارجي أو محو
          تاريخ التعلم.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label className="check-line">
        <input
          type="checkbox"
          checked={accepted}
          disabled={busy || !consent}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        {kind === "ai"
          ? "أوافق على إرسال السياق التعليمي المحدود الموضح أعلاه إلى المساعد الخارجي."
          : "أوافق على رحلة التعلم وحفظ الأدلة الموضحين أعلاه لهذه السياسة."}
      </label>
      <div className="actions">
        <button
          type="button"
          disabled={busy || !consent || accepted === consent.enabled}
          onClick={() => void save(accepted)}
        >
          احفظ اختياري
        </button>
        <button
          type="button"
          disabled={busy || !consent?.enabled}
          onClick={() => void save(false)}
        >
          اسحب الموافقة
        </button>
      </div>
      {consent && (
        <p className="helper">
          نسخة السياسة: <bdi dir="ltr">{consent.policyVersion}</bdi> · الحالة:{" "}
          {consent.enabled ? "موافق" : "غير موافق"}
          {consent.updatedAt
            ? " · آخر تحديث: " +
              new Date(consent.updatedAt).toLocaleString("ar")
            : ""}
        </p>
      )}
    </section>
  );
}
