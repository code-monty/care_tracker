begin;
select plan(8);

insert into auth.users(id,email) values
('62000000-0000-0000-0000-000000000001','log-admin@example.test'),
('62000000-0000-0000-0000-000000000002','log-staff@example.test'),
('62000000-0000-0000-0000-000000000003','log-pending@example.test');
update public.profiles set role='admin', status='active' where id='62000000-0000-0000-0000-000000000001';
update public.profiles set status='active' where id='62000000-0000-0000-0000-000000000002';
select public.log_activity('62000000-0000-0000-0000-000000000001','login',null,null);

select set_config('role','anon',true);
select is((select count(*) from public.activity_log where actor_id='62000000-0000-0000-0000-000000000001')::int,0,'Anonymous user cannot read logs');
select ok(not has_function_privilege('anon','public.log_activity(uuid,text,text,uuid)','EXECUTE'),'Anonymous user cannot append logs');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"62000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.activity_log where actor_id='62000000-0000-0000-0000-000000000001')::int,0,'Pending user cannot read logs');
select set_config('request.jwt.claims','{"sub":"62000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.activity_log where actor_id='62000000-0000-0000-0000-000000000001')::int,0,'Staff cannot read logs');
select ok(not has_function_privilege('authenticated','public.log_activity(uuid,text,text,uuid)','EXECUTE'),'Staff cannot append logs');
select set_config('request.jwt.claims','{"sub":"62000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.activity_log where actor_id='62000000-0000-0000-0000-000000000001' and action='login')::int,1,'Admin can read trusted auth event');
select ok(not has_function_privilege('authenticated','public.log_activity(uuid,text,text,uuid)','EXECUTE'),'Admin cannot forge logs');
select ok(not has_table_privilege('authenticated','public.activity_log','UPDATE,DELETE'),'Log rows remain append-only');
select * from finish();
rollback;
