import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function recordAuthEvent(actorId: string | null, action: "login" | "logout" | "failed_login") {
  const { error } = await createAdminClient().rpc("log_activity", {
    p_actor_id: actorId,
    p_action: action,
    p_entity_type: null,
    p_entity_id: null,
  });
  if (error) throw new Error("Unable to record authentication activity");
}
