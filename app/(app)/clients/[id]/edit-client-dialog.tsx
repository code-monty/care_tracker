"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { addClientSchema, type ClientInput } from "@/lib/validation/client";
import type { ClientRecord } from "../client-store";
import formStyles from "../clients.module.css";
import styles from "./record-actions.module.css";

const groups = [
  { title: "Petitioner / Client Details", fields: [["petitionerName", "Full name", "text"], ["petitionerBirthdate", "Birthdate", "date"], ["petitionerContact", "Contact number", "tel"], ["petitionerEmail", "Email address", "email"], ["petitionerAddress", "Full residential address", "text"]] },
  { title: "Respondent Details", fields: [["respondentName", "Full name", "text"], ["respondentBirthdate", "Birthdate", "date"], ["respondentContact", "Contact number", "tel"], ["respondentEmail", "Email address", "email"], ["respondentAddress", "Full residential address", "text"]] },
] as const;

export default function EditClientDialog({ client, attorneys, onSave, onClose }: { client: ClientRecord; attorneys: { id: string; full_name: string; contact_no: string; email: string }[]; onSave: (input: ClientInput, attorneyId: string) => Promise<void>; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<ClientInput>(client);
  const [attorneyId, setAttorneyId] = useState(client.attorneyId);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const attorney = attorneys.find((item) => item.id === attorneyId);
    if (!attorney) { setError("Select an available attorney."); return; }
    const parsed = addClientSchema.safeParse({ ...values, attorneyName: attorney.full_name, attorneyContact: attorney.contact_no, attorneyEmail: attorney.email });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the entered information."); return; }
    setSaving(true); setError("");
    try { await onSave(parsed.data, attorneyId); dialogRef.current?.close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save client."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialogRef} className={formStyles.dialog} aria-labelledby="edit-client-title" onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }}>
    <form onSubmit={submit} className={styles.editForm}>
      <div className={formStyles.dialogHeader}><div className={formStyles.dialogTitle}><Pencil size={20} aria-hidden="true" /><h2 id="edit-client-title">Edit client information</h2></div><button className={formStyles.iconButton} type="button" aria-label="Close Edit client information" disabled={saving} onClick={() => dialogRef.current?.close()}><X size={20} aria-hidden="true" /></button></div>
      <div className={formStyles.dialogBody}>
        {groups.map((group) => <section key={group.title} className={formStyles.formSection}><h3>{group.title}</h3><div className={formStyles.formGrid}>{group.fields.map(([key, label, type]) => <div key={key} className={`${formStyles.formField} ${key.endsWith("Address") ? formStyles.wide : ""}`}><label htmlFor={`edit-${key}`}>{label}</label><input id={`edit-${key}`} required type={type} autoFocus={key === "petitionerName"} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div></section>)}
        <section className={formStyles.formSection}><h3>Legal Counsel Information</h3><div className={formStyles.formField}><label htmlFor="edit-attorney">Attorney</label><select id="edit-attorney" required value={attorneyId} onChange={(event) => setAttorneyId(event.target.value)}><option value="">Select an attorney</option>{attorneys.map((attorney) => <option key={attorney.id} value={attorney.id}>{attorney.full_name}</option>)}</select></div></section>
      </div>
      <div className={formStyles.dialogFooter}><div className={formStyles.saveMessage}>{error && <p className={formStyles.formError} role="alert">{error}</p>}</div><div><button className={formStyles.cancelButton} type="button" disabled={saving} onClick={() => dialogRef.current?.close()}>Cancel</button><button className={formStyles.saveButton} type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></div>
    </form>
  </dialog>;
}
