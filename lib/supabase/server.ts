import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Server Actions and Route
 * Handlers. Reads/writes the session via Next.js cookies.
 *
 * AGENTS.md Section 5 (Architecture rules): this is the ONLY way server
 * code should talk to Supabase for anything tied to the current user's
 * session. It uses the anon key; RLS still applies to every query made
 * with this client. For privileged operations (create user, deactivate,
 * reset password) use lib/supabase/admin.ts instead.
 *
 * Must only be called from server-side code (Server Components, Server
 * Actions, Route Handlers) — next/headers is not available in the browser.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll is called from a Server Component in some code paths
            // (e.g. rendering a page that also happens to refresh the
            // session). Cookie writes there are a no-op; proxy.ts is
            // responsible for refreshing the session on every request,
            // so this can be safely ignored here.
          }
        },
      },
    },
  );
}
