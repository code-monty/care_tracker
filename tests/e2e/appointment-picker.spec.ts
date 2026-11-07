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
  const manilaParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(manilaParts.find((part) => part.type === "year")?.value);
  const month = Number(manilaParts.find((part) => part.type === "month")?.value);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const { data: existingMonthly, error: existingMonthlyError } = await admin.from("appointments").select("scheduled_at,status")
    .gte("scheduled_at", `${monthStart}T00:00:00+08:00`).lt("scheduled_at", `${nextMonth}T00:00:00+08:00`).neq("status", "cancelled");
  if (existingMonthlyError) throw existingMonthlyError;
  const manilaDateTime = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const occupied = (existingMonthly ?? []).map((item) => {
    const parts = manilaDateTime.formatToParts(new Date(item.scheduled_at));
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
    return { date: `${part("year")}-${part("month")}-${part("day")}`, start: Number(part("hour")) * 60 + Number(part("minute")) };
  });
  const monthDate = Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, index) =>
    `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`).reverse().find((day) =>
    [8, 9, 10, 11, 12, 13, 16].every((hour) => occupied.every((item) => item.date !== day || item.start + 60 <= hour * 60 || item.start >= (hour + 1) * 60)));
  if (!monthDate) throw new Error("No date has seven free appointment slots for the browser fixture");
  const { error: monthlyError } = await admin.from("appointments").insert(Array.from({ length: 6 }, (_, index) => ({
    client_id: clients[index].id, scheduled_at: `${monthDate}T${String(index + 8).padStart(2, "0")}:00:00+08:00`, reason: "Fake monthly appointment", created_by: created.user.id,
  })));
  if (monthlyError) throw monthlyError;

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
  await expect(page.getByText("Appointment saved, but it is outside the current filters.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter by date" })).toHaveValue("month");
  await page.getByRole("button", { name: "View appointment" }).click();
  await expect(page.getByRole("combobox", { name: "Filter by date" })).toHaveValue("all");
  await page.getByRole("textbox", { name: "Search appointments" }).fill(clients[21].full_name);
  await expect(page.getByRole("row", { name: new RegExp(clients[21].full_name) }).getByText("Fake custom reason")).toBeVisible();

  await page.getByRole("combobox", { name: "Filter by date" }).selectOption("all");
  await page.getByRole("textbox", { name: "Search appointments" }).fill(clients[0].full_name);
  await page.getByLabel(`More actions for ${clients[0].full_name}`).first().click();
  await page.getByRole("button", { name: "Edit appointment" }).click();
  const edit = page.getByRole("dialog", { name: "Edit appointment" });
  const editClient = edit.getByRole("combobox", { name: "Client *" });
  await editClient.fill("");
  const editOptions = edit.getByRole("listbox", { name: "Client * matches" }).getByRole("option");
  await expect.poll(async () => await editOptions.count() || await edit.getByRole("button", { name: "Retry" }).count(), { timeout: 20_000 }).toBeGreaterThan(0);
  if (await edit.getByRole("button", { name: "Retry" }).isVisible()) await edit.getByRole("button", { name: "Retry" }).click();
  await expect(editOptions).toHaveCount(20, { timeout: 20_000 });
  await editClient.fill(clients[1].full_name);
  await edit.getByRole("option", { name: new RegExp(clients[1].full_name) }).click();
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Appointment updated.")).toBeVisible();

  await page.getByRole("textbox", { name: "Search appointments" }).fill("");
  await page.getByRole("combobox", { name: "Filter by date" }).selectOption("month");
  await page.getByRole("button", { name: "Add Appointment" }).first().click();
  const monthlyClient = add.getByRole("combobox", { name: "Client *" });
  await monthlyClient.fill(clients[21].full_name);
  await add.getByRole("option", { name: new RegExp(clients[21].full_name) }).click();
  await add.locator('input[name="date"]').fill(monthDate);
  await add.getByRole("combobox", { name: "Appointment time" }).selectOption("16:00");
  await expect(add.getByRole("combobox", { name: "Appointment time" })).toHaveValue("16:00");
  await add.getByRole("button", { name: "Add appointment" }).click();
  await expect(page.getByText("Appointment saved.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter by date" })).toHaveValue("month");
  await expect(page.getByRole("row", { name: new RegExp(clients[21].full_name) })).toBeVisible();
  await expect(page.getByText(/Page [2-9] of/)).toBeVisible();

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
