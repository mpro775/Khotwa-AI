import { useRef } from "react";
import {
  replaceSelection,
  previousSymbolStart,
  visibleRaw,
} from "./editor-model";
const symbols = [..."٠١٢٣٤٥٦٧٨٩", "س", "+", "−", "×", "÷", "/", "=", "(", ")"];
const names: Record<string, string> = {
  س: "المتغير س",
  "+": "جمع",
  "−": "طرح أو سالب",
  "×": "ضرب",
  "÷": "قسمة",
  "/": "فاصل كسر",
  "=": "مساواة",
  "(": "افتح قوسًا",
  ")": "أغلق قوسًا",
};
export function MathInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (raw: string) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  function replace(start: number, end: number, text: string) {
    const next = replaceSelection(value, start, end, text);
    onChange(next.raw);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.caret, next.caret);
    });
  }
  return (
    <div className="live-input">
      <label htmlFor="step-draft">خطوتك — النص الأصلي</label>
      <textarea
        id="step-draft"
        ref={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-describedby="draft-help draft-count"
      />
      <p id="draft-help" className="helper">
        اكتب معادلة واحدة في س. يمكنك حفظ صيغة غير مكتملة ثم تعديلها؛ التحقق
        يوضح ما يمكن قراءته.
      </p>
      <div
        className="symbol-pad"
        dir="ltr"
        role="group"
        aria-label="لوحة الرموز العربية"
      >
        {symbols.map((symbol) => (
          <button
            key={symbol}
            type="button"
            aria-label={"أدخل " + (names[symbol] ?? "الرقم " + symbol)}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              const area = input.current;
              if (area) replace(area.selectionStart, area.selectionEnd, symbol);
            }}
          >
            {symbol}
          </button>
        ))}
      </div>
      <div className="input-tools">
        <button
          type="button"
          onClick={() => {
            const area = input.current;
            if (area)
              replace(
                area.selectionStart === area.selectionEnd
                  ? previousSymbolStart(value, area.selectionStart)
                  : area.selectionStart,
                area.selectionEnd,
                "",
              );
          }}
        >
          احذف رمزًا من المسودة
        </button>
        <span className="helper" id="draft-count">
          {[...value].length > 256
            ? "تجاوز النص الحد المسموح (٢٥٦ محرفًا)."
            : ""}
        </span>
      </div>
      <details>
        <summary>اعرض النص مع كشف المحارف الخفية</summary>
        <code className="math-text">{visibleRaw(value)}</code>
      </details>
    </div>
  );
}
