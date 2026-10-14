-- pgTAP tests for step_up_codes (DEV-02, AGENTS.md Section 10: release-
-- blocking — must prove default-deny table access and correct behavior at
-- the expiry / attempt-limit / wrong-user boundaries).
--
-- Run with: supabase test db
--
-- Reuses the tests.authenticate_as() / tests.authenticate_as_anon() helpers
-- created in supabase/tests/001_profiles_activity_log_rls.sql (same
-- pgTAP session, same `tests` schema).

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- tests.authenticate_as() / tests.authenticate_as_anon() helpers.
--
-- Each pgTAP test FILE runs in its own begin/rollback transaction, so the
-- `tests` schema created inside 001_profiles_activity_log_rls.sql's
-- transaction is rolled back at the end of that file and does not persist
-- here — this file must (re)create it itself. Identical, idempotent
-- definitions to 001's, so whichever file runs first just wins harmlessly.
-- ---------------------------------------------------------------------------

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
  select set_config('role', 'authenticated', true);
$$;

create or replace function tests.authenticate_as_anon()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'anon', true);
$$;

grant execute on function tests.authenticate_as(uuid) to anon, authenticated, service_role;
grant execute on function tests.authenticate_as_anon() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- fixtures: two fake Auth users, never real client data (AGENTS.md Sec. 8)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000010', 'stepup-a@example.test'),
  ('00000000-0000-0000-0000-000000000011', 'stepup-b@example.test');

update public.profiles set role = 'staff', status = 'active'
  where id = '00000000-0000-0000-0000-000000000010';
update public.profiles set role = 'staff', status = 'active'
  where id = '00000000-0000-0000-0000-000000000011';

-- ---------------------------------------------------------------------------
-- direct table access: default deny for everyone, even authenticated users
-- ---------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok(
  $$ select * from public.step_up_codes $$,
  '42501',
  'permission denied for table step_up_codes',
  'anon cannot select step_up_codes directly'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000010');

select throws_ok(
  $$ select * from public.step_up_codes $$,
  '42501',
  'permission denied for table step_up_codes',
  'authenticated user cannot select step_up_codes directly, even their own rows'
);

select throws_ok(
  $$ insert into public.step_up_codes (user_id, code_hash, expires_at)
     values ('00000000-0000-0000-0000-000000000010', 'x', now()) $$,
  '42501',
  'permission denied for table step_up_codes',
  'authenticated user cannot insert step_up_codes directly'
);

-- ---------------------------------------------------------------------------
-- request_step_up_code: issues one live code, invalidates prior ones,
-- refuses to issue a code for someone else
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.request_step_up_code('00000000-0000-0000-0000-000000000010') $$,
  'user can request their own step-up code'
);

select throws_ok(
  $$ select public.request_step_up_code('00000000-0000-0000-0000-000000000011') $$,
  'P0001',
  'Cannot request a step-up code for another user',
  'user cannot request a step-up code for a different user'
);

-- requesting a second code for the same user must invalidate the first
-- (enforced by the partial unique index + the function's own UPDATE)
select lives_ok(
  $$ select public.request_step_up_code('00000000-0000-0000-0000-000000000010') $$,
  'requesting a second code for the same user succeeds (first is invalidated)'
);

-- ---------------------------------------------------------------------------
-- verify_step_up_code: wrong code increments attempts and fails; cross-user
-- verification is refused
-- ---------------------------------------------------------------------------

select is(
  (select public.verify_step_up_code('00000000-0000-0000-0000-000000000010', '000000')),
  false,
  'an arbitrary wrong code fails verification'
);

select throws_ok(
  $$ select public.verify_step_up_code('00000000-0000-0000-0000-000000000011', '000000') $$,
  'P0001',
  'Cannot verify a step-up code for another user',
  'user cannot verify a step-up code belonging to a different user'
);

-- Switch to the harness's own (superuser) role, which bypasses RLS, purely
-- to read back fixture state; application code never does this. A plain
-- RESET ROLE / cleared claims is safe here because this block only reads
-- the table directly — it never calls into request_step_up_code() or
-- verify_step_up_code(), which rely on auth.uid() being meaningful.
reset role;
select set_config('request.jwt.claims', '', true);

select ok(
  (select count(*) from public.step_up_codes
   where user_id = '00000000-0000-0000-0000-000000000010' and consumed_at is null) = 1,
  'exactly one live code exists for the test user'
);

-- ---------------------------------------------------------------------------
-- attempt limit: exhaust the remaining attempts (1 wrong attempt already
-- made above) to hit the 5-attempt cap, then confirm a correct code still
-- fails once the cap is reached. Each verify_step_up_code() call is wrapped
-- in a DO block (not a bare SELECT) so its result never prints into the TAP
-- output stream.
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-000000000010');

do $$
begin
  perform public.verify_step_up_code('00000000-0000-0000-0000-000000000010', '000000');
  perform public.verify_step_up_code('00000000-0000-0000-0000-000000000010', '000000');
  perform public.verify_step_up_code('00000000-0000-0000-0000-000000000010', '000000');
  perform public.verify_step_up_code('00000000-0000-0000-0000-000000000010', '000000');
end;
$$;
-- attempt_count is now 5 (1 earlier + 4 here)

select is(
  (select public.verify_step_up_code('00000000-0000-0000-0000-000000000010', '000000')),
  false,
  'verification is refused once attempt_count reaches 5, even before checking the code'
);

-- ---------------------------------------------------------------------------
-- expiry: a code past expires_at never verifies, even with the right value.
-- request_step_up_code() is called while properly authenticated as the
-- target user (auth.uid() must resolve); the row is then back-dated as the
-- harness role, which only touches the table directly.
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-000000000011');

select lives_ok(
  $$ select public.request_step_up_code('00000000-0000-0000-0000-000000000011') $$,
  'fresh code requested for the second test user (clean attempt_count)'
);

reset role;
select set_config('request.jwt.claims', '', true);

update public.step_up_codes
set expires_at = now() - interval '1 minute'
where user_id = '00000000-0000-0000-0000-000000000011'
  and consumed_at is null;

select tests.authenticate_as('00000000-0000-0000-0000-000000000011');

select is(
  (select public.verify_step_up_code('00000000-0000-0000-0000-000000000011', '000000')),
  false,
  'an expired code fails verification regardless of the value supplied'
);

select * from finish();
rollback;