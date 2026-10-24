"use client";

import { createContext, useContext, useState } from "react";
import type { ClientInput } from "@/lib/validation/client";

export type ClientStatus = "Active" | "Inactive";
export type ClientRecord = ClientInput & { id: string; status: ClientStatus };

type ClientStore = {
  clients: ClientRecord[];
  addClient: (input: ClientInput) => void;
  setStatus: (id: string, status: ClientStatus) => void;
};

const ClientStoreContext = createContext<ClientStore | null>(null);

export function ClientStoreProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<ClientRecord[]>([]);

  function addClient(input: ClientInput) {
    setClients((current) => [...current, { ...input, id: crypto.randomUUID(), status: "Active" }]);
  }

  function setStatus(id: string, status: ClientStatus) {
    setClients((current) => current.map((client) => client.id === id ? { ...client, status } : client));
  }

  return <ClientStoreContext.Provider value={{ clients, addClient, setStatus }}>{children}</ClientStoreContext.Provider>;
}

export function useClientStore() {
  const store = useContext(ClientStoreContext);
  if (!store) throw new Error("ClientStoreProvider is required for client routes");
  return store;
}
