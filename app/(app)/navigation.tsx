"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock3, Grid2X2, UserCog, ScrollText, Settings, DatabaseBackup } from "lucide-react";
import styles from "./app-shell.module.css";

export const adminLinks = [
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/logs", label: "Activity Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/backup", label: "Backup", icon: DatabaseBackup },
];

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: Grid2X2 },
  { href: "/clients", label: "Clients", asset: "/auth/figma-client-icon.svg" },
  { href: "/attorneys", label: "Attorneys", asset: "/auth/figma-attorney-icon.svg" },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/deadlines", label: "Deadlines", icon: Clock3 },
];

function activeRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ variant, isAdmin, expanded = false }: {
  variant: "rail" | "mobile";
  isAdmin: boolean;
  expanded?: boolean;
}) {
  const pathname = usePathname();
  const mobile = variant === "mobile";

  return (
    <nav id={mobile ? undefined : "desktop-sidebar-navigation"} aria-label={mobile ? "Mobile navigation" : "Main navigation"} className={mobile ? styles.mobileNav : styles.railNav} data-expanded={!mobile && expanded ? "true" : undefined}>
      <div className={styles.railTop}>
        <div className={mobile ? styles.mobileLinks : styles.railGroup}>
          {mainLinks.map(({ href, label, icon: Icon, asset }) => (
            <Link key={href} href={href} aria-label={label} title={label} aria-current={activeRoute(pathname, href) ? "page" : undefined} className={styles.navLink}>
              {asset ? <Image src={asset} alt="" width={21} height={26} /> : Icon ? <Icon aria-hidden="true" size={26} strokeWidth={2.3} /> : null}
              <span className={styles.navLabel}>{label}</span>
            </Link>
          ))}
        </div>
      </div>
      {isAdmin && !mobile && (
        <div className={`${styles.railGroup} ${styles.adminRail}`} aria-label="Admin navigation">
          {adminLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-label={label} title={label} aria-current={activeRoute(pathname, href) ? "page" : undefined} className={styles.navLink}>
              <Icon aria-hidden="true" size={23} strokeWidth={2.1} />
              <span className={styles.navLabel}>{label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

export function AdminMenuLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className={styles.adminMenuLinks}>
      {adminLinks.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} aria-current={activeRoute(pathname, href) ? "page" : undefined} className={styles.menuItem}>
          <Icon aria-hidden="true" size={18} />{label}
        </Link>
      ))}
    </div>
  );
}
