import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function localEnvironment() {
  const content = readFileSync(".env.local", "utf8");
  const values = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(values.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Navigation E2E requires local Supabase");
  return values;
}

async function recordTransitions(page: Page) {
  await page.evaluate(() => {
    document.documentElement.dataset.routeTransitionCount = "0";
    document.addEventListener("animationstart", (event) => {
      if (!(event.target instanceof Element) || !event.target.hasAttribute("data-route-entering")) return;
      const root = document.documentElement;
      root.dataset.routeTransitionCount = String(Number(root.dataset.routeTransitionCount) + 1);
      root.dataset.lastTransitionPath = window.location.pathname;
      root.dataset.transitionHadLoading = String(Boolean(event.target.querySelector("[data-route-loading]")));
    });
  });
}

async function expectTransition(page: Page, path: string, count: number) {
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 30_000 });
  await expect.poll(async () => Number(await page.locator("html").getAttribute("data-route-transition-count"))).toBe(count);
  await expect(page.locator("html")).toHaveAttribute("data-last-transition-path", path);
  await expect(page.locator("html")).toHaveAttribute("data-transition-had-loading", "false");
  await expect(page.locator("[data-route-entering]")).toHaveCount(0);
}

test("signed-in pages animate on navigation while the shell stays still", async ({ page }) => {
  test.setTimeout(240_000);
  const env = localEnvironment();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const email = `navigation-motion-${randomUUID().slice(0, 8)}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) throw error ?? new Error("Unable to create test user");
  try {
    const { error: profileError } = await admin.from("profiles").update({ role: "admin", status: "active" }).eq("id", created.user.id);
    if (profileError) throw profileError;
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    const payload = Buffer.from(JSON.stringify({ userId: created.user.id, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/dashboard");
    await recordTransitions(page);
    await expect(page.locator("html")).toHaveAttribute("data-route-transition-count", "0");
    const header = page.locator("header").first();
    const headerBox = await header.boundingBox();
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    let count = 0;
    for (const [label, path] of [
      ["Clients", "/clients"], ["Attorneys", "/attorneys"], ["Appointments", "/appointments"],
      ["Deadlines", "/deadlines"], ["Users", "/admin/users"], ["Activity Logs", "/admin/logs"],
      ["Settings", "/admin/settings"], ["Backup", "/admin/backup"],
    ] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expectTransition(page, path, ++count);
    }
    expect(await header.boundingBox()).toEqual(headerBox);

    await page.goBack();
    await expectTransition(page, "/admin/settings", ++count);
    await page.goForward();
    await expectTransition(page, "/admin/backup", ++count);
    await nav.getByRole("link", { name: "Backup" }).click();
    await page.waitForTimeout(300);
    await expect(page.locator("html")).toHaveAttribute("data-route-transition-count", String(count));

    await nav.getByRole("link", { name: "Clients" }).click();
    await expectTransition(page, "/clients", ++count);
    await page.getByRole("link", { name: "View archived clients" }).click();
    await expectTransition(page, "/clients/archived", ++count);
    await page.getByRole("link", { name: "Back to Clients" }).click();
    await expectTransition(page, "/clients", ++count);
    const detailLink = page.getByRole("link", { name: "View Details" }).first();
    if (await detailLink.count()) {
      const detailPath = new URL((await detailLink.getAttribute("href"))!, "http://localhost:3000").pathname;
      await detailLink.click();
      count += 1;
      await expectTransition(page, detailPath, count);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Dashboard" }).click();
    await expectTransition(page, "/dashboard", ++count);
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-route-transition-count", String(count));

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Clients" }).click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-route-transition-count", String(count));
    await expect(page.locator("[data-route-entering]")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    const { error: roleError } = await admin.from("profiles").update({ role: "secretary" }).eq("id", created.user.id);
    if (roleError) throw roleError;
    await page.goto("/dashboard");
    await recordTransitions(page);
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expectTransition(page, "/settings", 1);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  } finally {
    await admin.auth.admin.deleteUser(created.user.id);
  }
});
