import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">HLT CareTracker</p>
        <h1 className="mt-4 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-4 text-slate-300">The Privacy Policy is being prepared. This page is a placeholder and does not contain the policy yet.</p>
        <Link href="/login" className="mt-8 inline-block rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">Back to sign in</Link>
      </div>
    </main>
  );
}
