"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Moon, Sun } from "lucide-react";
import styles from "./auth-theme.module.css";

export type AuthTheme = "dark" | "light";

const THEME_KEY = "caretracker-login-theme";
export const THEME_TRANSITION_MS = 250;

export function useAuthTheme() {
  const [theme, setTheme] = useState<AuthTheme>("dark");
  const transitionTimer = useRef<number | null>(null);

  useEffect(() => {
    let frame: number | undefined;
    try {
      if (window.localStorage.getItem(THEME_KEY) === "light") {
        frame = window.requestAnimationFrame(() => setTheme("light"));
      }
    } catch {
      // The toggle still works when storage is unavailable.
    }
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
      document.documentElement.removeAttribute("data-theme-animating");
    };
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    root.removeAttribute("data-theme-animating");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.setAttribute("data-theme-animating", "");
      // Establish transition styles before changing the theme in this frame.
      void root.offsetWidth;
      transitionTimer.current = window.setTimeout(() => {
        root.removeAttribute("data-theme-animating");
        transitionTimer.current = null;
      }, THEME_TRANSITION_MS);
    }
    setTheme(next);
    root.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Keep the selected theme for this visit.
    }
  }

  return { theme, toggleTheme };
}

export function ThemeIcon({ theme, variant = "app" }: { theme: AuthTheme; variant?: "app" | "auth" }) {
  return (
    <span className={`${styles.icon} ${variant === "auth" ? styles.authIcon : ""}`} data-theme={theme} aria-hidden="true">
      <span className={styles.sun}>
        {variant === "auth" ? <Image src="/auth/theme.svg" alt="" width={38} height={37} style={{ width: 24, height: "auto" }} /> : <Sun size={18} />}
      </span>
      <span className={styles.moon}><Moon size={18} /></span>
    </span>
  );
}

export function AuthThemeToggle({ theme, onToggle }: { theme: AuthTheme; onToggle: () => void }) {
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;

  return (
    <button type="button" className={styles.button} onClick={onToggle} aria-label={label} title={label}>
      <ThemeIcon theme={theme} variant="auth" />
    </button>
  );
}
