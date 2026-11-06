import { useRef, useState } from "react";
import { editorFixtures, issueSamples } from "./editor-fixtures";
import {
  findDisplayFixture,
  localInputIssue,
  previousSymbolStart,
  replaceSelection,
  sourceOffset,
  visibleRaw,
} from "./editor-model";
import { FormulaPreview } from "./FormulaPreview";
import { MathLiveProbe } from "./MathLiveProbe";

const symbols = [
  ...[..."٠١٢٣٤٥٦٧٨٩"].map((text, i) => ({
    text,
    name:
      "أدخل العدد " +
      [
        "صفر",
        "واحد",
        "اثنين",
        "ثلاثة",
        "أربعة",
        "خمسة",
        "ستة",
        "سبعة",
        "ثمانية",
        "تسعة",
      ][i],
  })),
  { text: "س", name: "أدخل المتغير س" },
  { text: "+", name: "أدخل علامة الجمع" },
  { text: "−", name: "أدخل علامة الطرح أو السالب" },
  { text: "×", name: "أدخل علامة الضرب" },
  { text: "÷", name: "أدخل علامة القسمة" },
  { text: "/", name: "أدخل فاصل الكسر" },
  { text: "=", name: "أدخل علامة المساواة" },
  { text: "(", name: "افتح قوسًا" },
  { text: ")", name: "أغلق قوسًا" },
];

