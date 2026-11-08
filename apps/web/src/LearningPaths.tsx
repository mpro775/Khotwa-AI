import { useEffect, useRef, useState } from "react";
import type {
  AssessmentKind,
  AssessmentSession,
  AssessmentSummary,
  LearningPathProgress,
  LearningRecommendation,
  LearningSkillEvidence,
} from "../../../packages/contracts/src/learning-assessments";
import type {
  LearningContentRevision,
  LearningLessonDetail,
  LearningTrackDetail,
} from "../../../packages/contracts/src/learning-paths";
import {
  ProductApi,
  type Subject,
  arrayField,
  messageOf,
  record,
  textField,
} from "./product-api";
import {
  assessmentSession,
  assessmentSummary,
  enumField,
  learningItems,
  lessonDetail,
  pathProgress,
  trackDetail,
} from "./learning-path-api";
import {
  type AnswerDraft,
  type PathSelection,
  pathSelectionKey,
  readAnswerDraft,
  readPathSelection,
  writeAnswerDraft,
} from "./learning-path-session";
import { LessonRenderer } from "./LessonRenderer";
import { MathInput } from "./MathInput";
import { StemLabPlayer } from "./StemLabs";
import { ProblemJourney } from "./advanced-learning/ProblemJourney";
import { ProjectWorkspace } from "./advanced-learning/ProjectWorkspace";
import { LearningAnalyticsDashboard } from "./advanced-learning/LearningAnalyticsDashboard";
import {
  DeepDiagnosisPanel,
  IntelligentLearningPanel,
} from "./IntelligentLearningPanel";

const subjects: Record<Subject, string> = {
  algebra: "الرياضيات",
  physics: "الفيزياء",
  programming: "البرمجة · Python",
};
const evidenceLabels: Record<LearningSkillEvidence["state"], string> = {
  not_assessed: "لم تُقَس بعد",
  needs_review: "قد تفيد المراجعة",
  practicing_with_support: "تتقدم بمساعدة",
  independent_evidence: "دليل فهم مستقل",
  insufficient_evidence: "نحتاج دليلًا إضافيًا",
};
const lessonStates = {
  not_started: "لم أبدأ",
  viewed: "اطلعت على الدرس",
  practiced: "تدربت",
  independent_evidence: "دليل فهم مستقل",
};
const verdictLabels: Record<string, string> = {
  verified_valid: "تحويل صحيح ضمن النطاق المدعوم",
  verified_invalid: "التحويل غيّر حلول المعادلة؛ راجع خطواتك",
  syntax_error: "تحتاج الصياغة إلى تصحيح قبل التحقق",
  unsupported: "هذه الصيغة خارج نطاق التحقق الحالي",
  inconclusive: "لا يكفي التحقق الحالي لإصدار حكم",
  service_error: "تعذر التحقق؛ ليست نتيجة على فهمك",
  correct: "القيمة والوحدة صحيحتان",
  wrong_value: "القيمة تحتاج مراجعة",
  wrong_unit: "الوحدة تحتاج مراجعة",
};
function storedSelection(key = pathSelectionKey): PathSelection | null {
  try {
    return readPathSelection(sessionStorage, key);
  } catch {
    return null;
  }
}
function remember(selection: PathSelection) {
  try {
    sessionStorage.setItem(pathSelectionKey, JSON.stringify(selection));
    if (selection.assessmentId)
      sessionStorage.setItem(
        "khotwa-path:last:" + selection.subject,
        JSON.stringify(selection),
      );
  } catch {
    /* Optional tab-scoped resume. */
  }
}

