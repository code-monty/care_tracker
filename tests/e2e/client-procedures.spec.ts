import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function readLocalEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const split = line.indexOf("=");
        return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function stepUpCookie(secret: string, userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return {
    name: "step_up",
    value: `${payload}.${signature}`,
    url: "http://localhost:3000",
    httpOnly: true,
    sameSite: "Lax" as const,
  };
}

test.use({ actionTimeout: 15_000 });

test("Procedures / Requirements tracks manual dates, completion dates, icons, and role-scoped notes", async ({
  page,
}) => {
  test.setTimeout(360_000);
  const env = readLocalEnv();
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
    throw new Error("Local Supabase required");
  }
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `proc-admin-${suffix}@example.test`;
  const staffEmail = `proc-staff-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;

  const [adminUser, staffUser] = await Promise.all([
    db.auth.admin.createUser({ email: adminEmail, password, email_confirm: true }),
    db.auth.admin.createUser({ email: staffEmail, password, email_confirm: true }),
  ]);
  if (adminUser.error || !adminUser.data.user || staffUser.error || !staffUser.data.user) {
    throw new Error("Unable to create fake accounts");
  }
  const adminId = adminUser.data.user.id;
  const staffId = staffUser.data.user.id;

  await Promise.all([
    db.from("profiles").update({ full_name: `Fake Proc Admin ${suffix}`, role: "admin", status: "active" }).eq("id", adminId),
    db.from("profiles").update({ full_name: `Fake Proc Staff ${suffix}`, role: "staff", status: "active" }).eq("id", staffId),
  ]);

  const { data: attorney, error: attorneyError } = await db
    .from("attorneys")
    .insert({ full_name: `Fake Proc Attorney ${suffix}`, contact_no: "0912-345-6789", email: `proc-atty-${suffix}@example.test` })
    .select("id")
    .single();
  if (attorneyError || !attorney) throw attorneyError ?? new Error("Unable to seed fake attorney");

  const { data: client, error: clientError } = await db
    .from("clients")
    .insert({
      full_name: `Fake Proc Client ${suffix}`,
      birthdate: "1990-01-01",
      sex: "Male",
      contact_no: "0912-345-6789",
      email: `proc-client-${suffix}@example.test`,
      address: "Fake address",
      attorney_id: attorney.id,
      created_by: adminId,
    })
    .select("id")
    .single();
  if (clientError || !client) throw clientError ?? new Error("Unable to seed fake client");

  const { error: respondentError } = await db.from("respondents").insert({
    client_id: client.id,
    full_name: `Fake Proc Respondent ${suffix}`,
    birthdate: "1991-01-01",
    sex: "Female",
    contact_no: "0912-345-6789",
    email: `proc-resp-${suffix}@example.test`,
    address: "Fake address",
  });
  if (respondentError) throw respondentError;

  page.on("dialog", (dialog) => dialog.accept());

  // 1. Sign in as Admin
  await page.goto("/login");
  await page.getByLabel("Email address").fill(adminEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
  await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
  await page.context().addCookies([stepUpCookie(env.STEP_UP_SECRET, adminId)]);

  await page.goto(`/clients/${client.id}`);
  const section = page.getByRole("region", { name: "Procedures / Requirements" });
  await expect(section).toBeVisible({ timeout: 30_000 });

  for (const label of [
    "Battery of Exams",
    "Marital History",
    "Witnesses",
    "Home Visit",
    "Letter of Invitation",
    "Judicial Affidavit",
  ]) {
    await expect(section.getByText(label, { exact: true })).toBeVisible();
  }

  // Date Completed is hidden/blank until checked
  const batteryRow = section.locator("tr").filter({ hasText: "Battery of Exams" });
  await expect(batteryRow.getByLabel("Date completed for Battery of Exams")).toHaveCount(0);

  // Set manual Date Created and check Status
  await batteryRow.getByLabel("Date created for Battery of Exams").fill("2026-11-18");
  await batteryRow.getByRole("checkbox", { name: "Mark Battery of Exams completed" }).click();
  await expect(batteryRow.getByLabel("Date completed for Battery of Exams")).toBeVisible({ timeout: 30_000 });

  await page.reload();
  const batteryRowAfterReload = section.locator("tr").filter({ hasText: "Battery of Exams" });
  await expect(batteryRowAfterReload.getByLabel("Date created for Battery of Exams")).toHaveValue("2026-11-18");
  await expect(batteryRowAfterReload.getByLabel("Date completed for Battery of Exams")).toBeVisible();

  // Unchecking clears and hides Date Completed; re-check afterwards
  await batteryRowAfterReload.getByRole("checkbox", { name: "Mark Battery of Exams completed" }).click();
  await expect(batteryRowAfterReload.getByLabel("Date completed for Battery of Exams")).toHaveCount(0, { timeout: 30_000 });
  await batteryRowAfterReload.getByRole("checkbox", { name: "Mark Battery of Exams completed" }).click();
  await expect(batteryRowAfterReload.getByLabel("Date completed for Battery of Exams")).toBeVisible({ timeout: 30_000 });

  // Add, pin, edit, and delete notes with visible icons
  await batteryRowAfterReload.getByRole("button", { name: "Add note" }).click();
  await expect(batteryRowAfterReload.getByText("Do not enter clinical details such as test results or session content.")).toBeVisible();
  await batteryRowAfterReload.getByRole("textbox", { name: "Note for Battery of Exams" }).fill(`Fake admin proc note ${suffix}`);
  await batteryRowAfterReload.getByRole("button", { name: "Save note" }).click();
  await expect(batteryRowAfterReload.getByText(`Fake admin proc note ${suffix}`)).toBeVisible({ timeout: 30_000 });

  const adminNoteCard = batteryRowAfterReload.locator("article").filter({ hasText: `Fake admin proc note ${suffix}` });
  await expect(adminNoteCard.getByRole("button", { name: "Pin note" }).locator("svg")).toHaveCount(1);
  await expect(adminNoteCard.getByRole("button", { name: "Edit note" }).locator("svg")).toHaveCount(1);
  await adminNoteCard.getByRole("button", { name: "Pin note" }).click();
  await expect(adminNoteCard.getByText("Pinned")).toBeVisible({ timeout: 30_000 });
  await adminNoteCard.getByRole("button", { name: "Edit note" }).click();
  await batteryRowAfterReload.getByRole("textbox", { name: "Edit note" }).fill(`Fake admin proc note edited ${suffix}`);
  await batteryRowAfterReload.getByRole("button", { name: "Save changes" }).click();
  await expect(batteryRowAfterReload.getByRole("button", { name: "Save changes" })).toBeHidden({ timeout: 30_000 });
  await expect(batteryRowAfterReload.getByText(`Fake admin proc note edited ${suffix}`)).toBeVisible({ timeout: 30_000 });

  // Responsive checks (desktop, tablet, mobile dark & light)
  await page.setViewportSize({ width: 1366, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/procedures-desktop-dark.png", fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/procedures-mobile-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator('html[data-theme="light"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: "test-results/procedures-desktop-light.png", fullPage: true });

  // 2. Sign in as Staff to verify read-only tracking + own note permissions
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

  await page.getByLabel("Email address").fill(staffEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
  await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
  await page.context().addCookies([stepUpCookie(env.STEP_UP_SECRET, staffId)]);

  await page.goto(`/clients/${client.id}`);
  const staffSection = page.getByRole("region", { name: "Procedures / Requirements" });
  const staffBatteryRow = staffSection.locator("tr").filter({ hasText: "Battery of Exams" });
  await expect(staffBatteryRow.getByLabel("Date created for Battery of Exams")).toHaveCount(0);
  await expect(staffBatteryRow.getByRole("checkbox", { name: "Mark Battery of Exams completed" })).toBeDisabled();

  const staffViewAdminNote = staffBatteryRow.locator("article").filter({ hasText: `Fake admin proc note edited ${suffix}` });
  await expect(staffViewAdminNote.getByRole("button", { name: "Edit note" })).toHaveCount(0);
  await expect(staffViewAdminNote.getByRole("button", { name: "Delete note" })).toHaveCount(0);

  await staffBatteryRow.getByRole("button", { name: "Add note" }).click();
  await staffBatteryRow.getByRole("textbox", { name: "Note for Battery of Exams" }).fill(`Fake staff proc note ${suffix}`);
  await staffBatteryRow.getByRole("button", { name: "Save note" }).click();
  const staffOwnNote = staffBatteryRow.locator("article").filter({ hasText: `Fake staff proc note ${suffix}` });
  await expect(staffOwnNote).toBeVisible({ timeout: 30_000 });
  await staffOwnNote.getByRole("button", { name: "Delete note" }).click();
  await expect(staffBatteryRow.getByText(`Fake staff proc note ${suffix}`)).toHaveCount(0, { timeout: 30_000 });

  await db.from("clients").update({ is_archived: true }).eq("id", client.id);
  await Promise.all([
    db.from("profiles").update({ status: "disabled" }).eq("id", adminId),
    db.from("profiles").update({ status: "disabled" }).eq("id", staffId),
  ]);
});
