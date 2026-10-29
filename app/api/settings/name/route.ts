import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(1, "Enter a name").max(120) });

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  const { user } = await requireActiveUser();
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid name" }, { status: 400 });
  const db = await createClient();
  const { error } = await db.from("profiles").update({ full_name: parsed.data.name }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Unable to save your name. Please try again." }, { status: 500 });
  revalidatePath("/", "layout");
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
