import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function localEnvironment() {
  const content = readFileSync(".env.local", "utf8");
  const values = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(values.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Activity Logs E2E requires local Supabase");
  return values;
}

async function setStepUp(page: import("@playwright/test").Page, userId: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
}

test("Admin views, filters, and exports activity while Staff is denied", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const env = localEnvironment();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const password = `Test-${randomUUID()}-aA1!`;
  const adminEmail = `logs-admin-${suffix}@example.test`;
  const staffEmail = `logs-staff-${suffix}@example.test`;
  const createdAdmin = await admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: "Fake Logs Admin" } });
  if (createdAdmin.error || !createdAdmin.data.user) throw createdAdmin.error ?? new Error("Admin fixture failed");
  const adminId = createdAdmin.data.user.id;
  let staffId: string | undefined;
  try {
    const createdStaff = await admin.auth.admin.createUser({ email: staffEmail, password, email_confirm: true, user_metadata: { full_name: "Fake Logs Staff" } });
    if (createdStaff.error || !createdStaff.data.user) throw createdStaff.error ?? new Error("Staff fixture failed");
    staffId = createdStaff.data.user.id;
    const { error: adminError } = await admin.from("profiles").update({ role: "admin", status: "active" }).eq("id", adminId);
    const { error: staffError } = await admin.from("profiles").update({ status: "active" }).eq("id", staffId);
    if (adminError || staffError) throw adminError ?? staffError;

    await page.goto("/login");
    await page.getByLabel("Email address").fill(adminEmail);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    await setStepUp(page, adminId, env.STEP_UP_SECRET);
    await page.goto("/admin/logs", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Activity Logs" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "UpdateID" })).toBeVisible();
    await page.locator('select[name="activity"]').selectOption("login");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/activity=login/);
    await expect(page.getByRole("row", { name: /Fake Logs Admin.*Signed in/ }).first()).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export to CSV" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let csv = "";
    for await (const chunk of stream) csv += chunk.toString();
    expect(csv).toContain("UpdateID");
    expect(csv).toContain("Signed in");
    expect(csv).not.toContain("Failed sign-in attempt");

    for (const theme of ["light", "dark"]) {
      const current = await page.locator("[data-theme]").first().getAttribute("data-theme");
      if (current !== theme) await page.getByRole("button", { name: `Switch to ${theme} theme` }).first().click();
      await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("columnheader", { name: "Activity" })).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 740 });
    await expect(page.getByRole("heading", { name: "Activity Logs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Export to CSV" })).toBeVisible();

    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    try {
      await staffPage.goto("/login");
      await staffPage.getByLabel("Email address").fill(staffEmail);
      await staffPage.locator("#password").fill(password);
      await staffPage.getByRole("button", { name: "Sign In to Portal" }).click();
      await expect(staffPage).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
      await setStepUp(staffPage, staffId, env.STEP_UP_SECRET);
      await staffPage.goto("/admin/logs", { waitUntil: "domcontentloaded" });
      await expect(staffPage).toHaveURL(/\/dashboard/);
      const response = await staffPage.request.get("/api/export/logs");
      expect(response.status()).toBe(403);
    } finally { await staffContext.close(); }
  } finally {
    if (staffId) await admin.from("profiles").update({ status: "disabled" }).eq("id", staffId);
    await admin.from("profiles").update({ status: "disabled" }).eq("id", adminId);
  }
});
