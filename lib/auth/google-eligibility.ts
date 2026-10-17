import type { User } from "@supabase/supabase-js";

export function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function isApprovedGoogleUser(
  user: Pick<User, "id" | "email" | "identities">,
  profile: { id: string; email: string | null; status: string; locked_until?: string | null } | null,
): boolean {
  const email = normalizeEmail(user.email);
  return Boolean(
    email &&
      user.identities?.some((identity) => identity.provider === "google") &&
      profile?.id === user.id &&
      profile.status === "active" &&
      (!profile.locked_until || Date.parse(profile.locked_until) <= Date.now()) &&
      normalizeEmail(profile.email) === email,
  );
}

export function isDisposableGoogleSignup(
  user: Pick<User, "created_at" | "identities">,
  profile: { status: string } | null,
  now = Date.now(),
): boolean {
  const createdAt = Date.parse(user.created_at);
  return Boolean(
    profile?.status === "pending" &&
      user.identities?.length === 1 &&
      user.identities[0].provider === "google" &&
      Number.isFinite(createdAt) &&
      createdAt <= now &&
      now - createdAt < 2 * 60 * 1000,
  );
}
