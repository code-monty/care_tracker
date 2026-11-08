import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((line) => /^[A-Z_]+=/.test(line))
  .map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")]; }));

async function signIn(page: Page, email: string, password: string, userId: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
  await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
  const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
  await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
}

test("Admin returns Staff work with feedback and approves its resubmission", async ({ page, browser }) => {
  test.setTimeout(180_000);
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Task approval E2E requires local Supabase");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const password = `Test-${randomUUID()}-aA1!`;
  const staffEmail = `approval-staff-${suffix}@example.test`;
  const adminEmail = `approval-admin-${suffix}@example.test`;
  const createdStaff = await db.auth.admin.createUser({ email: staffEmail, password, email_confirm: true });
  const createdAdmin = await db.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
  if (createdStaff.error || createdAdmin.error || !createdStaff.data.user || !createdAdmin.data.user) throw createdStaff.error ?? createdAdmin.error ?? new Error("Unable to create users");
  const staffId = createdStaff.data.user.id;
  const adminId = createdAdmin.data.user.id;
  const attorneyId = randomUUID();
  const clientId = randomUUID();
  const taskId = randomUUID();
  const title = `Fake Approval Task ${suffix}`;
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    const { error: staffError } = await db.from("profiles").update({ status: "active", role: "staff", full_name: `Fake Staff ${suffix}` }).eq("id", staffId);
    const { error: adminError } = await db.from("profiles").update({ status: "active", role: "admin", full_name: `Fake Admin ${suffix}` }).eq("id", adminId);
    if (staffError || adminError) throw staffError ?? adminError;
    const { error: attorneyError } = await db.from("attorneys").insert({ id: attorneyId, full_name: `Fake Lawyer ${suffix}`, contact_no: "0912-345-6789", email: `approval-lawyer-${suffix}@example.test` });
    if (attorneyError) throw attorneyError;
    const { error: clientError } = await db.from("clients").insert({ id: clientId, full_name: `Fake Approval Client ${suffix}`, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `approval-client-${suffix}@example.test`, address: "Fake address", attorney_id: attorneyId, created_by: adminId });
    if (clientError) throw clientError;
    const { error: respondentError } = await db.from("respondents").insert({ client_id: clientId, full_name: `Fake Respondent ${suffix}`, birthdate: "1991-01-01", contact_no: "0912-345-6789", email: `approval-respondent-${suffix}@example.test`, address: "Fake address" });
    if (respondentError) throw respondentError;
    const { error: taskError } = await db.from("tasks").insert({ id: taskId, client_id: clientId, title, assigned_to: staffId, due_date: "2026-11-01", created_by: adminId });
    if (taskError) throw taskError;

    await signIn(page, staffEmail, password, staffId);
    await signIn(adminPage, adminEmail, password, adminId);
    await adminPage.goto(`/deadlines?client=${clientId}`);
    await expect(adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Mark Done" })).toHaveCount(0);
    await page.goto(`/deadlines?client=${clientId}`);
    const staffRow = page.getByRole("row", { name: new RegExp(title) });
    page.once("dialog", (dialog) => dialog.accept());
    await staffRow.getByRole("button", { name: "Submit for approval" }).click();
    await expect(staffRow.getByText("Awaiting approval")).toBeVisible();
    await page.goto(`/clients/${clientId}`);
    const clientTasks = page.getByRole("region", { name: "Tasks table" });
    await expect(clientTasks).toBeVisible({ timeout: 30_000 });
    await expect(clientTasks.getByRole("columnheader")).toHaveText(["Task name", "Assigned personnel", "Deadline", "Status"]);
    const clientTaskRow = clientTasks.getByRole("row", { name: new RegExp(title) });
    await expect(clientTaskRow.getByRole("cell")).toHaveCount(4);
    await expect(clientTaskRow.getByText("Awaiting approval")).toBeVisible();
    await expect(clientTaskRow.getByText("Overdue")).toBeVisible();
    await expect(clientTaskRow.getByText("November 1, 2026")).toBeVisible();
    await expect(page.getByRole("link", { name: "View Deadlines" })).toHaveAttribute("href", `/deadlines?client=${clientId}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(clientTasks).toBeVisible();
    expect(await clientTasks.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await expect(clientTaskRow).toBeVisible();
    await page.goto(`/deadlines?client=${clientId}`);

    await adminPage.goto(`/deadlines?client=${clientId}`);
    await adminPage.getByLabel("Status").selectOption("Awaiting approval");
    const adminRow = adminPage.getByRole("row", { name: new RegExp(title) });
    await expect(adminRow.getByRole("button", { name: `Edit ${title}` })).toHaveCount(0);
    await adminRow.getByRole("button", { name: "Awaiting Approval" }).click();
    await expect(adminPage.getByText(/Has the document.*checked and verified/)).toBeVisible();
    const reviewDialog = adminPage.getByRole("dialog", { name: "Review task" });
    const reviewComment = reviewDialog.getByRole("textbox", { name: "Comment if returning to Staff" });
    await reviewDialog.getByRole("button", { name: "No, return with comment" }).click();
    await expect(reviewComment).toBeFocused();
    await expect(reviewComment).toHaveAttribute("aria-invalid", "true");
    await expect(reviewDialog.getByRole("alert")).toHaveText("Enter a comment before returning the task.");
    await reviewComment.fill("Please correct the fake report.");
    await expect(reviewComment).toHaveAttribute("aria-invalid", "false");
    await reviewDialog.getByRole("button", { name: "No, return with comment" }).click();
    await expect(adminPage.getByRole("status").getByText("Task returned to Staff with feedback.")).toBeVisible({ timeout: 20_000 });
    await adminPage.goto(`/clients/${clientId}`);
    const returnedRow = adminPage.getByRole("region", { name: "Tasks table" }).getByRole("row", { name: new RegExp(title) });
    await expect(returnedRow.getByText("Needs changes")).toBeVisible({ timeout: 30_000 });
    await expect(returnedRow.getByText("Overdue")).toBeVisible();
    await expect(adminPage.getByRole("link", { name: "Add Task / View Deadlines" })).toHaveAttribute("href", `/deadlines?client=${clientId}`);
    await adminPage.goto(`/deadlines?client=${clientId}`);
    await adminPage.getByLabel("Status").selectOption("Open");
    await expect(adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Mark Done" })).toBeVisible();
    await adminPage.getByLabel("Status").selectOption("Awaiting approval");

    await page.reload();
    await expect(staffRow.getByText("Needs changes")).toBeVisible();
    await expect(staffRow.getByText("Admin feedback: Please correct the fake report.")).toBeVisible();
    await staffRow.getByRole("button", { name: "Submit for approval" }).click();
    const resubmitDialog = page.getByRole("dialog", { name: "Resubmit task" });
    await expect(resubmitDialog.getByRole("button", { name: "Submit for approval" })).toBeDisabled();
    await resubmitDialog.getByRole("textbox", { name: "Changes made" }).fill("Corrected the fake report.");
    await resubmitDialog.getByRole("button", { name: "Submit for approval" }).click();
    await expect(staffRow.getByText("Awaiting approval")).toBeVisible();

    await adminPage.reload();
    await adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Awaiting Approval" }).click();
    await expect(adminPage.getByRole("dialog", { name: "Review task" }).getByText("Staff changes: Corrected the fake report.")).toBeVisible();
    await adminPage.getByRole("dialog", { name: "Review task" }).getByRole("textbox", { name: "Comment if returning to Staff" }).fill("Please fix the missing section too.");
    await adminPage.getByRole("dialog", { name: "Review task" }).getByRole("button", { name: "No, return with comment" }).click();
    await expect(adminPage.getByRole("status").getByText("Task returned to Staff with feedback.")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await staffRow.getByRole("button", { name: "Submit for approval" }).click();
    await resubmitDialog.getByRole("textbox", { name: "Changes made" }).fill("Added the missing section.");
    await resubmitDialog.getByRole("button", { name: "Submit for approval" }).click();
    await expect(staffRow.getByText("Awaiting approval")).toBeVisible();

    await adminPage.reload();
    await adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Awaiting Approval" }).click();
    await expect(adminPage.getByRole("dialog", { name: "Review task" }).getByText("Staff changes: Added the missing section.")).toBeVisible();
    await adminPage.getByRole("dialog", { name: "Review task" }).getByRole("button", { name: "Yes, approve" }).click();
    await expect(adminPage.getByRole("status").getByText("Task approved and marked done.")).toBeVisible({ timeout: 20_000 });
    await adminPage.goto(`/clients/${clientId}`);
    await expect(adminPage.getByRole("region", { name: "Tasks table" }).getByRole("row", { name: new RegExp(title) }).getByText("Done")).toBeVisible({ timeout: 30_000 });
    await adminPage.goto(`/deadlines?client=${clientId}`);
    const { data: task } = await db.from("tasks").select("status").eq("id", taskId).single();
    expect(task?.status).toBe("done");
    const { data: history } = await db.from("task_review_events").select("event,comment").eq("task_id", taskId).order("created_at");
    expect(history?.map((entry) => entry.event)).toEqual(["submitted", "returned", "submitted", "returned", "submitted", "approved"]);
    expect(history?.filter((entry) => entry.event === "submitted").map((entry) => entry.comment)).toEqual([null, "Corrected the fake report.", "Added the missing section."]);
    await adminPage.getByLabel("Status").selectOption("All");
    await adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Review history" }).click();
    const historyDialog = adminPage.getByRole("dialog", { name: "Task review history" });
    await expect(historyDialog.getByRole("listitem").filter({ hasText: "Please correct the fake report." })).toContainText("Admin feedback:");
    await expect(historyDialog.getByRole("listitem").filter({ hasText: "Corrected the fake report." })).toContainText("Staff changes:");
    await expect(historyDialog.getByRole("listitem").filter({ hasText: "Added the missing section." })).toContainText("Staff changes:");
    await historyDialog.getByRole("button", { name: "Close history" }).click();
    await adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: `Edit ${title}` }).click();
    const editDialog = adminPage.getByRole("dialog").filter({ has: adminPage.getByRole("heading", { name: "Edit Task" }) });
    adminPage.once("dialog", (dialog) => dialog.accept());
    await editDialog.getByRole("button", { name: "Delete task" }).click();
    await expect(adminPage.getByRole("status").getByText("Task archived.")).toBeVisible();
    await expect(adminPage.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);
    await page.reload();
    await page.getByLabel("Status").selectOption("All");
    await expect(page.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);
    await page.goto(`/clients/${clientId}`);
    await expect(page.getByText("No tasks are tracked for this client yet.")).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByRole("link", { name: "View archived tasks" })).toHaveAttribute("href", "/deadlines/archived");
    await adminPage.goto("/deadlines/archived");
    await expect(adminPage).toHaveURL(/\/deadlines\/archived/);
    await expect(adminPage.getByRole("row", { name: new RegExp(title) })).toBeVisible();
    await adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Restore" }).click();
    await expect(adminPage.getByRole("row", { name: new RegExp(title) })).toHaveCount(0, { timeout: 20_000 });
    await adminPage.getByRole("link", { name: "Back to Deadlines" }).click();
    await adminPage.getByLabel("Status").selectOption("All");
    await expect(adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Review history" })).toBeVisible();
    await page.goto(`/deadlines?client=${clientId}`);
    await page.getByLabel("Status").selectOption("All");
    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  } finally {
    await adminContext.close();
    await db.from("clients").update({ is_archived: true }).eq("id", clientId);
    await db.from("profiles").update({ status: "disabled" }).in("id", [staffId, adminId]);
  }
});
