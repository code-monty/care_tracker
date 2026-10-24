"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addClientSchema } from "@/lib/validation/client";
import { getDashboardRecords } from "@/lib/data/records";

const uuid = z.uuid();
const statusSchema = z.enum(["active", "inactive"]);
const appointmentSchema = z.object({ clientId: uuid, date: z.iso.date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), reason: z.string().trim().min(1).max(100), status: z.enum(["pending", "confirmed", "cancelled"]) });
function refresh() { for (const path of ["/clients", "/appointments", "/dashboard"]) revalidatePath(path); }
function fail(error: unknown): never { throw new Error(error instanceof Error ? error.message : "Unable to save record"); }

export async function createClientRecord(input: z.infer<typeof addClientSchema>, existingAttorneyId?: string) {
  await requireActiveUser();
  const value = addClientSchema.parse(input);
  const db = await createClient();
  const { data, error } = await db.rpc("create_client_record", { p_client: value, p_attorney_id: existingAttorneyId ? uuid.parse(existingAttorneyId) : null });
  if (error || !data) fail(error);
  refresh();
  return data as string;
}

export async function setClientStatus(id: string, status: string) {
  await requireActiveUser();
  const db = await createClient();
  const { error } = await db.from("clients").update({ status: statusSchema.parse(status) }).eq("id", uuid.parse(id)).eq("is_archived", false);
  if (error) fail(error);
  refresh();
}

export async function saveAppointment(input: z.infer<typeof appointmentSchema>, id?: string) {
  const { user } = await requireActiveUser();
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
