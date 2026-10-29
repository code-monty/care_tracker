import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth/session";
import type { DeadlineRecord, DeadlineStatus } from "@/lib/rules/deadlines";
import { sortDeadlines } from "@/lib/rules/deadlines";

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
  const deadlines = await getDeadlineRecords();
  const openDeadlines = deadlines.filter((task) => task.status === "open" && task.clientStatus === "active");
  return { activeClients: clients.count ?? 0, appointments: appointments.data ?? [], deadlines: openDeadlines.slice(0, 5), deadlineCount: openDeadlines.length };
}

export async function getActivePersonnel() {
  await requireActiveUser();
  const db = await createClient();
  const { data, error } = await db.rpc("active_personnel_directory");
  if (error) throw error;
  return (data ?? []) as { id: string; full_name: string }[];
}

export async function getDeadlineRecords(clientId?: string): Promise<DeadlineRecord[]> {
  await requireActiveUser();
  const db = await createClient();
  let query = db.from("deadline_status").select("id,client_id,title,assigned_to,due_date,status,deadline_status");
  if (clientId) query = query.eq("client_id", clientId);
  const [tasks, clients, staff] = await Promise.all([
    query.order("due_date"),
    db.from("clients").select("id,full_name,status,attorney_id,is_archived,attorneys(full_name)").eq("is_archived", false),
    db.rpc("active_personnel_directory"),
  ]);
  if (tasks.error) throw tasks.error;
  if (clients.error) throw clients.error;
  if (staff.error) throw staff.error;
  const clientMap = new Map((clients.data ?? []).map((client) => [client.id, client]));
  const staffMap = new Map(((staff.data ?? []) as { id: string; full_name: string }[]).map((person) => [person.id, person.full_name]));
  return (tasks.data ?? []).flatMap((task) => {
    const client = clientMap.get(task.client_id);
    if (!client) return [];
    const attorney = Array.isArray(client.attorneys) ? client.attorneys[0] : client.attorneys;
    return [{
      id: task.id, clientId: task.client_id, clientName: client.full_name, clientStatus: client.status,
      attorneyId: client.attorney_id, attorneyName: attorney?.full_name ?? "",
      title: task.title, assignedTo: task.assigned_to, assignedName: staffMap.get(task.assigned_to) ?? "Former staff member",
      dueDate: task.due_date, status: task.status as "open" | "done", deadlineStatus: task.deadline_status as DeadlineStatus,
    }];
  }).sort(sortDeadlines);
}
