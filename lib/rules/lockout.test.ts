import { describe, expect, it } from "vitest";
import {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  checkLockout,
  recordFailedAttempt,
  resetLockout,
} from "./lockout";

describe("checkLockout", () => {
  it("is not blocked when locked_until is null", () => {
    expect(checkLockout({ failedAttempts: 3, lockedUntil: null }).blocked).toBe(false);
  });

  it("is blocked when locked_until is in the future", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const lockedUntil = new Date("2026-01-01T12:10:00Z");
    expect(checkLockout({ failedAttempts: 0, lockedUntil }, now).blocked).toBe(true);
  });

  it("is not blocked once locked_until has passed", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const lockedUntil = new Date("2026-01-01T11:59:59Z");
    expect(checkLockout({ failedAttempts: 0, lockedUntil }, now).blocked).toBe(false);
  });
});

describe("recordFailedAttempt", () => {
  it("increments the counter below the threshold", () => {
    const next = recordFailedAttempt({ failedAttempts: 1, lockedUntil: null });
    expect(next).toEqual({ failedAttempts: 2, lockedUntil: null });
  });

  it("locks the account on reaching the threshold and resets the counter", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const next = recordFailedAttempt(
      { failedAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null },
      now,
    );
    expect(next.failedAttempts).toBe(0);
    expect(next.lockedUntil).toEqual(new Date(now.getTime() + LOCKOUT_DURATION_MS));
  });
});

describe("resetLockout", () => {
  it("clears both fields", () => {
    expect(resetLockout()).toEqual({ failedAttempts: 0, lockedUntil: null });
  });
});
