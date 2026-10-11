-- CareTracker: per-account login lockout (AGENTS.md Section 8)
-- Adds profiles.email (denormalized) + failed_login_attempts + locked_until.

alter table public.profiles
  add column email text,
  add column failed_login_attempts integer not null default 0,
  add column locked_until timestamptz;

comment on column public.profiles.email is
  'Denormalized copy of auth.users.email (lowercased), kept in sync by '
  'handle_new_user() on insert. auth.users is not exposed via the API '
  '(only public/graphql_public schemas are, per supabase/config.toml), so '
  'this lets the login Server Action look up a profile by email before a '
  'session exists — needed for the lockout pre-check.';

comment on column public.profiles.failed_login_attempts is
  'Consecutive failed sign-in attempts. Reset to 0 on a successful sign-in '
  'or once locked_until is set. Written only by the login Server Action '
  'via the service-role client (lib/auth/sign-in.ts) — never by the user.';

comment on column public.profiles.locked_until is
  'If set and in the future, sign-in is blocked regardless of password '
  'correctness. AGENTS.md Section 8: lock out after 5 failed attempts.';

create index profiles_email_idx on public.profiles (email);

-- Backfill existing rows. No production data exists yet (AGENTS.md
-- Section 8: fake data only until NFR-SEC-08 is signed off), so this only
-- affects local/dev fixture rows.
update public.profiles p
set email = lower(u.email)
from auth.users u
where p.id = u.id
  and p.email is null;

-- Keep profiles.email populated for every future signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, lower(new.email), new.raw_user_meta_data ->> 'full_name', 'staff', 'pending');
  return new;
end;
$$;

-- Broaden the existing self-escalation guard (PR3): failed_login_attempts
-- and locked_until are system-managed, written only by the service-role
-- login action, never editable by the user themselves — same principle
-- as role/status.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.failed_login_attempts is distinct from old.failed_login_attempts
       or new.locked_until is distinct from old.locked_until
    then
      raise exception 'Only Admins can change role, status, or login-security fields';
    end if;
  end if;
  return new;
end;
$$;
