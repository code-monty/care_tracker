import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("Staff can add separate client and attorney notes with local date and time", async ({ page }) => {
  test.setTimeout(240_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const split = line.indexOf("="); return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Local Supabase required");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const email = `notes-staff-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const { data: created, error: createdError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (createdError || !created.user) throw createdError ?? new Error("Unable to create fake account");
  const userId = created.user.id;
  const { error: profileError } = await db.from("profiles").update({ full_name: `Fake Notes Staff ${suffix}`, role: "staff", status: "active" }).eq("id", userId);
  if (profileError) throw profileError;
  const { data: attorney, error: attorneyError } = await db.from("attorneys").insert({ full_name: `Fake Notes Attorney ${suffix}`, contact_no: "0912-345-6789", email: `notes-lawyer-${suffix}@example.test` }).select("id").single();
  if (attorneyError || !attorney) throw attorneyError ?? new Error("Unable to seed fake attorney");
  const { data: client, error: clientError } = await db.from("clients").insert({ full_name: `Fake Notes Client ${suffix}`, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `notes-client-${suffix}@example.test`, address: "Fake address", attorney_id: attorney.id, created_by: userId }).select("id").single();
  if (clientError || !client) throw clientError ?? new Error("Unable to seed fake client");
  const { error: respondentError } = await db.from("respondents").insert({ client_id: client.id, full_name: `Fake Respondent ${suffix}`, birthdate: "1991-01-01", contact_no: "0912-345-6789", email: `notes-respondent-${suffix}@example.test`, address: "Fake address" });
  if (respondentError) throw respondentError;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
  await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
  const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
  await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);

  await page.goto(`/clients/${client.id}`);
  const clientNotes = page.getByRole("region", { name: "Notes" });
  await clientNotes.getByRole("button", { name: "Add Note" }).click();
  await expect(clientNotes.getByText(`Fake Notes Staff ${suffix} · Staff`)).toBeVisible();
  await expect(clientNotes.getByText("Do not enter clinical details such as test results or session content.")).toBeVisible();
  await clientNotes.getByRole("textbox", { name: "Note" }).fill(`Fake client note ${suffix}`);
  await clientNotes.getByRole("button", { name: "Save note" }).click();
  await expect(clientNotes.getByRole("button", { name: "Save note" })).toBeHidden({ timeout: 30_000 });
  await expect(clientNotes.getByText(`Fake client note ${suffix}`)).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(clientNotes.getByText(`Fake client note ${suffix}`)).toBeVisible({ timeout: 30_000 });
  const clientTime = await clientNotes.locator("time").first().innerText();
  expect(clientTime.split("\n").filter(Boolean)).toHaveLength(2);
  expect(clientTime).not.toMatch(/\.\d{3}/);

  await page.goto(`/attorneys/${attorney.id}`);
  const attorneyNotes = page.getByRole("region", { name: "Notes" });
  await expect(attorneyNotes.getByText(`Fake client note ${suffix}`)).toHaveCount(0);
  await attorneyNotes.getByRole("button", { name: "Add Note" }).click();
  await attorneyNotes.getByRole("textbox", { name: "Note" }).fill(`Fake attorney note ${suffix}`);
  await attorneyNotes.getByRole("button", { name: "Save note" }).click();
  await expect(attorneyNotes.getByText(`Fake attorney note ${suffix}`)).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(attorneyNotes.getByText(`Fake attorney note ${suffix}`)).toBeVisible({ timeout: 30_000 });
  const attorneyTime = await attorneyNotes.locator("time").first().innerText();
  expect(attorneyTime.split("\n").filter(Boolean)).toHaveLength(2);
  expect(attorneyTime).not.toMatch(/\.\d{3}/);

  await db.from("clients").update({ is_archived: true }).eq("id", client.id);
  await db.from("profiles").update({ status: "disabled" }).eq("id", userId);
});
