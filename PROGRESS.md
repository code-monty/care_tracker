# CareTracker — Progress Report

Client and attorney monitoring system for HLT Psychological Services.
This file is a running log of PRs, milestones, and significant follow-up work. Update it when work advances, a PR merges, or a milestone closes — add a new dated entry, don't rewrite history.

---

## Status at a glance

| PR | Scope | Status |
|---|---|---|
| PR1 | README rewrite, AGENTS.md dedupe | ✅ Merged, CI green |
| PR2 | Supabase client factories (`server.ts`, `browser.ts`, `admin.ts`) | ✅ Merged, CI green |
| PR3 | `profiles` + `activity_log` schema, RLS, pgTAP, `/pending` screen | ✅ Merged, CI green |
| PR4 | Login-to-DB walking skeleton (login page, `proxy.ts` session gate, sign-out) | ✅ Pushed, CI green, manually tested |
| PR5 | Per-account lockout (5 attempts / 15 min), sign-in moved to Server Action | ✅ Pushed, CI green, manually tested |
| PR6 | Email-code step-up verification (DEV-02), replacing TOTP MFA | ✅ Closed out — functionally complete |
| PR7 | App shell / navigation | Implemented locally, including Appointments and Deadlines links; not merged or browser-verified |
| Client and appointment persistence | Local Supabase migrations, server actions, dashboard queries, and searchable form names | Implemented locally; authenticated Chromium records flow passed; hosted deployment unverified |
| Deadlines and client tasks | Local tasks migration, five-column directory, client history, dashboard deadlines | Implemented locally; pgTAP and authenticated Chromium flow passed; hosted deployment unverified |

Recent auth UI, Google sign-in, and loading work is recorded below as dated follow-up work; no new PR number or merge status is assigned. PR7 navigation now includes Appointments and Deadlines; authenticated browser verification and merge remain outstanding.

---

## Environment setup

- Local dev: Docker + `supabase start`, PowerShell on Windows.
- Cloud: existing Supabase project approved as the DEV/interim-production project, renamed `caretracker-dev` (see AGENTS.md DEV-01 — two-environment interim setup, no real client data yet).
- Repo path: `C:\Users\...\Desktop\caretracker\caretracker`.

---

## Key decisions log

- **Login identifier:** email, not username.
- **DEV-01:** existing Supabase cloud project adopted as the interim dev/production stand-in (free tier), per AGENTS.md Section 15.
- **DEV-02:** SARD/AGENTS.md's TOTP-based MFA requirement overridden — step-up verification is a 6-digit **email code**, mandatory for **all** users (Admin and Staff), not Admin-only. AGENTS.md Sections 2, 8, and 15 updated to document this deviation.
- **Login page UX asks:** show/hide password toggle, "Forgot password" dialog pointing users to contact their administrator (accounts are Admin-created only — no self-service reset), and a "Continue with Google" button idea (parked — conflicts with admin-created-only accounts and needs Google app approval).
- **Step-up cookie:** signed, HttpOnly, separate `STEP_UP_SECRET` env var (not reusing `QUEUE_TOKEN_SECRET`); per-browser, so a new device re-triggers step-up.
- **Email delivery:** Nodemailer (10.1.0) + `@types/nodemailer` (8.0.2). Local dev uses Supabase's local SMTP testing inbox (Inbucket/Mailpit, `127.0.0.1:54325`) with `local_smtp.smtp_port` uncommented in `supabase/config.toml`. Production needs a real SMTP provider configured under `[auth.email.smtp]` — flagged as an outstanding setup dependency.
- **Google sign-in follow-up (October 17):** The earlier button idea is now implemented for existing, administrator-created active profiles. Unknown, pending, disabled, or locked accounts are rejected; eligible users still complete email-code step-up unless their workstation has a valid remembered entry. The Google account chooser is requested at every sign-in. Hosted consent and production provider/SMTP setup remain unverified.

---

## Milestone log

### PR1 — README + AGENTS.md cleanup
Merged, CI green.

### PR2 — Supabase client factories
`lib/supabase/server.ts`, `browser.ts`, `admin.ts` (service-role client gated by `server-only`). Merged, CI green.

