import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/session";
import { getArchivedClients } from "@/lib/data/records";
import RestoreList from "./restore-list";
import styles from "../clients.module.css";

export default async function ArchivedClientsPage() {
  const { profile } = await requireActiveUser();
  if (profile.role !== "admin") redirect("/clients");
  const records = await getArchivedClients();
  return <main className={styles.clients}><Link href="/clients">Back to Clients</Link><RestoreList kind="client" records={records} /></main>;
}
