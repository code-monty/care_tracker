import { ClientStoreProvider } from "./client-store";

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return <ClientStoreProvider>{children}</ClientStoreProvider>;
}
