alter table public.appointments alter column client_id drop not null;
alter table public.appointments add column guest_name text;
alter table public.appointments add constraint appointments_client_or_guest_check check (
  (client_id is not null and guest_name is null)
  or (client_id is null and guest_name is not null and length(trim(guest_name)) between 1 and 120)
);
