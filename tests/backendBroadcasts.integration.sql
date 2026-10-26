begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='admin' and not is_banned limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $test$ declare result jsonb; begin
 insert into public.scheduled_broadcasts(id,title,body,target,scheduled_at,created_by)
 values('fb000000-0000-4000-8000-000000000020','Audit','Audit','{"scope":"__backend_audit_no_city__","segment":"all"}',now()+interval '1 day',auth.uid());
 result:=public.admin_dispatch_scheduled_broadcast('fb000000-0000-4000-8000-000000000020');
 if result->>'recipients'<>'0' then raise exception 'Unexpected recipients'; end if;
 result:=public.admin_dispatch_scheduled_broadcast('fb000000-0000-4000-8000-000000000020');
 if result->>'already_sent'<>'true' then raise exception 'Duplicate dispatch permitted'; end if;
 result:=public.admin_send_broadcast('Audit','Audit','official','__backend_audit_no_city__','all');
 if result->>'recipients'<>'0' then raise exception 'Unexpected immediate recipients'; end if;
end $test$;
reset role;
rollback;
select 'PASS manual/immediate dispatch and repeat-send protection; zero recipients and fixtures rolled back' as result;
