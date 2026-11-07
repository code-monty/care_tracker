"use client";

import { useEffect, useState } from "react";
import { unavailableAppointmentSlots } from "@/lib/actions/records";
import { APPOINTMENT_SLOTS } from "@/lib/rules/appointment-slots";

export default function AppointmentTimeFields({ initialDate, initialTime = "", appointmentId, refreshKey = 0, className, initiallyCancelled = false }: {
  initialDate: string; initialTime?: string; appointmentId?: string; refreshKey?: number; className?: string; initiallyCancelled?: boolean;
}) {
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [occupied, setOccupied] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let active = true;
    unavailableAppointmentSlots(date, appointmentId).then((slots) => {
      if (!active) return;
      setOccupied(slots);
      setTime((current) => slots.includes(current) && !(initiallyCancelled && date === initialDate && current === initialTime) ? "" : current);
      setError(false);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, appointmentId, refreshKey, initiallyCancelled, initialDate, initialTime]);

  const existingOffSlot = date === initialDate && initialTime && !APPOINTMENT_SLOTS.some((slot) => slot.value === initialTime);
  return <div className={className}>
    <label><span>Appointment date <b aria-hidden="true">*</b></span><input name="date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setTime(""); setLoading(Boolean(event.target.value)); }} required /></label>
    <label><span>Appointment time <b aria-hidden="true">*</b></span><select name="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={error || loading} required>
      <option value="">{loading ? "Loading available times..." : "Select an available time"}</option>
      {existingOffSlot && <option value={initialTime}>{initialTime} (existing time)</option>}
      {APPOINTMENT_SLOTS.map((slot) => {
        const booked = occupied.includes(slot.value);
        const keptCancelledTime = initiallyCancelled && date === initialDate && slot.value === initialTime;
        return <option key={slot.value} value={slot.value} disabled={booked && !keptCancelledTime}>{slot.label}{booked && !keptCancelledTime ? " — Booked" : ""}</option>;
      })}
    </select>{error && <small role="alert">Unable to load available times. Change the date to retry.</small>}</label>
  </div>;
}
