import { requireActiveUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PersonalSettings } from "./personal-settings";

export default async function SettingsPage() {
  const { user, profile } = await requireActiveUser();
  if (profile.role === "admin") redirect("/admin/settings");
  return <PersonalSettings name={profile.full_name ?? ""} email={user.email ?? ""}
    hasPicture={Boolean(profile.avatar_updated_at)} pictureVersion={profile.avatar_updated_at ?? ""} />;
}
