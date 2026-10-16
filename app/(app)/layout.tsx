import { requireActiveUser } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/sign-out";
import { AppNavigation } from "./navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireActiveUser();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-6 lg:block">
        <div className="mb-10 px-3">
          <p className="text-xl font-bold tracking-tight text-teal-800">CareTracker</p>
          <p className="mt-1 text-xs text-slate-500">HLT Psychological Services</p>
        </div>
        <AppNavigation variant="sidebar" isAdmin={profile.role === "admin"} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-teal-800 lg:hidden">CareTracker</p>
              <p className="truncate text-sm text-slate-600">Good Day, {profile.full_name}!</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                Sign out
              </button>
            </form>
          </div>
          <AppNavigation variant="mobile" isAdmin={profile.role === "admin"} />
        </header>
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
