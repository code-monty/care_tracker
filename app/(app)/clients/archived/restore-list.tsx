"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, ChevronLeft, ChevronRight } from "lucide-react";
import { restoreAttorneyRecord, restoreClientRecord } from "@/lib/actions/records";
import styles from "../clients.module.css";
import archivedStyles from "./restore-list.module.css";

const PAGE_SIZE = 10;

export default function RestoreList({ kind, records }: { kind: "client" | "attorney"; records: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const title = kind === "client" ? "Archived clients" : "Archived attorneys";
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = records.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, records.length);

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
        {visibleRecords.length ? visibleRecords.map((record) => <tr className={styles.clientRow} key={record.id}><td className={archivedStyles.name}>{record.full_name}</td><td><button className={`${styles.detailsButton} ${archivedStyles.restoreButton}`} type="button" disabled={Boolean(busy)} onClick={() => restore(record.id)}>{busy === record.id ? "Restoring…" : "Restore"}</button></td></tr>) : <tr><td className={styles.emptyCell} colSpan={2}><div className={styles.emptyState}><span className={styles.emptyIcon}><ArchiveRestore size={27} aria-hidden="true" /></span><strong>No archived {kind === "client" ? "clients" : "attorneys"}</strong><p>Archived records will appear here.</p></div></td></tr>}
      </tbody></table></div>
      <div className={`${styles.footer} ${archivedStyles.footer}`}>
        <span>Showing {rangeStart}–{rangeEnd} of {records.length} archived {kind}s</span>
        <nav className={styles.pagination} aria-label={`Archived ${kind} pages`}>
          <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
          <span aria-current="page">{currentPage}</span>
          <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} aria-hidden="true" /></button>
        </nav>
      </div>
    </section>
  </>;
}
