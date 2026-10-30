begin;
select plan(25);
insert into auth.users(id,email) values
('81000000-0000-0000-0000-000000000001','records-admin@example.test'),
('81000000-0000-0000-0000-000000000002','records-secretary@example.test'),
('81000000-0000-0000-0000-000000000003','records-staff@example.test');
update public.profiles set role='admin',status='active' where id='81000000-0000-0000-0000-000000000001';
update public.profiles set role='secretary',status='active' where id='81000000-0000-0000-0000-000000000002';
update public.profiles set role='staff',status='active' where id='81000000-0000-0000-0000-000000000003';
insert into public.attorneys(id,full_name,contact_no,email) values
('82000000-0000-0000-0000-000000000001','Fake Linked Lawyer','0912-345-6789','linked@example.test'),
('82000000-0000-0000-0000-000000000002','Fake Empty Lawyer','0912-345-6789','empty@example.test'),
('82000000-0000-0000-0000-000000000003','Fake Reassignment Lawyer','0912-345-6789','reassign@example.test');
insert into public.clients(id,full_name,birthdate,contact_no,email,address,attorney_id,created_by) values
('83000000-0000-0000-0000-000000000001','Fake Edit Client','1990-01-01','0912-345-6789','edit@example.test','Fake address','82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001');
insert into public.respondents(client_id,full_name,birthdate,contact_no,email,address) values
('83000000-0000-0000-0000-000000000001','Fake Respondent','1991-01-01','0912-345-6789','respondent@example.test','Fake address');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$update public.attorneys set full_name='Denied' where id='82000000-0000-0000-0000-000000000002'$$,'Staff attorney edit has no writable row');
select is((select full_name from public.attorneys where id='82000000-0000-0000-0000-000000000002'),'Fake Empty Lawyer','Staff cannot edit attorney');
select lives_ok($$update public.clients set full_name='Denied' where id='83000000-0000-0000-0000-000000000001'$$,'Staff client edit has no writable row');
select is((select full_name from public.clients where id='83000000-0000-0000-0000-000000000001'),'Fake Edit Client','Staff cannot edit client');
select lives_ok($$update public.attorneys set is_archived=true where id='82000000-0000-0000-0000-000000000002'$$,'Staff attorney archive has no writable row');
select is((select is_archived from public.attorneys where id='82000000-0000-0000-0000-000000000002'),false,'Staff cannot archive attorney');
select throws_ok($$select public.update_client_record('83000000-0000-0000-0000-000000000001','{}'::jsonb,'82000000-0000-0000-0000-000000000003')$$,'P0001','Access denied','Staff cannot call client edit RPC');

select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.attorneys set full_name='Fake Edited Lawyer' where id='82000000-0000-0000-0000-000000000001'$$,'Secretary can edit attorney');
select is((select full_name from public.attorneys where id='82000000-0000-0000-0000-000000000001'),'Fake Edited Lawyer','Attorney edit persists for linked clients');
select lives_ok($$select public.update_client_record('83000000-0000-0000-0000-000000000001','{"petitionerName":"Fake Updated Client","petitionerBirthdate":"1990-01-01","petitionerContact":"0912-345-6789","petitionerEmail":"updated@example.test","petitionerAddress":"Updated fake address","respondentName":"Fake Updated Respondent","respondentBirthdate":"1991-01-01","respondentContact":"0912-345-6789","respondentEmail":"updated-respondent@example.test","respondentAddress":"Updated fake address"}'::jsonb,'82000000-0000-0000-0000-000000000003')$$,'Secretary can edit client and reassign attorney');
select is((select full_name from public.clients where id='83000000-0000-0000-0000-000000000001'),'Fake Updated Client','Client edit persists');
select is((select full_name from public.respondents where client_id='83000000-0000-0000-0000-000000000001'),'Fake Updated Respondent','Respondent edit persists');
select is((select attorney_id from public.clients where id='83000000-0000-0000-0000-000000000001'),'82000000-0000-0000-0000-000000000003'::uuid,'Attorney reassignment persists');
select throws_ok($$update public.attorneys set is_archived=true where id='82000000-0000-0000-0000-000000000003'$$,'P0001','Reassign all linked clients before archiving this attorney','Linked attorney archive is blocked');
select lives_ok($$update public.attorneys set is_archived=true where id='82000000-0000-0000-0000-000000000002'$$,'Secretary can archive unused attorney');
select is((select count(*) from public.activity_log where entity_type='attorneys' and entity_id='82000000-0000-0000-0000-000000000002' and action='archive')::int,0,'Secretary cannot read audit log');
select throws_ok($$update public.attorneys set is_archived=false where id='82000000-0000-0000-0000-000000000002'$$,'P0001','Only Admin may restore attorneys','Secretary cannot restore attorney');
select throws_ok($$update public.clients set is_archived=true where id='83000000-0000-0000-0000-000000000001'$$,'P0001','Only Admin may archive or restore clients','Secretary cannot archive client');

select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.clients set is_archived=true where id='83000000-0000-0000-0000-000000000001'$$,'Admin can archive client');
select throws_ok($$update public.attorneys set is_archived=true where id='82000000-0000-0000-0000-000000000003'$$,'P0001','Reassign all linked clients before archiving this attorney','Archived client still blocks attorney archive');
select lives_ok($$update public.clients set is_archived=false where id='83000000-0000-0000-0000-000000000001'$$,'Admin can restore client');
select lives_ok($$update public.attorneys set is_archived=false where id='82000000-0000-0000-0000-000000000002'$$,'Admin can restore attorney');
select is((select is_archived from public.attorneys where id='82000000-0000-0000-0000-000000000002'),false,'Restored attorney is available');
select is((select count(*) from public.activity_log where entity_type='attorneys' and entity_id='82000000-0000-0000-0000-000000000002' and action='archive')::int,1,'Attorney archive writes metadata audit event');
select is((select count(*) from public.activity_log where entity_type='clients' and entity_id='83000000-0000-0000-0000-000000000001' and action='archive')::int,1,'Client archive writes metadata audit event');
select * from finish();
rollback;
