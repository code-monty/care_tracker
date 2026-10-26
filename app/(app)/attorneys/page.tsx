import { getAttorneyClients, getAttorneys } from "@/lib/data/records";
import AttorneyDirectory from "./attorney-directory";

export default async function AttorneysPage() {
  const [attorneys, clients] = await Promise.all([getAttorneys(), getAttorneyClients()]);
  const counts = new Map<string, number>();
  for (const client of clients) counts.set(client.attorney_id, (counts.get(client.attorney_id) ?? 0) + 1);
  return <AttorneyDirectory attorneys={attorneys.map((attorney) => ({ ...attorney, clientCount: counts.get(attorney.id) ?? 0 }))} />;
}
