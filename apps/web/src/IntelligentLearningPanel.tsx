import { useEffect, useRef, useState } from "react";
import type { AssessmentSession } from "../../../packages/contracts/src/learning-assessments";
import type { LearningContentRevision } from "../../../packages/contracts/src/learning-paths";
import type {
  ActivityKind,
  DeepDiagnosis,
  AGoal,
  AReflection,
  AReview,
  AScaffoldSession,
  ATutorSession,
  KnowledgeGraph,
  LearningActivity,
  MasteryResponse,
  NextActivityDecision,
} from "../../../packages/contracts/src/intelligent-learning";
import { ProductApi, messageOf, record } from "./product-api";
import type { Schema } from "./api-client";
import { assessmentSession } from "./learning-path-api";
import {
  activityData,
  diagnosisData,
  featureUnavailable,
  goalData,
  loadIntelligentFeatures,
  readIntelligentResume,
  probeData,
  probeEvaluationData,
  reflectionData,
  reflectionsData,
  reviewData,
  reviewListData,
  scaffoldData,
  tutorData,
  updateLearningGoal,
  writeIntelligentResume,
  type IntelligentResume,
} from "./intelligent-learning-api";

const activityLabels: Record<ActivityKind | "no_safe_activity", string> = {
  explanation: "شرح قصير",
  worked_example: "مثال مشروح",
  diagnostic_probe: "سؤال قصير لتحديد المساعدة",
  guided_practice: "تدريب موجه",
  prerequisite_repair: "مراجعة مهارة سابقة",
  independent_check: "مسألة جديدة دون مساعدة",
  retrieval_review: "مراجعة استرجاعية",
  challenge: "تطبيق جديد",
  reflection: "تأمل في طريقة الحل",
  no_safe_activity: "لا يتوفر نشاط مناسب الآن",
};
const independentLabels = {
  none: "لم يتوفر دليل مستقل بعد",
  limited_evidence: "دليل مستقل محدود",
  consistent_evidence: "أدلة مستقلة متوافقة",
  needs_review: "قد تفيد مراجعة جديدة",
};
const retentionLabels = {
  not_due: "لم يحن وقت قياس الاحتفاظ",
  due: "مراجعة مستحقة",
  observed_retained: "ظهر دليل احتفاظ في المراجعة",
  review_needed: "قد تفيد مراجعة قصيرة",
  insufficient_data: "لا تكفي بيانات الاحتفاظ",
};
const scaffoldLabels = {
  S0: "مثال مشروح",
  S1: "أكمل خطوة",
  S2: "تدريب موجه",
  S3: "جرّب بدعم أقل",
  S4: "فحص جديد دون مساعدة",
};
const reviewLabels = {
  scheduled: "مجدولة",
  deferred: "مؤجلة باختيارك",
  started: "بدأت المراجعة",
  completed: "اكتملت المراجعة",
  coverage_limited: "لا تتوفر أسئلة جديدة كافية",
};
function savedResume(trackId: string): IntelligentResume {
  try {
    return readIntelligentResume(sessionStorage, trackId);
  } catch {
    return {};
  }
}

