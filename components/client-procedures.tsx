"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Check, ClipboardCheck, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import {
  addProcedureNote,
  deleteProcedureNote,
  getClientProcedures,
  setProcedureNotePinned,
  toggleProcedureCompleted,
  updateProcedureDateCreated,
  updateProcedureNote,
  type ClientProcedure,
  type ProcedureNote,
} from "@/lib/actions/procedures";
import { canEditProcedureTracking, canManageProcedureNote } from "@/lib/rules/procedures";
import styles from "./client-procedures.module.css";

const displayDateFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const noteDateFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const noteTimeFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatProcedureDate(value: string) {
  return displayDateFormat.format(new Date(`${value}T12:00:00Z`));
}

function formatNoteTimestamp(value: string) {
  const date = new Date(value);
  return `${noteDateFormat.format(date)} · ${noteTimeFormat.format(date)}`;
}

function isCommitReadyDate(value: string): boolean {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1900 && year <= 2100;
}

export default function ClientProcedures({ clientId }: { clientId: string }) {
  const [procedures, setProcedures] = useState<ClientProcedure[]>([]);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});
  const [pendingDateId, setPendingDateId] = useState<string | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const [addingProcedureId, setAddingProcedureId] = useState<string | null>(null);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [pendingNoteActionId, setPendingNoteActionId] = useState<string | null>(null);

  function syncDateDrafts(nextProcedures: ClientProcedure[]) {
    setDateDrafts(
      Object.fromEntries(nextProcedures.map((item) => [item.id, item.dateCreated ?? ""])),
    );
  }

  useEffect(() => {
    let active = true;
    getClientProcedures(clientId)
      .then((payload) => {
        if (!active) return;
        setProcedures(payload.procedures);
        setUser(payload.user);
        syncDateDrafts(payload.procedures);
        setError("");
      })
      .catch(() => {
        if (active) setError("Procedures could not be loaded. Reload to try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  const canEditTracking = Boolean(user && canEditProcedureTracking(user.role));

  async function commitDateCreated(procedure: ClientProcedure, rawValue: string) {
    if (!canEditTracking) return;
    const normalized = rawValue.trim();
    if (normalized === (procedure.dateCreated ?? "")) return;
    if (normalized !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return;

    setPendingDateId(procedure.id);
    setError("");
    try {
      const payload = await updateProcedureDateCreated(
        clientId,
        procedure.id,
        normalized || null,
      );
      setProcedures(payload.procedures);
      setUser(payload.user);
      syncDateDrafts(payload.procedures);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save date created.");
      setDateDrafts((current) => ({ ...current, [procedure.id]: procedure.dateCreated ?? "" }));
    } finally {
      setPendingDateId(null);
    }
  }

  async function handleToggleCompleted(procedure: ClientProcedure, checked: boolean) {
    if (!canEditTracking) return;
    setPendingStatusId(procedure.id);
    setError("");
    try {
      const payload = await toggleProcedureCompleted(clientId, procedure.id, checked);
      setProcedures(payload.procedures);
      setUser(payload.user);
      syncDateDrafts(payload.procedures);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update status.");
    } finally {
      setPendingStatusId(null);
    }
  }

  async function handleAddNote(event: React.FormEvent<HTMLFormElement>, procedureId: string) {
    event.preventDefault();
    if (!newNoteBody.trim()) {
      setError("Enter a note.");
      return;
    }
    setSavingNote(true);
    setError("");
    try {
      const payload = await addProcedureNote(clientId, procedureId, newNoteBody);
      setProcedures(payload.procedures);
      setUser(payload.user);
      setAddingProcedureId(null);
      setNewNoteBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleEditNote(event: React.FormEvent<HTMLFormElement>, noteId: string) {
    event.preventDefault();
    if (!editNoteBody.trim()) {
      setError("Enter a note.");
      return;
    }
    setSavingNote(true);
    setError("");
    try {
      const payload = await updateProcedureNote(clientId, noteId, editNoteBody);
      setProcedures(payload.procedures);
      setUser(payload.user);
      setEditNoteId(null);
      setEditNoteBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!window.confirm("Delete this procedure note?")) return;
    setPendingNoteActionId(noteId);
    setError("");
    try {
      const payload = await deleteProcedureNote(clientId, noteId);
      setProcedures(payload.procedures);
      setUser(payload.user);
      if (editNoteId === noteId) {
        setEditNoteId(null);
        setEditNoteBody("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete note.");
    } finally {
      setPendingNoteActionId(null);
    }
  }

  async function handleTogglePin(note: ProcedureNote) {
    setPendingNoteActionId(note.id);
    setError("");
    try {
      const payload = await setProcedureNotePinned(clientId, note.id, !note.pinned);
      setProcedures(payload.procedures);
      setUser(payload.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change pin.");
    } finally {
      setPendingNoteActionId(null);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="procedures-heading">
      <div className={styles.cardHeader}>
        <span className={styles.icon}>
          <ClipboardCheck size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 id="procedures-heading">Procedures / Requirements</h2>
          <p>Case milestones and tracking notes</p>
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className={styles.empty}>Loading procedures…</p>
      ) : procedures.length === 0 ? (
        <p className={styles.empty}>No procedures are available for this client.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Requirements Name</th>
                <th scope="col">Date Created</th>
                <th scope="col">Date Completed</th>
                <th scope="col">Status</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {procedures.map((proc) => {
                const draftDate = dateDrafts[proc.id] ?? proc.dateCreated ?? "";
                const dateBusy = pendingDateId === proc.id;
                const statusBusy = pendingStatusId === proc.id;

                return (
                  <tr key={proc.id}>
                    <td data-label="Requirements Name" className={styles.nameCell}>
                      <strong>{proc.name}</strong>
                    </td>

                    <td data-label="Date Created" className={styles.dateCell}>
                      {canEditTracking ? (
                        <input
                          type="date"
                          className={styles.dateInput}
                          aria-label={`Date created for ${proc.name}`}
                          value={draftDate}
                          disabled={dateBusy}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setDateDrafts((current) => ({ ...current, [proc.id]: nextValue }));
                            if (isCommitReadyDate(nextValue)) {
                              void commitDateCreated(proc, nextValue);
                            }
                          }}
                          onBlur={(event) => void commitDateCreated(proc, event.target.value)}
                        />
                      ) : (
                        <span className={styles.readOnlyDate}>
                          {proc.dateCreated ? formatProcedureDate(proc.dateCreated) : "—"}
                        </span>
                      )}
                    </td>

                    <td data-label="Date Completed" className={styles.dateCell}>
                      {proc.isCompleted && proc.dateCompleted ? (
                        <span
                          className={styles.completedDate}
                          aria-label={`Date completed for ${proc.name}`}
                        >
                          <CalendarCheck size={14} aria-hidden="true" />
                          <span>{formatProcedureDate(proc.dateCompleted)}</span>
                        </span>
                      ) : (
                        <span className={styles.emptyDate} aria-label="Not completed">
                          —
                        </span>
                      )}
                    </td>

                    <td data-label="Status" className={styles.statusCell}>
                      <label className={styles.statusCheckboxLabel}>
                        <input
                          type="checkbox"
                          className={styles.statusCheckboxInput}
                          checked={proc.isCompleted}
                          disabled={!canEditTracking || statusBusy}
                          aria-label={`Mark ${proc.name} completed`}
                          title={proc.isCompleted ? "Completed" : "Pending"}
                          onChange={(event) => void handleToggleCompleted(proc, event.target.checked)}
                        />
                        <span
                          className={`${styles.statusCheckboxBox} ${proc.isCompleted ? styles.statusChecked : ""}`}
                          aria-hidden="true"
                        >
                          {proc.isCompleted && <Check size={14} strokeWidth={3} />}
                        </span>
                        <span className={styles.statusText}>
                          {proc.isCompleted ? "Completed" : "Pending"}
                        </span>
                      </label>
                    </td>

                    <td data-label="Notes" className={styles.notesCell}>
                      <div className={styles.notesStack}>
                        {proc.notes.map((note) => {
                          const canManage = canManageProcedureNote(user, note.author_id);
                          const noteBusy = savingNote || pendingNoteActionId === note.id;

                          return (
                            <article
                              key={note.id}
                              className={`${styles.noteCard} ${note.pinned ? styles.pinnedNoteCard : ""}`}
                              aria-label={`Procedure note by ${note.author_name}`}
                            >
                              <div className={styles.noteMeta}>
                                <strong>{note.author_name}</strong>
                                <time dateTime={note.created_at}>
                                  {formatNoteTimestamp(note.created_at)}
                                </time>
                                {note.pinned && (
                                  <span className={styles.pinnedBadge}>
                                    <Pin size={11} aria-hidden="true" />
                                    Pinned
                                  </span>
                                )}
                              </div>

                              {editNoteId === note.id ? (
                                <form
                                  className={styles.noteForm}
                                  onSubmit={(event) => void handleEditNote(event, note.id)}
                                >
                                  <label htmlFor={`edit-proc-note-${note.id}`}>Edit note</label>
                                  <textarea
                                    id={`edit-proc-note-${note.id}`}
                                    required
                                    maxLength={4000}
                                    rows={3}
                                    value={editNoteBody}
                                    onChange={(event) => setEditNoteBody(event.target.value)}
                                  />
                                  <p className={styles.warning}>
                                    Do not enter clinical details such as test results or session content.
                                  </p>
                                  <div className={styles.formActions}>
                                    <button
                                      type="button"
                                      className={styles.secondaryBtn}
                                      disabled={savingNote}
                                      onClick={() => {
                                        setEditNoteId(null);
                                        setEditNoteBody("");
                                        setError("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      className={styles.primaryBtn}
                                      disabled={savingNote}
                                    >
                                      {savingNote ? "Saving…" : "Save changes"}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <p className={styles.noteBody}>{note.body}</p>
                                  <div className={styles.noteActions}>
                                    <button
                                      type="button"
                                      className={`${styles.noteActionBtn} ${note.pinned ? styles.noteActionActive : ""}`}
                                      disabled={noteBusy}
                                      aria-label={note.pinned ? "Unpin note" : "Pin note"}
                                      onClick={() => void handleTogglePin(note)}
                                    >
                                      <Pin size={13} aria-hidden="true" />
                                      <span>{note.pinned ? "Unpin" : "Pin"}</span>
                                    </button>

                                    {canManage && (
                                      <>
                                        <button
                                          type="button"
                                          className={styles.noteActionBtn}
                                          disabled={noteBusy}
                                          aria-label="Edit note"
                                          onClick={() => {
                                            setEditNoteId(note.id);
                                            setEditNoteBody(note.body);
                                            setAddingProcedureId(null);
                                            setError("");
                                          }}
                                        >
                                          <Pencil size={13} aria-hidden="true" />
                                          <span>Edit</span>
                                        </button>
                                        <button
                                          type="button"
                                          className={`${styles.noteActionBtn} ${styles.noteDeleteBtn}`}
                                          disabled={noteBusy}
                                          aria-label="Delete note"
                                          onClick={() => void handleDeleteNote(note.id)}
                                        >
                                          <Trash2 size={13} aria-hidden="true" />
                                          <span>Delete</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </article>
                          );
                        })}

                        {addingProcedureId === proc.id ? (
                          <form
                            className={styles.noteForm}
                            onSubmit={(event) => void handleAddNote(event, proc.id)}
                          >
                            <label htmlFor={`add-proc-note-${proc.id}`}>
                              Note for {proc.name}
                            </label>
                            <textarea
                              id={`add-proc-note-${proc.id}`}
                              required
                              maxLength={4000}
                              rows={3}
                              placeholder="Enter tracking note…"
                              value={newNoteBody}
                              onChange={(event) => setNewNoteBody(event.target.value)}
                            />
                            <p className={styles.warning}>
                              Do not enter clinical details such as test results or session content.
                            </p>
                            <div className={styles.formActions}>
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                disabled={savingNote}
                                onClick={() => {
                                  setAddingProcedureId(null);
                                  setNewNoteBody("");
                                  setError("");
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className={styles.primaryBtn}
                                disabled={savingNote}
                              >
                                {savingNote ? "Saving…" : "Save note"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div>
                            <button
                              type="button"
                              className={styles.addNoteBtn}
                              disabled={!user || savingNote}
                              onClick={() => {
                                setAddingProcedureId(proc.id);
                                setNewNoteBody("");
                                setEditNoteId(null);
                                setEditNoteBody("");
                                setError("");
                              }}
                            >
                              <Plus size={14} aria-hidden="true" />
                              <span>Add note</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
