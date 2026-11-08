import { useEffect, useId, useRef, useState } from "react";
import type { CProjectActivity } from "../../../../packages/contracts/src/advanced-learning";
import type { CProjectRun } from "../../../../packages/contracts/src/advanced-learning-sessions";
import type { AssessmentSession } from "../../../../packages/contracts/src/learning-assessments";
import { ProductApi, ProductFault, messageOf, record } from "../product-api";
import { assessmentSession } from "../learning-path-api";
import { projectRun } from "./advanced-api";
import { RepresentationSwitcher } from "./RepresentationSwitcher";
import { StudentPreferencesPanel } from "./StudentPreferencesPanel";
import {
  draftKey,
  readLocalDraft,
  writeLocalDraft,
  type ProjectDraft,
} from "./draft-cache";
import { defaultDisplayPreferences, displayClass } from "./display-preferences";

const statuses: Record<CProjectRun["status"], string> = {
  active: "قيد العمل",
  paused: "متوقف مؤقتًا",
  withdrawn: "مسحوب",
  awaiting_feedback: "بانتظار المراجع",
  revision_requested: "المراجع طلب تحسينًا",
  review_pending: "التسليم النهائي ينتظر المراجعة",
  feedback_ready: "الملاحظات جاهزة",
  completed: "اكتمل المشروع بعد المراجعة",
};
export function ProjectWorkspace({
  api,
  activity,
  trackRevisionId,
  lessonRevisionId,
  blockIndex,
  onClose,
  onLab,
  onIndependent,
}: {
  api: ProductApi;
  activity: CProjectActivity;
  trackRevisionId: string;
  lessonRevisionId: string;
  blockIndex: number;
  onClose: () => void;
  onLab?: (blockIndex: number) => void;
  onIndependent?: (assessment: AssessmentSession) => void;
}) {
  const [run, setRun] = useState<CProjectRun | null>(null),
    [milestone, setMilestone] = useState(activity.milestones[0]?.code ?? ""),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [artifact, setArtifact] = useState(""),
    [savedArtifact, setSavedArtifact] = useState(""),
    [pendingDraft, setPendingDraft] = useState<ProjectDraft | null>(null),
    [isFinal, setFinal] = useState(false),
    [preferences, setPreferences] = useState(defaultDisplayPreferences),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const epoch = useRef(0),
    heading = useRef<HTMLHeadingElement>(null),
    id = useId();
  const key = `khotwa-path:c:project:${trackRevisionId}:${lessonRevisionId}:${blockIndex}`;
  const localKey = draftKey(
    "project",
    trackRevisionId,
    lessonRevisionId,
    blockIndex,
  );
  function restoreDraft(draft: ProjectDraft, current: CProjectRun) {
    const legalCodes = activity.milestones.map((item) => item.code);
    setNotes({
      ...current.milestones,
      ...Object.fromEntries(
        Object.entries(draft.notes).filter(([code]) =>
          legalCodes.includes(code),
        ),
      ),
    });
    setArtifact(draft.artifact);
    setSavedArtifact("");
    setFinal(draft.isFinal);
    if (legalCodes.includes(draft.milestoneCode))
      setMilestone(draft.milestoneCode);
    setPendingDraft(null);
    setNotice(
      "استُعيدت المسودة المحلية للمراجعة. لم تُستعد موافقة أو نتيجة؛ أرسل المنتج كإصدار جديد عند جاهزيته.",
    );
  }
  function adopt(next: CProjectRun, restore = false) {
    if (
      next.trackRevisionId !== trackRevisionId ||
      next.lessonRevisionId !== lessonRevisionId ||
      next.blockIndex !== blockIndex
    )
      throw new Error("invalid_response");
    setRun(next);
    if (restore) {
      setNotes(next.milestones);
      let cached: ReturnType<typeof readLocalDraft> = null;
      try {
        cached = readLocalDraft(sessionStorage, localKey, next.id);
      } catch {
        /* Optional local draft. */
      }
      if (cached?.schemaVersion === "c-local-project-draft-v1") {
        if (
          cached.baseRevision === next.revision &&
          !next.readOnly &&
          !["completed", "withdrawn", "paused"].includes(next.status)
        )
          restoreDraft(cached, next);
        else setPendingDraft(cached);
      }
    }
    try {
      sessionStorage.setItem(key, next.id);
    } catch {
      /* Resource-only resume. */
    }
  }
  useEffect(() => {
    const ticket = ++epoch.current;
    heading.current?.focus();
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(key);
    } catch {
      /* Optional resume. */
    }
    if (saved && /^[a-zA-Z0-9-]{1,100}$/.test(saved)) {
      setBusy(true);
      void api
        .request(
          `/learning/project-runs/${encodeURIComponent(saved)}`,
          projectRun,
        )
        .then((next) => {
          if (ticket === epoch.current) adopt(next, true);
        })
        .catch((error) => {
          if (
            ticket === epoch.current &&
            !(error instanceof ProductFault && error.status === 404)
          )
            setError(messageOf(error));
        })
        .finally(() => {
          if (ticket === epoch.current) setBusy(false);
        });
    }
    return () => {
      epoch.current++;
    };
  }, [api, key]);
  async function work(
    action: () => Promise<CProjectRun>,
    restore = false,
    submittedArtifact?: string,
  ) {
    if (busy) return;
    const ticket = epoch.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await action();
      if (ticket === epoch.current) {
        adopt(next, restore);
        if (submittedArtifact !== undefined)
          setSavedArtifact(submittedArtifact);
        setNotice(
          "حُفظت النسخة المرسلة مع تاريخها. يمكنك إدخال تحسين في نسخة جديدة.",
        );
      }
    } catch (error) {
      if (ticket === epoch.current) setError(messageOf(error));
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  const current = activity.milestones.find((item) => item.code === milestone);
  const locked =
    busy ||
    !run ||
    run.readOnly ||
    ["completed", "withdrawn", "paused"].includes(run.status);
  function submit() {
    if (!run || !current) return;
    let value: string | Record<string, unknown> = artifact;
    if (current.requiredArtifactKind === "json") {
      try {
        const parsed: unknown = JSON.parse(artifact);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("invalid_json");
        value = parsed as Record<string, unknown>;
      } catch {
        setError(
          "اكتب كائن JSON صالحًا. لا ننفّذ محتوى المنتج؛ يبقى النص في مسودتك.",
        );
        return;
      }
    }
    void work(
      () =>
        api.request(
          `/learning/project-runs/${run.id}/submissions`,
          projectRun,
          "POST",
          {
            expectedRevision: run.revision,
            milestoneCode: milestone,
            artifactKind: current.requiredArtifactKind,
            artifact: value,
            isFinal,
          },
        ),
      false,
      artifact,
    );
  }
  async function independent() {
    if (!run || busy) return;
    const ticket = epoch.current;
    setBusy(true);
    setError("");
    try {
      const next = await api.request(
        `/learning/project-runs/${run.id}/assessment`,
        (value) => {
          const r = record(value);
          return {
            session: projectRun(r.session),
            assessment: assessmentSession(r.assessment),
          };
        },
        "POST",
        { expectedRevision: run.revision },
      );
      if (ticket === epoch.current) {
        adopt(next.session);
        onIndependent?.(next.assessment);
      }
    } catch (error) {
      if (ticket === epoch.current) setError(messageOf(error));
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  const notesDirty =
    !!run &&
    Object.keys(notes).some(
      (code) => (notes[code] ?? "") !== (run.milestones[code] ?? ""),
    );
  const artifactDirty = !!artifact.trim() && artifact !== savedArtifact;
  useEffect(() => {
    if (!run || pendingDraft) return;
    const pendingNotes = Object.fromEntries(
      Object.entries(notes).filter(
        ([code, text]) => text !== (run.milestones[code] ?? ""),
      ),
    );
    try {
      writeLocalDraft(
        sessionStorage,
        localKey,
        Object.keys(pendingNotes).length || artifactDirty
          ? {
              schemaVersion: "c-local-project-draft-v1",
              sessionId: run.id,
              baseRevision: run.revision,
              notes: pendingNotes,
              artifact: artifactDirty ? artifact : "",
              milestoneCode: milestone,
              isFinal,
            }
          : null,
      );
    } catch {
      /* Local caching is optional. */
    }
  }, [
    run,
    pendingDraft,
    notes,
    artifact,
    artifactDirty,
    milestone,
    isFinal,
    localKey,
  ]);
  useEffect(() => {
    if (!notesDirty && !artifactDirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [notesDirty, artifactDirty]);
  useEffect(() => {
    if (
      !run ||
      run.readOnly ||
      busy ||
      error ||
      ["completed", "paused", "withdrawn"].includes(run.status)
    )
      return;
    const changed = Object.keys(notes).find(
      (code) => (notes[code] ?? "") !== (run.milestones[code] ?? ""),
    );
    if (!changed) return;
    const timer = window.setTimeout(() => {
      void work(() =>
        api.request(
          `/learning/project-runs/${run.id}/milestones/${encodeURIComponent(changed)}`,
          projectRun,
          "POST",
          { expectedRevision: run.revision, textAr: notes[changed] ?? "" },
        ),
      );
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [notes, run, busy, error]);
  return (
    <section
      className={`${displayClass(preferences)} c-workspace`}
      dir="rtl"
      style={{ fontSize: `${preferences.textScale}em` }}
      aria-labelledby={id}
    >
      <h3 id={id} ref={heading} tabIndex={-1}>
        {activity.titleAr}
      </h3>
      <p>{activity.drivingQuestionAr}</p>
      <p>{activity.publicBriefAr}</p>
      <p className="helper">
        بيئة اصطناعية · مشروع فردي{" "}
        {activity.projectLevel === "micro" ? "مصغّر" : "عبر دروس متعددة"}.
        التسليم والمراجعة والتحسين تعلّمٌ؛ لا يمنح إكمال المشروع إتقانًا
        مستقلًا.
      </p>
      <StudentPreferencesPanel value={preferences} onChange={setPreferences} />
      <RepresentationSwitcher
        variants={activity.representations}
        onLab={onLab}
      />
      <section aria-label="معايير جودة المنتج">
        <h4>ما المنتَج المتوقع؟</h4>
        <dl>
          {activity.publicRubric.map((criterion) => (
            <div key={criterion.code}>
              <dt>{criterion.titleAr}</dt>
              <dd>
                {criterion.descriptionAr}
                <ul>
                  {criterion.levels.map((level) => (
                    <li key={level.code}>
                      {level.labelAr}: {level.descriptionAr}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {!run ? (
        <button
          disabled={busy}
          onClick={() =>
            void work(
              () =>
                api.request("/learning/project-runs", projectRun, "POST", {
                  trackRevisionId,
                  lessonRevisionId,
                  blockIndex,
                }),
              true,
            )
          }
        >
          ابدأ مشروعي
        </button>
      ) : (
        <>
          <p role="status">
            {statuses[run.status]} · نسخة عمل{" "}
            {run.revision.toLocaleString("ar")}
          </p>
          {run.readOnly && (
            <p>تعديل المشاريع متوقف حاليًا؛ العمل السابق متاح للقراءة.</p>
          )}
          {pendingDraft && (
            <aside
              className="c-feedback"
              aria-label="مسودة مشروع محلية لنسخة سابقة"
            >
              <h4>توجد مسودة محلية تحتاج مقارنة بالنسخة الحالية</h4>
              <p>
                ثبت الخادم ملكيتك للمشروع، لكن المراجعة أو الحالة تغيّرت. لا
                ندمج المسودة أو موافقة سابقة تلقائيًا.
              </p>
              <details>
                <summary>راجع النص والمنتج المحليين</summary>
                {Object.entries(pendingDraft.notes).map(([code, text]) => (
                  <p key={code}>
                    {activity.milestones.find((item) => item.code === code)
                      ?.titleAr ?? code}
                    : {text}
                  </p>
                ))}
                <pre dir="auto">{pendingDraft.artifact}</pre>
              </details>
              <button
                disabled={
                  busy ||
                  run.readOnly ||
                  ["completed", "withdrawn", "paused"].includes(run.status)
                }
                onClick={() => restoreDraft(pendingDraft, run)}
              >
                استعد المسودة للمراجعة على النسخة الحالية
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setPendingDraft(null);
                  try {
                    writeLocalDraft(sessionStorage, localKey, null);
                  } catch {
                    /* Optional cache. */
                  }
                }}
              >
                تخلّص من هذه المسودة المحلية
              </button>
            </aside>
          )}
          <label>
            اختر مرحلة المشروع
            <select
              value={milestone}
              onChange={(event) => setMilestone(event.target.value)}
            >
              {activity.milestones.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.titleAr}
                  {item.required ? " — مطلوبة" : " — اختيارية"}
                </option>
              ))}
            </select>
          </label>
          {current && (
            <>
              <p>{current.descriptionAr}</p>
              <label htmlFor={`${id}-notes`}>
                قراراتي وملاحظاتي لهذه المرحلة
              </label>
              <textarea
                id={`${id}-notes`}
                readOnly={
                  run.readOnly ||
                  ["completed", "withdrawn", "paused"].includes(run.status)
                }
                value={notes[milestone] ?? ""}
                maxLength={2000}
                onChange={(event) => {
                  setError("");
                  setNotes((previous) => ({
                    ...previous,
                    [milestone]: event.target.value,
                  }));
                }}
              />
              <p role="status">
                {notesDirty
                  ? "تنتظر ملاحظات المراحل الحفظ التلقائي؛ يمكنك حفظها يدويًا أيضًا."
                  : "ملاحظات المراحل مطابقة للمحفوظ."}
              </p>
              <button
                disabled={locked}
                onClick={() =>
                  void work(() =>
                    api.request(
                      `/learning/project-runs/${run.id}/milestones/${encodeURIComponent(milestone)}`,
                      projectRun,
                      "POST",
                      {
                        expectedRevision: run.revision,
                        textAr: notes[milestone] ?? "",
                      },
                    ),
                  )
                }
              >
                احفظ مرحلة المشروع
              </button>
              <fieldset disabled={locked}>
                <legend>إصدار المنتج الذي تريد مراجعته</legend>
                <p>
                  التسليم نص صغير أو JSON فقط؛ لا رفع ملفات أو مشاركة عامة أو
                  تنفيذ كود. احتفظ بالإصدارات السابقة وحدد كيف حسّنت عملك.
                </p>
                <label htmlFor={`${id}-artifact`}>
                  {current.requiredArtifactKind === "json"
                    ? "المنتج المنظم بصيغة JSON"
                    : "نص المنتج وتفسيره"}
                </label>
                <textarea
                  id={`${id}-artifact`}
                  dir={
                    current.requiredArtifactKind === "json" ||
                    activity.subject === "programming"
                      ? "ltr"
                      : "rtl"
                  }
                  value={artifact}
                  maxLength={16000}
                  spellCheck={activity.subject !== "programming"}
                  onChange={(event) => setArtifact(event.target.value)}
                />
                {activity.subject === "programming" && (
                  <p>
                    الكود نص للتتبع والتقييم المنطقي، ولا يُشغّل خارج بيئة تنفيذ
                    معتمدة.
                  </p>
                )}
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={isFinal}
                    onChange={(event) => setFinal(event.target.checked)}
                  />
                  هذا تسليم نهائي بعد اكتمال المراحل المطلوبة
                </label>
                <button
                  onClick={submit}
                  disabled={!artifact.trim() || notesDirty}
                >
                  احفظ إصدارًا وأرسله للمراجعة
                </button>
              </fieldset>
            </>
          )}
          <section aria-label="تاريخ التسليم والمراجعة">
            <h4>إصدارات منتَجي وملاحظات المراجعة</h4>
            {!run.submissions.length && <p>لم تُسلّم نسخة بعد.</p>}
            {run.submissions.map((submission) => (
              <details key={submission.id}>
                <summary>
                  إصدار {submission.revision.toLocaleString("ar")} ·{" "}
                  {activity.milestones.find(
                    (item) => item.code === submission.milestoneCode,
                  )?.titleAr ?? submission.milestoneCode}{" "}
                  · {submission.isFinal ? "نهائي" : "لتحسين العمل"} ·{" "}
                  {submission.status === "accepted"
                    ? "مقبول بالمراجعة"
                    : submission.status === "revision_requested"
                      ? "يحتاج تحسينًا"
                      : "بانتظار مراجعة بشرية"}
                </summary>
                <pre
                  dir={
                    activity.subject === "programming" ||
                    submission.artifactKind === "json"
                      ? "ltr"
                      : "rtl"
                  }
                >
                  {typeof submission.artifact === "string"
                    ? submission.artifact
                    : JSON.stringify(submission.artifact, null, 2)}
                </pre>
                {submission.review ? (
                  <aside className="c-feedback">
                    <p>{submission.review.feedbackAr}</p>
                    <ul>
                      {submission.review.criteria.map((criterion) => (
                        <li key={criterion.criterionCode}>
                          {activity.publicRubric.find(
                            (item) => item.code === criterion.criterionCode,
                          )?.titleAr ?? criterion.criterionCode}
                          : {criterion.levelCode} — {criterion.reasonAr}
                        </li>
                      ))}
                    </ul>
                    <p>
                      المراجعة مرتبطة بإصدار التسليم{" "}
                      {submission.review.assessedSubmissionRevision.toLocaleString(
                        "ar",
                      )}{" "}
                      ومرجع معيار{" "}
                      <bdi dir="ltr">{submission.review.rubricRevisionId}</bdi>{" "}
                      ·{" "}
                      {new Date(submission.review.reviewedAt).toLocaleString(
                        "ar",
                      )}
                      .
                    </p>
                  </aside>
                ) : (
                  <p>لا توجد درجة آلية حاسمة لهذا المنتج المفتوح.</p>
                )}
                <button
                  disabled={locked || artifactDirty}
                  onClick={() => {
                    setMilestone(submission.milestoneCode);
                    setArtifact(
                      typeof submission.artifact === "string"
                        ? submission.artifact
                        : JSON.stringify(submission.artifact, null, 2),
                    );
                    setSavedArtifact("");
                    setFinal(false);
                  }}
                >
                  ابدأ تحسينًا من هذه النسخة
                </button>
              </details>
            ))}
          </section>
          <div className="actions">
            <button
              disabled={busy}
              onClick={() =>
                void work(() =>
                  api.request(`/learning/project-runs/${run.id}`, projectRun),
                )
              }
            >
              حدّث حالة المراجعة
            </button>
            <button
              disabled={locked || notesDirty || artifactDirty}
              onClick={() =>
                void work(() =>
                  api.request(
                    `/learning/project-runs/${run.id}/state`,
                    projectRun,
                    "POST",
                    { expectedRevision: run.revision, action: "pause" },
                  ),
                )
              }
            >
              أوقف العمل مؤقتًا
            </button>
            {run.status === "paused" && (
              <button
                disabled={busy || run.readOnly}
                onClick={() =>
                  void work(() =>
                    api.request(
                      `/learning/project-runs/${run.id}/state`,
                      projectRun,
                      "POST",
                      { expectedRevision: run.revision, action: "resume" },
                    ),
                  )
                }
              >
                استأنف العمل
              </button>
            )}
            <button
              disabled={
                locked ||
                notesDirty ||
                artifactDirty ||
                run.status !== "feedback_ready"
              }
              onClick={() =>
                void work(() =>
                  api.request(
                    `/learning/project-runs/${run.id}/finish`,
                    projectRun,
                    "POST",
                    { expectedRevision: run.revision },
                  ),
                )
              }
            >
              أنهِ المشروع بعد المراجعة
            </button>
            {run.status === "completed" && onIndependent && (
              <button
                disabled={busy || run.readOnly}
                onClick={() => void independent()}
              >
                ابحث عن تقييم جديد مستقل
              </button>
            )}
          </div>
          <details>
            <summary>مرجع مشاركة مع مراجع مخوّل</summary>
            <p>
              هذا المرجع وحده لا يعطي صلاحية الاطلاع. شاركه ضمن فريق المراجعة
              المصرح به فقط.
            </p>
            <bdi dir="ltr">{run.id}</bdi>
          </details>
          {run.status !== "completed" && run.status !== "withdrawn" && (
            <details>
              <summary>سحب المشروع الحالي</summary>
              <p>
                يبقى تاريخ التسليمات محفوظًا، وتتوقف هذه الرحلة. هذا اختيار
                مشاركة ولا يُعد حكمًا على فهمك.
              </p>
              <button
                disabled={busy || run.readOnly || notesDirty || artifactDirty}
                onClick={() =>
                  void work(() =>
                    api.request(
                      `/learning/project-runs/${run.id}/state`,
                      projectRun,
                      "POST",
                      { expectedRevision: run.revision, action: "withdraw" },
                    ),
                  )
                }
              >
                اسحب المشروع الحالي بعد حفظ العمل
              </button>
            </details>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {artifactDirty && (
        <p role="status">
          توجد مسودة منتَج لم تُرسل. أرسلها كإصدار محفوظ أو امسحها قبل إغلاق
          مساحة المشروع. تبقى نسخة محلية في علامة التبويب هذه عند توفر التخزين؛
          لا تعني تسليمًا خادميًا.
        </p>
      )}
      <button disabled={busy || notesDirty || artifactDirty} onClick={onClose}>
        ارجع للدرس بعد حفظ عملك
      </button>
    </section>
  );
}
