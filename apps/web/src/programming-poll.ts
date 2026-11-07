export const isPendingExecution = (status: string): boolean =>
  status === "queued" || status === "running";

/** Read the same owned attempt; never dispatch another execution when a result is pending. */
export async function pollExecution<T extends { status: string }>(
  load: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  onResult: (result: T) => void,
  intervalMs = 750,
): Promise<"finished" | "aborted"> {
  while (!signal.aborted) {
    let result: T;
    try {
      result = await load(signal);
    } catch (error) {
      if (signal.aborted) return "aborted";
      throw error;
    }
    if (signal.aborted) return "aborted";
    onResult(result);
    if (!isPendingExecution(result.status)) return "finished";
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, intervalMs);
      signal.addEventListener("abort", done, { once: true });
      if (signal.aborted) done();
    });
  }
  return "aborted";
}
