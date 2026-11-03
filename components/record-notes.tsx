"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Pin, UserRound } from "lucide-react";
import { addRecordNote, addRecordNoteReply, getRecordNotes, setRecordNotePinned, type NoteReply, type RecordNote } from "@/lib/actions/notes";
import styles from "./record-notes.module.css";

type Target = { kind: "client" | "attorney"; id: string };
const dateFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
function roleLabel(role: string) { return role === "admin" ? "Admin" : role === "secretary" ? "Secretary" : "Staff"; }

function Attribution({ entry, reply = false }: { entry: NoteReply; reply?: boolean }) {
  return <div className={styles.attribution}>
    <span className={`${styles.avatar} ${reply ? styles.replyAvatar : ""}`} aria-hidden="true"><UserRound size={17} /></span>
    <div className={styles.person}><strong>{entry.author_name} · {roleLabel(entry.author_role)}</strong><time dateTime={entry.created_at}><span>{dateFormat.format(new Date(entry.created_at))}</span><span>{timeFormat.format(new Date(entry.created_at))}</span></time></div>
  </div>;
}

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
  const [replyNoteId, setReplyNoteId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyPreviewAt, setReplyPreviewAt] = useState<Date | null>(null);
  const [pendingPinId, setPendingPinId] = useState<string | null>(null);

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

  async function changePin(note: RecordNote) {
    setPendingPinId(note.id); setError("");
    try { const result = await setRecordNotePinned(target, note.id, !note.pinned); setNotes(result.notes); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to change pin."); }
    finally { setPendingPinId(null); }
  }

  async function saveReply(event: React.FormEvent<HTMLFormElement>, noteId: string) {
    event.preventDefault();
    if (!replyBody.trim()) { setError("Enter a reply."); return; }
    setSaving(true); setError("");
    try {
      const result = await addRecordNoteReply(target, noteId, replyBody);
      setNotes(result.notes); setReplyBody(""); setReplyNoteId(null); setReplyPreviewAt(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save reply."); }
    finally { setSaving(false); }
  }

  return <section className={styles.section} aria-labelledby={`${kind}-notes-heading`}>
    <div className={styles.header}><h2 id={`${kind}-notes-heading`}>Notes</h2><button className={styles.primaryButton} type="button" onClick={() => { setPreviewAt(new Date()); setEditing(true); setError(""); }} disabled={loading || !user || editing}>Add Note</button></div>
    {editing && user && previewAt && <form className={styles.form} onSubmit={save}>
      <div className={styles.meta}><div><span>Current user</span><strong>{user.name} · {roleLabel(user.role)}</strong></div><div><span>Date</span><strong>{dateFormat.format(previewAt)}</strong><span>Time</span><strong>{timeFormat.format(previewAt)}</strong></div></div>
      <label htmlFor={`${kind}-note-body`}>Note</label><textarea id={`${kind}-note-body`} required maxLength={4000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
      <p className={styles.warning}>Do not enter clinical details such as test results or session content.</p>
      <div className={styles.actions}><button type="button" onClick={() => { setEditing(false); setBody(""); setError(""); }} disabled={saving}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Saving…" : "Save note"}</button></div>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading ? <p className={styles.empty}>Loading notes…</p> : notes.length ? <ul className={styles.list}>{notes.map((note) => <li key={note.id} className={`${styles.card} ${note.pinned ? styles.pinnedCard : ""}`}>
      {note.pinned && <span className={styles.ribbon}><Pin size={12} aria-hidden="true" /></span>}
      <article aria-label={`Note by ${note.author_name}`}>
        <div className={styles.cardTop}><Attribution entry={note} /><div className={styles.cardControls}><button className={styles.iconButton} type="button" aria-label={note.pinned ? "Unpin note" : "Pin note"} title={note.pinned ? "Unpin note" : "Pin note"} disabled={pendingPinId === note.id} onClick={() => changePin(note)}><Pin size={17} aria-hidden="true" /></button>{note.pinned && <span className={styles.pinnedLabel}>Pinned</span>}<button className={styles.iconButton} type="button" aria-label={`Reply to note by ${note.author_name}`} aria-expanded={replyNoteId === note.id} title="Reply to note" onClick={() => { setReplyNoteId(replyNoteId === note.id ? null : note.id); setReplyBody(""); setReplyPreviewAt(new Date()); setError(""); }}><MessageCircle size={18} aria-hidden="true" /></button></div></div>
        <p className={styles.noteBody}>{note.body}</p>
        {note.replies.length > 0 && <ul className={styles.replies}>{note.replies.map((reply) => <li key={reply.id} className={styles.reply}><Attribution entry={reply} reply /><p className={styles.noteBody}>{reply.body}</p></li>)}</ul>}
        {replyNoteId === note.id && user && replyPreviewAt && <form className={styles.replyForm} onSubmit={(event) => saveReply(event, note.id)}><div className={styles.replyFormHeading}><strong>Reply as {user.name} · {roleLabel(user.role)}</strong><span>{dateFormat.format(replyPreviewAt)}<br />{timeFormat.format(replyPreviewAt)}</span></div><label htmlFor={`reply-${note.id}`}>Reply</label><textarea id={`reply-${note.id}`} required maxLength={4000} rows={3} value={replyBody} onChange={(event) => setReplyBody(event.target.value)} /><p className={styles.warning}>Do not enter clinical details such as test results or session content.</p><div className={styles.actions}><button type="button" disabled={saving} onClick={() => { setReplyNoteId(null); setReplyBody(""); setError(""); }}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Saving…" : "Save reply"}</button></div></form>}
      </article>
    </li>)}</ul> : <p className={styles.empty}>No notes yet.</p>}
  </section>;
}
