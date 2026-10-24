"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import type { ClientInput } from "@/lib/validation/client";
import AddClientDialog from "./add-client-dialog";
import { useClientStore } from "./client-store";
import styles from "./clients.module.css";

type SortKey = "name" | "status";
const pageSize = 10;

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [descending, setDescending] = useState(false);
  const { clients, attorneys, addClient: storeAddClient } = useClientStore();
  const [page, setPage] = useState(1);

  function toggleSort(key: SortKey) {
    if (sort === key) setDescending((value) => !value);
    else { setSort(key); setDescending(false); }
  }

  const hasFilter = search.trim().length > 0 || status !== "all";
  const filtered = clients.filter((client) => {
    const matchesSearch = `${client.petitionerName} ${client.attorneyName}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    return matchesSearch && (status === "all" || client.status.toLocaleLowerCase() === status);
  }).sort((a, b) => {
    const result = sort === "name" ? a.petitionerName.localeCompare(b.petitionerName) : a.status.localeCompare(b.status);
    return descending ? -result : result;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleClients = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function addClient(input: ClientInput, attorneyId?: string) {
    await storeAddClient(input, attorneyId);
    setSearch(""); setStatus("all"); setPage(1);
  }

  return (
    <main className={styles.clients}>
      <div className={styles.heading}><div><h1>Clients</h1><p>Review active and inactive client records.</p></div><AddClientDialog onSave={addClient} existingClients={clients} attorneys={attorneys} /></div>
      <section className={styles.panel} aria-label="Client list">
        <div className={styles.toolbar}>
          <label className={styles.searchField}><Search size={18} aria-hidden="true" /><span className={styles.srOnly}>Search clients or attorneys</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search clients or attorneys" type="search" /></label>
          <label className={styles.statusField}><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select><ChevronDown size={16} aria-hidden="true" /></label>
        </div>
        <div className={styles.tableScroll}>
          <table><thead><tr>
            <th scope="col"><button type="button" onClick={() => toggleSort("name")} aria-label={`Sort by petitioner name, ${sort === "name" && !descending ? "descending" : "ascending"}`}>Petitioner name <span aria-hidden="true">{sort === "name" ? (descending ? "↓" : "↑") : "↕"}</span></button></th>
            <th scope="col">Contact no.</th><th scope="col">Email address</th>
            <th scope="col"><button type="button" onClick={() => toggleSort("status")} aria-label={`Sort by status, ${sort === "status" && !descending ? "descending" : "ascending"}`}>Status <span aria-hidden="true">{sort === "status" ? (descending ? "↓" : "↑") : "↕"}</span></button></th>
            <th scope="col">Actions</th>
          </tr></thead><tbody>{visibleClients.length ? visibleClients.map((client) => <tr className={styles.clientRow} key={client.id}><td>{client.petitionerName}</td><td>{client.petitionerContact}</td><td>{client.petitionerEmail}</td><td><span className={client.status === "Active" ? styles.activeBadge : styles.inactiveBadge}>{client.status}</span></td><td><Link className={styles.detailsButton} href={`/clients/${client.id}`}>View Details</Link></td></tr>) : <tr><td className={styles.emptyCell} colSpan={5}><div className={styles.emptyState}><span className={styles.emptyIcon}><Users size={27} aria-hidden="true" /></span><strong>{hasFilter ? "No matching clients" : "No client records available"}</strong><p>{hasFilter ? "Try another search or status filter." : "Add a client to begin."}</p></div></td></tr>}</tbody></table>
        </div>
        <div className={styles.footer}><span>{filtered.length ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} clients` : "Showing 0 of 0 clients"}</span><nav className={styles.pagination} aria-label="Client pages"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} aria-hidden="true" /></button><span aria-current="page">{currentPage}</span><button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} aria-hidden="true" /></button></nav></div>
      </section>
    </main>
  );
}
