import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * AGENTS.md Section 5, Rule 4: the service-role key exists only in server
 * environment variables and is used ONLY for admin operations — create
 * user, approve, reset password, deactivate. It must never appear in
 * client bundles, logs, the repo or screenshots.
 *
 * Do NOT use this for normal reads/writes (clients, appointments, notes,
 * etc.) — use lib/supabase/server.ts for those, so RLS stays the
 * enforced boundary. This client is for the small set of Admin-only
 * user-management actions where RLS cannot apply (e.g. creating a new
 * Auth user before a matching profiles row can exist).
 *
 * Every call site using this client must independently re-check that the
 * calling user is an authenticated Admin before calling any of its
 * methods — this client trusts nothing on its own.
 *
 * The "server-only" import above makes it a BUILD-TIME error for this
 * file to end up in a client bundle, rather than only failing at
 * runtime if a browser ever executed it.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "This client must only be constructed on the server, where both are set.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
