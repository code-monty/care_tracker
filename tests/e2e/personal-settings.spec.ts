import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("Admin, Secretary, and Staff can manage their own personal settings", async ({ page }) => {
  test.setTimeout(240_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Personal settings E2E requires local Supabase");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const users: string[] = [];
  try {
    for (const role of ["admin", "secretary", "staff"] as const) {
      const suffix = randomUUID().slice(0, 8);
      const email = `settings-${role}-${suffix}@example.test`;
      const password = `Test-${randomUUID()}-aA1!`;
      const newPassword = `Changed-${randomUUID()}-aA1!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Fake ${role} ${suffix}` } });
      if (created.error || !created.data.user) throw created.error ?? new Error("Fixture failed");
      const id = created.data.user.id; users.push(id);
      const { error: activationError } = await admin.from("profiles").update({ role, status: "active" }).eq("id", id);
      if (activationError) throw activationError;
      await page.goto("/login");
      await page.getByLabel("Email address").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Sign In to Portal" }).click();
      await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
      const payload = Buffer.from(JSON.stringify({ userId: id, verifiedAt: Date.now() })).toString("base64url");
      const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
      await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
      await page.goto("/settings");
      if (role === "admin") {
        await expect(page).toHaveURL(/\/admin\/settings$/);
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
      } else {
        await expect(page).toHaveURL(/\/settings$/);
        await expect(page.getByRole("heading", { name: "Personal settings" })).toBeVisible();
        await page.goto("/admin/settings");
        await expect(page).toHaveURL(/\/dashboard$/);
        await page.goto("/settings");
      }
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Open profile menu" }).click();
      const profileMenu = page.locator("#profile-menu");
      await expect(profileMenu.getByRole("link", { name: "Settings", exact: true })).toHaveCount(1);
      await expect(profileMenu.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("href", role === "admin" ? "/admin/settings" : "/settings");
      await page.getByRole("button", { name: "Open profile menu" }).click();
      await page.getByLabel("Name", { exact: true }).fill(`Updated ${role} ${suffix}`);
      await page.getByRole("button", { name: "Save name" }).click();
      await expect(page.getByText("Name saved.")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("header").getByText(`Updated ${role} ${suffix}`).first()).toBeVisible();

      await page.getByLabel("Current password").fill("wrong-current-password");
      await page.getByLabel("New password", { exact: true }).fill(newPassword);
      await page.getByLabel("Confirm new password").fill(newPassword);
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(page.getByText("Current password is incorrect.")).toBeVisible({ timeout: 30_000 });
      await page.getByLabel("Current password").fill(password);
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(page.getByText("Password changed.")).toBeVisible({ timeout: 30_000 });

      const png = Buffer.from(await page.evaluate(() => {
        const canvas = document.createElement("canvas"); canvas.width = 16; canvas.height = 16;
        const context = canvas.getContext("2d")!; context.fillStyle = "#008766"; context.fillRect(0, 0, 16, 16);
        return canvas.toDataURL("image/png").split(",")[1];
      }), "base64");
      await page.getByLabel("Profile picture").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
      await page.getByRole("button", { name: "Upload picture" }).click();
      await expect(page.getByText("Profile picture saved.")).toBeVisible({ timeout: 30_000 });
      const { data: objects } = await admin.storage.from("profile-pictures").list(id);
      expect(objects?.filter((object) => object.name === "avatar.webp")).toHaveLength(1);
      expect(objects?.[0]?.metadata?.size).toBeLessThan(256 * 1024);
      const pictureResponse = await page.request.get("/api/profile-picture");
      expect(pictureResponse.status()).toBe(200);
      expect(pictureResponse.headers()["content-type"]).toContain("image/webp");
      if (role === "admin") {
        const firstPicture = await pictureResponse.body();
        await page.getByLabel("Profile picture").setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
        await page.getByRole("button", { name: "Upload picture" }).click();
        await expect(page.getByText("Choose a JPEG, PNG, or WebP picture up to 2 MB.")).toBeVisible();
        const replacement = Buffer.from(await page.evaluate(() => {
          const canvas = document.createElement("canvas"); canvas.width = 16; canvas.height = 16;
          const context = canvas.getContext("2d")!; context.fillStyle = "#cc3366"; context.fillRect(0, 0, 16, 16);
          return canvas.toDataURL("image/png").split(",")[1];
        }), "base64");
        await page.getByLabel("Profile picture").setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: replacement });
        await page.getByRole("button", { name: "Upload picture" }).click();
        await expect.poll(async () => {
          const secondPicture = await (await page.request.get("/api/profile-picture")).body();
          return secondPicture.equals(firstPicture);
        }, { timeout: 30_000 }).toBe(false);
        await expect(page.getByText("Profile picture saved.")).toBeVisible({ timeout: 30_000 });
        const { data: replacedObjects } = await admin.storage.from("profile-pictures").list(id);
        expect(replacedObjects?.filter((object) => object.name === "avatar.webp")).toHaveLength(1);
      }
      await page.context().clearCookies();
    }
  } finally {
    await admin.from("profiles").update({ status: "disabled" }).in("id", users);
    for (const id of users) await admin.storage.from("profile-pictures").remove([`${id}/avatar.webp`]);
  }
});
