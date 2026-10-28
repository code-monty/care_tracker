"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changeTemporaryPassword } from "@/lib/auth/change-temporary-password";
import styles from "./password.module.css";

export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    let succeeded = false;
    try {
      const result = await changeTemporaryPassword({ password, confirmation });
      succeeded = result.success === true;
      if (result.error) setError(result.error);
    } catch {
      setError("Unable to finish account setup. Please try again.");
    } finally {
      if (!succeeded) setBusy(false);
    }
    if (succeeded) router.replace("/dashboard");
  }
  return <form onSubmit={submit} className={styles.form}>
    <label htmlFor="new-password">New password</label>
    <div className={styles.passwordRow}>
      <input id="new-password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
      <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? "Hide" : "Show"}</button>
    </div>
    <p>Use at least 10 characters.</p>
    <label htmlFor="confirm-password">Confirm new password</label>
    <input id="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
  </form>;
}
