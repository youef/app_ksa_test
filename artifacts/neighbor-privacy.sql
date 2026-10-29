-- Independent, scoped privacy change. No data deletion or role assignment.
begin;
create schema if not exists app_private;
create or replace function app_private.neighbor_area_key(p_value text) returns text
language sql immutable set search_path=pg_catalog as $$
 select lower(regexp_replace(translate(regexp_replace(btrim(coalesce(p_value,'')),'^(حي|مدينة|منطقة)\s+','','g'),'أإآٱةى','ااااهي'),'[\sًٌٍَُِّْـ]+','','g'))
$$;
revoke all on function app_private.neighbor_area_key(text) from public,anon;

create or replace function app_private.neighbor_user_staff(p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.profiles where id=p_user and not coalesce(is_banned,false))
 and not exists(select 1 from public.admin_permissions where admin_id=p_user and permission in ('users','all') and enabled=false)
 and (exists(select 1 from public.admin_permissions where admin_id=p_user and permission in ('users','all') and enabled=true)
 or exists(select 1 from public.admin_role_assignments a join public.admin_roles r on r.key=a.role_key where a.user_id=p_user and (r.permissions->>'users'='true' or r.permissions->>'all'='true')))
$$;
revoke all on function app_private.neighbor_user_staff(uuid) from public,anon,authenticated;

create or replace function app_private.neighbor_can_view(p_target uuid,p_scope text default 'district') returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare viewer public.profiles; target public.profiles; actor uuid:=auth.uid();begin
 if actor is null or p_scope not in ('city','district') then return false;end if;
 if p_target=actor then return true;end if;
 select * into viewer from public.profiles where id=actor;
 if not found or coalesce(viewer.is_banned,false) then return false;end if;
 select * into target from public.profiles where id=p_target;
 if not found then return false;end if;
 if app_private.neighbor_user_staff(actor) then return true;end if;
 if coalesce(target.is_banned,false) or coalesce(target.hide_name,false) or target.profile_privacy='hidden' then return false;end if;
 if exists(select 1 from public.blocks where (blocker_id=actor and blocked_id=p_target) or (blocker_id=p_target and blocked_id=actor)) then return false;end if;
 if target.profile_privacy='private' and not exists(select 1 from public.follows where follower_id=actor and following_id=p_target) then return false;end if;
 if nullif(app_private.neighbor_area_key(viewer.city),'') is null or viewer.city in ('كل المدن','كل المملكة','كل مناطق المملكة') or app_private.neighbor_area_key(viewer.city)<>app_private.neighbor_area_key(target.city) then return false;end if;
 if p_scope='district' and (nullif(app_private.neighbor_area_key(viewer.district),'') is null or viewer.district in ('كل الأحياء','كل أحياء المدينة','جميع الأحياء') or app_private.neighbor_area_key(viewer.district)<>app_private.neighbor_area_key(target.district)) then return false;end if;
 return true;
end $$;
revoke all on function app_private.neighbor_can_view(uuid,text) from public,anon;
grant execute on function app_private.neighbor_can_view(uuid,text) to authenticated;

-- A restrictive policy ANDs the old permissive public reads instead of dropping them.
create policy neighbor_profile_city_boundary on public.profiles as restrictive for select to anon,authenticated
using (app_private.neighbor_can_view(id,'city'));
grant execute on function app_private.neighbor_can_view(uuid,text) to anon;

create or replace function app_private.neighbor_can_browse(p_target uuid,p_scope text default 'district') returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare viewer public.profiles; target public.profiles; actor uuid:=auth.uid();begin
 if actor is null or p_scope not in ('city','district') then return false;end if;
 if p_target=actor then return true;end if;
 select * into viewer from public.profiles where id=actor;
 if not found or coalesce(viewer.is_banned,false) then return false;end if;
 select * into target from public.profiles where id=p_target;
 if not found then return false;end if;
 if coalesce(target.is_banned,false) or coalesce(target.hide_name,false) or target.profile_privacy='hidden' then return false;end if;
 if exists(select 1 from public.blocks where (blocker_id=actor and blocked_id=p_target) or (blocker_id=p_target and blocked_id=actor)) then return false;end if;
 if target.profile_privacy='private' and not exists(select 1 from public.follows where follower_id=actor and following_id=p_target) then return false;end if;
 if nullif(app_private.neighbor_area_key(viewer.city),'') is null or viewer.city in ('كل المدن','كل المملكة','كل مناطق المملكة') or app_private.neighbor_area_key(viewer.city)<>app_private.neighbor_area_key(target.city) then return false;end if;
 if p_scope='district' and (nullif(app_private.neighbor_area_key(viewer.district),'') is null or viewer.district in ('كل الأحياء','كل أحياء المدينة','جميع الأحياء') or app_private.neighbor_area_key(viewer.district)<>app_private.neighbor_area_key(target.district)) then return false;end if;
 return true;
end $$;
revoke all on function app_private.neighbor_can_browse(uuid,text) from public,anon,authenticated;