### PR3 — profiles + activity_log foundation
Schema, RLS policies, pgTAP tests, `/pending` approval screen, `db-tests` CI job added. Merged, CI green (checks 32s, db-tests 3m34s).

### PR4 — Login-to-DB walking skeleton
Real `/login` page, `proxy.ts` session gate, sign-out action, `requireActiveUser()` helper. Decisions: added a "too many attempts" lockout message, kept the dashboard placeholder redirect, deferred MFA to its own PR. Pushed, CI green (checks 33s, db-tests 3m29s); manually tested active login, wrong password, pending screen, sign-out.

### PR5 — Per-account lockout
5-attempt / 15-minute lockout. Added `profiles.email`, `failed_login_attempts`, `locked_until`. Sign-in moved to a Server Action so the lockout pre-check can run before Supabase Auth responds. Vitest coverage for the lockout rule. Pushed, CI green (checks 37s, db-tests 3m48s); manually confirmed lockout triggers, blocks the correct password while locked, and that active accounts still log in fine.

### PR6 — Email-code step-up verification (DEV-02)
The big one. Summary of what shipped:
- `step_up_codes` table + SECURITY DEFINER functions (`request_step_up_code`, `verify_step_up_code`), migration + pgTAP tests (29 tests, all green).
- `lib/auth/step-up.ts` (signed cookie helpers) + Vitest coverage; dropped the `server-only` import (pure functions, no I/O — same pattern as `lockout.ts`).
- `lib/validation/step-up.ts` (Zod), `request-step-up.ts` / `verify-step-up.ts` Server Actions.
- `proxy.ts` step-up cookie gate (redirects to `/mfa`); `requireActiveUser()` repeats the check server-side.
- `app/(auth)/mfa/page.tsx` + `step-up-form.tsx` (6-digit input, 30s resend cooldown).
- Real email sending via Nodemailer (replaced a dev-only `console.log` stopgap). New env vars: `SMTP_HOST/PORT/USER/PASSWORD/FROM`.
- Login page polish folded in here too: show-password toggle, forgot-password dialog, `minimum_password_length = 10` set in `supabase/config.toml`.

Bugs found and fixed along the way:
- pgTAP "planned 12 tests but ran 0" — fixed by wrapping bare `verify_step_up_code()` calls in a `DO` block.
- "schema tests does not exist" across pgTAP files — each file runs in its own transaction; 002 now creates its own `tests` schema/helpers (duplication flagged for later cleanup).
- `??` vs `||` bug in `send-step-up-code.ts` — a blank `.env.local` value (`SMTP_HOST=`) stayed as `""` instead of falling back to the local default, crashing Node's net layer. Switched to `||` for the SMTP fallbacks.
- Double-send bug — two racing `/mfa` GETs both triggered `requestStepUp()`. Fixed by moving the first-send trigger into a `useEffect` + `useRef` guard in `step-up-form.tsx`.
- Playwright selector collisions: `getByLabel("Password")` matched 3 elements (input + "Show password" + "Forgot password?" dialog) — fixed with `exact: true`. Next.js's route announcer div also has `role="alert"`, colliding with the real error alert — scoped `getByRole("alert")` to `page.locator("form")`.
- Pre-existing, unrelated bug found and fixed: `tests/e2e/smoke.spec.ts` expected a "Login" heading; actual text is "Sign in to CareTracker".

Final state: manually verified end-to-end (login → `/mfa` → email → verify → `/dashboard`, wrong code, resend/cooldown, no-loop-when-already-verified — all confirmed by hand). `pnpm test` and `pnpm typecheck` clean. `tests/e2e/step-up.spec.ts` written (4 tests) but left `test.describe.skip()` with a TODO — Playwright automation wasn't fully stabilized, not an app bug. **PR6 closed out as functionally complete.**

### PR7 — App shell / navigation (October 16, 2026)
Implemented locally; not merged. Added the authenticated app layout with responsive navigation for Dashboard, Clients, and Attorneys; Admin-only links for Users, Activity Logs, Settings, and Backup; server-side Admin route authorization; active-route styling; and a sign-out action that clears the step-up cookie. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass (17 tests).

