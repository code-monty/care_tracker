import { requireActiveUser } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/sign-out";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "./app-shell";

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-app-body" });
const headingFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-app-heading" });

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireActiveUser();

  return (
    <div className={`${bodyFont.variable} ${headingFont.variable}`}>
      <AppShell fullName={profile.full_name} isAdmin={profile.role === "admin"} signOut={signOut}>
        {children}
      </AppShell>
    </div>
  );
}
