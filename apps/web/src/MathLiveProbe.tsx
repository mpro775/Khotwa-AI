import { useEffect, useRef, useState } from "react";
import { MathfieldElement } from "mathlive";
import "mathlive/fonts.css";
import { visibleRaw } from "./editor-model";

MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = "ar";

// Candidate evaluation only: serialization never overwrites sourceRaw.
export function MathLiveProbe() {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState("");
  const [ascii, setAscii] = useState("");
  const [lastPaste, setLastPaste] = useState("");
  useEffect(() => {
    const mf = new MathfieldElement();
    mf.setAttribute("aria-label", "تجربة MathLive العربية");
    mf.setAttribute("dir", "ltr");
    host.current?.append(mf);
    mf.mathVirtualKeyboardPolicy = "manual";
    mf.smartFence = false;
    mf.inlineShortcuts = {};
    mf.menuItems = [];
    const input = () => {
      setLatex(mf.getValue("latex"));
      setAscii(mf.getValue("ascii-math"));
    };
    const paste = (event: ClipboardEvent) =>
      setLastPaste(event.clipboardData?.getData("text/plain") ?? "");
    mf.addEventListener("input", input);
    mf.addEventListener("paste", paste);
    field.current = mf;
    return () => {
      mf.removeEventListener("input", input);
      mf.removeEventListener("paste", paste);
      mf.remove();
      field.current = null;
    };
  }, []);
  function load(value: string) {
    field.current?.setValue(value, { format: "latex" });
    setLatex(field.current?.getValue("latex") ?? "");
    setAscii(field.current?.getValue("ascii-math") ?? "");
  }
  return (
    <section className="probe" aria-label="تقييم MathLive">
      <h2>مختبر المرشح الأول · MathLive 0.111.4</h2>
      <p>
        حقل رياضي قابل للتعديل. تسلسله منفصل عن نص المسودة؛ لا يصدر حكمًا على
        المعنى أو الحل.
      </p>
      <div className="probe-field" ref={host} dir="ltr" />
      <div className="actions">
        <button onClick={() => load("٢(س + ٣) = ١٠")}>
          جرّب الأقواس في MathLive
        </button>
        <button onClick={() => load("س=\\frac{١}{٢}")}>
          جرّب الكسر في MathLive
        </button>
        <button onClick={() => load("")}>أفرغ حقل MathLive</button>
        <button
          onClick={() => {
            field.current?.focus();
            field.current?.insert("س");
          }}
        >
          أدخل س في MathLive
        </button>
      </div>
      <dl>
        <dt>تسلسل LaTeX للتحرير</dt>
        <dd>
          <code dir="ltr" data-testid="probe-latex">
            {latex || "∅"}
          </code>
        </dd>
        <dt>تصدير ASCII Math (ليس أصلًا ولا معنى موثوقًا)</dt>
        <dd>
          <code dir="ltr" data-testid="probe-ascii">
            {ascii || "∅"}
          </code>
        </dd>
        <dt>آخر نص لُصق قبل المعالجة</dt>
        <dd>
          <code dir="ltr" data-testid="probe-paste">
            {visibleRaw(lastPaste) || "∅"}
          </code>
        </dd>
      </dl>
      <p className="note">
        لم تجتز التهيئة الافتراضية شرط النسخ العربي النصي: يضيف النسخ محددات
        LaTeX. تجربة المصدر تستخدم محررًا نصيًا مع لوحة رموز ومعاينة MathML.
        القرار النهائي ينتظر الهاتف ومراجعة المختص.
      </p>
    </section>
  );
}
