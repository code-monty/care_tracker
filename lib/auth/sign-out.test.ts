import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), getUser: vi.fn(), audit: vi.fn(), deleteCookie: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: mocks.deleteCookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut: mocks.signOut, getUser: mocks.getUser } }) }));
vi.mock("@/lib/auth/audit-event", () => ({ recordAuthEvent: mocks.audit }));

import { signOut } from "./sign-out";

describe("sign-out", () => {
  it("clears the active step-up cookie but retains remembered workstation status", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    await signOut();
    expect(mocks.audit).toHaveBeenCalledWith("user-1", "logout");
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("step_up");
    expect(mocks.deleteCookie).not.toHaveBeenCalledWith("remember_workstation");
  });
});
