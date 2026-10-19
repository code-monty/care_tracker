import Link from "next/link";
import { AuthCard } from "../auth-card";
import styles from "../auth-card.module.css";

export default function PrivacyPolicyPage() {
  return (
    <AuthCard>
      <h1 className={styles.title}>Privacy Policy</h1>
      <p className={styles.description}>The Privacy Policy is being prepared. This page is a placeholder and does not contain the policy yet.</p>
      <Link href="/login" className={styles.action}>Back to sign in</Link>
    </AuthCard>
  );
}
