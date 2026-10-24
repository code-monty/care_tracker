"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, ClipboardList, UserRound, Users } from "lucide-react";
import { ageFromBirthdate } from "@/lib/validation/client";
import { useClientStore, type ClientStatus } from "../client-store";
import styles from "./client-detail.module.css";

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  return <div className={styles.detail}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { clients, setStatus } = useClientStore();
  const client = clients.find((record) => record.id === id);

  if (!client) return <main className={styles.page}><Link className={styles.backLink} href="/clients"><ArrowLeft size={17} aria-hidden="true" />Back to Clients</Link><section className={styles.unavailable}><Users size={30} aria-hidden="true" /><h1>Client record unavailable</h1><p>Temporary client records disappear when the page reloads. Return to Clients to add a new temporary record.</p><Link href="/clients">View Clients</Link></section></main>;

  return <main className={styles.page}>
    <Link className={styles.backLink} href="/clients"><ArrowLeft size={17} aria-hidden="true" />Back to Clients</Link>
    <div className={styles.heading}><div><h1>Client Information</h1><p>{client.petitionerName} · Temporary record. It disappears on reload. Do not enter real client data.</p></div></div>
    <div className={styles.columns}>
      <div className={styles.mainColumn}>
        <section className={styles.card} aria-labelledby="petitioner-details-heading"><div className={styles.cardHeader}><span className={styles.icon}><UserRound size={21} aria-hidden="true" /></span><div><h2 id="petitioner-details-heading">Petitioner Details</h2><p>Primary contact information</p></div><span className={client.status === "Active" ? styles.activeBadge : styles.inactiveBadge}>{client.status}</span></div><dl className={styles.detailGrid}><Detail label="Name" value={client.petitionerName} /><Detail label="Age" value={ageFromBirthdate(client.petitionerBirthdate)} /><Detail label="Birthdate" value={displayDate(client.petitionerBirthdate)} /><Detail label="Full residential address" value={client.petitionerAddress} /><Detail label="Contact number" value={client.petitionerContact} /><Detail label="Email address" value={client.petitionerEmail} /></dl></section>
        <section className={styles.card} aria-labelledby="respondent-details-heading"><div className={styles.cardHeader}><span className={styles.icon}><Users size={21} aria-hidden="true" /></span><div><h2 id="respondent-details-heading">Respondent Details</h2><p>Associated party information</p></div></div><dl className={styles.detailGrid}><Detail label="Name" value={client.respondentName} /><Detail label="Age" value={ageFromBirthdate(client.respondentBirthdate)} /><Detail label="Birthdate" value={displayDate(client.respondentBirthdate)} /><Detail label="Full residential address" value={client.respondentAddress} /><Detail label="Contact number" value={client.respondentContact} /><Detail label="Email address" value={client.respondentEmail} /></dl></section>
      </div>
      <div className={styles.sideColumn}>
        <section className={styles.card} aria-labelledby="representation-heading"><div className={styles.cardHeader}><span className={styles.icon}><BriefcaseBusiness size={20} aria-hidden="true" /></span><div><h2 id="representation-heading">Legal Representation</h2></div></div><dl className={styles.sideDetails}><Detail label="Name of attorney" value={client.attorneyName} /><Detail label="Contact number" value={client.attorneyContact} /><Detail label="Email address" value={client.attorneyEmail} /></dl></section>
        <section className={styles.card} aria-labelledby="status-heading"><div className={styles.cardHeader}><span className={styles.icon}><CalendarDays size={20} aria-hidden="true" /></span><div><h2 id="status-heading">Status</h2></div></div><label className={styles.statusControl} htmlFor="client-status">Client status<select id="client-status" value={client.status} onChange={(event) => setStatus(client.id, event.target.value as ClientStatus)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label><p className={styles.statusHint}>This status is temporary and updates the Clients list.</p></section>
        <section className={styles.card} aria-labelledby="tasks-heading"><div className={styles.cardHeader}><span className={styles.icon}><ClipboardList size={20} aria-hidden="true" /></span><div><h2 id="tasks-heading">Tasks / Assignments</h2></div></div><p className={styles.emptyTasks}>No tasks are tracked for temporary clients yet.</p></section>
      </div>
    </div>
  </main>;
}
