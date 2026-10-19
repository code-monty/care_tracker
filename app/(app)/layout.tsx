import { requireActiveUser } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/sign-out";
import { AppShell } from "./app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireActiveUser();

  return (
    <AppShell fullName={profile.full_name} isAdmin={profile.role === "admin"} signOut={signOut}>
      {children}
    </AppShell>
  );
}