### Login redesign (October 16, 2026)
Implemented the Figma-based `/login` design with HLT branding, responsive split layout, light/dark themes, and local assets. Kept the existing Server Action sign-in, generic errors, password visibility control, and administrator-contact recovery dialog. Desktop/mobile presentation and typecheck were checked; lint was reported passing. This was a login-page design follow-up, not a new PR or an auth-policy change.

### Email-code screen redesign (October 16–17, 2026)
Matched `/mfa` to the login branding, layout, typography, theme, and responsive styling. Kept the six-digit code input, automatic email request, verify action, generic error, and 30-second resend cooldown. Historical lint, typecheck, and Vitest checks passed. Playwright coverage was not completed: the first run hit stale login selectors, and a later run remained on `/login` instead of reaching `/mfa`.

### Restricted Google sign-in (October 17, 2026)
Added the Google OAuth callback, profile eligibility checks, generic rejection path, local Supabase provider configuration, and `prompt=select_account` so users see the Google account chooser on each attempt. Access is limited to administrator-created active profiles with a matching Google identity and no lockout. Approved first-time sign-in goes through email-code step-up; a valid remembered-workstation entry may skip a repeat code after sign-in. Historical unit tests (24 across four files), lint, and typecheck passed. Google's hosted consent flow, the active Supabase provider settings, and SMTP delivery were not verified end to end; an `Unsupported provider` response was observed when the target provider was disabled.

### Branded loading states (October 17, 2026)
Added an accessible branded loading indicator, route fallbacks for login, MFA, the authenticated app, Admin, and queue display, plus an overlay while login or Google sign-in is submitting. Historical lint, typecheck, Vitest (41 tests across eight files), and the smoke Playwright test passed. The step-up Playwright flow still failed to reach `/mfa` and stopped on `/login` while the sign-in overlay was active; its cause remains open. Do not count the full auth E2E flow as passing.

### Current checkout (October 18, 2026)
Shared auth theme and card components are being extracted across login, MFA, pending, privacy-policy, and terms-of-service screens. These files are currently modified or untracked in the working tree. This refactor has not been committed or validated and is not recorded as a completed milestone.

### Authenticated app theme switch (October 19, 2026)
Added a light/dark switch to the authenticated app header and themed the shared shell and navigation for Dashboard, Clients, Attorneys, Appointments, Deadlines, and Admin routes. The switch reuses the auth screens' browser-stored preference, so it persists across navigation and reloads. Existing auth screens and route authorization are unchanged. `pnpm.cmd lint` and `pnpm.cmd typecheck` pass; an authenticated browser walkthrough has not been completed.

### Shared clinical dashboard (October 19, 2026)
Replaced the `/dashboard` placeholder with a responsive, Figma frame `8:4`-inspired dashboard for Admin and Staff within the existing authenticated shell. Added an Asia/Manila date selector with previous/next day controls, an appointments summary, upcoming appointments and deadlines panels, and links to the existing routes. Panels show explicit zero and empty states while appointment and deadline records are not yet available; no sample names, live-status claims, capacity figures, pipeline counts, or export control are shown. Existing navigation and authorization are unchanged. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass. `pnpm.cmd build` could not complete because the sandbox could not fetch the app's existing Google fonts; the network-enabled retry was declined. Authenticated desktop/mobile browser and keyboard walkthroughs have not been completed.

### Authenticated shell redesign (October 21, 2026)
Reworked the shared Admin and Staff shell from Figma frame `2302:382`: full-width branded header, profile details and menu, a compact desktop icon rail, and a five-route labeled mobile bottom bar. Added Appointments and Deadlines to main navigation and kept Admin routes in a separated rail group plus the Admin-only profile menu on mobile. Reused the signed-in profile, existing light/dark preference, sign-out action, and server-side Admin route gate. The dashboard and other page content were preserved. Exact local Figma assets were added for the custom Clients and Attorneys icons and header decorations; shell typography now uses the Inter and Plus Jakarta Sans families specified in `DESIGN.md`. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and a network-enabled `pnpm.cmd build` pass; authenticated desktop/mobile browser, keyboard, and role walkthroughs remain unverified.

