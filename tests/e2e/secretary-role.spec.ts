import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function localEnvironment() {
  const content = readFileSync(".env.local", "utf8");
  const values = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(values.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Secretary E2E requires local Supabase");
  return values;
}

test("Secretary uses daily workflows and cannot reach Admin pages or export logs", async ({ page }) => {
  test.setTimeout(120_000);
  const env = localEnvironment();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const email = `secretary-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Fake Secretary ${suffix}` } });
  if (created.error || !created.data.user) throw created.error ?? new Error("Secretary fixture failed");
  const secretaryId = created.data.user.id;
  const attorneyId = randomUUID();
  const clientId = randomUUID();
  try {
    const { error: activationError } = await admin.from("profiles").update({ role: "secretary", status: "active" }).eq("id", secretaryId);
    if (activationError) throw activationError;
    const { error: attorneyError } = await admin.from("attorneys").insert({ id: attorneyId, full_name: `Fake Secretary Lawyer ${suffix}`, contact_no: "0912-345-6789", email: `secretary-lawyer-${suffix}@example.test` });
    if (attorneyError) throw attorneyError;
    const { error: clientError } = await admin.from("clients").insert({ id: clientId, full_name: `Fake Secretary Client ${suffix}`, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `secretary-client-${suffix}@example.test`, address: "Fake address", attorney_id: attorneyId, created_by: secretaryId });
    if (clientError) throw clientError;

    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    const payload = Buffer.from(JSON.stringify({ userId: secretaryId, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.locator("header").getByText("Secretary", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
    await page.goto("/deadlines?client=" + clientId);
    await expect(page.getByRole("heading", { name: "Deadlines" })).toBeVisible();
    await expect(page.getByLabel("Assigned personnel")).toContainText(`Fake Secretary ${suffix}`);
    await page.getByRole("button", { name: "Add Task" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Client Name").selectOption(clientId);
    await dialog.getByLabel("Task Name").fill(`Fake Secretary task ${suffix}`);
    await dialog.getByLabel("Assign Personnel").selectOption(secretaryId);
    const due = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await dialog.getByLabel("Deadline (Date)").fill(due);
    await dialog.getByRole("button", { name: "Save Task" }).click();
    await expect(page.getByRole("table").getByRole("row", { name: new RegExp(`Fake Secretary task ${suffix}`) })).toBeVisible({ timeout: 30_000 });

    for (const path of ["/admin/users", "/admin/logs", "/admin/settings", "/admin/backup"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
    }
    const exportResponse = await page.request.get("/api/export/logs");
    expect(exportResponse.status()).toBe(403);
  } finally {
    await admin.from("clients").update({ is_archived: true }).eq("id", clientId);
    await admin.from("profiles").update({ status: "disabled" }).eq("id", secretaryId);
  }
});
