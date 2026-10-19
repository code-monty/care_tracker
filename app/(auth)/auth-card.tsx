"use client";

import type { ReactNode } from "react";
import { AuthThemeToggle, useAuthTheme } from "./auth-theme";
import styles from "./auth-card.module.css";

export function AuthCard({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useAuthTheme();

  return (
    <main className={styles.page} data-theme={theme}>
      <section className={styles.card}>
        <div className={styles.top}>
          <p className={styles.brand}>HLT CareTracker</p>
          <AuthThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        {children}
      </section>
    </main>
  );
}
