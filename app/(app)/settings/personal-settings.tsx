"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { updateOwnPicture } from "@/lib/actions/personal-settings";
import styles from "./settings.module.css";

async function compressPicture(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to process this picture");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.65, 0.45, 0.3]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob?.type === "image/webp" && blob.size <= 256 * 1024) return new File([blob], "avatar.webp", { type: "image/webp" });
    }
    throw new Error("This picture could not be compressed enough. Choose another picture.");
  } finally {
    bitmap.close();
  }
}

export function PersonalSettings({ title = "Personal settings", name: initialName, email, hasPicture, pictureVersion }: {
  title?: string; name: string; email: string; hasPicture: boolean; pictureVersion: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [picture, setPicture] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});

  async function saveName(event: FormEvent) {
    event.preventDefault(); setBusy("name"); setMessages((current) => ({ ...current, name: "" }));
    try {
      const response = await fetch("/api/settings/name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result = await response.json() as { error?: string; success?: boolean };
      setMessages((current) => ({ ...current, name: result.error ?? "Name saved." }));
      if (result.success) router.refresh();
    } catch { setMessages((current) => ({ ...current, name: "Unable to save your name." })); }
    finally { setBusy(""); }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault(); setBusy("password"); setMessages((current) => ({ ...current, password: "" }));
    try {
      const response = await fetch("/api/settings/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, password, confirmation }) });
      const result = await response.json() as { error?: string; success?: boolean };
      setMessages((current) => ({ ...current, password: result.error ?? "Password changed." }));
      if (result.success) { setCurrentPassword(""); setPassword(""); setConfirmation(""); }
    } catch { setMessages((current) => ({ ...current, password: "Unable to change your password." })); }
    finally { setBusy(""); }
  }

  async function savePicture(event: FormEvent) {
    event.preventDefault();
    if (!picture) return;
    if (picture.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(picture.type)) {
      setMessages((current) => ({ ...current, picture: "Choose a JPEG, PNG, or WebP picture up to 2 MB." })); return;
    }
    setBusy("picture"); setMessages((current) => ({ ...current, picture: "" }));
    try {
      const compressed = await compressPicture(picture);
      const form = new FormData(); form.set("original", picture); form.set("picture", compressed);
      const result = await updateOwnPicture(form);
      setMessages((current) => ({ ...current, picture: result.error ?? "Profile picture saved." }));
      if (result.success) { setPicture(null); router.refresh(); }
    } catch (error) {
      setMessages((current) => ({ ...current, picture: error instanceof Error ? error.message : "Unable to process the picture." }));
    } finally { setBusy(""); }
  }

  return <main className={styles.page}>
    <header className={styles.heading}><h1>{title}</h1><p>Manage your name, profile picture, and password.</p></header>
    <div className={styles.grid}>
      <section className={styles.panel}><h2>Profile</h2>
        <form onSubmit={savePicture} className={styles.form}>
          <div className={styles.pictureRow}>
            <Image className={styles.avatar} src={hasPicture ? `/api/profile-picture?v=${encodeURIComponent(pictureVersion)}` : "/auth/shell-avatar.svg"} alt="Your profile picture" width={72} height={72} unoptimized={hasPicture} />
            <div><label htmlFor="profile-picture">Profile picture</label><p>JPEG, PNG, or WebP, up to 2 MB. Pictures are resized and compressed before upload.</p></div>
          </div>
          <input id="profile-picture" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPicture(event.target.files?.[0] ?? null)} />
          <button type="submit" disabled={!picture || Boolean(busy)}>{busy === "picture" ? "Uploading…" : "Upload picture"}</button>
          {messages.picture && <p role="status" className={styles.message}>{messages.picture}</p>}
        </form>
        <form onSubmit={saveName} className={styles.form}>
          <label htmlFor="profile-name">Name</label>
          <input id="profile-name" value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} />
          <label htmlFor="profile-email">Email address</label>
          <input id="profile-email" value={email} readOnly aria-describedby="email-help" />
          <p id="email-help">Contact an Admin to change your email address.</p>
          <button type="submit" disabled={Boolean(busy)}>{busy === "name" ? "Saving…" : "Save name"}</button>
          {messages.name && <p role="status" className={styles.message}>{messages.name}</p>}
        </form>
      </section>
      <section className={styles.panel}><h2>Change password</h2>
        <form onSubmit={savePassword} className={styles.form}>
          <label htmlFor="current-password">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <p>Use at least 10 characters.</p>
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          <button type="submit" disabled={Boolean(busy)}>{busy === "password" ? "Saving…" : "Change password"}</button>
          {messages.password && <p role="status" className={styles.message}>{messages.password}</p>}
        </form>
      </section>
    </div>
  </main>;
}
