/**
 * Login lockout rule (AGENTS.md Section 8: lock out after 5 failed
 * attempts). Pure functions only — no I/O — so they're unit-testable
 * without mocking Supabase. lib/auth/sign-in.ts calls these and persists
 * the result via the service-role client.
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LockoutState {
  failedAttempts: number;
  lockedUntil: Date | null;
}

/** Call before attempting sign-in, using the state already on the row. */
export function checkLockout(
  state: LockoutState,
  now: Date = new Date(),
): { blocked: boolean } {
  return {
    blocked: state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime(),
  };
}

/** Call after a successful sign-in to clear the counters. */
export function resetLockout(): LockoutState {
  return { failedAttempts: 0, lockedUntil: null };
}

/**
 * Call after a failed sign-in attempt. Returns the next state to persist.
 * On hitting the threshold, the counter resets to 0 and locked_until is
 * set — so once the lock expires, the account gets a fresh 5 attempts
 * rather than re-locking on the very next try.
 */
export function recordFailedAttempt(
  state: LockoutState,
  now: Date = new Date(),
): LockoutState {
  const nextAttempts = state.failedAttempts + 1;

  if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      failedAttempts: 0,
      lockedUntil: new Date(now.getTime() + LOCKOUT_DURATION_MS),
    };
  }

  return { failedAttempts: nextAttempts, lockedUntil: null };
}
