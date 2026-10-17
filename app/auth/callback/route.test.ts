import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn(), lookup: vi.fn(), deleteCookie: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ delete: mocks.deleteCookie }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange, signOut: mocks.signOut } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }) }),
  auth: { admin: { deleteUser: mocks.deleteUser } },
}) }));

import { GET } from "./route";

const user = {
  id: "account-1", email: "staff@example.com", created_at: new Date().toISOString(),
  identities: [{ provider: "google" }],
};

function request(query: string) {
  return { url: `http://localhost:3000/auth/callback${query}`, nextUrl: new URL(`http://localhost:3000/auth/callback${query}`) } as never;
}

describe("Google OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchange.mockResolvedValue({ data: { user }, error: null });
    mocks.lookup.mockResolvedValue({ data: { id: user.id, email: user.email, status: "active", locked_until: null }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
  });

  it("sends an existing active Google user to email-code verification", async () => {
    const response = await GET(request("?code=valid"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/mfa");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.deleteCookie).toHaveBeenCalled();
  });

  it("rejects missing and invalid codes without granting a session", async () => {
    expect((await GET(request(""))).headers.get("location")).toContain("/login?error=google");
    expect(mocks.exchange).not.toHaveBeenCalled();
    mocks.exchange.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    expect((await GET(request("?code=invalid"))).headers.get("location")).toContain("/login?error=google");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("rejects a new pending Google identity and removes it", async () => {
    mocks.lookup.mockResolvedValue({ data: { id: user.id, email: user.email, status: "pending" }, error: null });
    const response = await GET(request("?code=valid"));
    expect(response.headers.get("location")).toContain("/login?error=google");
    expect(mocks.deleteUser).toHaveBeenCalledWith(user.id);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("rejects disabled accounts without deleting an existing linked identity", async () => {
    mocks.exchange.mockResolvedValue({ data: { user: { ...user, identities: [{ provider: "email" }, { provider: "google" }] } }, error: null });
    mocks.lookup.mockResolvedValue({ data: { id: user.id, email: user.email, status: "disabled" }, error: null });
    const response = await GET(request("?code=valid"));
    expect(response.headers.get("location")).toContain("/login?error=google");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
