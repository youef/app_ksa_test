-- Public browsing respects location even for staff; admin review remains separate.
begin;
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
create or replace function public.hayna_neighbor_access(p_lookup text,p_scope text default 'district') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare target uuid; visible boolean;begin
 if p_scope not in ('city','district') then raise exception 'invalid_neighbor_scope' using errcode='22023';end if;
 if auth.uid() is null then return jsonb_build_object('can_view',false,'can_message',false);end if;
 select id into target from public.profiles where id::text=p_lookup or username=ltrim(p_lookup,'@') limit 1;
 visible:=target is not null and app_private.neighbor_can_browse(target,p_scope);
 return jsonb_build_object('can_view',visible,'can_message',visible and public.hayna_can_dm(auth.uid(),target),'target_id',case when visible then target else null end);
end $$;
commit;
