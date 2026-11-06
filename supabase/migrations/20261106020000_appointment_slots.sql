-- New and rescheduled appointments use hourly Manila slots. Existing off-slot
-- appointments retain their times until rescheduled.
create function public.guard_appointment_slot() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  manila_time timestamp;
begin
  if tg_op = 'UPDATE' and new.scheduled_at = old.scheduled_at and
     (old.status <> 'cancelled' or new.status = 'cancelled') then
    return new;
  end if;

  if tg_op = 'INSERT' or new.scheduled_at is distinct from old.scheduled_at then
    manila_time := new.scheduled_at at time zone 'Asia/Manila';
    if extract(hour from manila_time) not between 8 and 16 or
       extract(minute from manila_time) <> 0 or
       extract(second from manila_time) <> 0 then
      raise exception 'Choose an available one-hour appointment slot.' using errcode = '22023';
    end if;
  end if;

  if new.status <> 'cancelled' then
    -- Serialize booking attempts for this Manila date before reading occupancy.
    perform pg_advisory_xact_lock(hashtextextended((new.scheduled_at at time zone 'Asia/Manila')::date::text, 20261106));
    if exists (
      select 1 from public.appointments a
      where a.id <> new.id and a.status <> 'cancelled'
        and a.scheduled_at < new.scheduled_at + interval '1 hour'
        and a.scheduled_at + interval '1 hour' > new.scheduled_at
    ) then
      raise exception 'Appointment time is no longer available.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

create trigger appointments_slot_guard before insert or update on public.appointments
for each row execute function public.guard_appointment_slot();
