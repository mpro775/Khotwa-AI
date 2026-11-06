import { editorFixtures, issueSamples } from "./editor-fixtures.ts";

export type LocalIssue = {
  status: "syntax_error" | "unsupported";
  message: string;
  start: number;
  end: number;
};
// Presentation lookup only. Unknown text never becomes a successful parse.
export function findDisplayFixture(raw: string) {
  return editorFixtures.find((f) => f.raw === raw || f.aliases?.includes(raw));
}

export function localInputIssue(raw: string): LocalIssue | null {
  const points = [...raw];
  const unsafe = points.findIndex(
    (c) => /[\p{Cc}\p{Cf}]/u.test(c) && c !== "\n" && c !== "\t",
  );
  if (unsafe >= 0)
    return {
      status: "syntax_error",
      start: unsafe,
      end: unsafe + 1,
      message:
        "يوجد محرف تحكم خفي في هذا الموضع. راجعه واحذفه صراحة؛ لم نغيّر النص الأصلي.",
    };
  if (points.length > 256)
    return {
      status: "unsupported",
      start: 256,
      end: points.length,
      message:
        "يتجاوز السطر حد الإدخال البالغ ٢٥٦ محرفًا. النص باقٍ؛ قسّمه إلى سطر أقصر.",
    };
  const sample = issueSamples.find((s) => s.raw === raw);
  if (sample) return sample;
  // Shallow editor guards only: passing these checks still means draft.
  const foreign = points.findIndex(
    (c) => !/[٠-٩0-9س+−\-×*÷/=() \t\n]/u.test(c),
  );
  if (foreign >= 0)
    return {
      status: /[\p{M}،]/u.test(points[foreign]!)
        ? "syntax_error"
        : "unsupported",
      start: foreign,
      end: foreign + 1,
      message:
        "هذا الرمز غير متاح في صياغة المسار الحالي. بقي النص كما كتبته؛ استخدم س والأعداد الصحيحة والعمليات المتاحة.",
    };
  const opens: number[] = [];
  let equality = false;
  for (const [i, c] of points.entries()) {
    if (c === "(") opens.push(i);
    if (c === ")" && opens.pop() === undefined)
      return {
        status: "syntax_error",
        start: i,
        end: i + 1,
        message: "يوجد قوس إغلاق دون قوس فتح مطابق.",
      };
    if (c === "=") {
      if (equality)
        return {
          status: "syntax_error",
          start: i,
          end: i + 1,
          message: "اكتب معادلة واحدة بعلامة مساواة واحدة في السطر.",
        };
      equality = true;
    }
  }
  const missing = opens.at(-1);
  if (missing !== undefined)
    return {
      status: "syntax_error",
      start: missing,
      end: missing + 1,
      message: "أكمل قوس الفتح المحدد بقوس إغلاق.",
    };
  return null;
}

export function visibleRaw(raw: string) {
  return [...raw]
    .map((c) =>
      /[\p{Cc}\p{Cf}]/u.test(c)
        ? "\\u" + c.codePointAt(0)!.toString(16).padStart(4, "0")
        : c,
    )
    .join("");
}

export function sourceOffset(raw: string, codePointOffset: number) {
  return [...raw].slice(0, codePointOffset).join("").length;
}

export function replaceSelection(
  raw: string,
  start: number,
  end: number,
  text: string,
) {
  return {
    raw: raw.slice(0, start) + text + raw.slice(end),
    caret: start + text.length,
  };
}

export function previousSymbolStart(raw: string, caret: number) {
  return caret - ([...raw.slice(0, caret)].at(-1)?.length ?? 0);
}
