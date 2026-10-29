import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { passwordChangeSchema } from "@/lib/validation/admin-user";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = passwordChangeSchema.extend({ currentPassword: z.string().min(1) });

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  const { user } = await requireActiveUser();
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the password fields" }, { status: 400 });
  if (parsed.data.currentPassword === parsed.data.password) return NextResponse.json({ error: "Choose a different new password." }, { status: 400 });
  const db = await createClient();
  const { data, error: signInError } = await db.auth.signInWithPassword({ email: user.email ?? "", password: parsed.data.currentPassword });
  if (signInError || data.user?.id !== user.id) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) return NextResponse.json({ error: "Unable to change password. Please try again." }, { status: 500 });
  await createAdminClient().rpc("log_activity", { p_actor_id: user.id, p_action: "password_change", p_entity_type: "profiles", p_entity_id: user.id });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
