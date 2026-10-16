// proxy.ts (project root, same level as /app)
//
// AGENTS.md Section 5, Rule 2: authorization is enforced twice — here
// (routing layer) and again in every Server Action / RLS policy. This
// file must never be the ONLY check; lib/auth/session.ts's
// requireActiveUser() is the second, server-side check.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { STEP_UP_COOKIE_NAME, verifyStepUpCookie } from "@/lib/auth/step-up";

// Routes reachable without an Active session. /pending is public in the
// sense that a signed-in-but-not-Active user must be able to reach it
// without being redirected back to itself in a loop. /mfa is public in the
// same sense for a signed-in-but-not-step-up-verified user (DEV-02).
const PUBLIC_PATHS = ["/login", "/mfa", "/pending", "/privacy-policy", "/terms-of-service", "/auth"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANT: do not remove this call. It refreshes the session cookie
  // on every request; without it, sessions silently stop refreshing and
  // users get logged out unexpectedly.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();

    if (!profile || profile.status !== "active") {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }

    // DEV-02 (AGENTS.md Section 8/15): every user — Admin and Staff — must
    // complete email-code step-up verification after password sign-in
    // before reaching any protected route. This checks the signed cookie
    // lib/auth/verify-step-up.ts sets on a correct code; lib/auth/session.ts's
    // requireActiveUser() repeats this check server-side (Rule 2 above).
    const stepUpCookie = request.cookies.get(STEP_UP_COOKIE_NAME)?.value;
    if (!verifyStepUpCookie(stepUpCookie, user.id)) {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa";
      return NextResponse.redirect(url);
    }
  }

  // AGENTS.md Section 5 (Decision D-01): clinic-IP allowlist is deferred,
  // not cancelled. Flag defaults to "false"; this stays inert until
  // explicitly enabled and approved — do not wire up enforcement here
  // without a separate, explicit PR for it.
  if (process.env.ENFORCE_IP_ALLOWLIST === "true") {
    // TODO(D-01 reactivation): check request IP against
    // CLINIC_ALLOWED_IPS here once the allowlist is approved for use.
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
