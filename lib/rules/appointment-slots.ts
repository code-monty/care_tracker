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
