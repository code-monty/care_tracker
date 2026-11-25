const manilaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayInManila(now = new Date()) {
  const parts = manilaDateFormatter.formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isPastAppointmentDate(date: string, now = new Date()) {
  return date < todayInManila(now);
}

export function isPassedAppointmentSlot(date: string, time: string, now = new Date()) {
  const scheduled = new Date(`${date}T${time}:00+08:00`);
  return Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= now.getTime();
}

export const APPOINTMENT_SLOTS = Array.from({ length: 9 }, (_, index) => {
  const hour = index + 8;
  const label = (value: number) => `${value % 12 || 12}:00 ${value < 12 ? "AM" : "PM"}`;
  return { value: `${String(hour).padStart(2, "0")}:00`, label: `${label(hour)} - ${label(hour + 1)}` };
});

export function occupiedAppointmentSlots(times: string[]) {
  return APPOINTMENT_SLOTS.filter(({ value }) => {
    const start = Number(value.slice(0, 2)) * 60;
    return times.some((time) => {
      const bookedStart = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
      return bookedStart < start + 60 && bookedStart + 60 > start;
    });
  }).map(({ value }) => value);
}
