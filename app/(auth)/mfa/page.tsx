import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StepUpForm } from "./step-up-form";

/**
 * DEV-02 (AGENTS.md Section 8/15): shown after password sign-in, before
 * proxy.ts / requireActiveUser() will let the user past to any protected
 * route. Already-verified users never see this page — proxy.ts only
 * redirects here when the step-up cookie is missing or invalid.
 *
 * The first code send happens client-side in StepUpForm, not here. An
 * earlier version triggered it from this Server Component via a
 * redirect("/mfa?sent=1") dance, but two near-simultaneous GET /mfa
 * requests (a real, observed race — e.g. the browser's own navigation
 * plus a duplicate request around the proxy.ts redirect) could both see
 * no `sent` param yet and both fire requestStepUp(), sending two emails.
 * StepUpForm's useRef guard (set synchronously before the async call
 * resolves) can't be raced the same way.
 */
export default async function MfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-center text-sm text-neutral-600">
          Enter the 6-digit code we sent to {user.email} to finish signing in.
        </p>
        <StepUpForm />
      </div>
    </main>
  );
}

