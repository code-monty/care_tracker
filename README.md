# CareTracker

Client and attorney monitoring system for **HLT Psychological Services**

Full context, architecture rules and conventions live in [`AGENTS.md`](./AGENTS.md). Read it before making changes — this README only covers day-to-day setup and commands.

## Prerequisites

- **Node.js** 22.x
- **pnpm** (version pinned via `packageManager` in `package.json`; `pnpm/action-setup` handles this in CI)
- **Docker Desktop** (or Docker Engine) — required for local Supabase
- **Supabase CLI** (installed automatically via `pnpm install` as a dev dependency)

## First-time setup

```bash
pnpm install                 # install dependencies
cp .env.example .env.local   # fill in LOCAL Supabase values (never production)
supabase start                # start local Supabase (Docker required)
supabase db reset             # apply migrations + fake-data seed locally
pnpm dev                      # run Next.js locally at http://localhost:3000
```

`supabase start` prints a local `API URL`, `anon key`, and `service_role key` the first time it runs. Copy those into `.env.local` — do **not** use the cloud project's keys for local development.

## Environments (interim — SARD v1.3, DEV-01)

This project currently runs **two** Supabase environments, not three, while HLT has not yet committed to a paid plan:

| Environment | Where | Purpose |
|---|---|---|
| Local | `supabase start` (Docker) | All development and testing |
| Cloud (free tier) | One Supabase project (`caretracker-dev`) | Interim production stand-in — **fake data only** |

No real client data goes into either environment until the Phase 5 security checklist (NFR-SEC-08) and the go-live gate (Milestone M7) are signed off. This is re-confirmed at Milestones M5 and M7 — see `AGENTS.md` Section 15 (DEV-01) for details.

## Environment variables

Copy `.env.example` to `.env.local` and fill in values for your **local** Supabase instance (from `supabase start` output):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server only — never exposed to the browser, never committed
ENFORCE_IP_ALLOWLIST           # default "false" (deferred feature flag, see D-01)
CLINIC_ALLOWED_IPS             # comma-separated; used only when the flag above is "true"
QUEUE_TOKEN_SECRET             # signs the rotatable queue-display token
STEP_UP_SECRET                 # signs the step-up-verified session cookie (DEV-02 email-code verification — see AGENTS.md Section 15)
```

Never commit `.env.local` or any file containing real keys. Only `NEXT_PUBLIC_`-prefixed variables may reach the browser.

## Google sign-in setup

Google sign-in is available only for existing, active Admin-created users. In the Supabase Dashboard, disable **Allow new users to sign up** for the cloud project, then enable the Google provider. Create a Google OAuth web client in Google Cloud and enter its client ID and secret into the Supabase Google provider settings. Add the Supabase Auth callback URL shown there to Google's authorized redirect URIs. Add `https://<your-app-host>/auth/callback` (and `http://localhost:3000/auth/callback` for local testing) to Supabase Auth redirect URLs; set the site URL to the matching app origin. Keep the Google secret only in Supabase settings.

For local Supabase, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` outside source control, set `[auth.external.google].enabled = true` in `supabase/config.toml`, and restart the local stack. The local project's `auth.enable_signup = false` prevents new OAuth identities; the callback also verifies the existing profile's ID, email, and active status before starting email-code verification. If Google returns an error, the login page displays a generic message. SMTP must be configured for the subsequent email-code step-up.

Google sign-in requires a real Google OAuth application and provider configuration; automated local checks cannot complete Google's hosted consent flow without those credentials.

## Remember this workstation

On either sign-in method, selecting **Remember this workstation for 1 day** and then successfully entering the email code stores a signed, HttpOnly cookie in that browser. Each remembered account has its own 24-hour expiry, so switching between accounts remembered on the same browser does not replace the earlier account's status. A successful password or Google sign-in for a remembered active user can skip the email code. Sign-out ends the current session but keeps the workstation remembered until its original expiry. An account that has not been remembered, or one with an invalid or expired entry, must verify by email. The remembered cookie does not itself sign anyone in; protected access still uses the separate 10-minute step-up cookie. The documented 10-minute idle timer is not yet fully implemented.

Google sign-in automatically remembers that approved account for 24 hours after its first successful email-code verification, even if the checkbox was not selected. Password sign-in still requires the checkbox to issue a new remembered entry. A remembered account continues to require its normal password or Google sign-in before access.

## Admin user management

Active Admins manage other accounts at `/admin/users`. New accounts become active immediately. Creation and password reset generate a temporary password shown once to the Admin; share it securely before closing the dialog. Existing passwords cannot be retrieved. After sign-in and email-code verification, the user must set a new password before accessing app records. A reset invalidates earlier step-up verification for that account. Admins can also approve pending accounts, edit names and email addresses, change roles, and deactivate or reactivate users. Accounts are never deleted from this page, and the last active Admin is protected. Changing an email stops Google sign-in with the old Google address; password sign-in uses the new email.

## Common commands

```bash
pnpm dev          # run Next.js locally
pnpm lint         # ESLint
pnpm typecheck    # next typegen && tsc --noEmit
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright end-to-end tests
supabase test db  # pgTAP RLS / permission tests (release-blocking in CI)
```

## Dev on LAN (optional)

To open `pnpm dev` from another device on the same network, add that device's host/IP to `allowedDevOrigins` in `next.config.ts`, then restart the dev server. Dev only — never add a production host there.

## Database changes

All schema changes go through Supabase migrations, committed to Git — never hand-edited in the Supabase dashboard.

```bash
supabase migration new <description>   # create a new migration file
supabase db reset                       # re-apply all migrations + seed, locally
supabase test db                        # run pgTAP tests against the reset database
```

Every new table must ship with Row Level Security enabled (default deny) and a corresponding pgTAP test in the same migration PR.

## Manual backups (interim — SARD v1.3)

The cloud project is on Supabase's **free tier**, which has no automated downloadable backups or point-in-time recovery. Until HLT upgrades to a paid plan, backups are manual:

```bash
supabase db dump \
  --db-url "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
  -f backup-$(date +%Y%m%d).sql
```

Then encrypt the dump before it leaves your machine:

```bash
age -p -o backup-$(date +%Y%m%d).sql.age backup-$(date +%Y%m%d).sql
rm backup-$(date +%Y%m%d).sql   # never keep the unencrypted copy around
```

- Store the encrypted `.age` file on the clinic's external drive — never in this repo (see `.gitignore`).
- Target nightly, minimum weekly. Retention: 7 daily, 4 weekly, 12 monthly.
- Record a checksum (e.g. `shasum -a 256 backup-$(date +%Y%m%d).sql.age`) after every run and verify integrity.
- The `age` encryption key is **never** stored on the backup drive itself.
- This manual process is interim only. It is upgraded to vendor-backups + manual dual-layer once Supabase Pro is active (target: before Milestone M7 go-live). See `AGENTS.md` Section 13.

## Deployment

Hosted on **Vercel**, one production deployment per the `main` branch, preview deployments per pull request. Preview and local environments must never point at the cloud project if/when it is holding real data — see the environments table above.

## Contributing

- Keep PRs small and focused; commit messages in imperative mood.
- Before starting any task beyond a small, clearly scoped change, read `AGENTS.md` Section 14 (working agreement) — schema changes, new dependencies, new routes and deviations from that file require explicit approval first.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck and Vitest on every PR. `supabase test db` (pgTAP) is release-blocking and should be run locally before pushing schema changes.
