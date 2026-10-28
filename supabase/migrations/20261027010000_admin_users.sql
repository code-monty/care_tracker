-- Admin-managed users and one-time temporary passwords.
alter table public.profiles
  add column must_change_password boolean not null default false,
  add column credential_reset_at timestamptz;

-- Auth owns the email. Keep the login lookup and step-up destination aligned.
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end; $$;
create trigger auth_user_email_sync after update of email on auth.users
for each row execute function public.sync_profile_email();

-- Neither Staff nor Admin may clear the forced-change flag through the Data API.
create or replace function public.prevent_self_role_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.email is distinct from old.email
       or new.must_change_password is distinct from old.must_change_password
       or new.credential_reset_at is distinct from old.credential_reset_at then
      raise exception 'Account security fields are system-managed';
    end if;
    if not public.is_admin(auth.uid()) and (
       new.role is distinct from old.role or new.status is distinct from old.status
       or new.failed_login_attempts is distinct from old.failed_login_attempts
       or new.locked_until is distinct from old.locked_until) then
      raise exception 'Only Admins can change role, status, or login-security fields';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.protect_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active') then
    perform pg_advisory_xact_lock(714219, 1);
    if (select count(*) from public.profiles where role = 'admin' and status = 'active') <= 1 then
      raise exception 'The last active Admin cannot be changed';
    end if;
  end if;
  return new;
end; $$;
create trigger profiles_protect_last_admin before update on public.profiles
for each row execute function public.protect_last_admin();

-- Service-role-only entry point. The actor is checked again in the database;
-- the trigger below writes metadata-only audit rows in the same transaction.
create or replace function public.admin_set_profile(
  p_actor uuid, p_target uuid, p_full_name text, p_role text, p_status text,
  p_force_password_change boolean default null, p_action text default 'update'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_actor) then raise exception 'Admin required'; end if;
  if p_actor = p_target then raise exception 'Manage another user'; end if;
  if p_action not in ('create','update','email_change','approve','role_change','deactivate','reactivate','password_reset') then
    raise exception 'Invalid account action';
  end if;
  perform set_config('caretracker.actor_id', p_actor::text, true);
  perform set_config('caretracker.action', p_action, true);
  update public.profiles set full_name = p_full_name, role = p_role, status = p_status,
    must_change_password = coalesce(p_force_password_change, must_change_password),
    credential_reset_at = case when p_force_password_change = true then now() else credential_reset_at end
  where id = p_target;
  if not found then raise exception 'Account not found'; end if;
end; $$;
revoke all on function public.admin_set_profile(uuid,uuid,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.admin_set_profile(uuid,uuid,text,text,text,boolean,text) to service_role;

create or replace function public.complete_temporary_password(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('caretracker.actor_id', p_user::text, true);
  perform set_config('caretracker.action', 'password_change', true);
  update public.profiles set must_change_password = false where id = p_user and status = 'active';
  if not found then raise exception 'Active account required'; end if;
end; $$;
revoke all on function public.complete_temporary_password(uuid) from public, anon, authenticated;
grant execute on function public.complete_temporary_password(uuid) to service_role;

create or replace function public.audit_profile_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid; action_name text;
begin
  actor := coalesce(auth.uid(), nullif(current_setting('caretracker.actor_id', true), '')::uuid);
  if actor is null then return new; end if;
  action_name := nullif(current_setting('caretracker.action', true), '');
  if action_name is null then
    if new.role is distinct from old.role then action_name := 'role_change';
    elsif new.status is distinct from old.status then action_name := 'status_change';
    else action_name := 'update'; end if;
  end if;
  if new.full_name is distinct from old.full_name or new.email is distinct from old.email
     or new.role is distinct from old.role or new.status is distinct from old.status
     or new.must_change_password is distinct from old.must_change_password
     or action_name in ('create','email_change','password_reset','password_change') then
    perform public.log_activity(actor, action_name, 'profiles', new.id);
  end if;
  return new;
end; $$;
create trigger profiles_audit after update on public.profiles
for each row execute function public.audit_profile_change();
