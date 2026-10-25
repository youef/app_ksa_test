-- Execute against the linked database. All test accounts and messages roll back.
begin;
update public.platform_welcome_settings set enabled=true where id='welcome';
insert into auth.users(id,email,raw_user_meta_data) values
('fa000000-0000-4000-8000-000000000001','welcome-test-one@example.invalid','{"username":"welcome_test_one"}');
do $$ begin
  if (select count(*) from public.platform_messages where recipient_id='fa000000-0000-4000-8000-000000000001' and type='welcome')<>1 then raise exception 'Welcome must be delivered exactly once'; end if;
  insert into public.profiles(id,username,display_name) values('fa000000-0000-4000-8000-000000000001','welcome_test_one','Test') on conflict do nothing;
  if (select count(*) from public.platform_messages where recipient_id='fa000000-0000-4000-8000-000000000001' and type='welcome')<>1 then raise exception 'Duplicate welcome'; end if;
end $$;
update public.platform_welcome_settings set enabled=false where id='welcome';
insert into auth.users(id,email,raw_user_meta_data) values
('fa000000-0000-4000-8000-000000000002','welcome-test-two@example.invalid','{"username":"welcome_test_two"}');
do $$ begin
  if exists(select 1 from public.platform_messages where recipient_id='fa000000-0000-4000-8000-000000000002') then raise exception 'Disabled welcome must not send'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"fa000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.platform_messages where recipient_id='fa000000-0000-4000-8000-000000000001')<>1 then raise exception 'Recipient must read own welcome'; end if;
  if exists(select 1 from public.platform_messages where recipient_id<>'fa000000-0000-4000-8000-000000000001') then raise exception 'RLS leaked another inbox'; end if;
  if exists(select 1 from public.platform_welcome_settings) then raise exception 'Settings leaked to non-admin'; end if;
  update public.platform_messages set read=true where recipient_id=auth.uid();
  begin
    update public.platform_messages set body='forged official message' where recipient_id=auth.uid();
    raise exception 'Recipients must not edit official text';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.platform_messages(recipient_id,body,type) values(auth.uid(),'forged','welcome');
    raise exception 'Recipients must not impersonate the platform';
  exception when insufficient_privilege then null; end;
  begin
    perform public.send_platform_campaign('test','test','update','all');
    raise exception 'Non-admin campaign must fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='admin' and not is_banned limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare request_id uuid := gen_random_uuid(); delivered integer; begin
  delivered := public.send_platform_campaign('Test update','Test message','update','user','@welcome_test_one',request_id);
  if delivered<>1 then raise exception 'Targeted campaign failed'; end if;
  perform public.send_platform_campaign('Test update','Test message','update','user','@welcome_test_one',request_id);
  if (select count(*) from public.platform_messages where campaign_id=request_id)<>1 then raise exception 'Retry duplicated the campaign'; end if;
end $$;
reset role;
rollback;
select 'PASS: automatic welcome, disabled state, RLS isolation, read-only contents, admin authorization, targeted delivery and retry idempotency; test data rolled back' as result;
