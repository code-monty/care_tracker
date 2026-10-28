import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireActiveUser: vi.fn(), createAdminClient: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createUserAccount, listUserAccounts, resetUserPassword, setUserStatus, updateUserAccount } from "./admin-users";

const id = "10000000-0000-0000-0000-000000000001";

describe("Admin user action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveUser.mockResolvedValue({ user: { id }, profile: { role: "staff", status: "active" } });
  });

  it("rejects direct Staff calls before any privileged client is created", async () => {
    await expect(listUserAccounts()).rejects.toThrow("Admin access required");
    await expect(createUserAccount({ fullName: "Fake User", email: "fake@example.test", role: "staff" })).rejects.toThrow("Admin access required");
    await expect(updateUserAccount({ id, fullName: "Fake User", email: "fake@example.test", role: "admin" })).rejects.toThrow("Admin access required");
    await expect(setUserStatus({ id, status: "active" })).rejects.toThrow("Admin access required");
    await expect(resetUserPassword(id)).rejects.toThrow("Admin access required");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
