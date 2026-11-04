import {
  closeSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute } from "node:path";

export interface GeminiQuotaConfig {
  ledgerPath: string;
  roundLimit: number;
  dailyRemaining: number | null;
  validUntil: number;
  model: string;
}
interface Ledger {
  version: 1;
  model: string;
  roundLimit: number;
  dailyRemaining: number | null;
  validUntil: number;
  calls: number[];
}
/** One exclusive local runtime/round. Reservations survive restart and failed HTTP.
 * A crashed runtime leaves its lock: operator must verify it has stopped before
 * removing the lock, retaining the ledger. Never resets/replenishes automatically.
 */
export class GeminiQuota {
  private readonly lock: number;
  private ledger: Ledger;
  private closed = false;
  constructor(
    readonly config: GeminiQuotaConfig,
    readonly now = Date.now,
  ) {
    if (
      !isAbsolute(config.ledgerPath) ||
      !Number.isSafeInteger(config.roundLimit) ||
      config.roundLimit < 10 ||
      config.roundLimit > 15 ||
      (config.dailyRemaining !== null &&
        (!Number.isSafeInteger(config.dailyRemaining) ||
          config.dailyRemaining < 1)) ||
      !Number.isSafeInteger(config.validUntil) ||
      config.validUntil <= now()
    )
      throw Error("GEMINI_QUOTA_CONFIGURATION_REQUIRED");
    this.lock = openSync(config.ledgerPath + ".lock", "wx", 0o600);
    try {
      const initial: Ledger = {
        version: 1,
        model: config.model,
        roundLimit: config.roundLimit,
        dailyRemaining: config.dailyRemaining,
        validUntil: config.validUntil,
        calls: [],
      };
      let ledger: unknown;
      try {
        ledger = JSON.parse(readFileSync(config.ledgerPath, "utf8"));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT")
          throw Error("GEMINI_QUOTA_LEDGER_INVALID", { cause: e });
        ledger = initial;
      }
      const l = ledger as Ledger;
      if (
        !l ||
        Object.keys(l).sort().join() !== Object.keys(initial).sort().join() ||
        l.version !== 1 ||
        l.model !== initial.model ||
        l.roundLimit !== initial.roundLimit ||
        l.dailyRemaining !== initial.dailyRemaining ||
        l.validUntil !== initial.validUntil ||
        !Array.isArray(l.calls) ||
        l.calls.length > config.roundLimit ||
        l.calls.some(
          (n, i) =>
            !Number.isSafeInteger(n) ||
            n < 0 ||
            n > now() ||
            (i > 0 && n < l.calls[i - 1]!),
        )
      )
        throw Error("GEMINI_QUOTA_LEDGER_INVALID");
      this.ledger = l;
      this.save();
    } catch {
      closeSync(this.lock);
      unlinkSync(config.ledgerPath + ".lock");
      throw Error("GEMINI_QUOTA_LEDGER_INVALID");
    }
  }
  private save() {
    writeFileSync(
      this.config.ledgerPath + ".tmp",
      JSON.stringify(this.ledger),
      { mode: 0o600 },
    );
    renameSync(this.config.ledgerPath + ".tmp", this.config.ledgerPath);
  }
  reserve(): void {
    const now = this.now(),
      calls = this.ledger.calls;
    if (
      this.closed ||
      now >= this.config.validUntil ||
      (calls.at(-1) ?? 0) > now
    )
      throw Error("GEMINI_QUOTA_EXPIRED");
    if (
      calls.length >=
      Math.min(
        this.config.roundLimit,
        this.config.dailyRemaining ?? this.config.roundLimit,
      )
    )
      throw Error("GEMINI_ROUND_OR_DAILY_LIMIT");
    if (calls.filter((t) => now - t < 60000).length >= 10)
      throw Error("GEMINI_ROLLING_LIMIT");
    calls.push(now);
    // If persistence fails, no network call takes place; reservation stays spent.
    this.save();
  }
  get spent() {
    return this.ledger.calls.length;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    closeSync(this.lock);
    unlinkSync(this.config.ledgerPath + ".lock");
  }
}
