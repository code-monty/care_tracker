-- CareTracker: email-code step-up verification (DEV-02, AGENTS.md Section 8/15)
-- Adds step_up_codes + the two SECURITY DEFINER functions that generate and
-- verify a 6-digit code emailed after password sign-in, for ALL users
-- (Admin and Staff), replacing the SARD's TOTP-MFA-for-Admins spec per the
-- documented deviation.

create table public.step_up_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempt_count int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.step_up_codes is
  'DEV-02: one-time 6-digit email codes for step-up verification, required '
  'for every user after password sign-in before the session is treated as '
  'fully verified (see lib/auth/step-up.ts for the signed session cookie). '
  'Never stores the raw code, only a bcrypt hash via pgcrypto. Written and '
  'read only through request_step_up_code()/verify_step_up_code() below; '
  'RLS default-denies all direct table access, including to authenticated '
  'users, matching the activity_log pattern (migration '
  '20261008010000_profiles_and_activity_log.sql).';

comment on column public.step_up_codes.code_hash is
  'bcrypt hash (pgcrypto crypt()/gen_salt(''bf'')) of the 6-digit code. The '
  'raw code is returned once by request_step_up_code() to its caller (a '
  'Server Action) for emailing, and is never persisted anywhere.';

comment on column public.step_up_codes.expires_at is
  'AGENTS.md Section 8: codes expire after a short window (10 minutes).';

comment on column public.step_up_codes.attempt_count is
  'Per-code wrong-guess counter. verify_step_up_code() refuses to check the '
  'code at all once this reaches 5, mirroring the login lockout threshold '
  'in lib/rules/lockout.ts, to prevent brute-forcing a 6-digit code.';

create index step_up_codes_user_id_idx on public.step_up_codes (user_id);

-- Only one live (unconsumed) code should exist per user at a time; both
-- functions below maintain this invariant, but the partial unique index
-- makes it a hard DB-level guarantee rather than an application convention.
create unique index step_up_codes_one_live_per_user_idx
  on public.step_up_codes (user_id)
  where consumed_at is null;

alter table public.step_up_codes enable row level security;

-- No policies at all: default deny for anon and authenticated alike. Belt-
-- and-suspenders, as with activity_log: revoke table privileges outright so
-- this holds even if a policy is mistakenly added later. All access goes
-- through the SECURITY DEFINER functions below, which run as the table
-- owner and bypass RLS by design.
revoke all on public.step_up_codes from anon, authenticated;

create or replace function public.request_step_up_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
begin
  -- Only an authenticated session for THIS user (or the service role, with
  -- auth.uid() null) may request a code for themselves. A Server Action
  -- must always pass the caller's own id; this check stops a signed-in user
  -- from ever requesting a code for someone else's account even if a bug
  -- elsewhere passed the wrong id.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Cannot request a step-up code for another user';
  end if;

  -- Invalidate any prior unconsumed code for this user before issuing a new
  -- one, so only the most recently emailed code can ever verify.
  update public.step_up_codes
  set consumed_at = now()
  where user_id = p_user_id
    and consumed_at is null;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.step_up_codes (user_id, code_hash, expires_at)
  values (p_user_id, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes');

  -- Raw code returned ONLY to the calling Server Action for emailing.
  -- Never logged (AGENTS.md Section 8) and never stored anywhere else.
  return v_code;
end;
$$;

comment on function public.request_step_up_code is
  'Generates and stores a hashed 6-digit step-up code for p_user_id, '
  'invalidating any prior unconsumed code first, and returns the RAW code '
  'to the caller to email. Caller (lib/auth/request-step-up.ts) must never '
  'log or persist the return value itself.';

create or replace function public.verify_step_up_code(p_user_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.step_up_codes;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Cannot verify a step-up code for another user';
  end if;

  select *
  into v_row
  from public.step_up_codes
  where user_id = p_user_id
    and consumed_at is null
  order by created_at desc
  limit 1;

  -- No live code, expired, or already past the attempt limit: refuse
  -- outright without even comparing the hash.
  if v_row is null or v_row.expires_at < now() or v_row.attempt_count >= 5 then
    return false;
  end if;

  if v_row.code_hash = crypt(p_code, v_row.code_hash) then
    update public.step_up_codes
    set consumed_at = now()
    where id = v_row.id;
    return true;
  else
    update public.step_up_codes
    set attempt_count = attempt_count + 1
    where id = v_row.id;
    return false;
  end if;
end;
$$;

comment on function public.verify_step_up_code is
  'Checks p_code against the most recent unconsumed step-up code for '
  'p_user_id. Returns false (never an error) for: no live code, expired '
  'code, 5+ prior wrong attempts, or a wrong code — callers must show a '
  'single generic error message regardless of which case applied, per '
  'AGENTS.md Section 8''s "never reveal why" login-error philosophy. On a '
  'correct code, marks it consumed and returns true; the caller is '
  'responsible for then setting the signed step-up session cookie.';

grant execute on function public.request_step_up_code(uuid) to authenticated;
grant execute on function public.verify_step_up_code(uuid, text) to authenticated;
