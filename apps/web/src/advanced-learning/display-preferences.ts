export interface DisplayPreferences {
  textScale: 1 | 1.25 | 1.5;
  highContrast: boolean;
  reduceMotion: boolean;
}
export const defaultDisplayPreferences: DisplayPreferences = {
  textScale: 1,
  highContrast: false,
  reduceMotion: false,
};
/** Presentation choices remain local UI state; they are never diagnoses or learning evidence. */
export function displayClass(preferences: DisplayPreferences): string {
  return [
    "advanced-learning",
    preferences.highContrast ? "c-high-contrast" : "",
    preferences.reduceMotion ? "c-reduce-motion" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
export const stageLabels = {
  frame: "فهم المهمة والمعطيات",
  plan: "الخطة والافتراضات",
  investigate: "التجربة والتحقق",
  justify: "تفسير النتيجة",
  reflect: "تأمل وتحسين",
};
export type ProblemStage = keyof typeof stageLabels;
export function metricDisplay(value: number | null): string {
  return value === null
    ? "غير مقاس"
    : value.toLocaleString("ar", {
        style: "percent",
        maximumFractionDigits: 1,
      });
}
