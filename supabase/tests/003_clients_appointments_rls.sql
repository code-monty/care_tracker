begin;
select plan(12);

insert into auth.users(id,email) values
('10000000-0000-0000-0000-000000000001','records-admin@example.test'),
('10000000-0000-0000-0000-000000000002','records-staff@example.test'),
('10000000-0000-0000-0000-000000000003','records-pending@example.test'),
('10000000-0000-0000-0000-000000000004','records-disabled@example.test');
update public.profiles set role='admin', status='active' where id='10000000-0000-0000-0000-000000000001';
update public.profiles set role='staff', status='active' where id='10000000-0000-0000-0000-000000000002';
update public.profiles set role='staff', status='disabled' where id='10000000-0000-0000-0000-000000000004';

insert into public.attorneys(id,full_name,contact_no,email) values ('20000000-0000-0000-0000-000000000001','Fake Lawyer','0912-345-6789','lawyer@example.test');
insert into public.clients(id,full_name,birthdate,contact_no,email,address,attorney_id,created_by) values ('30000000-0000-0000-0000-000000000001','Fake Client','1990-01-01','0912-345-6789','client@example.test','Fake address','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.respondents(client_id,full_name,birthdate,contact_no,email,address) values ('30000000-0000-0000-0000-000000000001','Fake Respondent','1991-01-01','0912-345-6789','respondent@example.test','Fake address');
insert into public.appointments(client_id,scheduled_at,reason,created_by) values ('30000000-0000-0000-0000-000000000001','2026-11-01T10:00:00+08:00','Assessment','10000000-0000-0000-0000-000000000001');

select set_config('role','anon',true);
select is((select count(*) from public.clients)::int,0,'anon cannot read clients');
select is((select count(*) from public.appointments)::int,0,'anon cannot read appointments');
select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.clients)::int,0,'pending cannot read clients');
select is((select count(*) from public.appointments)::int,0,'pending cannot read appointments');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.clients)::int,0,'disabled cannot read clients');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.clients)::int,1,'active staff can read clients');
select is((select count(*) from public.appointments)::int,1,'active staff can read appointments');
select lives_ok($$select public.create_client_record('{"petitionerName":"Fake Added","petitionerBirthdate":"1990-02-01","petitionerContact":"0912-345-6789","petitionerEmail":"added@example.test","petitionerAddress":"Fake address","respondentName":"Fake Respondent Two","respondentBirthdate":"1991-02-01","respondentContact":"0912-345-6789","respondentEmail":"respondent-two@example.test","respondentAddress":"Fake address"}'::jsonb,'20000000-0000-0000-0000-000000000001')$$,'staff can create client with existing attorney');
select is((select count(*) from public.clients)::int,2,'created client is visible to staff');
select throws_ok($$update public.clients set is_archived=true where id='30000000-0000-0000-0000-000000000001'$$,'Only Admin may archive or restore clients','staff cannot archive');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.clients)::int,2,'admin can read clients');
select lives_ok($$update public.clients set is_archived=true where id='30000000-0000-0000-0000-000000000001'$$,'admin can archive');

select * from finish();
rollback;
