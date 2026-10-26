begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('fb000000-0000-4000-8000-000000000001','backend-audit-a@example.invalid','{"username":"backend_audit_a"}'),
 ('fb000000-0000-4000-8000-000000000002','backend-audit-b@example.invalid','{"username":"backend_audit_b"}'),
 ('fb000000-0000-4000-8000-000000000003','backend-audit-c@example.invalid','{"username":"backend_audit_c"}');
update public.profiles set city='عرعر',district='حي اختبار',allow_dms='everyone' where id in ('fb000000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000003');
insert into public.conversations(id,created_by) values('fb000000-0000-4000-8000-000000000010','fb000000-0000-4000-8000-000000000001');
insert into public.conversation_members(conversation_id,user_id) values
 ('fb000000-0000-4000-8000-000000000010','fb000000-0000-4000-8000-000000000001'),
 ('fb000000-0000-4000-8000-000000000010','fb000000-0000-4000-8000-000000000002');
insert into public.messages(conversation_id,sender_id,body,read_by) values(
 'fb000000-0000-4000-8000-000000000010','fb000000-0000-4000-8000-000000000001',
 '{"type":"image","storage_path":"fb000000-0000-4000-8000-000000000001/audit.jpg"}',
 array['fb000000-0000-4000-8000-000000000001']::uuid[]);
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if public.hayna_can_read_chat_media('fb000000-0000-4000-8000-000000000001/audit.jpg') then raise exception 'Non-member can access chat image'; end if;
 if exists(select 1 from public.conversation_members where conversation_id='fb000000-0000-4000-8000-000000000010') then raise exception 'Non-member can enumerate members'; end if;
 if exists(select 1 from public.conversations where id='fb000000-0000-4000-8000-000000000010') then raise exception 'Non-member can enumerate conversations'; end if;
 begin
  insert into public.conversation_members(conversation_id,user_id) values('fb000000-0000-4000-8000-000000000010',auth.uid());
  raise exception 'Non-member joined another private chat';
 exception when insufficient_privilege then null; end;
 begin
  perform public.mark_messages_read('fb000000-0000-4000-8000-000000000010','fb000000-0000-4000-8000-000000000002');
  raise exception 'Forged read receipt';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not public.hayna_can_read_chat_media('fb000000-0000-4000-8000-000000000001/audit.jpg') then raise exception 'Recipient cannot access chat image'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare direct uuid; begin
 if (select count(*) from public.conversation_members where conversation_id='fb000000-0000-4000-8000-000000000010')<>2 then raise exception 'Participant cannot read both members'; end if;
 perform public.mark_messages_read('fb000000-0000-4000-8000-000000000010',auth.uid());
 direct:=public.hayna_get_or_create_direct_conversation('fb000000-0000-4000-8000-000000000002');
 if direct<>'fb000000-0000-4000-8000-000000000010' then raise exception 'RPC did not reuse private conversation'; end if;
end $$;
reset role;
rollback;
select 'PASS: chat directory/membership isolation, unauthorized self-join rejection, secure read receipts, participant access and direct-chat RPC; all fixtures rolled back' as result;
