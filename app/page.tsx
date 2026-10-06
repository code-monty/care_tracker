import { redirect } from "next/navigation";

// Temporary: send everyone to /login until proxy.ts handles session routing.
export default function Home() {
  redirect("/login");
}
