"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, ChevronRight, ClipboardList, Plus, Search, X } from "lucide-react";
import { archiveTask, completeTask, deadlinesForPage, reviewTask, saveTask, submitTaskForApproval } from "@/lib/actions/records";
import { manilaToday, type DeadlineRecord, type DeadlineStatus } from "@/lib/rules/deadlines";
import styles from "./deadlines.module.css";

type ClientChoice = { id: string; name: string; attorneyId: string | null; attorneyName: string };
type PersonnelChoice = { id: string; full_name: string };
const PAGE_SIZE = 10;
const dateFormatter = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
const showDate = (value: string) => dateFormatter.format(new Date(`${value}T12:00:00+08:00`));

export default function DeadlinesWorkspace({ initialTasks, clients, staff, initialClientId, currentUserId, role }: { initialTasks: DeadlineRecord[]; clients: ClientChoice[]; staff: PersonnelChoice[]; initialClientId?: string; currentUserId: string; role: "admin" | "secretary" | "staff" }) {
  const canManage = role !== "staff";
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DeadlineStatus | "Open" | "Awaiting approval" | "Needs changes" | "All">("Open");
  const [attorneyId, setAttorneyId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<DeadlineRecord | null>(null);
  const [reviewing, setReviewing] = useState<DeadlineRecord | null>(null);
  const [resubmitting, setResubmitting] = useState<DeadlineRecord | null>(null);
  const [historyTask, setHistoryTask] = useState<DeadlineRecord | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [submissionComment, setSubmissionComment] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [selectedClient, setSelectedClient] = useState(initialClientId ?? "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const reviewCommentInput = useRef<HTMLTextAreaElement>(null);
  const submissionDialog = useRef<HTMLDialogElement>(null);
  const historyDialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const today = manilaToday();
  const attorneys = useMemo(() => [...new Map(clients.filter((client) => client.attorneyId).map((client) => [client.attorneyId!, { id: client.attorneyId!, name: client.attorneyName }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [clients]);
  const filtered = useMemo(() => tasks.filter((task) => {
    const query = search.trim().toLocaleLowerCase();
    return (!query || `${task.clientName} ${task.title}`.toLocaleLowerCase().includes(query))
      && (status === "All" || (status === "Open" ? task.status !== "done" : status === "Awaiting approval" ? task.status === "awaiting_approval" : status === "Needs changes" ? task.status === "needs_changes" : task.deadlineStatus === status))
      && (!attorneyId || task.attorneyId === attorneyId)
      && (!assignedTo || task.assignedTo === assignedTo);
  }), [tasks, search, status, attorneyId, assignedTo]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const latestSubmissionComment = reviewing ? [...reviewing.reviewHistory].reverse().find((entry) => entry.event === "submitted")?.comment : null;

  function openAdd() { form.current?.reset(); setEditing(null); setSelectedClient(initialClientId ?? ""); setNotice(""); dialog.current?.showModal(); }
  function openEdit(task: DeadlineRecord) { setEditing(task); setSelectedClient(task.clientId); setNotice(""); dialog.current?.showModal(); }
  function openReview(task: DeadlineRecord) { setReviewing(task); setReviewComment(""); setReviewError(""); setNotice(""); reviewDialog.current?.showModal(); }
  function openResubmission(task: DeadlineRecord) { setResubmitting(task); setSubmissionComment(""); setSubmissionError(""); submissionDialog.current?.showModal(); }
  function openHistory(task: DeadlineRecord) { setHistoryTask(task); historyDialog.current?.showModal(); }
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
  async function deleteTask() {
    if (!editing || role !== "admin" || !window.confirm(`Delete “${editing.title}”? The task will be archived and can be restored by an Admin.`)) return;
    setBusy(true); setNotice("");
    try { await archiveTask(editing.id); setTasks(await deadlinesForPage()); dialog.current?.close(); setNotice("Task archived."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to archive task."); }
    finally { setBusy(false); }
  }
  async function advanceTask(task: DeadlineRecord) {
    if (role === "staff" && task.status === "needs_changes") { openResubmission(task); return; }
    if (!window.confirm(role === "staff" ? `Submit “${task.title}” for Admin approval?` : `Mark “${task.title}” done?`)) return;
    setBusy(true); setNotice("");
    try { if (role === "staff") await submitTaskForApproval(task.id); else await completeTask(task.id); setTasks(await deadlinesForPage()); setNotice(role === "staff" ? "Task sent for Admin approval." : "Task marked done."); }
    catch { setNotice("Unable to update task."); }
    finally { setBusy(false); }
  }
  async function sendResubmission() {
    if (!resubmitting || !submissionComment.trim()) { setSubmissionError("Describe the changes made before resubmitting."); return; }
    setBusy(true); setSubmissionError(""); setNotice("");
    try {
      await submitTaskForApproval(resubmitting.id, submissionComment);
      setTasks(await deadlinesForPage());
      submissionDialog.current?.close();
      setNotice("Task sent for Admin approval.");
    } catch (error) { setSubmissionError(error instanceof Error ? error.message : "Unable to submit task."); }
    finally { setBusy(false); }
  }
  async function decideTask(decision: "approve" | "return") {
    if (!reviewing) return;
    if (decision === "return" && !reviewComment.trim()) { setReviewError("Enter a comment before returning the task."); reviewCommentInput.current?.focus(); return; }
    setBusy(true); setReviewError(""); setNotice("");
    try { await reviewTask(reviewing.id, decision, decision === "return" ? reviewComment : undefined); setTasks(await deadlinesForPage()); reviewDialog.current?.close(); setReviewing(null); setNotice(decision === "approve" ? "Task approved and marked done." : "Task returned to Staff with feedback."); }
    catch (error) { setReviewError(error instanceof Error ? error.message : "Unable to review task."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <div className={styles.heading}><div><h1>Deadlines</h1><p>Track client tasks and assignments.</p></div><div className={styles.headingActions}>{role === "admin" && <Link href="/deadlines/archived">View archived tasks</Link>}{canManage && <button className={styles.primaryButton} type="button" onClick={openAdd} disabled={!clients.length || !staff.length}><Plus size={18} aria-hidden="true" /> Add Task</button>}</div></div>
    {initialClientId && <p className={styles.context}>{canManage ? "Adding a task for" : "Viewing deadlines for"} <Link href={`/clients/${initialClientId}`}>{clients.find((client) => client.id === initialClientId)?.name}</Link>.</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {canManage && !staff.length && <p className={styles.notice} role="alert">An active Staff or Secretary account is needed before tasks can be assigned.</p>}
    <section className={styles.panel} aria-label="Deadline list">
      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={17} aria-hidden="true" /><span className={styles.srOnly}>Search client or task</span><input type="search" placeholder="Search client or task" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <label className={styles.filter}>Status<select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}><option>Open</option><option>Overdue</option><option>Due Soon</option><option>Upcoming</option>{role === "admin" && <option>Awaiting approval</option>}<option>Needs changes</option><option>Done</option><option>All</option></select></label>
        <label className={styles.filter}>Attorney<select value={attorneyId} onChange={(event) => { setAttorneyId(event.target.value); setPage(1); }}><option value="">All</option>{attorneys.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label className={styles.filter}>Assigned personnel<select value={assignedTo} onChange={(event) => { setAssignedTo(event.target.value); setPage(1); }}><option value="">All</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
      </div>
      <div className={styles.tableScroll}><table><thead><tr><th scope="col">Client Name</th><th scope="col">Task Name</th><th scope="col">Assign Personnel</th><th scope="col">Deadline (Date)</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
        {visible.map((task) => <tr key={task.id}>
          <td><Link className={styles.clientLink} href={`/clients/${task.clientId}`}>{task.clientName}</Link></td>
          <td>{role === "secretary" && task.status !== "awaiting_approval" ? <button type="button" className={styles.taskButton} onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`}>{task.title}</button> : task.title}</td>
          <td>{task.assignedName}</td>
          <td className={styles.dateCell}>{showDate(task.dueDate)}</td>
          <td><div className={styles.statusCell}>
            <div className={styles.statusBadges}>{task.status === "awaiting_approval" && <span className={`${styles.statusBadge} ${styles.awaiting}`}>Awaiting approval</span>}{task.status === "needs_changes" && <span className={`${styles.statusBadge} ${styles.changes}`}>Needs changes</span>}<span className={`${styles.statusBadge} ${styles[task.deadlineStatus.replace(" ", "").toLowerCase()]}`}>{task.deadlineStatus}</span></div>
            {role === "staff" && task.assignedTo === currentUserId && task.status === "needs_changes" && task.reviewHistory.some((entry) => entry.event === "returned") && <span className={styles.feedback}><strong>Admin feedback:</strong> {[...task.reviewHistory].reverse().find((entry) => entry.event === "returned")?.comment}</span>}
          </div></td>
          <td><div className={styles.actionsCell}>
            {task.reviewHistory.length > 0 && <button type="button" className={styles.doneButton} onClick={() => openHistory(task)}>Review history</button>}
            {role === "staff" && task.assignedTo === currentUserId && (task.status === "open" || task.status === "needs_changes") && <button type="button" className={styles.doneButton} onClick={() => advanceTask(task)} disabled={busy}>Submit for approval</button>}
            {role === "admin" && (task.status === "needs_changes" || (task.status === "open" && task.assignedRole === "secretary")) && <button type="button" className={styles.doneButton} onClick={() => advanceTask(task)} disabled={busy}>Mark Done</button>}
            {role === "admin" && task.status === "awaiting_approval" && <button type="button" className={styles.doneButton} onClick={() => openReview(task)} disabled={busy}>Awaiting Approval</button>}
            {role === "admin" && task.status !== "awaiting_approval" && <button type="button" className={styles.doneButton} onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`}>Edit</button>}
          </div></td>
        </tr>)}
        {!visible.length && <tr><td colSpan={6}><div className={styles.empty}><ClipboardList size={28} aria-hidden="true" /><strong>{tasks.length ? "No matching deadlines" : "No tasks yet"}</strong><p>{tasks.length ? "Try another search or filter." : canManage ? "Add a task to start tracking deadlines." : "Tasks will appear here when assigned."}</p></div></td></tr>}
      </tbody></table></div>
      <div className={styles.footer}><span>{filtered.length ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} tasks` : "Showing 0 of 0 tasks"}</span><nav aria-label="Deadline pages" className={styles.pagination}><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><span aria-current="page">{currentPage}</span><button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></nav></div>
    </section>
    {canManage && <dialog ref={dialog} className={styles.dialog} onClose={() => setEditing(null)}><div className={styles.dialogHeading}><h2>{editing ? "Edit Task" : "Add Task"}</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="Close dialog"><X size={19} /></button></div><form ref={form} key={editing?.id ?? "new"} onSubmit={submit} className={styles.form}>
      <label>Client Name<select name="clientId" required value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label>Task Name<input name="title" required minLength={1} maxLength={120} defaultValue={editing?.title ?? ""} /></label>
      <label>Assign Personnel<select name="assignedTo" required defaultValue={editing?.assignedTo ?? ""}><option value="">Select active personnel</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
      <label>Deadline (Date)<input name="dueDate" type="date" required defaultValue={editing?.dueDate ?? today} /></label>
      {notice && <p role="alert" className={styles.formError}>{notice}</p>}
      <div className={styles.formActions}>{role === "admin" && editing && <button type="button" className={styles.deleteTaskButton} onClick={deleteTask} disabled={busy}>Delete task</button>}<button type="button" onClick={() => dialog.current?.close()}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Saving…" : "Save Task"}</button></div>
    </form></dialog>}
    {role === "staff" && <dialog ref={submissionDialog} className={styles.dialog} onClose={() => setResubmitting(null)} aria-label="Resubmit task"><div className={styles.dialogHeading}><h2>Resubmit task</h2><button type="button" onClick={() => submissionDialog.current?.close()} aria-label="Close resubmission"><X size={19} /></button></div><div className={styles.form}><p>Describe the changes made to “{resubmitting?.title}” for Admin review.</p><label>Changes made<textarea className={styles.commentInput} value={submissionComment} maxLength={1000} required onChange={(event) => setSubmissionComment(event.target.value)} placeholder="Explain what you changed" /></label>{submissionError && <p role="alert" className={styles.formError}>{submissionError}</p>}<div className={styles.formActions}><button type="button" onClick={() => submissionDialog.current?.close()}>Cancel</button><button type="button" className={styles.primaryButton} disabled={busy || !submissionComment.trim()} onClick={sendResubmission}>Submit for approval</button></div></div></dialog>}
    {role === "admin" && <dialog ref={reviewDialog} className={`${styles.dialog} ${styles.reviewDialog}`} onClose={() => setReviewing(null)} aria-label="Review task"><div className={styles.dialogHeading}><h2>Review task</h2><button type="button" onClick={() => reviewDialog.current?.close()} aria-label="Close review"><X size={19} /></button></div><div className={styles.form}><p>Has the document for “{reviewing?.title}” been checked and verified?</p>{latestSubmissionComment && <p className={styles.reviewExplanation}><strong>Staff changes:</strong> {latestSubmissionComment}</p>}<label>Comment if returning to Staff<textarea ref={reviewCommentInput} className={styles.commentInput} value={reviewComment} maxLength={1000} aria-invalid={Boolean(reviewError && !reviewComment.trim())} aria-describedby={reviewError ? "review-comment-error" : undefined} onChange={(event) => { setReviewComment(event.target.value); setReviewError(""); }} placeholder="Explain what needs to be changed" /></label>{reviewError && <p id="review-comment-error" role="alert" className={styles.formError}>{reviewError}</p>}<div className={styles.formActions}><button type="button" onClick={() => reviewDialog.current?.close()}>Cancel</button><button type="button" className={styles.reviewReturnButton} disabled={busy} onClick={() => decideTask("return")}>No, return with comment</button><button type="button" className={styles.primaryButton} disabled={busy} onClick={() => decideTask("approve")}>Yes, approve</button></div></div></dialog>}
    <dialog ref={historyDialog} className={`${styles.dialog} ${styles.historyDialog}`} onClose={() => setHistoryTask(null)} aria-label="Task review history"><div className={styles.dialogHeading}><h2>Review history</h2><button type="button" onClick={() => historyDialog.current?.close()} aria-label="Close history"><X size={19} /></button></div><div className={styles.form}><p>{historyTask?.title}</p><ol className={styles.historyList}>{historyTask?.reviewHistory.map((entry, index) => <li key={`${entry.createdAt}-${index}`} className={styles.historyItem}><div className={styles.historyEvent}><span className={styles.historyMarker} aria-hidden="true">{entry.event === "returned" ? <ArrowRight size={17} /> : <Check size={17} />}</span><div><strong>{entry.event === "submitted" ? "Submitted for approval" : entry.event === "returned" ? "Returned for changes" : entry.event === "approved" ? "Approved" : "Completed by Admin"}</strong><span className={styles.historyTime}>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</span></div></div>{entry.comment && <p className={styles.historyComment}>{entry.event === "submitted" ? <><strong>Staff changes:</strong><br /></> : entry.event === "returned" ? <><strong>Admin feedback:</strong><br /></> : null}{entry.comment}</p>}</li>)}</ol></div></dialog>
  </main>;
}
