"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Scale, UserCog, ScrollText, Settings, DatabaseBackup } from "lucide-react";

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
    <nav aria-label="Main navigation" className={mobile ? "mt-4 flex gap-1 overflow-x-auto lg:hidden" : "space-y-1"}>
      {[...links, ...(isAdmin ? adminLinks : [])].map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${active ? "bg-teal-100 text-teal-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            <Icon aria-hidden="true" size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
