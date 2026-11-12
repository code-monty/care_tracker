import { redirect } from "next/navigation";
import { Montserrat } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { LoginExperience } from "./login-experience";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-login" });

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
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

  const { error } = await searchParams;
  return <div className={montserrat.variable}><LoginExperience googleError={error === "google"} /></div>;
}
