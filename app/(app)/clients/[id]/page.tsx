"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, ClipboardList, UserRound, Users } from "lucide-react";
import { ageFromBirthdate } from "@/lib/validation/client";
import { useClientStore, type ClientStatus } from "../client-store";
import { clientTasksForClient } from "@/lib/actions/records";
import type { DeadlineRecord } from "@/lib/rules/deadlines";
import styles from "./client-detail.module.css";
import actionStyles from "./record-actions.module.css";
import EditClientDialog from "./edit-client-dialog";

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
  const [actionError, setActionError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const client = clients.find((record) => record.id === id);
  const [tasks, setTasks] = useState<DeadlineRecord[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(false);

  useEffect(() => {
    let current = true;
    clientTasksForClient(id).then((records) => { if (current) { setTasks(records); setTasksError(false); } }).catch(() => { if (current) setTasksError(true); }).finally(() => { if (current) setTasksLoading(false); });
    return () => { current = false; };
  }, [id]);

  if (!client) return <main className={styles.page}><Link className={styles.backLink} href="/clients"><ArrowLeft size={17} aria-hidden="true" />Back to Clients</Link><section className={styles.unavailable}><Users size={30} aria-hidden="true" /><h1>Client record unavailable</h1><p>This client could not be found.</p><Link href="/clients">View Clients</Link></section></main>;

  return <main className={styles.page}>
    <Link className={styles.backLink} href="/clients"><ArrowLeft size={17} aria-hidden="true" />Back to Clients</Link>
    <div className={styles.heading}><div><h1>Client Information</h1><p>{client.petitionerName}</p></div><div className={actionStyles.toolbar}>{role !== "staff" && <button className={actionStyles.recordButton} type="button" onClick={() => setEditing(true)}>Edit client</button>}{role === "admin" && <button className={actionStyles.recordButton} type="button" disabled={archiving} onClick={async () => { if (!window.confirm("Delete this client? The record will be archived, hidden from active lists, and can be restored by an Admin.")) return; setArchiving(true); setActionError(""); try { await archiveClient(id); router.push("/clients"); } catch (error) { setActionError(error instanceof Error ? error.message : "Unable to archive client."); } finally { setArchiving(false); } }}>Delete client</button>}</div></div>
    {actionError && <p role="alert" className={actionStyles.error}>{actionError}</p>}
    {editing && <EditClientDialog client={client} attorneys={attorneys} onSave={(input, attorneyId) => editClient(id, input, attorneyId)} onClose={() => setEditing(false)} />}
    <div className={styles.columns}>
      <div className={styles.mainColumn}>
        <section className={styles.card} aria-labelledby="petitioner-details-heading"><div className={styles.cardHeader}><span className={styles.icon}><UserRound size={21} aria-hidden="true" /></span><div><h2 id="petitioner-details-heading">Petitioner Details</h2><p>Primary contact information</p></div><span className={client.status === "Active" ? styles.activeBadge : styles.inactiveBadge}>{client.status}</span></div><dl className={styles.detailGrid}><Detail label="Name" value={client.petitionerName} /><Detail label="Age" value={ageFromBirthdate(client.petitionerBirthdate)} /><Detail label="Birthdate" value={displayDate(client.petitionerBirthdate)} /><Detail label="Full residential address" value={client.petitionerAddress} /><Detail label="Contact number" value={client.petitionerContact} /><Detail label="Email address" value={client.petitionerEmail} /></dl></section>
        <section className={styles.card} aria-labelledby="respondent-details-heading"><div className={styles.cardHeader}><span className={styles.icon}><Users size={21} aria-hidden="true" /></span><div><h2 id="respondent-details-heading">Respondent Details</h2><p>Associated party information</p></div></div><dl className={styles.detailGrid}><Detail label="Name" value={client.respondentName} /><Detail label="Age" value={ageFromBirthdate(client.respondentBirthdate)} /><Detail label="Birthdate" value={displayDate(client.respondentBirthdate)} /><Detail label="Full residential address" value={client.respondentAddress} /><Detail label="Contact number" value={client.respondentContact} /><Detail label="Email address" value={client.respondentEmail} /></dl></section>
      </div>
      <div className={styles.sideColumn}>
        <section className={styles.card} aria-labelledby="representation-heading"><div className={styles.cardHeader}><span className={styles.icon}><BriefcaseBusiness size={20} aria-hidden="true" /></span><div><h2 id="representation-heading">Legal Representation</h2></div></div><dl className={styles.sideDetails}><Detail label="Name of attorney" value={client.attorneyName} /><Detail label="Contact number" value={client.attorneyContact} /><Detail label="Email address" value={client.attorneyEmail} /></dl></section>
        <section className={styles.card} aria-labelledby="status-heading"><div className={styles.cardHeader}><span className={styles.icon}><CalendarDays size={20} aria-hidden="true" /></span><div><h2 id="status-heading">Status</h2></div></div>{role === "staff" ? <p>{client.status}</p> : <><label className={styles.statusControl} htmlFor="client-status">Client status<select id="client-status" value={client.status} onChange={(event) => setStatus(client.id, event.target.value as ClientStatus)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label><p className={styles.statusHint}>Changes are saved to the client record.</p></>}</section>
        <section className={styles.card} aria-labelledby="tasks-heading"><div className={styles.cardHeader}><span className={styles.icon}><ClipboardList size={20} aria-hidden="true" /></span><div><h2 id="tasks-heading">Tasks / Assignments</h2></div></div>{tasksLoading ? <p className={styles.emptyTasks}>Loading tasks…</p> : tasksError ? <p className={styles.emptyTasks} role="alert">Tasks could not be loaded. Reload to try again.</p> : tasks.length ? <ul className={styles.taskList}>{tasks.map((task) => <li key={task.id}><div><strong>{task.title}</strong><span>{task.assignedName} · {displayDate(task.dueDate)}</span></div><span className={styles.taskStatus}>{task.deadlineStatus}</span></li>)}</ul> : <p className={styles.emptyTasks}>No tasks are tracked for this client yet.</p>}<Link className={styles.taskLink} href={`/deadlines?client=${id}`}>{role === "staff" ? "View Deadlines" : "Add Task / View Deadlines"}</Link></section>
      </div>
    </div>
  </main>;
}
