"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { archiveAttorneyRecord, updateAttorneyRecord } from "@/lib/actions/records";
import formStyles from "../../clients/clients.module.css";
import styles from "../../clients/[id]/record-actions.module.css";

type Attorney = { id: string; full_name: string; contact_no: string; email: string };

export default function AttorneyActions({ attorney, linkedCount }: { attorney: Attorney; linkedCount: number }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(attorney);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (editing) dialogRef.current?.showModal(); }, [editing]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await updateAttorneyRecord(attorney.id, values); dialogRef.current?.close(); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save attorney."); }
    finally { setSaving(false); }
  }

  async function archive() {
    if (!window.confirm("Delete this attorney? The record will be archived and hidden from lists. An Admin can restore it.")) return;
    setSaving(true); setError("");
    try { await archiveAttorneyRecord(attorney.id); router.push("/attorneys"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to archive attorney."); }
    finally { setSaving(false); }
  }

  return <>
    <div className={styles.toolbar}><button className={styles.recordButton} type="button" disabled={saving} onClick={() => { setValues(attorney); setError(""); setEditing(true); }}><Pencil size={16} aria-hidden="true" />Edit attorney</button><button className={styles.dangerButton} type="button" onClick={archive} disabled={saving || linkedCount > 0}>Delete attorney</button>{linkedCount > 0 && <span className={styles.hint}>Reassign all linked clients before deleting.</span>}</div>
    {!editing && error && <p role="alert" className={styles.error}>{error}</p>}
    {editing && <dialog ref={dialogRef} className={formStyles.dialog} aria-labelledby="edit-attorney-title" onClose={() => setEditing(false)} onCancel={(event) => { if (saving) event.preventDefault(); }}>
      <form onSubmit={save} className={styles.editForm}>
        <div className={formStyles.dialogHeader}><div className={formStyles.dialogTitle}><Pencil size={20} aria-hidden="true" /><h2 id="edit-attorney-title">Edit attorney information</h2></div><button className={formStyles.iconButton} type="button" aria-label="Close Edit attorney information" disabled={saving} onClick={() => dialogRef.current?.close()}><X size={20} aria-hidden="true" /></button></div>
        <div className={formStyles.dialogBody}><section className={formStyles.formSection}><h3>Attorney Details</h3><div className={formStyles.formGrid}><div className={formStyles.formField}><label htmlFor="edit-attorney-name">Full name</label><input id="edit-attorney-name" required maxLength={120} autoFocus value={values.full_name} onChange={(event) => setValues({ ...values, full_name: event.target.value })} /></div><div className={formStyles.formField}><label htmlFor="edit-attorney-contact">Contact number</label><input id="edit-attorney-contact" required type="tel" pattern="09[0-9]{2}-?[0-9]{3}-?[0-9]{4}" value={values.contact_no} onChange={(event) => setValues({ ...values, contact_no: event.target.value })} /></div><div className={`${formStyles.formField} ${formStyles.wide}`}><label htmlFor="edit-attorney-email">Email address</label><input id="edit-attorney-email" required type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></div></div></section></div>
        <div className={formStyles.dialogFooter}><div className={formStyles.saveMessage}>{error && <p className={formStyles.formError} role="alert">{error}</p>}</div><div><button className={formStyles.cancelButton} type="button" disabled={saving} onClick={() => dialogRef.current?.close()}>Cancel</button><button className={formStyles.saveButton} type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></div>
      </form>
    </dialog>}
  </>;
}
