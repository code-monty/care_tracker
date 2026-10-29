"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, Plus, Search, X } from "lucide-react";
import { completeTask, deadlinesForPage, saveTask } from "@/lib/actions/records";
import { manilaToday, type DeadlineRecord, type DeadlineStatus } from "@/lib/rules/deadlines";
import styles from "./deadlines.module.css";

type ClientChoice = { id: string; name: string; attorneyId: string; attorneyName: string };
type PersonnelChoice = { id: string; full_name: string };
const PAGE_SIZE = 10;
const dateFormatter = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
const showDate = (value: string) => dateFormatter.format(new Date(`${value}T12:00:00+08:00`));

export default function DeadlinesWorkspace({ initialTasks, clients, staff, initialClientId }: { initialTasks: DeadlineRecord[]; clients: ClientChoice[]; staff: PersonnelChoice[]; initialClientId?: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DeadlineStatus | "Open" | "All">("Open");
  const [attorneyId, setAttorneyId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<DeadlineRecord | null>(null);
  const [selectedClient, setSelectedClient] = useState(initialClientId ?? "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const today = manilaToday();
  const attorneys = useMemo(() => [...new Map(clients.map((client) => [client.attorneyId, { id: client.attorneyId, name: client.attorneyName }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [clients]);
  const filtered = useMemo(() => tasks.filter((task) => {
    const query = search.trim().toLocaleLowerCase();
    return (!query || `${task.clientName} ${task.title}`.toLocaleLowerCase().includes(query))
      && (status === "All" || (status === "Open" ? task.status === "open" : task.deadlineStatus === status))
      && (!attorneyId || task.attorneyId === attorneyId)
      && (!assignedTo || task.assignedTo === assignedTo);
  }), [tasks, search, status, attorneyId, assignedTo]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function openAdd() { form.current?.reset(); setEditing(null); setSelectedClient(initialClientId ?? ""); setNotice(""); dialog.current?.showModal(); }
  function openEdit(task: DeadlineRecord) { setEditing(task); setSelectedClient(task.clientId); setNotice(""); dialog.current?.showModal(); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    setBusy(true); setNotice("");
    try {
      await saveTask({ clientId: String(values.get("clientId")), title: String(values.get("title")), assignedTo: String(values.get("assignedTo")), dueDate: String(values.get("dueDate")) }, editing?.id);
      setTasks(await deadlinesForPage());
      setPage(1);
      dialog.current?.close();
      setNotice(editing ? "Task updated." : "Task added.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save task."); }
    finally { setBusy(false); }
  }
  async function markDone(task: DeadlineRecord) {
    if (!window.confirm(`Mark “${task.title}” done?`)) return;
    setBusy(true); setNotice("");
    try { await completeTask(task.id); setTasks(await deadlinesForPage()); setNotice("Task marked done."); }
    catch { setNotice("Unable to complete task."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <div className={styles.heading}><div><h1>Deadlines</h1><p>Track client tasks and assignments.</p></div><button className={styles.primaryButton} type="button" onClick={openAdd} disabled={!clients.length || !staff.length}><Plus size={18} aria-hidden="true" /> Add Task</button></div>
    {initialClientId && <p className={styles.context}>Adding a task for <Link href={`/clients/${initialClientId}`}>{clients.find((client) => client.id === initialClientId)?.name}</Link>.</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {!staff.length && <p className={styles.notice} role="alert">An active Staff or Secretary account is needed before tasks can be assigned.</p>}
    <section className={styles.panel} aria-label="Deadline list">
      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={17} aria-hidden="true" /><span className={styles.srOnly}>Search client or task</span><input type="search" placeholder="Search client or task" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <label className={styles.filter}>Status<select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}><option>Open</option><option>Overdue</option><option>Due Soon</option><option>Upcoming</option><option>Done</option><option>All</option></select></label>
        <label className={styles.filter}>Attorney<select value={attorneyId} onChange={(event) => { setAttorneyId(event.target.value); setPage(1); }}><option value="">All</option>{attorneys.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label className={styles.filter}>Assigned personnel<select value={assignedTo} onChange={(event) => { setAssignedTo(event.target.value); setPage(1); }}><option value="">All</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
      </div>
      <div className={styles.tableScroll}><table><thead><tr><th scope="col">Client Name</th><th scope="col">Task Name</th><th scope="col">Assign Personnel</th><th scope="col">Deadline (Date)</th><th scope="col">Status</th></tr></thead><tbody>
        {visible.map((task) => <tr key={task.id}><td><Link className={styles.clientLink} href={`/clients/${task.clientId}`}>{task.clientName}</Link></td><td><button type="button" className={styles.taskButton} onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`}>{task.title}</button></td><td>{task.assignedName}</td><td className={styles.dateCell}>{showDate(task.dueDate)}</td><td><div className={styles.statusCell}><span className={`${styles.statusBadge} ${styles[task.deadlineStatus.replace(" ", "").toLowerCase()]}`}>{task.deadlineStatus}</span>{task.status === "open" && <button type="button" className={styles.doneButton} onClick={() => markDone(task)} disabled={busy}>Mark Done</button>}</div></td></tr>)}
        {!visible.length && <tr><td colSpan={5}><div className={styles.empty}><ClipboardList size={28} aria-hidden="true" /><strong>{tasks.length ? "No matching deadlines" : "No tasks yet"}</strong><p>{tasks.length ? "Try another search or filter." : "Add a task to start tracking deadlines."}</p></div></td></tr>}
      </tbody></table></div>
      <div className={styles.footer}><span>{filtered.length ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} tasks` : "Showing 0 of 0 tasks"}</span><nav aria-label="Deadline pages" className={styles.pagination}><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><span aria-current="page">{currentPage}</span><button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></nav></div>
    </section>
    <dialog ref={dialog} className={styles.dialog} onClose={() => setEditing(null)}><div className={styles.dialogHeading}><h2>{editing ? "Edit Task" : "Add Task"}</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="Close dialog"><X size={19} /></button></div><form ref={form} key={editing?.id ?? "new"} onSubmit={submit} className={styles.form}>
      <label>Client Name<select name="clientId" required value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label>Task Name<input name="title" required minLength={1} maxLength={120} defaultValue={editing?.title ?? ""} /></label>
      <label>Assign Personnel<select name="assignedTo" required defaultValue={editing?.assignedTo ?? ""}><option value="">Select active personnel</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
      <label>Deadline (Date)<input name="dueDate" type="date" required defaultValue={editing?.dueDate ?? today} /></label>
      {notice && <p role="alert" className={styles.formError}>{notice}</p>}
      <div className={styles.formActions}><button type="button" onClick={() => dialog.current?.close()}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Saving…" : "Save Task"}</button></div>
    </form></dialog>
  </main>;
}
