"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Clock3, Eye, List, MoreVertical, Plus, Search, UserRound, X } from "lucide-react";
import { Appointment, AppointmentStatus, SortKey, filterAppointments, getCalendarDays, sortAppointments } from "@/lib/rules/appointments";
import styles from "./appointments.module.css";

const PAGE_SIZE = 6;
const manilaTodayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
const displayDateFormatter = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" });

function todayInManila() {
  const parts = manilaTodayFormatter.formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatDate(date: string) {
  return displayDateFormatter.format(new Date(`${date}T12:00:00+08:00`));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, hours, minutes));
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={styles.dialog} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogBackdrop} aria-hidden="true" />
    <div role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title" className={styles.dialogPosition}>
      <div className={styles.dialogCard}>
        <div className={styles.dialogHeader}>
          <h2 id="appointment-dialog-title">{title}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close dialog"><X aria-hidden="true" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const [today] = useState(() => todayInManila());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("month");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "date", direction: "asc" });
  const [page, setPage] = useState(1);
  const [calendarMonth, setCalendarMonth] = useState(() => today.slice(0, 7));
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [notice, setNotice] = useState("");
  const [reasonChoice, setReasonChoice] = useState("Follow-up");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const filtered = useMemo(() => sortAppointments(filterAppointments(appointments, { search, dateFilter, statusFilter, today }), sort), [appointments, search, dateFilter, statusFilter, sort, today]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  function toggleSort(key: SortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  }

  function shiftMonth(amount: number) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + amount, 1);
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const reason = reasonChoice === "Other" ? String(data.get("customReason") ?? "").trim() : reasonChoice;
    if (!form.reportValidity() || !reason) return;
    const appointment: Appointment = {
      id: crypto.randomUUID(),
      clientName: String(data.get("clientName")).trim(),
      date: String(data.get("date")),
      time: String(data.get("time")),
      reason,
      status: "Pending",
    };
    setAppointments((current) => [...current, appointment]);
    setDateFilter("all");
    setPage(1);
    setCalendarMonth(appointment.date.slice(0, 7));
    setNotice(`${appointment.clientName}'s appointment was added temporarily.`);
    setAdding(false);
    setReasonChoice("Follow-up");
  }

  function updateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const clientName = String(data.get("clientName") ?? "").trim();
    const reason = String(data.get("reason") ?? "").trim();
    const date = String(data.get("date") ?? "");
    const time = String(data.get("time") ?? "");
    if (!clientName || !reason || !date || !time) return;
    setAppointments((current) => current.map((item) => item.id === editing.id ? { ...item, clientName, reason, date, time, status: String(data.get("status")) as AppointmentStatus } : item));
    setNotice(`${clientName}'s appointment was updated temporarily.`);
    setEditing(null);
  }

  function actions(appointment: Appointment) {
    return <div className={styles.rowActions}><button type="button" className={styles.detailsButton} onClick={() => setSelected(appointment)}><Eye aria-hidden="true" size={17} /> View details</button><details className={styles.actionMenu}><summary aria-label={`More actions for ${appointment.clientName}`}><MoreVertical aria-hidden="true" size={20} /></summary><div><button type="button" onClick={() => { setEditing(appointment); }}>Edit appointment</button><button type="button" onClick={() => { setEditing(appointment); }}>Change status</button></div></details></div>;
  }

  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <main className={styles.appointments}>
      <header className={styles.pageHeader}>
        <div><h1>Appointments</h1><p>Review and organize client appointments across list and calendar views.</p></div>
        <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}><Plus aria-hidden="true" size={18} /> Add Appointment</button>
      </header>

      {notice && <div className={styles.notice} role="status"><span>{notice} Entries on this page are cleared when it is reloaded.</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X aria-hidden="true" size={17} /></button></div>}

      <section className={styles.workspace} aria-label="Appointments workspace">
        <div className={styles.toolbar}>
          <label className={styles.searchField}><Search aria-hidden="true" size={18} /><span className={styles.srOnly}>Search appointments</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search client or reason" /></label>
          <label className={styles.selectField}><CalendarDays aria-hidden="true" size={18} /><span className={styles.srOnly}>Filter by date</span><select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1); }}><option value="all">All dates</option><option value="today">Today</option><option value="month">This month</option><option value="upcoming">Upcoming</option></select></label>
          <label className={styles.selectField}><span className={styles.statusDot} aria-hidden="true" /><span className={styles.srOnly}>Filter by status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as AppointmentStatus | "all"); setPage(1); }}><option value="all">All statuses</option><option value="Confirmed">Confirmed</option><option value="Pending">Pending</option><option value="Cancelled">Cancelled</option></select></label>
          <div className={styles.viewToggle} aria-label="Appointment view"><button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" size={16} /> List</button><button type="button" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}><CalendarDays aria-hidden="true" size={16} /> Calendar</button></div>
        </div>

        {view === "list" ? <>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr>
                {([["clientName", "Client name"], ["date", "Date & time"], ["reason", "Reason"], ["status", "Status"]] as [SortKey, string][]).map(([key, label]) => <th key={key} scope="col"><button type="button" onClick={() => toggleSort(key)}>{label}{sort.key === key ? (sort.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : null}</button></th>)}
                <th scope="col">Actions</th>
              </tr></thead>
              <tbody>{paged.map((appointment) => <tr key={appointment.id}><td><strong>{appointment.clientName}</strong></td><td><span className={styles.dateValue}>{formatDate(appointment.date)}</span><span className={styles.timeValue}>{formatTime(appointment.time)}</span></td><td>{appointment.reason}</td><td><span className={`${styles.status} ${styles[appointment.status.toLowerCase()]}`}>{appointment.status}</span></td><td>{actions(appointment)}</td></tr>)}</tbody>
            </table>
            {paged.length === 0 && <EmptyState filtered={appointments.length > 0} onAdd={() => setAdding(true)} />}
          </div>
          <div className={styles.mobileList}>
            {paged.map((appointment) => <article key={appointment.id} className={styles.mobileCard}><div className={styles.cardTop}><strong>{appointment.clientName}</strong><span className={`${styles.status} ${styles[appointment.status.toLowerCase()]}`}>{appointment.status}</span></div><dl><div><dt>Date</dt><dd>{formatDate(appointment.date)}</dd></div><div><dt>Time</dt><dd>{formatTime(appointment.time)}</dd></div><div><dt>Reason</dt><dd>{appointment.reason}</dd></div></dl>{actions(appointment)}</article>)}
            {paged.length === 0 && <EmptyState filtered={appointments.length > 0} onAdd={() => setAdding(true)} />}
          </div>
          <footer className={styles.pagination}><p>Showing {rangeStart} to {rangeEnd} of {filtered.length} appointments</p><div><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></footer>
        </> : <div className={styles.calendarView}>
          <div className={styles.calendarHeader}><button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button><h2>{monthFormatter.format(new Date(`${calendarMonth}-01T12:00:00`))}</h2><button type="button" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button></div>
          <div className={styles.weekdays} aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className={styles.calendarGrid}>{calendarDays.map((day) => { const dayAppointments = filtered.filter((appointment) => appointment.date === day.date); return <div key={day.date} className={`${styles.calendarDay} ${day.inMonth ? "" : styles.outsideMonth} ${day.date === today ? styles.today : ""}`}><span className={styles.dayNumber}>{day.day}</span><div className={styles.dayItems}>{dayAppointments.map((appointment) => <button key={appointment.id} type="button" onClick={() => setSelected(appointment)}><span>{formatTime(appointment.time)}</span>{appointment.clientName}</button>)}</div></div>; })}</div>
          {filtered.length === 0 && <p className={styles.calendarEmpty}>No appointments match the current filters.</p>}
        </div>}
      </section>

      {adding && <Modal title="Add appointment" onClose={() => { setAdding(false); setReasonChoice("Follow-up"); }}>
        <form className={styles.form} onSubmit={addAppointment}>
          <p className={styles.formIntro}>Create a temporary appointment for this session. It will not be saved after a page reload.</p>
          <label><span>Client name <b aria-hidden="true">*</b></span><input name="clientName" autoFocus required maxLength={120} placeholder="Enter client name" /></label>
          <div className={styles.formRow}><label><span>Appointment date <b aria-hidden="true">*</b></span><input name="date" type="date" min={today} defaultValue={today} required /></label><label><span>Appointment time <b aria-hidden="true">*</b></span><input name="time" type="time" required /></label></div>
          <label><span>Reason <b aria-hidden="true">*</b></span><select name="reason" value={reasonChoice} onChange={(event) => setReasonChoice(event.target.value)}><option>Follow-up</option><option>Assessment</option><option>Consultation</option><option>Other</option></select></label>
          {reasonChoice === "Other" && <label><span>Custom reason <b aria-hidden="true">*</b></span><input name="customReason" required maxLength={100} placeholder="Enter appointment reason" /></label>}
          <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setAdding(false)}>Cancel</button><button type="submit" className={styles.primaryButton}>Add appointment</button></div>
        </form>
      </Modal>}

      {editing && <Modal title="Edit appointment" onClose={() => setEditing(null)}><form className={styles.form} onSubmit={updateAppointment}>
        <p className={styles.formIntro}>Changes to this appointment are temporary and disappear after a page reload.</p>
        <label><span>Client name</span><input name="clientName" defaultValue={editing.clientName} required maxLength={120} /></label>
        <div className={styles.formRow}><label><span>Appointment date</span><input name="date" type="date" defaultValue={editing.date} required /></label><label><span>Appointment time</span><input name="time" type="time" defaultValue={editing.time} required /></label></div>
        <label><span>Reason</span><input name="reason" defaultValue={editing.reason} required maxLength={100} /></label>
        <label><span>Status</span><select name="status" defaultValue={editing.status}><option>Pending</option><option>Confirmed</option><option>Cancelled</option></select></label>
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setEditing(null)}>Cancel</button><button type="submit" className={styles.primaryButton}>Save changes</button></div>
      </form></Modal>}

      {selected && <Modal title="Appointment details" onClose={() => setSelected(null)}>
        <div className={styles.details}><div className={styles.detailHero}><span><UserRound aria-hidden="true" size={22} /></span><div><small>Client</small><strong>{selected.clientName}</strong></div><span className={`${styles.status} ${styles[selected.status.toLowerCase()]}`}>{selected.status}</span></div><dl><div><dt><CalendarDays size={17} /> Date</dt><dd>{formatDate(selected.date)}</dd></div><div><dt><Clock3 size={17} /> Time</dt><dd>{formatTime(selected.time)}</dd></div><div><dt>Reason</dt><dd>{selected.reason}</dd></div></dl><p>Status changes, rescheduling, and cancellation will be available when persistent appointment records are added.</p><div className={styles.formActions}><button type="button" className={styles.primaryButton} onClick={() => setSelected(null)}>Done</button></div></div>
      </Modal>}
    </main>
  );
}

function EmptyState({ filtered, onAdd }: { filtered: boolean; onAdd: () => void }) {
  return <div className={styles.emptyState}><span><CalendarDays aria-hidden="true" size={28} /></span><h2>{filtered ? "No matching appointments" : "No appointments yet"}</h2><p>{filtered ? "Try changing the search or filters." : "Add an appointment to begin organizing the clinic schedule."}</p>{!filtered && <button type="button" className={styles.emptyButton} onClick={onAdd}><Plus aria-hidden="true" size={17} /> Add appointment</button>}</div>;
}
