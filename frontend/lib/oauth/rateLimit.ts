import { getRecord, putRecord } from "./store";
import type { LoginAttemptState } from "./types";

/**
 * Brute-force protection for the owner sign-in screen (FR-013, data-model.md
 * LoginAttemptState). One record protects the one OwnerCredential — best
 * effort, non-atomic read-check-then-write is an accepted trade-off for a
 * single-legitimate-user login form (research.md §3).
 */
const KEY = "login-attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

async function readState(): Promise<LoginAttemptState> {
  return (
    (await getRecord<LoginAttemptState>(KEY)) ?? {
      failedAttempts: 0,
      lockedUntil: null,
      lastAttemptAt: null,
    }
  );
}

/** Returns the lockout timestamp if currently locked out, otherwise `null`. */
export async function checkLoginLockout(): Promise<string | null> {
  const state = await readState();
  if (state.lockedUntil && new Date(state.lockedUntil).getTime() > Date.now()) {
    return state.lockedUntil;
  }
  return null;
}

export async function recordLoginFailure(): Promise<void> {
  const state = await readState();
  const failedAttempts = state.failedAttempts + 1;
  const lockedUntil =
    failedAttempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : state.lockedUntil;

  await putRecord<LoginAttemptState>(KEY, {
    failedAttempts,
    lockedUntil,
    lastAttemptAt: new Date().toISOString(),
  });
}

export async function recordLoginSuccess(): Promise<void> {
  await putRecord<LoginAttemptState>(KEY, {
    failedAttempts: 0,
    lockedUntil: null,
    lastAttemptAt: new Date().toISOString(),
  });
}
