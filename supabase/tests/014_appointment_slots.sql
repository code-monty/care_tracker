begin;
select plan(9);

insert into auth.users(id,email) values ('a1000000-0000-0000-0000-000000000001','slot-admin@example.test');
update public.profiles set role='secretary',status='active' where id='a1000000-0000-0000-0000-000000000001';
select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select lives_ok($$insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Slot A','2026-11-20T10:00:00+08:00','Test','a1000000-0000-0000-0000-000000000001')$$,'first booking succeeds');
select throws_ok($$insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Slot B','2026-11-20T10:00:00+08:00','Test','a1000000-0000-0000-0000-000000000001')$$,'23P01','Appointment time is no longer available.','same slot is unavailable');
select lives_ok($$insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Slot C','2026-11-20T11:00:00+08:00','Test','a1000000-0000-0000-0000-000000000001')$$,'adjacent slot succeeds');
select throws_ok($$update public.appointments set scheduled_at='2026-11-20T10:00:00+08:00' where guest_name='Slot C'$$,'23P01','Appointment time is no longer available.','reschedule cannot overlap');
select lives_ok($$update public.appointments set status='cancelled' where guest_name='Slot A'$$,'cancellation frees slot');
select lives_ok($$update public.appointments set scheduled_at='2026-11-20T10:00:00+08:00' where guest_name='Slot C'$$,'freed slot can be used');
select throws_ok($$insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Off grid','2026-11-21T10:30:00+08:00','Test','a1000000-0000-0000-0000-000000000001')$$,'22023','Choose an available one-hour appointment slot.','new booking must use a slot');

set local role postgres;
alter table public.appointments disable trigger appointments_slot_guard;
insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Legacy time','2026-11-21T10:30:00+08:00','Test','a1000000-0000-0000-0000-000000000001');
alter table public.appointments enable trigger appointments_slot_guard;
set local role authenticated;
select lives_ok($$update public.appointments set reason='Updated' where guest_name='Legacy time'$$,'existing off-slot time survives non-time edits');
select throws_ok($$insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Over legacy','2026-11-21T11:00:00+08:00','Test','a1000000-0000-0000-0000-000000000001')$$,'23P01','Appointment time is no longer available.','legacy booking blocks overlapping slot');

select * from finish();
rollback;
