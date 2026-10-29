import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("Staff can view records and complete only an assigned task", async ({ page }) => {
  test.setTimeout(120_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Staff E2E requires local Supabase");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const password = `Test-${randomUUID()}-aA1!`;
  const email = `staff-access-${suffix}@example.test`;
  const staff = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const other = await admin.auth.admin.createUser({ email: `other-staff-${suffix}@example.test`, password, email_confirm: true });
  if (staff.error || !staff.data.user || other.error || !other.data.user) throw staff.error ?? other.error ?? new Error("Staff fixture failed");
  const staffId = staff.data.user.id;
  const otherId = other.data.user.id;
  const attorneyId = randomUUID();
  const clientId = randomUUID();
  const myTaskId = randomUUID();
  const otherTaskId = randomUUID();
  const clientName = `Fake Staff Client ${suffix}`;
  const myTask = `Fake My Task ${suffix}`;
  const otherTask = `Fake Other Task ${suffix}`;
  try {
    const { error: profilesError } = await admin.from("profiles").update({ role: "staff", status: "active", full_name: `Fake Staff ${suffix}` }).in("id", [staffId, otherId]);
    if (profilesError) throw profilesError;
    const { error: attorneyError } = await admin.from("attorneys").insert({ id: attorneyId, full_name: `Fake Lawyer ${suffix}`, contact_no: "0912-345-6789", email: `lawyer-${suffix}@example.test` });
    if (attorneyError) throw attorneyError;
    const { error: clientError } = await admin.from("clients").insert({ id: clientId, full_name: clientName, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `client-${suffix}@example.test`, address: "Fake address", attorney_id: attorneyId, created_by: staffId });
    if (clientError) throw clientError;
    const { error: respondentError } = await admin.from("respondents").insert({ client_id: clientId, full_name: `Fake Respondent ${suffix}`, birthdate: "1991-01-01", contact_no: "0912-345-6789", email: `respondent-${suffix}@example.test`, address: "Fake address" });
    if (respondentError) throw respondentError;
    const { error: appointmentError } = await admin.from("appointments").insert({ client_id: clientId, scheduled_at: "2026-11-01T10:00:00+08:00", reason: `Fake Assessment ${suffix}`, created_by: staffId });
    if (appointmentError) throw appointmentError;
    const { error: tasksError } = await admin.from("tasks").insert([
      { id: myTaskId, client_id: clientId, title: myTask, assigned_to: staffId, due_date: "2026-11-01", created_by: staffId },
      { id: otherTaskId, client_id: clientId, title: otherTask, assigned_to: otherId, due_date: "2026-11-01", created_by: staffId },
    ]);
    if (tasksError) throw tasksError;

    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    const payload = Buffer.from(JSON.stringify({ userId: staffId, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);

    await page.goto("/clients");
    await expect(page.getByText(clientName)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Clients" })).toHaveCount(0);
    await page.goto(`/clients/${clientId}`);
    await expect(page.getByText(clientName).first()).toBeVisible();
    await expect(page.getByLabel("Client status")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "View Deadlines" })).toBeVisible();
    await page.goto("/attorneys");
    await expect(page.getByText(`Fake Lawyer ${suffix}`)).toBeVisible();
    await page.goto("/appointments");
    await expect(page.getByRole("button", { name: "Add Appointment" })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Filter by date" }).selectOption("all");
    await page.getByRole("textbox", { name: "Search appointments" }).fill(clientName);
    await expect(page.getByLabel(`More actions for ${clientName}`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "View details" }).first()).toBeVisible();

    await page.goto(`/deadlines?client=${clientId}`);
    await expect(page.getByRole("button", { name: "Add Task" })).toHaveCount(0);
    const mine = page.getByRole("row", { name: new RegExp(myTask) });
    const others = page.getByRole("row", { name: new RegExp(otherTask) });
    await expect(mine.getByRole("button", { name: "Mark Done" })).toBeVisible();
    await expect(others.getByRole("button", { name: "Mark Done" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Edit ${myTask}` })).toHaveCount(0);
    page.once("dialog", (confirmation) => confirmation.accept());
    await mine.getByRole("button", { name: "Mark Done" }).click();
    await page.getByLabel("Status").selectOption("Done");
    await expect(page.getByRole("row", { name: new RegExp(myTask) })).toBeVisible();
    const { data: done } = await admin.from("tasks").select("status").eq("id", myTaskId).single();
    expect(done?.status).toBe("done");
    const { data: open } = await admin.from("tasks").select("status").eq("id", otherTaskId).single();
    expect(open?.status).toBe("open");
  } finally {
    await admin.from("clients").update({ is_archived: true }).eq("id", clientId);
    await admin.from("profiles").update({ status: "disabled" }).in("id", [staffId, otherId]);
  }
});
