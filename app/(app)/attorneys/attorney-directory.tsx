"use client";
import Link from "next/link";

import { useState } from "react";
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Search } from "lucide-react";
import styles from "./attorneys.module.css";

type Attorney = { id: string; full_name: string; contact_no: string; email: string; clientCount: number; hasActiveClients: boolean };
const pageSize = 10;

export default function AttorneyDirectory({ attorneys, showArchived = false }: { attorneys: Attorney[]; showArchived?: boolean }) {
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const query = search.trim().toLocaleLowerCase();
  const filtered = attorneys.filter((attorney) => (!activeOnly || attorney.hasActiveClients) && `${attorney.full_name} ${attorney.contact_no} ${attorney.email}`.toLocaleLowerCase().includes(query));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleAttorneys = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  return <main className={styles.page}>
    <div className={styles.heading}><h1>Attorneys</h1><p>Find legal counsel and review the clients they handle.</p>{showArchived && <Link href="/attorneys/archived">View archived attorneys</Link>}</div>
    <section className={styles.panel} aria-label="Attorney directory">
      <div className={styles.toolbar}>
        <label className={styles.searchField}><Search size={18} aria-hidden="true" /><span className={styles.srOnly}>Search attorneys</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search attorneys" /></label>
        <button type="button" className={styles.filterButton} aria-pressed={activeOnly} onClick={() => { setActiveOnly((value) => !value); setPage(1); }}>Has active clients</button>
      </div>
      {visibleAttorneys.length ? <ul className={styles.directory}>{visibleAttorneys.map((attorney) => <li key={attorney.id}>
        {/* Full navigation keeps this record link reliable while the local Next.js server streams routes. */}
        <a className={styles.attorneyRow} href={`/attorneys/${attorney.id}`} aria-label={`View ${attorney.full_name} and ${attorney.clientCount} linked ${attorney.clientCount === 1 ? "client" : "clients"}`}>
          <span className={styles.avatar}><BriefcaseBusiness size={21} aria-hidden="true" /></span>
          <span className={styles.attorneyInfo}><strong>{attorney.full_name}</strong><span>{attorney.email}</span><span>{attorney.contact_no}</span></span>
          <span className={styles.clientCount}>{attorney.clientCount} {attorney.clientCount === 1 ? "client" : "clients"}</span>
          <ChevronRight className={styles.chevron} size={19} aria-hidden="true" />
        </a>
      </li>)}</ul> : <div className={styles.emptyState}><BriefcaseBusiness size={29} aria-hidden="true" /><strong>{attorneys.length === 0 ? "No attorney records available" : "No matching attorneys"}</strong><p>{attorneys.length === 0 ? "Attorneys are saved when a client is added." : activeOnly ? "Try another search or show all attorneys." : "Try another name, contact number, or email."}</p></div>}
      <div className={styles.footer}>
        <span>Showing {rangeStart}–{rangeEnd} of {filtered.length} attorneys</span>
        <nav className={styles.pagination} aria-label="Attorney pages">
          <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
          <span aria-current="page">{currentPage}</span>
          <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} aria-hidden="true" /></button>
        </nav>
      </div>
    </section>
  </main>;
}
