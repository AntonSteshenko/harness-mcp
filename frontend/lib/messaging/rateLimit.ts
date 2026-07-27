import type { MessagingConfig } from "./config";
import { MessagingError } from "./errors";
import { getRecord, putRecord } from "./store";

/**
 * Shared fixed-window counter (data-model.md Rate Limit State) enforcing
 * spec.md FR-011 across both send_email and send_telegram_message. Best
 * effort, non-atomic read-check-then-write — the same accepted trade-off as
 * lib/oauth/rateLimit.ts's login-attempt tracking (research.md §3).
 */
interface RateLimitState {
  windowStart: string;
  count: number;
}

const KEY = "rate-limit";

/**
 * Checks the shared rate limit and records one more send against it. Throws
 * a `rate_limited` MessagingError (without recording) if the limit for the
 * current window has already been reached; otherwise increments the count
 * and persists it before returning.
 */
export async function checkAndRecordSend(config: MessagingConfig): Promise<void> {
  const now = Date.now();
  const existing = await getRecord<RateLimitState>(KEY);

  let state: RateLimitState;
  if (!existing || now - new Date(existing.windowStart).getTime() >= config.rateLimitWindowMinutes * 60 * 1000) {
    state = { windowStart: new Date(now).toISOString(), count: 0 };
  } else {
    state = existing;
  }

  if (state.count >= config.rateLimitMax) {
    throw new MessagingError(
      "rate_limited",
      `Send rate limit reached (${config.rateLimitMax} per ${config.rateLimitWindowMinutes} minutes); try again later`,
    );
  }

  await putRecord<RateLimitState>(KEY, { windowStart: state.windowStart, count: state.count + 1 });
}
