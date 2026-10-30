"use client";

import { createContext, useContext, useState } from "react";
import type { ClientInput } from "@/lib/validation/client";
import { createClientRecord, setClientStatus, updateClientRecord, archiveClientRecord } from "@/lib/actions/records";

export type ClientStatus = "Active" | "Inactive";
export type ClientRecord = ClientInput & { id: string; attorneyId: string; status: ClientStatus };

type ClientStore = {
  role: string;
  clients: ClientRecord[];
  attorneys: { id: string; full_name: string; contact_no: string; email: string }[];
  addClient: (input: ClientInput, attorneyId?: string) => Promise<void>;
  setStatus: (id: string, status: ClientStatus) => Promise<void>;
  editClient: (id: string, input: ClientInput, attorneyId: string) => Promise<void>;
  archiveClient: (id: string) => Promise<void>;
};

const ClientStoreContext = createContext<ClientStore | null>(null);

export function ClientStoreProvider({ children, initialClients, attorneys, role }: { children: React.ReactNode; initialClients: ClientRecord[]; attorneys: { id: string; full_name: string; contact_no: string; email: string }[]; role: string }) {
  const [clients, setClients] = useState<ClientRecord[]>(initialClients);
  const [availableAttorneys, setAvailableAttorneys] = useState(attorneys);

  async function addClient(input: ClientInput, attorneyId?: string) {
    const created = await createClientRecord(input, attorneyId);
    const attorney = availableAttorneys.find((item) => item.id === created.attorneyId) ?? { id: created.attorneyId, full_name: input.attorneyName, contact_no: input.attorneyContact, email: input.attorneyEmail };
    if (!availableAttorneys.some((item) => item.id === created.attorneyId)) setAvailableAttorneys((current) => [...current, attorney]);
    setClients((current) => [...current, { ...input, attorneyName: attorney.full_name, attorneyContact: attorney.contact_no, attorneyEmail: attorney.email, id: created.id, attorneyId: created.attorneyId, status: "Active" }]);
  }

  async function setStatus(id: string, status: ClientStatus) {
    await setClientStatus(id, status.toLowerCase());
    setClients((current) => current.map((client) => client.id === id ? { ...client, status } : client));
  }

  async function editClient(id: string, input: ClientInput, attorneyId: string) {
    await updateClientRecord(id, input, attorneyId);
    const attorney = availableAttorneys.find((item) => item.id === attorneyId);
    setClients((current) => current.map((client) => client.id === id ? { ...client, ...input, attorneyId, attorneyName: attorney?.full_name ?? "", attorneyContact: attorney?.contact_no ?? "", attorneyEmail: attorney?.email ?? "" } : client));
  }

  async function archiveClient(id: string) {
    await archiveClientRecord(id);
    setClients((current) => current.filter((client) => client.id !== id));
  }

  return <ClientStoreContext.Provider value={{ role, clients, attorneys: availableAttorneys, addClient, setStatus, editClient, archiveClient }}>{children}</ClientStoreContext.Provider>;
}

export function useClientStore() {
  const store = useContext(ClientStoreContext);
  if (!store) throw new Error("ClientStoreProvider is required for client routes");
  return store;
}
