import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STEP_UP_COOKIE_NAME, verifyStepUpCookie } from "@/lib/auth/step-up";
import { AuthCard } from "../auth-card";
import { ChangePasswordForm } from "./password-form";
import card from "../auth-card.module.css";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("status, must_change_password, credential_reset_at").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") redirect("/pending");
  const cookie = (await cookies()).get(STEP_UP_COOKIE_NAME)?.value;
  if (!verifyStepUpCookie(cookie, user.id, profile.credential_reset_at)) redirect("/mfa");
  if (!profile.must_change_password) redirect("/dashboard");
  return <AuthCard>
    <h1 className={card.title}>Set your password</h1>
    <p className={card.description}>Your temporary password must be replaced before you can use CareTracker.</p>
    <ChangePasswordForm />
  </AuthCard>;
}
