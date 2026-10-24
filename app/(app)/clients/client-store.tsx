"use client";

import { createContext, useContext, useState } from "react";
import type { ClientInput } from "@/lib/validation/client";
import { createClientRecord, setClientStatus } from "@/lib/actions/records";

export type ClientStatus = "Active" | "Inactive";
export type ClientRecord = ClientInput & { id: string; status: ClientStatus };

type ClientStore = {
  clients: ClientRecord[];
  attorneys: { id: string; full_name: string; contact_no: string; email: string }[];
  addClient: (input: ClientInput, attorneyId?: string) => Promise<void>;
  setStatus: (id: string, status: ClientStatus) => Promise<void>;
};

const ClientStoreContext = createContext<ClientStore | null>(null);

export function ClientStoreProvider({ children, initialClients, attorneys }: { children: React.ReactNode; initialClients: ClientRecord[]; attorneys: { id: string; full_name: string; contact_no: string; email: string }[] }) {
  const [clients, setClients] = useState<ClientRecord[]>(initialClients);

  async function addClient(input: ClientInput, attorneyId?: string) {
    const id = await createClientRecord(input, attorneyId);
    const attorney = attorneys.find((item) => item.id === attorneyId);
    setClients((current) => [...current, { ...input, ...(attorney ? { attorneyName: attorney.full_name, attorneyContact: attorney.contact_no, attorneyEmail: attorney.email } : {}), id, status: "Active" }]);
  }

  async function setStatus(id: string, status: ClientStatus) {
    await setClientStatus(id, status.toLowerCase());
    setClients((current) => current.map((client) => client.id === id ? { ...client, status } : client));
  }

  return <ClientStoreContext.Provider value={{ clients, attorneys, addClient, setStatus }}>{children}</ClientStoreContext.Provider>;
}

export function useClientStore() {
  const store = useContext(ClientStoreContext);
  if (!store) throw new Error("ClientStoreProvider is required for client routes");
  return store;
}