export function ArabicEditor() {
  const input = useRef<HTMLTextAreaElement>(null);
  const history = useRef([
    editorFixtures.find((f) => f.id === "brackets")!.raw,
  ]);
  const historyIndex = useRef(0);
  const [raw, setRaw] = useState(history.current[0]!);
  const [notice, setNotice] = useState("");
  const [showProbe, setShowProbe] = useState(false);
  const [surroundingDirection, setSurroundingDirection] = useState<
    "rtl" | "ltr"
  >("rtl");
  const fixture = findDisplayFixture(raw);
  const issue = localInputIssue(raw);

  function edit(next: string, caret?: number) {
    if (next !== history.current[historyIndex.current]) {
      history.current = [
        ...history.current.slice(0, historyIndex.current + 1),
        next,
      ];
      historyIndex.current += 1;
    }
    setRaw(next);
    setNotice("");
    if (caret !== undefined)
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.setSelectionRange(caret, caret);
      });
  }
  function insert(text: string) {
    const area = input.current;
    if (!area) return;
    const change = replaceSelection(
      raw,
      area.selectionStart,
      area.selectionEnd,
      text,
    );
    edit(change.raw, change.caret);
  }
  function moveHistory(delta: number) {
    historyIndex.current = Math.max(
      0,
      Math.min(history.current.length - 1, historyIndex.current + delta),
    );
    const next = history.current[historyIndex.current]!;
    setRaw(next);
    setNotice("");
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.length, next.length);
    });
  }
  function locateIssue() {
    if (!issue) return;
    input.current?.focus();
    input.current?.setSelectionRange(
      sourceOffset(raw, issue.start),
      sourceOffset(raw, issue.end),
    );
  }
  async function copyRaw() {
    try {
      await navigator.clipboard.writeText(raw);
      setNotice("نُسخ النص الأصلي كما كتبته، دون تحويل الرموز أو ترتيبها.");
    } catch {
      setNotice(
        "تعذر الوصول للحافظة. حدد النص داخل المحرر واستخدم أمر النسخ في جهازك.",
      );
    }
  }
  function removeSymbol() {
    const area = input.current;
    if (!area) return;
    const start =
      area.selectionStart === area.selectionEnd
        ? previousSymbolStart(raw, area.selectionStart)
        : area.selectionStart;
    const change = replaceSelection(raw, start, area.selectionEnd, "");
    edit(change.raw, change.caret);
  }
  return (
    <main>
      <header>
        <span className="brand">
          خُطوة <span lang="en">AI</span>
        </span>
        <span className="phase">تجربة المحرر · المرحلة الثانية</span>
      </header>
      <div className="intro">
        <span className="eyebrow">اكتب رياضياتك بالعربية</span>
        <h1>كل رمز في مكانه.</h1>
        <p>
          جرّب المتغير س والأعداد والأقواس والكسور البسيطة. اكتب، عدّل، وانسخ
          الصيغة مع الاحتفاظ بأصلها.
        </p>
      </div>
      <div className="workspace">
        <section className="editor-card" aria-labelledby="editor-heading">
          <div className="card-heading">
            <h2 id="editor-heading">مسودة المعادلة</h2>
            <span className="badge">تجربة محلية</span>
          </div>
          <label htmlFor="raw-input">النص الأصلي القابل للتحرير</label>
          <textarea
            id="raw-input"
            ref={input}
            value={raw}
            dir="ltr"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-describedby="editor-help input-state"
            aria-invalid={issue?.status === "syntax_error"}
            onChange={(event) => edit(event.target.value)}
          />
          <p className="helper" id="editor-help">
            استخدم لوحة جهازك أو الرموز أدناه. يبقى النص في هذه الصفحة فقط حتى
            إعادة تحميلها.
          </p>
          <div
            className="symbol-pad"
            role="group"
            aria-label="لوحة الأرقام والرموز العربية"
            dir="ltr"
          >
            {symbols.map((symbol) => (
              <button
                key={symbol.text}
                aria-label={symbol.name}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => insert(symbol.text)}
              >
                {symbol.text}
              </button>
            ))}
          </div>
          <div className="actions">
            <button className="primary" onClick={() => void copyRaw()}>
              انسخ النص الأصلي
            </button>
            <button
              onClick={() => moveHistory(-1)}
              disabled={historyIndex.current === 0}
            >
              تراجع
            </button>
            <button
              onClick={() => moveHistory(1)}
              disabled={historyIndex.current === history.current.length - 1}
            >
              أعد التعديل
            </button>
            <button onClick={removeSymbol}>احذف رمزًا</button>
          </div>
          <div
            id="input-state"
            className={issue ? "input-state attention" : "input-state"}
            role="status"
            aria-live="polite"
          >
            {issue ? (
              <>
                <strong>
                  {issue.status === "syntax_error"
                    ? "راجع كتابة الصيغة"
                    : "خارج الدعم الحالي"}
                </strong>
                <p>{issue.message}</p>
                <button onClick={locateIssue}>حدد الموضع في الأصل</button>
              </>
            ) : (
              <>
                <strong>
                  {fixture ? "معاينة مثال متاحة" : "مسودة قابلة للتعديل"}
                </strong>
                <p>
                  {fixture
                    ? "قارن ترتيب الصيغة بأصلها. هذه معاينة محلية لمثال محدد."
                    : "يبقى إدخالك كما كتبته. التفسير الرياضي لهذه المسودة ينتظر محرك التحليل."}
                </p>
              </>
            )}
            <small>لم نقيّم صحة الحل أو فهمك للمفهوم.</small>
          </div>
          <p className="helper" role="status">
            {notice}
          </p>
        </section>
        <section className="preview-card" aria-labelledby="preview-heading">
          <div className="card-heading">
            <h2 id="preview-heading">الصيغة المعروضة</h2>
            <span className="badge subtle">معزولة الاتجاه</span>
          </div>
          <div
            className="formula-context"
            dir={surroundingDirection}
            data-testid="formula-context"
          >
            <p>حل المعادلة:</p>
            <div className="formula" data-testid="formula-preview">
              {fixture && !issue ? (
                <FormulaPreview
                  parts={fixture.display}
                  label={fixture.meaningExample}
                />
              ) : (
                <p>
                  تتوفر المعاينة المنظمة للأمثلة المحددة أدناه. النص الأصلي باقٍ
                  في المحرر.
                </p>
              )}
            </div>
          </div>
          <button
            className="quiet"
            onClick={() =>
              setSurroundingDirection(
                surroundingDirection === "rtl" ? "ltr" : "rtl",
              )
            }
          >
            بدّل اتجاه الحاوية لاختبار الثبات
          </button>
          <div className="meaning">
            <h3>المعنى والعرض</h3>
            <p data-testid="meaning">
              {fixture && !issue
                ? fixture.meaningExample
                : "لا يوجد تمثيل دلالي متحقق لهذه المسودة بعد."}
            </p>
            <p className="helper">
              وصف المثال معد مسبقًا لفحص العرض. لا يُستنتج المعنى من مواضع
              الحروف أو من LaTeX.
            </p>
          </div>
        </section>
      </div>
      <section className="examples" aria-label="أمثلة تجربة الإدخال">
        <h2>جرّب صيغة أخرى</h2>
        <p className="helper">
          أمثلة اصطناعية لفحص المحرر؛ ليست تمارين منشورة.
        </p>
        <div className="examples-list">
          {editorFixtures.map((item) => (
            <button
              key={item.id}
              onClick={() => edit(item.raw)}
              aria-pressed={fixture?.id === item.id}
            >
              {item.label}
            </button>
          ))}
          <button onClick={() => edit("2س + 3 = 7")}>
            أرقام من لوحة إنجليزية
          </button>
        </div>
        <details>
          <summary>أمثلة رسائل الصياغة وحدود الدعم</summary>
          <p className="helper">
            عينات واجهة محلية لحالات syntax_error وunsupported؛ لا اتصال بخدمة
            تحقق.
          </p>
          <div className="examples-list">
            {issueSamples.map((item) => (
              <button key={item.label} onClick={() => edit(item.raw)}>
                {item.label}
              </button>
            ))}
          </div>
        </details>
      </section>
      <section className="audit">
        <details>
          <summary>سجل المصدر والعرض للمراجعة</summary>
          <dl>
            <dt>النص الخام (تُكشف المحارف الخفية بالرمز)</dt>
            <dd>
              <code dir="ltr" data-testid="source-raw">
                {visibleRaw(raw)}
              </code>
            </dd>
            <dt>العرض</dt>
            <dd>
              {fixture && !issue
                ? "وصفة MathML ثابتة للمثال " + fixture.id
                : "غير مشتق؛ المسودة محفوظة دون تفسير"}
            </dd>
            <dt>التمثيل الدلالي الموثوق</dt>
            <dd data-testid="semantic-status">
              غير متاح — ينتظر PH-03/05. وصف المثال ليس AST أو حكمًا.
            </dd>
            <dt>حالة عينة الرسالة</dt>
            <dd data-testid="issue-status">{issue?.status ?? "draft"}</dd>
            <dt>مراجع المثال</dt>
            <dd>
              {fixture?.references.join(" · ") ??
                "إدخال جديد / عينة رسالة محلية"}
            </dd>
          </dl>
        </details>
      </section>
      <button
        className="probe-toggle"
        aria-expanded={showProbe}
        onClick={() => setShowProbe(!showProbe)}
      >
        مختبر MathLive القابل للتفاعل
      </button>
      {showProbe && <MathLiveProbe />}
      <footer>
        نموذج إثبات صلاحية للمحرر. اختبار الهاتف الفعلي ومراجعة الاصطلاحات قيد
        الانتظار؛ لم تُعتمد GATE-1.
      </footer>
    </main>
  );
}
