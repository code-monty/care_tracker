import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("client detail books a fixed-client appointment for Admin and Secretary only", async ({ page }) => {
  test.setTimeout(180_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Client appointment E2E requires local Supabase");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const password = `Test-${randomUUID()}-aA1!`;
  const users: { id: string; email: string; role: "admin" | "secretary" | "staff" }[] = [];
  const attorneyId = randomUUID();
  const clientId = randomUUID();
  const clientName = `Fake Appointment Client ${suffix}`;
  const date = `20${String(50 + parseInt(suffix.slice(0, 2), 16) % 40)}-${String(1 + parseInt(suffix.slice(2, 4), 16) % 12).padStart(2, "0")}-15`;

  try {
    for (const role of ["admin", "secretary", "staff"] as const) {
      const email = `client-appointment-${role}-${suffix}@example.test`;
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error ?? new Error("Unable to create test user");
      users.push({ id: data.user.id, email, role });
      const { error: profileError } = await db.from("profiles").update({ role, status: "active" }).eq("id", data.user.id);
      if (profileError) throw profileError;
    }
    const { error: attorneyError } = await db.from("attorneys").insert({ id: attorneyId, full_name: `Fake Appointment Attorney ${suffix}`, contact_no: "0912-345-6789", email: `client-appointment-lawyer-${suffix}@example.test` });
    if (attorneyError) throw attorneyError;
    const { error: clientError } = await db.from("clients").insert({ id: clientId, full_name: clientName, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `client-appointment-${suffix}@example.test`, address: "Fake address", attorney_id: attorneyId, created_by: users[0].id });
    if (clientError) throw clientError;
    const { error: respondentError } = await db.from("respondents").insert({ client_id: clientId, full_name: `Fake Respondent ${suffix}`, birthdate: "1991-01-01", contact_no: "0912-345-6789", email: `respondent-${suffix}@example.test`, address: "Fake address" });
    if (respondentError) throw respondentError;

    for (const [index, user] of users.entries()) {
      await page.context().clearCookies();
      await page.goto("/login");
      await page.getByLabel("Email address").fill(user.email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Sign In to Portal" }).click();
      await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
      const payload = Buffer.from(JSON.stringify({ userId: user.id, verifiedAt: Date.now() })).toString("base64url");
      const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
      await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
      await page.goto(`/clients/${clientId}`);
      await expect(page.getByRole("heading", { name: "Client Information" })).toBeVisible();
      const open = page.getByRole("button", { name: "Add Appointment" });
      if (user.role === "staff") { await expect(open).toHaveCount(0); continue; }

      await expect(open).toBeVisible();
      await expect(open).toHaveCSS("border-top-style", "none");
      await expect(open).toHaveCSS("text-decoration-line", "underline");
      if (index === 1) await page.setViewportSize({ width: 390, height: 844 });
      await open.click();
      const form = page.getByRole("dialog", { name: "Add appointment" });
      await expect(form.getByText(clientName)).toBeVisible();
      await expect(form.getByRole("combobox", { name: /Client/ })).toHaveCount(0);
      await expect(form.getByRole("button", { name: "Enter name manually" })).toHaveCount(0);
      await form.locator('input[name="date"]').fill(date);
      const time = form.getByRole("combobox", { name: "Appointment time" });
      await expect(time).toBeEnabled({ timeout: 20_000 });
      if (index === 1) await expect(time.locator('option[value="08:00"]')).toHaveAttribute("disabled", "");
      await time.selectOption(index === 0 ? "08:00" : "09:00");
      if (index === 1) {
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
        await expect(form).toBeVisible();
      }
      await form.getByRole("button", { name: "Add appointment" }).click();
      await expect(form).toBeHidden();
      await expect(page.getByRole("status")).toContainText("Appointment saved.");
      await expect(page.getByRole("link", { name: "View Appointments" })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/clients/${clientId}$`));
    }

    const { data: bookings, error: bookingError } = await db.from("appointments").select("client_id,scheduled_at").eq("client_id", clientId);
    if (bookingError) throw bookingError;
    expect(bookings).toHaveLength(2);
    expect(bookings?.map((booking) => new Date(booking.scheduled_at).toISOString()).sort()).toEqual(["08:00", "09:00"].map((time) => new Date(`${date}T${time}:00+08:00`).toISOString()));
  } finally {
    await db.from("clients").update({ is_archived: true }).eq("id", clientId);
    if (users.length) await db.from("profiles").update({ status: "disabled" }).in("id", users.map((user) => user.id));
  }
});
