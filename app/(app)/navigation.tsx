"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Scale, UserCog, ScrollText, Settings, DatabaseBackup } from "lucide-react";
import styles from "./app-shell.module.css";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/attorneys", label: "Attorneys", icon: Scale },
];

const adminLinks = [
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/logs", label: "Activity Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/backup", label: "Backup", icon: DatabaseBackup },
];

export function AppNavigation({ variant, isAdmin }: { variant: "sidebar" | "mobile"; isAdmin: boolean }) {
  const pathname = usePathname();
  const mobile = variant === "mobile";

  return (
    <nav aria-label="Main navigation" className={mobile ? styles.mobileNav : styles.sidebarNav}>
      {[...links, ...(isAdmin ? adminLinks : [])].map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={styles.navLink}
          >
            <Icon aria-hidden="true" size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
