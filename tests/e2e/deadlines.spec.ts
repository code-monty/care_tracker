import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("staff task flows persist across deadlines, client detail, and dashboard", async ({ page }) => {
  test.setTimeout(180_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Deadlines E2E requires local Supabase");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const email = `deadline-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const clientName = `Fake Deadline Client ${suffix}`;
  const title = `Fake Report ${suffix}`;
  const editedTitle = `Fake Updated Report ${suffix}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw createError ?? new Error("Unable to create test user");
  const userId = created.user.id;
  let clientId: string | undefined;
  try {
    const { error: activateError } = await admin.from("profiles").update({ full_name: `Fake Staff ${suffix}`, role: "staff", status: "active" }).eq("id", userId);
    if (activateError) throw activateError;
    const { data: attorney, error: attorneyError } = await admin.from("attorneys").insert({ full_name: `Fake Lawyer ${suffix}`, contact_no: "0912-345-6789", email: `lawyer-${suffix}@example.test` }).select("id").single();
    if (attorneyError || !attorney) throw attorneyError ?? new Error("Unable to create attorney");
    const { data: client, error: clientError } = await admin.from("clients").insert({ full_name: clientName, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `client-${suffix}@example.test`, address: "Fake address", attorney_id: attorney.id, created_by: userId }).select("id").single();
    if (clientError || !client) throw clientError ?? new Error("Unable to create client");
    clientId = client.id;
    await admin.from("respondents").insert({ client_id: clientId, full_name: `Fake Respondent ${suffix}`, birthdate: "1991-01-01", contact_no: "0912-345-6789", email: `respondent-${suffix}@example.test`, address: "Fake address" });

    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);

    await page.goto(`/deadlines?client=${clientId}`);
    await page.getByRole("button", { name: "Add Task" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('select[name="clientId"]')).toHaveValue(client.id);
    await dialog.locator('input[name="title"]').fill(title);
    await dialog.locator('select[name="assignedTo"]').selectOption(userId);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await dialog.locator('input[name="dueDate"]').fill(today);
    await dialog.getByRole("button", { name: "Save Task" }).click();
    await expect(page.getByRole("table").getByRole("row", { name: new RegExp(title) })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("table").getByRole("row", { name: new RegExp(title) })).toBeVisible();
    await expect(page.getByRole("table").getByRole("columnheader")).toHaveText(["Client Name", "Task Name", "Assign Personnel", "Deadline (Date)", "Status"]);
    await page.getByRole("searchbox", { name: "Search client or task" }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Status")).toBeFocused();

    await page.goto(`/clients/${clientId}`);
    await expect(page.getByRole("heading", { name: "Tasks / Assignments" })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole("link", { name: "Add Task / View Deadlines" }).click();
    await expect(page).toHaveURL(new RegExp(`/deadlines\\?client=${clientId}`));
    await page.getByRole("button", { name: `Edit ${title}` }).click();
    await dialog.locator('input[name="title"]').fill(editedTitle);
    await dialog.getByRole("button", { name: "Save Task" }).click();
    await expect(page.getByRole("button", { name: `Edit ${editedTitle}` })).toBeVisible();

    await page.goto("/dashboard");
    const deadlines = page.getByRole("region", { name: "Deadlines" });
    await expect(deadlines.getByText(editedTitle)).toBeVisible();
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator('[data-theme="light"]').first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(deadlines.getByText(editedTitle)).toBeVisible();
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto("/deadlines");
    await page.getByRole("searchbox", { name: "Search client or task" }).fill(editedTitle);
    page.once("dialog", (confirmation) => confirmation.accept());
    await page.getByRole("button", { name: "Mark Done" }).click();
    await expect(page.getByText("No matching deadlines")).toBeVisible();
    await page.getByLabel("Status").selectOption("Done");
    await expect(page.getByRole("button", { name: `Edit ${editedTitle}` })).toBeVisible();
    await page.goto(`/clients/${clientId}`);
    await expect(page.getByText(editedTitle)).toBeVisible();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Deadlines" }).getByText(editedTitle)).toHaveCount(0);
  } finally {
    if (clientId) await admin.from("clients").update({ is_archived: true }).eq("id", clientId);
    await admin.from("profiles").update({ status: "disabled" }).eq("id", userId);
  }
});
