begin;
select plan(32);

insert into auth.users(id,email) values
('f1000000-0000-0000-0000-000000000001','restore-admin@example.test'),
('f1000000-0000-0000-0000-000000000002','restore-secretary@example.test'),
('f1000000-0000-0000-0000-000000000003','restore-staff@example.test');
update public.profiles set role='admin',status='active' where id='f1000000-0000-0000-0000-000000000001';
update public.profiles set role='secretary',status='active' where id='f1000000-0000-0000-0000-000000000002';
update public.profiles set role='staff',status='active' where id='f1000000-0000-0000-0000-000000000003';
insert into public.attorneys(id,full_name,contact_no,email) values
('f2000000-0000-0000-0000-000000000001','Former Attorney','0912-345-6789','former@example.test'),
('f2000000-0000-0000-0000-000000000002','Available Attorney','0912-345-6789','available@example.test');
insert into public.clients(id,full_name,birthdate,contact_no,email,address,attorney_id,created_by) values
('f3000000-0000-0000-0000-000000000001','Restored Client','1990-01-01','0912-345-6789','restored@example.test','Fake address','f2000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001'),
('f3000000-0000-0000-0000-000000000002','Other Restored Client','1990-01-02','0912-345-6789','other@example.test','Fake address','f2000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000001');
insert into public.respondents(client_id,full_name,birthdate,contact_no,email,address) values
('f3000000-0000-0000-0000-000000000001','Fake Respondent','1991-01-01','0912-345-6789','respondent@example.test','Fake address'),
('f3000000-0000-0000-0000-000000000002','Other Respondent','1991-01-02','0912-345-6789','other-respondent@example.test','Fake address');
select set_config('test.client_payload','{"petitionerName":"Restored Client Edited","petitionerBirthdate":"1990-01-01","petitionerContact":"0912-345-6789","petitionerEmail":"restored@example.test","petitionerAddress":"Fake address","respondentName":"Fake Respondent","respondentBirthdate":"1991-01-01","respondentContact":"0912-345-6789","respondentEmail":"respondent@example.test","respondentAddress":"Fake address","attorneyName":"New Attorney","attorneyContact":"0912-345-6789","attorneyEmail":"new-attorney@example.test"}',true);

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.save_client_record('f3000000-0000-0000-0000-000000000001',current_setting('test.client_payload')::jsonb,'keep')$$,'P0001','Access denied','Staff cannot call the edit RPC');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$update public.clients set is_archived=true where id='f3000000-0000-0000-0000-000000000001'$$,'P0001','Only Admin may archive or restore clients','Secretary cannot archive client');
select throws_ok($$insert into public.clients(full_name,birthdate,contact_no,email,address,created_by) values ('No Attorney','1990-01-01','0912-345-6789','none@example.test','Fake address','f1000000-0000-0000-0000-000000000002')$$,'P0001','Select an available attorney','New client still requires attorney');

select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.clients set is_archived=true where id='f3000000-0000-0000-0000-000000000001'$$,'Admin archives client');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.attorneys set is_archived=true where id='f2000000-0000-0000-0000-000000000001'$$,'Secretary archives attorney with only archived client');
select throws_ok($$update public.clients set is_archived=false where id='f3000000-0000-0000-0000-000000000001'$$,'P0001','Only Admin may archive or restore clients','Secretary cannot restore client');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.clients set is_archived=false where id='f3000000-0000-0000-0000-000000000001'$$,'Admin restores client without archived attorney');
select is((select attorney_id from public.clients where id='f3000000-0000-0000-0000-000000000001'),null::uuid,'Client is unassigned');
select is((select attorney_id from public.client_attorney_history where client_id='f3000000-0000-0000-0000-000000000001'),'f2000000-0000-0000-0000-000000000001'::uuid,'First former attorney is recorded');
select throws_ok($$update public.clients set attorney_id=null where id='f3000000-0000-0000-0000-000000000002'$$,'P0001','Select an available attorney','Ordinary edit cannot remove an assigned attorney');

