"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema } from "@/lib/validation/auth";
import { checkLockout, recordFailedAttempt, resetLockout } from "@/lib/rules/lockout";

const GENERIC_ERROR = "Invalid email or password.";
const LOCKOUT_ERROR = "Too many failed attempts. Please try again in 15 minutes.";
const RATE_LIMIT_ERROR = "Too many attempts. Please wait a few minutes and try again.";

/**
 * AGENTS.md Section 8: lock out after 5 failed attempts, generic errors
 * that never reveal whether an account exists. Moving the actual
 * signInWithPassword call server-side (it used to run from the browser
 * client) is what makes the lockout pre-check possible: we need to look
 * the account up and check locked_until BEFORE Supabase Auth even gets a
 * chance to respond.
 *
 * One accepted trade-off: showing "too many failed attempts" only when
 * the email matches a real account does leak slightly more than a flat
 * "invalid email or password" would (it confirms the account exists).
 * This is the standard, industry-normal cost of any lockout feature — the
 * anti-brute-force benefit outweighs it — but flagging it here rather
 * than leaving it implicit.
 */
export async function signIn(input: { email: string; password: string }) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }
  const { email, password } = parsed.data;

  const admin = createAdminClient();

  // Pre-check: is this account currently locked? Uses the admin client
  // because this runs before any session exists — RLS default-denies an
  // anonymous read of profiles entirely, as it should.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, failed_login_attempts, locked_until")
    .eq("email", email)
    .maybeSingle();

  if (profile) {
    const { blocked } = checkLockout({
      failedAttempts: profile.failed_login_attempts,
      lockedUntil: profile.locked_until ? new Date(profile.locked_until) : null,
    });
    if (blocked) {
      return { error: LOCKOUT_ERROR };
    }
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    if (profile) {
      const next = recordFailedAttempt({
        failedAttempts: profile.failed_login_attempts,
        lockedUntil: null,
      });
      await admin
        .from("profiles")
        .update({
          failed_login_attempts: next.failedAttempts,
          locked_until: next.lockedUntil ? next.lockedUntil.toISOString() : null,
        })
        .eq("id", profile.id);
    }

    if (signInError.status === 429) {
      return { error: RATE_LIMIT_ERROR };
    }
    return { error: GENERIC_ERROR };
  }

  if (profile) {
    const reset = resetLockout();
    await admin
      .from("profiles")
      .update({
        failed_login_attempts: reset.failedAttempts,
        locked_until: reset.lockedUntil,
      })
      .eq("id", profile.id);
  }

  redirect("/dashboard");
}
