"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Moon } from "lucide-react";
import styles from "./auth-theme.module.css";

export type AuthTheme = "dark" | "light";

const THEME_KEY = "caretracker-login-theme";

export function useAuthTheme() {
  const [theme, setTheme] = useState<AuthTheme>("dark");

  useEffect(() => {
    let frame: number | undefined;
    try {
      if (window.localStorage.getItem(THEME_KEY) === "light") {
        frame = window.requestAnimationFrame(() => setTheme("light"));
      }
    } catch {
      // The toggle still works when storage is unavailable.
    }
    return () => { if (frame !== undefined) window.cancelAnimationFrame(frame); };
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Keep the selected theme for this visit.
    }
  }

  return { theme, toggleTheme };
}

export function AuthThemeToggle({ theme, onToggle }: { theme: AuthTheme; onToggle: () => void }) {
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;

  return (
    <button type="button" className={styles.button} onClick={onToggle} aria-label={label} title={label}>
      {theme === "dark" ? <Image src="/auth/theme.svg" alt="" width={24} height={24} /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
