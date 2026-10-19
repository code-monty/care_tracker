import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/sign-out";
import { AuthCard } from "../auth-card";
import styles from "../auth-card.module.css";

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
    <AuthCard>
      <h1 className={styles.title}>
        {isDisabled ? "Account disabled" : "Awaiting approval"}
      </h1>

      <p className={styles.description}>
        {isDisabled
          ? "Your account has been disabled. Contact your clinic Admin if you believe this is a mistake."
          : "Your account request has been received. An Admin needs to approve your access before you can sign in to CareTracker."}
      </p>

      <p className={styles.detail}>
        Signed in as {profile?.full_name ?? user.email}
      </p>

      <form action={signOut}>
        <button type="submit" className={styles.action}>
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
