-- Existing under-one birthdates remain editable until their birthdate changes.
create function public.guard_person_minimum_age() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if extract(year from age((now() at time zone 'Asia/Manila')::date, new.birthdate)) < 1 then
      raise exception 'Age must be at least 1 year old';
    end if;
  elsif new.birthdate is distinct from old.birthdate then
    if extract(year from age((now() at time zone 'Asia/Manila')::date, new.birthdate)) < 1 then
      raise exception 'Age must be at least 1 year old';
    end if;
  end if;
  return new;
end; $$;

create trigger clients_minimum_age_guard before insert or update of birthdate on public.clients
for each row execute function public.guard_person_minimum_age();
create trigger respondents_minimum_age_guard before insert or update of birthdate on public.respondents
for each row execute function public.guard_person_minimum_age();
