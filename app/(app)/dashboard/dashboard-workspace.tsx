"use client";

import { useState } from "react";
import { dashboardForDate } from "@/lib/actions/records";
import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarClock, ChevronLeft, ChevronRight, Gavel, Users } from "lucide-react";
import styles from "./dashboard.module.css";
import type { DeadlineRecord } from "@/lib/rules/deadlines";

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function DashboardWorkspace({ initialDate, initialCount, initialAppointments, initialDeadlines, initialDeadlineCount }: { initialDate: string; initialCount: number; initialAppointments: { id: string; scheduled_at: string; reason: string; clients: { full_name: string } | { full_name: string }[] }[]; initialDeadlines: DeadlineRecord[]; initialDeadlineCount: number }) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [activeCount] = useState(initialCount);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [deadlines, setDeadlines] = useState(initialDeadlines);
  const [deadlineCount, setDeadlineCount] = useState(initialDeadlineCount);
  const [loadError, setLoadError] = useState(false);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  async function selectDate(date: string) { setSelectedDate(date); setLoadError(false); try { const result = await dashboardForDate(date); setAppointments(result.appointments); setDeadlines(result.deadlines); setDeadlineCount(result.deadlineCount); } catch { setLoadError(true); } }

  return (
    <main className={styles.dashboard}>
      <div className={styles.topBar}>
        <h1>Dashboard</h1>
        <p>HLT Psychological Services &bull; Client &amp; Attorney Monitoring Workstation</p>
      </div>

      <Link href="/clients" className={styles.clientCard} aria-label="View current active clients">
        <span className={styles.summaryIcon}><Users aria-hidden="true" size={26} /></span>
        <span className={styles.summaryText}>
          <span className={styles.summaryLabel}>Current Active Clients</span>
          <span className={styles.summaryCount}>{activeCount} <span>active clients</span></span>
          <span className={styles.summaryDescription}>View client records</span>
        </span>
        <span className={styles.summaryArrow}><ArrowRight aria-hidden="true" size={20} /></span>
      </Link>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="appointments-heading">
          <div className={styles.panelHeading}>
            <div>
              <div className={styles.headingTitle}><CalendarClock aria-hidden="true" size={21} /><h2 id="appointments-heading">Upcoming Appointments</h2></div>
              <p className={styles.headingDescription}>Appointments scheduled for the selected date.</p>
              <p className={styles.appointmentCount} aria-label={loadError ? "Appointment count unavailable" : `${appointments.length} appointments scheduled`}><strong>{loadError ? "—" : appointments.length}</strong><span>{selectedDate === today ? "today" : appointments.length === 1 ? "appointment" : "appointments"}</span></p>
            </div>
            <div className={styles.dateNavigator} aria-label="Appointment date">
              <button type="button" aria-label="Previous day" onClick={() => selectDate(shiftDate(selectedDate, -1))}><ChevronLeft aria-hidden="true" size={17} /></button>
              <label className={styles.dateField}>
                <CalendarDays aria-hidden="true" size={16} />
                <span className={styles.srOnly}>Select appointment date</span>
                <input type="date" value={selectedDate} onChange={(event) => event.target.value && selectDate(event.target.value)} aria-label="Select appointment date" />
              </label>
              <button type="button" aria-label="Next day" onClick={() => selectDate(shiftDate(selectedDate, 1))}><ChevronRight aria-hidden="true" size={17} /></button>
            </div>
          </div>
          {loadError ? <div className={styles.emptyState} role="alert"><p>Appointments could not be loaded for this date.</p></div> : appointments.length ? <div className={styles.appointmentTableWrap}><table className={styles.appointmentTable}><thead><tr><th scope="col">Client</th><th scope="col">Time</th><th scope="col">Reason</th></tr></thead><tbody>{appointments.map((appointment) => { const client = Array.isArray(appointment.clients) ? appointment.clients[0] : appointment.clients; return <tr key={appointment.id}><td><strong>{client.full_name}</strong></td><td>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(appointment.scheduled_at))}</td><td>{appointment.reason}</td></tr>; })}</tbody></table></div> : <div className={styles.emptyState}>
            <CalendarDays aria-hidden="true" size={30} />
            <p className={styles.emptyTitle}>No appointments to show</p>
            <p>No appointments are scheduled for this date.</p>
          </div>}
          <Link href="/appointments" className={styles.panelLink}>View all appointments <ArrowRight aria-hidden="true" size={18} /></Link>
        </section>

        <section className={styles.panel} aria-labelledby="deadlines-heading">
          <div className={styles.panelHeading}>
            <div>
              <div className={styles.headingTitle}><Gavel aria-hidden="true" size={21} /><h2 id="deadlines-heading">Deadlines</h2></div>
              <p className={styles.headingDescription}>Court dates, filings, and other case deadlines.</p>
            </div>
            <span className={styles.badge}>{deadlineCount} tracked</span>
          </div>
          {deadlines.length ? <div className={styles.appointmentTableWrap}><table className={`${styles.appointmentTable} ${styles.deadlineTable}`}><thead><tr><th scope="col">Client</th><th scope="col">Attorney</th><th scope="col">Task</th><th scope="col">Date</th><th scope="col">Status</th></tr></thead><tbody>{deadlines.map((task) => <tr key={task.id}><td><Link href={`/clients/${task.clientId}`}>{task.clientName}</Link></td><td>{task.attorneyName}</td><td>{task.title}</td><td>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${task.dueDate}T12:00:00+08:00`))}</td><td><span className={`${styles.deadlineStatus} ${styles[task.deadlineStatus.replace(" ", "").toLowerCase()]}`}>{task.deadlineStatus}</span></td></tr>)}</tbody></table></div> : <div className={styles.emptyState}>
            <CalendarClock aria-hidden="true" size={30} />
            <p className={styles.emptyTitle}>No deadlines to show</p>
            <p>Open tasks for active clients will appear here.</p>
          </div>}
          <Link href="/deadlines" className={styles.panelLink}>View all deadlines <ArrowRight aria-hidden="true" size={18} /></Link>
        </section>
      </div>
    </main>
  );
}