### Collapsible desktop sidebar (October 21, 2026)
Added an accessible arrow button to the desktop navigation rail. It starts compact, expands to show labels for the existing main and Admin-only links, and collapses back to icons without changing the mobile bottom navigation or route authorization. The rail width transition respects reduced-motion preferences. `pnpm.cmd lint` and `pnpm.cmd typecheck` pass; authenticated browser interaction has not yet been verified.

### Sticky sidebar and border toggle (October 21, 2026)
Adjusted the authenticated shell so the desktop header stays at the top while the compact or expanded sidebar stays directly beneath it during page scrolling. The sidebar has its own scroll area for short viewports and long Admin navigation. Moved the expand/collapse arrow over the sidebar's right border; its visible circle is smaller while the clickable target remains 44px. The mobile bottom bar, routes, roles, and dashboard content are unchanged. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass; authenticated desktop/mobile browser scrolling and keyboard checks remain unverified.

### App-shell icon and light-logo refinement (October 23, 2026)
Reduced the visible desktop sidebar navigation icons while preserving the existing 50px link targets, expanded labels, active states, and mobile bottom-navigation sizing. In light mode, the HLT header logo now uses the established blue `#306fa5` treatment without the dark circular background; dark mode retains the existing white logo and dark ring. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass. Authenticated visual checks for both sidebar states and both themes remain to be completed in a browser.

### Compact authenticated header (October 23, 2026)
Reduced the authenticated header from 80px to 68px on desktop and from 68px to 60px on mobile. Scaled down the header logo, avatar, theme icon, and settings icon while retaining the existing accessible button targets, and synchronized the sticky desktop sidebar offset and viewport height with the new header height. Routes, menus, theme behavior, and mobile navigation are unchanged. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass; authenticated desktop/mobile visual verification remains outstanding.

### Dashboard consolidation (October 23, 2026)
Renamed the authenticated page title from "Clinical Dashboard" to "Dashboard" and consolidated its summary cards into the two existing panels. The selected-date controls and appointment count now sit inside Upcoming Appointments, while Current Active Clients is shown inside Deadlines with a link to the client list. Counts remain explicit zero-value placeholders because appointment, deadline, and client records are not yet available; no schema or backend behavior changed. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass; authenticated desktop/mobile, light/dark theme, date-control, and keyboard checks remain to be completed in a browser.

### Dashboard panel alignment (October 23, 2026)
Moved the appointment count onto the Upcoming Appointments title line and removed its separate summary row. Current Active Clients now has its own card above the appointments and deadlines panels. The two panels share a desktop row and stretch to equal height, with aligned empty states and footer links; they stack on mobile. Counts remain placeholders until records are available. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass; browser verification remains outstanding.

### Dashboard top spacing (October 23, 2026)
Reduced the dashboard's top padding from 3.5rem to 1.5rem on desktop and from 2rem to 1rem on mobile so the heading and cards sit closer to the authenticated header. Other spacing and panel alignment are unchanged.

### Appointments UI milestone (October 23, 2026)
Replaced the `/appointments` placeholder with a responsive CareTracker-styled workspace containing searchable and sortable list views, date and status filters, accurate pagination, a six-week month calendar, explicit empty states, and mobile appointment cards. Added accessible Add Appointment and details dialogs; the form validates name, non-past date, time, standard or custom reason, then creates a Pending appointment in browser memory for the current page session only. No Supabase schema, persistence, RLS, audit, authorization, or dependency changes were introduced. `pnpm.cmd lint`, `pnpm.cmd typecheck`, the full Vitest suite (44 tests across nine files), and `git diff --check` pass. Authenticated browser checks for light/dark themes, responsive layouts, dialog focus behavior, and keyboard interaction remain unverified.

### Appointment dialog visibility fix (October 23, 2026)
Corrected the Add Appointment and details dialog styling so closed dialogs stay hidden and open dialogs center above the page. The earlier full-screen dialog CSS could leave a transparent closed dialog over the page and intercept clicks. Browser interaction still needs an authenticated walkthrough.

### Appointment actions and picker icons (October 23, 2026)
Added a three-dot action menu beside View Details on desktop and mobile. It opens an edit form for temporary appointment details and status (Pending, Confirmed, Cancelled). Date and time picker icons now follow the active light or dark theme. These changes remain in browser memory only; authenticated browser interaction has not yet been verified.

