import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/session";
import { getArchivedAttorneys } from "@/lib/data/records";
import RestoreList from "../../clients/archived/restore-list";
import styles from "../attorneys.module.css";

export default async function ArchivedAttorneysPage() {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") redirect("/attorneys");
  const records = await getArchivedAttorneys();
  return <main className={styles.page}><Link href="/attorneys">Back to Attorneys</Link><RestoreList kind="attorney" records={records} /></main>;
}
