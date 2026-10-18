import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Mailpit's local REST API (supabase/config.toml [local_smtp]). Endpoint
// shapes below are from general knowledge of Mailpit's v1 API, not a
// verified check against this project's installed version — if a test
// fails specifically inside clearInboxFor()/latestCodeFor() rather than on
// an actual app assertion, confirm the real shape by hitting
// http://127.0.0.1:54324/api/v1/messages in a browser and adjust.
const MAILPIT_API = "http://127.0.0.1:54324/api/v1";

// DEV-02 (AGENTS.md Section 8/15) requires a real Active, non-locked-out
// user to sign in as. seed.sql does not currently create one (out of
// scope for this PR) — set E2E_STEP_UP_EMAIL / E2E_STEP_UP_PASSWORD to an
// Active account in your local database, or this falls back to the
// account used for manual testing earlier in this PR.
const TEST_EMAIL = process.env.E2E_STEP_UP_EMAIL ?? "user1@caretracker.com";
const TEST_PASSWORD = process.env.E2E_STEP_UP_PASSWORD ?? "TestPassword123";

async function clearInboxFor(request: APIRequestContext, email: string) {
  const res = await request.get(`${MAILPIT_API}/search`, { params: { query: `to:${email}` } });
  const body = await res.json();
  const ids: string[] = (body.messages ?? []).map((m: { ID: string }) => m.ID);
  if (ids.length > 0) {
    await request.delete(`${MAILPIT_API}/messages`, { data: { IDs: ids } });
  }
}

/** Polls Mailpit briefly, since the email is sent asynchronously by the
 * Server Action and may not be visible the instant the page responds. */
async function latestCodeFor(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await request.get(`${MAILPIT_API}/search`, { params: { query: `to:${email}` } });
    const body = await res.json();
    if (body.messages?.length) {
      const latestId = body.messages[0].ID;
      const full = await request.get(`${MAILPIT_API}/message/${latestId}`);
      const fullBody = await full.json();
      const match = /\b(\d{6})\b/.exec(fullBody.Text ?? "");
      if (match) return match[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No step-up code email found for ${email} within the polling timeout`);
}

async function login(page: Page) {
  await page.goto("/login");
  // exact: true, deliberately: the login form's "Show password" button and
  // "Forgot password?" dialog both contain the substring "password", so a
  // loose getByLabel("Password") match resolves to three elements (the
  // real input plus both of those) and throws a strict-mode violation.
  await page.getByLabel("Email address", { exact: true }).fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign In to Portal" }).click();
}

test.describe("DEV-02 step-up verification", () => {
  // Serial, deliberately: every test in this file signs in as the SAME
  // test account and reads from the SAME Mailpit inbox. Playwright's
  // default is to run tests in parallel, each in its own worker — that
  // meant up to 4 near-simultaneous sign-in attempts against one account
  // (tripping Supabase's own rate limiting / the lockout pre-check) and a
  // real risk of one test's latestCodeFor() picking up another test's
  // email instead of its own. Running serially removes both races.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ request }) => {
    await clearInboxFor(request, TEST_EMAIL);
  });

  test("full flow: login -> /mfa -> correct code -> /dashboard", async ({ page, request }) => {
    await login(page);
    await expect(page).toHaveURL(/\/mfa$/);
    await expect(page.getByRole("heading", { name: "Verify your identity" })).toBeVisible();

    const code = await latestCodeFor(request, TEST_EMAIL);

    await page.getByLabel("Verification code", { exact: true }).fill(code);
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("wrong code shows a generic error and does not advance", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/mfa$/);

    await page.getByLabel("Verification code", { exact: true }).fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid or expired code.");
    await expect(page).toHaveURL(/\/mfa$/);
  });

  test("an already-verified session does not loop back to /mfa", async ({ page, request }) => {
    await login(page);
    await expect(page).toHaveURL(/\/mfa$/);

    const code = await latestCodeFor(request, TEST_EMAIL);
    await page.getByLabel("Verification code", { exact: true }).fill(code);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Visiting /mfa directly while the step-up cookie is still valid must
    // not show the form again — proxy.ts should pass this straight
    // through, with the /mfa page itself having nothing to redirect for.
    await page.goto("/mfa");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("resend issues a new code that invalidates the old one", async ({ page, request }) => {
    // The form starts its 30s resend cooldown right after the automatic
    // first send completes, same as after an explicit resend (AGENTS.md
    // Section 8's throttle applies either way). Fast-forward the page's
    // clock instead of a real 30s wait so this test stays fast.
    await page.clock.install();

    await login(page);
    await expect(page).toHaveURL(/\/mfa$/);

    const firstCode = await latestCodeFor(request, TEST_EMAIL);
    await clearInboxFor(request, TEST_EMAIL);

    await page.clock.fastForward("30s");
    await page.getByRole("button", { name: "Resend code" }).click();

    const secondCode = await latestCodeFor(request, TEST_EMAIL);
    expect(secondCode).not.toBe(firstCode);

    // request_step_up_code() invalidates any prior unconsumed code on
    // every new request (migration 20261011010000) — the first code must
    // no longer verify.
    await page.getByLabel("Verification code", { exact: true }).fill(firstCode);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid or expired code.");

    // The fresh code still works.
    await page.getByLabel("Verification code", { exact: true }).fill(secondCode);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
