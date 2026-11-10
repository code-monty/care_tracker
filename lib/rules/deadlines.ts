export type DeadlineStatus = "Overdue" | "Due Soon" | "Upcoming" | "Done";
export type TaskStatus = "open" | "awaiting_approval" | "needs_changes" | "done";
export type TaskReviewEvent = { event: "submitted" | "approved" | "returned" | "completed"; comment: string | null; createdAt: string };

export type DeadlineRecord = {
  id: string;
  clientId: string;
  clientName: string;
  clientStatus: string;
  attorneyId: string | null;
  attorneyName: string;
  title: string;
  assignedTo: string;
  assignedName: string;
  assignedRole: "staff" | "secretary" | null;
  dueDate: string;
  status: TaskStatus;
  deadlineStatus: DeadlineStatus;
  reviewHistory: TaskReviewEvent[];
};

export type DashboardTaskStats = { upcoming: number; dueSoon: number; overdue: number; awaitingApproval: number };

export function dashboardTaskStats(tasks: Pick<DeadlineRecord, "status" | "deadlineStatus" | "clientStatus">[]): DashboardTaskStats {
  const stats = { upcoming: 0, dueSoon: 0, overdue: 0, awaitingApproval: 0 };
  for (const task of tasks) {
    if (task.clientStatus !== "active" || task.status === "done") continue;
    if (task.deadlineStatus === "Upcoming") stats.upcoming++;
    if (task.deadlineStatus === "Due Soon") stats.dueSoon++;
    if (task.deadlineStatus === "Overdue") stats.overdue++;
    if (task.status === "awaiting_approval") stats.awaitingApproval++;
  }
  return stats;
}

export function deadlineStatus(dueDate: string, status: TaskStatus, today: string): DeadlineStatus {
  if (status === "done") return "Done";
  if (dueDate < today) return "Overdue";
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 3);
  return dueDate <= end.toISOString().slice(0, 10) ? "Due Soon" : "Upcoming";
}

export function manilaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function sortDeadlines(a: DeadlineRecord, b: DeadlineRecord) {
  return a.dueDate.localeCompare(b.dueDate) || a.clientName.localeCompare(b.clientName) || a.title.localeCompare(b.title);
}
