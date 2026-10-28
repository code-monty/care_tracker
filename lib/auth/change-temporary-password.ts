"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STEP_UP_COOKIE_NAME, verifyStepUpCookie } from "@/lib/auth/step-up";
import { passwordChangeSchema } from "@/lib/validation/admin-user";

export async function changeTemporaryPassword(input: unknown): Promise<{ error?: string }> {
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the new password" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("status, must_change_password, credential_reset_at").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") redirect("/pending");
  const cookie = (await cookies()).get(STEP_UP_COOKIE_NAME)?.value;
  if (!verifyStepUpCookie(cookie, user.id, profile.credential_reset_at)) redirect("/mfa");
  if (!profile.must_change_password) redirect("/dashboard");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Unable to change password. Choose a different password and try again." };
  const { error: clearError } = await createAdminClient().rpc("complete_temporary_password", { p_user: user.id });
  if (clearError) return { error: "Password changed, but account setup could not finish. Please try again." };
  redirect("/dashboard");
}
