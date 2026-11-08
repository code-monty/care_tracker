"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, ClipboardList, Plus, UserRound, Users } from "lucide-react";
import { ageFromBirthdate } from "@/lib/validation/client";
import { useClientStore, type ClientStatus } from "../client-store";
import { clientTasksForClient, getClientAttorneyHistory } from "@/lib/actions/records";
import type { DeadlineRecord } from "@/lib/rules/deadlines";
import styles from "./client-detail.module.css";
import actionStyles from "./record-actions.module.css";
import EditClientDialog from "./edit-client-dialog";
import AddClientAppointmentDialog from "./add-appointment-dialog";
import RecordNotes from "@/components/record-notes";

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  return <div className={styles.detail}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { clients, attorneys, setStatus, editClient, archiveClient, role } = useClientStore();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addingAppointment, setAddingAppointment] = useState(false);
  const [appointmentSaved, setAppointmentSaved] = useState(false);
  const [actionError, setActionError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const client = clients.find((record) => record.id === id);
  const [tasks, setTasks] = useState<DeadlineRecord[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(false);
  const [attorneyHistory, setAttorneyHistory] = useState<Awaited<ReturnType<typeof getClientAttorneyHistory>>>([]);
  const [attorneyHistoryError, setAttorneyHistoryError] = useState(false);

  useEffect(() => {
    let current = true;
    clientTasksForClient(id).then((records) => { if (current) { setTasks(records); setTasksError(false); } }).catch(() => { if (current) setTasksError(true); }).finally(() => { if (current) setTasksLoading(false); });
    return () => { current = false; };
  }, [id]);

  useEffect(() => {
    let current = true;
    getClientAttorneyHistory(id).then((records) => { if (current) { setAttorneyHistory(records); setAttorneyHistoryError(false); } }).catch(() => { if (current) setAttorneyHistoryError(true); });
    return () => { current = false; };
  }, [id]);

  if (!client) return <main className={styles.page}><Link className={styles.backLink} href="/clients"><ArrowLeft size={17} aria-hidden="true" />Back to Clients</Link><section className={styles.unavailable}><Users size={30} aria-hidden="true" /><h1>Client record unavailable</h1><p>This client could not be found.</p><Link href="/clients">View Clients</Link></section></main>;

  return <main className={styles.page}>
    <Link className={styles.backLink} href="/clients"><ArrowLeft size={17} aria-hidden="true" />Back to Clients</Link>
    <div className={styles.heading}><div><h1>Client Information</h1><div className={actionStyles.toolbar}>{role !== "staff" && <button className={actionStyles.recordButton} type="button" onClick={() => setEditing(true)}>Edit client</button>}{role === "admin" && <button className={actionStyles.dangerButton} type="button" disabled={archiving} onClick={async () => { if (!window.confirm("Archive this client? The record will be hidden from active lists and can be restored by an Admin.")) return; setArchiving(true); setActionError(""); try { await archiveClient(id); router.push("/clients"); } catch (error) { setActionError(error instanceof Error ? error.message : "Unable to archive client."); } finally { setArchiving(false); } }}>Archive client</button>}</div></div>{(role === "admin" || role === "secretary") && <button className={styles.addAppointment} type="button" onClick={() => { setAppointmentSaved(false); setAddingAppointment(true); }}><Plus size={18} aria-hidden="true" /> Add Appointment</button>}</div>
    {appointmentSaved && <p className={styles.appointmentNotice} role="status">Appointment saved. <Link href="/appointments">View Appointments</Link></p>}
    {actionError && <p role="alert" className={actionStyles.error}>{actionError}</p>}
    {editing && <EditClientDialog client={client} attorneys={attorneys} onSave={(input, choice) => editClient(id, input, choice)} onClose={() => setEditing(false)} />}
    {addingAppointment && (role === "admin" || role === "secretary") && <AddClientAppointmentDialog clientId={client.id} clientName={client.petitionerName} onClose={() => setAddingAppointment(false)} onSaved={() => setAppointmentSaved(true)} />}
    <div className={styles.columns}>
      <div className={styles.mainColumn}>
        <section className={styles.card} aria-labelledby="petitioner-details-heading"><div className={styles.cardHeader}><span className={styles.icon}><UserRound size={21} aria-hidden="true" /></span><div><h2 id="petitioner-details-heading">Petitioner Details</h2><p>Primary contact information</p></div><span className={client.status === "Active" ? styles.activeBadge : styles.inactiveBadge}>{client.status}</span></div><dl className={styles.detailGrid}><Detail label="Name" value={client.petitionerName} /><Detail label="Age" value={ageFromBirthdate(client.petitionerBirthdate)} /><Detail label="Birthdate" value={displayDate(client.petitionerBirthdate)} /><Detail label="Full residential address" value={client.petitionerAddress} /><Detail label="Contact number" value={client.petitionerContact} /><Detail label="Email address" value={client.petitionerEmail} /></dl></section>
        <section className={styles.card} aria-labelledby="respondent-details-heading"><div className={styles.cardHeader}><span className={styles.icon}><Users size={21} aria-hidden="true" /></span><div><h2 id="respondent-details-heading">Respondent Details</h2><p>Associated party information</p></div></div><dl className={styles.detailGrid}><Detail label="Name" value={client.respondentName} /><Detail label="Age" value={ageFromBirthdate(client.respondentBirthdate)} /><Detail label="Birthdate" value={displayDate(client.respondentBirthdate)} /><Detail label="Full residential address" value={client.respondentAddress} /><Detail label="Contact number" value={client.respondentContact} /><Detail label="Email address" value={client.respondentEmail} /></dl></section>
      </div>
      <div className={styles.sideColumn}>
        <section className={styles.card} aria-labelledby="representation-heading"><div className={styles.cardHeader}><span className={styles.icon}><BriefcaseBusiness size={20} aria-hidden="true" /></span><div><h2 id="representation-heading">Legal Representation</h2></div></div>{client.attorneyId ? <dl className={styles.sideDetails}><Detail label="Name of attorney" value={client.attorneyName} /><Detail label="Contact number" value={client.attorneyContact} /><Detail label="Email address" value={client.attorneyEmail} /></dl> : <p className={styles.noAttorney}>No current attorney</p>}</section>
        {(attorneyHistory.length > 0 || attorneyHistoryError) && <section className={styles.card} aria-labelledby="former-attorneys-heading"><div className={styles.cardHeader}><span className={styles.icon}><BriefcaseBusiness size={20} aria-hidden="true" /></span><div><h2 id="former-attorneys-heading">Former attorney history</h2></div></div>{attorneyHistoryError ? <p className={styles.noAttorney} role="alert">Attorney history could not be loaded. Reload to try again.</p> : <ul className={styles.formerAttorneys}>{attorneyHistory.map((entry) => <li key={entry.id}><strong>{entry.attorneyName}</strong><span>Link removed when client was restored · {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" }).format(new Date(entry.detachedAt))}</span></li>)}</ul>}</section>}
        <section className={styles.card} aria-labelledby="status-heading"><div className={styles.cardHeader}><span className={styles.icon}><CalendarDays size={20} aria-hidden="true" /></span><div><h2 id="status-heading">Status</h2></div></div>{role === "staff" ? <p>{client.status}</p> : <><label className={styles.statusControl} htmlFor="client-status">Client status<select id="client-status" value={client.status} onChange={(event) => setStatus(client.id, event.target.value as ClientStatus)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label><p className={styles.statusHint}>Changes are saved to the client record.</p></>}</section>
        <section className={styles.card} aria-labelledby="tasks-heading"><div className={styles.cardHeader}><span className={styles.icon}><ClipboardList size={20} aria-hidden="true" /></span><div><h2 id="tasks-heading">Tasks / Assignments</h2></div></div>{tasksLoading ? <p className={styles.emptyTasks}>Loading tasks…</p> : tasksError ? <p className={styles.emptyTasks} role="alert">Tasks could not be loaded. Reload to try again.</p> : tasks.length ? <ul className={styles.taskList}>{tasks.map((task) => <li key={task.id}><div><strong>{task.title}</strong><span>{task.assignedName} · {displayDate(task.dueDate)}</span></div><span className={styles.taskStatus}>{task.status === "awaiting_approval" ? "Awaiting approval" : task.status === "needs_changes" ? "Needs changes" : task.deadlineStatus}</span></li>)}</ul> : <p className={styles.emptyTasks}>No tasks are tracked for this client yet.</p>}<Link className={styles.taskLink} href={`/deadlines?client=${id}`}>{role === "staff" ? "View Deadlines" : "Add Task / View Deadlines"}</Link></section>
      </div>
    </div>
    <RecordNotes target={{ kind: "client", id }} />
  </main>;
}
