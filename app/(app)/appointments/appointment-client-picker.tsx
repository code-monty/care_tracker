"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { browseAppointmentClients, type NameMatch } from "@/lib/actions/records";
import styles from "@/components/record-name-search.module.css";

export default function AppointmentClientPicker({ value, onChange, errorMessage }: {
  value: NameMatch | null;
  onChange: (value: NameMatch | null) => void;
  errorMessage?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value?.name ?? "");
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const result = await browseAppointmentClients(query.trim(), page);
        if (!current) return;
        setMatches((previous) => page === 0 ? result.matches : [...previous, ...result.matches]);
        setHasMore(result.hasMore);
        if (page === 0) setActive(0);
        setError(false);
      } catch {
        if (current) setError(true);
      } finally {
        if (current) setLoading(false);
      }
    }, query.trim() ? 200 : 0);
    return () => { current = false; clearTimeout(timer); };
  }, [open, query, page, retry]);

  function choose(match: NameMatch) {
    onChange(match);
    setQuery(match.name);
    setOpen(false);
    input.current?.focus();
  }

  return <div className={styles.field} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>Client *</label>
    <div className={styles.searchBox}><Search size={17} aria-hidden="true" /><input ref={input} id={id} type="search" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && matches.length ? `${id}-option-${active}` : undefined} aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? `${id}-error` : undefined} value={query} placeholder="Search client name" onFocus={() => { if (!open) { setOpen(true); setLoading(true); } }} onChange={(event) => { setQuery(event.target.value); onChange(null); setMatches([]); setPage(0); setHasMore(false); setLoading(true); setOpen(true); }} onKeyDown={(event) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (!open || !matches.length) return;
      if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % matches.length); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + matches.length) % matches.length); }
      if (event.key === "Enter") { event.preventDefault(); choose(matches[active]); }
    }} /></div>
    {errorMessage && <small id={`${id}-error`} className={styles.error} role="alert">{errorMessage}</small>}
    {open && <div className={styles.popup}>
      <div id={`${id}-options`} role="listbox" aria-label="Client * matches">
        {matches.map((match, index) => <button id={`${id}-option-${index}`} type="button" role="option" aria-selected={index === active} className={styles.option} key={match.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(match)}><strong>{match.name}</strong><small>{match.detail}</small></button>)}
      </div>
      {loading && <p role="status">Loading clients…</p>}
      {!loading && error && <p role="status">Unable to load clients. <button type="button" className={styles.retry} onMouseDown={(event) => event.preventDefault()} onClick={() => { setLoading(true); setRetry((current) => current + 1); }}>Retry</button></p>}
      {!loading && !error && matches.length === 0 && <p role="status">No matching clients.</p>}
      {!loading && !error && hasMore && <button type="button" className={styles.loadMore} onMouseDown={(event) => event.preventDefault()} onClick={() => { setLoading(true); setPage((current) => current + 1); }}>Load more clients</button>}
    </div>}
  </div>;
}
