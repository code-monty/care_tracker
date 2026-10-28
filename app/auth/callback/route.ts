import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STEP_UP_COOKIE_NAME } from "@/lib/auth/step-up";
import { isApprovedGoogleUser, isDisposableGoogleSignup } from "@/lib/auth/google-eligibility";
import { REMEMBER_WORKSTATION_COOKIE_NAME, verifyRememberWorkstationCookie } from "@/lib/auth/remember-workstation";
import { STEP_UP_MAX_AGE_MS, signStepUpCookie } from "@/lib/auth/step-up";
import { GOOGLE_REMEMBER_INTENT_COOKIE_NAME, GOOGLE_REMEMBER_INTENT_MAX_AGE_MS, signGoogleRememberIntent } from "@/lib/auth/google-remember-intent";

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login?error=google", request.url);
  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    await supabase.auth.signOut();
    return NextResponse.redirect(loginUrl);
  }

  const user = data.user;
  const admin = createAdminClient();
  const { data: profile, error: lookupError } = await admin
    .from("profiles")
    .select("id, email, status, locked_until, must_change_password, credential_reset_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!lookupError && isApprovedGoogleUser(user, profile)) {
    const cookieStore = await cookies();
    cookieStore.delete(GOOGLE_REMEMBER_INTENT_COOKIE_NAME);
    if (!profile?.must_change_password && verifyRememberWorkstationCookie(cookieStore.get(REMEMBER_WORKSTATION_COOKIE_NAME)?.value, user.id, profile?.credential_reset_at)) {
      cookieStore.set(STEP_UP_COOKIE_NAME, signStepUpCookie(user.id), {
        httpOnly: true, secure: true, sameSite: "lax", maxAge: STEP_UP_MAX_AGE_MS / 1000, path: "/",
      });
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    cookieStore.delete(STEP_UP_COOKIE_NAME);
    cookieStore.set(GOOGLE_REMEMBER_INTENT_COOKIE_NAME, signGoogleRememberIntent(user.id), {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: GOOGLE_REMEMBER_INTENT_MAX_AGE_MS / 1000, path: "/",
    });
    return NextResponse.redirect(new URL("/mfa", request.url));
  }

  // Supabase may create a pending Google-only Auth user during OAuth. Never
  // delete an existing password or linked account; only the fresh OAuth-only
  // identity from this callback is eligible for cleanup.
  if (!lookupError && isDisposableGoogleSignup(user, profile)) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) console.error("Unable to remove rejected Google OAuth signup");
  }

  await supabase.auth.signOut();
  (await cookies()).delete(STEP_UP_COOKIE_NAME);
  (await cookies()).delete(GOOGLE_REMEMBER_INTENT_COOKIE_NAME);
  return NextResponse.redirect(loginUrl);
}
