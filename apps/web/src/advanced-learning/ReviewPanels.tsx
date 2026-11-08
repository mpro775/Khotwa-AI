import { useEffect, useRef, useState } from "react";
import type { CContentReview } from "../../../../packages/contracts/src/advanced-learning";
import type { CProjectRun } from "../../../../packages/contracts/src/advanced-learning-sessions";
import type { LearningContentRevision } from "../../../../packages/contracts/src/learning-paths";
import {
  ProductApi,
  arrayField,
  messageOf,
  record,
  textField,
} from "../product-api";
import { enumField, studioLearningRevision } from "../learning-path-api";
import { projectRun } from "./advanced-api";
const scopeLabels: Record<CContentReview["scope"], string> = {
  subject: "المادة والدقة العلمية",
  pedagogy: "التربية وعدالة المعايير",
  accessibility: "الوصول والعربية",
  security: "الأمن وخصوصية المنتجات",
};
function contentReview(value: unknown): CContentReview {
  const r = record(value);
  if (r.reviewMode !== "TEST_ONLY") throw new Error("invalid_response");
  return {
    id: textField(r.id),
    revisionId: textField(r.revisionId),
    reviewerId: textField(r.reviewerId),
    reviewerRole: enumField(r.reviewerRole, ["admin", "content_manager"]),
    scope: enumField(r.scope, [
      "subject",
      "pedagogy",
      "accessibility",
      "security",
    ]),
    contentHash: textField(r.contentHash),
    decision: enumField(r.decision, ["approve", "changes_requested"]),
    notesAr: textField(r.notesAr),
    reviewMode: "TEST_ONLY",
    reviewedAt: textField(r.reviewedAt),
  };
}
export function AdvancedReviewPanel({
  api,
  revision,
  enabled,
  onContent,
}: {
  api: ProductApi;
  revision: LearningContentRevision;
  enabled: boolean;
  onContent: (content: LearningContentRevision) => void;
}) {
  const [reviews, setReviews] = useState<CContentReview[]>([]),
    [scope, setScope] = useState<CContentReview["scope"]>("subject"),
    [decision, setDecision] =
      useState<CContentReview["decision"]>("changes_requested"),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    setReviews([]);
    setError("");
    setNotes("");
    return () => {
      epoch.current++;
    };
  }, [api, revision.id]);
  async function load() {
    const turn = epoch.current;
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/studio/learning-content/${revision.id}/reviews`,
        (value) => arrayField(record(value).items, contentReview),
      );
      if (turn === epoch.current) setReviews(next);
    } catch (error) {
      if (turn === epoch.current) setError(messageOf(error));
    } finally {
      if (turn === epoch.current) setBusy(false);
    }
  }
  async function submit() {
    const turn = epoch.current;
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/studio/learning-content/${revision.id}/reviews`,
        (value) => {
          const r = record(value);
          return {
            review: contentReview(r.review),
            content: studioLearningRevision(r.content),
          };
        },
        "POST",
        {
          expectedRevision: revision.editRevision,
          scope,
          decision,
          notesAr: notes,
        },
      );
      if (turn === epoch.current) {
        setReviews((previous) => [next.review, ...previous]);
        setNotes("");
        onContent(next.content);
      }
    } catch (error) {
      if (turn === epoch.current) setError(messageOf(error));
    } finally {
      if (turn === epoch.current) setBusy(false);
    }
  }
  return (
    <section className="advanced-learning c-workspace">
      <h3>مراجعات النشاط والتمثيلات</h3>
      <p>
        هذه سجلات اختبار اصطناعي TEST_ONLY. لا تُنشئ اعتماد محتوى حقيقيًا أو
        توقيع مختص. تُربط كل مراجعة ببصمة النسخة، ولا يجوز للمؤلف مراجعة عمله.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        افتح سجل المراجعات
      </button>
      <fieldset disabled={!enabled || busy || revision.status !== "in_review"}>
        <legend>سجل ملاحظتك على النسخة المحالة</legend>
        <label>
          مجال المراجعة
          <select
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as CContentReview["scope"])
            }
          >
            {Object.entries(scopeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          قرار الاختبار
          <select
            value={decision}
            onChange={(event) =>
              setDecision(
                event.target.value === "approve"
                  ? "approve"
                  : "changes_requested",
              )
            }
          >
            <option value="changes_requested">يلزم تعديل</option>
            <option value="approve">اجتازت مراجعتي الاصطناعية</option>
          </select>
        </label>
        <label>
          دليل المراجعة وحدودها
          <textarea
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button disabled={!notes.trim()} onClick={() => void submit()}>
          احفظ مراجعة النسخة
        </button>
      </fieldset>
      {reviews.map((review) => (
        <details key={review.id}>
          <summary>
            {scopeLabels[review.scope]} ·{" "}
            {review.decision === "approve" ? "موافقة اختبار" : "تعديل مطلوب"}
          </summary>
          <p>{review.notesAr}</p>
          <p>
            دور المراجع: {review.reviewerRole} ·{" "}
            {new Date(review.reviewedAt).toLocaleString("ar")} ·{" "}
            {review.contentHash === revision.contentHash
              ? "تطابق النسخة الحالية"
              : "نسخة سابقة"}
          </p>
          <bdi className="content-hash" dir="ltr">
            {review.contentHash}
          </bdi>
        </details>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function ProjectReviewerPanel({ api }: { api: ProductApi }) {
  const [runId, setRunId] = useState(""),
    [run, setRun] = useState<CProjectRun | null>(null),
    [selected, setSelected] = useState(""),
    [decision, setDecision] = useState<"revision_requested" | "accepted">(
      "revision_requested",
    ),
    [feedback, setFeedback] = useState(""),
    [criteria, setCriteria] = useState<
      Record<string, { levelCode: string; reasonAr: string }>
    >({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  async function inspect() {
    const ticket = ++epoch.current;
    setRun(null);
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/studio/project-runs/${encodeURIComponent(runId.trim())}`,
        projectRun,
      );
      if (ticket === epoch.current) {
        setRun(next);
        setSelected(next.submissions.at(-1)?.id ?? "");
        setCriteria({});
        setFeedback("");
      }
    } catch (error) {
      if (ticket === epoch.current) setError(messageOf(error));
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  async function submit() {
    if (!run) return;
    const ticket = epoch.current;
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/studio/project-submissions/${encodeURIComponent(selected)}/feedback`,
        projectRun,
        "POST",
        {
          expectedRevision: run.revision,
          decision,
          feedbackAr: feedback,
          criteria: run.activity.publicRubric.map((criterion) => ({
            criterionCode: criterion.code,
            levelCode: criteria[criterion.code]?.levelCode ?? "",
            reasonAr: criteria[criterion.code]?.reasonAr ?? "",
          })),
        },
      );
      if (ticket === epoch.current) setRun(next);
    } catch (error) {
      if (ticket === epoch.current) setError(messageOf(error));
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  const submission = run?.submissions.find((item) => item.id === selected);
  return (
    <details className="advanced-learning c-workspace">
      <summary>مراجعة مشروع اصطناعي بصلاحية مخوّلة</summary>
      <p>
        الوصول فردي ومراقب. معرفة المرجع لا تكفي؛ يتحقق الخادم من صلاحية المشرف
        ومنع مراجعة عمله. لا تعرض هذه الأداة بيانات مجموعة طلاب.
      </p>
      <label>
        مرجع المشروع
        <input
          dir="ltr"
          value={runId}
          onChange={(event) => {
            epoch.current++;
            setRunId(event.target.value);
            setRun(null);
            setBusy(false);
          }}
        />
      </label>
      <button disabled={busy || !runId.trim()} onClick={() => void inspect()}>
        افتح النسخة للمراجعة
      </button>
      {run && (
        <>
          <h4>{run.activity.titleAr}</h4>
          <p>{run.activity.publicBriefAr}</p>
          <p>مراجعة العمل الحالية: {run.revision.toLocaleString("ar")}</p>
          <label>
            نسخة التسليم
            <select
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                setCriteria({});
                setFeedback("");
              }}
            >
              {run.submissions.map((item) => (
                <option key={item.id} value={item.id}>
                  نسخة {item.revision.toLocaleString("ar")} ·{" "}
                  {item.isFinal ? "نهائي" : "تكويني"}
                </option>
              ))}
            </select>
          </label>
          {submission && (
            <>
              <pre dir="auto">
                {typeof submission.artifact === "string"
                  ? submission.artifact
                  : JSON.stringify(submission.artifact, null, 2)}
              </pre>
              <p>
                إصدار المعايير مثبت بمرجع الدرس{" "}
                <bdi dir="ltr">{run.lessonRevisionId}</bdi>. أي نص أو كود معروض
                كنص ولا يُنفّذ.
              </p>
            </>
          )}
          <fieldset
            disabled={
              busy || !submission || run.readOnly || !!submission.review
            }
          >
            <legend>تغذية راجعة مرتبطة بإصدار التسليم</legend>
            {run.activity.publicRubric.map((criterion) => (
              <fieldset key={criterion.code}>
                <legend>{criterion.titleAr}</legend>
                <p>{criterion.descriptionAr}</p>
                <label>
                  المستوى المراجع
                  <select
                    value={criteria[criterion.code]?.levelCode ?? ""}
                    onChange={(event) =>
                      setCriteria((previous) => ({
                        ...previous,
                        [criterion.code]: {
                          levelCode: event.target.value,
                          reasonAr: previous[criterion.code]?.reasonAr ?? "",
                        },
                      }))
                    }
                  >
                    <option value="">اختر بعد فحص الدليل</option>
                    {criterion.levels.map((level) => (
                      <option key={level.code} value={level.code}>
                        {level.labelAr} — {level.descriptionAr}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  سبب الحكم والدليل
                  <textarea
                    maxLength={1000}
                    value={criteria[criterion.code]?.reasonAr ?? ""}
                    onChange={(event) =>
                      setCriteria((previous) => ({
                        ...previous,
                        [criterion.code]: {
                          levelCode: previous[criterion.code]?.levelCode ?? "",
                          reasonAr: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </fieldset>
            ))}
            <label>
              الملاحظات والتحسين المطلوب
              <textarea
                maxLength={2000}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
            </label>
            <label>
              القرار
              <select
                value={decision}
                onChange={(event) =>
                  setDecision(
                    event.target.value === "accepted"
                      ? "accepted"
                      : "revision_requested",
                  )
                }
              >
                <option value="revision_requested">
                  يحتاج تحسينًا وتسليمًا جديدًا
                </option>
                <option value="accepted">مقبول ضمن المعايير المراجعة</option>
              </select>
            </label>
            <button disabled={!feedback.trim()} onClick={() => void submit()}>
              احفظ المراجعة مع مصدرها
            </button>
          </fieldset>
          {submission?.review && (
            <p>
              {submission.review.feedbackAr} — مراجعة محفوظة؛ يلزم تسليم أحدث
              لمراجعة جديدة.
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
