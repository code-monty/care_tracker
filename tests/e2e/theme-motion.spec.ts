import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("auth theme switch animates only on interaction and respects reduced motion", async ({ page }) => {
  await page.goto("/login");
  const switchButton = page.getByRole("button", { name: "Switch to light theme" });
  await expect(switchButton).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "");

  const motion = await switchButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
    return {
      active: document.documentElement.hasAttribute("data-theme-animating"),
      duration: getComputedStyle(button).transitionDuration,
      iconDuration: getComputedStyle(button.querySelector("span span")!).transitionDuration,
    };
  });
  expect(motion.active).toBe(true);
  expect(motion.duration).toContain("0.25s");
  expect(motion.iconDuration).toContain("0.25s");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("main[data-theme=light]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "", { timeout: 2_000 });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "");
  const darkSwitch = page.getByRole("button", { name: "Switch to dark theme" });
  await darkSwitch.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto("/privacy-policy");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "");
});

test("signed-in desktop and mobile switches animate their icons", async ({ page }) => {
  test.setTimeout(90_000);
  const content = readFileSync(".env.local", "utf8");
  const env = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Theme E2E requires local Supabase");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const email = `theme-motion-${randomUUID().slice(0, 8)}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) throw error ?? new Error("Unable to create test user");
  try {
    const { error: profileError } = await admin.from("profiles").update({ role: "secretary", status: "active" }).eq("id", created.user.id);
    if (profileError) throw profileError;
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    if (new URL(page.url()).pathname === "/mfa") {
      await page.getByRole("button", { name: "Switch to light theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }
    const payload = Buffer.from(JSON.stringify({ userId: created.user.id, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/dashboard");
    const desktopSwitch = page.getByRole("button", { name: "Switch to light theme" });
    await expect(desktopSwitch).toBeVisible();
    await desktopSwitch.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-animating", "");
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toHaveCount(0, { timeout: 2_000 });
  } finally {
    await admin.auth.admin.deleteUser(created.user.id);
  }
});
