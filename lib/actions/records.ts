"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addClientSchema } from "@/lib/validation/client";
import { getDashboardRecords, getDeadlineRecords } from "@/lib/data/records";

const uuid = z.uuid();
const statusSchema = z.enum(["active", "inactive"]);
const appointmentSchema = z.object({ clientId: uuid, date: z.iso.date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), reason: z.string().trim().min(1).max(100), status: z.enum(["pending", "confirmed", "cancelled"]) });
const taskSchema = z.object({ clientId: uuid, title: z.string().trim().min(1).max(120), assignedTo: uuid, dueDate: z.iso.date() });
function refresh() { for (const path of ["/clients", "/appointments", "/dashboard", "/deadlines"]) revalidatePath(path); }
function fail(error: unknown): never { throw new Error(error instanceof Error ? error.message : "Unable to save record"); }
function requireRecordManager(role: string) {
  if (role !== "admin" && role !== "secretary") throw new Error("Access denied");
}
const attorneySchema = z.object({ full_name: z.string().trim().min(1).max(120), contact_no: z.string().regex(/^09\d{2}-?\d{3}-?\d{4}$/), email: z.email() });
function refreshPeople(id?: string) {
  refresh();
  revalidatePath("/attorneys");
  if (id) { revalidatePath(`/clients/${id}`); revalidatePath(`/attorneys/${id}`); }
}

