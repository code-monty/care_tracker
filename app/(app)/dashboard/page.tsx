import DashboardWorkspace from "./dashboard-workspace";
import { getDashboardRecords } from "@/lib/data/records";

export default async function DashboardPage() {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { activeClients, appointments, deadlines, deadlineCount } = await getDashboardRecords(date);
  return <DashboardWorkspace initialDate={date} initialCount={activeClients} initialAppointments={appointments} initialDeadlines={deadlines} initialDeadlineCount={deadlineCount} />;
}