select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.client_attorney_history where client_id='f3000000-0000-0000-0000-000000000001'),1,'Secretary can read former attorney history');
select throws_ok($$update public.client_attorney_history set attorney_id='f2000000-0000-0000-0000-000000000002' where client_id='f3000000-0000-0000-0000-000000000001'$$,'42501',null,'Secretary cannot rewrite history');
select throws_ok($$insert into public.client_attorney_history(client_id,attorney_id) values ('f3000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000002')$$,'42501',null,'Secretary cannot add history directly');
select lives_ok($$select public.save_client_record('f3000000-0000-0000-0000-000000000001',current_setting('test.client_payload')::jsonb,'keep')$$,'Secretary edits unassigned client without attorney');
select is((select attorney_id from public.clients where id='f3000000-0000-0000-0000-000000000001'),null::uuid,'Keep mode leaves client unassigned');
select lives_ok($$select public.save_client_record('f3000000-0000-0000-0000-000000000001',current_setting('test.client_payload')::jsonb,'new')$$,'Secretary creates and links attorney in one transaction');
select set_config('test.new_attorney',(select attorney_id::text from public.clients where id='f3000000-0000-0000-0000-000000000001'),true);
select is((select full_name from public.attorneys where id=current_setting('test.new_attorney')::uuid),'New Attorney','New attorney details persist');
select is((select count(*)::int from public.client_attorney_history where client_id='f3000000-0000-0000-0000-000000000001'),1,'Reassignment preserves history');

select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.clients set is_archived=true where id='f3000000-0000-0000-0000-000000000001'$$,'Admin archives client again');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.attorneys set is_archived=true where id=current_setting('test.new_attorney')::uuid$$,'Secretary archives second attorney');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.clients set is_archived=false where id='f3000000-0000-0000-0000-000000000001'$$,'Admin restores client again');
select is((select count(*)::int from public.client_attorney_history where client_id='f3000000-0000-0000-0000-000000000001'),2,'Both former attorney links are retained');
select is((select count(*)::int from public.client_attorney_history where client_id='f3000000-0000-0000-0000-000000000001' and attorney_id=current_setting('test.new_attorney')::uuid),1,'Second former attorney is recorded');
select lives_ok($$update public.attorneys set is_archived=false where id=current_setting('test.new_attorney')::uuid$$,'Admin restores former attorney');
select is((select attorney_id from public.clients where id='f3000000-0000-0000-0000-000000000001'),null::uuid,'Attorney restoration does not relink client');

select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.save_client_record('f3000000-0000-0000-0000-000000000001',current_setting('test.client_payload')::jsonb,'existing','f2000000-0000-0000-0000-000000000002')$$,'Secretary selects an existing available attorney');
select is((select attorney_id from public.clients where id='f3000000-0000-0000-0000-000000000001'),'f2000000-0000-0000-0000-000000000002'::uuid,'Existing attorney link persists');
select throws_ok($$select public.save_client_record('f3000000-0000-0000-0000-000000000001',current_setting('test.client_payload')::jsonb,'existing','f2000000-0000-0000-0000-000000000001')$$,'P0001','Select an available attorney','Archived attorney cannot be assigned');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.clients set is_archived=true where id='f3000000-0000-0000-0000-000000000001'$$,'Admin archives reassigned client');
select lives_ok($$update public.clients set is_archived=false where id='f3000000-0000-0000-0000-000000000001'$$,'Admin restores client with active attorney');
select is((select attorney_id from public.clients where id='f3000000-0000-0000-0000-000000000001'),'f2000000-0000-0000-0000-000000000002'::uuid,'Active attorney stays linked');
select is((select count(*)::int from public.client_attorney_history where client_id='f3000000-0000-0000-0000-000000000001'),2,'Active attorney restore adds no history');

select * from finish();
rollback;
