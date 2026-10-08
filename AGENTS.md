# AGENTS.md: CareTracker

Instructions and context for AI coding agents working on this repository.
Source of truth: *CareTracker System Architecture and Requirements Document (SARD) v1.2*, Team Code2Care, Oct 2, 2026. If this file and the SARD disagree, **stop and ask**; do not guess.

---

## 1. Project overview

**CareTracker** is a browser-based client and attorney monitoring system for **HLT Psychological Services** (Mandaluyong City, Philippines). It replaces index cards and a logbook with digital records of clients, attorneys, appointments and deadlines.

- **Users:** `Admin` (owner and chief members) and `Staff` (psychometricians and related roles). A third non-person actor, the **queue display device**, is read-only and uses a rotatable token instead of a login.
- **Scale:** under 10 concurrent users, about 5,000 client records as the design limit.
- **Locale:** English UI, time zone `Asia/Manila`, Philippine mobile format `09XX-XXX-XXXX`.
- **Data sensitivity:** personal and legal-case information (RA 10173, Data Privacy Act). Security and privacy outrank every other quality attribute.

---

## 2. Tech stack

Use the **latest stable** version of each tool at scaffold time. Verify versions against official docs or the npm registry rather than relying on memory, then pin them in `package.json` and commit the lockfile.

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server Components and Server Actions; one codebase for UI and backend |
| UI | **Tailwind CSS** (shadcn/ui optional) | Teal/blue Figma design; accessible tables, dialogs, forms |
| Hosting | **Vercel** | Preview deployment per PR; production on a custom domain |
| Database | **Supabase Postgres** | Migrations via Supabase CLI, kept in Git |
| Auth | **Supabase Auth + `@supabase/ssr`** | Secure cookie sessions; mandatory MFA (TOTP) for Admins |
| Access control | **Row Level Security + `profiles.role`** | Default deny on every table |
| Data access | **`supabase-js` from server code only** | HTTPS API; service-role key in server env vars only |
| Validation | **Zod** | Shared schemas for forms and server checks |
| Testing | **Vitest, Playwright, pgTAP** (`supabase test db`) | Unit, end-to-end, and RLS tests |
| CI/CD | **GitHub Actions + Vercel** | Lint, type-check, tests, migration check |
| Backups | **Supabase backups + `supabase db dump` + `age`** | Encrypted local export for HLT |
| Package manager | **pnpm** | Do not mix in npm or yarn lockfiles |

**Next.js 16 note:** the `middleware.ts` file convention is deprecated and renamed to `proxy.ts` (exported function `proxy`, Node.js runtime). Use `proxy.ts`, never `middleware.ts`. The SARD v1.2 still says "middleware"; treat that as `proxy.ts` and flag it for the next SARD revision.

Do **not** introduce a different framework, ORM, auth library or hosting provider without explicit approval.

---

## 3. Setup and commands

> Fill in exact script names once the project is scaffolded. Keep this section accurate; update it in the same PR that changes any command.

```bash
pnpm install                 # install dependencies
cp .env.example .env.local   # then fill in DEV project values (never production)
supabase start               # local Supabase (Docker required)
supabase db reset            # apply migrations + fake-data seed locally
pnpm dev                     # run Next.js locally

pnpm lint                    # ESLint
pnpm typecheck               # next typegen && tsc --noEmit
pnpm test                    # Vitest unit tests
pnpm test:e2e                # Playwright end-to-end tests
supabase test db             # pgTAP RLS / permission tests (release-blocking)
```
````
`pnpm typecheck` runs `next typegen` first because Next.js generates
the `LayoutProps` / `PageProps` types into `.next`, which does not exist
on a fresh clone or in CI.
````

**Environments (interim):** Two environments only — local Supabase (`supabase start`, no cloud slot used) for development and testing, and one free-tier cloud project for production. No true cloud staging environment until HLT commits to a paid plan. Preview and dev work must still **never** point to production data. See DEV-01 in Section 15.

