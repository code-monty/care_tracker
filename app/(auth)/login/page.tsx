import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in — proxy.ts will route them to /dashboard or
  // /pending as appropriate on the next request; send them to
  // /dashboard here and let proxy.ts redirect further if needed.
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-semibold">
          Sign in to CareTracker
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
