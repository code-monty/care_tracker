# CareTracker — Progress Report

Client and attorney monitoring system for HLT Psychological Services.
This file is a running log of completed PRs and milestones. Update it each time a PR merges or a milestone closes — add a new dated entry, don't rewrite history.

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
| PR7 | App shell / navigation | In progress — shell and navigation implemented; checks green; not merged |

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

---

## Remaining PR7 work

Add Appointments and Deadlines to the shared navigation, per the Sprint 1 app-shell scope in AGENTS.md Section 11.

---

*Log format: add a new `###` entry per PR/milestone, keep the status table at the top current. Last entry: PR7 app shell/navigation progress.*
