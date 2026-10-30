"use client";

import { useState } from "react";
import { addClientSchema, type ClientInput } from "@/lib/validation/client";
import type { ClientRecord } from "../client-store";
import styles from "./record-actions.module.css";

const groups = [
  { title: "Petitioner", fields: [["petitionerName", "Name", "text"], ["petitionerBirthdate", "Birthdate", "date"], ["petitionerContact", "Contact number", "tel"], ["petitionerEmail", "Email address", "email"], ["petitionerAddress", "Address", "text"]] },
  { title: "Respondent", fields: [["respondentName", "Name", "text"], ["respondentBirthdate", "Birthdate", "date"], ["respondentContact", "Contact number", "tel"], ["respondentEmail", "Email address", "email"], ["respondentAddress", "Address", "text"]] },
] as const;

export default function EditClientDialog({ client, attorneys, onSave, onClose }: { client: ClientRecord; attorneys: { id: string; full_name: string; contact_no: string; email: string }[]; onSave: (input: ClientInput, attorneyId: string) => Promise<void>; onClose: () => void }) {
  const [values, setValues] = useState<ClientInput>(client);
  const [attorneyId, setAttorneyId] = useState(client.attorneyId);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const attorney = attorneys.find((item) => item.id === attorneyId);
    if (!attorney) { setError("Select an available attorney."); return; }
    const parsed = addClientSchema.safeParse({ ...values, attorneyName: attorney.full_name, attorneyContact: attorney.contact_no, attorneyEmail: attorney.email });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the entered information."); return; }
    setSaving(true); setError("");
    try { await onSave(parsed.data, attorneyId); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save client."); }
    finally { setSaving(false); }
  }

  return <div className={styles.overlay} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="edit-client-title">
    <h2 id="edit-client-title">Edit client information</h2>
    <form onSubmit={submit}>
      {groups.map((group) => <fieldset key={group.title} className={styles.fields}><legend>{group.title}</legend>{group.fields.map(([key, label, type]) => <label key={key}>{label}<input required type={type} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</fieldset>)}
      <label className={styles.selectLabel}>Attorney<select required value={attorneyId} onChange={(event) => setAttorneyId(event.target.value)}><option value="">Select an attorney</option>{attorneys.map((attorney) => <option key={attorney.id} value={attorney.id}>{attorney.full_name}</option>)}</select></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
    </form>
  </section></div>;
}