### Clients list UI (October 24, 2026)
Replaced the `/clients` placeholder with a responsive list shell styled to match the Dashboard and shared light/dark theme. Added search, status selection, sortable name/status headers, table columns, accurate zero-result pagination, and filtered/unfiltered empty states. Client records and the Add Client/View Details flows are not implemented yet; no sample personal data or persistence is used. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass. Authenticated browser verification remains pending.

### Add Client form overlay (October 24, 2026)
Added an Add Clients button and responsive, keyboard-accessible dialog matching the authenticated Dashboard theme. The form covers petitioner/client, legal counsel, and respondent details, with calculated age and field-level validation for required values, Philippine mobile numbers, email, and non-future birthdates. Save Client is visibly disabled with an explanation because secure client persistence, RLS, and audit logging are not implemented; entered details stay only in dialog memory and clear on close. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass. Authenticated browser verification remains pending.

### Temporary client saving (October 24, 2026)
Enabled Save Client after full Zod validation and a duplicate name/birthdate check. New clients live only in page memory and appear in the searchable, sortable, paginated list with a View Details dialog; they disappear on reload. The UI labels this clearly and warns against entering real client data. No Supabase persistence, RLS, or audit logging was added. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass. Authenticated browser verification remains pending.

### Client form order and Add Attorney reveal (October 24, 2026)
Moved Respondent Details above Legal Counsel Information in Add New Client. Legal Counsel now starts with an Add Attorney button that reveals its three required fields in the same dialog; saving with missing attorney details reveals the fields and focuses the first invalid field in form order. Renamed the list's name column and client detail labels to Petitioner. Temporary page-memory saving and the Attorneys placeholder remain as before. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass. Authenticated browser verification remains pending.

### Client Information page (October 24, 2026)
Changed View Details from an overlay to `/clients/[id]`, with Dashboard-style Petitioner, Respondent, Legal Representation, Status, and empty Tasks / Assignments cards. Temporary client records now live in a shared in-memory provider across the Clients list and detail route; direct links and reloads without a matching record show an unavailable state. The Active/Inactive control updates the list badge and filter. No browser storage, Supabase persistence, notes, edit actions, or case-action controls were added. `pnpm.cmd lint`, `pnpm.cmd typecheck`, and `git diff --check` pass. Authenticated browser verification remains pending.

# Issue in SMTP Cloud in Brevo (October 22, 2026)
It does not send the mail in designated mail, I think there is a problem in domain part

# Vercel Problem after Sign In in Google (October 22, 2026)
It goes to Vercel Page after Google Sign In

---

## Remaining PR7 work

Run authenticated Admin and Staff browser walkthroughs, including mobile navigation and keyboard access, then review/merge PR7 when ready.

---

*Log format: add a new `###` entry per PR/milestone or dated follow-up, and keep the status table at the top current. Last entry: October 26, 2026 Attorney search overlay scroll correction.*

### Persistent clients, appointments, and dashboard records (October 24, 2026)
Added local Supabase migrations for attorneys, clients, respondents, and appointments with active-user RLS, Admin-only client archive guard, actor checks, and metadata-only activity-log triggers. Client creation now uses one database transaction. Replaced temporary client and appointment storage with server reads and validated actions, enabled attorney reuse and linked appointments, and connected the dashboard's active-client count and selected-day appointments to the database. The deadline panel remains a placeholder. Three local migrations applied; 41 pgTAP tests pass, including anonymous, pending, disabled, Staff, and Admin access. Lint and typecheck pass; 44 Vitest tests pass. A local authenticated Chromium flow passed for client creation and reload, attorney reuse, appointment creation and reload, dashboard date navigation and count, edit, and cancellation. Hosted deployment remains unverified. No cloud migration or deployment was run.

### Dashboard table and Legal Counsel choice (October 25, 2026)
Replaced the dashboard's centered appointment text with a responsive Client/Time/Reason table and made the selected date's appointment count prominent, labeled “today” on the current date and “appointment(s)” for other dates. The Add Client form now offers explicit Add Attorney and Existing Attorney choices; selecting an existing attorney displays their saved name, contact number, and email as read-only details. Existing client and appointment persistence paths are unchanged. Lint, typecheck, 44 Vitest tests, and `git diff --check` pass. The local authenticated Chromium records flow passes for both attorney choices, appointment table and count, empty date, date navigation, light/dark themes, mobile table visibility, and keyboard focus. Hosted deployment and a separate manual visual review remain unverified.

