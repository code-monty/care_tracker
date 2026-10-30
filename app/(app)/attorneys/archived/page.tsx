import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/session";
import { getArchivedAttorneys } from "@/lib/data/records";
import RestoreList from "../../clients/archived/restore-list";
import styles from "../attorneys.module.css";
import { ArrowLeft } from "lucide-react";

export default async function ArchivedAttorneysPage() {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") redirect("/attorneys");
  const records = await getArchivedAttorneys();
  return <main className={styles.page}><Link className={styles.backLink} href="/attorneys"><ArrowLeft size={17} aria-hidden="true" />Back to Attorneys</Link><RestoreList kind="attorney" records={records} /></main>;
}
