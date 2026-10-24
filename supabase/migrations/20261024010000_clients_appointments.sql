-- Client and appointment records. All access is denied unless the actor has an active profile.
create or replace function public.is_active_user(uid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.profiles where id = uid and status = 'active' and role in ('admin','staff'));
$$;

create table public.attorneys (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  contact_no text not null check (contact_no ~ '^09[0-9]{2}-?[0-9]{3}-?[0-9]{4}$'),
  email text not null check (position('@' in email) > 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  birthdate date not null check (birthdate <= current_date),
  contact_no text not null check (contact_no ~ '^09[0-9]{2}-?[0-9]{3}-?[0-9]{4}$'),
  email text not null check (position('@' in email) > 1),
  address text not null check (length(trim(address)) > 0),
  attorney_id uuid not null references public.attorneys(id),
  status text not null default 'active' check (status in ('active','inactive')),
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index clients_identity_unique on public.clients (lower(trim(full_name)), birthdate) where not is_archived;
create index clients_attorney_idx on public.clients(attorney_id);
create table public.respondents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  birthdate date not null check (birthdate <= current_date),
  contact_no text not null check (contact_no ~ '^09[0-9]{2}-?[0-9]{3}-?[0-9]{4}$'),
  email text not null check (position('@' in email) > 1),
  address text not null check (length(trim(address)) > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  scheduled_at timestamptz not null,
  reason text not null check (length(trim(reason)) between 1 and 100),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index appointments_scheduled_idx on public.appointments(scheduled_at);
create index appointments_client_idx on public.appointments(client_id);

do $$ declare t text; begin
  foreach t in array array['attorneys','clients','respondents','appointments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user(auth.uid()))', t || '_read_active', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_active_user(auth.uid()))', t || '_insert_active', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_active_user(auth.uid())) with check (public.is_active_user(auth.uid()))', t || '_update_active', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Only Admin may change archive state; clients are never deleted.
create function public.guard_client_archive() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_archived is distinct from old.is_archived and auth.uid() is not null and not public.is_admin(auth.uid()) then
    raise exception 'Only Admin may archive or restore clients';
  end if;
  return new;
end; $$;
create trigger clients_archive_guard before update on public.clients for each row execute function public.guard_client_archive();

-- Claims on new records must match the authenticated actor.
create function public.guard_record_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'Invalid record owner';
  end if;
  return new;
end; $$;
create trigger clients_owner_guard before insert on public.clients for each row execute function public.guard_record_owner();
create trigger appointments_owner_guard before insert on public.appointments for each row execute function public.guard_record_owner();

-- Audit metadata only; sensitive record values never enter activity_log.
create function public.audit_record_change() returns trigger language plpgsql security definer set search_path = public as $$
declare record_id uuid; actor uuid; verb text;
begin
  record_id := coalesce(new.id, old.id);
  actor := auth.uid();
  if actor is null then return coalesce(new,old); end if;
  verb := case when TG_OP = 'INSERT' then 'create' when TG_TABLE_NAME = 'clients' and new.is_archived is distinct from old.is_archived then case when new.is_archived then 'archive' else 'restore' end when TG_TABLE_NAME = 'appointments' and new.status is distinct from old.status then 'status_change' else 'update' end;
  perform public.log_activity(actor, verb, TG_TABLE_NAME, record_id);
  return coalesce(new,old);
end; $$;
do $$ declare t text; begin
  foreach t in array array['attorneys','clients','respondents','appointments'] loop
    execute format('create trigger %I after insert or update on public.%I for each row execute function public.audit_record_change()', t || '_audit', t);
  end loop;
end $$;
