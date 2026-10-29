-- Personal profile pictures are separate from case documents and system settings.
alter table public.profiles add column avatar_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-pictures', 'profile-pictures', false, 262144, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 262144,
  allowed_mime_types = array['image/webp'];

create policy "profile_pictures_select_own" on storage.objects for select to authenticated
using (bucket_id = 'profile-pictures' and name = auth.uid()::text || '/avatar.webp'
  and public.is_active_user(auth.uid()));
create policy "profile_pictures_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-pictures' and name = auth.uid()::text || '/avatar.webp'
  and public.is_active_user(auth.uid()));
create policy "profile_pictures_update_own" on storage.objects for update to authenticated
using (bucket_id = 'profile-pictures' and name = auth.uid()::text || '/avatar.webp'
  and public.is_active_user(auth.uid()))
with check (bucket_id = 'profile-pictures' and name = auth.uid()::text || '/avatar.webp'
  and public.is_active_user(auth.uid()));

-- Existing profile audit trigger logs the avatar update without storing image content.
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
    elsif new.avatar_updated_at is distinct from old.avatar_updated_at then action_name := 'profile_picture_update';
    else action_name := 'update'; end if;
  end if;
  if new.full_name is distinct from old.full_name or new.email is distinct from old.email
     or new.role is distinct from old.role or new.status is distinct from old.status
     or new.must_change_password is distinct from old.must_change_password
     or new.avatar_updated_at is distinct from old.avatar_updated_at
     or action_name in ('create','email_change','password_reset','password_change') then
    perform public.log_activity(actor, action_name, 'profiles', new.id);
  end if;
  return new;
end; $$;
