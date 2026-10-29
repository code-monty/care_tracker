import AppointmentsWorkspace from "./appointments-workspace";
import { getAppointments } from "@/lib/data/records";
import type { AppointmentStatus } from "@/lib/rules/appointments";
import { requireActiveUser } from "@/lib/auth/session";

export default async function AppointmentsPage() {
  const [rows, { profile }] = await Promise.all([getAppointments(), requireActiveUser()]);
  const appointments = rows.map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(row.scheduled_at));
    const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
    return { id: row.id, clientId: row.client_id, clientName: client.full_name, clientContact: client.contact_no, clientEmail: client.email, date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}`, reason: row.reason, status: (row.status[0].toUpperCase() + row.status.slice(1)) as AppointmentStatus };
  });
  return <AppointmentsWorkspace initialAppointments={appointments} canManage={profile.role !== "staff"} />;
}
