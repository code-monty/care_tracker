begin;
select plan(17);

insert into auth.users(id,email) values
('91000000-0000-0000-0000-000000000001','notes-admin@example.test'),
('91000000-0000-0000-0000-000000000002','notes-secretary@example.test'),
('91000000-0000-0000-0000-000000000003','notes-staff@example.test'),
('91000000-0000-0000-0000-000000000004','notes-disabled@example.test');
update public.profiles set full_name='Fake Notes Admin',role='admin',status='active' where id='91000000-0000-0000-0000-000000000001';
update public.profiles set full_name='Fake Notes Secretary',role='secretary',status='active' where id='91000000-0000-0000-0000-000000000002';
update public.profiles set full_name='Fake Notes Staff',role='staff',status='active' where id='91000000-0000-0000-0000-000000000003';
update public.profiles set role='staff',status='disabled' where id='91000000-0000-0000-0000-000000000004';
insert into public.attorneys(id,full_name,contact_no,email) values ('92000000-0000-0000-0000-000000000001','Fake Notes Lawyer','0912-345-6789','notes-lawyer@example.test');
insert into public.clients(id,full_name,birthdate,contact_no,email,address,attorney_id,created_by) values ('93000000-0000-0000-0000-000000000001','Fake Notes Client','1990-01-01','0912-345-6789','notes-client@example.test','Fake address','92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$insert into public.notes(client_id,body,author_id,author_name,author_role,created_at) values ('93000000-0000-0000-0000-000000000001',' Fake admin note ','91000000-0000-0000-0000-000000000003','Forged','staff','2000-01-01')$$,'Admin can add client note');
select is((select author_name from public.notes where body='Fake admin note'),'Fake Notes Admin','Name is server assigned');
select is((select author_role from public.notes where body='Fake admin note'),'admin','Role is server assigned');
select is((select author_id from public.notes where body='Fake admin note'),'91000000-0000-0000-0000-000000000001'::uuid,'Author ID is server assigned');
select ok((select created_at > now() - interval '1 minute' from public.notes where body='Fake admin note'),'Timestamp is server assigned');
select is((select count(*) from public.activity_log where entity_type='notes' and action='create' and entity_id=(select id from public.notes where body='Fake admin note'))::int,1,'Note creation logs metadata');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$insert into public.notes(attorney_id,body,author_id,author_name,author_role) values ('92000000-0000-0000-0000-000000000001','Fake secretary note','91000000-0000-0000-0000-000000000002','','staff')$$,'Secretary can add attorney note');
select is((select author_role from public.notes where body='Fake secretary note'),'secretary','Secretary role is saved');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$insert into public.notes(client_id,body,author_id,author_name,author_role) values ('93000000-0000-0000-0000-000000000001','Fake staff note','91000000-0000-0000-0000-000000000003','','staff')$$,'Staff can add client note');
select is((select count(*) from public.notes where client_id='93000000-0000-0000-0000-000000000001')::int,2,'Client notes stay on client');
select is((select count(*) from public.notes where attorney_id='92000000-0000-0000-0000-000000000001')::int,1,'Attorney notes stay on attorney');
select throws_ok($$update public.notes set body='Changed' where body='Fake staff note'$$,'42501',null,'Notes cannot be updated');
select throws_ok($$delete from public.notes where body='Fake staff note'$$,'42501',null,'Notes cannot be deleted');
select throws_ok($$insert into public.notes(client_id,attorney_id,body,author_id,author_name,author_role) values ('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','Both','91000000-0000-0000-0000-000000000003','','staff')$$,'23514',null,'A note belongs to one record');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.notes)::int,0,'Disabled user cannot read notes');
select throws_ok($$insert into public.notes(client_id,body,author_id,author_name,author_role) values ('93000000-0000-0000-0000-000000000001','Denied','91000000-0000-0000-0000-000000000004','','staff')$$,'P0001','Access denied','Disabled user cannot add notes');
select set_config('role','anon',true);
select throws_ok($$select * from public.notes$$,'42501',null,'Anonymous user cannot read notes');

select * from finish();
rollback;
