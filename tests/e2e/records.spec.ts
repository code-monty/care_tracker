import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function localEnvironment() {
  const content = readFileSync(".env.local", "utf8");
  const values = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(values.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Records E2E requires local Supabase");
  return values;
}

test("saved clients and appointments survive reload and appear on dashboard", async ({ page }) => {
  test.setTimeout(120_000);
  const env = localEnvironment();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const email = `records-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw createError ?? new Error("Unable to create test user");
  const { error: activateError } = await admin.from("profiles").update({ status: "active" }).eq("id", created.user.id);
  if (activateError) throw activateError;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
  await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
  const payload = Buffer.from(JSON.stringify({ userId: created.user.id, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
  await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);

  await page.goto("/clients");
  await page.getByRole("button", { name: "Add Clients" }).click();
  const name = `Fake Client ${suffix}`;
  const fields: Record<string, string> = {
    "client-petitionerName": name, "client-petitionerBirthdate": "1990-01-01", "client-petitionerContact": "0912-345-6789", "client-petitionerEmail": `client-${suffix}@example.test`, "client-petitionerAddress": "Fake address",
    "client-respondentName": `Fake Respondent ${suffix}`, "client-respondentBirthdate": "1991-01-01", "client-respondentContact": "0912-345-6789", "client-respondentEmail": `respondent-${suffix}@example.test`, "client-respondentAddress": "Fake address",
  };
  for (const [id, value] of Object.entries(fields)) await page.locator(`#${id}`).fill(value);
  await page.getByRole("button", { name: "Add Attorney" }).click();
  await page.locator("#client-attorneyName").fill(`Fake Attorney ${suffix}`);
  await page.locator("#client-attorneyContact").fill("0912-345-6789");
  await page.locator("#client-attorneyEmail").fill(`attorney-${suffix}@example.test`);
  await page.getByRole("button", { name: "Save Client" }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(name).first()).toBeVisible();

  await page.getByRole("button", { name: "Add Clients" }).click();
  const secondName = `Fake Second Client ${suffix}`;
  for (const [id, value] of Object.entries(fields)) {
    const secondValue = id === "client-petitionerName" ? secondName : id === "client-petitionerEmail" ? `second-${suffix}@example.test` : value;
    await page.locator(`#${id}`).fill(secondValue);
  }
  await page.getByRole("button", { name: "Existing Attorney" }).click();
  await page.locator("#existing-attorney").selectOption({ label: `Fake Attorney ${suffix} — attorney-${suffix}@example.test` });
  await expect(page.getByRole("dialog", { name: "Add New Client" }).locator("dl")).toContainText(`Fake Attorney ${suffix}`);
  await expect(page.getByRole("dialog", { name: "Add New Client" }).locator("dl")).toContainText("0912-345-6789");
  await page.getByRole("button", { name: "Save Client" }).click();
  await page.reload();
  await page.getByRole("searchbox", { name: "Search clients or attorneys" }).fill(secondName);
  await expect(page.getByText(secondName).first()).toBeVisible();

  await page.goto("/attorneys");
  await page.getByRole("searchbox", { name: "Search attorneys" }).fill(`Fake Attorney ${suffix}`);
  await page.getByRole("link", { name: `View Fake Attorney ${suffix} and 2 linked clients` }).click();
  await expect(page).toHaveURL(/\/attorneys\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Linked Clients (2)" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("table").getByRole("cell", { name })).toBeVisible();
  await expect(page.getByRole("table").getByRole("cell", { name: secondName })).toBeVisible();
  await page.getByRole("row", { name: new RegExp(secondName) }).getByRole("link", { name: "View Client" }).click();
  await expect(page.getByRole("heading", { name: "Client Information" })).toBeVisible({ timeout: 20_000 });

  await page.goto("/appointments");
  await page.getByRole("button", { name: "Add Appointment" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add appointment" });
  await dialog.locator('select[name="clientId"]').selectOption({ label: name });
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000));
  await dialog.locator('input[name="date"]').fill(date);
  await dialog.locator('input[name="time"]').fill(`14:${String(parseInt(suffix, 16) % 60).padStart(2, "0")}`);
  page.on("dialog", (prompt) => prompt.accept());
  await dialog.getByRole("button", { name: "Add appointment" }).click();
  await expect(page.getByText("Appointment saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("combobox", { name: "Filter by date" }).selectOption("all");
  await page.getByRole("textbox", { name: "Search appointments" }).fill(name);
  await expect(page.getByText(name).first()).toBeVisible();

  await page.goto("/dashboard");
  await page.getByLabel("Select appointment date").fill(date);
  await expect(page.getByText(name).first()).toBeVisible();
  await expect(page.getByRole("table").getByRole("columnheader")).toHaveText(["Client", "Time", "Reason"]);
  const scheduledBefore = Number((await page.locator('[aria-label$=" appointments scheduled"]').getAttribute("aria-label"))?.split(" ")[0]);
  expect(scheduledBefore).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "View current active clients" })).toContainText("active clients");
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page.getByLabel("0 appointments scheduled")).toBeVisible();
  await expect(page.getByText("No appointments to show")).toBeVisible();
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page.getByLabel(`${scheduledBefore} appointments scheduled`)).toBeVisible();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator('[data-theme="light"]').first()).toBeVisible();
  await expect(page.getByRole("table").getByRole("cell", { name })).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("table").getByRole("cell", { name })).toBeVisible();
  await page.getByRole("button", { name: "Previous day" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Select appointment date")).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/appointments");
  await page.getByRole("combobox", { name: "Filter by date" }).selectOption("all");
  await page.getByRole("textbox", { name: "Search appointments" }).fill(name);
  await page.getByLabel(`More actions for ${name}`).first().click();
  await page.getByRole("button", { name: "Edit appointment" }).first().click();
  const edit = page.getByRole("dialog", { name: "Edit appointment" });
  await edit.locator('select[name="status"]').selectOption("Confirmed");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Appointment updated.")).toBeVisible();
  await page.getByLabel(`More actions for ${name}`).first().click();
  await page.getByRole("button", { name: "Change status" }).first().click();
  await page.getByRole("dialog", { name: "Edit appointment" }).locator('select[name="status"]').selectOption("Cancelled");
  await page.getByRole("dialog", { name: "Edit appointment" }).getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Appointment updated.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Edit appointment" })).toBeHidden();
  await page.goto("/dashboard");
  await page.getByLabel("Select appointment date").fill(date);
  await expect(page.getByLabel(`${scheduledBefore - 1} appointments scheduled`)).toBeVisible();
  const { error: archiveError } = await admin.from("clients").update({ is_archived: true }).in("full_name", [name, secondName]);
  if (archiveError) throw archiveError;
  const { error: disableError } = await admin.from("profiles").update({ status: "disabled" }).eq("id", created.user.id);
  if (disableError) throw disableError;
});
