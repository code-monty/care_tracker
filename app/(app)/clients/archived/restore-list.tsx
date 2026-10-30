"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreAttorneyRecord, restoreClientRecord } from "@/lib/actions/records";

export default function RestoreList({ kind, records }: { kind: "client" | "attorney"; records: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  return <><h1>Archived {kind === "client" ? "clients" : "attorneys"}</h1><p>Only Admin can restore archived records.</p>{error && <p role="alert">{error}</p>}{records.length ? <ul>{records.map((record) => <li key={record.id}>{record.full_name} <button type="button" disabled={Boolean(busy)} onClick={async () => { setBusy(record.id); setError(""); try { if (kind === "client") await restoreClientRecord(record.id); else await restoreAttorneyRecord(record.id); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to restore record."); } finally { setBusy(""); } }}>Restore</button></li>)}</ul> : <p>No archived records.</p>}</>;
}
