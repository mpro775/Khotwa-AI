import { useEffect, useRef, useState } from "react";
import {
  ProductApi,
  ProductFault,
  type Identity,
  arrayField,
  booleanField,
  identityData,
  jsonValue,
  messageOf,
  numberField,
  optionalText,
  record,
  textField,
} from "./product-api";

interface AccountAttempt {
  id: string;
  problemId: string | null;
  problemRevisionId: string;
  revision: number;
  status: string;
  updatedAt: string;
}
interface AccountSkill {
  skillId: string;
  titleAr: string;
  state: string;
  evidenceCount: number;
  independentTransferCount: number;
  assistedPracticeCount: number;
}
interface SubjectEvidence {
  subjectCode: string;
  skillCode: string;
  evidenceCount: number;
  independentCount: number;
  assistedCount: number;
  state: string;
}
interface SubjectAttempt {
  id: string;
  subjectCode: "physics" | "programming";
  revision: number;
  sourceRaw: string;
  updatedAt: string;
  assistanceLevel: number;
  independent: boolean;
  status: string;
}
const evidenceLabels: Record<string, string> = {
  not_assessed: "لم يُختبر بعد",
  needs_followup: "يحتاج متابعة",
  practice_with_support: "تدريب بمساعدة",
  new_evidence_of_understanding: "دليل مستقل جديد",
  new_independent_evidence: "دليل مستقل جديد",
  assisted_evidence: "نجاح مع مساعدة",
  needs_review: "يحتاج مراجعة",
};
const count = (value: number) => value.toLocaleString("ar");
const attemptsData = (value: unknown) => {
  const data = record(value);
  return {
    attempts: arrayField(data.attempts, (value) => {
      const r = record(value);
      return {
        id: textField(r.id),
        problemId: optionalText(r.problemId),
        problemRevisionId: textField(r.problemRevisionId),
        revision: numberField(r.revision),
        status: textField(r.status),
        updatedAt: textField(r.updatedAt),
      };
    }),
    subjectAttempts:
      data.subjectAttempts === undefined
        ? []
        : arrayField(data.subjectAttempts, (value): SubjectAttempt => {
            const r = record(value),
              subjectCode = textField(r.subjectCode),
              verdict = record(r.verdict);
            if (subjectCode !== "physics" && subjectCode !== "programming")
              throw new Error("invalid_response");
            return {
              id: textField(r.id),
              subjectCode,
              revision: numberField(r.revision),
              sourceRaw: textField(r.sourceRaw),
              updatedAt: textField(r.updatedAt),
              assistanceLevel: numberField(r.assistanceLevel),
              independent: booleanField(r.independent),
              status: textField(verdict.status),
            };
          }),
  };
};
const skillsData = (value: unknown) => {
  const r = record(value);
  return {
    noteAr: textField(r.noteAr),
    skills: arrayField(r.skills, (value) => {
      const s = record(value);
      return {
        skillId: textField(s.skillId),
        titleAr: textField(s.titleAr),
        state: textField(s.state),
        evidenceCount: numberField(s.evidenceCount),
        independentTransferCount: numberField(s.independentTransferCount),
        assistedPracticeCount: numberField(s.assistedPracticeCount),
      };
    }),
    subjects:
      r.subjects === undefined
        ? []
        : arrayField(r.subjects, (value): SubjectEvidence => {
            const s = record(value);
            return {
              subjectCode: textField(s.subjectCode),
              skillCode: textField(s.skillCode),
              evidenceCount: numberField(s.evidenceCount),
              independentCount: numberField(s.independentCount),
              assistedCount: numberField(s.assistedCount),
              state: textField(s.state),
            };
          }),
  };
};