function EvidenceTable({ skills }: { skills: LearningSkillEvidence[] }) {
  return (
    <div className="table-scroll assessment-summary">
      <table>
        <caption>أدلة المهارات في هذه المادة</caption>
        <thead>
          <tr>
            <th scope="col">المهارة</th>
            <th scope="col">الحالة</th>
            <th scope="col">نجاح مستقل</th>
            <th scope="col">يحتاج مراجعة</th>
            <th scope="col">بمساعدة</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr key={skill.skillCode}>
              <th scope="row">{skill.titleAr}</th>
              <td>{evidenceLabels[skill.state]}</td>
              <td>{skill.independentCorrect.toLocaleString("ar")}</td>
              <td>{skill.independentErrors.toLocaleString("ar")}</td>
              <td>{skill.assisted.toLocaleString("ar")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="helper">
        هذه أدلة محدودة من المحاولات المتحققة، وليست حكمًا دائمًا على القدرة.
        عرض الشرح وحده لا يضيف نجاحًا، والامتناع أو تعذر الخدمة لا يُحسبان خطأً
        مفاهيميًا.
      </p>
    </div>
  );
}
function RecommendationCard({
  value,
  open,
}: {
  value: LearningRecommendation | null;
  open: (id: string) => void;
}) {
  if (!value)
    return <p>لا تتوفر توصية بدرس منشور حاليًا. يمكنك اختيار درس آخر بحرية.</p>;
  return (
    <section className="lesson-callout">
      <h3>درس مقترح لك</h3>
      <p>{value.reasonAr}</p>
      <p>
        التوصية متحفظة · عدد الأدلة المستخدمة:{" "}
        {value.evidenceCount.toLocaleString("ar")}
      </p>
      <button onClick={() => open(value.recommendedLessonId)}>
        افتح الدرس المقترح
      </button>
      {value.mappingPending.length > 0 && (
        <p className="helper">
          بعض علاقات المهارات لا تزال قيد المراجعة؛ لا نجزم بسبب الخطأ.
        </p>
      )}
      {value.alternatives.length > 0 && (
        <details>
          <summary>عرض دروس أخرى</summary>
          <div className="actions">
            {value.alternatives.map((item) => (
              <button
                key={item.lessonRevisionId}
                onClick={() => open(item.lessonRevisionId)}
              >
                {item.titleAr}
              </button>
            ))}
          </div>
        </details>
      )}
      <details>
        <summary>مصدر التوصية وحدودها</summary>
        <p>
          مصدرها أدلة محاولاتك المتحققة وقاعدة توصية ثابتة؛ لا يصدر النموذج
          اللغوي حكم المهارة. نسخة القاعدة:{" "}
          <bdi dir="ltr">{value.ruleVersion}</bdi>.
        </p>
        <p>
          لا يثبت خطأ واحد سببًا مفاهيميًا راسخًا، ويمكن أن تغيّر محاولات مستقلة
          لاحقة التوصية.
        </p>
      </details>
    </section>
  );
}

export function LearningPaths({ api }: { api: ProductApi }) {
  const initial = useRef(storedSelection()),
    epoch = useRef(0);
  const [subject, setSubject] = useState<Subject>(
      initial.current?.subject ?? "algebra",
    ),
    [tracks, setTracks] = useState<LearningContentRevision[]>([]),
    [track, setTrack] = useState<LearningTrackDetail | null>(null),
    [lesson, setLesson] = useState<LearningLessonDetail | null>(null),
    [session, setSession] = useState<AssessmentSession | null>(null),
    [summary, setSummary] = useState<AssessmentSummary | null>(null),
    [progress, setProgress] = useState<LearningPathProgress | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [labIndex, setLabIndex] = useState<number | null>(null);
  const [activityIndex, setActivityIndex] = useState<number | null>(null);
  const [nativeSupport, setNativeSupport] = useState<{
    kind: "scaffold" | "tutor" | "reflection";
    id: string;
  } | null>(null);
  useEffect(() => {
    setLabIndex(null);
    setActivityIndex(null);
    setNativeSupport(null);
  }, [track?.id]);
  const selection = (next: Partial<PathSelection> = {}) => ({
    subject,
    trackId: track?.id ?? null,
    lessonId: lesson?.id ?? null,
    assessmentId: session?.id ?? null,
    ...next,
  });
  async function loadProgress(id: string) {
    return api.request(
      `/learning/progress?trackRevisionId=${encodeURIComponent(id)}`,
      pathProgress,
    );
  }
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request(
        `/learning/tracks?subject=${subject}`,
        learningItems,
        "GET",
        undefined,
        undefined,
        controller.signal,
      )
      .then(setTracks)
      .catch((e) => {
        if (!controller.signal.aborted) setError(messageOf(e));
      });
    return () => controller.abort();
  }, [api, subject]);
  useEffect(() => {
    let active = true;
    const saved = initial.current;
    if (!saved?.trackId) return;
    setBusy(true);
    void (async () => {
      const assessment = saved.assessmentId
        ? await api.request(
            `/assessments/${saved.assessmentId}`,
            assessmentSession,
          )
        : null;
      const [restoredTrack, restoredLesson, restoredProgress] =
        await Promise.all([
          api.request(
            `/learning/tracks/${assessment?.trackRevisionId ?? saved.trackId}`,
            trackDetail,
          ),
          saved.lessonId
            ? api.request(`/learning/lessons/${saved.lessonId}`, lessonDetail)
            : Promise.resolve(null),
          loadProgress(assessment?.trackRevisionId ?? saved.trackId!),
        ]);
      if (active) {
        setTrack(restoredTrack);
        setLesson(restoredLesson);
        setSession(assessment);
        setProgress(restoredProgress);
        setNotice(
          "استُعيدت النسخة المثبتة في جلسة هذا المتصفح. مسودتك المحلية محفوظة في علامة التبويب هذه.",
        );
      }
    })()
      .catch((e) => {
        if (active) setError(messageOf(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function work(action: (version: number) => Promise<void>) {
    const version = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      await action(version);
    } catch (e) {
      if (epoch.current === version) setError(messageOf(e));
    } finally {
      if (epoch.current === version) setBusy(false);
    }
  }
  function chooseSubject(next: Subject) {
    epoch.current++;
    setSubject(next);
    setTrack(null);
    setLesson(null);
    setSession(null);
    setSummary(null);
    setProgress(null);
    setError("");
    setNotice("");
    setBusy(false);
    remember({
      subject: next,
      trackId: null,
      lessonId: null,
      assessmentId: null,
    });
  }
  async function openTrack(id: string) {
    await work(async (version) => {
      const [next, evidence] = await Promise.all([
        api.request(`/learning/tracks/${id}`, trackDetail),
        loadProgress(id),
      ]);
      if (version !== epoch.current) return;
      setTrack(next);
      setLesson(null);
      setSession(null);
      setSummary(null);
      setProgress(evidence);
      remember(
        selection({ trackId: next.id, lessonId: null, assessmentId: null }),
      );
    });
  }
  async function openLesson(
    id: string,
    openLabIndex?: number,
    openActivityIndex?: number,
  ) {
    await work(async (version) => {
      const next = await api.request(`/learning/lessons/${id}`, lessonDetail);
      await api.request(`/learning/lessons/${id}/progress`, record, "POST", {
        event: "lesson_started",
      });
      if (version !== epoch.current) return;
      setLesson(next);
      setLabIndex(openLabIndex ?? null);
      setActivityIndex(openActivityIndex ?? null);
      setSummary(null);
      setSession(null);
      setNotice(
        "فتح الدرس لا يُحسب دليلًا على الفهم؛ تدرب ثم جرّب سؤالًا مستقلًا.",
      );
      remember(selection({ lessonId: next.id, assessmentId: null }));
    });
  }
  async function start(kind: AssessmentKind) {
    if (!track) return;
    await work(async (version) => {
      const next = await api.request(
        "/assessments/start",
        assessmentSession,
        "POST",
        {
          trackRevisionId: track.id,
          ...(kind === "diagnostic_pretest"
            ? {}
            : { lessonRevisionId: lesson?.id }),
          kind,
        },
      );
      if (version !== epoch.current) return;
      setSession(next);
      setSummary(null);
      setNotice(next.coverage.messageAr);
      remember(selection({ assessmentId: next.id }));
    });
  }
  async function showSummary(next: AssessmentSession) {
    await work(async (version) => {
      const [result, evidence] = await Promise.all([
        api.request(`/assessments/${next.id}/summary`, assessmentSummary),
        loadProgress(next.trackRevisionId),
      ]);
      if (version !== epoch.current) return;
      setSummary(result);
      setSession(result.session);
      setProgress(evidence);
    });
  }
  async function resumeAssessment(saved: PathSelection) {
    if (!saved.assessmentId) return;
    await work(async (version) => {
      const next = await api.request(
        `/assessments/${saved.assessmentId}`,
        assessmentSession,
      );
      const [restoredTrack, restoredLesson, evidence] = await Promise.all([
        api.request(`/learning/tracks/${next.trackRevisionId}`, trackDetail),
        next.lessonRevisionId
          ? api.request(
              `/learning/lessons/${next.lessonRevisionId}`,
              lessonDetail,
            )
          : Promise.resolve(null),
        loadProgress(next.trackRevisionId),
      ]);
      if (version !== epoch.current) return;
      setTrack(restoredTrack);
      setLesson(restoredLesson);
      setSession(next);
      setProgress(evidence);
      setSummary(null);
      remember({
        subject: next.subject,
        trackId: next.trackRevisionId,
        lessonId: next.lessonRevisionId,
        assessmentId: next.id,
      });
    });
  }
  const last = storedSelection("khotwa-path:last:" + subject);
  return (
    <section
      className="learning-paths"
      aria-labelledby="learning-paths-title"
      aria-busy={busy}
    >
      <header>
        <h2 id="learning-paths-title">تعلّم درسًا، أو اختبر مستواك</h2>
        <p>
          اختر مسارًا منشورًا. توصيات الدروس تتبع الأدلة، ويمكنك متابعة الدروس
          الأخرى في أي وقت.
        </p>
      </header>
      <div className="learning-subjects" aria-label="مواد التعلم">
        {Object.entries(subjects).map(([code, label]) => (
          <button
            key={code}
            aria-pressed={subject === code}
            onClick={() => chooseSubject(code as Subject)}
          >
            <strong>{label}</strong>
            <span>
              {code === "algebra"
                ? "الجبر الأساسي والمعادلات"
                : code === "physics"
                  ? "الحركة الخطية والوحدات"
                  : "أساسيات Python"}
            </span>
          </button>
        ))}
      </div>
      {!session && last?.assessmentId && (
        <div className="actions">
          <button disabled={busy} onClick={() => void resumeAssessment(last)}>
            استأنف آخر تدريب أو تقييم في هذه المادة
          </button>
        </div>
      )}
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {busy ? "جارٍ تحميل النسخة وحفظ العملية…" : notice}
      </p>
      {!track ? (
        <div className="product-grid">
          {tracks.length ? (
            tracks.map((item) => (
              <article key={item.id} className="product-card">
                <span className="eyebrow">
                  مسار منشور · إصدار {item.version.toLocaleString("ar")}
                </span>
                <h3>{item.payload.titleAr}</h3>
                <p>{item.payload.descriptionAr}</p>
                <button disabled={busy} onClick={() => void openTrack(item.id)}>
                  افتح مسار التعلم
                </button>
              </article>
            ))
          ) : (
            <div className="product-card">
              <h3>لا يوجد مسار منشور لهذه المادة بعد</h3>
              <p>
                الدروس قيد الإعداد والمراجعة لا تظهر للطالب. يمكنك متابعة بنك
                المسائل المتاح أدناه.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="actions">
            <button
              disabled={busy}
              onClick={() => {
                setTrack(null);
                setLesson(null);
                setSession(null);
                setSummary(null);
                remember(
                  selection({
                    trackId: null,
                    lessonId: null,
                    assessmentId: null,
                  }),
                );
              }}
            >
              كل المسارات
            </button>
            {(lesson || session) && (
              <button
                disabled={busy}
                onClick={() => {
                  setLesson(null);
                  setSession(null);
                  setSummary(null);
                  remember(selection({ lessonId: null, assessmentId: null }));
                }}
              >
                دروس المسار
              </button>
            )}
          </div>
          <h2>{track.payload.titleAr}</h2>
          <IntelligentLearningPanel
            key={track.id}
            api={api}
            trackRevisionId={track.id}
            lessons={track.lessons}
            selectedLessonId={lesson?.id}
            assessment={session}
            onOpenLesson={(id) => void openLesson(id)}
            onOpenLab={(id, index) => void openLesson(id, index)}
            onOpenAdvanced={(id, index) =>
              void openLesson(id, undefined, index)
            }
            nativeSupport={nativeSupport}
            onAssessment={(next) => {
              if (next.trackRevisionId !== track.id) return;
              setSession(next);
              setSummary(null);
              remember(selection({ assessmentId: next.id }));
            }}
          />
          {!lesson && !session && track.payload.kind === "track" && (
            <>
              <p>{track.payload.descriptionAr}</p>
              <button
                className="primary"
                disabled={busy || subject === "programming"}
                onClick={() => void start("diagnostic_pretest")}
              >
                اختبر مستواك في{" "}
                {subject === "algebra"
                  ? "الجبر"
                  : subject === "physics"
                    ? "الفيزياء"
                    : "Python"}
              </button>
              {subject === "programming" && (
                <p className="helper">
                  الدروس للقراءة والمراجعة. القياس البرمجي المستقل مرتبط بإعداد
                  خدمة التنفيذ المعزولة؛ لا يُحتسب فهم مستقل دون نتائجها.
                </p>
              )}
              {track.payload.units.map((unit) => (
                <section key={unit.code} className="product-card">
                  <h3>{unit.titleAr}</h3>
                  {unit.lessonRevisionIds.map((id) => {
                    const item = track.lessons.find((entry) => entry.id === id);
                    if (!item || item.payload.kind !== "lesson") return null;
                    const state =
                      progress?.lessons.find(
                        (entry) => entry.lessonRevisionId === item.id,
                      )?.state ?? "not_started";
                    return (
                      <article className="path-lesson-card" key={item.id}>
                        <span className="eyebrow">{lessonStates[state]}</span>
                        <h4>{item.payload.titleAr}</h4>
                        <p>{item.payload.descriptionAr}</p>
                        <ul>
                          {item.payload.objectives.map((objective, index) => (
                            <li key={index}>{objective}</li>
                          ))}
                        </ul>
                        {item.payload.prerequisiteSkillCodes.length > 0 && (
                          <p className="helper">
                            مهارات سابقة:{" "}
                            {item.payload.prerequisiteSkillCodes
                              .map(
                                (code) =>
                                  progress?.skills.find(
                                    (skill) => skill.skillCode === code,
                                  )?.titleAr ?? code,
                              )
                              .join("، ")}
                          </p>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => void openLesson(item.id)}
                        >
                          تعلّم هذا الدرس
                        </button>
                      </article>
                    );
                  })}
                </section>
              ))}
              {progress && (
                <section className="product-card">
                  <h3>تقدمي في المسار</h3>
                  <EvidenceTable skills={progress.skills} />
                  <RecommendationCard
                    value={progress.recommendation}
                    open={(id) => void openLesson(id)}
                  />
                </section>
              )}
              <LearningAnalyticsDashboard
                key={track.id}
                api={api}
                trackRevisionId={track.id}
              />
            </>
          )}
          {lesson && !session && lesson.payload.kind === "lesson" && (
            <section className="product-card">
              <p className="eyebrow">
                نسخة الدرس {lesson.version.toLocaleString("ar")} ·{" "}
                {lesson.status === "published"
                  ? "محتوى منشور"
                  : "نسخة تاريخية مثبتة لهذه الرحلة"}
              </p>
              <LessonRenderer
                payload={lesson.payload}
                validation={lesson.validation}
                onPractice={() => void start("practice")}
                onLab={setLabIndex}
                onActivity={setActivityIndex}
              />
              {activityIndex !== null &&
                (() => {
                  const activity =
                    lesson.payload.kind === "lesson"
                      ? lesson.payload.contentBlocks[activityIndex]?.activity
                      : undefined;
                  const common = {
                    api,
                    trackRevisionId: track.id,
                    lessonRevisionId: lesson.id,
                    blockIndex: activityIndex,
                    onClose: () => setActivityIndex(null),
                    onLab: setLabIndex,
                    onNativeSupport: setNativeSupport,
                    onIndependent: (assessment: AssessmentSession) => {
                      setActivityIndex(null);
                      setSession(assessment);
                      setSummary(null);
                      remember(selection({ assessmentId: assessment.id }));
                    },
                  };
                  return activity?.type === "problem_based" ? (
                    <ProblemJourney
                      key={`${lesson.id}:problem:${activityIndex}`}
                      {...common}
                      activity={activity}
                    />
                  ) : activity?.type === "project_based" ? (
                    <ProjectWorkspace
                      key={`${lesson.id}:project:${activityIndex}`}
                      {...common}
                      activity={activity}
                    />
                  ) : null;
                })()}
              {labIndex !== null && (
                <StemLabPlayer
                  key={`${lesson.id}:${labIndex}`}
                  api={api}
                  trackRevisionId={track.id}
                  lessonRevisionId={lesson.id}
                  blockIndex={labIndex}
                  onClose={() => setLabIndex(null)}
                  onIndependent={() => {
                    setLabIndex(null);
                    void start("lesson_check");
                  }}
                />
              )}
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void work(async () => {
                      await api.request(
                        `/learning/lessons/${lesson.id}/progress`,
                        record,
                        "POST",
                        { event: "lesson_viewed" },
                      );
                      setProgress(await loadProgress(track.id));
                      setNotice(
                        "سُجلت دراسة الشرح. يلزم أداء متحقق لقياس الفهم.",
                      );
                    })
                  }
                >
                  أنهيت قراءة الشرح
                </button>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !lesson.practiceProblems.length ||
                    subject === "programming"
                  }
                  onClick={() => void start("practice")}
                >
                  ابدأ التدريب
                </button>
                <button
                  disabled={
                    busy ||
                    !lesson.assessmentProblems.length ||
                    subject === "programming"
                  }
                  onClick={() => void start("lesson_check")}
                >
                  اختبر فهمي دون مساعدة
                </button>
                <button
                  disabled={
                    busy ||
                    !lesson.assessmentProblems.length ||
                    subject === "programming"
                  }
                  onClick={() => void start("post_remediation")}
                >
                  سؤال جديد بعد التدريب
                </button>
              </div>
              {(!lesson.practiceProblems.length ||
                !lesson.assessmentProblems.length) && (
                <p className="helper">
                  لا توجد أسئلة كافية لهذا التقييم بعد؛ لا نعوّض المحتوى غير
                  المراجع بأسئلة مولدة.
                </p>
              )}
              {subject === "programming" && (
                <p className="helper">
                  القراءة متاحة. التشغيل والتقييم محجوبان هنا حتى اكتمال إعداد
                  خدمة التنفيذ المعزولة؛ استخدم مساحة Python لمعرفة حالتها
                  الفعلية.
                </p>
              )}
            </section>
          )}
          {session && !summary && (
            <fieldset disabled={busy} className="assessment-container">
              <legend>نشاط التعلم الحالي</legend>
              <AssessmentPanel
                api={api}
                key={session.id}
                initial={session}
                onSession={(next) => {
                  setSession(next);
                  remember(selection({ assessmentId: next.id }));
                }}
                onSummary={(next) => void showSummary(next)}
              />
            </fieldset>
          )}
          {summary && (
            <section className="product-card">
              <h3>ملخص الأدلة والتوصية</h3>
              <p>{summary.session.coverage.messageAr}</p>
              <EvidenceTable skills={summary.skills} />
              <RecommendationCard
                value={summary.recommendation}
                open={(id) => void openLesson(id)}
              />
              <div className="actions">
                <button disabled={busy} onClick={() => setSummary(null)}>
                  راجع محاولات التقييم
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setSession(null);
                    setSummary(null);
                    remember(selection({ assessmentId: null }));
                  }}
                >
                  تابع التعلم باختيارك
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}

interface HintView {
  level: "H1" | "H2" | "H3" | "H4";
  textAr: string;
  source: string;
  solutionStepsAr: string[];
}
function AssessmentPanel({
  api,
  initial,
  onSession,
  onSummary,
}: {
  api: ProductApi;
  initial: AssessmentSession;
  onSession: (session: AssessmentSession) => void;
  onSummary: (session: AssessmentSession) => void;
}) {
  const [session, setSession] = useState(initial),
    [index, setIndex] = useState(() =>
      Math.max(
        0,
        initial.questions.findIndex((question) => !question.completed),
      ),
    ),
    [drafts, setDrafts] = useState<Record<string, AnswerDraft>>(() =>
      Object.fromEntries(
        initial.questions.map((question) => {
          let saved: AnswerDraft | null = null;
          try {
            saved = readAnswerDraft(sessionStorage, initial.id, question.id);
          } catch {
            /* Optional browser storage. */
          }
          return [
            question.id,
            saved ?? {
              steps: question.steps.length ? question.steps : [""],
              value: question.value,
              unit: question.unit,
            },
          ];
        }),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [hint, setHint] = useState<HintView | null>(null),
    [confirmHelp, setConfirmHelp] = useState(false),
    [confirmSolution, setConfirmSolution] = useState(false),
    [diagnosisEpoch, setDiagnosisEpoch] = useState(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const question = session.questions[index],
    draft = question ? drafts[question.id] : null;
  function adopt(next: AssessmentSession) {
    setSession(next);
    onSession(next);
  }
  function change(next: AnswerDraft) {
    if (!question) return;
    setDrafts((current) => ({ ...current, [question.id]: next }));
    setHint(null);
    setNotice("مسودة معدلة؛ احفظها وأعد التحقق قبل اعتماد النتيجة.");
    try {
      writeAnswerDraft(sessionStorage, session.id, question.id, next);
    } catch {
      /* In-memory state still holds the draft. */
    }
  }
  async function work(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (active.current) setError(messageOf(e));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function answer() {
    if (!question || !draft) return;
    await work(async () => {
      const next = await api.request(
        `/assessments/${session.id}/answer`,
        assessmentSession,
        "POST",
        {
          expectedRevision: session.revision,
          questionId: question.id,
          steps:
            session.subject === "algebra"
              ? draft.steps.filter((step) => step.trim())
              : [],
          ...(session.subject === "physics"
            ? { value: draft.value, unit: draft.unit }
            : {}),
        },
      );
      if (!active.current) return;
      adopt(next);
      setDiagnosisEpoch((current) => current + 1);
      setHint(null);
      setNotice(
        "حُفظت الإجابة والتحقق على النسخة الحالية. يمكنك تعديلها وإعادة التحقق.",
      );
    });
  }
  async function support(full = false) {
    if (!question) return;
    await work(async () => {
      const result = await api
        .request(
          `/assessments/${session.id}/support`,
          (value) => {
            const r = record(value),
              h = record(r.hint);
            return {
              session: assessmentSession(r.session),
              hint: {
                level: enumField(h.level, ["H1", "H2", "H3", "H4"]),
                textAr: textField(h.textAr),
                source: textField(h.source),
                solutionStepsAr: arrayField(h.solutionStepsAr, textField),
              },
            };
          },
          "POST",
          {
            expectedRevision: session.revision,
            questionId: question.id,
            action: full ? "show_full_solution" : "request_hint",
            ...(full ? { confirmAssistedCompletion: true } : {}),
          },
        )
        .catch(async (failure: unknown) => {
          // The server may have recorded the independent-mode exit before a
          // tutoring/network failure. Reload that fact without discarding raw.
          try {
            const current = await api.request(
              `/assessments/${session.id}`,
              assessmentSession,
            );
            if (active.current) {
              adopt(current);
              setConfirmHelp(false);
              setConfirmSolution(false);
            }
          } catch {
            /* The explicit refresh action remains available offline. */
          }
          throw failure;
        });
      if (!active.current) return;
      adopt(result.session);
      setHint(result.hint);
      setConfirmHelp(false);
      setConfirmSolution(false);
      setNotice(
        "سُجلت المساعدة. هذه المحاولة لا تُحسب دليلًا مستقلًا؛ يمكنك قياس فهمك لاحقًا بسؤال مختلف.",
      );
    });
  }
  function navigate(next: number) {
    setIndex(next);
    setHint(null);
    setConfirmHelp(false);
    setConfirmSolution(false);
    setNotice("");
    setError("");
  }
  if (!question || !draft)
    return (
      <section className="product-card">
        <h3>لا توجد أسئلة كافية لهذا التقييم بعد</h3>
        <p>{session.coverage.messageAr}</p>
        <button onClick={() => onSummary(session)}>اعرض حدود التغطية</button>
      </section>
    );
  const dirty =
    JSON.stringify(draft.steps.filter((step) => step.trim())) !==
      JSON.stringify(question.steps) ||
    draft.value !== question.value ||
    draft.unit !== question.unit;
  return (
    <section
      className="product-card assessment-panel"
      aria-label="محاولة التقييم"
      aria-busy={busy}
    >
      <div className="assessment-progress">
        <h3>
          {session.kind === "practice"
            ? "تدريب الدرس"
            : session.kind === "post_remediation"
              ? "قياس الفهم بعد التدريب"
              : "اختبر مستواك"}
        </h3>
        <span>
          السؤال {(index + 1).toLocaleString("ar")} من{" "}
          {session.questions.length.toLocaleString("ar")}
        </span>
        <progress
          value={session.questions.filter((item) => item.completed).length}
          max={session.questions.length}
          aria-label="أسئلة اكتملت"
        />
      </div>
      <p className="assessment-state">
        {question.independent
          ? "قياس مستقل — لا تلميحات أو حلول أثناء القياس. طلب المساعدة ينقل المحاولة إلى التدريب."
          : "تدريب بمساعدة — لا يُحسب نجاح هذه المحاولة دليلًا مستقلًا."}
      </p>
      {session.coverage.partial && (
        <p className="helper">{session.coverage.messageAr}</p>
      )}
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {busy ? "جارٍ حفظ النسخة والتحقق…" : notice}
      </p>
      <div className="assessment-question">
        <h4>{question.problem.titleAr}</h4>
        <p>{question.problem.statementAr}</p>
        {question.problem.equationRaw && (
          <bdi className="math-text lesson-equation" dir="ltr">
            {question.problem.equationRaw}
          </bdi>
        )}
        {question.problem.physics && (
          <dl className="lesson-givens">
            {Object.entries(question.problem.physics.givens).map(
              ([key, value]) => (
                <div key={key}>
                  <dt>
                    <bdi dir="ltr">{key}</bdi>
                  </dt>
                  <dd>
                    <bdi dir="ltr">{value}</bdi>
                  </dd>
                </div>
              ),
            )}
          </dl>
        )}
      </div>
      <fieldset disabled={busy} className="path-editor">
        <legend>محاولتك المحفوظة على هذا السؤال</legend>
        {session.subject === "algebra" ? (
          <>
            {draft.steps.map((step, stepIndex) => (
              <div key={stepIndex}>
                <MathInput
                  id={`assessment-${question.id}-${stepIndex}`}
                  value={step}
                  onChange={(raw) =>
                    change({
                      ...draft,
                      steps: draft.steps.map((value, i) =>
                        i === stepIndex ? raw : value,
                      ),
                    })
                  }
                />
                {draft.steps.length > 1 && (
                  <button
                    onClick={() =>
                      change({
                        ...draft,
                        steps: draft.steps.filter((_, i) => i !== stepIndex),
                      })
                    }
                  >
                    أزل الخطوة {(stepIndex + 1).toLocaleString("ar")}
                  </button>
                )}
              </div>
            ))}
            <button
              disabled={draft.steps.length >= 20}
              onClick={() => change({ ...draft, steps: [...draft.steps, ""] })}
            >
              أضف خطوة
            </button>
          </>
        ) : (
          <div className="product-grid">
            <label>
              القيمة
              <input
                dir="ltr"
                inputMode="decimal"
                value={draft.value}
                onChange={(event) =>
                  change({ ...draft, value: event.target.value })
                }
              />
            </label>
            <label>
              الوحدة
              <select
                dir="ltr"
                value={draft.unit}
                onChange={(event) =>
                  change({ ...draft, unit: event.target.value })
                }
              >
                <option value="">اختر الوحدة</option>
                {question.problem.physics?.allowedUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>
      {question.status && !dirty && (
        <p className="assessment-state" role="status">
          {verdictLabels[question.status] ??
            "استُقبلت نتيجة التحقق؛ راجع ملخص الأدلة."}
          {question.status === "verified_valid" && !question.completed
            ? " — أكمل عزل س للتحقق من الحل النهائي."
            : ""}{" "}
          <span className="helper">
            مصدر الحكم:{" "}
            {session.subject === "algebra"
              ? "محرك الرياضيات"
              : "متحقق القيمة والوحدة"}
            .
          </span>
        </p>
      )}
      {question.attemptId &&
        !dirty &&
        ["verified_invalid", "wrong_unit", "wrong_value"].includes(
          question.status ?? "",
        ) && (
          <DeepDiagnosisPanel
            key={`${question.id}:${diagnosisEpoch}`}
            api={api}
            attemptId={question.attemptId}
            measurementIndependent={question.independent}
            onProbeOpened={async () => {
              const next = await api.request(
                `/assessments/${session.id}`,
                assessmentSession,
              );
              if (active.current) adopt(next);
            }}
          />
        )}
      <div className="actions">
        <button
          className="primary"
          disabled={
            busy ||
            (session.subject === "algebra"
              ? !draft.steps.some((step) => step.trim())
              : !draft.value || !draft.unit)
          }
          onClick={() => void answer()}
        >
          احفظ وتحقق
        </button>
        <button
          disabled={
            busy || dirty || !question.status || session.subject !== "algebra"
          }
          onClick={() =>
            question.independent ? setConfirmHelp(true) : void support()
          }
        >
          أحتاج تلميحًا
        </button>
        {!question.independent && question.supportLevel >= 3 && (
          <button
            disabled={busy || dirty || !question.status}
            onClick={() => setConfirmSolution(true)}
          >
            اطلب عرض الحل مع تسجيل المساعدة
          </button>
        )}
      </div>
      {session.subject === "physics" && (
        <p className="helper">
          التلميحات والعلاج الموجّه للفيزياء متاحان من مساحة الفيزياء بعد حفظ
          محاولة؛ لا تُرسل هذه الإجابات إلى محرك الجبر.
        </p>
      )}
      {!question.status && (
        <p className="helper">
          احفظ محاولة أولًا. لن يُعرض تلميح قبل وجود نتيجة تحقق يمكن الاستناد
          إليها.
        </p>
      )}
      {confirmHelp && (
        <div className="lesson-callout">
          <p>
            بالمتابعة تغادر هذه المحاولة القياس المستقل قبل عرض أي تلميح. سيبقى
            بإمكانك التدرب ثم تجربة سؤال مختلف دون مساعدة.
          </p>
          <button disabled={busy} onClick={() => void support()}>
            انتقل إلى التدريب واعرض التلميح
          </button>
          <button onClick={() => setConfirmHelp(false)}>أكمل دون مساعدة</button>
        </div>
      )}
      {confirmSolution && (
        <div className="lesson-callout">
          <p>سيُسجل الحل الكامل H4 كمساعدة؛ لن يصنّف هذا الحل مستقلًا.</p>
          <button disabled={busy} onClick={() => void support(true)}>
            أوافق، اعرض الحل للتعلم
          </button>
          <button onClick={() => setConfirmSolution(false)}>
            أعود للمحاولة
          </button>
        </div>
      )}
      {hint && (
        <aside className="lesson-callout" role="status">
          <h4>مساعدة {hint.level}</h4>
          <p>{hint.textAr}</p>
          {hint.solutionStepsAr.length > 0 && (
            <ol>
              {hint.solutionStepsAr.map((step, i) => (
                <li key={i}>
                  <bdi dir="ltr" className="math-text">
                    {step}
                  </bdi>
                </li>
              ))}
            </ol>
          )}
          <p className="helper">
            هذه مساعدة تعليمية؛ نتيجة التحقق مستقلة عنها.
          </p>
        </aside>
      )}
      <div className="actions">
        <button
          disabled={busy || index === 0}
          onClick={() => navigate(index - 1)}
        >
          السؤال السابق
        </button>
        <button
          disabled={busy || index === session.questions.length - 1}
          onClick={() => navigate(index + 1)}
        >
          السؤال التالي
        </button>
        <button disabled={busy} onClick={() => onSummary(session)}>
          اعرض الأدلة والدرس المقترح
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void work(async () => {
              const next = await api.request(
                `/assessments/${session.id}`,
                assessmentSession,
              );
              if (active.current) {
                adopt(next);
                setNotice(
                  "حُمّلت مراجعة الخادم الحالية؛ بقيت مسودتك المحلية حتى تحفظها وتعيد التحقق.",
                );
              }
            })
          }
        >
          حدّث نسخة الجلسة مع إبقاء مسودتي
        </button>
      </div>
      <p className="helper">
        {dirty
          ? "المسودة المعدلة محفوظة مؤقتًا في علامة التبويب؛ لا تُعد إجابة متحققة حتى تضغط احفظ وتحقق."
          : "تحتفظ الجلسة بنسخة الأسئلة وبالإجابات التي حُفظت عبر الخادم."}
      </p>
    </section>
  );
}
