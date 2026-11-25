import Link from "next/link";
import { redirect } from "next/navigation";
import { getArchivedTasks } from "@/lib/data/records";
import { requireActiveUser } from "@/lib/auth/session";
import { TASKS_AND_DEADLINES_ENABLED } from "@/lib/config/features";
import ArchivedTasks from "./archived-tasks";
import styles from "../deadlines.module.css";

export default async function ArchivedTasksPage() {
  if (!TASKS_AND_DEADLINES_ENABLED) redirect("/dashboard");
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") redirect("/deadlines");
  const tasks = await getArchivedTasks();
  return <main className={styles.page}><Link className={styles.backLink} href="/deadlines">← Back to Deadlines</Link><ArchivedTasks tasks={tasks} /></main>;
}
