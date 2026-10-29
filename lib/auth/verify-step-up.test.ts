import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.getCookie, set: mocks.setCookie, delete: mocks.deleteCookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));

import { verifyStepUp } from "./verify-step-up";
import { signRememberWorkstationCookie, verifyRememberWorkstationCookie } from "./remember-workstation";
import { signGoogleRememberIntent } from "./google-remember-intent";

describe("email-code verification and workstation preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STEP_UP_SECRET = "test-secret-do-not-use-in-prod";
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.getCookie.mockReturnValue(undefined);
  });

  it("remembers the workstation only when requested after a valid code", async () => {
    await verifyStepUp({ code: "123456", rememberWorkstation: true });
    expect(mocks.setCookie).toHaveBeenCalledWith("remember_workstation", expect.any(String), expect.objectContaining({ maxAge: 86400, httpOnly: true }));
    expect(mocks.setCookie).toHaveBeenCalledWith("step_up", expect.any(String), expect.objectContaining({ maxAge: 86400 }));
  });

  it("does not remember an unchecked workstation", async () => {
    await verifyStepUp({ code: "123456", rememberWorkstation: false });
    expect(mocks.setCookie).toHaveBeenCalledTimes(1);
    expect(mocks.setCookie).toHaveBeenCalledWith("step_up", expect.any(String), expect.any(Object));
  });

  it("does not issue either cookie after an invalid code", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await verifyStepUp({ code: "123456", rememberWorkstation: true })).toEqual({ error: "Invalid or expired code." });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("automatically remembers an approved Google account after a valid code", async () => {
    mocks.getCookie.mockImplementation((name: string) => name === "google_remember_intent"
      ? { value: signGoogleRememberIntent("user-1") } : undefined);
    await verifyStepUp({ code: "123456", rememberWorkstation: false });
    expect(mocks.setCookie).toHaveBeenCalledWith("remember_workstation", expect.any(String), expect.objectContaining({ maxAge: 86400 }));
    expect(mocks.deleteCookie).toHaveBeenCalledWith("google_remember_intent");
  });

  it("does not honor another user's Google intent", async () => {
    mocks.getCookie.mockImplementation((name: string) => name === "google_remember_intent"
      ? { value: signGoogleRememberIntent("user-2") } : undefined);
    await verifyStepUp({ code: "123456", rememberWorkstation: false });
    expect(mocks.setCookie).toHaveBeenCalledTimes(1);
  });

  it("keeps another remembered account when verifying this account", async () => {
    mocks.getCookie.mockReturnValue({ value: signRememberWorkstationCookie("user-2") });
    await verifyStepUp({ code: "123456", rememberWorkstation: true });
    const rememberCall = mocks.setCookie.mock.calls.find(([name]) => name === "remember_workstation");
    expect(verifyRememberWorkstationCookie(rememberCall?.[1], "user-1")).toBe(true);
    expect(verifyRememberWorkstationCookie(rememberCall?.[1], "user-2")).toBe(true);
  });
});
