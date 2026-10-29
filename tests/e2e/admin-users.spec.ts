import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function localEnvironment() {
  const content = readFileSync(".env.local", "utf8");
  const values = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(values.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Users E2E requires local Supabase");
  return values;
}

async function setStepUp(page: import("@playwright/test").Page, userId: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
}

test("Admin manages users and temporary passwords require a change", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const env = localEnvironment();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `users-admin-${suffix}@example.test`;
  const adminPassword = `Test-${randomUUID()}-aA1!`;
  const created = await admin.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true, user_metadata: { full_name: "Fake Admin" } });
  if (created.error || !created.data.user) throw created.error ?? new Error("Unable to create Admin fixture");
  const adminId = created.data.user.id;
  const targetEmail = `users-staff-${suffix}@example.test`;
  const revisedEmail = `users-edited-${suffix}@example.test`;
  let targetId: string | undefined;
  let pendingId: string | undefined;
  try {
    const { error: activationError } = await admin.from("profiles").update({ role: "admin", status: "active" }).eq("id", adminId);
    if (activationError) throw activationError;
    await page.goto("/login");
    await page.getByLabel("Email address").fill(adminEmail);
    await page.locator("#password").fill(adminPassword);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    await setStepUp(page, adminId, env.STEP_UP_SECRET);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await page.getByRole("button", { name: "Add user" }).click();
    const form = page.getByRole("dialog", { name: "Add user" });
    await expect(form.getByLabel("Full name")).toBeFocused();
    await form.getByRole("button", { name: "Close" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(form.getByRole("button", { name: "Create user" })).toBeFocused();
    await form.getByLabel("Full name").fill(`Fake Staff ${suffix}`);
    await form.getByLabel("Email address").fill(targetEmail);
    await expect(form.getByLabel("Role").locator("option")).toHaveText(["Staff", "Secretary", "Admin"]);
    await form.getByRole("button", { name: "Create user" }).click();
    const secretDialog = page.getByRole("dialog", { name: "Temporary password" });
    await expect(secretDialog).toBeVisible({ timeout: 30_000 });
    const temporaryPassword = await secretDialog.locator("output").innerText();
    expect(temporaryPassword).toBe("123456");
    await secretDialog.getByRole("button", { name: "Done" }).click();
    await expect(secretDialog).toBeHidden();
    const { data: rows } = await admin.from("profiles").select("id, status, must_change_password").eq("email", targetEmail).single();
    if (!rows) throw new Error("Target account missing");
    targetId = rows.id;
    const staffId = rows.id;
    expect(rows.status).toBe("active");
    expect(rows.must_change_password).toBe(true);

    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    try {
      await staffPage.goto("/login");
      await staffPage.getByLabel("Email address").fill(targetEmail);
      await staffPage.locator("#password").fill(temporaryPassword);
      await staffPage.getByRole("button", { name: "Sign In to Portal" }).click();
      await expect(staffPage).toHaveURL(/\/(mfa|change-password)/, { timeout: 30_000 });
      await setStepUp(staffPage, staffId, env.STEP_UP_SECRET);
      await staffPage.goto("/dashboard");
      await expect(staffPage).toHaveURL(/\/change-password/);
      const newPassword = `Changed-${randomUUID()}-aA1!`;
      await staffPage.getByLabel("New password", { exact: true }).fill(newPassword);
      await staffPage.getByLabel("Confirm new password").fill(newPassword);
      await staffPage.getByRole("button", { name: "Save password" }).click();
      await expect(staffPage).toHaveURL(/\/dashboard/, { timeout: 30_000 });
      await staffPage.goto("/admin/users");
      await expect(staffPage).toHaveURL(/\/dashboard/);
    } finally { await staffContext.close(); }

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("textbox", { name: "Search users" }).fill(targetEmail);
    const row = page.getByRole("row", { name: new RegExp(targetEmail) });
    await row.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Edit user" });
    await edit.getByLabel("Full name").fill(`Fake Edited ${suffix}`);
    await edit.getByLabel("Email address").fill(revisedEmail);
    await edit.getByLabel("Role").selectOption("admin");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(edit).toBeHidden({ timeout: 30_000 });
    await page.getByRole("textbox", { name: "Search users" }).fill(revisedEmail);
    const revisedRow = page.getByRole("row", { name: new RegExp(revisedEmail) });
    await expect(revisedRow.getByText("Admin", { exact: true })).toBeVisible();
    await revisedRow.getByRole("button", { name: "Reset password" }).click();
    const resetDialog = page.getByRole("dialog", { name: "Temporary password" });
    await expect(resetDialog).toBeVisible({ timeout: 30_000 });
    await expect(resetDialog.locator("output")).toHaveText("123456");
    await resetDialog.getByRole("button", { name: "Done" }).click();
    await revisedRow.getByRole("button", { name: "Deactivate" }).click();
    await expect(revisedRow.getByText("Disabled")).toBeVisible({ timeout: 30_000 });
    await revisedRow.getByRole("button", { name: "Reactivate" }).click();
    await expect(revisedRow.getByText("Active")).toBeVisible({ timeout: 30_000 });
    const { data: authUser } = await admin.auth.admin.getUserById(staffId);
    expect(authUser.user?.email).toBe(revisedEmail);

    const pendingEmail = `users-pending-${suffix}@example.test`;
    const pending = await admin.auth.admin.createUser({ email: pendingEmail, password: `Test-${randomUUID()}-aA1!`, email_confirm: true });
    if (pending.error || !pending.data.user) throw pending.error ?? new Error("Unable to create pending fixture");
    pendingId = pending.data.user.id;
    await page.reload();
    await page.getByRole("textbox", { name: "Search users" }).fill(pendingEmail);
    const pendingRow = page.getByRole("row", { name: new RegExp(pendingEmail) });
    await pendingRow.getByRole("button", { name: "Approve" }).click();
    await expect(pendingRow.getByText("Active")).toBeVisible({ timeout: 30_000 });

    await page.setViewportSize({ width: 390, height: 700 });
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  } finally {
    if (!targetId) {
      const { data } = await admin.from("profiles").select("id").eq("email", targetEmail).maybeSingle();
      targetId = data?.id;
    }
    if (targetId) await admin.from("profiles").update({ status: "disabled" }).eq("id", targetId);
    if (pendingId) await admin.from("profiles").update({ status: "disabled" }).eq("id", pendingId);
    await admin.from("profiles").update({ status: "disabled" }).eq("id", adminId);
  }
});
