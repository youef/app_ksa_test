-- Product visibility must not depend on permission to read the seller's personal profile.
begin;
create or replace function app_private.can_browse_regional_product(p_seller uuid) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare viewer public.profiles; seller public.profiles;
begin
 if auth.uid() is null then return false;end if;
 select * into viewer from public.profiles where id=auth.uid();
 if not found or coalesce(viewer.is_banned,false) then return false;end if;
 select * into seller from public.profiles where id=p_seller;
 if not found or coalesce(seller.is_banned,false) then return false;end if;
 if not coalesce((seller.role='admin' or (seller.account_type='merchant' and seller.is_verified and seller.is_verified_merchant)),false) then return false;end if;
 if coalesce(seller.hide_name,false) or seller.profile_privacy='hidden' then return false;end if;
 if seller.profile_privacy='private' and not exists(select 1 from public.follows where follower_id=auth.uid() and following_id=p_seller) then return false;end if;
 if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_seller) or (blocker_id=p_seller and blocked_id=auth.uid())) then return false;end if;
 if nullif(app_private.neighbor_area_key(viewer.region),'') is null or app_private.neighbor_area_key(viewer.region) in (app_private.neighbor_area_key('الكل'),app_private.neighbor_area_key('كل المملكة'),app_private.neighbor_area_key('المملكة'),app_private.neighbor_area_key('المملكة العربية السعودية')) then return false;end if;
 return app_private.neighbor_area_key(viewer.region)=app_private.neighbor_area_key(seller.region);
end $$;
revoke all on function app_private.can_browse_regional_product(uuid) from public,anon;
grant execute on function app_private.can_browse_regional_product(uuid) to anon,authenticated;
alter policy "market verified seller visibility" on public.marketplace_items
using (seller_id=auth.uid() or public.hayna_is_staff(auth.uid()) or app_private.can_browse_regional_product(seller_id));

create or replace function public.hayna_product_trust(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare item public.marketplace_items; verified boolean; reviews_count bigint; average_rating numeric;
begin
 if auth.uid() is null then return null;end if;
 select * into item from public.marketplace_items where id=p_item;
 if not found then return null;end if;
 if item.seller_id is distinct from auth.uid() and not app_private.can_browse_regional_product(item.seller_id) then return null;end if;
 select coalesce(is_verified,false) into verified from public.profiles where id=item.seller_id;
 select count(*),round(avg(rating),1) into reviews_count,average_rating from public.reviews where business_id=item.business_id and rating between 1 and 5;
 return jsonb_build_object('verified',coalesce(verified,false),'review_count',reviews_count,'rating',average_rating,'review_subject',case when item.business_id is not null then 'business' else null end);
end $$;
revoke all on function public.hayna_product_trust(uuid) from public,anon;
grant execute on function public.hayna_product_trust(uuid) to authenticated;
commit;
