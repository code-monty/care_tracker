import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("archived clients and attorneys show ten rows per page and adjust after restore", async ({ page }) => {
  test.setTimeout(180_000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const split = line.indexOf("="); return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")]; }));
  if (!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Local Supabase required");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const suffix = randomUUID().slice(0, 8);
  const email = `archive-pages-${suffix}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const { data: created, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw createError ?? new Error("Unable to create fake Admin");
  const userId = created.user.id;
  let clientIds: string[] = [];
  const attorneyIds: string[] = [];

  try {
    const { error: roleError } = await db.from("profiles").update({ role: "admin", status: "active" }).eq("id", userId);
    if (roleError) throw roleError;
    const [existingClients, existingAttorneys] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }).eq("is_archived", true),
      db.from("attorneys").select("id", { count: "exact", head: true }).eq("is_archived", true),
    ]);
    if (existingClients.error) throw existingClients.error;
    if (existingAttorneys.error) throw existingAttorneys.error;
    const clientCount = existingClients.count ?? 0;
    const attorneyCount = existingAttorneys.count ?? 0;
    const rowsNeeded = (count: number) => 11 + ((1 - (count + 11) % 10 + 10) % 10);
    const newClientCount = rowsNeeded(clientCount);
    const newAttorneyCount = rowsNeeded(attorneyCount);
    const clientPrefix = `zzzzzzzz Archived Client ${suffix}`;
    const attorneyPrefix = `zzzzzzzz Archived Attorney ${suffix}`;

    const { data: backingAttorney, error: backingError } = await db.from("attorneys").insert({ full_name: `Archive backing attorney ${suffix}`, contact_no: "0912-345-6789", email: `archive-backing-${suffix}@example.test` }).select("id").single();
    if (backingError || !backingAttorney) throw backingError ?? new Error("Unable to seed backing attorney");
    attorneyIds.push(backingAttorney.id);
    const { data: seededAttorneys, error: attorneyError } = await db.from("attorneys").insert(Array.from({ length: newAttorneyCount }, (_, index) => ({ full_name: `${attorneyPrefix} ${String(index + 1).padStart(2, "0")}`, contact_no: "0912-345-6789", email: `archive-page-${suffix}-${index}@example.test`, is_archived: true }))).select("id");
    if (attorneyError || !seededAttorneys) throw attorneyError ?? new Error("Unable to seed archived attorneys");
    attorneyIds.push(...seededAttorneys.map((item) => item.id));
    const { data: seededClients, error: clientError } = await db.from("clients").insert(Array.from({ length: newClientCount }, (_, index) => ({ full_name: `${clientPrefix} ${String(index + 1).padStart(2, "0")}`, birthdate: "1990-01-01", contact_no: "0912-345-6789", email: `archive-page-client-${suffix}-${index}@example.test`, address: "Fake address", attorney_id: backingAttorney.id, created_by: userId, is_archived: true }))).select("id");
    if (clientError || !seededClients) throw clientError ?? new Error("Unable to seed archived clients");
    clientIds = seededClients.map((item) => item.id);

    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In to Portal" }).click();
    await expect(page).toHaveURL(/\/(mfa|dashboard)/, { timeout: 30_000 });
    const payload = Buffer.from(JSON.stringify({ userId, verifiedAt: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", env.STEP_UP_SECRET).update(payload).digest("hex");
    await page.context().addCookies([{ name: "step_up", value: `${payload}.${signature}`, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);

    for (const [kind, count, prefix] of [["client", clientCount + newClientCount, clientPrefix], ["attorney", attorneyCount + newAttorneyCount, attorneyPrefix]] as const) {
      await page.goto(kind === "client" ? "/clients/archived" : "/attorneys/archived");
      const region = page.getByRole("region", { name: kind === "client" ? "Archived clients" : "Archived attorneys" });
      const rows = region.locator("tbody tr");
      const pages = region.getByRole("navigation", { name: `Archived ${kind} pages` });
      await expect(rows).toHaveCount(10);
      await expect(region.getByText(`Showing 1–10 of ${count} archived ${kind}s`)).toBeVisible();
      await expect(pages.getByRole("button", { name: "Previous page" })).toBeDisabled();
      for (let index = 1; index < Math.ceil(count / 10); index++) await pages.getByRole("button", { name: "Next page" }).click();
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(`${prefix} ${String(kind === "client" ? newClientCount : newAttorneyCount).padStart(2, "0")}`);
      await expect(region.getByText(`Showing ${count}–${count} of ${count} archived ${kind}s`)).toBeVisible();
      await expect(pages.getByRole("button", { name: "Next page" })).toBeDisabled();
      await page.setViewportSize({ width: 390, height: 700 });
      await expect(pages).toBeInViewport();
      await rows.first().getByRole("button", { name: "Restore" }).click();
      await expect(region.getByText(new RegExp(`of ${count - 1} archived ${kind}s`))).toBeVisible({ timeout: 20_000 });
      await expect(rows).toHaveCount(10);
      const displayedPage = Number(await pages.locator('[aria-current="page"]').textContent());
      expect(displayedPage).toBeGreaterThanOrEqual(1);
      expect(displayedPage).toBeLessThanOrEqual(Math.ceil((count - 1) / 10));
      await expect(region.getByText(`Showing ${(displayedPage - 1) * 10 + 1}–${Math.min(displayedPage * 10, count - 1)} of ${count - 1} archived ${kind}s`)).toBeVisible();
      if (displayedPage === 1) await pages.getByRole("button", { name: "Next page" }).click();
      else await pages.getByRole("button", { name: "Previous page" }).click();
      await expect(rows).toHaveCount(10);
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  } finally {
    if (clientIds.length) {
      const { error } = await db.from("clients").delete().in("id", clientIds);
      if (error) throw error;
    }
    if (attorneyIds.length) {
      const { error } = await db.from("attorneys").delete().in("id", attorneyIds);
      if (error) throw error;
    }
    const { error } = await db.from("profiles").update({ status: "disabled" }).eq("id", userId);
    if (error) throw error;
  }
});
