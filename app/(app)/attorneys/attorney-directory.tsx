"use client";
import Link from "next/link";

import { useState } from "react";
import { BriefcaseBusiness, ChevronRight, Search } from "lucide-react";
import styles from "./attorneys.module.css";

type Attorney = { id: string; full_name: string; contact_no: string; email: string; clientCount: number };

export default function AttorneyDirectory({ attorneys, showArchived = false }: { attorneys: Attorney[]; showArchived?: boolean }) {
  const [search, setSearch] = useState("");
  const filtered = attorneys.filter((attorney) => `${attorney.full_name} ${attorney.contact_no} ${attorney.email}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return <main className={styles.page}>
    <div className={styles.heading}><h1>Attorneys</h1><p>Find legal counsel and review the clients they handle.</p>{showArchived && <Link href="/attorneys/archived">View archived attorneys</Link>}</div>
    <section className={styles.panel} aria-label="Attorney directory">
      <div className={styles.toolbar}><label className={styles.searchField}><Search size={18} aria-hidden="true" /><span className={styles.srOnly}>Search attorneys</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search attorneys" /></label></div>
      {filtered.length ? <ul className={styles.directory}>{filtered.map((attorney) => <li key={attorney.id}>
        {/* Full navigation keeps this record link reliable while the local Next.js server streams routes. */}
        <a className={styles.attorneyRow} href={`/attorneys/${attorney.id}`} aria-label={`View ${attorney.full_name} and ${attorney.clientCount} linked ${attorney.clientCount === 1 ? "client" : "clients"}`}>
          <span className={styles.avatar}><BriefcaseBusiness size={21} aria-hidden="true" /></span>
          <span className={styles.attorneyInfo}><strong>{attorney.full_name}</strong><span>{attorney.email}</span><span>{attorney.contact_no}</span></span>
          <span className={styles.clientCount}>{attorney.clientCount} {attorney.clientCount === 1 ? "client" : "clients"}</span>
          <ChevronRight className={styles.chevron} size={19} aria-hidden="true" />
        </a>
      </li>)}</ul> : <div className={styles.emptyState}><BriefcaseBusiness size={29} aria-hidden="true" /><strong>{search.trim() ? "No matching attorneys" : "No attorney records available"}</strong><p>{search.trim() ? "Try another name, contact number, or email." : "Attorneys are saved when a client is added."}</p></div>}
      <div className={styles.footer}>Showing {filtered.length} of {attorneys.length} attorneys</div>
    </section>
  </main>;
}
