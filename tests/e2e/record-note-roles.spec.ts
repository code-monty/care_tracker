import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("Admin and Secretary can pin and reply on client and attorney notes", async ({ page }) => {
  test.setTimeout(300_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const split = line.indexOf("="); return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Local Supabase required");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const accounts: { role: "admin" | "secretary"; id: string; email: string; password: string }[] = [];
  for (const role of ["admin", "secretary"] as const) {
    const email = `notes-${role}-${suffix}@example.test`;
    const password = `Test-${randomUUID()}-aA1!`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Unable to create fake account");
    const { error: profileError } = await db.from("profiles").update({ full_name: `Fake Notes ${role} ${suffix}`, role, status: "active" }).eq("id", data.user.id);
    if (profileError) throw profileError;
    accounts.push({ role, id: data.user.id, email, password });
  }
  const { data: attorney, error: attorneyError } = await db.from("attorneys").insert({ full_name: `Fake Role Attorney ${suffix}`, contact_no: "0912-345-6789", email: `role-lawyer-${suffix}@example.test` }).select("id").single();
  if (attorneyError || !attorney) throw attorneyError ?? new Error("Unable to seed attorney");
  const { data: client, error: clientError } = await db.from("clients").insert({ full_name: `Fake Role Client ${suffix}`, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `role-client-${suffix}@example.test`, address: "Fake address", attorney_id: attorney.id, created_by: accounts[0].id }).select("id").single();
  if (clientError || !client) throw clientError ?? new Error("Unable to seed client");
  const { error: respondentError } = await db.from("respondents").insert({ client_id: client.id, full_name: `Fake Role Respondent ${suffix}`, birthdate: "1991-01-01", contact_no: "0912-345-6789", email: `role-respondent-${suffix}@example.test`, address: "Fake address" });
  if (respondentError) throw respondentError;

  async function login(account: typeof accounts[number], browserPage: Page) {
    await browserPage.context().clearCookies();
    await browserPage.goto("/login");
    await browserPage.getByLabel("Email address").fill(account.email);
    await browserPage.locator("#password").fill(account.password);
    await browserPage.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(browserPage).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    const payload = Buffer.from(JSON.stringify({ userId: account.id, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await browserPage.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
  }

  await login(accounts[0], page);
  await page.goto(`/clients/${client.id}`);
  const clientNotes = page.getByRole("region", { name: "Notes" });
  await clientNotes.getByRole("button", { name: "Add Note" }).click();
  await clientNotes.getByRole("textbox", { name: "Note" }).fill(`Fake Admin priority ${suffix}`);
  await clientNotes.getByRole("button", { name: "Save note" }).click();
  await expect(clientNotes.getByRole("textbox", { name: "Note" })).toBeHidden({ timeout: 30_000 });
  const adminCard = clientNotes.locator("article").filter({ hasText: `Fake Admin priority ${suffix}` });
  await adminCard.getByRole("button", { name: "Pin note" }).click();
  await expect(adminCard.getByText("Pinned")).toBeVisible({ timeout: 30_000 });
  await adminCard.getByRole("button", { name: `Reply to note by Fake Notes admin ${suffix}` }).click();
  await adminCard.getByRole("textbox", { name: "Reply" }).fill(`Fake Admin reply ${suffix}`);
  await adminCard.getByRole("button", { name: "Save reply" }).click();
  await expect(adminCard.getByRole("textbox", { name: "Reply" })).toBeHidden({ timeout: 30_000 });
  await expect(adminCard.getByText(`Fake Admin reply ${suffix}`)).toBeVisible({ timeout: 30_000 });

  await login(accounts[1], page);
  await page.goto(`/clients/${client.id}`);
  const secretaryClientNotes = page.getByRole("region", { name: "Notes" });
  const sameCard = secretaryClientNotes.locator("article").filter({ hasText: `Fake Admin priority ${suffix}` });
  await expect(sameCard.getByText(`Fake Admin reply ${suffix}`)).toBeVisible({ timeout: 30_000 });
  await sameCard.getByRole("button", { name: "Unpin note" }).click();
  await expect(sameCard.getByRole("button", { name: "Pin note" })).toBeVisible({ timeout: 30_000 });
  await page.goto(`/attorneys/${attorney.id}`);
  const attorneyNotes = page.getByRole("region", { name: "Notes" });
  await attorneyNotes.getByRole("button", { name: "Add Note" }).click();
  await attorneyNotes.getByRole("textbox", { name: "Note" }).fill(`Fake Secretary note ${suffix}`);
  await attorneyNotes.getByRole("button", { name: "Save note" }).click();
  await expect(attorneyNotes.getByRole("textbox", { name: "Note" })).toBeHidden({ timeout: 30_000 });
  const secretaryCard = attorneyNotes.locator("article").filter({ hasText: `Fake Secretary note ${suffix}` });
  await secretaryCard.getByRole("button", { name: "Pin note" }).click();
  await expect(secretaryCard.getByText("Pinned")).toBeVisible({ timeout: 30_000 });
  await secretaryCard.getByRole("button", { name: `Reply to note by Fake Notes secretary ${suffix}` }).click();
  await secretaryCard.getByRole("textbox", { name: "Reply" }).fill(`Fake Secretary reply ${suffix}`);
  await secretaryCard.getByRole("button", { name: "Save reply" }).click();
  await expect(secretaryCard.getByRole("textbox", { name: "Reply" })).toBeHidden({ timeout: 30_000 });
  await expect(secretaryCard.getByText(`Fake Secretary reply ${suffix}`)).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(attorneyNotes.getByText(`Fake Secretary reply ${suffix}`)).toBeVisible({ timeout: 30_000 });

  await db.from("clients").update({ is_archived: true }).eq("id", client.id);
  for (const account of accounts) await db.from("profiles").update({ status: "disabled" }).eq("id", account.id);
});
