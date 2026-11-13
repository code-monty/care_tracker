import DeadlinesWorkspace from "./deadlines-workspace";
import { getActivePersonnel, getClients, getDeadlinesPageRecords } from "@/lib/data/records";
import { requireActiveUser } from "@/lib/auth/session";

export default async function DeadlinesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [tasks, clientRows, staff, params, { user, profile }] = await Promise.all([getDeadlinesPageRecords(), getClients(), getActivePersonnel(), searchParams, requireActiveUser()]);
  const clients = clientRows.map((client) => ({ id: client.id, name: client.full_name }));
  const initialClientId = clients.some((client) => client.id === params.client) ? params.client : undefined;
  return <DeadlinesWorkspace initialTasks={tasks} clients={clients} staff={staff} initialClientId={initialClientId} currentUserId={user.id} role={profile.role} />;
}
