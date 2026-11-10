import DashboardWorkspace from "./dashboard-workspace";
import { getDashboardRecords } from "@/lib/data/records";
import { requireActiveUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { profile } = await requireActiveUser();
  const { activeClients, appointments, deadlines, deadlineCount, taskStats } = await getDashboardRecords(date);
  return <DashboardWorkspace initialDate={date} initialCount={activeClients} initialAppointments={profile.role === "staff" ? [] : appointments} initialDeadlines={deadlines} initialDeadlineCount={deadlineCount} initialTaskStats={profile.role === "admin" ? taskStats : null} showAppointments={profile.role !== "staff"} />;
}
