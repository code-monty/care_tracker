"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, X, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { createUserAccount, resetUserPassword, setUserStatus, updateUserAccount, type AccountRow } from "@/lib/actions/admin-users";
import styles from "./users.module.css";

const pageSize = 10;

export function UsersWorkspace({ accounts, currentUserId }: { accounts: AccountRow[]; currentUserId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRow["role"]>("staff");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mode && !password) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)") ?? []);
    const focusable = controls();
    (mode ? focusable.find((element) => element.tagName === "INPUT") : focusable.find((element) => element.textContent?.includes("Copy")))?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (dialog?.querySelector<HTMLButtonElement>("header button")?.disabled) return;
        setMode(null); setPassword("");
        requestAnimationFrame(() => returnFocus.current?.focus());
      }
      if (event.key !== "Tab") return;
      const items = controls();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, password]);

  const filtered = accounts.filter((account) => {
    const needle = query.trim().toLowerCase();
    return (!needle || `${account.full_name ?? ""} ${account.email ?? ""}`.toLowerCase().includes(needle))
      && (roleFilter === "all" || account.role === roleFilter)
      && (statusFilter === "all" || account.status === statusFilter);
  });
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const self = (account: AccountRow) => account.id === currentUserId;

  function openCreate() {
    returnFocus.current = document.activeElement as HTMLElement;
    setEditing(null); setFullName(""); setEmail(""); setRole("staff"); setError(""); setMode("create");
  }
  function openEdit(account: AccountRow) {
    returnFocus.current = document.activeElement as HTMLElement;
    setEditing(account); setFullName(account.full_name ?? ""); setEmail(account.email ?? ""); setRole(account.role); setError(""); setMode("edit");
  }
  function closeForm() { setMode(null); requestAnimationFrame(() => returnFocus.current?.focus()); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (mode === "edit" && editing && role !== editing.role && !window.confirm(`Change ${editing.full_name ?? editing.email}'s role to ${role}?`)) return;
    setBusy(true); setError("");
    try {
      const result = mode === "create"
        ? await createUserAccount({ fullName, email, role })
        : await updateUserAccount({ id: editing?.id, fullName, email, role });
      if (result.error) { setError(result.error); return; }
      setMode(null);
      if (result.password) setPassword(result.password);
      else setNotice("Account saved.");
      router.refresh();
    } catch { setError("Unable to save account. Please try again."); }
    finally { setBusy(false); }
  }
  async function changeStatus(account: AccountRow) {
    const next = account.status === "active" ? "disabled" : "active";
    const label = account.status === "pending" ? "approve" : next === "disabled" ? "deactivate" : "reactivate";
    if (!window.confirm(`${label[0].toUpperCase()}${label.slice(1)} ${account.full_name ?? account.email}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await setUserStatus({ id: account.id, status: next });
      if (result.error) setError(result.error);
      else { setNotice(`Account ${label === "approve" ? "approved" : next === "disabled" ? "deactivated" : "reactivated"}.`); router.refresh(); }
    } catch { setError("Unable to change account status."); }
    finally { setBusy(false); }
  }
  async function resetPassword(account: AccountRow) {
    returnFocus.current = document.activeElement as HTMLElement;
    if (!window.confirm(`Reset ${account.full_name ?? account.email}'s password? Their current password will stop working.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await resetUserPassword(account.id);
      if (result.error) setError(result.error);
      else if (result.password) { setPassword(result.password); router.refresh(); }
    } catch { setError("Unable to reset password."); }
    finally { setBusy(false); }
  }
  function closePassword() { setPassword(""); setNotice("Temporary password dialog closed."); requestAnimationFrame(() => returnFocus.current?.focus()); }

  return <main className={styles.page}>
    <header className={styles.heading}><div><h1>Users</h1><p>Manage access to CareTracker.</p></div><button type="button" className={styles.primary} onClick={openCreate}><Plus size={18} aria-hidden="true" /> Add user</button></header>
    {error && !mode && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <section className={styles.panel} aria-label="User accounts">
      <div className={styles.filters}>
        <label className={styles.search}><Search size={18} aria-hidden="true" /><span className={styles.srOnly}>Search users</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name or email" /></label>
        <label><span>Role</span><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}><option value="all">All roles</option><option value="admin">Admin</option><option value="secretary">Secretary</option><option value="staff">Staff</option></select></label>
        <label><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="disabled">Disabled</option></select></label>
      </div>
      <div className={styles.tableScroll}><table><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
        {visible.map((account) => <tr key={account.id}><td><strong>{account.full_name || "Unnamed user"}</strong>{self(account) && <span className={styles.self}>You</span>}</td><td>{account.email || "No email"}</td><td>{account.role === "admin" ? "Admin" : account.role === "secretary" ? "Secretary" : "Staff"}</td><td><span className={`${styles.badge} ${styles[account.status]}`}>{account.status[0].toUpperCase() + account.status.slice(1)}</span>{account.must_change_password && <span className={styles.passwordFlag}>Password change required</span>}</td><td><div className={styles.actions}><button type="button" disabled={busy || self(account)} onClick={() => openEdit(account)}>Edit</button><button type="button" disabled={busy || self(account)} onClick={() => resetPassword(account)}>Reset password</button><button type="button" disabled={busy || self(account)} onClick={() => changeStatus(account)}>{account.status === "pending" ? "Approve" : account.status === "active" ? "Deactivate" : "Reactivate"}</button></div></td></tr>)}
        {visible.length === 0 && <tr><td colSpan={5} className={styles.empty}>{accounts.length === 0 ? "No user accounts yet. Add a user to begin." : "No users match these filters."}</td></tr>}
      </tbody></table></div>
      <footer className={styles.footer}><span>{filtered.length ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} users` : "Showing 0 users"}</span><nav aria-label="User pages"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span aria-current="page">{currentPage}</span><button type="button" aria-label="Next page" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></nav></footer>
    </section>
    {mode && <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) closeForm(); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="user-dialog-title"><header><h2 id="user-dialog-title">{mode === "create" ? "Add user" : "Edit user"}</h2><button type="button" aria-label="Close" disabled={busy} onClick={closeForm}><X size={20} /></button></header><form onSubmit={submit}><div className={styles.fields}><label>Full name<input autoFocus required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value as AccountRow["role"])}><option value="staff">Staff</option><option value="secretary">Secretary</option><option value="admin">Admin</option></select></label>{mode === "create" && <p>New users are active immediately. Their temporary password is 123456 and must be changed after sign-in.</p>}{mode === "edit" && editing?.email !== email.trim().toLowerCase() && <p>Google sign-in with the old email will stop working. The user can sign in with their password and new email.</p>}{error && <p role="alert" className={styles.error}>{error}</p>}</div><footer><button type="button" disabled={busy} onClick={closeForm}>Cancel</button><button className={styles.primary} type="submit" disabled={busy}>{busy ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}</button></footer></form></section></div>}
    {password && <div className={styles.backdrop}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="temporary-password-title"><header><h2 id="temporary-password-title">Temporary password</h2><button type="button" aria-label="Close" onClick={closePassword}><X size={20} /></button></header><div className={styles.fields}><p>Share this temporary password securely. The user must verify their email and change it to a password of at least 10 characters before using CareTracker.</p><output className={styles.secret}>{password}</output><button type="button" className={styles.copy} onClick={() => navigator.clipboard.writeText(password)}><Copy size={17} /> Copy password</button></div><footer><button type="button" className={styles.primary} onClick={closePassword}>Done</button></footer></section></div>}
  </main>;
}