**Environment variables** (names only; never commit values):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server only, never exposed to the browser
ENFORCE_IP_ALLOWLIST           # default "false" (deferred feature flag)
CLINIC_ALLOWED_IPS             # comma-separated; used only when the flag is on
QUEUE_TOKEN_SECRET             # signs the rotatable queue-display token
```

**Dev on LAN:** to open `pnpm dev` from another device (e.g. `192.168.18.10`), list that host in `allowedDevOrigins` in `next.config.ts`, then restart the dev server. Dev only; never put real production hosts there.

Only variables prefixed `NEXT_PUBLIC_` may reach the browser. Everything else stays server-side.

---

## 4. Suggested project structure

```
/app
  /(auth)/login, /mfa, /pending   # public: login only, rate limited
                                  # /pending: signed-in but status != Active
                                  # (awaiting approval or disabled); no
                                  # client/case data reachable from here
  /(app)/dashboard
  /(app)/appointments
  /(app)/clients, /clients/[id]
  /(app)/attorneys
  /(app)/deadlines
  /(app)/admin/users, /logs, /settings, /backup   # Admin only
  /queue/display                 # token-gated, read-only
  /api/export/...                # route handlers: client .txt, log .csv
/components                      # UI components
/lib
  /supabase                      # server + browser client factories
  /validation                    # Zod schemas (shared by forms and actions)
  /rules                         # business rules (deadline status, age, etc.)
  /auth                          # role checks, session helpers
/supabase
  /migrations                    # tables, RLS policies, triggers, views
  /tests                         # pgTAP RLS tests
  seed.sql                       # FAKE data only
