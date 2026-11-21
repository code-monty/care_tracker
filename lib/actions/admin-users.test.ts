import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  sendTemporaryPasswordEmail: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/email/send-temporary-password", () => ({ sendTemporaryPasswordEmail: mocks.sendTemporaryPasswordEmail }));
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

  it("rejects direct Secretary calls before any privileged client is created", async () => {
    mocks.requireActiveUser.mockResolvedValue({ user: { id }, profile: { role: "secretary", status: "active" } });
    await expect(listUserAccounts()).rejects.toThrow("Admin access required");
    await expect(createUserAccount({ fullName: "Fake User", email: "fake@example.test", role: "secretary" })).rejects.toThrow("Admin access required");
    await expect(updateUserAccount({ id, fullName: "Fake User", email: "fake@example.test", role: "admin" })).rejects.toThrow("Admin access required");
    await expect(setUserStatus({ id, status: "active" })).rejects.toThrow("Admin access required");
    await expect(resetUserPassword(id)).rejects.toThrow("Admin access required");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("emails a random 10-character temporary password to the user without returning it to Admin", async () => {
    const adminId = "10000000-0000-4000-8000-000000000002";
    const targetId = "10000000-0000-4000-8000-000000000003";
    mocks.requireActiveUser.mockResolvedValue({ user: { id: adminId }, profile: { role: "admin", status: "active" } });
    mocks.sendTemporaryPasswordEmail.mockResolvedValue(undefined);

    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: targetId } }, error: null });
    const updateUserById = vi.fn().mockResolvedValue({ data: { user: { id: targetId } }, error: null });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { createUser, updateUserById } },
      rpc,
    });
    mocks.createClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { full_name: "Fake User", email: "fake@example.test", role: "staff", status: "active" },
              error: null,
            }),
          }),
        }),
      }),
    });

    const created = await createUserAccount({ fullName: "Fake User", email: "fake@example.test", role: "staff" });
    const reset = await resetUserPassword(targetId);

    expect(created).toEqual({});
    expect(reset).toEqual({});
    expect("password" in created).toBe(false);
    expect("password" in reset).toBe(false);

    const createdPassword = createUser.mock.calls[0]?.[0]?.password as string;
    const resetPassword = updateUserById.mock.calls[0]?.[1]?.password as string;
    expect(createdPassword).toMatch(/^[A-HJ-NP-Za-km-z2-9!@#$%]{10}$/);
    expect(resetPassword).toMatch(/^[A-HJ-NP-Za-km-z2-9!@#$%]{10}$/);
    expect(createdPassword).not.toBe("123456");
    expect(resetPassword).not.toBe("123456");
    expect(createdPassword).not.toBe(resetPassword);
    expect(mocks.sendTemporaryPasswordEmail).toHaveBeenNthCalledWith(1, "fake@example.test", createdPassword, "created");
    expect(mocks.sendTemporaryPasswordEmail).toHaveBeenNthCalledWith(2, "fake@example.test", resetPassword, "reset");
  });
});
