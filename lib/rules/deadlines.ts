export type DeadlineStatus = "Overdue" | "Due Soon" | "Upcoming" | "Done";

export type DeadlineRecord = {
  id: string;
  clientId: string;
  clientName: string;
  clientStatus: string;
  attorneyId: string;
  attorneyName: string;
  title: string;
  assignedTo: string;
  assignedName: string;
  dueDate: string;
  status: "open" | "done";
  deadlineStatus: DeadlineStatus;
};

export function deadlineStatus(dueDate: string, status: "open" | "done", today: string): DeadlineStatus {
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
