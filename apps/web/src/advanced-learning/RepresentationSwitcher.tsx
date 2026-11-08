import { useId, useState } from "react";
import type { CRepresentation } from "../../../../packages/contracts/src/advanced-learning";

export function RepresentationSwitcher({
  variants,
  onLab,
}: {
  variants: CRepresentation[];
  onLab?: (blockIndex: number) => void;
}) {
  const [selected, setSelected] = useState(variants[0]?.code ?? ""),
    id = useId();
  const variant =
    variants.find((item) => item.code === selected) ?? variants[0];
  if (!variant) return <p>الوصف النصي للمهمة متاح أعلاه.</p>;
  return (
    <section aria-label="طرق عرض الفكرة" className="c-representations">
      <label htmlFor={id}>اختر تمثيلًا للفكرة</label>
      <select
        id={id}
        value={variant.code}
        onChange={(event) => setSelected(event.target.value)}
      >
        {variants.map((item) => (
          <option value={item.code} key={item.code}>
            {item.titleAr}
          </option>
        ))}
      </select>
      <p className="helper">
        هذه تمثيلات للتعلّم. تغيير العرض لا يمحو عملك ولا يثبت إتقانًا.
      </p>
      {variant.assistanceExposure && (
        <p>يتضمن هذا التمثيل دعمًا تعليميًا؛ لا يُحتسب قياسًا مستقلًا.</p>
      )}
      {!variant.sameConstruct && (
        <p>هذا العرض مساعد؛ لا يقيس الهدف نفسه وحده.</p>
      )}
      <div aria-live="polite" aria-atomic="true">
        <h4>{variant.titleAr}</h4>
        <p>{variant.accessibleText}</p>
        {variant.textAr && variant.textAr !== variant.accessibleText && (
          <p>{variant.textAr}</p>
        )}
        {variant.kind === "table" && variant.columns && variant.rows && (
          <div className="table-scroll">
            <table>
              <caption>{variant.learningObjective}</caption>
              <thead>
                <tr>
                  {variant.columns.map((column, i) => (
                    <th scope="col" key={i}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variant.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) =>
                      j === 0 ? (
                        <th key={j} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={j}>
                          <bdi>{cell}</bdi>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {variant.kind === "diagram" && (
          <p>{variant.altText ?? variant.accessibleText}</p>
        )}
        {variant.kind === "code" && (
          <>
            <pre dir="ltr">
              <code>{variant.codeText}</code>
            </pre>
            <p>نص للتتبع والتعلّم؛ لا يُنفّذ الكود هنا.</p>
          </>
        )}
        {variant.kind === "stem_lab" &&
          (onLab && variant.labBlockIndex !== undefined ? (
            <button type="button" onClick={() => onLab(variant.labBlockIndex!)}>
              افتح أداة الاستكشاف
            </button>
          ) : (
            <p>
              يمكنك مواصلة العمل بالوصف النصي. المختبر التفاعلي يتطلب تفعيلًا
              ومحتوى منشورًا.
            </p>
          ))}
      </div>
    </section>
  );
}
