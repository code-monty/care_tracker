-- CareTracker: profiles + activity_log foundation
-- AGENTS.md Section 5 (RLS on every table, default deny) and Section 7 (BR-07, BR-08)

-- =============================================================================
-- profiles
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per Supabase Auth user. role/status gate access via RLS. '
  'BR-08: accounts are deactivated (status), never deleted.';

-- keep updated_at current on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- auto-create a Pending/Staff profile row for every new Auth user.
-- AGENTS.md Section 6: accounts are Admin-created only; if a "Request
-- access" / sign-up path is ever left reachable, this trigger ensures the
-- resulting account still starts Pending and RLS blocks it from all data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, status)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'staff', 'pending');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- SECURITY DEFINER helper so admin-check queries don't recurse through
-- profiles' own RLS policies.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = uid
      and role = 'admin'
      and status = 'active'
  );
$$;

-- a user can always read their own row (including while Pending/Disabled,
-- so the app can show the awaiting-approval / disabled screen)
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Admins can read every profile
create policy "profiles_select_admin_all"
on public.profiles for select
to authenticated
using (public.is_admin(auth.uid()));

-- a user can update their own row (full_name only — see guard trigger below)
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Admins can update any profile (role, status, full_name)
create policy "profiles_update_admin_all"
on public.profiles for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- no delete policy for anyone: BR-08, accounts are deactivated, never deleted

-- RLS's own USING/WITH CHECK clauses can't express "this column may not
-- change unless admin" cleanly, so a guard trigger enforces it: a non-admin
-- updating their own row cannot change role or status, even though the
-- UPDATE policy above would otherwise allow the row-level write.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for superuser/service-role connections (migrations,
  -- seeds, the admin service-role client, pgTAP fixture setup) — none of
  -- those are "a non-admin end user editing their own row," so the guard
  -- only applies when there IS an authenticated, non-admin actor.
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only Admins can change role or status';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_role_escalation
before update on public.profiles
for each row
execute function public.prevent_self_role_escalation();

-- =============================================================================
-- activity_log
-- =============================================================================

create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz(3) not null default now()
);

comment on table public.activity_log is
  'Append-only audit trail (BR-07). Never copies sensitive field values. '
  'Rows are inserted only via log_activity(); UPDATE/DELETE are revoked '
  'from every role, including admin.';

alter table public.activity_log enable row level security;

-- Admin-only read (AGENTS.md Section 6: Staff cannot view Activity Logs)
create policy "activity_log_select_admin"
on public.activity_log for select
to authenticated
using (public.is_admin(auth.uid()));

-- Belt-and-suspenders: revoke write privileges outright at the grant
-- level, not just via RLS, so append-only holds even if a future policy
-- bug is introduced. Inserts happen only through the SECURITY DEFINER
-- function below, which runs as the table owner.
revoke insert, update, delete on public.activity_log from authenticated, anon;

create or replace function public.log_activity(
  p_actor_id uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (actor_id, action, entity_type, entity_id)
  values (p_actor_id, p_action, p_entity_type, p_entity_id);
end;
$$;

comment on function public.log_activity is
  'Called by triggers on other tables (clients, appointments, etc., added '
  'in later migrations) to write an audit-log row. Never called directly '
  'from application code, so the UI cannot skip or falsify an entry.';
