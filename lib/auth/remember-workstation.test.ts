import { beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { REMEMBER_WORKSTATION_MAX_AGE_MS, signRememberWorkstationCookie, verifyRememberWorkstationCookie } from "./remember-workstation";
import { signStepUpCookie } from "./step-up";

beforeAll(() => { process.env.STEP_UP_SECRET = "test-secret-do-not-use-in-prod"; });

describe("remembered workstation", () => {
  it("accepts the same user for one day and rejects another user", () => {
    const cookie = signRememberWorkstationCookie("user-1");
    expect(verifyRememberWorkstationCookie(cookie, "user-1")).toBe(true);
    expect(verifyRememberWorkstationCookie(cookie, "user-2")).toBe(false);
  });

  it("rejects tampering and step-up cookies", () => {
    const cookie = signRememberWorkstationCookie("user-1");
    expect(verifyRememberWorkstationCookie(`${cookie}x`, "user-1")).toBe(false);
    expect(verifyRememberWorkstationCookie(signStepUpCookie("user-1"), "user-1")).toBe(false);
  });

  it("does not trust a remembered entry created before a password reset", () => {
    const rememberedAt = Date.now();
    const cookie = signRememberWorkstationCookie("user-1");
    expect(verifyRememberWorkstationCookie(cookie, "user-1", new Date(rememberedAt + 1_000).toISOString())).toBe(false);
    expect(verifyRememberWorkstationCookie(cookie, "user-1", new Date(rememberedAt - 1_000).toISOString())).toBe(true);
  });

  it("expires after 24 hours without extending its original issue time", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-17T00:00:00Z"));
      const cookie = signRememberWorkstationCookie("user-1");
      vi.advanceTimersByTime(REMEMBER_WORKSTATION_MAX_AGE_MS - 1);
      expect(verifyRememberWorkstationCookie(cookie, "user-1")).toBe(true);
      vi.advanceTimersByTime(2);
      expect(verifyRememberWorkstationCookie(cookie, "user-1")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps separate expiry times when another account is remembered", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-17T00:00:00Z"));
      const first = signRememberWorkstationCookie("user-1");
      vi.advanceTimersByTime(60 * 60 * 1000);
      const both = signRememberWorkstationCookie("user-2", first);
      expect(verifyRememberWorkstationCookie(both, "user-1")).toBe(true);
      expect(verifyRememberWorkstationCookie(both, "user-2")).toBe(true);
      vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 1);
      expect(verifyRememberWorkstationCookie(both, "user-1")).toBe(false);
      expect(verifyRememberWorkstationCookie(both, "user-2")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts and upgrades the original single-account cookie", () => {
    const payload = Buffer.from(JSON.stringify({ userId: "user-1", rememberedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", process.env.STEP_UP_SECRET!).update(`remember-workstation:${payload}`).digest("hex");
    const legacy = `${payload}.${signature}`;
    expect(verifyRememberWorkstationCookie(legacy, "user-1")).toBe(true);
    const both = signRememberWorkstationCookie("user-2", legacy);
    expect(verifyRememberWorkstationCookie(both, "user-1")).toBe(true);
    expect(verifyRememberWorkstationCookie(both, "user-2")).toBe(true);
  });
});
