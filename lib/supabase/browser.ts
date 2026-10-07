"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components ("use client").
 *
 * Only used where interactivity requires it on the client — e.g. the
 * login form calling supabase.auth.signInWithPassword, or MFA enrollment
 * widgets that need direct realtime/browser SDK behavior. Everything else
 * (reading/writing client, appointment, deadline, etc. data) should go
 * through Server Actions using lib/supabase/server.ts instead, per
 * AGENTS.md Section 5, Rule 1 (server-side data access only).
 *
 * Uses the anon key only. RLS still applies to every query made with
 * this client — never ship the service-role key to the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
