begin;
select plan(23);

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
select is((select count(*) from public.clients where id='30000000-0000-0000-0000-000000000001')::int,1,'active staff can read clients');
select is((select count(*) from public.appointments where client_id='30000000-0000-0000-0000-000000000001')::int,1,'active staff can read appointments');
select throws_ok($$select public.create_client_record('{}'::jsonb,'20000000-0000-0000-0000-000000000001')$$,'Access denied','staff cannot call client creation RPC');
select throws_ok($$insert into public.attorneys(full_name,contact_no,email) values ('Fake Added Lawyer','0912-345-6789','new-lawyer@example.test')$$,'new row violates row-level security policy for table "attorneys"','staff cannot insert attorney');
select throws_ok($$insert into public.clients(full_name,birthdate,contact_no,email,address,attorney_id,created_by) values ('Fake Added','1990-01-01','0912-345-6789','added@example.test','Fake address','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002')$$,'new row violates row-level security policy for table "clients"','staff cannot insert client');
select throws_ok($$insert into public.respondents(client_id,full_name,birthdate) values ('30000000-0000-0000-0000-000000000001','Fake Added Respondent','1991-01-01')$$,'new row violates row-level security policy for table "respondents"','staff cannot insert respondent');
select throws_ok($$insert into public.appointments(client_id,scheduled_at,reason,created_by) values ('30000000-0000-0000-0000-000000000001',now(),'Fake booking','10000000-0000-0000-0000-000000000002')$$,'new row violates row-level security policy for table "appointments"','staff cannot insert appointment');
select lives_ok($$update public.clients set status='inactive' where id='30000000-0000-0000-0000-000000000001'$$,'staff client update has no writable row');
select is((select status from public.clients where id='30000000-0000-0000-0000-000000000001'),'active','staff cannot change client status');
select lives_ok($$update public.attorneys set full_name='Changed' where id='20000000-0000-0000-0000-000000000001'$$,'staff attorney update has no writable row');
select is((select full_name from public.attorneys where id='20000000-0000-0000-0000-000000000001'),'Fake Lawyer','staff cannot edit attorney');
select lives_ok($$update public.respondents set full_name='Changed' where client_id='30000000-0000-0000-0000-000000000001'$$,'staff respondent update has no writable row');
select is((select full_name from public.respondents where client_id='30000000-0000-0000-0000-000000000001'),'Fake Respondent','staff cannot edit respondent');
select lives_ok($$update public.appointments set status='cancelled' where client_id='30000000-0000-0000-0000-000000000001'$$,'staff appointment update has no writable row');
select is((select status from public.appointments where client_id='30000000-0000-0000-0000-000000000001'),'pending','staff cannot change appointment');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.clients where full_name = 'Fake Client')::int,1,'admin can read clients');
select lives_ok($$select public.create_client_record('{"petitionerName":"Fake Added","petitionerBirthdate":"1990-02-01","petitionerContact":"0912-345-6789","petitionerEmail":"added@example.test","petitionerAddress":"Fake address","respondentName":"Fake Respondent Two","respondentBirthdate":"1991-02-01","respondentContact":"0912-345-6789","respondentEmail":"respondent-two@example.test","respondentAddress":"Fake address"}'::jsonb,'20000000-0000-0000-0000-000000000001')$$,'admin can create client');
select lives_ok($$update public.clients set is_archived=true where id='30000000-0000-0000-0000-000000000001'$$,'admin can archive');

select * from finish();
rollback;
