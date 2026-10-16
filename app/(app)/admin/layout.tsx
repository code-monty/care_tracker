import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireActiveUser();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return children;
}