/tests                           # Vitest + Playwright
/scripts                         # encrypted local backup export
proxy.ts                         # Next.js 16 request proxy (replaces middleware.ts): session check; optional IP allowlist check
next.config.ts                   # includes allowedDevOrigins for LAN dev access
```

---

## 5. Architecture rules (non-negotiable)

1. **Server-side data access only.** The browser never receives a privileged key. Reads and writes go through Server Components, Server Actions and route handlers.
2. **Authorization is enforced twice:** in server code (re-check the role in every Server Action) and by Postgres RLS. Never rely on hiding UI elements.
3. **RLS on every table, default deny.** Anonymous, `Pending` and `Disabled` users match no policy. Every new table ships with RLS enabled and a pgTAP test in the same migration PR.
4. **The service-role key** exists only in server environment variables, and is used only for admin operations (create user, approve, reset password, deactivate). It must never appear in client bundles, logs, the repo or screenshots.
5. **Passwords** are handled entirely by Supabase Auth. Never store, hash or log passwords in our code.
6. **Audit log is written by database triggers** so the UI cannot skip it. It is **append-only**: update and delete rights are revoked.
7. **Archive, never hard-delete.** Staff cannot delete. Only Admin can restore or purge. User accounts are deactivated, never deleted.
8. **Notes are insert-only** (author + timestamp, no edit or delete).
9. **Migrations only.** Never change the schema by hand in the Supabase dashboard; every schema change is a migration committed to Git.

### Access model (Decision D-01, interim Option B)
The app is hosted in the cloud and reachable from the internet. Protection is login, mandatory Admin MFA, RLS, rate limiting, lockout and alerts.
The **clinic-IP allowlist is deferred, not cancelled.** Build it behind `ENFORCE_IP_ALLOWLIST` (default off), with the `proxy.ts` check and a matching disabled Vercel firewall rule. Do not remove it and do not enable it without approval.

---

## 6. Roles and permissions

| Capability | Admin | Staff |
|---|---|---|
| Log in/out, change own password, enrol own MFA | ✅ | ✅ |
| View dashboard, appointments, clients, attorneys | ✅ | ✅ |
| Add/edit clients, attorneys, notes | ✅ | ✅ |
| Add/edit/cancel appointments; tasks, deadlines, priority | ✅ | ✅ |
| Export client info to text (always logged) | ✅ | ✅ |
| Operate queue (check-in, call next, done) | ✅ | ✅ |
| Archive and restore clients | ✅ | ❌ |
| View/export Activity Logs; security alerts | ✅ | ❌ |
| Manage users (create, approve, reset, deactivate, change role) | ✅ | ❌ |
| Settings, backup status, rotate queue token | ✅ | ❌ |

**Defaults in effect (pending client confirmation):** all Staff can see all clients (Q-03). Accounts are admin-created only, with no open sign-up (Q-04). If a "Sign Up" button remains in the UI, it only creates a `Pending` account that RLS blocks from all data (relabel it "Request access").

---

## 7. Data model and business rules

**Entities:** `profiles` (role, status), `clients`, `respondents`, `attorneys`, `appointments`, `tasks`, `notes`, `activity_log`, `queue_entries`, `settings`, `backup_runs`.

Key relationships: a client has **one** respondent and **one** attorney; an attorney has **many** clients; a client has many appointments, tasks and notes. `profiles.id` equals the Supabase Auth user id.

| ID | Rule |
|---|---|
| BR-01 | Deadline status is computed in a `deadline_status` view: **Overdue** if due date is before today and not done; **Due Soon** if due within N days (default 3, inclusive, configurable); otherwise **Upcoming**. |
| BR-02 | Marking a case Completed sets the client Inactive (after confirmation) and removes their open deadlines from the dashboard. |
| BR-03 | Priority clients and clients with overdue tasks appear first on the dashboard, highlighted in red. |
| BR-04 | Age is derived from birthdate; birthdates cannot be in the future. |
| BR-05 | One attorney record is reused across clients; editing it updates every linked client. |
| BR-06 | Staff cannot hard-delete; archiving hides a record; Admin can restore or purge. |
| BR-07 | Every create, update, status change, archive, export and login event writes an activity-log row. Log rows are never modified. |
| BR-08 | Accounts are deactivated, not deleted, so history stays meaningful. |

Activity-log entries reference the record (`entity_type`, `entity_id`) and **never copy sensitive field values**.

---

## 8. Security rules for agents

- **Never** use, create, paste or commit real client data. Use fake data only in dev, tests, seeds, demos and screenshots.
- **Never** commit secrets, keys, `.env*` files (except `.env.example` with empty values), or backup files.
- **Never** log sensitive values (names, birthdates, addresses, contacts, notes) or passwords.
- Login errors are **generic** ("Invalid username or password") and never reveal whether an account exists.
- Passwords: minimum length 10. Lock out or back off after 5 failed attempts. Rate-limit login at Vercel and in Supabase.
- Sessions expire after **10 minutes** idle (configurable): a Supabase session setting plus an app-level idle timer.
- **MFA (TOTP) is mandatory for Admins**, recommended for Staff.
- Security headers: CSP, HSTS, `noindex`; secure, HttpOnly, SameSite cookies; CSRF-safe Server Actions.
- Queue display shows **queue numbers or initials only**, via a signed, rotatable, read-only token that cannot be used to log in.
- Parameterized queries only (through the Supabase client). Encode all output.
- No real client data in any environment until the Phase 5 security checklist and the allowlist re-evaluation are signed off (NFR-SEC-08).

---

## 9. Coding conventions

- **TypeScript strict mode.** No `any` without a justifying comment. Prefer Zod-inferred types.
- **Validation:** one Zod schema per form/action, shared between client form and server check. Rules: required fields, PH mobile format `09XX-XXX-XXXX`, email format, no future birthdates, age calculated from birthdate.
- **Dates and times:** store UTC (`timestamptz`), display in `Asia/Manila`. Activity-log time has millisecond precision.
- **Server Components by default;** add `"use client"` only where interactivity requires it.
- **Mutations** go through Server Actions or route handlers that: (1) verify the session, (2) re-check the role, (3) validate input with Zod, (4) perform the change, (5) rely on triggers for audit logging.
- **Business rules** live in `/lib/rules` (and SQL views/functions where they must be authoritative), with unit tests. Do not scatter them across components.
- **Accessibility:** status badges always have a **text label** (never color alone: Overdue = red, Due Soon = yellow, Upcoming = green); keyboard-friendly forms; readable contrast; works at 1366×768 minimum on desktop and tablet.
- **UI states:** every screen needs empty, loading, error, validation and confirmation states (for example "Mark Completed?").
- Use the real person's name in the greeting ("Good Day, [name]!") and real counts in pagination.
- Keep PRs small and focused; commit messages in imperative mood.

---

## 10. Testing and Definition of Done

**Testing layers:** Vitest for unit tests (deadline status, validation, rules), pgTAP for RLS and permission tests, Playwright for core end-to-end flows (add client, book appointment, check deadlines, export), plus the security checklist and a quarterly restore drill.

**RLS and permission tests are release-blocking in CI.** They must prove that anonymous and pending users read nothing, that Staff cannot reach Admin-only data, and that the service-role key never appears in browser bundles.

A task is **done** only when:
- [ ] It meets its acceptance criteria and requirement ID(s).
- [ ] It has been reviewed (at least one other member; CI green before merge).
- [ ] Tests are written for rules and permissions.
- [ ] An audit-log entry exists wherever required.
- [ ] No sensitive data appears in logs, fixtures or screenshots.
- [ ] Setup or doc changes are documented (README, this file).

---

## 11. Build order (reference)

| Sprint | Weeks | Scope (requirement IDs) |
|---|---|---|
| Foundation (P2) | W3-4 | Supabase/Vercel projects, scaffold, CI, first migrations + RLS baseline, login-to-DB walking skeleton, allowlist flag (off) |
| Sprint 1 | W5-6 | FR-AUTH-01 to 08, 10, 11; FR-LOG-01/02; FR-SET-01; app shell |
| Sprint 2 | W7-8 | FR-CLI-01 to 07, 10; FR-ATY-01 to 03 |
| Sprint 3 | W9-10 | FR-APT-01 to 07; FR-TSK-01 to 05 |
| Sprint 4 | W11-12 | FR-DASH-01 to 07; FR-CLI-08/09/11/12; FR-EXP-01 to 04; FR-QUE-01 to 04; FR-SET-02/03; FR-LOG-03 |
| Hardening (P5) | W12-13 | FR-BKP-01 to 07; security checklist; load test; runbook |

**MVP cut line (cut in this order if time runs short):** queue display, calendar view, offsite backup copy, duplicate/conflict warnings, configurable settings, log CSV export.
**Never cut:** login and roles, MFA and lockout, client/attorney records with search, appointments, deadlines, dashboard, export to text, activity log, encrypted backup and restore drill.

---

## 12. Out of scope for v1

Do not build these, even if they seem helpful:
- Digital document or case-file scanning/storage (so no Supabase Storage uploads)
- Clinical content: test results, session notes, diagnoses (the Add Note dialog must warn users not to type clinical details)
- Billing, payments, payroll, inventory
- Patient portal, SMS/email notifications, native mobile apps, court-system integration
- Officially supported remote-access features

---

## 13. Backup and recovery (for scripts in `/scripts`)

- Production is currently on a **free** Supabase plan pending HLT commitment (see DEV-01 in Section 15). Target: upgrade to a paid plan before go-live (M7) to enable automated daily backups and PITR.
- Local export: `supabase db dump`, encrypted with `age` (or GPG, AES-256), written to the clinic's external drive, at least weekly (target nightly).
- Retention: 7 daily, 4 weekly, 12 monthly. Record a checksum and verify integrity after every run. Write the last-success time to `backup_runs`.
- The encryption key is **never** stored on the backup drive.
- Restore drill: restore into a fresh staging Supabase project, sign in, spot-check records. Run before go-live and quarterly.

---

## 14. Working agreement for the AI agent

1. **Read before writing.** Check the relevant SARD requirement ID and this file before starting a task.
2. **Confirm before building.** For anything beyond a small, clearly scoped change (new tables, schema or RLS changes, new dependencies, new routes, deviations from this file), summarize your plan and wait for approval.
3. **Don't invent requirements.** If something is unspecified (for example, open questions Q-03, Q-04, Q-13 to Q-15), use the documented default, say so, and flag it.
4. **Flag conflicts.** If code, the SARD and this file disagree, stop and ask.
5. **Security first.** When in doubt between convenience and security, choose security, and mention the trade-off.
6. **Keep changes minimal and reversible.** Prefer small PRs with tests; never rewrite unrelated code.
7. **Never touch production** data, projects or keys. All work targets development or staging with fake data.
8. **Update docs.** If you change setup, commands, schema or conventions, update README and this file in the same PR.

---

## 15. Deviations and assumptions

These are known, documented departures from the SARD. Each must be re-evaluated at the trigger noted.

| ID | Deviation | Reason | Impact | Upgrade trigger |
|---|---|---|---|---|
| DEV-01 | Two Supabase environments instead of three (local + one free-tier cloud project) | Free tier limit; HLT not yet committed to production | No true cloud staging; manual backups only; project may pause after ~1 week of inactivity; no PITR | HLT commits to production use — raise at M5 and M7 |

**DEV-01 detail — Two Supabase projects (free tier interim)**

- **Development and testing:** local Supabase via `supabase start` (Docker). No cloud project slot used. Run all migrations and seeds here first.
- **Production:** one free-tier Supabase cloud project. Fake data only until NFR-SEC-08 and the go-live gate (M7) are signed off.
- **Backups on free tier:** no automated downloadable backups. Use manual CLI dumps instead:
  ```bash
  supabase db dump --db-url "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" -f backup.sql
  ```
  Encrypt with `age`, store on external drive, record checksum. Run before every significant migration or change at minimum.
- **Free tier risks to monitor:** project pauses after ~1 week of inactivity; no PITR; no vendor-side downloadable backup copies.
- **No real client data** in any environment until the paid plan is in place and the Phase 5 security checklist (NFR-SEC-08) is signed off.

---

*Last aligned with SARD v1.2 (Draft), Oct 2, 2026. Updated Oct 7, 2026 (DEV-01: two-project setup, free tier interim). Re-check vendor limits (Vercel, Supabase plans, Network Restrictions, backup retention) at setup time; they change.*
