import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((line) => /^[A-Z_]+=/.test(line))
  .map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")]; }));

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function signIn(page: Page, email: string, password: string, userId: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
  await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
  const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
  await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("Dashboard task cards show clinic totals to Admin and assigned work to Staff and Secretary", async ({ page, browser }) => {
  test.setTimeout(240_000);
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Dashboard E2E requires local Supabase");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const password = `Test-${randomUUID()}-aA1!`;
  const users = await Promise.all((["admin", "secretary", "staff", "staff"] as const).map(async (role, index) => {
    const email = `dashboard-${role}-${index}-${suffix}@example.com`;
    const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Unable to create dashboard test user");
    const id = created.data.user.id;
    const { error } = await db.from("profiles").update({ role, status: "active", full_name: `Fake ${role} ${suffix}` }).eq("id", id);
    if (error) throw error;
    return { role, email, id };
  }));
  const admin = users[0];
  const attorneyId = randomUUID();
  const activeClientId = randomUUID();
  const inactiveClientId = randomUUID();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const stats = page.getByRole("region", { name: "Admin task statistics" });
  const count = async (name: string) => Number(await stats.getByRole("region", { name }).locator("strong").textContent());
  try {
    await signIn(page, admin.email, password, admin.id);
    const baseline = {
      upcoming: await count("Upcoming / Ongoing Tasks"),
      dueSoon: await count("Due Soon Tasks"),
      overdue: await count("Overdue Tasks"),
      approval: await count("Approval Waiting by Staff"),
    };
    const { error: attorneyError } = await db.from("attorneys").insert({ id: attorneyId, full_name: `Fake Dashboard Lawyer ${suffix}`, contact_no: "0912-345-6789", email: `dashboard-lawyer-${suffix}@example.test` });
    if (attorneyError) throw attorneyError;
    const { error: clientError } = await db.from("clients").insert([
      { id: activeClientId, full_name: `Fake Dashboard Active ${suffix}`, birthdate: "1990-01-01", sex: "Female", contact_no: "0912-345-6789", email: `dashboard-active-${suffix}@example.test`, address: "Fake address", attorney_id: attorneyId, created_by: admin.id, status: "active" },
      { id: inactiveClientId, full_name: `Fake Dashboard Inactive ${suffix}`, birthdate: "1990-01-01", sex: "Male", contact_no: "0912-345-6789", email: `dashboard-inactive-${suffix}@example.test`, address: "Fake address", attorney_id: attorneyId, created_by: admin.id, status: "inactive" },
    ]);
    if (clientError) throw clientError;
    const archivedTaskId = randomUUID();
    const approvalTaskId = randomUUID();
    const doneTaskId = randomUUID();
    const tasks = [
      { id: randomUUID(), client_id: activeClientId, title: `Fake Upcoming ${suffix}`, assigned_to: users[2].id, due_date: shiftDate(today, 4), status: "open", created_by: admin.id },
      { id: randomUUID(), client_id: activeClientId, title: `Fake Due Soon ${suffix}`, assigned_to: users[2].id, due_date: today, status: "open", created_by: admin.id },
      { id: approvalTaskId, client_id: activeClientId, title: `Fake Approval ${suffix}`, assigned_to: users[2].id, due_date: shiftDate(today, -1), status: "open", created_by: admin.id },
      { id: doneTaskId, client_id: activeClientId, title: `Fake Done ${suffix}`, assigned_to: users[1].id, due_date: today, status: "open", created_by: admin.id },
      { id: archivedTaskId, client_id: activeClientId, title: `Fake Archived ${suffix}`, assigned_to: users[2].id, due_date: shiftDate(today, 4), status: "open", created_by: admin.id },
      { id: randomUUID(), client_id: inactiveClientId, title: `Fake Inactive ${suffix}`, assigned_to: users[2].id, due_date: shiftDate(today, -1), status: "open", created_by: admin.id },
      { id: randomUUID(), client_id: activeClientId, title: `Fake Other Staff Upcoming ${suffix}`, assigned_to: users[3].id, due_date: shiftDate(today, 5), status: "open", created_by: admin.id },
      { id: randomUUID(), client_id: activeClientId, title: `Fake Other Staff Overdue ${suffix}`, assigned_to: users[3].id, due_date: shiftDate(today, -2), status: "open", created_by: admin.id },
      { id: randomUUID(), client_id: activeClientId, title: `Fake Secretary Due Soon ${suffix}`, assigned_to: users[1].id, due_date: shiftDate(today, 3), status: "open", created_by: admin.id },
    ];
    const { error: taskError } = await db.from("tasks").insert(tasks);
    if (taskError) throw taskError;
    const staffDb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const adminDb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error: staffLoginError } = await staffDb.auth.signInWithPassword({ email: users[2].email, password });
    const { error: adminLoginError } = await adminDb.auth.signInWithPassword({ email: admin.email, password });
    if (staffLoginError || adminLoginError) throw staffLoginError ?? adminLoginError;
    const { error: approvalError } = await staffDb.from("tasks").update({ status: "awaiting_approval" }).eq("id", approvalTaskId);
    const { error: doneError } = await adminDb.from("tasks").update({ status: "done" }).eq("id", doneTaskId);
    if (approvalError || doneError) throw approvalError ?? doneError;
    const { error: archiveError } = await db.from("tasks").update({ is_archived: true }).eq("id", archivedTaskId);
    if (archiveError) throw archiveError;

    await page.reload();
    await expect(stats.getByRole("region")).toHaveCount(4);
    await expect.poll(() => count("Upcoming / Ongoing Tasks")).toBe(baseline.upcoming + 2);
    await expect.poll(() => count("Due Soon Tasks")).toBe(baseline.dueSoon + 2);
    await expect.poll(() => count("Overdue Tasks")).toBe(baseline.overdue + 2);
    await expect.poll(() => count("Approval Waiting by Staff")).toBe(baseline.approval + 1);
    await expect(page.getByRole("link", { name: "View current active clients" }).locator("svg")).toHaveCount(2);
    for (const name of ["Upcoming / Ongoing Tasks", "Due Soon Tasks", "Overdue Tasks", "Approval Waiting by Staff"]) {
      await expect(stats.getByRole("heading", { name }).locator("svg")).toHaveCount(1);
    }
    await page.getByRole("button", { name: "Next day" }).click();
    await expect.poll(() => count("Upcoming / Ongoing Tasks")).toBe(baseline.upcoming + 2);
    await expect.poll(() => count("Approval Waiting by Staff")).toBe(baseline.approval + 1);

    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(stats).toBeVisible();
      expect(await stats.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(stats).toBeVisible();
    for (const [index, person] of users.entries()) {
      if (index === 0) continue;
      const context = await browser.newContext();
      const otherPage = await context.newPage();
      await signIn(otherPage, person.email, password, person.id);
      await expect(otherPage.getByRole("region", { name: "Admin task statistics" })).toHaveCount(0);
      const myStats = otherPage.getByRole("region", { name: "My task statistics" });
      const myCount = async (name: string) => Number(await myStats.getByRole("region", { name }).locator("strong").textContent());
      await expect(myStats.getByRole("region")).toHaveCount(person.role === "secretary" ? 3 : 4);
      await expect.poll(() => myCount("Upcoming / Ongoing Tasks")).toBe(index === 2 || index === 3 ? 1 : 0);
      await expect.poll(() => myCount("Due Soon Tasks")).toBe(index === 1 || index === 2 ? 1 : 0);
      await expect.poll(() => myCount("Overdue Tasks")).toBe(index === 2 || index === 3 ? 1 : 0);
      if (person.role === "staff") await expect.poll(() => myCount("Awaiting Admin Approval")).toBe(index === 2 ? 1 : 0);
      else await expect(myStats.getByRole("heading", { name: "Awaiting Admin Approval" })).toHaveCount(0);
      if (person.role === "secretary") {
        await otherPage.getByRole("button", { name: "Next day" }).click();
        await expect.poll(() => myCount("Due Soon Tasks")).toBe(1);
      }
      for (const width of [1280, 390]) {
        await otherPage.setViewportSize({ width, height: 844 });
        expect(await myStats.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      }
      await otherPage.getByRole("button", { name: "Switch to light theme" }).click();
      await expect(myStats).toBeVisible();
      await expect(otherPage.getByRole("link", { name: "View current active clients" }).locator("svg")).toHaveCount(2);
    }
  } finally {
    await db.from("clients").update({ is_archived: true }).in("id", [activeClientId, inactiveClientId]);
    await db.from("attorneys").update({ is_archived: true }).eq("id", attorneyId);
    await db.from("profiles").update({ status: "disabled" }).in("id", users.map((user) => user.id));
  }
});
