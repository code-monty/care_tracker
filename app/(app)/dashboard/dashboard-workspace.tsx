"use client";

import { useState } from "react";
import { dashboardForDate } from "@/lib/actions/records";
import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarClock, ChevronLeft, ChevronRight, Gavel, Users } from "lucide-react";
import styles from "./dashboard.module.css";

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function DashboardWorkspace({ initialDate, initialCount, initialAppointments }: { initialDate: string; initialCount: number; initialAppointments: { id: string; scheduled_at: string; reason: string; clients: { full_name: string } | { full_name: string }[] }[] }) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [activeCount] = useState(initialCount);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [loadError, setLoadError] = useState(false);
  async function selectDate(date: string) { setSelectedDate(date); setLoadError(false); try { const result = await dashboardForDate(date); setAppointments(result.appointments); } catch { setLoadError(true); } }

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
              <div className={styles.headingTitle}><CalendarClock aria-hidden="true" size={21} /><h2 id="appointments-heading">Upcoming Appointments</h2><span className={styles.badge} aria-label={`${appointments.length} appointments scheduled`}>{appointments.length}</span></div>
              <p className={styles.headingDescription}>Appointments scheduled for the selected date.</p>
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
          {loadError ? <div className={styles.emptyState} role="alert"><p>Appointments could not be loaded for this date.</p></div> : appointments.length ? <div className={styles.emptyState}>{appointments.map((appointment) => { const client = Array.isArray(appointment.clients) ? appointment.clients[0] : appointment.clients; return <p key={appointment.id}><strong>{client.full_name}</strong> · {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(appointment.scheduled_at))} · {appointment.reason}</p>; })}</div> : <div className={styles.emptyState}>
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
            <span className={styles.badge}>0 tracked</span>
          </div>
          <div className={styles.emptyState}>
            <CalendarClock aria-hidden="true" size={30} />
            <p className={styles.emptyTitle}>No deadlines to show</p>
            <p>Deadlines will appear here when records become available.</p>
          </div>
          <Link href="/deadlines" className={styles.panelLink}>View all deadlines <ArrowRight aria-hidden="true" size={18} /></Link>
        </section>
      </div>
    </main>
  );
}
