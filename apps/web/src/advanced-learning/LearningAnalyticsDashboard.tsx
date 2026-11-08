import { useEffect, useRef, useState } from "react";
import type {
  CAnalyticsDashboard,
  CContentAnalytics,
} from "../../../../packages/contracts/src/advanced-learning";
import { ProductApi, messageOf } from "../product-api";
import { analyticsDashboard, contentAnalytics } from "./advanced-api";
import { metricDisplay } from "./display-preferences";

const metricLabels: Record<string, string> = {
  independent_success_rate: "النجاح في المحاولات المستقلة المؤهلة",
  assistance_dependency: "المحاولات المتحققة بمساعدة",
  delayed_retention: "الاحتفاظ بعد مراجعة مؤجلة",
  transfer_success: "التطبيق على سياق جديد",
  pre_post_delta: "التغير بين قياسين متكافئين",
  remediation_effect: "الأداء بعد تدريب علاجي",
  project_rubric_progress: "التقدم في معايير المشروع",
  problem_strategy_diversity: "تنوع الاستراتيجيات المراجعة",
  accessibility_barriers: "عوائق التفاعل المرصودة",
  coverage_quality: "تغطية القياس المستقل",
};
export function LearningAnalyticsDashboard({
  api,
  trackRevisionId,
}: {
  api: ProductApi;
  trackRevisionId: string;
}) {
  const [data, setData] = useState<CAnalyticsDashboard | null>(null),
    [windowDays, setWindow] = useState(7),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    setData(null);
    setError("");
    setOpen(false);
    setBusy(false);
  }, [api, trackRevisionId]);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  async function load(days = windowDays) {
    const turn = ++epoch.current;
    setBusy(true);
    setError("");
    setOpen(true);
    try {
      const next = await api.request(
        `/learning/analytics/me?trackRevisionId=${encodeURIComponent(trackRevisionId)}&window=${days}`,
        analyticsDashboard,
      );
      if (turn === epoch.current && next.trackRevisionId === trackRevisionId)
        setData(next);
    } catch (error) {
      if (turn === epoch.current) setError(messageOf(error));
    } finally {
      if (turn === epoch.current) setBusy(false);
    }
  }
  return (
    <section
      className="advanced-learning c-workspace"
      aria-label="مؤشرات تعلمي"
    >
      <h3>ماذا تدربت عليه، وماذا أثبتّ باستقلال؟</h3>
      <p>
        تفصل المؤشرات نشاطك التعليمي عن دليل الفهم المستقل. تعذر القياس أو غياب
        البيانات لا يعني الفشل.
      </p>
      <label>
        نافذة العرض
        <select
          value={windowDays}
          onChange={(event) => {
            const days = Number(event.target.value);
            setWindow(days);
            if (open) void load(days);
          }}
        >
          {[7, 14, 30].map((days) => (
            <option key={days} value={days}>
              {days.toLocaleString("ar")} يومًا
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy} onClick={() => void load()}>
        {busy ? "جارٍ قراءة المؤشرات…" : "اعرض مؤشرات تعلمي"}
      </button>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p className="helper">
            بيانات اصطناعية للاختبار · إصدار المؤشر{" "}
            <bdi dir="ltr">{data.metricVersion}</bdi> ·{" "}
            {new Date(data.window.from).toLocaleDateString("ar")} إلى{" "}
            {new Date(data.window.to).toLocaleDateString("ar")}
          </p>
          <p>
            مشكلات مكتملة للتعلّم:{" "}
            {data.activity.problemCompleted.toLocaleString("ar")} · مشاريع
            مسلّمة: {data.activity.projectSubmitted.toLocaleString("ar")} ·
            مشاريع مكتملة ومراجعة:{" "}
            {data.activity.projectCompleted.toLocaleString("ar")}. هذه الأعداد
            لا تمنح إتقانًا.
          </p>
          <div className="table-scroll">
            <table>
              <caption>المؤشرات ومصادر الثقة فيها</caption>
              <thead>
                <tr>
                  <th scope="col">المؤشر</th>
                  <th scope="col">القيمة</th>
                  <th scope="col">العينة والمقام</th>
                  <th scope="col">حدود القياس</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((metric) => (
                  <tr key={metric.metric}>
                    <th scope="row">
                      {metricLabels[metric.metric] ?? metric.metric}
                    </th>
                    <td>{metricDisplay(metric.value)}</td>
                    <td>
                      عينة {metric.n.toLocaleString("ar")} ·{" "}
                      {metric.numerator.toLocaleString("ar")} /{" "}
                      {metric.denominator.toLocaleString("ar")}
                    </td>
                    <td>
                      {metric.status === "observed"
                        ? "دليل وصفي محدود"
                        : metric.status === "suppressed"
                          ? "محجوب لحماية الخصوصية"
                          : "لا تتوفر بيانات مؤهلة"}
                      {metric.missingReason && (
                        <p>
                          <bdi dir="ltr">{metric.missingReason}</bdi>
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>سجلات ناقصة: {data.missingCount.toLocaleString("ar")}.</p>
          {data.notesAr.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
          <details>
            <summary>كيف تُحسب المؤشرات؟</summary>
            <p>
              نجاحات مستقلة متحققة مقسومة على محاولات مستقلة مؤهلة. تُستبعد
              المساعدة والتعرض وفشل التحقق من هذا المقام. لا تُستنتج السببية من
              ارتباط، ولا يُعرض المقام الفارغ على أنه صفر بالمئة.
            </p>
            <ul>
              {data.provenance.map((source) => (
                <li key={source}>
                  <bdi dir="ltr">{source}</bdi>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
export function ContentQualityPanel({
  api,
  revisionId,
}: {
  api: ProductApi;
  revisionId: string;
}) {
  const [data, setData] = useState<CContentAnalytics | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    setData(null);
    setError("");
    setBusy(false);
    return () => {
      epoch.current++;
    };
  }, [api, revisionId]);
  async function load() {
    const turn = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/studio/learning-analytics/content?revisionId=${encodeURIComponent(revisionId)}`,
        contentAnalytics,
      );
      if (turn === epoch.current && next.revisionId === revisionId)
        setData(next);
    } catch (error) {
      if (turn === epoch.current) setError(messageOf(error));
    } finally {
      if (turn === epoch.current) setBusy(false);
    }
  }
  return (
    <section className="advanced-learning c-workspace">
      <h3>جودة تغطية المحتوى</h3>
      <button disabled={busy} onClick={() => void load()}>
        اقرأ مؤشرات المحتوى
      </button>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            بيانات اصطناعية · مشكلات:{" "}
            {data.quality.problemActivities.toLocaleString("ar")} · مشاريع:{" "}
            {data.quality.projectActivities.toLocaleString("ar")} · مجموعات
            تمثيل: {data.quality.representationSets.toLocaleString("ar")}.
          </p>
          <p>
            مؤشرات استخدام المتعلمين محجوبة إلى أن تعتمد سياسة الحد الأدنى
            للمجموعات والخصوصية. لا توجد لوحة أفراد أو ترتيب علني للطلاب.
          </p>
        </>
      )}
    </section>
  );
}
