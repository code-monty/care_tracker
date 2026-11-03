"use client";

import { useEffect, useState } from "react";
import { addRecordNote, getRecordNotes, type RecordNote } from "@/lib/actions/notes";
import styles from "./record-notes.module.css";

type Target = { kind: "client" | "attorney"; id: string };
const dateFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
function roleLabel(role: string) { return role === "admin" ? "Admin" : role === "secretary" ? "Secretary" : "Staff"; }

export default function RecordNotes({ target }: { target: Target }) {
  const { kind, id } = target;
  const [notes, setNotes] = useState<RecordNote[]>([]);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewAt, setPreviewAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    getRecordNotes({ kind, id }).then((result) => { if (active) { setNotes(result.notes); setUser(result.user); setError(""); } })
      .catch(() => { if (active) setError("Notes could not be loaded. Reload to try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) { setError("Enter a note."); return; }
    setSaving(true); setError("");
    try {
      const result = await addRecordNote(target, body);
      setNotes(result.notes); setUser(result.user); setBody(""); setEditing(false); setPreviewAt(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save note."); }
    finally { setSaving(false); }
  }

  return <section className={styles.section} aria-labelledby={`${target.kind}-notes-heading`}>
    <div className={styles.header}><h2 id={`${target.kind}-notes-heading`}>Notes</h2><button type="button" onClick={() => { setPreviewAt(new Date()); setEditing(true); setError(""); }} disabled={loading || !user || editing}>Add Note</button></div>
    {editing && user && previewAt && <form className={styles.form} onSubmit={save}>
      <div className={styles.meta}><div><span>Current user</span><strong>{user.name} · {roleLabel(user.role)}</strong></div><div><span>Date</span><strong>{dateFormat.format(previewAt)}</strong><span>Time</span><strong>{timeFormat.format(previewAt)}</strong></div></div>
      <label htmlFor={`${target.kind}-note-body`}>Note</label><textarea id={`${target.kind}-note-body`} required maxLength={4000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
      <p className={styles.warning}>Do not enter clinical details such as test results or session content.</p>
      <div className={styles.actions}><button type="button" onClick={() => { setEditing(false); setBody(""); setError(""); }} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save note"}</button></div>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading ? <p className={styles.empty}>Loading notes…</p> : notes.length ? <ul className={styles.list}>{notes.map((note) => <li key={note.id}><div className={styles.noteHeader}><strong>{note.author_name} · {roleLabel(note.author_role)}</strong><time dateTime={note.created_at}><span>{dateFormat.format(new Date(note.created_at))}</span><span>{timeFormat.format(new Date(note.created_at))}</span></time></div><p>{note.body}</p></li>)}</ul> : <p className={styles.empty}>No notes yet.</p>}
  </section>;
}
