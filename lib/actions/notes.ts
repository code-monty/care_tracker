"use server";

import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const targetSchema = z.object({ kind: z.enum(["client", "attorney"]), id: z.uuid() });
const bodySchema = z.string().trim().min(1, "Enter a note.").max(4000, "Keep notes under 4,000 characters.");
const noteIdSchema = z.uuid();

export type NoteReply = { id: string; body: string; author_name: string; author_role: string; created_at: string };
export type RecordNote = NoteReply & { pinned: boolean; replies: NoteReply[] };

export async function getRecordNotes(target: { kind: "client" | "attorney"; id: string }) {
  const { profile } = await requireActiveUser();
  const value = targetSchema.parse(target);
  const db = await createClient();
  const column = value.kind === "client" ? "client_id" : "attorney_id";
  const { data, error } = await db.from("notes").select("id,body,author_name,author_role,created_at").eq(column, value.id).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw new Error("Unable to load notes.");
  const ids = (data ?? []).map((row) => row.id);
  if (!ids.length) return { notes: [] as RecordNote[], user: { name: profile.full_name?.trim() || "Unknown user", role: profile.role } };
  const [pins, replies] = await Promise.all([
    db.from("note_pins").select("note_id").in("note_id", ids),
    db.from("note_replies").select("id,note_id,body,author_name,author_role,created_at").in("note_id", ids).order("created_at").order("id"),
  ]);
  if (pins.error || replies.error) throw new Error("Unable to load notes.");
  const pinnedIds = new Set((pins.data ?? []).map((pin) => pin.note_id));
  const repliesByNote = new Map<string, NoteReply[]>();
  for (const reply of replies.data ?? []) {
    const list = repliesByNote.get(reply.note_id) ?? [];
    list.push({ id: reply.id, body: reply.body, author_name: reply.author_name, author_role: reply.author_role, created_at: reply.created_at });
    repliesByNote.set(reply.note_id, list);
  }
  const notes = (data ?? []).map((row) => ({ ...row, pinned: pinnedIds.has(row.id), replies: repliesByNote.get(row.id) ?? [] }));
  notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  return { notes, user: { name: profile.full_name?.trim() || "Unknown user", role: profile.role } };
}

async function requireNoteOnTarget(target: { kind: "client" | "attorney"; id: string }, noteId: string) {
  const value = targetSchema.parse(target);
  const id = noteIdSchema.parse(noteId);
  const db = await createClient();
  const column = value.kind === "client" ? "client_id" : "attorney_id";
  const { data, error } = await db.from("notes").select("id").eq("id", id).eq(column, value.id).maybeSingle();
  if (error || !data) throw new Error("Note unavailable.");
  return { db, value, id };
}

export async function setRecordNotePinned(target: { kind: "client" | "attorney"; id: string }, noteId: string, pinned: boolean) {
  const { user } = await requireActiveUser();
  const { db, value, id } = await requireNoteOnTarget(target, noteId);
  const result = pinned
    ? await db.from("note_pins").insert({ note_id: id, pinned_by: user.id })
    : await db.from("note_pins").delete().eq("note_id", id);
  if (result.error) throw new Error("Unable to change pin. Please try again.");
  return getRecordNotes(value);
}

export async function addRecordNoteReply(target: { kind: "client" | "attorney"; id: string }, noteId: string, body: string) {
  const { user } = await requireActiveUser();
  const { db, value, id } = await requireNoteOnTarget(target, noteId);
  const text = bodySchema.parse(body);
  const { error } = await db.from("note_replies").insert({ note_id: id, body: text, author_id: user.id, author_name: "", author_role: "staff" });
  if (error) throw new Error("Unable to save reply. Please try again.");
  return getRecordNotes(value);
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
