import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("appointment client browsing and in-place Other reason", async ({ page }) => {
  test.setTimeout(150_000);
  const content = readFileSync(".env.local", "utf8");
  const env = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Appointment picker E2E requires local Supabase");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const email = `picker-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw createError ?? new Error("Unable to create test user");
  const { error: activateError } = await admin.from("profiles").update({ role: "admin", status: "active" }).eq("id", created.user.id);
  if (activateError) throw activateError;
  const { data: attorney, error: attorneyError } = await admin.from("attorneys").insert({ full_name: `Fake Picker Attorney ${suffix}`, contact_no: "0912-345-6789", email: `picker-attorney-${suffix}@example.test` }).select("id").single();
  if (attorneyError || !attorney) throw attorneyError ?? new Error("Unable to create test attorney");
  const { data: clients, error: clientsError } = await admin.from("clients").insert(Array.from({ length: 22 }, (_, index) => ({
    full_name: `Fake Picker ${suffix} ${String(index).padStart(2, "0")}`,
    birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `picker-${suffix}-${index}@example.test`,
    address: "Fake address", attorney_id: attorney.id, created_by: created.user.id,
  }))).select("id,full_name");
  if (clientsError || clients?.length !== 22) throw clientsError ?? new Error("Unable to create test clients");
  const bookingDay = Date.UTC(2050 + parseInt(suffix.slice(0, 2), 16) % 100, parseInt(suffix.slice(2, 4), 16) % 12, 1 + parseInt(suffix.slice(4, 6), 16) % 27);
  const date = new Date(bookingDay).toISOString().slice(0, 10);
  const { error: appointmentError } = await admin.from("appointments").insert({ client_id: clients[0].id, scheduled_at: `${date}T10:00:00+08:00`, reason: "Fake existing appointment", created_by: created.user.id });
  if (appointmentError) throw appointmentError;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
  await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
  const payload = Buffer.from(JSON.stringify({ userId: created.user.id, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
  await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);

  await page.goto("/appointments");
  await page.getByRole("button", { name: "Add Appointment" }).first().click();
  const add = page.getByRole("dialog", { name: "Add appointment" });
  const client = add.getByRole("combobox", { name: "Client *" });
  await client.click();
  const list = add.getByRole("listbox", { name: "Client * matches" });
  await expect(list.getByRole("option")).toHaveCount(20, { timeout: 20_000 });
  const loadMore = add.getByRole("button", { name: "Load more clients" });
  await loadMore.focus();
  await expect(loadMore).toBeFocused();
  await loadMore.press("Enter");
  await expect.poll(async () => list.getByRole("option").count()).toBeGreaterThan(20);
  await client.fill(clients[21].full_name);
  await expect(list.getByRole("option", { name: new RegExp(clients[21].full_name) })).toBeVisible();
  await add.locator('input[name="date"]').fill(date);
  await add.getByRole("combobox", { name: "Appointment time" }).selectOption("11:00");
  await add.getByRole("button", { name: "Add appointment" }).click();
  await expect(add.getByText("Select a client from the search results.")).toBeVisible();
  await client.press("ArrowDown");
  await client.press("Enter");
  await expect(client).toHaveValue(clients[21].full_name);
  await add.getByRole("combobox", { name: "Reason" }).selectOption("Other");
  await expect(add.getByRole("combobox", { name: "Reason" })).toHaveCount(0);
  await expect(add.getByRole("textbox", { name: "Reason" })).toBeVisible();
  await add.getByRole("textbox", { name: "Reason" }).fill("Fake first reason");
  await add.getByRole("button", { name: "Choose a preset reason" }).click();
  await expect(add.getByRole("combobox", { name: "Reason" })).toHaveValue("Follow-up");
  await add.getByRole("combobox", { name: "Reason" }).selectOption("Other");
  await add.getByRole("textbox", { name: "Reason" }).fill("Fake custom reason");
  await add.getByRole("button", { name: "Add appointment" }).click();
  await expect(page.getByText("Appointment saved.")).toBeVisible();
  await page.getByRole("textbox", { name: "Search appointments" }).fill(clients[21].full_name);
  await expect(page.getByRole("row", { name: new RegExp(clients[21].full_name) }).getByText("Fake custom reason")).toBeVisible();

  await page.getByRole("combobox", { name: "Filter by date" }).selectOption("all");
  await page.getByRole("textbox", { name: "Search appointments" }).fill(clients[0].full_name);
  await page.getByLabel(`More actions for ${clients[0].full_name}`).first().click();
  await page.getByRole("button", { name: "Edit appointment" }).click();
  const edit = page.getByRole("dialog", { name: "Edit appointment" });
  const editClient = edit.getByRole("combobox", { name: "Client *" });
  await editClient.fill("");
  await expect(edit.getByRole("listbox", { name: "Client * matches" }).getByRole("option")).toHaveCount(20, { timeout: 20_000 });
  await editClient.fill(clients[1].full_name);
  await edit.getByRole("option", { name: new RegExp(clients[1].full_name) }).click();
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Appointment updated.")).toBeVisible();

  const cleanup = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error: signInError } = await cleanup.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const { data: fixtureClients, error: fixtureClientsError } = await cleanup.from("clients").select("id").ilike("full_name", "Fake Picker %").eq("is_archived", false);
  if (fixtureClientsError) throw fixtureClientsError;
  if (fixtureClients?.length) {
    const { error: archiveError } = await cleanup.from("clients").update({ is_archived: true }).in("id", fixtureClients.map((item) => item.id));
    if (archiveError) throw archiveError;
  }
});
