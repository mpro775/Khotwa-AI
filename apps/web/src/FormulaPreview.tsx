import { createElement as h } from "react";
import type { DisplayPart } from "./editor-fixtures";

function token(text: string, key: number) {
  const tag = /^[٠-٩]+$/.test(text) ? "mn" : text === "س" ? "mi" : "mo";
  return h(tag, { key, ...(tag === "mn" ? { dir: "ltr" } : {}) }, text);
}

export function FormulaPreview({
  parts,
  label,
}: {
  parts: DisplayPart[];
  label: string;
}) {
  return h(
    "math",
    {
      xmlns: "http://www.w3.org/1998/Math/MathML",
      dir: "rtl",
      display: "block",
      "aria-label": label,
    },
    h(
      "mrow",
      {},
      ...parts.map((part, i) =>
        typeof part === "string"
          ? token(part, i)
          : h(
              "mfrac",
              { key: i },
              h("mrow", {}, ...part.numerator.match(/[٠-٩]+|س/g)!.map(token)),
              h("mn", { dir: "ltr" }, part.denominator),
            ),
      ),
    ),
  );
}
