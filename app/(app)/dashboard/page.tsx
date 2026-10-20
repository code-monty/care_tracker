"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarClock, ChevronLeft, ChevronRight, Gavel } from "lucide-react";
import styles from "./dashboard.module.css";

const manilaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });

function todayInManila() {
  const parts = manilaDate.formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(todayInManila);
  const isToday = selectedDate === todayInManila();
  const dateLabel = displayDate(selectedDate);

  return (
    <main className={styles.dashboard}>
      <div className={styles.topBar}>
        <div>
          <h1>Clinical Dashboard</h1>
          <p>HLT Psychological Services • Client &amp; Attorney Monitoring Workstation</p>
        </div>
        <div className={styles.dateNavigator} aria-label="Dashboard date">
          <button type="button" aria-label="Previous day" onClick={() => setSelectedDate((date) => shiftDate(date, -1))}><ChevronLeft aria-hidden="true" size={17} /></button>
          <label className={styles.dateField}>
            <CalendarDays aria-hidden="true" size={16} />
            <span className={styles.srOnly}>Select dashboard date</span>
            <input type="date" value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} aria-label="Select dashboard date" />
          </label>
          <button type="button" aria-label="Next day" onClick={() => setSelectedDate((date) => shiftDate(date, 1))}><ChevronRight aria-hidden="true" size={17} /></button>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.leftColumn}>
          <Link href="/appointments" className={styles.summaryCard} aria-label={`View appointments for ${dateLabel}`}>
            <span className={styles.summaryIcon}><CalendarDays aria-hidden="true" size={30} /></span>
            <span className={styles.summaryText}>
              <span className={styles.summaryLabel}>{isToday ? "Today's Appointments" : `Appointments for ${dateLabel}`}</span>
              <span className={styles.summaryCount}>0 <span>No appointments scheduled</span></span>
              <span className={styles.summaryDescription}>Appointment records are not available yet.</span>
            </span>
            <span className={styles.summaryArrow}><ArrowRight aria-hidden="true" size={20} /></span>
          </Link>

          <section className={styles.panel} aria-labelledby="appointments-heading">
            <div className={styles.panelHeading}>
              <div className={styles.headingTitle}><CalendarClock aria-hidden="true" size={21} /><h2 id="appointments-heading">Upcoming Appointments</h2></div>
              <span className={styles.badge}>0 scheduled</span>
            </div>
            <div className={styles.emptyState}>
              <CalendarDays aria-hidden="true" size={30} />
              <p className={styles.emptyTitle}>No appointments to show</p>
              <p>Appointments will appear here when records become available.</p>
            </div>
            <Link href="/appointments" className={styles.panelLink}>View all appointments <ArrowRight aria-hidden="true" size={18} /></Link>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.deadlinesPanel}`} aria-labelledby="deadlines-heading">
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
