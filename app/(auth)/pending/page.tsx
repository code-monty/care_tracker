import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/sign-out";

/**
 * Shown to a signed-in user whose profiles.status is not 'active':
 * - 'pending'  — awaiting Admin approval (AGENTS.md Section 6, Q-04 default:
 *                accounts are Admin-created only; a stray sign-up path only
 *                ever creates a Pending account, relabelled "Request access")
 * - 'disabled' — account was deactivated by an Admin (BR-08)
 */
export default async function PendingApprovalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, status")
    .eq("id", user.id)
    .single();

  // Active users have no reason to be on this screen.
  if (profile?.status === "active") {
    redirect("/dashboard");
  }

  const isDisabled = profile?.status === "disabled";

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">
          {isDisabled ? "Account disabled" : "Awaiting approval"}
        </h1>

        <p className="mt-3 text-sm text-neutral-600">
          {isDisabled
            ? "Your account has been disabled. Contact your clinic Admin if you believe this is a mistake."
            : "Your account request has been received. An Admin needs to approve your access before you can sign in to CareTracker."}
        </p>

        <p className="mt-6 text-xs text-neutral-400">
          Signed in as {profile?.full_name ?? user.email}
        </p>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
