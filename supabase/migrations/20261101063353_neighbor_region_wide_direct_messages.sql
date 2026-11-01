-- Explicit user request: DMs use the registered region; profile/phone visibility stays scoped.
begin;
create or replace function public.hayna_can_dm(p_sender uuid,p_recipient uuid) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare recipient public.profiles; sender public.profiles;begin
 if p_sender is null or p_recipient is null or p_sender=p_recipient or auth.uid() is distinct from p_sender then return false;end if;
 select * into recipient from public.profiles where id=p_recipient;
 if not found then return false;end if;
 select * into sender from public.profiles where id=p_sender;
 if not found then return false;end if;
 -- Staff viewing authority never bypasses the recipient's communication preferences or locality.
 if coalesce(sender.is_banned,false) or coalesce(recipient.is_banned,false) or coalesce(recipient.hide_name,false) or recipient.profile_privacy='hidden' or recipient.allow_dms='nobody' then return false;end if;
 if recipient.profile_privacy='private' and not exists(select 1 from public.follows where follower_id=p_sender and following_id=p_recipient) then return false;end if;
 if nullif(app_private.neighbor_area_key(sender.region),'') is null or app_private.neighbor_area_key(sender.region) in (app_private.neighbor_area_key('الكل'),app_private.neighbor_area_key('كل المملكة'),app_private.neighbor_area_key('المملكة'),app_private.neighbor_area_key('المملكة العربية السعودية')) or app_private.neighbor_area_key(sender.region) is distinct from app_private.neighbor_area_key(recipient.region) then return false;end if;
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
 return jsonb_build_object('can_view',visible,'can_message',public.hayna_can_dm(auth.uid(),target),'target_id',case when visible then target else null end);
end $$;
alter policy neighbor_contact_city_boundary on public.profile_contact_numbers
using (user_id=auth.uid() or (public.hayna_neighbor_access(user_id::text,'district') @> '{"can_view":true,"can_message":true}'::jsonb));
commit;
