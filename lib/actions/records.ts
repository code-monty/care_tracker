"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addClientSchema, clientDetailsSchema, type AttorneyChoice, type ClientInput } from "@/lib/validation/client";
import { getDashboardRecords, getDeadlineRecords } from "@/lib/data/records";
import { APPOINTMENT_SLOTS, occupiedAppointmentSlots } from "@/lib/rules/appointment-slots";

const uuid = z.uuid();
const statusSchema = z.enum(["active", "inactive"]);
const appointmentFields = z.object({ clientId: uuid.nullable(), guestName: z.string().trim().min(1).max(120).nullable(), date: z.iso.date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), reason: z.string().trim().min(1).max(100), status: z.enum(["pending", "confirmed", "cancelled"]) });
const appointmentSchema = appointmentFields.refine((value) => (value.clientId === null) !== (value.guestName === null), "Choose a saved client or enter a guest name");
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

export async function updateClientRecord(id: string, input: ClientInput, choice: AttorneyChoice) {
  const { profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const value = choice.mode === "new" ? addClientSchema.parse(input) : clientDetailsSchema.parse(input);
  const db = await createClient();
  const { data, error } = await db.rpc("save_client_record", { p_id: uuid.parse(id), p_client: value, p_attorney_mode: choice.mode, p_attorney_id: choice.mode === "existing" ? uuid.parse(choice.attorneyId) : null });
  if (error) fail(error);
  refreshPeople(id);
  return data as string | null;
}

export async function getClientAttorneyHistory(id: string) {
  await requireActiveUser();
  const db = await createClient();
  const { data, error } = await db.from("client_attorney_history")
    .select("id,detached_at,attorneys(full_name)").eq("client_id", uuid.parse(id)).order("detached_at", { ascending: false });
  if (error) fail(error);
  return (data ?? []).map((entry) => ({ id: entry.id, detachedAt: entry.detached_at, attorneyName: (Array.isArray(entry.attorneys) ? entry.attorneys[0] : entry.attorneys)?.full_name ?? "Former attorney" }));
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
  const appointmentId = id ? uuid.parse(id) : undefined;
  if (!APPOINTMENT_SLOTS.some((slot) => slot.value === value.time)) {
    if (!appointmentId) throw new Error("Choose an available one-hour appointment slot.");
    const { data: existing, error: existingError } = await db.from("appointments").select("scheduled_at").eq("id", appointmentId).single();
    if (existingError || !existing) fail(existingError);
    const unchanged = new Date(`${value.date}T${value.time}:00+08:00`).toISOString() === existing.scheduled_at;
    if (!unchanged) throw new Error("Choose an available one-hour appointment slot.");
  }
  if (value.clientId) {
    const { data: client } = await db.from("clients").select("id").eq("id", value.clientId).eq("is_archived", false).single();
    if (!client) throw new Error("Select an available client.");
  }
  const scheduled_at = new Date(`${value.date}T${value.time}:00+08:00`).toISOString();
  const payload = { client_id: value.clientId, guest_name: value.guestName, scheduled_at, reason: value.reason, status: value.status };
  const { data, error } = appointmentId ? await db.from("appointments").update(payload).eq("id", appointmentId).select("id").single() : await db.from("appointments").insert({ ...payload, created_by: user.id }).select("id").single();
  if (error?.code === "23P01") return { error: "slot_unavailable" as const };
  if (error || !data) fail(error);
  refresh();
  return { id: data.id as string };
}

export async function appointmentWarnings(date: string, time: string) {
  await requireActiveUser();
  const value = appointmentFields.pick({ date: true, time: true }).parse({ date, time });
  const scheduled = new Date(`${value.date}T${value.time}:00+08:00`);
  return { past: scheduled.getTime() < Date.now() };
}

export async function unavailableAppointmentSlots(date: string, exceptId?: string) {
  await requireActiveUser();
  const validDate = z.iso.date().parse(date);
  const start = new Date(`${validDate}T07:00:00+08:00`);
  const end = new Date(`${validDate}T17:00:00+08:00`);
  const db = await createClient();
  let query = db.from("appointments").select("id,scheduled_at").gte("scheduled_at", start.toISOString()).lt("scheduled_at", end.toISOString()).neq("status", "cancelled");
  if (exceptId) query = query.neq("id", uuid.parse(exceptId));
  const { data, error } = await query;
  if (error) fail(error);
  return occupiedAppointmentSlots((data ?? []).map((row) => {
    const manila = new Date(row.scheduled_at);
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(manila);
    return `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`;
  }));
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
    ? await db.from("tasks").update(payload).eq("id", uuid.parse(id)).eq("is_archived", false).select("id").single()
    : await db.from("tasks").insert({ ...payload, created_by: user.id }).select("id").single();
  if (error || !data) fail(error);
  refresh();
  revalidatePath(`/clients/${value.clientId}`);
  return data.id as string;
}

export async function completeTask(id: string) {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const taskId = uuid.parse(id);
  const { data: task, error: taskError } = await db.from("tasks").select("status,assigned_to").eq("id", taskId).eq("is_archived", false).single();
  if (taskError || !task) fail(taskError);
  if (task.status === "open") {
    const { data: assignee, error: assigneeError } = await db.from("profiles").select("role").eq("id", task.assigned_to).single();
    if (assigneeError || assignee?.role !== "secretary") throw new Error("Staff work requires a submission before completion.");
  }
  const { data, error } = await db.from("tasks").update({ status: "done" }).eq("id", taskId).eq("is_archived", false).in("status", ["open", "needs_changes"]).select("client_id").single();
  if (error || !data) fail(error);
  refresh();
  revalidatePath(`/clients/${data.client_id}`);
}

export async function archiveTask(id: string) {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const { data, error } = await db.from("tasks").update({ is_archived: true }).eq("id", uuid.parse(id))
    .eq("is_archived", false).neq("status", "awaiting_approval").select("client_id").single();
  if (error || !data) fail(error);
  refresh();
  revalidatePath(`/clients/${data.client_id}`);
  revalidatePath("/deadlines/archived");
}

export async function restoreTask(id: string) {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const { data, error } = await db.from("tasks").update({ is_archived: false }).eq("id", uuid.parse(id))
    .eq("is_archived", true).select("client_id").single();
  if (error || !data) fail(error);
  refresh();
  revalidatePath(`/clients/${data.client_id}`);
  revalidatePath("/deadlines/archived");
}

export async function submitTaskForApproval(id: string, comment?: string) {
  const { user, profile } = await requireActiveUser();
  if (profile.role !== "staff") throw new Error("Access denied");
  const value = z.object({ id: uuid, comment: z.string().trim().min(1).max(1000).optional() }).parse({ id, comment });
  const db = await createClient();
  const { data, error } = await db.from("tasks").update({ status: "awaiting_approval", review_comment: null, submission_comment: value.comment ?? null })
    .eq("id", value.id).eq("assigned_to", user.id).eq("is_archived", false).in("status", ["open", "needs_changes"])
    .select("client_id").single();
  if (error || !data) fail(error);
  refresh();
  revalidatePath(`/clients/${data.client_id}`);
}

export async function reviewTask(id: string, decision: "approve" | "return", comment?: string) {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const value = z.object({ id: uuid, decision: z.enum(["approve", "return"]), comment: z.string().trim().min(1).max(1000).optional() }).parse({ id, decision, comment });
  if (value.decision === "return" && !value.comment) throw new Error("Enter a comment before returning the task.");
  const db = await createClient();
  const update = value.decision === "approve" ? { status: "done", submission_comment: null } : { status: "needs_changes", review_comment: value.comment, submission_comment: null };
  const { data, error } = await db.from("tasks").update(update).eq("id", value.id).eq("status", "awaiting_approval").eq("is_archived", false).select("client_id").single();
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

export async function browseAppointmentClients(term: string, page: number): Promise<{ matches: NameMatch[]; hasMore: boolean }> {
  const { profile } = await requireActiveUser();
  requireRecordManager(profile.role);
  const query = z.string().trim().max(100).parse(term);
  const pageNumber = z.number().int().min(0).max(500).parse(page);
  const offset = pageNumber * 20;
  const db = await createClient();
  let request = db.from("clients").select("id,full_name,email,contact_no").eq("is_archived", false)
    .order("full_name").order("id").range(offset, offset + 20);
  if (query) request = request.ilike("full_name", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await request;
  if (error) fail(error);
  const rows = data ?? [];
  return { matches: rows.slice(0, 20).map((row) => ({ id: row.id, name: row.full_name, detail: row.email, contact: row.contact_no })), hasMore: rows.length > 20 };
}

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
