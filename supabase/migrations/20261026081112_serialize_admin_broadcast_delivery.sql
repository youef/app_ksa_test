create or replace function public.admin_dispatch_scheduled_broadcast(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $dispatch$
declare b public.scheduled_broadcasts%rowtype; recipients bigint;
begin
 perform public.assert_is_admin();
 select * into b from public.scheduled_broadcasts where id=p_id for update;
 if not found then raise exception 'Broadcast not found' using errcode='P0002'; end if;
 if b.status='sent' then return jsonb_build_object('already_sent',true,'recipients',0,'pushed',0); end if;
 if b.status<>'pending' then raise exception 'Broadcast is not pending' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles where id=b.created_by and role='admin' and not is_banned) then
  raise exception 'Broadcast creator is not authorized' using errcode='42501';
 end if;
 insert into public.notifications(user_id,type,title,body,data)
  select p.id,'broadcast',b.title,b.body,jsonb_build_object('broadcast_type',b.broadcast_type,'broadcast_id',b.id)
  from public.profiles p where not p.is_banned
   and(coalesce(b.target->>'scope','all')='all' or p.city=b.target->>'scope')
   and(case coalesce(b.target->>'segment','all') when 'all' then true when 'verified' then p.is_verified
    when 'unverified' then not p.is_verified when 'admins' then p.role='admin' else false end);
 get diagnostics recipients=row_count;
 update public.scheduled_broadcasts set status='sent',sent_at=now() where id=p_id;
 return jsonb_build_object('recipients',recipients,'pushed',0,'push_queued',true);
end $dispatch$;
revoke all on function public.admin_dispatch_scheduled_broadcast(uuid) from public,anon;
grant execute on function public.admin_dispatch_scheduled_broadcast(uuid) to authenticated;
create or replace function public.admin_send_broadcast(p_title text,p_body text,p_type text,p_scope text,p_segment text)
returns jsonb language plpgsql security definer set search_path='' as $send$
declare broadcast_id uuid;
begin
 perform public.assert_is_admin();
 if length(trim(coalesce(p_title,''))) not between 1 and 180
  or length(trim(coalesce(p_body,''))) not between 1 and 4000
  or p_type is null or p_type not in ('official','emergency','weather','maintenance')
  or p_segment is null or p_segment not in ('all','verified','unverified','admins')
  or length(trim(coalesce(p_scope,''))) not between 1 and 120
 then raise exception 'Invalid broadcast parameters' using errcode='22023'; end if;
 insert into public.scheduled_broadcasts(title,body,broadcast_type,target,scheduled_at,created_by)
  values(trim(p_title),trim(p_body),p_type,jsonb_build_object('scope',p_scope,'segment',p_segment),now(),auth.uid())
  returning id into broadcast_id;
 return public.admin_dispatch_scheduled_broadcast(broadcast_id);
end $send$;
revoke all on function public.admin_send_broadcast(text,text,text,text,text) from public,anon;
grant execute on function public.admin_send_broadcast(text,text,text,text,text) to authenticated;
