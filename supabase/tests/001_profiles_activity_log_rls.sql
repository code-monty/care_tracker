-- pgTAP tests for profiles + activity_log RLS (AGENTS.md Section 10:
-- release-blocking — must prove anonymous/pending read nothing and Staff
-- cannot reach Admin-only data).
--
-- Run with: supabase test db

begin;
select plan(15);

-- ---------------------------------------------------------------------------
-- fixtures: four fake Auth users, never real client data (AGENTS.md Sec. 8)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'staff-active@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'staff-pending@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'staff-other@example.test');

-- the on_auth_user_created trigger already inserted matching profiles rows
-- (role='staff', status='pending'); promote/adjust them for the test cases
update public.profiles set role = 'admin', status = 'active'
  where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set role = 'staff', status = 'active'
  where id = '00000000-0000-0000-0000-000000000002';
-- id ...003 stays staff/pending (the default from the trigger)
update public.profiles set role = 'staff', status = 'active'
  where id = '00000000-0000-0000-0000-000000000004';

create schema if not exists tests;

-- authenticate_as()/authenticate_as_anon() below actually switch the
-- session's Postgres role (not just a simulated claim) — that's required
-- for "to authenticated" / "to anon" policies to apply at all. But once
-- the session becomes anon/authenticated, it needs explicit permission to
-- keep calling functions in this schema, since neither role has access to
-- a brand-new schema by default.
grant usage on schema tests to anon, authenticated, service_role;

-- helper: switch the current session to a given Auth user, the way
-- PostgREST/Supabase does via the request.jwt.claims GUC
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
-- anonymous: reads nothing from either table
-- ---------------------------------------------------------------------------

select tests.authenticate_as_anon();

select is(
  (select count(*) from public.profiles)::int, 0,
  'anon reads zero rows from profiles'
);

select is(
  (select count(*) from public.activity_log)::int, 0,
  'anon reads zero rows from activity_log'
);

-- ---------------------------------------------------------------------------
-- pending staff: can see only their own profile row, nothing else
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-000000000003');

select is(
  (select count(*) from public.profiles)::int, 1,
  'pending user sees exactly one profiles row (their own)'
);

select is(
  (select status from public.profiles where id = '00000000-0000-0000-0000-000000000003'),
  'pending',
  'pending user can read their own status'
);

select is(
  (select count(*) from public.activity_log)::int, 0,
  'pending user reads zero rows from activity_log'
);

-- ---------------------------------------------------------------------------
-- active staff: own profile readable/editable; cannot read others or logs;
-- cannot self-promote to admin
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-000000000002');

select is(
  (select count(*) from public.profiles)::int, 1,
  'active staff sees exactly one profiles row (their own)'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Updated Name'
     where id = '00000000-0000-0000-0000-000000000002' $$,
  'active staff can update their own full_name'
);

select throws_ok(
  $$ update public.profiles set role = 'admin'
     where id = '00000000-0000-0000-0000-000000000002' $$,
  'P0001',
  'Only Admins can change role or status',
  'staff cannot self-promote to admin'
);

select is(
  (select count(*) from public.activity_log)::int, 0,
  'staff cannot read activity_log'
);

-- ---------------------------------------------------------------------------
-- admin: reads all profiles and all logs; can change another user's role
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-000000000001');

select cmp_ok(
  (select count(*) from public.profiles)::int, '>=', 4,
  'admin sees all profiles rows'
);

select lives_ok(
  $$ update public.profiles set status = 'active'
     where id = '00000000-0000-0000-0000-000000000003' $$,
  'admin can approve a pending user'
);

select lives_ok(
  $$ select public.log_activity(
       '00000000-0000-0000-0000-000000000001', 'login', null, null
     ) $$,
  'log_activity() succeeds for admin-triggered events'
);

select is(
  (select count(*) from public.activity_log)::int, 1,
  'admin can read activity_log rows'
);

-- ---------------------------------------------------------------------------
-- append-only: nobody, including admin, can UPDATE or DELETE activity_log
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.activity_log set action = 'tampered' $$,
  '42501',
  'permission denied for table activity_log',
  'admin cannot UPDATE activity_log rows (write privilege revoked)'
);

select throws_ok(
  $$ delete from public.activity_log $$,
  '42501',
  'permission denied for table activity_log',
  'admin cannot DELETE activity_log rows (write privilege revoked)'
);

select * from finish();
rollback;
