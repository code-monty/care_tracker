begin;
select plan(9);

insert into auth.users(id,email) values
('90000000-0000-0000-0000-000000000001','guest-admin@example.test'),
('90000000-0000-0000-0000-000000000002','guest-secretary@example.test'),
('90000000-0000-0000-0000-000000000003','guest-staff@example.test');
update public.profiles set role='admin',status='active' where id='90000000-0000-0000-0000-000000000001';
update public.profiles set role='secretary',status='active' where id='90000000-0000-0000-0000-000000000002';
update public.profiles set role='staff',status='active' where id='90000000-0000-0000-0000-000000000003';

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Fake Guest Admin','2026-11-01T10:00:00+08:00','Consultation','90000000-0000-0000-0000-000000000001')$$,'admin can book a guest');
select throws_ok($$insert into public.appointments(scheduled_at,reason,created_by) values ('2026-11-01T10:00:00+08:00','Consultation','90000000-0000-0000-0000-000000000001')$$,'23514','new row for relation "appointments" violates check constraint "appointments_client_or_guest_check"','appointment requires a name or client');
select throws_ok($$insert into public.appointments(client_id,guest_name,scheduled_at,reason,created_by) values ('90000000-0000-0000-0000-000000000001','Fake Both','2026-11-01T10:00:00+08:00','Consultation','90000000-0000-0000-0000-000000000001')$$,'23514','new row for relation "appointments" violates check constraint "appointments_client_or_guest_check"','appointment cannot have both identities');
select lives_ok($$update public.appointments set guest_name='Fake Guest Changed',status='confirmed' where guest_name='Fake Guest Admin'$$,'admin can edit guest');
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Fake Guest Secretary','2026-11-02T10:00:00+08:00','Assessment','90000000-0000-0000-0000-000000000002')$$,'secretary can book a guest');
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.appointments where guest_name like 'Fake Guest%')::int,2,'staff can read guests');
select throws_ok($$insert into public.appointments(guest_name,scheduled_at,reason,created_by) values ('Fake Guest Staff','2026-11-03T10:00:00+08:00','Assessment','90000000-0000-0000-0000-000000000003')$$,'42501','new row violates row-level security policy for table "appointments"','staff cannot book a guest');
select lives_ok($$update public.appointments set status='cancelled' where guest_name='Fake Guest Changed'$$,'staff update affects no rows');
select is((select status from public.appointments where guest_name='Fake Guest Changed'),'confirmed','staff cannot change guest status');

select * from finish();
rollback;
