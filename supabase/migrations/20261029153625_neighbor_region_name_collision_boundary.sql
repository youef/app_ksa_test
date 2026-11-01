-- Regions disambiguate repeated city/district labels. Existing staff review remains explicit.
begin;
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
 if nullif(app_private.neighbor_area_key(viewer.region),'') is null or viewer.region in ('الكل','كل المملكة','المملكة','المملكة العربية السعودية') or app_private.neighbor_area_key(viewer.region)<>app_private.neighbor_area_key(target.region) then return false;end if;
 if nullif(app_private.neighbor_area_key(viewer.city),'') is null or viewer.city in ('كل المدن','كل المملكة','كل مناطق المملكة') or app_private.neighbor_area_key(viewer.city)<>app_private.neighbor_area_key(target.city) then return false;end if;
 if p_scope='district' and (nullif(app_private.neighbor_area_key(viewer.district),'') is null or viewer.district in ('كل الأحياء','كل أحياء المدينة','جميع الأحياء') or app_private.neighbor_area_key(viewer.district)<>app_private.neighbor_area_key(target.district)) then return false;end if;
 return true;
end $$;
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
 if nullif(app_private.neighbor_area_key(viewer.region),'') is null or viewer.region in ('الكل','كل المملكة','المملكة','المملكة العربية السعودية') or app_private.neighbor_area_key(viewer.region)<>app_private.neighbor_area_key(target.region) then return false;end if;
 if nullif(app_private.neighbor_area_key(viewer.city),'') is null or viewer.city in ('كل المدن','كل المملكة','كل مناطق المملكة') or app_private.neighbor_area_key(viewer.city)<>app_private.neighbor_area_key(target.city) then return false;end if;
 if p_scope='district' and (nullif(app_private.neighbor_area_key(viewer.district),'') is null or viewer.district in ('كل الأحياء','كل أحياء المدينة','جميع الأحياء') or app_private.neighbor_area_key(viewer.district)<>app_private.neighbor_area_key(target.district)) then return false;end if;
 return true;
end $$;
commit;
