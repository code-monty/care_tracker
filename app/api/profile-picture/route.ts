import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { user, profile } = await requireActiveUser();
  if (!profile.avatar_updated_at) return new Response(null, { status: 404 });
  const db = await createClient();
  const { data, error } = await db.storage.from("profile-pictures").download(`${user.id}/avatar.webp`);
  if (error || !data) return new Response(null, { status: 404 });
  return new Response(data, {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
