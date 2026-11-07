/** Editing only: never executes or evaluates learner Python in the browser. */
export function indentCode(
  raw: string,
  start: number,
  end: number,
  backwards = false,
): { raw: string; start: number; end: number } {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > raw.length
  )
    throw new Error("invalid_selection");
  if (start === end && !backwards)
    return {
      raw: raw.slice(0, start) + "    " + raw.slice(end),
      start: start + 4,
      end: start + 4,
    };
  const first = start === 0 ? 0 : raw.lastIndexOf("\n", start - 1) + 1;
  if (start === end && backwards) {
    const removed = Math.min(4, /^ */.exec(raw.slice(first))?.[0].length ?? 0);
    const caret = Math.max(first, start - removed);
    return {
      raw: raw.slice(0, first) + raw.slice(first + removed),
      start: caret,
      end: caret,
    };
  }
  const last = end > start && raw[end - 1] === "\n" ? end - 1 : end;
  const selection = raw.slice(first, last);
  const lines = selection.split("\n");
  let firstDelta = 0,
    totalDelta = 0;
  const changed = lines
    .map((line, index) => {
      const remove = backwards
        ? Math.min(4, /^ */.exec(line)?.[0].length ?? 0)
        : 0;
      const delta = backwards ? -remove : 4;
      if (index === 0) firstDelta = delta;
      totalDelta += delta;
      return backwards ? line.slice(remove) : "    " + line;
    })
    .join("\n");
  return {
    raw: raw.slice(0, first) + changed + raw.slice(last),
    start: Math.max(first, start + firstDelta),
    end: Math.max(first, end + totalDelta),
  };
}
export function continueCodeLine(
  raw: string,
  start: number,
  end: number,
): { raw: string; caret: number } {
  const first = start === 0 ? 0 : raw.lastIndexOf("\n", start - 1) + 1;
  const prefix = raw.slice(first, start);
  const indentation = /^ */.exec(prefix)?.[0] ?? "";
  const insert =
    "\n" + indentation + (prefix.trimEnd().endsWith(":") ? "    " : "");
  return {
    raw: raw.slice(0, start) + insert + raw.slice(end),
    caret: start + insert.length,
  };
}