export function DeepDiagnosisPanel({
  api,
  attemptId,
  measurementIndependent = false,
  onProbeOpened,
}: {
  api: ProductApi;
  attemptId: string;
  measurementIndependent?: boolean;
  onProbeOpened?: () => Promise<void>;
}) {
  const alive = useRef(true);
  const [diagnosis, setDiagnosis] = useState<DeepDiagnosis | null>(null),
    [probe, setProbe] = useState<Schema<"Probe"> | null>(null),
    [option, setOption] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmProbe, setConfirmProbe] = useState(false);
  useEffect(() => {
    alive.current = true;
    void api
      .request(
        `/learning/deep-diagnosis?attemptId=${encodeURIComponent(attemptId)}`,
        diagnosisData,
      )
      .then((value) => {
        if (alive.current) setDiagnosis(value);
      })
      .catch((failure) => {
        if (alive.current && !featureUnavailable(failure))
          setError(messageOf(failure));
      });
    return () => {
      alive.current = false;
    };
  }, [api, attemptId]);
  async function work(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      if (alive.current) setError(messageOf(failure));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function openProbe() {
    if (!diagnosis) return;
    const value = await api.request(
      "/learning/deep-diagnosis/probe",
      probeData,
      "POST",
      {
        attemptId,
        expectedRevision: diagnosis.attemptRevision,
      },
    );
    if (
      !alive.current ||
      value.attemptId !== attemptId ||
      value.attemptRevision !== diagnosis.attemptRevision
    )
      return;
    setProbe(value);
    setConfirmProbe(false);
    await onProbeOpened?.();
  }
  if (!diagnosis && !error) return null;
  return (
    <aside
      className="lesson-callout"
      aria-label="فرضية تحتاج تحققًا"
      aria-busy={busy}
    >
      <h4>ما المساعدة الأنسب لهذه المحاولة؟</h4>
      {diagnosis && (
        <>
          <p>
            {diagnosis.state === "technical_abstain"
              ? "التحقق الفني غير متاح حاليًا؛ لا يعني ذلك أن إجابتك خاطئة."
              : "قد يكون وراء هذه النتيجة أكثر من تفسير؛ لا تثبت محاولة واحدة ضعفًا دائمًا في المهارة."}
          </p>
          {!!diagnosis.candidateCauses.length && (
            <p>
              تفسيرات محتملة تحتاج دليلًا إضافيًا:{" "}
              {diagnosis.candidateCauses.length.toLocaleString("ar")}.
            </p>
          )}
          {diagnosis.nextIntervention === "no_safe_probe" ? (
            <p>
              لا يتوفر سؤال تمييز مراجع لهذه الحالة حاليًا. يمكنك متابعة شرح
              منشور أو إعادة المحاولة.
            </p>
          ) : (
            !probe && (
              <button
                disabled={busy}
                onClick={() =>
                  measurementIndependent
                    ? setConfirmProbe(true)
                    : void work(openProbe)
                }
              >
                جرّب سؤالًا قصيرًا لتحديد المساعدة
              </button>
            )
          )}
          {confirmProbe && (
            <div className="lesson-callout">
              <p>
                هذا السؤال مساعدة تعليمية. بالمتابعة تخرج هذه المحاولة من القياس
                المستقل قبل عرض السؤال، مع بقاء محاولتك محفوظة.
              </p>
              <button disabled={busy} onClick={() => void work(openProbe)}>
                انتقل إلى التدريب واعرض السؤال
              </button>
              <button onClick={() => setConfirmProbe(false)}>
                أكمل دون مساعدة
              </button>
            </div>
          )}
          {probe && !feedback && (
            <fieldset disabled={busy}>
              <legend>{probe.questionAr}</legend>
              {probe.options.map((choice) => (
                <label className="probe-option" key={choice.id}>
                  <input
                    type="radio"
                    name={probe.id}
                    checked={option === choice.id}
                    onChange={() => setOption(choice.id)}
                  />
                  <bdi dir="auto">{choice.labelAr}</bdi>
                </label>
              ))}
              <button
                disabled={busy || !option}
                onClick={() =>
                  void work(async () => {
                    const value = await api.request(
                      `/attempts/${attemptId}/probes/${probe.id}/responses`,
                      probeEvaluationData,
                      "POST",
                      {
                        expectedRevision: diagnosis.attemptRevision,
                        answer: { kind: "choice", optionId: option },
                      },
                    );
                    if (
                      alive.current &&
                      value.attemptId === attemptId &&
                      value.probeId === probe.id
                    )
                      setFeedback(value.feedbackAr);
                  })
                }
              >
                احفظ إجابتي
              </button>
            </fieldset>
          )}
          {feedback && <p role="status">{feedback}</p>}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}

export function MasteryDimensions({ value }: { value: MasteryResponse }) {
  return (
    <section
      className="intelligent-dimensions"
      aria-label="أبعاد أدلة المهارات"
    >
      <h3>كيف نعرف تقدمك؟</h3>
      <p className="helper">
        هذه أوصاف للأدلة المتاحة وقد تتغير. لا تكفي مشاهدة الدرس للحكم على
        الفهم، ولا تعني المراجعة المستحقة أنك نسيت.
      </p>
      <div className="product-grid">
        {value.skills.map((skill) => (
          <article className="lesson-callout" key={skill.skillCode}>
            <h4>{skill.titleAr}</h4>
            <dl>
              <div>
                <dt>الدراسة</dt>
                <dd>
                  {skill.dimensions.exposure === "seen"
                    ? "اطلعت على محتوى مرتبط"
                    : "لم تسجل مشاهدة بعد"}
                </dd>
              </div>
              <div>
                <dt>التدريب بمساعدة</dt>
                <dd>
                  {skill.dimensions.supportedPractice === "observed"
                    ? "ظهر نجاح مدعوم"
                    : "لم يسجل بعد"}
                </dd>
              </div>
              <div>
                <dt>الأداء المستقل</dt>
                <dd>
                  {independentLabels[skill.dimensions.independentPerformance]}
                </dd>
              </div>
              <div>
                <dt>النقل</dt>
                <dd>
                  {skill.dimensions.transfer === "evidence"
                    ? "ظهر دليل في مسألة نقل"
                    : skill.dimensions.transfer === "needs_review"
                      ? "قد تفيد مراجعة النقل"
                      : "لم يُختبر بعد"}
                </dd>
              </div>
              <div>
                <dt>الاحتفاظ</dt>
                <dd>{retentionLabels[skill.dimensions.retention]}</dd>
              </div>
            </dl>
            <details>
              <summary>كيف عرفنا؟</summary>
              <p>
                أدلة مستقلة مؤهلة:{" "}
                {skill.counts.eligibleIndependent.toLocaleString("ar")} ·
                محاولات بمساعدة: {skill.counts.assisted.toLocaleString("ar")}.
              </p>
              <p>
                {skill.dimensions.evidenceQuality === "eligible"
                  ? "تتوفر أدلة مؤهلة ضمن شروط هذا القياس."
                  : "لا تكفي الأدلة للحكم على هذه المهارة بعد."}
              </p>
              <p className="helper">
                مصدر الوصف: محاولاتك المتحققة الحالية. عدد مراجع الأدلة:{" "}
                {skill.evidenceIds.length.toLocaleString("ar")}.
              </p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

export function KnowledgeGraphView({
  value,
  onOpenLesson,
}: {
  value: KnowledgeGraph;
  onOpenLesson: (id: string) => void;
}) {
  const title = (code: string) =>
    value.nodes.find((node) => node.skillCode === code)?.titleAr ??
    "مهارة مرتبطة";
  return (
    <details className="intelligent-graph">
      <summary>المهارات السابقة وروابط الدروس</summary>
      <ul>
        {value.nodes.map((node) => (
          <li key={node.skillCode}>
            <strong>{node.titleAr}</strong>
            {node.reviewState === "mapping_pending"
              ? " — العلاقة قيد المراجعة"
              : node.reviewState === "missing_coverage"
                ? " — لا يوجد درس أساسي منشور مرتبط"
                : ""}
            {node.lessonRevisionId && node.reviewState === "reviewed" && (
              <button onClick={() => onOpenLesson(node.lessonRevisionId!)}>
                راجع الدرس
              </button>
            )}
          </li>
        ))}
      </ul>
      <ul>
        {value.edges.map((edge, index) => (
          <li key={index}>
            {title(edge.fromSkill)} ← {title(edge.toSkill)} ·{" "}
            {edge.relationKind === "required"
              ? "متطلب لازم"
              : edge.relationKind === "helpful"
                ? "مهارة مساعدة"
                : "رابط مساعد بين المواد"}
            . {edge.rationaleAr}
            {edge.reviewState === "pending"
              ? " — بانتظار المراجعة؛ لا يُفرض على مسارك."
              : ""}
          </li>
        ))}
      </ul>
      {!!value.issues.length && (
        <p className="helper">
          بعض الروابط أو تغطية المحتوى تحتاج مراجعة؛ لن نقترح رابطًا إلى مسودة.
        </p>
      )}
    </details>
  );
}

/** All decisions and evidence come from NestJS; browser storage holds resumable IDs only. */
export function IntelligentLearningPanel({
  api,
  trackRevisionId,
  lessons,
  selectedLessonId,
  assessment,
  onAssessment,
  onOpenLesson,
  onOpenLab,
  onOpenAdvanced,
  nativeSupport,
}: {
  api: ProductApi;
  trackRevisionId: string;
  lessons: LearningContentRevision[];
  selectedLessonId?: string | null;
  assessment: AssessmentSession | null;
  onAssessment: (value: AssessmentSession) => void;
  onOpenLesson: (id: string) => void;
  onOpenLab?: (lessonId: string, blockIndex: number) => void;
  onOpenAdvanced?: (lessonId: string, blockIndex: number) => void;
  nativeSupport?: {
    kind: "scaffold" | "tutor" | "reflection";
    id: string;
  } | null;
}) {
  const alive = useRef(true),
    loadEpoch = useRef(0),
    resume = useRef(savedResume(trackRevisionId)),
    goalInput = useRef<HTMLInputElement>(null),
    supportHeading = useRef<HTMLHeadingElement>(null);
  const [decision, setDecision] = useState<NextActivityDecision | null>(null),
    [activity, setActivity] = useState<LearningActivity | null>(null),
    [mastery, setMastery] = useState<MasteryResponse | null>(null),
    [graph, setGraph] = useState<KnowledgeGraph | null>(null),
    [reviews, setReviews] = useState<AReview[] | null>(null),
    [goals, setGoals] = useState<AGoal[] | null>(null),
    [scaffold, setScaffold] = useState<AScaffoldSession | null>(null),
    [tutor, setTutor] = useState<ATutorSession | null>(null),
    [reflection, setReflection] = useState<AReflection | null>(null),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [lessonChoice, setLessonChoice] = useState(""),
    [goalText, setGoalText] = useState(""),
    [goalTarget, setGoalTarget] = useState(2),
    [editingGoal, setEditingGoal] = useState<AGoal | null>(null),
    [phase, setPhase] = useState<"predict" | "monitor" | "reflect">("predict"),
    [confidence, setConfidence] = useState(""),
    [reflectionText, setReflectionText] = useState(""),
    [reply, setReply] = useState(""),
    [confirmTutor, setConfirmTutor] = useState(false),
    [confirmSolution, setConfirmSolution] = useState(false),
    [confirmScaffoldSupport, setConfirmScaffoldSupport] = useState(false),
    [reflectionOpen, setReflectionOpen] = useState(false);
  const chosenLessonId =
    lessonChoice ||
    selectedLessonId ||
    activity?.lessonRevisionId ||
    lessons[0]?.id ||
    "";
  const chosenLesson = lessons.find((lesson) => lesson.id === chosenLessonId),
    chosenSkill =
      chosenLesson?.payload.kind === "lesson"
        ? chosenLesson.payload.skillCodes[0]
        : undefined;
  function remember(next: IntelligentResume) {
    resume.current = { ...resume.current, ...next };
    try {
      writeIntelligentResume(sessionStorage, trackRevisionId, resume.current);
    } catch {
      /* Server remains the source. */
    }
  }
  async function refresh() {
    const version = ++loadEpoch.current;
    const result = await loadIntelligentFeatures(api, trackRevisionId);
    if (!alive.current || version !== loadEpoch.current) return;
    setDecision(result.decision);
    setMastery(result.mastery);
    setGraph(result.graph);
    setReviews(result.reviews?.reviews ?? null);
    setGoals(result.goals?.goals ?? null);
    if (result.reflections?.reflections.length)
      setReflection(result.reflections.reflections.at(-1) ?? null);
    if (result.errors.length) setError(result.errors[0]!);
    setLoaded(true);
  }
  useEffect(() => {
    alive.current = true;
    void refresh();
    const saved = resume.current;
    if (saved.activityId)
      void api
        .request(`/learning/activities/${saved.activityId}`, activityData)
        .then((value) => {
          if (alive.current) setActivity(value);
        })
        .catch(() => {});
    if (saved.scaffoldId)
      void api
        .request(`/learning/scaffolds/${saved.scaffoldId}`, scaffoldData)
        .then((value) => {
          if (alive.current) setScaffold(value);
        })
        .catch(() => {});
    if (saved.tutorId)
      void api
        .request(`/learning/tutor-sessions/${saved.tutorId}`, tutorData)
        .then((value) => {
          if (alive.current) setTutor(value);
        })
        .catch(() => {});
    return () => {
      alive.current = false;
      loadEpoch.current++;
    };
  }, [api, trackRevisionId]);
  useEffect(() => {
    if (!nativeSupport) return;
    let active = true;
    setError("");
    void (async () => {
      if (nativeSupport.kind === "scaffold") {
        const next = await api.request(
          `/learning/scaffolds/${encodeURIComponent(nativeSupport.id)}`,
          scaffoldData,
        );
        if (active && next.trackRevisionId === trackRevisionId) {
          setScaffold(next);
          remember({ scaffoldId: next.id });
        }
      } else if (nativeSupport.kind === "tutor") {
        const next = await api.request(
          `/learning/tutor-sessions/${encodeURIComponent(nativeSupport.id)}`,
          tutorData,
        );
        if (active && next.trackRevisionId === trackRevisionId) {
          setTutor(next);
          remember({ tutorId: next.id });
        }
      } else {
        const next = await api.request(
          `/learning/reflections?trackRevisionId=${encodeURIComponent(trackRevisionId)}`,
          reflectionsData,
        );
        const selected = next.reflections.find(
          (item) => item.id === nativeSupport.id,
        );
        if (!selected) throw new Error("invalid_response");
        if (active) {
          setReflection(selected);
          setReflectionOpen(true);
          setGoals((previous) => previous ?? []);
          setPhase("reflect");
        }
      }
      if (active) {
        setLoaded(true);
        setNotice(
          "هذه مساحة الدعم المرتبطة بالمشكلة. تبقى المساعدة مسجلة ولا تمنح إتقانًا مستقلاً.",
        );
        requestAnimationFrame(() => supportHeading.current?.focus());
      }
    })().catch((error) => {
      if (active) {
        setError(messageOf(error));
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [api, trackRevisionId, nativeSupport]);
  const assessmentKey = assessment
    ? `${assessment.id}:${assessment.revision}`
    : "";
  const assessmentVersion = useRef(assessmentKey);
  useEffect(() => {
    if (assessmentVersion.current === assessmentKey) return;
    assessmentVersion.current = assessmentKey;
    // Do not leave a decision or projection based on an older saved answer visible.
    setDecision(null);
    setMastery(null);
    void refresh();
  }, [assessmentKey]);
  async function work(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      if (alive.current) setError(messageOf(failure));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function accept(alternativeIndex?: number) {
    if (!decision) return;
    const next = await api.request(
      "/learning/activities/accept",
      activityData,
      "POST",
      {
        decisionId: decision.decisionId,
        expectedRevision: decision.revision,
        ...(alternativeIndex === undefined ? {} : { alternativeIndex }),
      },
    );
    if (!alive.current) return;
    setActivity(next);
    remember({ activityId: next.id });
    setNotice("حُفظ النشاط على الخادم؛ يمكنك استئنافه لاحقًا.");
  }
  async function startActivity() {
    if (!activity) return;
    if (activity.advancedActivity && activity.lessonRevisionId) {
      if (onOpenAdvanced)
        onOpenAdvanced(
          activity.lessonRevisionId,
          activity.advancedActivity.blockIndex,
        );
      else onOpenLesson(activity.lessonRevisionId);
      return;
    }
    if (
      activity.labKind &&
      activity.labBlockIndex !== undefined &&
      activity.lessonRevisionId
    ) {
      if (onOpenLab)
        onOpenLab(activity.lessonRevisionId, activity.labBlockIndex);
      else onOpenLesson(activity.lessonRevisionId);
      return;
    }
    if (activity.activityKind === "diagnostic_probe") return;
    if (
      ["explanation", "worked_example", "prerequisite_repair"].includes(
        activity.activityKind,
      ) &&
      activity.lessonRevisionId
    ) {
      onOpenLesson(activity.lessonRevisionId);
      return;
    }
    if (activity.activityKind === "reflection") {
      setPhase("reflect");
      setReflectionOpen(true);
      return;
    }
    const result = await api.request(
      `/learning/activities/${activity.id}/start-assessment`,
      (value) => {
        const r = record(value);
        return {
          activity: activityData(r.activity),
          assessment: assessmentSession(r.assessment),
        };
      },
      "POST",
      { expectedRevision: activity.revision },
    );
    if (!alive.current) return;
    setActivity(result.activity);
    onAssessment(result.assessment);
  }
  async function startScaffold() {
    if (!chosenSkill || !chosenLessonId) return;
    const result = await api.request(
      "/learning/scaffolds",
      scaffoldData,
      "POST",
      {
        trackRevisionId,
        lessonRevisionId: chosenLessonId,
        skillCode: chosenSkill,
      },
    );
    if (alive.current) {
      setScaffold(result);
      remember({ scaffoldId: result.id });
    }
  }
  async function advanceScaffold(skipExample = false) {
    if (!scaffold) return;
    const result = await api.request(
      `/learning/scaffolds/${scaffold.id}/advance`,
      (value) => {
        const r = record(value);
        return {
          scaffold: scaffoldData(r.scaffold),
          assessment:
            r.assessment === null ? null : assessmentSession(r.assessment),
        };
      },
      "POST",
      {
        expectedRevision: scaffold.revision,
        ...(scaffold.assessmentId
          ? { assessmentId: scaffold.assessmentId }
          : {}),
        ...(skipExample ? { skipExample: true } : {}),
      },
    );
    if (alive.current) {
      setScaffold(result.scaffold);
      if (result.assessment) onAssessment(result.assessment);
    }
  }
  async function revealScaffold() {
    if (!scaffold) return;
    const next = await api.request(
      `/learning/scaffolds/${scaffold.id}/reveal`,
      scaffoldData,
      "POST",
      { expectedRevision: scaffold.revision },
    );
    if (!alive.current) return;
    setScaffold(next);
    setConfirmScaffoldSupport(false);
    if (scaffold.assessmentId) {
      const session = await api.request(
        `/assessments/${scaffold.assessmentId}`,
        assessmentSession,
      );
      if (alive.current) onAssessment(session);
    }
  }
  async function startTutor(exitMeasurement = false) {
    if (!chosenSkill || !chosenLessonId) return;
    const question =
      assessment?.questions.find((item) => !item.completed) ??
      assessment?.questions[0];
    const result = await api.request(
      "/learning/tutor-sessions",
      tutorData,
      "POST",
      {
        trackRevisionId,
        lessonRevisionId: chosenLessonId,
        skillCode: chosenSkill,
        ...(assessment && question
          ? {
              assessmentId: assessment.id,
              questionId: question.id,
              expectedAssessmentRevision: assessment.revision,
              exitMeasurement,
            }
          : {}),
      },
    );
    if (!alive.current) return;
    setTutor(result);
    remember({ tutorId: result.id });
    setConfirmTutor(false);
    if (assessment) {
      const next = await api.request(
        `/assessments/${assessment.id}`,
        assessmentSession,
      );
      if (alive.current) onAssessment(next);
    }
  }
  async function tutorAction(
    action:
      | "reply"
      | "next_hint"
      | "try_independent"
      | "stop"
      | "show_solution",
  ) {
    if (!tutor) return;
    const next = await api.request(
      `/learning/tutor-sessions/${tutor.id}/reply`,
      tutorData,
      "POST",
      {
        expectedRevision: tutor.revision,
        textAr: action === "reply" ? reply : "",
        action,
        ...(action === "show_solution" ? { confirmFullSolution: true } : {}),
      },
    );
    if (alive.current) {
      setTutor(next);
      setReply("");
      setConfirmSolution(false);
    }
  }
  if (
    !loaded ||
    (!decision &&
      !mastery &&
      !graph &&
      reviews === null &&
      goals === null &&
      !activity &&
      !scaffold &&
      !tutor &&
      !error)
  )
    return null;
  return (
    <section
      className="product-card intelligent-learning"
      aria-label="خطوتك التعليمية التالية"
      aria-busy={busy}
    >
      <header>
        <h3 ref={supportHeading} tabIndex={-1}>
          خطوتك التعليمية التالية
        </h3>
        <p>
          هذه توصية مبنية على محاولاتك المتاحة وقد تتغير. يمكنك اختيار مساعدة
          مناسبة أو متابعة دروسك.
        </p>
      </header>
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {busy ? "جارٍ حفظ النشاط أو قراءة حالته…" : notice}
      </p>
      <button disabled={busy} onClick={() => void work(refresh)}>
        حدّث النشاط والأدلة
      </button>
      {decision && (
        <section className="lesson-callout">
          <h4>{activityLabels[decision.activityKind]}</h4>
          <p>{decision.reasonAr}</p>
          {decision.activityKind !== "no_safe_activity" && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void work(() => accept())}
            >
              اختر هذا النشاط
            </button>
          )}
          {!!decision.alternatives.length && (
            <details>
              <summary>خيارات أخرى متاحة</summary>
              <div className="actions">
                {decision.alternatives.map((alternative, index) => (
                  <button
                    key={index}
                    disabled={busy}
                    onClick={() => void work(() => accept(index))}
                  >
                    {activityLabels[alternative.activityKind]}
                  </button>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
      {activity && (
        <section className="lesson-callout">
          <h4>نشاطك المحفوظ: {activityLabels[activity.activityKind]}</h4>
          <p>
            {activity.assistanceLevel > 0
              ? "سُجلت مساعدة في هذا النشاط؛ لا يُعد أداءً مستقلًا."
              : "يفحص الخادم أهلية القياس عند البدء؛ لا تكفي تسمية النشاط وحدها."}
          </p>
          {activity.activityKind !== "diagnostic_probe" && (
            <button disabled={busy} onClick={() => void work(startActivity)}>
              {activity.assessmentId ? "استأنف النشاط" : "ابدأ النشاط المحفوظ"}
            </button>
          )}
          {activity.activityKind === "diagnostic_probe" &&
            activity.sourceAttemptId && (
              <DeepDiagnosisPanel
                key={activity.sourceAttemptId}
                api={api}
                attemptId={activity.sourceAttemptId}
                measurementIndependent={assessment?.questions.some(
                  (question) =>
                    question.attemptId === activity.sourceAttemptId &&
                    question.independent,
                )}
                onProbeOpened={async () => {
                  if (!assessment) return;
                  const next = await api.request(
                    `/assessments/${assessment.id}`,
                    assessmentSession,
                  );
                  if (alive.current) onAssessment(next);
                }}
              />
            )}
        </section>
      )}
      {mastery && <MasteryDimensions value={mastery} />}
      {graph && (
        <KnowledgeGraphView value={graph} onOpenLesson={onOpenLesson} />
      )}
      {reviews !== null && (
        <details className="intelligent-reviews">
          <summary>مراجعاتي المستحقة</summary>
          <p>
            يمكنك المراجعة الآن، أو تأجيلها. نقص الأسئلة الجديدة أو تأجيل
            المراجعة لا يعني إخفاقًا.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void work(async () => {
                await api.request(
                  "/learning/reviews/schedule",
                  reviewListData,
                  "POST",
                  { trackRevisionId },
                );
                await refresh();
                setNotice(
                  "حُدّثت المواعيد من الأدلة المستقلة المتاحة؛ يعرض هذا القسم المستحق فقط.",
                );
              })
            }
          >
            جهّز مواعيد المراجعة وحدّث المستحق
          </button>
          {!reviews.length && <p>لا توجد مراجعة مستحقة متاحة حاليًا.</p>}
          <ul>
            {reviews.map((review) => (
              <li key={review.id} className="lesson-callout">
                <p>
                  {mastery?.skills.find(
                    (skill) => skill.skillCode === review.skillCode,
                  )?.titleAr ?? "مراجعة مهارة"}{" "}
                  · {reviewLabels[review.status]}
                </p>
                <p>
                  موعد المراجعة: {new Date(review.dueAt).toLocaleString("ar")}
                </p>
                <div className="actions">
                  <button
                    disabled={busy || review.status === "completed"}
                    onClick={() =>
                      void work(async () => {
                        const result = await api.request(
                          `/learning/reviews/${review.id}/start`,
                          (value) => {
                            const r = record(value);
                            return {
                              review: reviewData(r.review),
                              assessment: assessmentSession(r.assessment),
                            };
                          },
                          "POST",
                          { expectedRevision: review.revision },
                        );
                        if (alive.current) {
                          setReviews(
                            (current) =>
                              current?.map((item) =>
                                item.id === result.review.id
                                  ? result.review
                                  : item,
                              ) ?? [],
                          );
                          onAssessment(result.assessment);
                        }
                      })
                    }
                  >
                    ابدأ المراجعة دون شرح مسبق
                  </button>
                  {review.status === "started" && review.assessmentId && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void work(async () => {
                          const result = await api.request(
                            `/learning/reviews/${review.id}/finish`,
                            reviewData,
                            "POST",
                            { expectedRevision: review.revision },
                          );
                          if (!alive.current) return;
                          setReviews(
                            (current) =>
                              current?.map((item) =>
                                item.id === result.id ? result : item,
                              ) ?? [],
                          );
                          setNotice(
                            result.retentionOutcome === "independent"
                              ? "حُفظ دليل احتفاظ مستقل من نتيجة المراجعة المتحققة."
                              : result.retentionOutcome === "assisted"
                                ? "حُفظت المراجعة كتدريب بمساعدة، دون دليل احتفاظ مستقل."
                                : result.retentionOutcome === "needs_review"
                                  ? "قد تفيد مراجعة أخرى؛ بقيت أدلة المحاولات السابقة محفوظة."
                                  : "لا تكفي بيانات المراجعة الحالية لقياس الاحتفاظ.",
                          );
                          await refresh();
                        })
                      }
                    >
                      احفظ نتيجة المراجعة المتحققة
                    </button>
                  )}
                  <button
                    disabled={
                      busy ||
                      review.status === "started" ||
                      review.status === "completed"
                    }
                    onClick={() =>
                      void work(async () => {
                        const next = await api.request(
                          `/learning/reviews/${review.id}/defer`,
                          reviewData,
                          "POST",
                          {
                            expectedRevision: review.revision,
                            reason: "student_choice",
                            days: 1,
                          },
                        );
                        if (alive.current) {
                          setReviews(
                            (current) =>
                              current?.filter((item) => item.id !== next.id) ??
                              [],
                          );
                          setNotice(
                            "أُجّلت المراجعة باختيارك. لم يُسجل نجاح أو إخفاق.",
                          );
                        }
                      })
                    }
                  >
                    أجّل المراجعة يومًا
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!!lessons.length && (
        <section className="intelligent-practice">
          <h4>تدرّب وناقش طريقة الحل</h4>
          <label>
            اختر درس النشاط
            <select
              value={chosenLessonId}
              onChange={(event) => setLessonChoice(event.target.value)}
            >
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.payload.titleAr}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button
              disabled={busy || !chosenSkill}
              onClick={() => void work(startScaffold)}
            >
              ابدأ مثالًا ثم خفّف الدعم
            </button>
            <button
              disabled={busy || !chosenSkill}
              onClick={() =>
                assessment?.questions.some((question) => question.independent)
                  ? setConfirmTutor(true)
                  : void work(() => startTutor())
              }
            >
              ناقشني خطوة بخطوة
            </button>
          </div>
          {confirmTutor && (
            <div className="lesson-callout">
              <p>
                إذا طلبت مساعدة الحوار، ستبقى محاولتك محفوظة لكن لن تُحتسب هذه
                المسألة قياسًا مستقلًا. هل تريد المتابعة؟
              </p>
              <button
                disabled={busy}
                onClick={() => void work(() => startTutor(true))}
              >
                انتقل إلى التدريب وابدأ النقاش
              </button>
              <button onClick={() => setConfirmTutor(false)}>
                أكمل دون مساعدة
              </button>
            </div>
          )}
        </section>
      )}
      {scaffold && (
        <section className="lesson-callout" aria-label="الدعم التدريجي">
          <h4>{scaffoldLabels[scaffold.stage]}</h4>
          <p>{scaffold.messageAr}</p>
          {scaffold.problemRaw && (
            <p>
              <span>معادلة المثال: </span>
              <bdi dir="ltr" className="math-text lesson-equation">
                {scaffold.problemRaw}
              </bdi>
            </p>
          )}
          <p className="helper">
            مرات كشف الدعم: {scaffold.supportCount.toLocaleString("ar")} ·{" "}
            {scaffold.independentEligible
              ? "أهلية الاستقلال تُفحص عند التحقق من السؤال الجديد."
              : "هذا النشاط مدعوم، ولا يُعد قياسًا مستقلًا."}
          </p>
          <ol>
            {scaffold.visibleSteps.map((step, index) => (
              <li key={index}>
                <bdi dir="ltr" className="math-text">
                  {step.raw}
                </bdi>
                <p>{step.explanationAr}</p>
              </li>
            ))}
          </ol>
          {scaffold.status === "active" && (
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  scaffold.independentEligible
                    ? setConfirmScaffoldSupport(true)
                    : void work(revealScaffold)
                }
              >
                اكشف خطوة مع تسجيل المساعدة
              </button>
              <button
                disabled={busy}
                onClick={() => void work(() => advanceScaffold())}
              >
                تابع إلى المرحلة التالية
              </button>
              {scaffold.stage === "S0" && (
                <button
                  disabled={busy}
                  onClick={() => void work(() => advanceScaffold(true))}
                >
                  جرّب سؤالًا مستقلًا جديدًا
                </button>
              )}
            </div>
          )}
          {confirmScaffoldSupport && (
            <div className="lesson-callout">
              <p>
                بالكشف عن خطوة ستخرج هذه المسألة من القياس المستقل قبل ظهور
                الدعم؛ تظل محاولتك محفوظة.
              </p>
              <button disabled={busy} onClick={() => void work(revealScaffold)}>
                انتقل إلى التدريب واكشف الخطوة
              </button>
              <button onClick={() => setConfirmScaffoldSupport(false)}>
                أكمل دون مساعدة
              </button>
            </div>
          )}
        </section>
      )}
      {tutor && (
        <section
          className="lesson-callout intelligent-tutor"
          aria-label="حوار تعليمي بمساعدة"
        >
          <h4>فكّر معي خطوة بخطوة</h4>
          <p>{tutor.messageAr}</p>
          <p className="helper">
            هذا حوار تعليمي بمساعدة، ولا يمنح دليلًا مستقلًا. الأسئلة من قوالب
            محلية؛ صحة الحل يقررها محرك المادة.
          </p>
          <ol>
            {tutor.turns.map((turn, index) => (
              <li className={"tutor-turn " + turn.role} key={index}>
                <strong>
                  {turn.role === "student" ? "أنت" : "سؤال أو مساعدة"}
                </strong>
                <p>{turn.textAr}</p>
              </li>
            ))}
          </ol>
          {tutor.state === "awaiting_student" && (
            <>
              <label>
                كيف تفكر في هذه الخطوة؟
                <textarea
                  value={reply}
                  maxLength={1000}
                  rows={3}
                  onChange={(event) => setReply(event.target.value)}
                />
              </label>
              <div className="actions">
                <button
                  disabled={busy || !reply.trim()}
                  onClick={() => void work(() => tutorAction("reply"))}
                >
                  أرسل تفكيري
                </button>
                <button
                  disabled={busy}
                  onClick={() => void work(() => tutorAction("next_hint"))}
                >
                  تلميح آخر
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void work(() => tutorAction("try_independent"))
                  }
                >
                  أحاول بنفسي
                </button>
                <button
                  disabled={busy}
                  onClick={() => void work(() => tutorAction("stop"))}
                >
                  أوقف الجلسة
                </button>
                <button
                  disabled={busy}
                  onClick={() => setConfirmSolution(true)}
                >
                  اطلب شرح الحل
                </button>
              </div>
            </>
          )}
          {confirmSolution && (
            <div className="lesson-callout">
              <p>سيُسجل عرض الحل كمساعدة كاملة، ولن يُحتسب أداءً مستقلًا.</p>
              <button
                disabled={busy}
                onClick={() => void work(() => tutorAction("show_solution"))}
              >
                أوافق، اعرض الحل للتعلم
              </button>
              <button onClick={() => setConfirmSolution(false)}>
                أعود للمحاولة
              </button>
            </div>
          )}
        </section>
      )}
      {goals !== null && (
        <details
          className="intelligent-goals"
          open={reflectionOpen}
          onToggle={(event) => setReflectionOpen(event.currentTarget.open)}
        >
          <summary>هدفي وتوقعي وتأملي — اختياري</summary>
          <p>
            التقدير الذاتي لا يغير صحة الحل ولا يضيف دليل إتقان. يمكنك تجاوز هذه
            الخطوة دون عقوبة، ولا تُرسل هذه النصوص إلى معلم آلي خارجي.
          </p>
          <label>
            {editingGoal ? "عدّل وصف هدفك الحالي" : "هدف صغير لهذا الدرس"}
            <input
              ref={goalInput}
              disabled={busy}
              maxLength={240}
              value={goalText}
              onChange={(event) => setGoalText(event.target.value)}
              placeholder="أحل مسألتين جديدتين دون مساعدة"
            />
          </label>
          <label>
            عدد المسائل الجديدة المستقلة
            <select
              disabled={busy}
              value={goalTarget}
              onChange={(event) => setGoalTarget(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {count.toLocaleString("ar")}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={
              busy || (!editingGoal && !chosenSkill) || !goalText.trim()
            }
            onClick={() =>
              void work(async () => {
                const next = editingGoal
                  ? await updateLearningGoal(
                      api,
                      editingGoal,
                      goalText,
                      goalTarget,
                    )
                  : await api.request("/learning/goals", goalData, "POST", {
                      trackRevisionId,
                      lessonRevisionId: chosenLessonId,
                      skillCode: chosenSkill,
                      targetIndependentCount: goalTarget,
                      textAr: goalText,
                    });
                if (alive.current) {
                  setGoals((current) =>
                    editingGoal
                      ? (current ?? []).map((goal) =>
                          goal.id === next.id ? next : goal,
                        )
                      : [...(current ?? []), next],
                  );
                  setGoalText("");
                  setGoalTarget(2);
                  setEditingGoal(null);
                  setNotice(
                    editingGoal
                      ? "حُفظ تعديل الهدف؛ بقيت أدلته الأصلية محفوظة ويحسب الخادم تحقيقه."
                      : "حُفظ هدفك الاختياري.",
                  );
                }
              })
            }
          >
            {editingGoal ? "احفظ تعديل الهدف" : "احفظ هدفي الاختياري"}
          </button>
          {editingGoal && (
            <button
              disabled={busy}
              onClick={() => {
                setEditingGoal(null);
                setGoalText("");
                setGoalTarget(2);
              }}
            >
              ألغِ تعديل الهدف
            </button>
          )}
          <ul>
            {goals.map((goal) => (
              <li key={goal.id}>
                <p>
                  {goal.textAr} —{" "}
                  {goal.status === "achieved"
                    ? "تحقق الهدف بالأدلة المتاحة"
                    : goal.status === "skipped"
                      ? "تجاوزت هذا الهدف"
                      : "هدف جارٍ"}
                </p>
                <p>
                  أدلة مستقلة: {goal.independentCount.toLocaleString("ar")} من{" "}
                  {goal.targetIndependentCount.toLocaleString("ar")}.
                </p>
                <div className="actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditingGoal(goal);
                      setGoalText(goal.textAr);
                      setGoalTarget(goal.targetIndependentCount);
                      goalInput.current?.focus();
                    }}
                  >
                    عدّل هذا الهدف
                  </button>
                  {([false, true] as const).map((skipped) => (
                    <button
                      key={String(skipped)}
                      disabled={busy || goal.status !== "active"}
                      onClick={() =>
                        void work(async () => {
                          const next = await api.request(
                            `/learning/goals/${goal.id}/checkin`,
                            goalData,
                            "POST",
                            { expectedRevision: goal.revision, skipped },
                          );
                          if (alive.current)
                            setGoals(
                              (current) =>
                                current?.map((item) =>
                                  item.id === next.id ? next : item,
                                ) ?? [],
                            );
                        })
                      }
                    >
                      {skipped
                        ? "تجاوز الهدف دون عقوبة"
                        : "راجع الهدف مقابل الأدلة"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <label>
            متى تكتب ملاحظتك؟
            <select
              value={phase}
              onChange={(event) => setPhase(event.target.value as typeof phase)}
            >
              <option value="predict">قبل النشاط — توقعي</option>
              <option value="monitor">أثناء التعلم — ملاحظتي</option>
              <option value="reflect">بعد النشاط — ما تعلمته</option>
            </select>
          </label>
          <label>
            ما مدى ثقتك في إجابتك؟ — اختياري
            <select
              value={confidence}
              onChange={(event) => setConfidence(event.target.value)}
            >
              <option value="">أتجاوز التقدير</option>
              <option value="25">أحتاج إلى تجربة أخرى</option>
              <option value="50">متردد</option>
              <option value="75">واثق إلى حد ما</option>
              <option value="100">واثق تمامًا</option>
            </select>
          </label>
          <label>
            ما الاستراتيجية التي ستستخدمها، أو ما الذي أربكك؟
            <textarea
              rows={3}
              maxLength={1000}
              value={reflectionText}
              onChange={(event) => setReflectionText(event.target.value)}
            />
          </label>
          <div className="actions">
            {([false, true] as const).map((skipped) => (
              <button
                key={String(skipped)}
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    const goal = goals.find((item) => item.status === "active");
                    const next = await api.request(
                      "/learning/reflections",
                      reflectionData,
                      "POST",
                      {
                        trackRevisionId,
                        ...(activity ? { activityId: activity.id } : {}),
                        ...(goal ? { goalId: goal.id } : {}),
                        phase,
                        ...(confidence && !skipped
                          ? { confidence: Number(confidence) }
                          : {}),
                        textAr: skipped ? "" : reflectionText,
                        skipped,
                      },
                    );
                    if (alive.current) {
                      setReflection(next);
                      setReflectionText("");
                      setConfidence("");
                    }
                  })
                }
              >
                {skipped ? "تجاوز هذه المطالبة" : "احفظ تأملي"}
              </button>
            ))}
          </div>
          {reflection && <p role="status">{reflection.messageAr}</p>}
        </details>
      )}
    </section>
  );
}
