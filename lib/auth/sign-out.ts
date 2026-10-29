"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { STEP_UP_COOKIE_NAME } from "@/lib/auth/step-up";
import { GOOGLE_REMEMBER_INTENT_COOKIE_NAME } from "@/lib/auth/google-remember-intent";
import { recordAuthEvent } from "@/lib/auth/audit-event";

/**
 * AGENTS.md Section 9: mutations go through Server Actions that verify
 * the session, perform the change, then rely on triggers/redirects for
 * the rest. Sign-out has no role check to make (anyone with a session
 * can sign themselves out), so it's a one-step action.
 */
export async function signOut() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await recordAuthEvent(user.id, "logout");
  await supabase.auth.signOut();
  (await cookies()).delete(STEP_UP_COOKIE_NAME);
  (await cookies()).delete(GOOGLE_REMEMBER_INTENT_COOKIE_NAME);
  redirect("/login");
}
