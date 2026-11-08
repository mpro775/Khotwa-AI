import { useEffect, useRef, useState } from "react";
import {
  ProductApi,
  type Catalog,
  type Identity,
  type PublicItem,
  catalogData,
  messageOf,
  record,
  textField,
} from "./product-api";
import { AccountPanel } from "./AccountPanel";
import { ContentStudio } from "./ContentStudio";
import { PhysicsWorkspace, ProgrammingWorkspace } from "./SubjectWorkspace";
import { BetaPanel } from "./BetaPanel";
import { StudentWorkspace } from "./StudentWorkspace";
import { clearLearningStorage } from "./product-session";
import { LearningPaths } from "./LearningPaths";
import "./product.css";

type View =
  | "home"
  | "algebra"
  | "physics"
  | "programming"
  | "account"
  | "studio"
  | "beta";
const labels: Record<View, string> = {
  home: "الدروس",
  algebra: "الجبر",
  physics: "الفيزياء",
  programming: "Python",
  account: "حسابي",
  studio: "إعداد المحتوى",
  beta: "عن التجربة والملاحظات",
};
export function ProductShell() {
  const api = useRef(new ProductApi()).current;
  const previousOwner = useRef<string | undefined>(undefined);
  const catalogRequest = useRef(0);
  const [ownerEpoch, setOwnerEpoch] = useState(0);
  const [legacyCatalogOpen, setLegacyCatalogOpen] = useState(false);
  const [view, setView] = useState<View>("home"),
    [identity, setIdentity] = useState<Identity | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [resume, setResume] = useState<{
      attemptId: string;
      problemId: string;
    } | null>(null),
    [physicsSelection, setPhysicsSelection] = useState<string | null>(null),
    [programmingSelection, setProgrammingSelection] = useState<string | null>(
      null,
    );
  const [visitedPhysics, setVisitedPhysics] = useState(false),
    [visitedProgramming, setVisitedProgramming] = useState(false);
  const [physicsResume, setPhysicsResume] = useState<string | null>(null),
    [programmingResume, setProgrammingResume] = useState<string | null>(null);
  const [resumeVersion, setResumeVersion] = useState(0);
  const ready = !!identity && (!!identity.user || identity.guestAvailable);
  function adoptIdentity(next: Identity) {
    const owner =
      next.user?.id ?? (next.guestAvailable ? "guest" : "anonymous");
    if (
      previousOwner.current !== undefined &&
      previousOwner.current !== owner
    ) {
      try {
        clearLearningStorage(sessionStorage);
      } catch {
        /* Optional browser resource cache. */
      }
      setResume(null);
      setPhysicsSelection(null);
      setProgrammingSelection(null);
      setPhysicsResume(null);
      setProgrammingResume(null);
      catalogRequest.current++;
      setCatalog(null);
      setLegacyCatalogOpen(false);
      setBusy(false);
      setOwnerEpoch((epoch) => epoch + 1);
    }
    previousOwner.current = owner;
    setIdentity(next);
  }
  useEffect(() => {
    let active = true;
    void api
      .me()
      .then((me) => {
        if (active) adoptIdentity(me);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      });
    return () => {
      active = false;
    };
  }, [api]);
  useEffect(() => {
    // Fetching the legacy catalog discloses every listed question. Keep that
    // exposure out of the learning-path entry until the learner opens the bank.
    if (ready && legacyCatalogOpen && !catalog && !busy) void loadCatalog();
  }, [ready, legacyCatalogOpen, identity?.user?.id]);
  function navigate(next: View) {
    setView(next);
    if (next === "physics") setVisitedPhysics(true);
    if (next === "programming") setVisitedProgramming(true);
    requestAnimationFrame(() =>
      document.getElementById("product-view")?.focus(),
    );
  }
  async function loadCatalog() {
    const version = ++catalogRequest.current;
    setLegacyCatalogOpen(true);
    setBusy(true);
    setError("");
    try {
      const loaded = await api.request("/catalog", catalogData);
      if (version === catalogRequest.current) setCatalog(loaded);
    } catch (e) {
      if (version === catalogRequest.current) setError(messageOf(e));
    } finally {
      if (version === catalogRequest.current) setBusy(false);
    }
  }
  async function startGuest() {
    setBusy(true);
    setError("");
    try {
      adoptIdentity(await api.guest());
      setNotice("بدأت جلسة التعلم. اختر درسًا أو افتح مساحة الجبر.");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function open(item: PublicItem) {
    setBusy(true);
    setError("");
    try {
      if (!ready) adoptIdentity(await api.guest());
      if (item.subject === "physics") {
        setPhysicsResume(null);
        setPhysicsSelection(item.id);
        navigate("physics");
      } else if (item.subject === "programming") {
        setProgrammingResume(null);
        setProgrammingSelection(item.id);
        navigate("programming");
      } else {
        const started = await api.request(
          `/catalog/problems/${item.id}/start`,
          (value) => {
            const r = record(value);
            return {
              attemptId: textField(r.attemptId),
              problemId: textField(r.problemId),
            };
          },
          "POST",
          {},
        );
        setResume(started);
        navigate("algebra");
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="product-shell" dir="rtl">
      <a className="skip-link" href="#product-view">
        انتقل إلى المحتوى
      </a>
      <header className="product-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          خُطوة <span lang="en">AI</span>
        </a>
        <span className="beta-badge">نسخة تجريبية</span>
        <button className="identity-button" onClick={() => navigate("account")}>
          {identity?.user ? (
            <>
              <span>حسابك</span>
              <bdi dir="ltr">{identity.user.email}</bdi>
            </>
          ) : (
            "ضيف · الدخول لحفظ التقدم"
          )}
        </button>
      </header>
      <nav className="product-nav" aria-label="أقسام خُطوة">
        {(
          [
            "home",
            "algebra",
            "physics",
            "programming",
            "account",
            "studio",
            "beta",
          ] as View[]
        )
          .filter(
            (next) =>
              next !== "studio" ||
              (!!identity?.user &&
                ["teacher", "content_manager", "admin"].includes(
                  identity.user.role,
                )),
          )
          .map((next) => (
            <button
              key={next}
              aria-current={view === next ? "page" : undefined}
              onClick={() => navigate(next)}
            >
              {labels[next]}
            </button>
          ))}
      </nav>
      <div id="product-view" tabIndex={-1} className="product-view-anchor">
        <main
          className="product-page"
          hidden={view !== "home"}
          aria-labelledby="learn-title"
        >
          <div className="page-heading">
            <span className="eyebrow">
              افهم، جرّب، ثم أثبت فهمك بخطوة جديدة
            </span>
            <h1 id="learn-title">كل فهم يبدأ بخُطوة.</h1>
            <p>
              اختر درسًا، حاول بنفسك، واستعن بتلميح عند الحاجة. نميّز نتيجة
              التحقق عن السبب المحتمل للخطأ وعن المساعدة التعليمية.
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
          <div className="welcome-actions">
            {!ready && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void startGuest()}
              >
                {busy ? "جارٍ بدء الجلسة…" : "ابدأ كضيف"}
              </button>
            )}
            <button onClick={() => navigate("account")}>
              {identity?.user ? "اعرض تقدمي ومحاولاتي" : "ادخل لحفظ رحلتك"}
            </button>
            {ready && (
              <button disabled={busy} onClick={() => void loadCatalog()}>
                حدّث بنك المسائل المنشورة
              </button>
            )}
          </div>
          <div className="journey-steps" aria-label="خطوات التعلم">
            <span>١ · اختر درسًا</span>
            <span>٢ · اكتب محاولتك</span>
            <span>٣ · افهم النتيجة</span>
            <span>٤ · جرّب مسألة جديدة</span>
          </div>
          {ready && <LearningPaths key={ownerEpoch} api={api} />}
          <details
            className="legacy-problem-bank"
            open={legacyCatalogOpen}
            onToggle={(event) => setLegacyCatalogOpen(event.currentTarget.open)}
          >
            <summary>بنك المسائل ومساحات التدريب الحالية</summary>
            {catalog?.subjects.length ? (
              catalog.subjects.map((subject) => (
                <section key={subject.code} className="product-card">
                  <h2>{subject.titleAr}</h2>
                  {subject.units.map((unit) => (
                    <section key={unit.code} className="catalog-unit">
                      <h3>{unit.titleAr}</h3>
                      {unit.lessons.map((lesson) => (
                        <div key={lesson.code} className="catalog-lesson">
                          <h4>{lesson.titleAr}</h4>
                          <div className="product-grid">
                            {lesson.items.map((item) => (
                              <article key={item.id} className="lesson-card">
                                <span className="eyebrow">
                                  {item.kind === "transfer"
                                    ? "نقل فهم"
                                    : item.kind === "remediation"
                                      ? "تدريب على المهارة"
                                      : "مسألة درس"}{" "}
                                  ·{" "}
                                  {item.difficulty === 1
                                    ? "تمهيدية"
                                    : item.difficulty === 2
                                      ? "متوسطة"
                                      : "تحدٍّ بسيط"}
                                </span>
                                <h3>{item.titleAr}</h3>
                                <p>{item.statementAr}</p>
                                <button
                                  disabled={busy}
                                  onClick={() => void open(item)}
                                >
                                  ابدأ هذه المسألة
                                </button>
                              </article>
                            ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  ))}
                </section>
              ))
            ) : (
              <div className="product-card">
                <h2>
                  {busy ? "جارٍ تحميل الدروس…" : "ابدأ من المسائل المتاحة"}
                </h2>
                <p>
                  {ready
                    ? "لا توجد دروس منشورة في البنك الجديد حاليًا. يمكنك متابعة الجبر الموجود، أو نشر محتوى مراجع من حساب مخوّل."
                    : "ابدأ جلسة ضيف لعرض المحتوى المنشور، أو ادخل بحسابك لاستعادة تقدمك."}
                </p>
                <button onClick={() => navigate("algebra")}>
                  افتح مساحة الجبر
                </button>
              </div>
            )}
          </details>
          <p className="helper">
            الكسور الجبرية غير المفعلة تبقى خارج بنك الطالب حتى اكتمال فحص
            عرضها. لا يُفقد التقدم عند تعذر خدمة المساعدة.
          </p>
        </main>
        <div hidden={view !== "algebra"}>
          <StudentWorkspace key={ownerEpoch} resumeAttempt={resume} />
        </div>
        <main hidden={view !== "physics"}>
          {ready && visitedPhysics ? (
            <PhysicsWorkspace
              key={ownerEpoch}
              api={api}
              selectedRevision={physicsSelection}
              resumeAttemptId={physicsResume}
              resumeVersion={resumeVersion}
            />
          ) : (
            <section className="product-page">
              <h1>مسار الفيزياء</h1>
              <p>ابدأ جلسة تعلم لعرض المسائل المنشورة.</p>
              <button disabled={busy} onClick={() => void startGuest()}>
                ابدأ كضيف
              </button>
            </section>
          )}
        </main>
        <main hidden={view !== "programming"}>
          {ready && visitedProgramming ? (
            <ProgrammingWorkspace
              key={ownerEpoch}
              api={api}
              selectedRevision={programmingSelection}
              resumeAttemptId={programmingResume}
              resumeVersion={resumeVersion}
            />
          ) : (
            <section className="product-page">
              <h1>مسار Python</h1>
              <p>ابدأ جلسة تعلم لعرض التمارين المنشورة.</p>
              <button disabled={busy} onClick={() => void startGuest()}>
                ابدأ كضيف
              </button>
            </section>
          )}
        </main>
        <main hidden={view !== "account"}>
          <AccountPanel
            api={api}
            identity={identity}
            onIdentity={adoptIdentity}
            onResume={(attempt) => {
              setResume(attempt);
              navigate("algebra");
            }}
            onResumeSubject={(attempt) => {
              setResumeVersion((value) => value + 1);
              if (attempt.subjectCode === "physics") {
                setPhysicsSelection(null);
                setPhysicsResume(attempt.id);
                navigate("physics");
              } else {
                setProgrammingSelection(null);
                setProgrammingResume(attempt.id);
                navigate("programming");
              }
            }}
          />
        </main>
        <main hidden={view !== "studio"}>
          <ContentStudio key={ownerEpoch} api={api} identity={identity} />
        </main>
        <main hidden={view !== "beta"}>
          <BetaPanel key={ownerEpoch} api={api} identity={identity} />
        </main>
      </div>
      <footer className="product-footer">
        <span>خُطوة AI — أدلة تعلم محدودة، ومساعدة عربية واضحة.</span>
        <a href="/demo/teacher">عرض المعلم ببيانات اصطناعية</a>
        <button onClick={() => navigate("beta")}>أرسل ملاحظة</button>
      </footer>
    </div>
  );
}
