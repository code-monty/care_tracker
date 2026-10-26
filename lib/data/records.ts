import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth/session";

export async function getClients() {
  await requireActiveUser();
  const db = await createClient();
  const { data, error } = await db.from("clients").select("id,full_name,birthdate,contact_no,email,address,status,attorney_id,attorneys(full_name,contact_no,email),respondents(full_name,birthdate,contact_no,email,address)").eq("is_archived", false).order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getAttorneys() {
  await requireActiveUser();
  const db = await createClient();
  const { data, error } = await db.from("attorneys").select("id,full_name,contact_no,email").order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getAttorneyClients(attorneyId?: string) {
  await requireActiveUser();
  const db = await createClient();
  let query = db.from("clients").select("id,full_name,status,attorney_id").eq("is_archived", false);
  if (attorneyId) query = query.eq("attorney_id", attorneyId);
  const { data, error } = await query.order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getAppointments() {
  await requireActiveUser();
  const db = await createClient();
  const { data, error } = await db.from("appointments").select("id,client_id,scheduled_at,reason,status,clients!inner(id,full_name,contact_no,email,is_archived)").eq("clients.is_archived", false).order("scheduled_at");
  if (error) throw error;
  return data ?? [];
}

export async function getDashboardRecords(date: string) {
  await requireActiveUser();
  const db = await createClient();
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86400000);
  const [clients, appointments] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }).eq("status", "active").eq("is_archived", false),
    db.from("appointments").select("id,scheduled_at,reason,clients!inner(full_name,is_archived)").gte("scheduled_at", start.toISOString()).lt("scheduled_at", end.toISOString()).neq("status", "cancelled").eq("clients.is_archived", false).order("scheduled_at"),
  ]);
  if (clients.error) throw clients.error;
  if (appointments.error) throw appointments.error;
  return { activeClients: clients.count ?? 0, appointments: appointments.data ?? [] };
}
