import { expect, test } from "@playwright/test";

test("home redirects to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to CareTracker" })).toBeVisible();
});