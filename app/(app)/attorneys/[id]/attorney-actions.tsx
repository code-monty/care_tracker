"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveAttorneyRecord, updateAttorneyRecord } from "@/lib/actions/records";
import styles from "../../clients/[id]/record-actions.module.css";

type Attorney = { id: string; full_name: string; contact_no: string; email: string };

export default function AttorneyActions({ attorney, linkedCount }: { attorney: Attorney; linkedCount: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(attorney);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await updateAttorneyRecord(attorney.id, values); setEditing(false); router.refresh(); }
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

  return <><div className={styles.toolbar}><button className={styles.recordButton} type="button" onClick={() => { setValues(attorney); setEditing(true); }}>Edit attorney</button><button className={styles.recordButton} type="button" onClick={archive} disabled={saving || linkedCount > 0} title={linkedCount > 0 ? "Reassign all linked clients first" : undefined}>Delete attorney</button>{linkedCount > 0 && <span>Reassign all linked clients before deleting.</span>}</div>{error && <p role="alert" className={styles.error}>{error}</p>}
    {editing && <div className={styles.overlay} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="edit-attorney-title"><h2 id="edit-attorney-title">Edit attorney information</h2><form onSubmit={save}><div className={styles.fields}><label>Name<input required maxLength={120} value={values.full_name} onChange={(event) => setValues({ ...values, full_name: event.target.value })} /></label><label>Contact number<input required type="tel" pattern="09[0-9]{2}-?[0-9]{3}-?[0-9]{4}" value={values.contact_no} onChange={(event) => setValues({ ...values, contact_no: event.target.value })} /></label><label>Email address<input required type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></label></div>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button type="button" disabled={saving} onClick={() => setEditing(false)}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></form></section></div>}
  </>;
}
