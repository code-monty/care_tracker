import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(), getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn(),
  redirect: vi.fn(), lookup: vi.fn(), update: vi.fn(), audit: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.getCookie, set: mocks.setCookie, delete: mocks.deleteCookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithPassword: mocks.signIn } }) }));
vi.mock("@/lib/auth/audit-event", () => ({ recordAuthEvent: mocks.audit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }),
    update: () => ({ eq: mocks.update }),
  }),
}) }));

import { signIn } from "./sign-in";
import { signRememberWorkstationCookie } from "./remember-workstation";

const input = { email: "staff@example.com", password: "ValidPassword123" };

describe("password sign-in with remembered workstation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STEP_UP_SECRET = "test-secret-do-not-use-in-prod";
    mocks.lookup.mockResolvedValue({ data: null });
    mocks.signIn.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.getCookie.mockReturnValue(undefined);
  });

  it("issues a fresh 10-minute step-up cookie after successful sign-in for the remembered user", async () => {
    mocks.getCookie.mockReturnValue({ value: signRememberWorkstationCookie("user-1") });
    await signIn(input);
    expect(mocks.setCookie).toHaveBeenCalledWith("step_up", expect.any(String), expect.objectContaining({ maxAge: 600 }));
    expect(mocks.deleteCookie).toHaveBeenCalledWith("google_remember_intent");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
    expect(mocks.audit).toHaveBeenCalledWith("user-1", "login");
  });

  it("requires email-code verification when the remembered cookie belongs to another user", async () => {
    mocks.getCookie.mockReturnValue({ value: signRememberWorkstationCookie("user-2") });
    await signIn(input);
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("step_up");
  });

  it("requires email-code verification when a password reset is newer than remembered trust", async () => {
    mocks.getCookie.mockReturnValue({ value: signRememberWorkstationCookie("user-1") });
    mocks.lookup.mockResolvedValue({ data: { id: "user-1", failed_login_attempts: 0, locked_until: null, must_change_password: false, credential_reset_at: new Date(Date.now() + 1_000).toISOString() } });
    await signIn(input);
    expect(mocks.setCookie).not.toHaveBeenCalledWith("step_up", expect.any(String), expect.any(Object));
    expect(mocks.deleteCookie).toHaveBeenCalledWith("step_up");
  });

  it("does not use the remembered cookie when the password is wrong", async () => {
    mocks.getCookie.mockReturnValue({ value: signRememberWorkstationCookie("user-1") });
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { status: 400 } });
    expect(await signIn(input)).toEqual({ error: "Invalid email or password." });
    expect(mocks.audit).toHaveBeenCalledWith(null, "failed_login");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
