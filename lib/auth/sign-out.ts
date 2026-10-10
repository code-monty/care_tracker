"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * AGENTS.md Section 9: mutations go through Server Actions that verify
 * the session, perform the change, then rely on triggers/redirects for
 * the rest. Sign-out has no role check to make (anyone with a session
 * can sign themselves out), so it's a one-step action.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
