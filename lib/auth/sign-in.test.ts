import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(), getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn(),
  redirect: vi.fn(), lookup: vi.fn(), update: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.getCookie, set: mocks.setCookie, delete: mocks.deleteCookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithPassword: mocks.signIn } }) }));
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
  });

  it("requires email-code verification when the remembered cookie belongs to another user", async () => {
    mocks.getCookie.mockReturnValue({ value: signRememberWorkstationCookie("user-2") });
    await signIn(input);
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("step_up");
  });

  it("does not use the remembered cookie when the password is wrong", async () => {
    mocks.getCookie.mockReturnValue({ value: signRememberWorkstationCookie("user-1") });
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { status: 400 } });
    expect(await signIn(input)).toEqual({ error: "Invalid email or password." });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
