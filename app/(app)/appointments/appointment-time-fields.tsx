"use client";

import { useEffect, useState } from "react";
import { unavailableAppointmentSlots } from "@/lib/actions/records";
import { APPOINTMENT_SLOTS, isPassedAppointmentSlot, isPastAppointmentDate, todayInManila } from "@/lib/rules/appointment-slots";
import styles from "./appointments.module.css";

function formatReadOnlyDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00+08:00`));
}

function formatReadOnlyTime(time: string) {
  const slot = APPOINTMENT_SLOTS.find((item) => item.value === time);
  if (slot) return slot.label;
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, hours, minutes));
}

export default function AppointmentTimeFields({ initialDate, initialTime = "", appointmentId, refreshKey = 0, className, initiallyCancelled = false }: {
  initialDate: string; initialTime?: string; appointmentId?: string; refreshKey?: number; className?: string; initiallyCancelled?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const today = todayInManila(now);
  const isHistoricalEdit = Boolean(appointmentId && isPastAppointmentDate(initialDate, now));
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [occupied, setOccupied] = useState<string[]>([]);
  const [loading, setLoading] = useState(!isHistoricalEdit);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = new Date();
      setNow(currentNow);
      setTime((current) => {
        if (!current) return current;
        const keptExisting = Boolean(appointmentId && !initiallyCancelled && date === initialDate && current === initialTime);
        return isPassedAppointmentSlot(date, current, currentNow) && !keptExisting ? "" : current;
      });
    }, 30_000);
    return () => clearInterval(timer);
  }, [appointmentId, date, initialDate, initialTime, initiallyCancelled]);

  useEffect(() => {
    if ((isHistoricalEdit && !rescheduling) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let active = true;
    unavailableAppointmentSlots(date, appointmentId).then((slots) => {
      if (!active) return;
      const currentNow = new Date();
      setNow(currentNow);
      setOccupied(slots);
      setTime((current) => {
        if (!current) return current;
        const keptCancelled = initiallyCancelled && date === initialDate && current === initialTime;
        if (slots.includes(current) && !keptCancelled) return "";
        const keptExisting = Boolean(appointmentId && !initiallyCancelled && date === initialDate && current === initialTime);
        if (isPassedAppointmentSlot(date, current, currentNow) && !keptExisting) return "";
        return current;
      });
      setError(false);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, appointmentId, refreshKey, initiallyCancelled, initialDate, initialTime, isHistoricalEdit, rescheduling]);

  if (isHistoricalEdit && !rescheduling) {
    return <div className={styles.historicalSchedule}>
      <input type="hidden" name="date" value={initialDate} />
      <input type="hidden" name="time" value={initialTime} />
      <div className={styles.historicalSummary}>
        <span>Scheduled date &amp; time</span>
        <strong>{formatReadOnlyDate(initialDate)} · {formatReadOnlyTime(initialTime)}</strong>
      </div>
      <button type="button" className={styles.rescheduleButton} onClick={() => { setRescheduling(true); setNow(new Date()); setDate(todayInManila()); setTime(""); setLoading(true); setError(false); }}>
        Reschedule date &amp; time
      </button>
    </div>;
  }

  const existingOffSlot = date === initialDate && initialTime && !APPOINTMENT_SLOTS.some((slot) => slot.value === initialTime);
  const hasAvailableSlot = Boolean(existingOffSlot) || APPOINTMENT_SLOTS.some((slot) => {
    const booked = occupied.includes(slot.value);
    const keptCancelledTime = initiallyCancelled && date === initialDate && slot.value === initialTime;
    const keptExistingSchedule = Boolean(appointmentId && !initiallyCancelled && date === initialDate && slot.value === initialTime);
    return !(booked && !keptCancelledTime) && !(isPassedAppointmentSlot(date, slot.value, now) && !keptExistingSchedule);
  });

  return <div className={className}>
    <label><span>Appointment date <b aria-hidden="true">*</b></span><input name="date" type="date" min={today} value={date} onChange={(event) => { setNow(new Date()); setDate(event.target.value); setTime(""); setLoading(Boolean(event.target.value)); }} required /></label>
    <label><span>Appointment time <b aria-hidden="true">*</b></span><select name="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={error || loading} required>
      <option value="">{loading ? "Loading available times..." : hasAvailableSlot ? "Select an available time" : "No available times on this date"}</option>
      {existingOffSlot && <option value={initialTime}>{initialTime} (existing time)</option>}
      {APPOINTMENT_SLOTS.map((slot) => {
        const booked = occupied.includes(slot.value);
        const keptCancelledTime = initiallyCancelled && date === initialDate && slot.value === initialTime;
        const keptExistingSchedule = Boolean(appointmentId && !initiallyCancelled && date === initialDate && slot.value === initialTime);
        const isBooked = booked && !keptCancelledTime;
        const isPassed = isPassedAppointmentSlot(date, slot.value, now) && !keptExistingSchedule;
        const disabled = isBooked || isPassed;
        const suffix = isBooked ? " — Booked" : isPassed ? " — Passed" : "";
        return <option key={slot.value} value={slot.value} disabled={disabled}>{slot.label}{suffix}</option>;
      })}
    </select>{error && <small role="alert">Unable to load available times. Change the date to retry.</small>}</label>
  </div>;
}
