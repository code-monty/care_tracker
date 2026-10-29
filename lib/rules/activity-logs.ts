import type { LogRow } from "@/lib/data/activity-logs";

const nouns: Record<string, string> = { clients: "client", attorneys: "attorney", respondents: "respondent", appointments: "appointment", tasks: "task", profiles: "user" };
const verbs: Record<string, string> = { create: "Added", update: "Updated", archive: "Archived", restore: "Restored", approve: "Approved", role_change: "Changed role for", deactivate: "Deactivated", reactivate: "Reactivated", email_change: "Changed email for", password_reset: "Reset password for", password_change: "Changed password for", export: "Exported" };

export function activityDescription(row: Pick<LogRow, "action" | "entity_type" | "entity_id">) {
  if (row.action === "login") return "Signed in";
  if (row.action === "logout") return "Signed out";
  if (row.action === "failed_login") return "Failed sign-in attempt";
  if (row.action === "complete" && row.entity_type === "tasks") return `Completed task${row.entity_id ? ` #${row.entity_id.slice(0, 8)}` : ""}`;
  if (row.action === "assign" && row.entity_type === "tasks") return `Assigned task${row.entity_id ? ` #${row.entity_id.slice(0, 8)}` : ""}`;
  if (row.action === "status_change" && row.entity_type === "tasks") return "Changed task status (completed or reopened)";
  if (row.action === "status_change") return `Changed ${nouns[row.entity_type ?? ""] ?? "record"} status`;
  const verb = verbs[row.action] ?? "Changed";
  const noun = row.entity_type === "activity_log" ? "activity logs" : nouns[row.entity_type ?? ""] ?? "record";
  return `${verb} ${noun}${row.entity_id ? ` #${row.entity_id.slice(0, 8)}` : ""}`;
}

export function formatLogDateTime(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit" }).format(date),
    time: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(date) + `.${String(date.getMilliseconds()).padStart(3, "0")}`,
  };
}

export function logActorName(row: Pick<LogRow, "actor_id" | "profiles">) {
  return row.actor_id ? row.profiles?.full_name?.trim() || "Former or unnamed user" : "Unidentified user";
}
