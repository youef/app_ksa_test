-- Public advertising payload contains general area and public account references only.
create or replace function public.hayna_marketplace_promotions(p_city text,p_district text default null)returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
select coalesce(jsonb_agg(to_jsonb(c)),'[]')from(select c.id,c.title,c.description,c.service_id,c.owner_id,c.ends_at from public.marketplace_ad_campaigns c
 join public.profiles p on p.id=c.owner_id join public.marketplace_orders o on o.id=c.payment_order_id and o.status='paid'
 where c.status='active' and c.starts_at<=now() and c.ends_at>now() and p.city=p_city and(p_district is null or p.district=p_district)
 and app_private.marketplace_professional(p.id) and(c.service_id is null or exists(select 1 from public.services s where s.id=c.service_id and s.moderation_status='approved'))
 order by c.starts_at desc,c.id limit 3)c;
$$;
revoke all on function public.hayna_marketplace_promotions(text,text)from public;
grant execute on function public.hayna_marketplace_promotions(text,text)to anon,authenticated;
do $$ declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')then
  foreach t in array array['marketplace_orders','marketplace_ad_campaigns','marketplace_service_orders','marketplace_subscriptions']loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'and schemaname='public'and tablename=t)then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
