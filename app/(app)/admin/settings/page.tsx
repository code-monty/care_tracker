import { requireActiveUser } from "@/lib/auth/session";
import { PersonalSettings } from "../../settings/personal-settings";

export default async function AdminSettingsPage() {
  const { user, profile } = await requireActiveUser();
  return <PersonalSettings title="Settings" name={profile.full_name ?? ""} email={user.email ?? ""}
    hasPicture={Boolean(profile.avatar_updated_at)} pictureVersion={profile.avatar_updated_at ?? ""} />;
}
