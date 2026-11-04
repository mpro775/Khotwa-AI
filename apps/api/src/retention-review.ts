/** Read-only review of owner policy OWN-11 / doc16 §15. No deletion or scheduler. */
export function retentionReview(
  input: { expiresAt: Date; lastSeenAt: Date; revokedAt: Date | null },
  at: Date,
) {
  const times = [
    input.expiresAt.getTime(),
    input.lastSeenAt.getTime() + 2 * 60 * 60 * 1000,
    ...(input.revokedAt ? [input.revokedAt.getTime()] : []),
  ];
  if ([...times, at.getTime()].some((n) => !Number.isFinite(n)))
    throw Error("Valid retention dates required");
  const effectiveEnd = Math.min(...times),
    eligibleAt = effectiveEnd + 7 * 24 * 60 * 60 * 1000;
  return {
    effectiveEnd: new Date(effectiveEnd).toISOString(),
    eligibleAt: new Date(eligibleAt).toISOString(),
    eligible: at.getTime() >= eligibleAt,
    action: "review_only_no_deletion" as const,
  };
}