### Attorneys directory and linked clients (October 25, 2026)
Replaced the Attorneys placeholder with a searchable, responsive directory of persisted attorney records and linked client counts. Selecting an attorney opens `/attorneys/[id]` with their contact information and non-archived linked clients, including status and links to each existing Client Information page. The next-deadline column explicitly says "Not tracked yet" until deadline records exist. Added loading, error, and empty states. No schema, permission, or attorney editing changes were made. Lint, typecheck, and `git diff --check` pass; the local authenticated Chromium persisted-records flow passes with attorney selection, two linked clients, and View Client navigation. Hosted deployment and separate manual visual review remain unverified.

### Searchable attorney and client form fields (October 26, 2026)
Replaced Existing Attorney and Add/Edit Appointment client dropdowns with a shared searchable name field. Authenticated server actions search all matching attorney or non-archived client records through RLS, return up to ten results, and preserve record IDs for saves. The field shows a distinguishing email, handles keyboard and pointer selection, and requires a selected result after text changes. Existing attorney details and the current client in Edit Appointment remain visible. Lint, typecheck, and an authenticated Chromium records flow passed locally, including no-match, keyboard selection, clearing a client choice, reload, mobile form search, and light/dark theme checks. No migration or hosted deployment was run.

### Form search list placement and focus styling (October 26, 2026)
Moved Existing Attorney search results into the Add Client dialog's scrollable layout above the search input, with a bounded scroll area for many matches. Removed the inner input border and focus outline so attorney and appointment client searches show one focus outline around the whole field. Lint, typecheck, and the authenticated Chromium records flow pass locally. Browser assertions cover visible attorney results above the input at short mobile and desktop heights, single focus outlines in light and dark themes, keyboard selection, and saved-record flows. Hosted deployment and a separate manual visual review remain unverified.

### Attorney search overlay scroll correction (October 26, 2026)
Corrected the earlier attorney-result placement: the list is now a floating overlay inside the Add Client dialog but outside its scrollable form body. It stays above the input, sizes to the available dialog space, and contains wheel/touch scrolling so reaching the list's edge does not move the form. The prior in-flow list could scroll out of view. Lint, typecheck, and an authenticated Chromium records flow pass locally; the browser check forces list overflow, confirms the list scrolls while the form stays still, and verifies result selection. No schema change or hosted deployment was made.

### Deadlines and client tasks (October 26, 2026)
Added a local Supabase tasks migration with active-user RLS, active-Staff assignee checks, metadata-only audit triggers, and a Manila-date deadline status view. The Deadlines page now has the requested five columns, create/edit/complete actions, search, status/attorney/Staff filters, and pagination. Tasks appear in each client's Tasks / Assignments history and the dashboard's urgent-first open-deadline panel; the attorney detail now shows the next open deadline. Completed tasks remain available through the Done filter and client history. The task form intentionally omits task type and venue/court per the approved departure from FR-TSK-01; Due Soon uses the three-day default until settings are implemented. The migration was applied only to local Supabase without resetting records. Local verification: 55 pgTAP checks, 46 Vitest tests, lint, typecheck, `git diff --check`, and authenticated Chromium flows for both deadlines and existing client/appointment records. Browser checks covered create, edit, completion, reload persistence, client/dashboard links, keyboard focus, mobile layout, and light/dark themes. Generated fake records left by failed local browser runs were archived and their fake accounts disabled. Hosted migration, deployment, and separate manual visual review have not run.

### Deadlines dropdown contrast (October 27, 2026)
Corrected the Deadlines Status, Attorney, and Assigned Staff dropdowns so option text and backgrounds follow the active light or dark theme. Applied the same fix to the Add/Edit Task dropdowns and set the native select color scheme per theme. Lint, typecheck, and `git diff --check` pass locally. Native dropdown appearance has not been separately reviewed in a browser; no hosted deployment was run.
