"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; success?: boolean };
const MAX_SOURCE = 2 * 1024 * 1024;
const MAX_AVATAR = 256 * 1024;

function sourceType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (webp(bytes)) return "image/webp";
  return null;
}

function webp(bytes: Uint8Array) {
  return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function updateOwnPicture(form: FormData): Promise<Result> {
  const { user } = await requireActiveUser();
  const original = form.get("original");
  const picture = form.get("picture");
  if (!(original instanceof File) || !(picture instanceof File)
    || original.size < 1 || original.size > MAX_SOURCE
    || picture.size < 1 || picture.size > MAX_AVATAR) {
    return { error: "Choose a picture up to 2 MB." };
  }
  const originalBytes = new Uint8Array(await original.slice(0, 12).arrayBuffer());
  const pictureBytes = new Uint8Array(await picture.arrayBuffer());
  if (sourceType(originalBytes) !== original.type || picture.type !== "image/webp" || !webp(pictureBytes)) {
    return { error: "Use a valid JPEG, PNG, or WebP picture." };
  }
  const db = await createClient();
  const { error: uploadError } = await db.storage.from("profile-pictures")
    .upload(`${user.id}/avatar.webp`, pictureBytes, { contentType: "image/webp", upsert: true, cacheControl: "0" });
  if (uploadError) return { error: "Unable to upload the picture. Please try again." };
  const { error } = await db.from("profiles").update({ avatar_updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return { error: "Picture uploaded, but the profile could not refresh. Reload and try again." };
  revalidatePath("/", "layout");
  return { success: true };
}
