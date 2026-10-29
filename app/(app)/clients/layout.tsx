import { ClientStoreProvider } from "./client-store";
import { getClients, getAttorneys } from "@/lib/data/records";
import { requireActiveUser } from "@/lib/auth/session";

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  const [rows, attorneys, { profile }] = await Promise.all([getClients(), getAttorneys(), requireActiveUser()]);
  const clients = rows.map((row) => {
    const attorney = Array.isArray(row.attorneys) ? row.attorneys[0] : row.attorneys;
    const respondent = Array.isArray(row.respondents) ? row.respondents[0] : row.respondents;
    return { id: row.id, status: row.status === "active" ? "Active" as const : "Inactive" as const, petitionerName: row.full_name, petitionerBirthdate: row.birthdate, petitionerContact: row.contact_no, petitionerEmail: row.email, petitionerAddress: row.address, attorneyName: attorney?.full_name ?? "", attorneyContact: attorney?.contact_no ?? "", attorneyEmail: attorney?.email ?? "", respondentName: respondent?.full_name ?? "", respondentBirthdate: respondent?.birthdate ?? "", respondentContact: respondent?.contact_no ?? "", respondentEmail: respondent?.email ?? "", respondentAddress: respondent?.address ?? "" };
  });
  return <ClientStoreProvider initialClients={clients} attorneys={attorneys} role={profile.role}>{children}</ClientStoreProvider>;
}
