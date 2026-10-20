"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Settings, Moon, Sun, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuthTheme } from "../(auth)/auth-theme";
import { AdminMenuLinks, AppNavigation } from "./navigation";
import styles from "./app-shell.module.css";

export function AppShell({ children, fullName, isAdmin, signOut }: {
  children: ReactNode;
  fullName: string;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}) {
  const { theme, toggleTheme } = useAuthTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.contains(document.activeElement)) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMenuOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div className={styles.shell} data-theme={theme}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.logoWrap}>
            <Image className={styles.logoRing} src="/auth/shell-logo-ring.svg" alt="" width={50} height={50} />
            <Image className={styles.logo} src="/auth/hlt-logo.png" alt="" width={40} height={40} />
          </span>
          <span className={styles.brand}>HLT<br />CareTracker</span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.profile}>
            <span className={styles.profileText}><strong title={fullName}>{fullName}</strong><small>{isAdmin ? "Admin" : "Staff"}</small></span>
            <Image className={styles.avatar} src="/auth/shell-avatar.svg" alt="" width={50} height={50} />
          </div>
          <span className={styles.headerDivider} aria-hidden="true"><Image src="/auth/shell-divider.svg" alt="" width={59} height={1} /></span>
          <button type="button" className={styles.themeButton} onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <Sun aria-hidden="true" size={21} /> : <Moon aria-hidden="true" size={21} />}
          </button>
          <div className={styles.menuWrap} ref={menuRef}>
            <button ref={menuButtonRef} type="button" className={styles.menuButton} aria-label="Open profile menu" aria-expanded={menuOpen} aria-controls={menuOpen ? "profile-menu" : undefined} onClick={() => setMenuOpen((open) => !open)} title="Profile menu">
              <Settings aria-hidden="true" size={24} />
            </button>
            {menuOpen && (
              <div id="profile-menu" className={styles.profileMenu}>
                <p className={styles.menuHeading}>{fullName}<span>{isAdmin ? "Admin" : "Staff"}</span></p>
                <button type="button" className={styles.menuItem} onClick={() => { toggleTheme(); setMenuOpen(false); }}>
                  {theme === "dark" ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
                  Switch to {theme === "dark" ? "light" : "dark"} theme
                </button>
                {isAdmin && <><p className={styles.menuSection}>Admin</p><AdminMenuLinks onNavigate={() => setMenuOpen(false)} /></>}
                <form action={signOut}><button type="submit" className={styles.menuItem}><LogOut aria-hidden="true" size={18} />Sign out</button></form>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.railDock} data-expanded={sidebarOpen ? "true" : undefined}>
          <AppNavigation variant="rail" isAdmin={isAdmin} expanded={sidebarOpen} />
          <button type="button" className={styles.railToggle} onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={sidebarOpen} aria-controls="desktop-sidebar-navigation" title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
            {sidebarOpen ? <ChevronLeft aria-hidden="true" size={16} /> : <ChevronRight aria-hidden="true" size={16} />}
          </button>
        </div>
        <div className={styles.workspace}><div className={styles.content}>{children}</div></div>
      </div>
      <AppNavigation variant="mobile" isAdmin={isAdmin} />
    </div>
  );
}