create or replace function public.hayna_can_dm(p_sender uuid,p_recipient uuid) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare recipient public.profiles; sender public.profiles;begin
 if p_sender is null or p_recipient is null or p_sender=p_recipient or auth.uid() is distinct from p_sender then return false;end if;
 if not app_private.neighbor_can_browse(p_recipient,'district') then return false;end if;
 select * into recipient from public.profiles where id=p_recipient;
 select * into sender from public.profiles where id=p_sender;
 -- Staff viewing authority never bypasses the recipient's communication preferences or locality.
 if coalesce(sender.is_banned,false) or coalesce(recipient.is_banned,false) or coalesce(recipient.hide_name,false) or recipient.profile_privacy='hidden' or recipient.allow_dms='nobody' then return false;end if;
 if recipient.profile_privacy='private' and not exists(select 1 from public.follows where follower_id=p_sender and following_id=p_recipient) then return false;end if;
 if nullif(app_private.neighbor_area_key(sender.city),'') is null or nullif(app_private.neighbor_area_key(sender.district),'') is null or sender.district in ('كل الأحياء','كل أحياء المدينة','جميع الأحياء') or app_private.neighbor_area_key(sender.city)<>app_private.neighbor_area_key(recipient.city) or app_private.neighbor_area_key(sender.district)<>app_private.neighbor_area_key(recipient.district) then return false;end if;
 if exists(select 1 from public.blocks where (blocker_id=p_sender and blocked_id=p_recipient) or (blocker_id=p_recipient and blocked_id=p_sender)) then return false;end if;
 if recipient.allow_dms='followers' and not exists(select 1 from public.follows where follower_id=p_sender and following_id=p_recipient) then return false;end if;
 return true;
end $$;
revoke all on function public.hayna_can_dm(uuid,uuid) from public,anon;
grant execute on function public.hayna_can_dm(uuid,uuid) to authenticated;

create or replace function public.hayna_neighbor_access(p_lookup text,p_scope text default 'district') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare target uuid; visible boolean;begin
 if p_scope not in ('city','district') then raise exception 'invalid_neighbor_scope' using errcode='22023';end if;
 if auth.uid() is null then return jsonb_build_object('can_view',false,'can_message',false);end if;
 select id into target from public.profiles where id::text=p_lookup or username=ltrim(p_lookup,'@') limit 1;
 visible:=target is not null and app_private.neighbor_can_browse(target,p_scope);
 return jsonb_build_object('can_view',visible,'can_message',visible and public.hayna_can_dm(auth.uid(),target),'target_id',case when visible then target else null end);
end $$;
revoke all on function public.hayna_neighbor_access(text,text) from public;
grant execute on function public.hayna_neighbor_access(text,text) to anon,authenticated;

create or replace function public.hayna_get_or_create_direct_conversation(p_target uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); conversation uuid;begin
 if actor is null or not public.hayna_can_dm(actor,p_target) then raise exception 'dm_not_allowed' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(actor::text,p_target::text)||':'||greatest(actor::text,p_target::text),491528));
 select c.id into conversation from public.conversations c
 where exists(select 1 from public.conversation_members where conversation_id=c.id and user_id=actor)
 and exists(select 1 from public.conversation_members where conversation_id=c.id and user_id=p_target)
 and not exists(select 1 from public.conversation_members where conversation_id=c.id and user_id not in(actor,p_target))
 order by c.created_at limit 1;
 if conversation is null then
  insert into public.conversations(created_by)values(actor)returning id into conversation;
  insert into public.conversation_members(conversation_id,user_id)values(conversation,actor),(conversation,p_target);
 end if;
 return conversation;
end $$;
revoke all on function public.hayna_get_or_create_direct_conversation(uuid) from public,anon;
grant execute on function public.hayna_get_or_create_direct_conversation(uuid) to authenticated;

create or replace function public.hayna_can_message_conversation(p_conversation uuid,p_sender uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid()=p_sender
 and exists(select 1 from public.conversation_members where conversation_id=p_conversation and user_id=p_sender)
 and exists(select 1 from public.conversation_members where conversation_id=p_conversation and user_id<>p_sender)
 and not exists(select 1 from public.conversation_members where conversation_id=p_conversation and user_id<>p_sender and not public.hayna_can_dm(p_sender,user_id))
$$;
revoke all on function public.hayna_can_message_conversation(uuid,uuid) from public,anon;
grant execute on function public.hayna_can_message_conversation(uuid,uuid) to authenticated;
-- Closing new messages does not erase a participant's existing conversation history.
create or replace function app_private.neighbor_can_read_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null
 and exists(select 1 from public.conversation_members where conversation_id=p_conversation and user_id=auth.uid())
 and exists(select 1 from public.conversation_members where conversation_id=p_conversation and user_id<>auth.uid())
 and not exists(select 1 from public.conversation_members m join public.blocks b on (b.blocker_id=auth.uid() and b.blocked_id=m.user_id) or (b.blocker_id=m.user_id and b.blocked_id=auth.uid()) where m.conversation_id=p_conversation)
$$;
revoke all on function app_private.neighbor_can_read_conversation(uuid) from public,anon;
grant execute on function app_private.neighbor_can_read_conversation(uuid) to authenticated;
alter policy "messages authenticated read allowed conversation" on public.messages
using (app_private.neighbor_can_read_conversation(conversation_id));
create policy neighbor_message_update_guard on public.messages as restrictive for update to authenticated
using (sender_id=auth.uid())
with check (sender_id=auth.uid() and public.hayna_can_message_conversation(conversation_id,auth.uid()));

create policy neighbor_contact_city_boundary on public.profile_contact_numbers as restrictive for select to anon,authenticated
using (user_id=auth.uid() or public.hayna_can_dm(auth.uid(),user_id));
create policy neighbor_customization_city_boundary on public.profile_customizations as restrictive for select to anon,authenticated
using (app_private.neighbor_can_view(user_id,'city'));
revoke usage on schema app_private from anon,authenticated;
commit;
