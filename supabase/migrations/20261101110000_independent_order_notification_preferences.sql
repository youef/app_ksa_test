
-- Independent in-app/push settings. Push-only order events must not appear in unread UI counters.
create or replace function app_private.hayna_order_emit_notification(
 p_user uuid,p_type text,p_target uuid,p_title text,p_body text,p_key text
) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_in_app boolean;v_push boolean;
begin
 if p_user is null then return;end if;
 select coalesce(np.in_app_enabled,true),coalesce(np.push_enabled,true)
 into v_in_app,v_push
 from (select 1) x left join public.order_notification_preferences np on np.user_id=p_user;
 select v_push and not coalesce(dnd_enabled,false) into v_push from public.profiles where id=p_user;
 if not v_in_app and not coalesce(v_push,false) then return;end if;
 insert into public.notifications(user_id,type,title,body,target_type,target_id,data)
 values(p_user,p_type,p_title,p_body,'order',p_target,jsonb_build_object(
 'event_key',p_key,'push_allowed',coalesce(v_push,false),
 'in_app_allowed',v_in_app,'order_id',p_target))
 on conflict do nothing;
end $$;
revoke all on function app_private.hayna_order_emit_notification(uuid,text,uuid,text,text,text) from public,anon,authenticated;

-- Counter excludes a push-only record. Existing notification behavior otherwise retained.
create or replace function public.tg_notifications_counters() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if tg_op='INSERT' then
  if coalesce(new.data->>'in_app_allowed','true')<>'false' then
   perform public.increment_counter('profiles','id',new.user_id,'notifications_unread_count',1);
  end if;
 elsif tg_op='UPDATE' then
  if old.read_at is null and new.read_at is not null and
   coalesce(old.data->>'in_app_allowed','true')<>'false' then
   perform public.increment_counter('profiles','id',new.user_id,'notifications_unread_count',-1);
  end if;
 elsif tg_op='DELETE' then
  if coalesce(old.data->>'in_app_allowed','true')<>'false' then
   perform public.increment_counter('profiles','id',old.user_id,'notifications_unread_count',-1);
  end if;
 end if;
 return null;
end $$;
revoke all on function public.tg_notifications_counters() from public,anon,authenticated;
