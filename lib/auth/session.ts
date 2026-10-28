import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STEP_UP_COOKIE_NAME, verifyStepUpCookie } from "@/lib/auth/step-up";

/**
 * Call this at the top of any Server Component or Server Action that
 * requires an authenticated, Active, step-up-verified user. Centralizes
 * the "no session -> /login, not Active -> /pending, not step-up-verified
 * -> /mfa" logic so it isn't copy-pasted across every protected route
 * (AGENTS.md Section 9: business rules / shared logic live in one place).
 *
 * proxy.ts does the same checks at the routing layer for defense in depth
 * (AGENTS.md Section 5, Rule 2: authorization enforced twice) — this
 * helper is the second, server-side check that doesn't rely on routing
 * alone.
 */
export async function requireActiveUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, must_change_password, credential_reset_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    redirect("/pending");
  }

  // DEV-02 (AGENTS.md Section 8/15): repeats proxy.ts's step-up check
  // server-side, so a protected Server Component or Server Action can't be
  // reached by skipping /mfa client-side, via a cached/prefetched route, or
  // by any other path that bypasses the routing-layer check.
  const cookieStore = await cookies();
  const stepUpCookie = cookieStore.get(STEP_UP_COOKIE_NAME)?.value;
  if (!verifyStepUpCookie(stepUpCookie, user.id, profile.credential_reset_at)) {
    redirect("/mfa");
  }

  if (profile.must_change_password) redirect("/change-password");

  return { user, profile };
}
