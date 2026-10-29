import DeadlinesWorkspace from "./deadlines-workspace";
import { getActivePersonnel, getClients, getDeadlineRecords } from "@/lib/data/records";

export default async function DeadlinesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [tasks, clientRows, staff, params] = await Promise.all([getDeadlineRecords(), getClients(), getActivePersonnel(), searchParams]);
  const clients = clientRows.map((client) => {
    const attorney = Array.isArray(client.attorneys) ? client.attorneys[0] : client.attorneys;
    return { id: client.id, name: client.full_name, attorneyId: client.attorney_id, attorneyName: attorney?.full_name ?? "" };
  });
  const initialClientId = clients.some((client) => client.id === params.client) ? params.client : undefined;
  return <DeadlinesWorkspace initialTasks={tasks} clients={clients} staff={staff} initialClientId={initialClientId} />;
}
