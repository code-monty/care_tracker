"use client";

import { useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { addClientSchema, ageFromBirthdate, clientFieldSchemas, type ClientField, type ClientInput } from "@/lib/validation/client";
import styles from "./clients.module.css";

type Values = Record<ClientField, string>;
const emptyValues = Object.fromEntries(Object.keys(clientFieldSchemas).map((key) => [key, ""])) as Values;

export default function AddClientDialog({ onSave, existingClients, attorneys }: { onSave: (client: ClientInput, attorneyId?: string) => Promise<void>; existingClients: ClientInput[]; attorneys: { id: string; full_name: string; contact_no: string; email: string }[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Values>(emptyValues);
  const [touched, setTouched] = useState<Partial<Record<ClientField, boolean>>>({});
  const [formError, setFormError] = useState("");
  const [attorneyMode, setAttorneyMode] = useState<"new" | "existing">("new");
  const [attorneyId, setAttorneyId] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedAttorney = attorneys.find((item) => item.id === attorneyId);

  function close() { dialogRef.current?.close(); }
  function reset() { setValues(emptyValues); setTouched({}); setFormError(""); setAttorneyMode("new"); setAttorneyId(""); }

  async function save() {
    const chosen = attorneyMode === "existing" ? attorneys.find((item) => item.id === attorneyId) : undefined;
    if (attorneyMode === "existing" && !chosen) { setFormError("Select an existing attorney."); dialogRef.current?.querySelector<HTMLElement>("#existing-attorney")?.focus(); return; }
    const result = addClientSchema.safeParse(chosen ? { ...values, attorneyName: chosen.full_name, attorneyContact: chosen.contact_no, attorneyEmail: chosen.email } : values);
    if (!result.success) {
      setTouched(Object.fromEntries(Object.keys(clientFieldSchemas).map((key) => [key, true])));
      setFormError("Check the highlighted fields before saving.");
      const invalidFields = new Set(result.error.issues.map((issue) => issue.path[0]));
      const formOrder: ClientField[] = ["petitionerName", "petitionerBirthdate", "petitionerContact", "petitionerEmail", "petitionerAddress", "respondentName", "respondentBirthdate", "respondentContact", "respondentEmail", "respondentAddress", "attorneyName", "attorneyContact", "attorneyEmail"];
      const firstInvalid = formOrder.find((key) => invalidFields.has(key));
      if (typeof firstInvalid === "string") requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>(`#client-${firstInvalid}`)?.focus());
      return;
    }
    const duplicate = existingClients.some((client) => client.petitionerName.toLocaleLowerCase().trim() === result.data.petitionerName.toLocaleLowerCase().trim() && client.petitionerBirthdate === result.data.petitionerBirthdate);
    if (duplicate) {
      setFormError("A client with this name and birthdate already exists.");
      return;
    }
    setSaving(true);
    try { await onSave(result.data, chosen?.id); close(); }
    catch { setFormError("Unable to save client. Check for an existing record and try again."); }
    finally { setSaving(false); }
  }

  function field(key: ClientField, label: string, options: { type?: string; placeholder?: string; multiline?: boolean; autoFocus?: boolean } = {}) {
    const result = clientFieldSchemas[key].safeParse(values[key]);
    const error = touched[key] && !result.success ? result.error.issues[0]?.message : undefined;
    const id = `client-${key}`;
    const shared = {
      id,
      value: values[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setValues((current) => ({ ...current, [key]: event.target.value })); setFormError(""); },
      onBlur: () => setTouched((current) => ({ ...current, [key]: true })),
      "aria-invalid": Boolean(error) as boolean,
      "aria-describedby": error ? `${id}-error` : undefined,
      required: true,
    };
    return <div className={styles.formField} key={key}>
      <label htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      {options.multiline ? <textarea {...shared} rows={2} placeholder={options.placeholder} /> : <input {...shared} type={options.type ?? "text"} placeholder={options.placeholder} autoFocus={options.autoFocus} max={options.type === "date" ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) : undefined} />}
      {error && <small className={styles.fieldError} id={`${id}-error`}>{error}</small>}
    </div>;
  }

  function person(prefix: "petitioner" | "respondent") {
    const birthdateKey = `${prefix}Birthdate` as ClientField;
    const age = ageFromBirthdate(values[birthdateKey]);
    return <div className={styles.formGrid}>
      {field(`${prefix}Name`, "Full name", { placeholder: "Enter full name", autoFocus: prefix === "petitioner" })}
      {field(birthdateKey, "Birthdate", { type: "date" })}
      <div className={styles.formField}><label htmlFor={`${prefix}-age`}>Age</label><input id={`${prefix}-age`} type="text" value={age === null ? "" : String(age)} placeholder="Calculated from birthdate" readOnly aria-readonly="true" /></div>
      {field(`${prefix}Contact`, "Contact number", { type: "tel", placeholder: "09XX-XXX-XXXX" })}
      {field(`${prefix}Email`, "Email address", { type: "email", placeholder: "name@example.com" })}
      <div className={styles.wide}>{field(`${prefix}Address`, "Full residential address", { multiline: true, placeholder: "Street, Barangay, City, Province" })}</div>
    </div>;
  }

  return <>
    <button className={styles.addButton} type="button" onClick={() => dialogRef.current?.showModal()}><UserPlus size={18} aria-hidden="true" />Add Clients</button>
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="add-client-title" onClose={reset}>
      <div className={styles.dialogHeader}><div className={styles.dialogTitle}><UserPlus size={20} aria-hidden="true" /><h2 id="add-client-title">Add New Client</h2></div><button className={styles.iconButton} type="button" aria-label="Close Add New Client" onClick={close}><X size={20} aria-hidden="true" /></button></div>
      <div className={styles.dialogBody}>
        <section className={styles.formSection} aria-labelledby="petitioner-heading"><h3 id="petitioner-heading">Petitioner / Client Details</h3>{person("petitioner")}</section>
        <section className={styles.formSection} aria-labelledby="respondent-heading"><h3 id="respondent-heading">Respondent Details</h3>{person("respondent")}</section>
        <section className={styles.formSection} aria-labelledby="attorney-heading">
          <h3 id="attorney-heading">Legal Counsel Information</h3>
          <div className={styles.attorneyChoices} role="group" aria-label="Attorney choice">
            <button type="button" className={styles.attorneyChoice} aria-pressed={attorneyMode === "new"} onClick={() => { setAttorneyMode("new"); setFormError(""); }}><UserPlus size={17} aria-hidden="true" />Add Attorney</button>
            <button type="button" className={styles.attorneyChoice} aria-pressed={attorneyMode === "existing"} onClick={() => { setAttorneyMode("existing"); setFormError(""); }}>Existing Attorney</button>
          </div>
          {attorneyMode === "new" ? <div className={styles.formGrid}>{field("attorneyName", "Name of attorney", { placeholder: "Attorney full name" })}{field("attorneyContact", "Attorney contact number", { type: "tel", placeholder: "09XX-XXX-XXXX" })}<div className={styles.wide}>{field("attorneyEmail", "Attorney email address", { type: "email", placeholder: "attorney@example.com" })}</div></div> : <div className={styles.existingAttorney}><label htmlFor="existing-attorney">Select attorney</label><select id="existing-attorney" value={attorneyId} onChange={(event) => { setAttorneyId(event.target.value); setFormError(""); }}><option value="">Select an attorney</option>{attorneys.map((item) => <option key={item.id} value={item.id}>{item.full_name} — {item.email}</option>)}</select>{attorneys.length === 0 && <p>No existing attorneys are available. Choose Add Attorney to enter one.</p>}{selectedAttorney && <dl className={styles.attorneyDetails}><div><dt>Name</dt><dd>{selectedAttorney.full_name}</dd></div><div><dt>Contact number</dt><dd>{selectedAttorney.contact_no}</dd></div><div><dt>Email address</dt><dd>{selectedAttorney.email}</dd></div></dl>}</div>}
        </section>
      </div>
        <div className={styles.dialogFooter}><div className={styles.saveMessage}>{formError && <p className={styles.formError} role="alert">{formError}</p>}</div><div><button className={styles.cancelButton} type="button" onClick={close}>Cancel</button><button className={styles.saveButton} type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Client"}</button></div></div>
    </dialog>
  </>;
}
