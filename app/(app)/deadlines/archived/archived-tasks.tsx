"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreTask } from "@/lib/actions/records";
import styles from "../deadlines.module.css";

type ArchivedTask = { id: string; title: string; clientName: string; dueDate: string; status: string };
const dateFormatter = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

export default function ArchivedTasks({ tasks }: { tasks: ArchivedTask[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function restore(id: string) {
    setBusy(id); setError("");
    try { await restoreTask(id); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to restore task."); }
    finally { setBusy(""); }
  }
  return <><div className={styles.heading}><div><h1>Archived tasks</h1><p>Only Admin can restore archived tasks.</p></div></div>
    <section className={styles.panel} aria-label="Archived tasks">
      {error && <p className={styles.archiveError} role="alert">{error}</p>}
      <div className={styles.tableScroll}><table className={styles.archiveTable}><thead><tr><th scope="col">Client Name</th><th scope="col">Task Name</th><th scope="col">Deadline (Date)</th><th scope="col">Actions</th></tr></thead><tbody>
        {tasks.length ? tasks.map((task) => <tr key={task.id}><td>{task.clientName}</td><td>{task.title}</td><td>{dateFormatter.format(new Date(`${task.dueDate}T12:00:00+08:00`))}</td><td><div className={styles.actionsCell}><button className={styles.doneButton} type="button" disabled={Boolean(busy)} onClick={() => restore(task.id)}>{busy === task.id ? "Restoring…" : "Restore"}</button></div></td></tr>) : <tr><td colSpan={4}><div className={styles.empty}><strong>No archived tasks</strong><p>Deleted tasks will appear here.</p></div></td></tr>}
      </tbody></table></div><div className={styles.footer}>Showing {tasks.length} archived {tasks.length === 1 ? "task" : "tasks"}</div>
    </section></>;
}
