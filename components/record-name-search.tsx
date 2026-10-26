"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { searchRecordNames, type NameMatch } from "@/lib/actions/records";
import styles from "./record-name-search.module.css";

export default function RecordNameSearch({ kind, label, value, onChange, autoFocus = false, errorMessage }: {
  kind: "client" | "attorney";
  label: string;
  value: NameMatch | null;
  onChange: (value: NameMatch | null) => void;
  autoFocus?: boolean;
  errorMessage?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const attachInput = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (node && kind === "attorney") setDialog(node.closest("dialog"));
  }, [kind]);
  const [query, setQuery] = useState(value?.name ?? "");
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (value || !open || !query.trim()) return;
    let current = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const result = await searchRecordNames(kind, query.trim());
        if (current) { setMatches(result); setActive(0); }
      } catch {
        if (current) { setMatches([]); setError(true); }
      } finally {
        if (current) setLoading(false);
      }
    }, 200);
    return () => { current = false; clearTimeout(timer); };
  }, [kind, open, query, value]);

  useLayoutEffect(() => {
    if (kind !== "attorney" || !open || value || !query.trim()) return;
    const dialog = inputRef.current?.closest("dialog");
    const body = inputRef.current?.closest<HTMLElement>("[data-client-dialog-body]");
    const update = () => {
      const input = inputRef.current?.parentElement?.getBoundingClientRect();
      const bounds = dialog?.getBoundingClientRect();
      const popup = popupRef.current;
      if (!input || !bounds || !popup) return;
      popup.style.left = `${input.left}px`;
      popup.style.width = `${input.width}px`;
      popup.style.bottom = `${window.innerHeight - input.top + 8}px`;
      popup.style.maxHeight = `${Math.max(0, Math.min(240, input.top - bounds.top - 16))}px`;
    };
    update();
    body?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { body?.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [kind, open, query, value]);

  function choose(match: NameMatch) {
    onChange(match);
    setQuery(match.name);
    setOpen(false);
    setMatches([]);
    inputRef.current?.focus();
  }

  const options = open && !value && query.trim() && <div ref={popupRef} className={`${styles.popup} ${kind === "attorney" ? styles.popupOverlay : ""}`} id={`${id}-options`} role="listbox" aria-label={`${label} matches`}>
    {loading ? <p role="status">Searching…</p> : error ? <p role="status">Search failed. Edit the name to retry.</p> : matches.length ? matches.map((match, index) => <button id={`${id}-option-${index}`} type="button" role="option" aria-selected={index === active} className={styles.option} key={match.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(match)}><strong>{match.name}</strong><small>{match.detail}</small></button>) : <p role="status">No matching {kind}s.</p>}
  </div>;
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    {kind === "attorney" && dialog && options && createPortal(options, dialog)}
    <div className={styles.searchBox}><Search size={17} aria-hidden="true" /><input ref={attachInput} id={id} type="search" role="combobox" aria-autocomplete="list" aria-expanded={open && !value && Boolean(query.trim())} aria-controls={`${id}-options`} aria-activedescendant={open && !value && matches.length ? `${id}-option-${active}` : undefined} aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? `${id}-error` : undefined} autoFocus={autoFocus} value={query} placeholder={`Search ${kind} name`} onChange={(event) => { setQuery(event.target.value); onChange(null); setMatches([]); setOpen(true); setError(false); }} onFocus={() => { if (!value && query.trim()) setOpen(true); }} onBlur={() => { window.setTimeout(() => setOpen(false), 100); }} onKeyDown={(event) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (!open || !matches.length) return;
      if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % matches.length); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + matches.length) % matches.length); }
      if (event.key === "Enter") { event.preventDefault(); choose(matches[active]); }
    }} /></div>
    {errorMessage && <small id={`${id}-error`} className={styles.error} role="alert">{errorMessage}</small>}
    {kind === "client" && options}
  </div>;
}
