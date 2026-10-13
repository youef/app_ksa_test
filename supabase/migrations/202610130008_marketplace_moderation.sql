-- Hold user submitted marketplace content for administrator review.
alter table public.services
  add column if not exists moderation_status text not null default 'approved';
alter table public.businesses
  add column if not exists moderation_status text not null default 'approved';
alter table public.events
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists category text,
  add column if not exists date_label text,
  add column if not exists attendees_count integer not null default 0,
  add column if not exists is_free boolean not null default true,
  add column if not exists agenda jsonb not null default '[]'::jsonb,
  add column if not exists guidelines text;

create index if not exists services_moderation_status_idx on public.services (moderation_status, created_at desc);
create index if not exists businesses_moderation_status_idx on public.businesses (moderation_status, created_at desc);
create index if not exists events_moderation_status_idx on public.events (moderation_status, created_at desc);

create or replace function public.enforce_marketplace_moderation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.moderation_status := 'pending';
  else
    -- Any owner edit sends a previously approved listing back to review.
    new.moderation_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists services_moderation_guard on public.services;
create trigger services_moderation_guard before insert or update on public.services
for each row execute function public.enforce_marketplace_moderation();
drop trigger if exists businesses_moderation_guard on public.businesses;
create trigger businesses_moderation_guard before insert or update on public.businesses
for each row execute function public.enforce_marketplace_moderation();
drop trigger if exists events_moderation_guard on public.events;
create trigger events_moderation_guard before insert or update on public.events
for each row execute function public.enforce_marketplace_moderation();

alter table public.services enable row level security;
alter table public.businesses enable row level security;
alter table public.events enable row level security;

drop policy if exists "market moderation visibility" on public.services;
create policy "market moderation public select" on public.services for select to anon, authenticated using (true);
create policy "market moderation visibility" on public.services as restrictive for select to anon, authenticated
using (
  moderation_status = 'approved'
  or provider_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
drop policy if exists "business moderation visibility" on public.businesses;
create policy "business moderation public select" on public.businesses for select to anon, authenticated using (true);
create policy "business moderation visibility" on public.businesses as restrictive for select to anon, authenticated
using (
  moderation_status = 'approved'
  or owner_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
drop policy if exists "event moderation visibility" on public.events;
create policy "event moderation public select" on public.events for select to anon, authenticated using (true);
create policy "event moderation visibility" on public.events as restrictive for select to anon, authenticated
using (
  moderation_status = 'approved'
  or organizer_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);

drop policy if exists "business owner insert" on public.businesses;
create policy "business owner insert" on public.businesses for insert to authenticated
with check (owner_id = (select auth.uid()));
drop policy if exists "business owner write restriction" on public.businesses;
create policy "business owner write restriction" on public.businesses as restrictive for insert to authenticated
with check (owner_id = (select auth.uid()));
drop policy if exists "event owner insert" on public.events;
create policy "event owner insert" on public.events for insert to authenticated
with check (organizer_id = (select auth.uid()));
drop policy if exists "event owner write restriction" on public.events;
create policy "event owner write restriction" on public.events as restrictive for insert to authenticated
with check (organizer_id = (select auth.uid()));

drop policy if exists "services admin update" on public.services;
create policy "services admin update" on public.services for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "business admin update" on public.businesses;
create policy "business admin update" on public.businesses for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "event admin update" on public.events;
create policy "event admin update" on public.events for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "market owner/admin update restriction" on public.services;
create policy "market owner/admin update restriction" on public.services as restrictive for update to authenticated
using (
  provider_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
)
with check (
  provider_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
drop policy if exists "business owner/admin update restriction" on public.businesses;
create policy "business owner/admin update restriction" on public.businesses as restrictive for update to authenticated
using (
  owner_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
)
with check (
  owner_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
drop policy if exists "event owner/admin update restriction" on public.events;
create policy "event owner/admin update restriction" on public.events as restrictive for update to authenticated
using (
  organizer_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
)
with check (
  organizer_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);

grant select on public.services, public.businesses, public.events to anon, authenticated;
grant insert, update on public.businesses, public.events to authenticated;
