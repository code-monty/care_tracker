"use client";

import Image from "next/image";
import Link from "next/link";
import { AuthThemeToggle, useAuthTheme } from "../auth-theme";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export function LoginExperience({ version, googleError }: { version: string; googleError: boolean }) {
  const { theme, toggleTheme } = useAuthTheme();

  return (
    <main className={styles.page} data-theme={theme}>
      <section className={styles.brand} aria-label="HLT Psychological Services">
        <Image src="/auth/hlt-clinic-exterior.png" alt="" fill priority sizes="(max-width: 767px) 100vw, 58vw" className={styles.brandPhoto} />
        <div className={styles.brandShade} aria-hidden="true" />
        <div className={styles.brandIdentity}>
          <span className={styles.logoFrame}>
            <Image src="/auth/hlt-logo.png" alt="HLT Psychological Services logo" width={173} height={172} className={styles.logo} priority />
          </span>
          <div>
            <p className={styles.brandEyebrow}>HLT Psychological Services</p>
            <p className={styles.brandTitle}>HLT CareTracker</p>
            <p className={styles.brandDescription}>Browser-Based Client &amp; Attorney Monitoring Portal</p>
          </div>
        </div>
      </section>

      <section className={styles.panel} aria-label="Sign in">
        <header className={styles.panelTop}>
          <div className={styles.statusLine}>
            <span className={styles.version}>v{version}</span>
            <span className={styles.statusDivider} aria-hidden="true">|</span>
            <span className={styles.secureStatus}><Image src="/auth/secure.svg" alt="" width={12} height={12} /> Secure sign-in</span>
          </div>
          <AuthThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>

        <div className={styles.formArea}>
          <div className={styles.formInner}>
            <h1 className={styles.heading} aria-label="Sign in to CareTracker">Welcome back</h1>
            <p className={styles.intro}>Sign in with your verified email address to access your monitoring dashboard.</p>
            <LoginForm googleError={googleError} />
          </div>
        </div>

        <footer className={styles.footer}>
          <nav aria-label="Legal information">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <span aria-hidden="true">•</span>
            <Link href="/terms-of-service">Terms of Service</Link>
          </nav>
          <p>© 2026 HLT Psychological Services.</p>
        </footer>
      </section>
    </main>
  );
}
