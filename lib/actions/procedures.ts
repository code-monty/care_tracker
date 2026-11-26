"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  canEditProcedureTracking,
  canManageProcedureNote,
  procedureLabel,
  sortProcedureNotes,
} from "@/lib/rules/procedures";
import {
  clientIdSchema,
  procedureDateCreatedSchema,
  procedureIdSchema,
  procedureNoteBodySchema,
  procedureNoteIdSchema,
} from "@/lib/validation/procedures";

export type ProcedureNote = {
  id: string;
  procedure_id: string;
  body: string;
  author_id: string;
  author_name: string;
  author_role: string;
  created_at: string;
  pinned: boolean;
};

export type ClientProcedure = {
  id: string;
  procedureKey: string;
  name: string;
  sortOrder: number;
  dateCreated: string | null;
  isCompleted: boolean;
  dateCompleted: string | null;
  notes: ProcedureNote[];
};

export type ProceduresPayload = {
  procedures: ClientProcedure[];
  user: { id: string; name: string; role: string };
};

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function fetchProceduresPayload(
  db: DbClient,
  clientId: string,
  user: { id: string; name: string; role: string },
): Promise<ProceduresPayload> {
  const { data: client, error: clientError } = await db
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("is_archived", false)
    .maybeSingle();
  if (clientError || !client) throw new Error("Client unavailable.");

  const { data: rows, error } = await db
    .from("client_procedures")
    .select("id,procedure_key,sort_order,date_created,is_completed,date_completed")
    .eq("client_id", clientId)
    .order("sort_order");
  if (error) throw new Error("Unable to load procedures.");

  const procedureIds = (rows ?? []).map((row) => row.id);
  const notesByProcedure = new Map<string, ProcedureNote[]>();

  if (procedureIds.length > 0) {
    const { data: noteRows, error: notesError } = await db
      .from("client_procedure_notes")
      .select("id,procedure_id,body,author_id,author_name,author_role,created_at")
      .in("procedure_id", procedureIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (notesError) throw new Error("Unable to load procedure notes.");

    const noteIds = (noteRows ?? []).map((note) => note.id);
    const pinnedIds = new Set<string>();
    if (noteIds.length > 0) {
      const { data: pinRows, error: pinsError } = await db
        .from("client_procedure_note_pins")
        .select("note_id")
        .in("note_id", noteIds);
      if (pinsError) throw new Error("Unable to load procedure notes.");
      for (const pin of pinRows ?? []) pinnedIds.add(pin.note_id);
    }

    for (const row of noteRows ?? []) {
      const list = notesByProcedure.get(row.procedure_id) ?? [];
      list.push({ ...row, pinned: pinnedIds.has(row.id) });
      notesByProcedure.set(row.procedure_id, list);
    }
  }

  return {
    procedures: (rows ?? []).map((row) => ({
      id: row.id,
      procedureKey: row.procedure_key,
      name: procedureLabel(row.procedure_key),
      sortOrder: row.sort_order,
      dateCreated: row.date_created,
      isCompleted: row.is_completed,
      dateCompleted: row.is_completed ? row.date_completed : null,
      notes: sortProcedureNotes(notesByProcedure.get(row.id) ?? []),
    })),
    user,
  };
}

function currentUserSummary(userId: string, profile: { full_name: string | null; role: string }) {
  return {
    id: userId,
    name: profile.full_name?.trim() || "Unknown user",
    role: profile.role,
  };
}

async function requireProcedureOnClient(db: DbClient, clientId: string, procedureId: string) {
  const { data, error } = await db
    .from("client_procedures")
    .select("id,client_id,clients!inner(is_archived)")
    .eq("id", procedureId)
    .eq("client_id", clientId)
    .maybeSingle();
  const client = data ? (Array.isArray(data.clients) ? data.clients[0] : data.clients) : null;
  if (error || !data || client?.is_archived) throw new Error("Procedure unavailable.");
  return data.id;
}

async function requireNoteOnClient(db: DbClient, clientId: string, noteId: string) {
  const { data, error } = await db
    .from("client_procedure_notes")
    .select("id,author_id,client_procedures!inner(client_id,clients!inner(is_archived))")
    .eq("id", noteId)
    .maybeSingle();
  const procedure = data
    ? Array.isArray(data.client_procedures)
      ? data.client_procedures[0]
      : data.client_procedures
    : null;
  const client = procedure
    ? Array.isArray(procedure.clients)
      ? procedure.clients[0]
      : procedure.clients
    : null;
  if (error || !data || procedure?.client_id !== clientId || client?.is_archived) {
    throw new Error("Note unavailable.");
  }
  return { id: data.id, authorId: data.author_id };
}

export async function getClientProcedures(clientId: string): Promise<ProceduresPayload> {
  const { user, profile } = await requireActiveUser();
  const validClientId = clientIdSchema.parse(clientId);
  const db = await createClient();
  return fetchProceduresPayload(db, validClientId, currentUserSummary(user.id, profile));
}

export async function updateProcedureDateCreated(
  clientId: string,
  procedureId: string,
  dateCreated: string | null,
): Promise<ProceduresPayload> {
  const { user, profile } = await requireActiveUser();
  if (!canEditProcedureTracking(profile.role)) throw new Error("Access denied");
  const validClientId = clientIdSchema.parse(clientId);
  const validProcedureId = procedureIdSchema.parse(procedureId);
  const validDate = procedureDateCreatedSchema.parse(dateCreated);
  const db = await createClient();
  await requireProcedureOnClient(db, validClientId, validProcedureId);
  const { error } = await db
    .from("client_procedures")
    .update({ date_created: validDate })
    .eq("id", validProcedureId)
    .eq("client_id", validClientId);
  if (error) throw new Error("Unable to save date created.");
  revalidatePath(`/clients/${validClientId}`);
  return fetchProceduresPayload(db, validClientId, currentUserSummary(user.id, profile));
}

export async function toggleProcedureCompleted(
  clientId: string,
  procedureId: string,
  isCompleted: boolean,
): Promise<ProceduresPayload> {
  const { user, profile } = await requireActiveUser();
  if (!canEditProcedureTracking(profile.role)) throw new Error("Access denied");
  const validClientId = clientIdSchema.parse(clientId);
  const validProcedureId = procedureIdSchema.parse(procedureId);
  const completed = z.boolean().parse(isCompleted);
  const db = await createClient();
  await requireProcedureOnClient(db, validClientId, validProcedureId);
  const { error } = await db
    .from("client_procedures")
    .update({ is_completed: completed })
    .eq("id", validProcedureId)
    .eq("client_id", validClientId);
  if (error) throw new Error("Unable to update procedure status.");
  revalidatePath(`/clients/${validClientId}`);
  return fetchProceduresPayload(db, validClientId, currentUserSummary(user.id, profile));
}

export async function addProcedureNote(
  clientId: string,
  procedureId: string,
  body: string,
): Promise<ProceduresPayload> {
  const { user, profile } = await requireActiveUser();
  const validClientId = clientIdSchema.parse(clientId);
  const validProcedureId = procedureIdSchema.parse(procedureId);
  const text = procedureNoteBodySchema.parse(body);
  const db = await createClient();
  await requireProcedureOnClient(db, validClientId, validProcedureId);
  const { error } = await db.from("client_procedure_notes").insert({
    procedure_id: validProcedureId,
    body: text,
    author_id: user.id,
    author_name: "",
    author_role: "staff",
  });
  if (error) throw new Error("Unable to save note. Please try again.");
  revalidatePath(`/clients/${validClientId}`);
  return fetchProceduresPayload(db, validClientId, currentUserSummary(user.id, profile));
}

export async function updateProcedureNote(
  clientId: string,
  noteId: string,
  body: string,
): Promise<ProceduresPayload> {
  const { user, profile } = await requireActiveUser();
  const validClientId = clientIdSchema.parse(clientId);
  const validNoteId = procedureNoteIdSchema.parse(noteId);
  const text = procedureNoteBodySchema.parse(body);
  const db = await createClient();
  const note = await requireNoteOnClient(db, validClientId, validNoteId);
  const actor = currentUserSummary(user.id, profile);
  if (!canManageProcedureNote(actor, note.authorId)) {
    throw new Error("You can only edit your own notes.");
  }
  const { error } = await db
    .from("client_procedure_notes")
    .update({ body: text })
    .eq("id", validNoteId);
  if (error) throw new Error("Unable to update note. Please try again.");
  revalidatePath(`/clients/${validClientId}`);
  return fetchProceduresPayload(db, validClientId, actor);
}

export async function deleteProcedureNote(
  clientId: string,
  noteId: string,
): Promise<ProceduresPayload> {
  const { user, profile } = await requireActiveUser();
  const validClientId = clientIdSchema.parse(clientId);
  const validNoteId = procedureNoteIdSchema.parse(noteId);
  const db = await createClient();
  const note = await requireNoteOnClient(db, validClientId, validNoteId);
  const actor = currentUserSummary(user.id, profile);
  if (!canManageProcedureNote(actor, note.authorId)) {
    throw new Error("You can only delete your own notes.");
  }
  const { error } = await db.from("client_procedure_notes").delete().eq("id", validNoteId);
  if (error) throw new Error("Unable to delete note. Please try again.");
  revalidatePath(`/clients/${validClientId}`);
  return fetchProceduresPayload(db, validClientId, actor);
}

export async function setProcedureNotePinned(
  clientId: string,
  noteId: string,
  pinned: boolean,
): Promise<ProceduresPayload> {
  const { user, profile } = await requireActiveUser();
  const validClientId = clientIdSchema.parse(clientId);
  const validNoteId = procedureNoteIdSchema.parse(noteId);
  const shouldPin = z.boolean().parse(pinned);
  const db = await createClient();
  await requireNoteOnClient(db, validClientId, validNoteId);
  const result = shouldPin
    ? await db.from("client_procedure_note_pins").insert({ note_id: validNoteId, pinned_by: user.id })
    : await db.from("client_procedure_note_pins").delete().eq("note_id", validNoteId);
  if (result.error) throw new Error("Unable to change pin. Please try again.");
  revalidatePath(`/clients/${validClientId}`);
  return fetchProceduresPayload(db, validClientId, currentUserSummary(user.id, profile));
}
