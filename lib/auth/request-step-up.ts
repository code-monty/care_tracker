"use server";

import { createClient } from "@/lib/supabase/server";
import { sendStepUpCodeEmail } from "@/lib/email/send-step-up-code";

const GENERIC_ERROR = "Could not send a verification code. Please try again.";

/**
 * DEV-02 (AGENTS.md Section 8/15): issues a fresh 6-digit step-up code for
 * the current session's user and emails it. Called when /mfa first loads,
 * and again by its resend action.
 *
 * Uses the session-scoped client (lib/supabase/server.ts), NOT the admin
 * client — request_step_up_code() checks auth.uid() = p_user_id itself
 * (migration 20261011010000_step_up_codes.sql), and that guard only means
 * anything if the call carries the real session's auth context rather than
 * the service role, which would bypass it entirely.
 */
export async function requestStepUp(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Not signed in." };
  }

  const { data: code, error } = await supabase.rpc("request_step_up_code", {
    p_user_id: user.id,
  });

  if (error || !code) {
    return { error: GENERIC_ERROR };
  }

  try {
    await sendStepUpCodeEmail(user.email, code);
  } catch {
    // The code is already stored (hashed) in the DB regardless of whether
    // the send succeeded. A generic error here just tells the user to
    // retry — request_step_up_code() invalidates the unsent code and
    // issues a fresh one on the next call, so nothing is left dangling.
    return { error: GENERIC_ERROR };
  }

  // `code` itself is never logged or persisted anywhere outside this
  // function call, per AGENTS.md Section 8 ("never log sensitive values").

  return {};
}
