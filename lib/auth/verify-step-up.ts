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

const GENERIC_ERROR = "Invalid or expired code.";

/**
 * DEV-02 (AGENTS.md Section 8/15): verifies the 6-digit code entered on
 * /mfa. On success, sets the signed step-up cookie and redirects to
 * /dashboard. On failure, returns ONE generic error regardless of why
 * verify_step_up_code() returned false (wrong code, expired, attempt
 * limit reached) — the same "never reveal why" philosophy AGENTS.md
 * Section 8 applies to login errors applies here too.
 */
export async function verifyStepUp(input: { code: string }): Promise<{ error?: string }> {
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

  redirect("/dashboard");
}
