import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const LOG_PAGE_SIZE = 25;
export type LogFilters = { from: string; to: string; user: string; activity: string };
export type LogRow = { id: number; actor_id: string | null; action: string; entity_type: string | null; entity_id: string | null; created_at: string; profiles: { full_name: string | null } | null };
export const LOG_ACTIONS = ["login", "logout", "failed_login", "create", "update", "complete", "assign", "status_change", "archive", "restore", "approve", "role_change", "deactivate", "reactivate", "email_change", "password_reset", "password_change", "export"];

export function parseLogFilters(params: URLSearchParams): LogFilters {
  const date = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : "";
  const user = params.get("user") ?? "";
  const activity = params.get("activity") ?? "";
  return { from: date(params.get("from")), to: date(params.get("to")), user: /^[0-9a-f-]{36}$/i.test(user) ? user : "", activity: LOG_ACTIONS.includes(activity) ? activity : "" };
}

export function parseLogPage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export async function requireLogAdmin() {
  const session = await requireActiveUser();
  if (session.profile.role !== "admin") redirect("/dashboard");
  return session;
}

export async function listLogUsers() {
  await requireLogAdmin();
  const db = await createClient();
  const { data, error } = await db.from("profiles").select("id,full_name").order("full_name");
  if (error) throw error;
  return data ?? [];
}

function filteredQuery(db: Awaited<ReturnType<typeof createClient>>, filters: LogFilters) {
  let query = db.from("activity_log").select("id,actor_id,action,entity_type,entity_id,created_at,profiles!actor_id(full_name)", { count: "exact" });
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00+08:00`);
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00+08:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  if (filters.user) query = query.eq("actor_id", filters.user);
  if (filters.activity) query = query.eq("action", filters.activity);
  return query.order("created_at", { ascending: false }).order("id", { ascending: false });
}

export async function getLogPage(filters: LogFilters, page: number) {
  await requireLogAdmin();
  const db = await createClient();
  const start = (page - 1) * LOG_PAGE_SIZE;
  const { data, count, error } = await filteredQuery(db, filters).range(start, start + LOG_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as LogRow[], count: count ?? 0 };
}

export async function getAllFilteredLogs(filters: LogFilters) {
  await requireLogAdmin();
  const db = await createClient();
  const rows: LogRow[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await filteredQuery(db, filters).range(start, start + 499);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as LogRow[]));
    if (!data || data.length < 500) break;
  }
  return rows;
}
