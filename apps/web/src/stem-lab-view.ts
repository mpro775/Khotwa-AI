export interface PlotPoint {
  x: number;
  y: number;
}

/** Separately saved reflection text must survive resuming an older submission. */
export function resumeLabReflection(value: {
  observation: string | null;
  explanation: string | null;
  answer?: Record<string, unknown> | null;
  result: unknown;
}) {
  const answer = value.answer ?? {},
    submittedObservation =
      typeof answer.observationAr === "string" ? answer.observationAr : null,
    submittedExplanation =
      typeof answer.explanationAr === "string" ? answer.explanationAr : null;
  return {
    observation: value.observation ?? submittedObservation ?? "",
    explanation: value.explanation ?? submittedExplanation ?? "",
    stale:
      !!value.result &&
      ((value.observation !== null &&
        submittedObservation !== null &&
        value.observation !== submittedObservation) ||
        (value.explanation !== null &&
          submittedExplanation !== null &&
          value.explanation !== submittedExplanation)),
  };
}

/** Display geometry only. Values and scientific outcomes come from NestJS. */
export function plotGeometry(points: readonly PlotPoint[]) {
  if (
    points.length < 1 ||
    points.length > 501 ||
    points.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
    )
  )
    return null;
  const xs = points.map((point) => point.x),
    ys = points.map((point) => point.y),
    xMin = Math.min(0, ...xs),
    xMax = Math.max(0, ...xs),
    yMin = Math.min(0, ...ys),
    yMax = Math.max(0, ...ys),
    xSpan = xMax - xMin || 1,
    ySpan = yMax - yMin || 1;
  const map = (point: PlotPoint) => ({
    x: 46 + ((point.x - xMin) / xSpan) * 366,
    y: 222 - ((point.y - yMin) / ySpan) * 194,
  });
  return {
    coordinates: points.map(map),
    origin: map({ x: 0, y: 0 }),
    xMin,
    xMax,
    yMin,
    yMax,
  };
}

/** Reordering preserves the original content and indentation attached to a line. */
export function moveLabLine<T>(
  lines: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const next = [...lines],
    target = index + direction;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length)
    return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export interface LabResourceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const labKey = (track: string, lesson: string, index: number) =>
  `khotwa-path:lab:${track}:${lesson}:${index}`;
export function readLabResume(
  storage: LabResourceStorage,
  track: string,
  lesson: string,
  index: number,
): string | null {
  const value = storage.getItem(labKey(track, lesson, index));
  return value && /^[a-zA-Z0-9-]{1,100}$/.test(value) ? value : null;
}
export function writeLabResume(
  storage: LabResourceStorage,
  track: string,
  lesson: string,
  index: number,
  sessionId: string,
): void {
  storage.setItem(labKey(track, lesson, index), sessionId);
}
