import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("Admin edits records and archives or restores clients and unused attorneys", async ({ page }) => {
  test.setTimeout(180_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const split = line.indexOf("="); return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Local Supabase required");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const email = `archive-admin-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const { data: created, error: createdError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (createdError || !created.user) throw createdError ?? new Error("Unable to create fake account");
  const userId = created.user.id;
  const { error: profileError } = await db.from("profiles").update({ role: "admin", status: "active" }).eq("id", userId);
  if (profileError) throw profileError;
  const firstName = `Fake Attorney ${suffix}`;
  const secondName = `Fake Alternate ${suffix}`;
  const { data: attorneys, error: attorneyError } = await db.from("attorneys").insert([{ full_name: firstName, contact_no: "0912-345-6789", email: `first-${suffix}@example.test` }, { full_name: secondName, contact_no: "0912-345-6789", email: `second-${suffix}@example.test` }]).select("id,full_name");
  if (attorneyError || !attorneys || attorneys.length !== 2) throw attorneyError ?? new Error("Unable to seed fake attorneys");
  const first = attorneys.find((item) => item.full_name === firstName)!;
  const second = attorneys.find((item) => item.full_name === secondName)!;
  const clientName = `Fake Archive Client ${suffix}`;
  const { data: client, error: clientError } = await db.from("clients").insert({ full_name: clientName, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `client-${suffix}@example.test`, address: "Fake address", attorney_id: first.id, created_by: userId }).select("id").single();
  if (clientError || !client) throw clientError ?? new Error("Unable to seed fake client");
  const { error: respondentError } = await db.from("respondents").insert({ client_id: client.id, full_name: `Fake Respondent ${suffix}`, birthdate: "1991-01-01", contact_no: "0912-345-6789", email: `respondent-${suffix}@example.test`, address: "Fake address" });
  if (respondentError) throw respondentError;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
  await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
  const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
  await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(`/attorneys/${first.id}`);
  await expect(page.getByRole("button", { name: "Delete attorney" })).toBeDisabled();
  await page.getByRole("button", { name: "Edit attorney" }).click();
  const attorneyDialog = page.getByRole("dialog", { name: "Edit attorney information" });
  await attorneyDialog.getByLabel("Name").fill(`Fake Edited Attorney ${suffix}`);
  await attorneyDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(attorneyDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: `Fake Edited Attorney ${suffix}` })).toBeVisible();

  await page.goto(`/clients/${client.id}`);
  await expect(page.getByText(`Fake Edited Attorney ${suffix}`)).toBeVisible();
  await page.getByRole("button", { name: "Edit client" }).click();
  const clientDialog = page.getByRole("dialog", { name: "Edit client information" });
  await clientDialog.locator("fieldset").first().getByLabel("Name").fill(`Fake Edited Client ${suffix}`);
  await clientDialog.getByLabel("Attorney").selectOption(second.id);
  await clientDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(clientDialog).toBeHidden();
  await expect(page.getByText(`Fake Edited Client ${suffix}`).first()).toBeVisible();
  await expect(page.getByText(secondName)).toBeVisible();

  await page.goto(`/attorneys/${first.id}`);
  await page.getByRole("button", { name: "Delete attorney" }).click();
  await expect(page).toHaveURL(/\/attorneys$/);
  await page.goto("/attorneys/archived");
  await expect(page.getByText(`Fake Edited Attorney ${suffix}`)).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: `Fake Edited Attorney ${suffix}` }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText(`Fake Edited Attorney ${suffix}`)).toBeHidden();

  await page.goto(`/clients/${client.id}`);
  await page.getByRole("button", { name: "Delete client" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await page.goto("/clients/archived");
  await expect(page.getByText(`Fake Edited Client ${suffix}`)).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: `Fake Edited Client ${suffix}` }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText(`Fake Edited Client ${suffix}`)).toBeHidden();
  await page.goto(`/clients/${client.id}`);
  await expect(page.getByText(`Fake Edited Client ${suffix}`).first()).toBeVisible();

  await db.from("clients").update({ is_archived: true }).eq("id", client.id);
  await db.from("profiles").update({ status: "disabled" }).eq("id", userId);
});

test("Secretary can edit and archive an unused attorney while Staff sees no record controls", async ({ page }) => {
  test.setTimeout(180_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const split = line.indexOf("="); return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Local Supabase required");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const password = `Test-${randomUUID()}-aA1!`;
  async function account(role: "secretary" | "staff") {
    const email = `archive-${role}-${suffix}@example.test`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Unable to create fake account");
    const { error: profileError } = await db.from("profiles").update({ role, status: "active" }).eq("id", data.user.id);
    if (profileError) throw profileError;
    return { id: data.user.id, email };
  }
  const secretary = await account("secretary");
  const staff = await account("staff");
  const { data: attorney, error } = await db.from("attorneys").insert({ full_name: `Fake Secretary Attorney ${suffix}`, contact_no: "0912-345-6789", email: `secretary-${suffix}@example.test` }).select("id").single();
  if (error || !attorney) throw error ?? new Error("Unable to seed fake attorney");

  async function signIn(user: { id: string; email: string }) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    const payload = Buffer.from(JSON.stringify({ userId: user.id, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
  }
  await signIn(secretary);
  await page.goto(`/attorneys/${attorney.id}`);
  await expect(page.getByRole("button", { name: "Edit attorney" })).toBeVisible();
  await page.getByRole("button", { name: "Edit attorney" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit attorney information" });
  await dialog.getByLabel("Name").fill(`Fake Updated Secretary Attorney ${suffix}`);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  page.on("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Delete attorney" }).click();
  await expect(page).toHaveURL(/\/attorneys$/);
  await page.goto("/attorneys/archived");
  await expect(page).toHaveURL(/\/attorneys$/);
  await page.goto("/clients/archived");
  await expect(page).toHaveURL(/\/clients$/);

  await page.context().clearCookies();
  await signIn(staff);
  await page.goto("/attorneys");
  await expect(page.getByRole("link", { name: "View archived attorneys" })).toHaveCount(0);
  await page.goto("/clients");
  await expect(page.getByRole("button", { name: "Edit client" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View archived clients" })).toHaveCount(0);
  await db.from("profiles").update({ status: "disabled" }).in("id", [secretary.id, staff.id]);
});
