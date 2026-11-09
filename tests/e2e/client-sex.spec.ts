import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function localEnvironment() {
  const content = readFileSync(".env.local", "utf8");
  const values = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(values.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Client sex E2E requires local Supabase");
  return values;
}

test("client and respondent sex is required, saved, editable, and survives reload", async ({ page }) => {
  test.setTimeout(180_000);
  const env = localEnvironment();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const email = `sex-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const names = [`Fake Sex Client A ${suffix}`, `Fake Sex Client B ${suffix}`];
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw createError ?? new Error("Unable to create test user");

  try {
    const { error: activateError } = await admin.from("profiles").update({ role: "secretary", status: "active" }).eq("id", created.user.id);
    if (activateError) throw activateError;
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    const payload = Buffer.from(JSON.stringify({ userId: created.user.id, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);

    for (const [index, name] of names.entries()) {
      await page.goto("/clients");
      await page.getByRole("button", { name: "Add Clients" }).click();
      await page.locator("#client-petitionerName").fill(name);
      await page.locator("#client-petitionerBirthdate").fill("1990-01-01");
      await page.locator("#client-petitionerContact").fill("0912-345-6789");
      await page.locator("#client-petitionerEmail").fill(`petitioner-${index}-${suffix}@example.test`);
      await page.locator("#client-petitionerAddress").fill("Fake address");
      await page.locator("#client-respondentName").fill(`Fake Respondent ${index} ${suffix}`);
      await page.locator("#client-respondentBirthdate").fill("1991-01-01");
      await page.locator("#client-respondentContact").fill("0912-345-6789");
      await page.locator("#client-respondentEmail").fill(`respondent-${index}-${suffix}@example.test`);
      await page.locator("#client-respondentAddress").fill("Fake address");
      await page.locator("#client-attorneyName").fill(`Fake Attorney ${index} ${suffix}`);
      await page.locator("#client-attorneyContact").fill("0912-345-6789");
      await page.locator("#client-attorneyEmail").fill(`attorney-${index}-${suffix}@example.test`);
      if (index === 0) {
        await page.getByRole("button", { name: "Save Client" }).click();
        await expect(page.getByRole("dialog", { name: "Add New Client" }).getByRole("alert")).toContainText("Check the highlighted fields");
        await expect(page.locator("#client-petitionerSex")).toBeFocused();
      }
      await page.locator("#client-petitionerSex").selectOption(index === 0 ? "Male" : "Non-Binary");
      await page.locator("#client-respondentSex").selectOption(index === 0 ? "Female" : "Prefer not to Say");
      await page.getByRole("button", { name: "Save Client" }).click();
      await expect(page.getByRole("dialog", { name: "Add New Client" })).toBeHidden();
      await page.getByRole("searchbox", { name: "Search clients or attorneys" }).fill(name);
      await page.getByRole("row", { name: new RegExp(name) }).getByRole("link", { name: "View Details" }).click();
      await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/, { timeout: 30_000 });
      await expect(page.locator('section[aria-labelledby="petitioner-details-heading"]')).toContainText(index === 0 ? "Male" : "Non-Binary", { timeout: 20_000 });
      await expect(page.locator('section[aria-labelledby="respondent-details-heading"]')).toContainText(index === 0 ? "Female" : "Prefer not to Say");
      await page.reload();
      await expect(page.locator('section[aria-labelledby="petitioner-details-heading"]')).toContainText(index === 0 ? "Male" : "Non-Binary");
      await expect(page.locator('section[aria-labelledby="respondent-details-heading"]')).toContainText(index === 0 ? "Female" : "Prefer not to Say");
    }

    await page.getByRole("button", { name: "Edit client" }).click();
    const edit = page.getByRole("dialog", { name: "Edit client information" });
    await edit.locator("#edit-petitionerSex").selectOption("Female");
    await edit.locator("#edit-respondentSex").selectOption("Male");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(edit).toBeHidden({ timeout: 30_000 });
    await page.reload();
    await expect(page.locator('section[aria-labelledby="petitioner-details-heading"]')).toContainText("Female");
    await expect(page.locator('section[aria-labelledby="respondent-details-heading"]')).toContainText("Male");
  } finally {
    const { error: archiveError } = await admin.from("clients").update({ is_archived: true }).in("full_name", names);
    if (archiveError) throw archiveError;
    const { error: disableError } = await admin.from("profiles").update({ status: "disabled" }).eq("id", created.user.id);
    if (disableError) throw disableError;
  }
});
