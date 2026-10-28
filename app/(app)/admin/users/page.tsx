import { requireActiveUser } from "@/lib/auth/session";
import { listUserAccounts } from "@/lib/actions/admin-users";
import { redirect } from "next/navigation";
import { UsersWorkspace } from "./users-workspace";

export default async function AdminUsersPage() {
  const { user, profile } = await requireActiveUser();
  if (profile.role !== "admin") redirect("/dashboard");
  const accounts = await listUserAccounts();
  return <UsersWorkspace accounts={accounts} currentUserId={user.id} />;
}
