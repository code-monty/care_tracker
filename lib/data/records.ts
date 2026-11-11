import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth/session";
import type { DeadlineRecord, DeadlineStatus, TaskReviewEvent, TaskStatus } from "@/lib/rules/deadlines";
import { assignedDashboardTaskStats, dashboardDeadlinesForUser, dashboardTaskStats, sortDeadlines } from "@/lib/rules/deadlines";

export async function getClients() {
  await requireActiveUser();
  const db = await createClient();
  const { data, error } = await db.from("clients").select("id,full_name,birthdate,sex,contact_no,email,address,status,attorney_id,attorneys(full_name,contact_no,email),respondents(full_name,birthdate,sex,contact_no,email,address)").eq("is_archived", false).order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getAttorneys() {
  await requireActiveUser();
  const db = await createClient();
  const { data, error } = await db.from("attorneys").select("id,full_name,contact_no,email").eq("is_archived", false).order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getArchivedAttorneys() {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const { data, error } = await db.from("attorneys").select("id,full_name,contact_no,email").eq("is_archived", true).order("full_name").order("id");
  if (error) throw error;
  return data ?? [];
}

export async function getArchivedClients() {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const { data, error } = await db.from("clients").select("id,full_name").eq("is_archived", true).order("full_name").order("id");
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
  const { data, error } = await db.from("appointments").select("id,client_id,guest_name,scheduled_at,reason,status,clients(id,full_name,contact_no,email,is_archived)").order("scheduled_at");
  if (error) throw error;
  return (data ?? []).filter((row) => !row.clients || !(Array.isArray(row.clients) ? row.clients[0] : row.clients)?.is_archived);
}

export async function getDashboardRecords(date: string) {
  const { profile } = await requireActiveUser();
  const db = await createClient();
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86400000);
  const [clients, appointments] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }).eq("status", "active").eq("is_archived", false),
    db.from("appointments").select("id,guest_name,scheduled_at,reason,clients(full_name,is_archived)").gte("scheduled_at", start.toISOString()).lt("scheduled_at", end.toISOString()).neq("status", "cancelled").order("scheduled_at"),
  ]);
  if (clients.error) throw clients.error;
  if (appointments.error) throw appointments.error;
  const deadlines = await getDeadlineRecords();
  const openDeadlines = deadlines.filter((task) => task.status !== "done" && task.clientStatus === "active");
  const taskStats = profile.role === "admin" ? dashboardTaskStats(openDeadlines) : assignedDashboardTaskStats(openDeadlines, profile.id);
  return { activeClients: clients.count ?? 0, appointments: (appointments.data ?? []).filter((row) => !row.clients || !(Array.isArray(row.clients) ? row.clients[0] : row.clients)?.is_archived), ...dashboardDeadlinesForUser(openDeadlines, profile.role, profile.id), taskStats };
}

export async function getActivePersonnel() {
  await requireActiveUser();
  const db = await createClient();
  const { data, error } = await db.rpc("active_personnel_directory");
  if (error) throw error;
  return (data ?? []) as { id: string; full_name: string }[];
}

export async function getDeadlineRecords(clientId?: string): Promise<DeadlineRecord[]> {
  const { profile } = await requireActiveUser();
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
  const ids = (tasks.data ?? []).map((task) => task.id);
  const assigneeIds = [...new Set((tasks.data ?? []).map((task) => task.assigned_to))];
  const assigneeRoles = profile.role === "admin" && assigneeIds.length
    ? await db.from("profiles").select("id,role").in("id", assigneeIds)
    : { data: [], error: null };
  if (assigneeRoles.error) throw assigneeRoles.error;
  const roleMap = new Map((assigneeRoles.data ?? []).map((person) => [person.id, person.role as "staff" | "secretary"]));
  const reviews = ids.length ? await db.from("task_review_events").select("task_id,event,comment,created_at").in("task_id", ids).order("created_at") : { data: [], error: null };
  if (reviews.error) throw reviews.error;
  const reviewMap = new Map<string, TaskReviewEvent[]>();
  for (const row of reviews.data ?? []) {
    const entries = reviewMap.get(row.task_id) ?? [];
    entries.push({ event: row.event as TaskReviewEvent["event"], comment: row.comment, createdAt: row.created_at });
    reviewMap.set(row.task_id, entries);
  }
  const clientMap = new Map((clients.data ?? []).map((client) => [client.id, client]));
  const staffMap = new Map(((staff.data ?? []) as { id: string; full_name: string }[]).map((person) => [person.id, person.full_name]));
  return (tasks.data ?? []).flatMap((task) => {
    const client = clientMap.get(task.client_id);
    if (!client) return [];
    const attorney = Array.isArray(client.attorneys) ? client.attorneys[0] : client.attorneys;
    return [{
      id: task.id, clientId: task.client_id, clientName: client.full_name, clientStatus: client.status,
      attorneyId: client.attorney_id, attorneyName: attorney?.full_name ?? "No current attorney",
      title: task.title, assignedTo: task.assigned_to, assignedName: staffMap.get(task.assigned_to) ?? "Former staff member", assignedRole: roleMap.get(task.assigned_to) ?? null,
      dueDate: task.due_date, status: task.status as TaskStatus, deadlineStatus: task.deadline_status as DeadlineStatus,
      reviewHistory: reviewMap.get(task.id) ?? [],
    }];
  }).sort(sortDeadlines);
}

export async function getArchivedTasks() {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") throw new Error("Access denied");
  const db = await createClient();
  const { data, error } = await db.from("tasks").select("id,title,client_id,due_date,status,clients(full_name)").eq("is_archived", true).order("due_date");
  if (error) throw error;
  return (data ?? []).map((task) => ({
    id: task.id, title: task.title, dueDate: task.due_date, status: task.status,
    clientName: (Array.isArray(task.clients) ? task.clients[0] : task.clients)?.full_name ?? "Former client",
  }));
}
