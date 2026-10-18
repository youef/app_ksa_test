-- Phase 2: public profile customization and featured activity
create table if not exists public.profile_customizations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  accent_color text not null default '#059669' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  banner_style text not null default 'emerald' check (banner_style in ('emerald','ocean','sunset','midnight')),
  show_stats boolean not null default true,
  show_badges boolean not null default true,
  featured_title text not null default 'أعمالي المميزة' check (char_length(featured_title) between 1 and 40),
  updated_at timestamptz not null default now()
);
alter table public.profile_customizations enable row level security;
create policy "profile customizations public read" on public.profile_customizations for select to anon, authenticated
using (exists (select 1 from public.profiles p where p.id = user_id and coalesce(p.hide_name,false) = false and coalesce(p.is_banned,false) = false and (coalesce(p.profile_privacy,'public') = 'public' or (auth.uid() is not null and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = user_id)))));
create policy "profile customization owner read" on public.profile_customizations for select to authenticated using ((select auth.uid()) = user_id);
create policy "profile customizations owner insert" on public.profile_customizations for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "profile customizations owner update" on public.profile_customizations for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.profile_customizations to anon, authenticated;
grant insert, update on public.profile_customizations to authenticated;

create table if not exists public.profile_featured_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('question','service','request','market')),
  item_id uuid not null,
  position smallint not null default 0 check (position between 0 and 9),
  created_at timestamptz not null default now(),
  unique(user_id, item_type, item_id)
);
create index if not exists profile_featured_items_user_position_idx on public.profile_featured_items(user_id, position, created_at desc);
alter table public.profile_featured_items enable row level security;
create policy "featured items public read" on public.profile_featured_items for select to anon, authenticated
using (exists (select 1 from public.profiles p where p.id = user_id and coalesce(p.hide_name,false) = false and coalesce(p.is_banned,false) = false and (coalesce(p.profile_privacy,'public') = 'public' or (auth.uid() is not null and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = user_id)))));
create policy "featured items owner insert" on public.profile_featured_items for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    (item_type = 'question' and exists (select 1 from public.questions q where q.id = item_id and q.author_id = (select auth.uid())))
    or (item_type = 'service' and exists (select 1 from public.services s where s.id = item_id and s.provider_id = (select auth.uid())))
    or (item_type = 'request' and exists (select 1 from public.requests r where r.id = item_id and r.requester_id = (select auth.uid())))
    or (item_type = 'market' and exists (select 1 from public.marketplace_items m where m.id = item_id and m.seller_id = (select auth.uid())))
  )
);
create policy "featured items owner delete" on public.profile_featured_items for delete to authenticated
using ((select auth.uid()) = user_id);
grant select on public.profile_featured_items to anon, authenticated;
grant insert, delete on public.profile_featured_items to authenticated;



-- Enforce the ten-item limit in the database, not only in the client.
create or replace function public.enforce_profile_featured_items_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'not_authorized';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select count(*) into current_count
  from public.profile_featured_items
  where user_id = new.user_id;
  if current_count >= 10 then
    raise exception 'featured_limit_reached';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_profile_featured_items_limit() from public, anon, authenticated;
create trigger enforce_profile_featured_items_limit_before_insert
before insert on public.profile_featured_items
for each row execute function public.enforce_profile_featured_items_limit();


-- Phase 2 extension: profile sections, identity modes, reusable templates and undo history.
alter table public.profile_customizations
  add column if not exists profile_type text not null default 'personal'
    check (profile_type in ('personal', 'business'));

alter table public.profile_customizations
  add column if not exists section_visibility jsonb not null
    default '{"bio":true,"services":true,"questions":true,"products":true,"reviews":true,"achievements":true}'::jsonb;

alter table public.profile_customizations
  add column if not exists section_order text[] not null
    default array['bio','services','questions','products','reviews','achievements']::text[];

alter table public.profile_customizations
  add column if not exists saved_templates jsonb not null default '[]'::jsonb;

alter table public.profile_customizations
  add column if not exists customization_history jsonb not null default '[]'::jsonb;


-- Private data is isolated from public profile styling to avoid exposing saved templates/history.
create table if not exists public.profile_customization_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  saved_templates jsonb not null default '[]'::jsonb,
  customization_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profile_customization_private enable row level security;
drop policy if exists "profile customization private owner access" on public.profile_customization_private;
create policy "profile customization private owner access"
  on public.profile_customization_private
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.profile_customization_private to authenticated;
