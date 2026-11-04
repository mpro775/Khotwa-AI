import { useEffect, useRef, useState } from "react";
import { ApiClient, ClientFault, type Schema } from "./api-client";
import {
  arabicNumber,
  statusLabels,
  canAdoptTeacherExample,
} from "./workspace-model";
export function TeacherDemo() {
  const api = useRef(new ApiClient()).current,
    alive = useRef(true),
    turn = useRef(0);
  const [summary, setSummary] = useState<Schema<"TeacherDemoSummary"> | null>(
      null,
    ),
    [example, setExample] = useState<Schema<"TeacherDemoExample"> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      turn.current++;
    };
  }, []);
  async function start() {
    const n = ++turn.current;
    setBusy(true);
    setError("");
    setExample(null);
    try {
      await api.start();
      const s = await api.request(
        "/teacher-demo/summary",
        "TeacherSummaryEnvelope",
      );
      if (alive.current && n === turn.current) setSummary(s);
    } catch (e) {
      if (alive.current && n === turn.current)
        setError(
          e instanceof ClientFault ? e.messageAr : "تعذر فتح بيانات العرض.",
        );
    } finally {
      if (alive.current && n === turn.current) setBusy(false);
    }
  }
  async function open(id: string) {
    if (!summary) return;
    const dataset = summary.datasetCode,
      n = ++turn.current;
    setBusy(true);
    setError("");
    setExample(null);
    try {
      const e = await api.request(
        "/teacher-demo/examples/" + id,
        "TeacherExampleEnvelope",
      );
      if (
        alive.current &&
        n === turn.current &&
        canAdoptTeacherExample(dataset, id, e)
      )
        setExample(e);
    } catch (e) {
      if (alive.current && n === turn.current)
        setError(
          e instanceof ClientFault ? e.messageAr : "تعذر فتح المثال الاصطناعي.",
        );
    } finally {
      if (alive.current && n === turn.current) setBusy(false);
    }
  }
  return (
    <main className="teacher-demo" dir="rtl">
      <nav aria-label="التنقل">
        <a href="/">العودة إلى تعلم الطالب</a>
      </nav>
      <h1>عرض المعلم التوضيحي</h1>
      <p className="synthetic-banner" role="note">
        بيانات توضيحية اصطناعية فقط — ليست بيانات طلاب أو فصل حقيقي. هذه تجربة
        قيد مراجعة المحتوى، ولا تمثل دورة تعلم معتمدة.
      </p>
      <p>لا يمنح هذا العرض صلاحية معلّم أو وصولًا إلى محاولات ضيوف آخرين.</p>
      <button disabled={busy} onClick={() => void start()}>
        {busy
          ? "جارٍ فتح بيانات العرض…"
          : summary
            ? "حدّث حزمة العرض"
            : "افتح البيانات الاصطناعية"}
      </button>
      {error && <p role="alert">{error}</p>}
      {summary && (
        <>
          <p className="helper">{summary.disclaimerAr}</p>
          <section className="teacher-sample" aria-label="حجم العينة ومصدرها">
            <h2>مصدر الأعداد وحجم العينة</h2>
            <p>
              حزمة أمثلة مؤلفة: <bdi>{summary.datasetCode}</bdi>. تاريخ إنشاء
              الحزمة:{" "}
              <time dateTime={summary.generatedAt}>
                {new Intl.DateTimeFormat("ar-SA", {
                  calendar: "gregory",
                  dateStyle: "medium",
                  timeZone: "Asia/Riyadh",
                }).format(new Date(summary.generatedAt))}
              </time>
              .
            </p>
            <p>
              العينة تتضمن {arabicNumber(summary.sampleStudentCount)} متعلمين
              افتراضيين و{arabicNumber(summary.sampleAttemptCount)} محاولة
              مؤلفة. كل كرت يعد محاولات من هذه العينة، ولا يقيس نسبة إتقان أو
              تحسنًا فعليًا.
            </p>
          </section>
          <section
            className="teacher-metrics"
            aria-label="مؤشرات العينة الاصطناعية"
          >
            {summary.metrics.map((m) => (
              <article key={m.code}>
                <h2>{m.titleAr}</h2>
                <strong>{arabicNumber(m.count)}</strong>
                <p>
                  من أصل {arabicNumber(summary.sampleAttemptCount)} محاولة مؤلفة
                  في الحزمة.
                </p>
              </article>
            ))}
          </section>
          <section>
            <h2>أنماط مرشحة في أمثلة العرض</h2>
            <p>
              هذه أعداد محاولات موسومة في سجلات الحزمة المؤلفة، وليست عدد طلاب
              ثبت لديهم خطأ مفاهيمي.
            </p>
            <ul>
              {summary.topMisconceptions.map((m) => (
                <li key={m.errorCode}>
                  {m.nameAr}: {arabicNumber(m.count)} محاولة.
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>راجع مثالًا اصطناعيًا</h2>
            <div className="choices">
              {summary.exampleIds.map((id, i) => (
                <button disabled={busy} key={id} onClick={() => void open(id)}>
                  المثال {arabicNumber(i + 1)}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
      {example && (
        <section
          className="teacher-example"
          aria-label="تفاصيل المثال الاصطناعي"
        >
          <h2>{example.problem.statementAr}</h2>
          <p className="synthetic-banner">
            بيانات توضيحية اصطناعية — المصدر حزمة العرض نفسها.
          </p>
          <bdi className="math-text question-equation" dir="ltr">
            {example.problem.originalEquation}
          </bdi>
          <ol>
            {example.steps.map((s) => (
              <li key={s.id}>
                <bdi className="math-text" dir="ltr">
                  {s.source.sourceRaw}
                </bdi>
              </li>
            ))}
          </ol>
          <h3>نتيجة التحقق الرياضي</h3>
          <p>{statusLabels[example.mathStatus]}</p>
          <h3>سبب محتمل للمراجعة</h3>
          <p>
            {example.diagnosis?.explanationAr ??
              "السبب غير محدد؛ لا نضيف تشخيصًا جازمًا."}
          </p>
          <p>{example.reviewNoteAr}</p>
          <button
            onClick={() => {
              turn.current++;
              setExample(null);
              setBusy(false);
            }}
          >
            أغلق تفاصيل المثال
          </button>
        </section>
      )}
    </main>
  );
}
