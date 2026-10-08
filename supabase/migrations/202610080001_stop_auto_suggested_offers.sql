-- Migration: 202610080001_stop_auto_suggested_offers.sql
-- Problem: whenever a help request was created, a server-side matcher automatically
-- inserted dozens of "اقتراح تلقائي: قد تكون مناسبًا لهذا الطلب." rows into
-- public.help_matches on behalf of fake/test users. These looked like real neighbour
-- offers on the request page.
--
-- Requirement: automatic suggestions must NOT send offers/requests. Only a real
-- authenticated neighbour who deliberately sends an offer should create a row.
--
-- This migration:
--   1) Deletes every auto-generated suggestion offer already stored.
--   2) Installs a guard that silently drops any future row whose message is an
--      auto-suggestion, no matter which trigger/function tries to create it
--      (we do not need to know the generator's name, and we never break request creation).
--   3) Optionally disables (does not drop) any trigger on public.requests whose
--      function references public.help_matches, so nothing keeps firing it.

-- 1) Remove existing auto-suggested offers
delete from public.help_matches
where message ilike 'اقتراح تلقائي%'
   or message ilike 'اقتراح تلقائى%';

-- 2) Guard: reject/skip auto-suggested offers at the table level.
create or replace function app_private.block_auto_suggested_offers()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.message is not null
     and (new.message ilike 'اقتراح تلقائي%' or new.message ilike 'اقتراح تلقائى%') then
    -- Returning null cancels this row without raising, so any parent transaction
    -- (for example inserting the request itself) still succeeds.
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_auto_suggested_offers on public.help_matches;
create trigger trg_block_auto_suggested_offers
  before insert or update on public.help_matches
  for each row execute function app_private.block_auto_suggested_offers();

-- 3) Disable any trigger on public.requests that generates help_matches rows.
--    The guard above already neutralises it; disabling avoids wasted work.
do $$
declare
  r record;
begin
  for r in
    select t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public'
      and c.relname = 'requests'
      and not t.tgisinternal
      and pg_get_functiondef(p.oid) ilike '%help_matches%'
  loop
    execute format('alter table public.requests disable trigger %I', r.trigger_name);
    raise notice 'Disabled auto-suggestion trigger %.%', 'requests', r.trigger_name;
  end loop;
end $$;
