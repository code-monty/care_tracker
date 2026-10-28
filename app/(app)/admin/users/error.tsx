"use client";

export default function UsersError({ reset }: { reset: () => void }) {
  return <main className="p-6"><h1 className="text-xl font-semibold">Users</h1><p role="alert" className="mt-4">Unable to load accounts right now.</p><button type="button" className="mt-4 underline" onClick={reset}>Try again</button></main>;
}
