import { describe, expect, it } from "vitest";
import { isApprovedGoogleUser, isDisposableGoogleSignup, normalizeEmail } from "./google-eligibility";

const user = { id: "account-1", email: " Staff@Example.com ", identities: [{ provider: "google", identity_data: { email: "staff@example.com" } }] };
const profile = { id: "account-1", email: "staff@example.com", status: "active" };

describe("Google account eligibility", () => {
  it("normalizes email case and whitespace", () => {
    expect(normalizeEmail(" Staff@Example.com ")).toBe("staff@example.com");
    expect(isApprovedGoogleUser(user as never, profile)).toBe(true);
  });

  it("rejects unknown, pending, disabled, mismatched, and non-Google accounts", () => {
    expect(isApprovedGoogleUser(user as never, null)).toBe(false);
    expect(isApprovedGoogleUser(user as never, { ...profile, status: "pending" })).toBe(false);
    expect(isApprovedGoogleUser(user as never, { ...profile, status: "disabled" })).toBe(false);
    expect(isApprovedGoogleUser(user as never, { ...profile, locked_until: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
    expect(isApprovedGoogleUser(user as never, { ...profile, id: "another-account" })).toBe(false);
    expect(isApprovedGoogleUser(user as never, { ...profile, email: "other@example.com" })).toBe(false);
    expect(isApprovedGoogleUser({ ...user, identities: [{ provider: "google", identity_data: { email: "old@example.com" } }] } as never, profile)).toBe(false);
    expect(isApprovedGoogleUser({ ...user, identities: [{ provider: "email" }] } as never, profile)).toBe(false);
  });

  it("limits cleanup to fresh pending Google-only users", () => {
    const fresh = { created_at: new Date().toISOString(), identities: [{ provider: "google" }] };
    expect(isDisposableGoogleSignup(fresh as never, { status: "pending" })).toBe(true);
    expect(isDisposableGoogleSignup(fresh as never, { status: "active" })).toBe(false);
    expect(isDisposableGoogleSignup({ ...fresh, identities: [{ provider: "google" }, { provider: "email" }] } as never, { status: "pending" })).toBe(false);
    expect(isDisposableGoogleSignup({ ...fresh, created_at: new Date(Date.now() - 300_000).toISOString() } as never, { status: "pending" })).toBe(false);
  });
});
