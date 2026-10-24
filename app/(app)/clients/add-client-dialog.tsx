"use client";

import { useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { addClientSchema, ageFromBirthdate, clientFieldSchemas, type ClientField, type ClientInput } from "@/lib/validation/client";
import styles from "./clients.module.css";

type Values = Record<ClientField, string>;
const emptyValues = Object.fromEntries(Object.keys(clientFieldSchemas).map((key) => [key, ""])) as Values;

export default function AddClientDialog({ onSave, existingClients }: { onSave: (client: ClientInput) => void; existingClients: ClientInput[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Values>(emptyValues);
  const [touched, setTouched] = useState<Partial<Record<ClientField, boolean>>>({});
  const [formError, setFormError] = useState("");
  const [showAttorney, setShowAttorney] = useState(false);

  function close() { dialogRef.current?.close(); }
  function reset() { setValues(emptyValues); setTouched({}); setFormError(""); setShowAttorney(false); }

  function save() {
    const result = addClientSchema.safeParse(values);
    if (!result.success) {
      setTouched(Object.fromEntries(Object.keys(clientFieldSchemas).map((key) => [key, true])));
      setFormError("Check the highlighted fields before saving.");
      const invalidFields = new Set(result.error.issues.map((issue) => issue.path[0]));
      if (["attorneyName", "attorneyContact", "attorneyEmail"].some((key) => invalidFields.has(key))) setShowAttorney(true);
      const formOrder: ClientField[] = ["petitionerName", "petitionerBirthdate", "petitionerContact", "petitionerEmail", "petitionerAddress", "respondentName", "respondentBirthdate", "respondentContact", "respondentEmail", "respondentAddress", "attorneyName", "attorneyContact", "attorneyEmail"];
      const firstInvalid = formOrder.find((key) => invalidFields.has(key));
      if (typeof firstInvalid === "string") requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>(`#client-${firstInvalid}`)?.focus());
      return;
    }
    const duplicate = existingClients.some((client) => client.petitionerName.toLocaleLowerCase().trim() === result.data.petitionerName.toLocaleLowerCase().trim() && client.petitionerBirthdate === result.data.petitionerBirthdate);
    if (duplicate) {
      setFormError("A temporary client with this name and birthdate already exists.");
      return;
    }
    onSave(result.data);
    close();
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
        <section className={styles.formSection} aria-labelledby="attorney-heading"><h3 id="attorney-heading">Legal Counsel Information</h3>{showAttorney ? <div className={styles.formGrid}>{field("attorneyName", "Name of attorney", { placeholder: "Attorney full name" })}{field("attorneyContact", "Attorney contact number", { type: "tel", placeholder: "09XX-XXX-XXXX" })}<div className={styles.wide}>{field("attorneyEmail", "Attorney email address", { type: "email", placeholder: "attorney@example.com" })}</div></div> : <button className={styles.attorneyReveal} type="button" onClick={() => { setShowAttorney(true); requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("#client-attorneyName")?.focus()); }}><UserPlus size={17} aria-hidden="true" />Add Attorney</button>}</section>
      </div>
      <div className={styles.dialogFooter}><div className={styles.saveMessage}><p id="temporary-save-note">Temporary only: this client disappears when the page reloads. Do not enter real client data.</p>{formError && <p className={styles.formError} role="alert">{formError}</p>}</div><div><button className={styles.cancelButton} type="button" onClick={close}>Cancel</button><button className={styles.saveButton} type="button" onClick={save} aria-describedby="temporary-save-note">Save Client</button></div></div>
    </dialog>
  </>;
}
