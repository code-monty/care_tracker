import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Call this at the top of any Server Component or Server Action that
 * requires an authenticated, Active user. Centralizes the
 * "no session -> /login, not Active -> /pending" logic so it isn't
 * copy-pasted across every protected route (AGENTS.md Section 9:
 * business rules / shared logic live in one place).
 *
 * proxy.ts does the same check at the routing layer for defense in depth
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
    .select("id, full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    redirect("/pending");
  }

  return { user, profile };
}
