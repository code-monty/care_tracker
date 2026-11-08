"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { appointmentWarnings, saveAppointment } from "@/lib/actions/records";
import AppointmentTimeFields from "../../appointments/appointment-time-fields";
import formStyles from "../../appointments/appointments.module.css";
import styles from "./add-appointment-dialog.module.css";

const manilaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });

function todayInManila() {
  const parts = manilaDate.formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function AddClientAppointmentDialog({ clientId, clientName, onClose, onSaved }: {
  clientId: string; clientName: string; onClose: () => void; onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [today] = useState(todayInManila);
  const [reasonChoice, setReasonChoice] = useState("Follow-up");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const date = String(data.get("date") ?? "");
    const time = String(data.get("time") ?? "");
    const reason = reasonChoice === "Other" ? String(data.get("customReason") ?? "").trim() : reasonChoice;
    if (!form.reportValidity() || !reason) return;
    if (!time) { setError("Select an available time."); return; }

    setSaving(true);
    setError("");
    try {
      const warning = await appointmentWarnings(date, time);
      if (warning.past && !window.confirm("Appointment is in the past. Save anyway?")) return;
      const result = await saveAppointment({ clientId, guestName: null, date, time, reason, status: "pending" });
      if ("error" in result) {
        setError("Appointment time is no longer available.");
        setAvailabilityVersion((value) => value + 1);
        return;
      }
      dialogRef.current?.close();
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save appointment.");
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="client-add-appointment-title" onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }}>
    <div className={styles.header}><div className={styles.title}><CalendarPlus size={20} aria-hidden="true" /><h2 id="client-add-appointment-title">Add appointment</h2></div><button type="button" className={styles.closeButton} aria-label="Close dialog" disabled={saving} onClick={() => dialogRef.current?.close()}><X size={20} aria-hidden="true" /></button></div>
    <form className={formStyles.form} onSubmit={submit}>
      <p className={formStyles.formIntro}>Schedule an appointment for this client.</p>
      <div className={styles.clientField}><span>Client</span><strong>{clientName}</strong></div>
      <AppointmentTimeFields className={formStyles.formRow} initialDate={today} refreshKey={availabilityVersion} />
      {error && <small className={styles.error} role="alert">{error}</small>}
      {reasonChoice === "Other" ? <div className={formStyles.customReason}><label><span>Reason <b aria-hidden="true">*</b></span><input name="customReason" required maxLength={100} placeholder="Enter appointment reason" autoFocus /></label><button type="button" onClick={() => setReasonChoice("Follow-up")}>Choose a preset reason</button></div> : <label><span>Reason <b aria-hidden="true">*</b></span><select name="reason" value={reasonChoice} onChange={(event) => setReasonChoice(event.target.value)}><option>Follow-up</option><option>Assessment</option><option>Consultation</option><option>Other</option></select></label>}
      <div className={formStyles.formActions}><button type="button" className={formStyles.secondaryButton} disabled={saving} onClick={() => dialogRef.current?.close()}>Cancel</button><button type="submit" className={formStyles.primaryButton} disabled={saving}>{saving ? "Saving..." : "Add appointment"}</button></div>
    </form>
  </dialog>;
}
