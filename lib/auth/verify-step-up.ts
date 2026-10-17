"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stepUpSchema } from "@/lib/validation/step-up";
import {
  STEP_UP_COOKIE_NAME,
  STEP_UP_MAX_AGE_MS,
  signStepUpCookie,
} from "@/lib/auth/step-up";
import { REMEMBER_WORKSTATION_COOKIE_NAME, REMEMBER_WORKSTATION_MAX_AGE_MS, signRememberWorkstationCookie } from "@/lib/auth/remember-workstation";
import { GOOGLE_REMEMBER_INTENT_COOKIE_NAME, verifyGoogleRememberIntent } from "@/lib/auth/google-remember-intent";

const GENERIC_ERROR = "Invalid or expired code.";

/**
 * DEV-02 (AGENTS.md Section 8/15): verifies the 6-digit code entered on
 * /mfa. On success, sets the signed step-up cookie and redirects to
 * /dashboard. On failure, returns ONE generic error regardless of why
 * verify_step_up_code() returned false (wrong code, expired, attempt
 * limit reached) — the same "never reveal why" philosophy AGENTS.md
 * Section 8 applies to login errors applies here too.
 */
export async function verifyStepUp(input: { code: string; rememberWorkstation?: boolean }): Promise<{ error?: string }> {
  const parsed = stepUpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: verified, error } = await supabase.rpc("verify_step_up_code", {
    p_user_id: user.id,
    p_code: parsed.data.code,
  });

  if (error || !verified) {
    return { error: GENERIC_ERROR };
  }

  const cookieStore = await cookies();
  const googleRememberIntent = cookieStore.get(GOOGLE_REMEMBER_INTENT_COOKIE_NAME)?.value;
  cookieStore.set(STEP_UP_COOKIE_NAME, signStepUpCookie(user.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    // Matches STEP_UP_MAX_AGE_MS (AGENTS.md Section 8's 10-minute idle
    // timeout) so the browser never holds onto a cookie the server-side
    // verifyStepUpCookie() check would already consider expired.
    maxAge: STEP_UP_MAX_AGE_MS / 1000,
    path: "/",
  });

  if (input.rememberWorkstation === true || verifyGoogleRememberIntent(googleRememberIntent, user.id)) {
    const existing = cookieStore.get(REMEMBER_WORKSTATION_COOKIE_NAME)?.value;
    cookieStore.set(REMEMBER_WORKSTATION_COOKIE_NAME, signRememberWorkstationCookie(user.id, existing), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: REMEMBER_WORKSTATION_MAX_AGE_MS / 1000,
      path: "/",
    });
  }
  cookieStore.delete(GOOGLE_REMEMBER_INTENT_COOKIE_NAME);

  redirect("/dashboard");
}
