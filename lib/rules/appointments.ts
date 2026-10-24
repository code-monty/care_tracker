export type AppointmentStatus = "Confirmed" | "Pending" | "Cancelled";
export type SortKey = "clientName" | "date" | "reason" | "status";
export interface Appointment { id: string; clientId?: string; clientName: string; clientContact?: string; clientEmail?: string; date: string; time: string; reason: string; status: AppointmentStatus; }

export function filterAppointments(appointments: Appointment[], filters: { search: string; dateFilter: string; statusFilter: AppointmentStatus | "all"; today: string }) {
  const currentMonth = filters.today.slice(0, 7);
  const query = filters.search.trim().toLocaleLowerCase();
  return appointments.filter((appointment) => {
    const matchesSearch = !query || `${appointment.clientName} ${appointment.reason}`.toLocaleLowerCase().includes(query);
    const matchesStatus = filters.statusFilter === "all" || appointment.status === filters.statusFilter;
    const matchesDate = filters.dateFilter === "all"
      || (filters.dateFilter === "today" && appointment.date === filters.today)
      || (filters.dateFilter === "month" && appointment.date.startsWith(currentMonth))
      || (filters.dateFilter === "upcoming" && appointment.date >= filters.today);
    return matchesSearch && matchesStatus && matchesDate;
  });
}

export function sortAppointments(appointments: Appointment[], sort: { key: SortKey; direction: "asc" | "desc" }) {
  return [...appointments].sort((left, right) => {
    const leftValue = sort.key === "date" ? `${left.date}T${left.time}` : left[sort.key];
    const rightValue = sort.key === "date" ? `${right.date}T${right.time}` : right[sort.key];
    const result = leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
    return sort.direction === "asc" ? result : -result;
  });
}

export function getCalendarDays(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date: dateValue, day: date.getDate(), inMonth: date.getMonth() === month - 1 };
  });
}
