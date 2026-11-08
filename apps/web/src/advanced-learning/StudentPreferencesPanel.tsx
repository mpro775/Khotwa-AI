import { type DisplayPreferences } from "./display-preferences";

export function StudentPreferencesPanel({
  value,
  onChange,
}: {
  value: DisplayPreferences;
  onChange: (next: DisplayPreferences) => void;
}) {
  return (
    <details className="c-preferences">
      <summary>خيارات القراءة والعرض</summary>
      <fieldset>
        <legend>اختر عرضًا مناسبًا لك</legend>
        <label>
          حجم النص
          <select
            value={value.textScale}
            onChange={(event) => {
              const scale = Number(event.target.value);
              if (scale === 1 || scale === 1.25 || scale === 1.5)
                onChange({ ...value, textScale: scale });
            }}
          >
            <option value={1}>عادي</option>
            <option value={1.25}>كبير</option>
            <option value={1.5}>أكبر</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={value.highContrast}
            onChange={(event) =>
              onChange({ ...value, highContrast: event.target.checked })
            }
          />
          تباين مرتفع
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={value.reduceMotion}
            onChange={(event) =>
              onChange({ ...value, reduceMotion: event.target.checked })
            }
          />
          تقليل الحركة
        </label>
        <p className="helper">
          تفضيلات عرض محلية لهذه الصفحة؛ لا تصنّف أسلوب تعلمك ولا تضيف دليل
          إتقان.
        </p>
      </fieldset>
    </details>
  );
}
