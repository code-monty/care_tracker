import Link from "next/link";
import { AuthCard } from "../auth-card";
import styles from "../auth-card.module.css";

export default function TermsOfServicePage() {
  return (
    <AuthCard>
      <h1 className={styles.title}>Terms of Service</h1>
      <p className={styles.description}>The Terms of Service are being prepared. This page is a placeholder and does not contain the terms yet.</p>
      <Link href="/login" className={styles.action}>Back to sign in</Link>
    </AuthCard>
  );
}