export async function updateClientRecord(id: string, input: z.infer<typeof addClientSchema>, attorneyId: string) {
  const { profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const value = addClientSchema.parse(input);
  const db = await createClient();
  const { error } = await db.rpc("update_client_record", { p_id: uuid.parse(id), p_client: value, p_attorney_id: uuid.parse(attorneyId) });
  if (error) fail(error);
  refreshPeople(id);
}

export async function updateAttorneyRecord(id: string, input: z.infer<typeof attorneySchema>) {
  const { profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const db = await createClient();
  const { data, error } = await db.from("attorneys").update(attorneySchema.parse(input)).eq("id", uuid.parse(id)).eq("is_archived", false).select("id").single();
  if (error || !data) fail(error);
  refreshPeople(id);
}

export async function archiveClientRecord(id: string) {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const { data, error } = await db.from("clients").update({ is_archived: true }).eq("id", uuid.parse(id)).eq("is_archived", false).select("id").single();
  if (error || !data) fail(error);
  refreshPeople(id);
  revalidatePath("/clients/archived");
}

export async function restoreClientRecord(id: string) {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const { data, error } = await db.from("clients").update({ is_archived: false }).eq("id", uuid.parse(id)).eq("is_archived", true).select("id").single();
  if (error || !data) fail(error);
  refreshPeople(id);
  revalidatePath("/clients/archived");
}

export async function archiveAttorneyRecord(id: string) {
  const { profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const db = await createClient();
  const { data, error } = await db.from("attorneys").update({ is_archived: true }).eq("id", uuid.parse(id)).eq("is_archived", false).select("id").single();
  if (error || !data) fail(error);
  refreshPeople(id);
  revalidatePath("/attorneys/archived");
}

export async function restoreAttorneyRecord(id: string) {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const { data, error } = await db.from("attorneys").update({ is_archived: false }).eq("id", uuid.parse(id)).eq("is_archived", true).select("id").single();
  if (error || !data) fail(error);
  refreshPeople(id);
  revalidatePath("/attorneys/archived");
}

export async function createClientRecord(input: z.infer<typeof addClientSchema>, existingAttorneyId?: string) {
  const { profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const value = addClientSchema.parse(input);
  const db = await createClient();
  const { data, error } = await db.rpc("create_client_record", { p_client: value, p_attorney_id: existingAttorneyId ? uuid.parse(existingAttorneyId) : null });
  if (error || !data) fail(error);
  const { data: created, error: lookupError } = await db.from("clients").select("attorney_id").eq("id", data).single();
  if (lookupError || !created) fail(lookupError);
  refreshPeople(data as string);
  return { id: data as string, attorneyId: created.attorney_id };
}

export async function setClientStatus(id: string, status: string) {
  const { profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const db = await createClient();
  const { error } = await db.from("clients").update({ status: statusSchema.parse(status) }).eq("id", uuid.parse(id)).eq("is_archived", false);
  if (error) fail(error);
  refresh();
}

export async function saveAppointment(input: z.infer<typeof appointmentSchema>, id?: string) {
  const { user, profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const value = appointmentSchema.parse(input);
  const db = await createClient();
  const { data: client } = await db.from("clients").select("id").eq("id", value.clientId).eq("is_archived", false).single();
  if (!client) throw new Error("Select an available client.");
  const scheduled_at = new Date(`${value.date}T${value.time}:00+08:00`).toISOString();
  const payload = { client_id: value.clientId, scheduled_at, reason: value.reason, status: value.status };
  const { data, error } = id ? await db.from("appointments").update(payload).eq("id", uuid.parse(id)).select("id").single() : await db.from("appointments").insert({ ...payload, created_by: user.id }).select("id").single();
  if (error || !data) fail(error);
  refresh();
  return data.id as string;
}

export async function appointmentWarnings(date: string, time: string, exceptId?: string) {
  await requireActiveUser();
  const value = appointmentSchema.pick({ date: true, time: true }).parse({ date, time });
  const scheduled = new Date(`${value.date}T${value.time}:00+08:00`);
  const db = await createClient();
  let query = db.from("appointments").select("id").eq("scheduled_at", scheduled.toISOString()).neq("status", "cancelled");
  if (exceptId) query = query.neq("id", uuid.parse(exceptId));
  const { data, error } = await query.limit(1);
  if (error) fail(error);
  return { past: scheduled.getTime() < Date.now(), occupied: Boolean(data?.length) };
}

export async function dashboardForDate(date: string) {
  return getDashboardRecords(z.iso.date().parse(date));
}

export async function saveTask(input: z.infer<typeof taskSchema>, id?: string) {
  const { user, profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const value = taskSchema.parse(input);
  const db = await createClient();
  const [client, personnel] = await Promise.all([
    db.from("clients").select("id").eq("id", value.clientId).eq("is_archived", false).single(),
    db.rpc("active_personnel_directory"),
  ]);
  if (!client.data) throw new Error("Select an available client.");
  if (personnel.error || !(personnel.data as { id: string }[] | null)?.some((person) => person.id === value.assignedTo)) throw new Error("Select an active personnel member.");
  const payload = { client_id: value.clientId, title: value.title, assigned_to: value.assignedTo, due_date: value.dueDate };
  const { data, error } = id
    ? await db.from("tasks").update(payload).eq("id", uuid.parse(id)).select("id").single()
    : await db.from("tasks").insert({ ...payload, created_by: user.id }).select("id").single();
  if (error || !data) fail(error);
  refresh();
  revalidatePath(`/clients/${value.clientId}`);
  return data.id as string;
}

export async function completeTask(id: string) {
  const { user, profile } = await requireActiveUser();
  const db = await createClient();
  let query = db.from("tasks").update({ status: "done" }).eq("id", uuid.parse(id)).eq("status", "open");
  if (profile.role === "staff") query = query.eq("assigned_to", user.id);
  const { data, error } = await query.select("client_id").single();
  if (error || !data) fail(error);
  refresh();
  revalidatePath(`/clients/${data.client_id}`);
}

export async function clientTasksForClient(id: string) {
  return getDeadlineRecords(uuid.parse(id));
}

export async function deadlinesForPage() {
  return getDeadlineRecords();
}

export type NameMatch = { id: string; name: string; detail: string; contact?: string };

export async function searchRecordNames(kind: "client" | "attorney", term: string): Promise<NameMatch[]> {
  await requireActiveUser();
  const value = z.string().trim().min(1).max(100).parse(term);
  const pattern = `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  const db = await createClient();
  if (kind === "client") {
    const { data, error } = await db.from("clients").select("id,full_name,email,contact_no").eq("is_archived", false).ilike("full_name", pattern).order("full_name").limit(10);
    if (error) fail(error);
    return (data ?? []).map((row) => ({ id: row.id, name: row.full_name, detail: row.email, contact: row.contact_no }));
  }
  const { data, error } = await db.from("attorneys").select("id,full_name,email,contact_no").eq("is_archived", false).ilike("full_name", pattern).order("full_name").limit(10);
  if (error) fail(error);
  return (data ?? []).map((row) => ({ id: row.id, name: row.full_name, detail: row.email, contact: row.contact_no }));
}
