"use server";

import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const targetSchema = z.object({ kind: z.enum(["client", "attorney"]), id: z.uuid() });
const bodySchema = z.string().trim().min(1, "Enter a note.").max(4000, "Keep notes under 4,000 characters.");

export type RecordNote = { id: string; body: string; author_name: string; author_role: string; created_at: string };

export async function getRecordNotes(target: { kind: "client" | "attorney"; id: string }) {
  const { profile } = await requireActiveUser();
  const value = targetSchema.parse(target);
  const db = await createClient();
  const column = value.kind === "client" ? "client_id" : "attorney_id";
  const { data, error } = await db.from("notes").select("id,body,author_name,author_role,created_at").eq(column, value.id).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw new Error("Unable to load notes.");
  return { notes: (data ?? []) as RecordNote[], user: { name: profile.full_name?.trim() || "Unknown user", role: profile.role } };
}

export async function addRecordNote(target: { kind: "client" | "attorney"; id: string }, body: string) {
  const { user } = await requireActiveUser();
  const value = targetSchema.parse(target);
  const note = bodySchema.parse(body);
  const db = await createClient();
  const column = value.kind === "client" ? "client_id" : "attorney_id";
  const { error } = await db.from("notes").insert({ [column]: value.id, body: note, author_id: user.id, author_name: "", author_role: "staff" });
  if (error) throw new Error("Unable to save note. Please try again.");
  return getRecordNotes(value);
}