export function AccountPanel({
  api,
  identity,
  onIdentity,
  onResume,
  onResumeSubject,
}: {
  api: ProductApi;
  identity: Identity | null;
  onIdentity: (identity: Identity) => void;
  onResume: (attempt: { attemptId: string; problemId: string }) => void;
  onResumeSubject: (attempt: {
    id: string;
    subjectCode: "physics" | "programming";
  }) => void;
}) {
  const loginProof = useRef<{
    requestEmail: string | null;
    verifyBody: string | null;
  }>({ requestEmail: null, verifyBody: null });
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState<string | null>(null),
    [resendAt, setResendAt] = useState(0),
    [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [claim, setClaim] = useState(false),
    [deletion, setDeletion] = useState(false);
  const [attempts, setAttempts] = useState<AccountAttempt[]>([]),
    [skills, setSkills] = useState<AccountSkill[]>([]),
    [subjectEvidence, setSubjectEvidence] = useState<SubjectEvidence[]>([]),
    [subjectAttempts, setSubjectAttempts] = useState<SubjectAttempt[]>([]),
    [progressNote, setProgressNote] = useState("");
  useEffect(() => {
    const clock = window.setInterval(
      () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))),
      1000,
    );
    return () => window.clearInterval(clock);
  }, [resendAt]);
  useEffect(() => {
    setAttempts([]);
    setSkills([]);
    setSubjectEvidence([]);
    setSubjectAttempts([]);
    setClaim(false);
    setDeletion(false);
    loginProof.current = { requestEmail: null, verifyBody: null };
  }, [identity?.user?.id]);
  async function work(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function requestCode() {
    await work(async () => {
      if (loginProof.current.requestEmail !== email) {
        await api.me();
        loginProof.current.requestEmail = email;
      }
      let result: {
        challengeId: string;
        resendAfterSeconds: number;
        expiresInSeconds: number;
      };
      try {
        result = await api.request(
          "/auth/email/request",
          (value) => {
            const r = record(value);
            return {
              challengeId: textField(r.challengeId),
              resendAfterSeconds: numberField(r.resendAfterSeconds),
              expiresInSeconds: numberField(r.expiresInSeconds),
            };
          },
          "POST",
          { email },
        );
      } catch (error) {
        if (
          !(error instanceof ProductFault) ||
          (error.status > 0 &&
            error.status < 500 &&
            error.code !== "invalid_response")
        )
          loginProof.current.requestEmail = null;
        throw error;
      }
      loginProof.current = { requestEmail: null, verifyBody: null };
      setChallenge(result.challengeId);
      setCode("");
      setResendAt(Date.now() + result.resendAfterSeconds * 1000);
      setSeconds(result.resendAfterSeconds);
      setNotice(
        "إذا كان البريد مؤهلًا للدخول، ستصلك رسالة تحقق. الرمز صالح لمدة " +
          count(Math.ceil(result.expiresInSeconds / 60)) +
          " دقائق.",
      );
    });
  }
  async function verify() {
    await work(async () => {
      const body = { challengeId: challenge, email, code };
      const identity = JSON.stringify(body);
      if (loginProof.current.verifyBody !== identity) {
        // The OTP may outlive a bootstrap cookie. Refresh once for a new
        // verification, preserving that proof for an ambiguous network retry.
        await api.me();
        loginProof.current.verifyBody = identity;
      }
      let next: Identity;
      try {
        next = await api.request(
          "/auth/email/verify",
          identityData,
          "POST",
          body,
        );
      } catch (error) {
        if (
          !(error instanceof ProductFault) ||
          (error.status > 0 &&
            error.status < 500 &&
            error.code !== "invalid_response")
        )
          loginProof.current.verifyBody = null;
        throw error;
      }
      loginProof.current = { requestEmail: null, verifyBody: null };
      onIdentity(next);
      setCode("");
      setChallenge(null);
      setNotice(
        "تم تأكيد البريد. يمكنك الآن ربط جلسة الضيف الحالية بموافقة صريحة.",
      );
    });
  }
  async function refreshProgress() {
    await work(async () => {
      const result = await api.request("/me/progress", skillsData);
      setSkills(result.skills);
      setSubjectEvidence(result.subjects);
      setProgressNote(result.noteAr);
      const history = await api.request("/me/attempts", attemptsData);
      setAttempts(history.attempts);
      setSubjectAttempts(history.subjectAttempts);
    });
  }
  async function download() {
    await work(async () => {
      const data = await api.request("/me/export", jsonValue);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "khotwa-my-learning.json";
      a.click();
      URL.revokeObjectURL(url);
      setNotice("تم تنزيل نسخة بيانات الحساب التي أتاحها الخادم.");
    });
  }
  return (
    <section
      className="product-page"
      aria-labelledby="account-title"
      aria-busy={busy}
    >
      <div className="page-heading">
        <span className="eyebrow">حسابك ورحلة تعلمك</span>
        <h1 id="account-title">تابع من حيث وصلت.</h1>
        <p>
          التعلم كضيف متاح. الحساب يحفظ صلة محاولاتك عبر الجلسات والأجهزة بعد
          التحقق من بريدك.
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
      {!identity?.user ? (
        <div className="product-card narrow-card">
          <h2>دخول أو إنشاء حساب</h2>
          <p className="helper">
            سنرسل رمز تحقق إلى بريدك. لا تحتاج كلمة مرور.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void (challenge ? verify() : requestCode());
            }}
          >
            <label htmlFor="account-email">البريد الإلكتروني</label>
            <input
              id="account-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setChallenge(null);
                setCode("");
              }}
              disabled={busy}
            />
            {challenge && (
              <>
                <label htmlFor="account-code">رمز التحقق من البريد</label>
                <input
                  id="account-code"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={busy}
                  aria-describedby="code-help"
                />
                <p id="code-help" className="helper">
                  اكتب الأرقام الستة من الرسالة. لا تشارك الرمز مع أحد.
                </p>
              </>
            )}
            <div className="actions">
              <button
                type="submit"
                className="primary"
                disabled={busy || !email || (!!challenge && code.length !== 6)}
              >
                {busy
                  ? "جارٍ المتابعة…"
                  : challenge
                    ? "تحقق وادخل"
                    : "أرسل رمز التحقق"}
              </button>
              {challenge && (
                <button
                  type="button"
                  disabled={busy || seconds > 0}
                  onClick={() => void requestCode()}
                >
                  {seconds > 0
                    ? "إعادة الإرسال بعد " + count(seconds) + " ث"
                    : "أعد إرسال الرمز"}
                </button>
              )}
            </div>
          </form>
          <p className="helper">
            إذا لم تُهيأ خدمة البريد، ستظهر رسالة تعذر؛ لن يعرض التطبيق رمز
            التحقق في الصفحة.
          </p>
        </div>
      ) : (
        <>
          <div className="product-card">
            <h2>حسابي</h2>
            <p>
              <bdi dir="ltr">{identity.user.email}</bdi>
            </p>
            <div className="actions">
              <button onClick={() => void refreshProgress()} disabled={busy}>
                حدّث تقدمي ومحاولاتي
              </button>
              <button onClick={() => void download()} disabled={busy}>
                صدّر بياناتي
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    await api.request(
                      "/auth/logout",
                      (value) => booleanField(record(value).loggedOut),
                      "POST",
                      {},
                    );
                    onIdentity(await api.me());
                    setNotice("انتهت جلسة الحساب على هذا المتصفح.");
                  })
                }
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
          {identity.guestAvailable && (
            <div className="product-card">
              <h2>اربط محاولات الضيف الحالية</h2>
              <p>
                سترتبط جلسة الضيف الصالحة في هذا المتصفح بحسابك، لتظهر محاولاتها
                عند العودة من جهاز آخر.
              </p>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={claim}
                  onChange={(e) => setClaim(e.target.checked)}
                  disabled={busy}
                />{" "}
                أوافق على ربط محاولات جلسة الضيف الحالية بهذا الحساب.
              </label>
              <button
                className="primary"
                disabled={!claim || busy}
                onClick={() =>
                  void work(async () => {
                    const result = await api.request(
                      "/me/claim-guest",
                      (value) => {
                        const r = record(value);
                        return {
                          claimed: booleanField(r.claimed),
                          count: numberField(r.learningSessionCount),
                        };
                      },
                      "POST",
                      { consent: true },
                    );
                    onIdentity(await api.me());
                    setNotice(
                      result.claimed
                        ? "تم ربط " +
                            count(result.count) +
                            " جلسات تعلم بحسابك."
                        : "هذه الجلسة مرتبطة بالفعل.",
                    );
                  })
                }
              >
                أكد ربط الجلسة
              </button>
            </div>
          )}
          <div className="product-card">
            <h2>أدلة تقدمي</h2>
            <p>
              {progressNote ||
                "حدّث الملخص للاطلاع على أدلة المحاولات المحفوظة في حسابك."}
            </p>
            <div className="product-grid">
              {skills.map((s) => (
                <article key={s.skillId} className="evidence-card">
                  <h3>{s.titleAr}</h3>
                  <p>{evidenceLabels[s.state] ?? s.state}</p>
                  <p className="helper">
                    أدلة حالية: {count(s.evidenceCount)} · نقل مستقل:{" "}
                    {count(s.independentTransferCount)} · تدريب بمساعدة:{" "}
                    {count(s.assistedPracticeCount)}
                  </p>
                </article>
              ))}
            </div>
            {!!subjectEvidence.length && (
              <>
                <h3>الفيزياء والبرمجة — كل مادة بمعيارها</h3>
                <div className="product-grid">
                  {subjectEvidence.map((s) => (
                    <article
                      key={s.subjectCode + ":" + s.skillCode}
                      className="evidence-card"
                    >
                      <h3>
                        {s.subjectCode === "physics" ? "الفيزياء" : "Python"} ·{" "}
                        <bdi dir="ltr">{s.skillCode}</bdi>
                      </h3>
                      <p>{evidenceLabels[s.state] ?? s.state}</p>
                      <p className="helper">
                        أدلة قابلة للتقييم: {count(s.evidenceCount)} · دليل
                        مستقل: {count(s.independentCount)} · نجاح مع مساعدة:{" "}
                        {count(s.assistedCount)}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}
            {!skills.length && !subjectEvidence.length && (
              <p className="helper">
                لا توجد أدلة معروضة بعد؛ هذا لا يعني درجة صفر.
              </p>
            )}
          </div>
          <div className="product-card">
            <h2>محاولاتي الأخيرة</h2>
            {!attempts.length && !subjectAttempts.length && (
              <p>لم تُحمّل محاولات بعد. ابدأ تمرينًا أو حدّث الملخص.</p>
            )}
            <ul className="attempt-list">
              {attempts.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>محاولة محفوظة — مراجعة {count(a.revision)}</strong>
                    <p className="helper">
                      {a.status} · {new Date(a.updatedAt).toLocaleString("ar")}
                    </p>
                  </div>
                  {a.problemId && (
                    <button
                      onClick={() =>
                        onResume({ attemptId: a.id, problemId: a.problemId! })
                      }
                    >
                      متابعة التعلم
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!!subjectAttempts.length && (
              <>
                <h3>محاولات الفيزياء وPython</h3>
                <ul className="attempt-list">
                  {subjectAttempts.map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>
                          {a.subjectCode === "physics"
                            ? "مسألة فيزياء"
                            : "تمرين Python"}{" "}
                          — مراجعة {count(a.revision)}
                        </strong>
                        <p className="helper">
                          {a.status} ·{" "}
                          {a.assistanceLevel > 0
                            ? "مع مساعدة H" + a.assistanceLevel
                            : a.independent
                              ? "دون مساعدة مسجلة"
                              : "لم يُعتمد دليل مستقل"}{" "}
                          · {new Date(a.updatedAt).toLocaleString("ar")}
                        </p>
                        <details>
                          <summary>نصي المحفوظ</summary>
                          <pre dir="ltr" className="code-output">
                            {a.sourceRaw}
                          </pre>
                        </details>
                      </div>
                      <button
                        onClick={() =>
                          onResumeSubject({
                            id: a.id,
                            subjectCode: a.subjectCode,
                          })
                        }
                      >
                        متابعة المحاولة المحفوظة
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <details className="product-card">
            <summary>طلب محو الحساب</summary>
            <p>
              يُبطل الطلب وصول الحساب وتُعالج البيانات وفق سياسة الاحتفاظ. إرسال
              الطلب لا يعني اكتمال المحو من جميع السجلات والنسخ الاحتياطية
              فورًا.
            </p>
            <label className="check-line">
              <input
                type="checkbox"
                checked={deletion}
                onChange={(e) => setDeletion(e.target.checked)}
              />{" "}
              أفهم أثر الطلب وأريد إبطال وصول الحساب وطلب محوه.
            </label>
            <button
              className="danger"
              disabled={busy || !deletion}
              onClick={() =>
                void work(async () => {
                  await api.request(
                    "/me",
                    (value) => {
                      const r = record(value);
                      return {
                        status: textField(r.status),
                        accessRevoked: booleanField(r.accessRevoked),
                      };
                    },
                    "DELETE",
                    { confirm: true },
                  );
                  onIdentity(await api.me());
                  setNotice(
                    "استُقبل طلب المحو وأُبطل وصول الحساب. لم نعلن اكتمال حذف السجلات المحتفظ بها.",
                  );
                })
              }
            >
              أرسل طلب محو الحساب
            </button>
          </details>
        </>
      )}
    </section>
  );
}
