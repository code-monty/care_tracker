import { getAttorneyClients, getAttorneys } from "@/lib/data/records";
import AttorneyDirectory from "./attorney-directory";
import { requireActiveUser } from "@/lib/auth/session";

export default async function AttorneysPage() {
  const [attorneys, clients, { profile }] = await Promise.all([getAttorneys(), getAttorneyClients(), requireActiveUser()]);
  const counts = new Map<string, number>();
  const activeCounts = new Map<string, number>();
  for (const client of clients) {
    if (!client.attorney_id) continue;
    counts.set(client.attorney_id, (counts.get(client.attorney_id) ?? 0) + 1);
    if (client.status === "active") activeCounts.set(client.attorney_id, (activeCounts.get(client.attorney_id) ?? 0) + 1);
  }
  return <AttorneyDirectory attorneys={attorneys.map((attorney) => ({ ...attorney, clientCount: counts.get(attorney.id) ?? 0, hasActiveClients: (activeCounts.get(attorney.id) ?? 0) > 0 }))} showArchived={profile.role === "admin"} />;
}
