"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { clientDetailsSchema, editClientSchema, sexOptions, type AttorneyChoice, type EditClientInput } from "@/lib/validation/client";
import RecordNameSearch from "@/components/record-name-search";
import type { NameMatch } from "@/lib/actions/records";
import type { ClientRecord } from "../client-store";
import formStyles from "../clients.module.css";
import styles from "./record-actions.module.css";

const groups = [
  { title: "Petitioner / Client Details", fields: [["petitionerName", "Full name", "text"], ["petitionerBirthdate", "Birthdate", "date"], ["petitionerSex", "Sex", "select"], ["petitionerContact", "Contact number", "tel"], ["petitionerEmail", "Email address", "email"], ["petitionerAddress", "Full residential address", "text"]] },
  { title: "Respondent Details", fields: [["respondentName", "Full name", "text"], ["respondentBirthdate", "Birthdate", "date"], ["respondentSex", "Sex", "select"], ["respondentContact", "Contact number", "tel"], ["respondentEmail", "Email address", "email"], ["respondentAddress", "Full residential address", "text"]] },
] as const;

export default function EditClientDialog({ client, attorneys, onSave, onClose }: { client: ClientRecord; attorneys: { id: string; full_name: string; contact_no: string; email: string }[]; onSave: (input: EditClientInput, choice: AttorneyChoice) => Promise<void>; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<EditClientInput>(client);
  const [attorneyMode, setAttorneyMode] = useState<AttorneyChoice["mode"]>("keep");
  const [selectedAttorney, setSelectedAttorney] = useState<NameMatch | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (attorneyMode === "existing" && !selectedAttorney) { setError("Select an existing attorney from the search results."); return; }
    const parsed = attorneyMode === "new" ? editClientSchema.safeParse(values) : clientDetailsSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the entered information."); return; }
    const choice: AttorneyChoice = attorneyMode === "existing" ? { mode: "existing", attorneyId: selectedAttorney!.id } : { mode: attorneyMode };
    setSaving(true); setError("");
    const saveValues = selectedAttorney && attorneyMode === "existing" ? { ...values, attorneyName: selectedAttorney.name, attorneyContact: selectedAttorney.contact ?? "", attorneyEmail: selectedAttorney.detail } : values;
    try { await onSave(saveValues, choice); dialogRef.current?.close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save client."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialogRef} className={formStyles.dialog} aria-labelledby="edit-client-title" onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }}>
    <form onSubmit={submit} className={styles.editForm}>
      <div className={formStyles.dialogHeader}><div className={formStyles.dialogTitle}><Pencil size={20} aria-hidden="true" /><h2 id="edit-client-title">Edit client information</h2></div><button className={formStyles.iconButton} type="button" aria-label="Close Edit client information" disabled={saving} onClick={() => dialogRef.current?.close()}><X size={20} aria-hidden="true" /></button></div>
      <div className={formStyles.dialogBody} data-client-dialog-body>
        {groups.map((group) => <section key={group.title} className={formStyles.formSection}><h3>{group.title}</h3><div className={formStyles.formGrid}>{group.fields.map(([key, label, type]) => <div key={key} className={`${formStyles.formField} ${key.endsWith("Address") ? formStyles.wide : ""}`}><label htmlFor={`edit-${key}`}>{label}</label>{type === "select" ? <select id={`edit-${key}`} value={values[key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value || null }))}>{values[key] === null && <option value="">Not recorded</option>}{sexOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input id={`edit-${key}`} required type={type} autoFocus={key === "petitionerName"} value={values[key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />}</div>)}</div></section>)}
        <section className={formStyles.formSection}><h3>Legal Counsel Information</h3>
          <div className={formStyles.attorneyChoices} role="group" aria-label="Attorney choice">
            <button type="button" className={formStyles.attorneyChoice} aria-pressed={attorneyMode === "keep"} onClick={() => { setAttorneyMode("keep"); setError(""); }}>{client.attorneyId ? "Keep current attorney" : "Keep unassigned"}</button>
            <button type="button" className={formStyles.attorneyChoice} aria-pressed={attorneyMode === "new"} onClick={() => { if (attorneyMode !== "new" && values.attorneyName === client.attorneyName) setValues((current) => ({ ...current, attorneyName: "", attorneyContact: "", attorneyEmail: "" })); setAttorneyMode("new"); setError(""); }}>Add Attorney</button>
            <button type="button" className={formStyles.attorneyChoice} aria-pressed={attorneyMode === "existing"} onClick={() => { setAttorneyMode("existing"); setError(""); }}>Existing Attorney</button>
          </div>
          {attorneyMode === "keep" ? <p>{client.attorneyId ? `Current attorney: ${client.attorneyName}` : "No current attorney. You can save other changes and add one later."}</p>
            : attorneyMode === "new" ? <div className={formStyles.formGrid}>
              <div className={formStyles.formField}><label htmlFor="edit-attorneyName">Name of attorney</label><input id="edit-attorneyName" required value={values.attorneyName} onChange={(event) => setValues((current) => ({ ...current, attorneyName: event.target.value }))} /></div>
              <div className={formStyles.formField}><label htmlFor="edit-attorneyContact">Attorney contact number</label><input id="edit-attorneyContact" required type="tel" value={values.attorneyContact} onChange={(event) => setValues((current) => ({ ...current, attorneyContact: event.target.value }))} /></div>
              <div className={`${formStyles.formField} ${formStyles.wide}`}><label htmlFor="edit-attorneyEmail">Attorney email address</label><input id="edit-attorneyEmail" required type="email" value={values.attorneyEmail} onChange={(event) => setValues((current) => ({ ...current, attorneyEmail: event.target.value }))} /></div>
            </div> : <div className={formStyles.existingAttorney}><RecordNameSearch kind="attorney" label="Select attorney" value={selectedAttorney} onChange={(item) => { setSelectedAttorney(item); setError(""); }} />{attorneys.length === 0 && <p>No existing attorneys are available. Choose Add Attorney to enter one.</p>}{selectedAttorney && <dl className={formStyles.attorneyDetails}><div><dt>Name</dt><dd>{selectedAttorney.name}</dd></div><div><dt>Contact number</dt><dd>{selectedAttorney.contact}</dd></div><div><dt>Email address</dt><dd>{selectedAttorney.detail}</dd></div></dl>}</div>}
        </section>
      </div>
      <div className={formStyles.dialogFooter}><div className={formStyles.saveMessage}>{error && <p className={formStyles.formError} role="alert">{error}</p>}</div><div><button className={formStyles.cancelButton} type="button" disabled={saving} onClick={() => dialogRef.current?.close()}>Cancel</button><button className={formStyles.saveButton} type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></div>
    </form>
  </dialog>;
}
