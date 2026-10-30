"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore } from "lucide-react";
import { restoreAttorneyRecord, restoreClientRecord } from "@/lib/actions/records";
import styles from "../clients.module.css";
import archivedStyles from "./restore-list.module.css";

export default function RestoreList({ kind, records }: { kind: "client" | "attorney"; records: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const title = kind === "client" ? "Archived clients" : "Archived attorneys";

  async function restore(id: string) {
    setBusy(id); setError("");
    try { if (kind === "client") await restoreClientRecord(id); else await restoreAttorneyRecord(id); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to restore record."); }
    finally { setBusy(""); }
  }

  return <>
    <div className={styles.heading}><div><h1>{title}</h1><p>Only Admin can restore archived records.</p></div></div>
    <section className={styles.panel} aria-label={title}>
      {error && <p className={archivedStyles.error} role="alert">{error}</p>}
      <div className={styles.tableScroll}><table data-archived-table><thead><tr><th scope="col">Name</th><th scope="col">Actions</th></tr></thead><tbody>
        {records.length ? records.map((record) => <tr className={styles.clientRow} key={record.id}><td className={archivedStyles.name}>{record.full_name}</td><td><button className={`${styles.detailsButton} ${archivedStyles.restoreButton}`} type="button" disabled={Boolean(busy)} onClick={() => restore(record.id)}>{busy === record.id ? "Restoring…" : "Restore"}</button></td></tr>) : <tr><td className={styles.emptyCell} colSpan={2}><div className={styles.emptyState}><span className={styles.emptyIcon}><ArchiveRestore size={27} aria-hidden="true" /></span><strong>No archived {kind === "client" ? "clients" : "attorneys"}</strong><p>Archived records will appear here.</p></div></td></tr>}
      </tbody></table></div>
      <div className={styles.footer}>Showing {records.length} archived {records.length === 1 ? kind : `${kind}s`}</div>
    </section>
  </>;
}
