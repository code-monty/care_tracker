"use client";

import type { ReactNode } from "react";
import { AuthThemeToggle, useAuthTheme } from "../(auth)/auth-theme";
import { AppNavigation } from "./navigation";
import styles from "./app-shell.module.css";

export function AppShell({
  children,
  fullName,
  isAdmin,
  signOut,
}: {
  children: ReactNode;
  fullName: string;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}) {
  const { theme, toggleTheme } = useAuthTheme();

  return (
    <div className={styles.shell} data-theme={theme}>
      <aside className={styles.sidebar}>
        <div className={styles.identity}>
          <p className={styles.brand}>CareTracker</p>
          <p className={styles.organization}>HLT Psychological Services</p>
        </div>
        <AppNavigation variant="sidebar" isAdmin={isAdmin} />
      </aside>

      <div className={styles.workspace}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.greeting}>
              <p className={styles.mobileBrand}>CareTracker</p>
              <p>Good Day, {fullName}!</p>
            </div>
            <div className={styles.actions}>
              <AuthThemeToggle theme={theme} onToggle={toggleTheme} />
              <form action={signOut}>
                <button type="submit" className={styles.signOut}>Sign out</button>
              </form>
            </div>
          </div>
          <AppNavigation variant="mobile" isAdmin={isAdmin} />
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
