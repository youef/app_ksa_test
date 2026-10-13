-- ============================================================
-- 202610130007_user_edit_limits_and_deletes.sql
-- Allow users to delete and edit their own questions, requests, alerts, services
-- Condition: max 2 edits allowed per post/record.
-- ============================================================

-- 1. Add edit_count column to all core user-generated tables
alter table if exists public.questions add column if not exists edit_count int not null default 0;
alter table if exists public.requests add column if not exists edit_count int not null default 0;
alter table if exists public.urgent_alerts add column if not exists edit_count int not null default 0;
alter table if exists public.services add column if not exists edit_count int not null default 0;

-- 2. Questions RLS: Delete and Update by author
alter table public.questions enable row level security;

drop policy if exists "Authors and admins can delete questions" on public.questions;
create policy "Authors and admins can delete questions"
  on public.questions for delete
  to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Authors and admins can update questions" on public.questions;
create policy "Authors and admins can update questions"
  on public.questions for update
  to authenticated
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 3. Requests RLS: Delete and Update by requester
alter table public.requests enable row level security;

drop policy if exists "Requesters and admins can delete requests" on public.requests;
create policy "Requesters and admins can delete requests"
  on public.requests for delete
  to authenticated
  using (
    auth.uid() = requester_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Requesters and admins can update requests" on public.requests;
create policy "Requesters and admins can update requests"
  on public.requests for update
  to authenticated
  using (
    auth.uid() = requester_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() = requester_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 4. Urgent Alerts RLS: Delete and Update by creator
alter table public.urgent_alerts enable row level security;

drop policy if exists "Creators and admins can delete urgent alerts" on public.urgent_alerts;
create policy "Creators and admins can delete urgent alerts"
  on public.urgent_alerts for delete
  to authenticated
  using (
    auth.uid() = creator_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Creators and admins can update urgent alerts" on public.urgent_alerts;
create policy "Creators and admins can update urgent alerts"
  on public.urgent_alerts for update
  to authenticated
  using (
    auth.uid() = creator_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() = creator_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 5. Services RLS: Delete and Update by provider
alter table public.services enable row level security;

drop policy if exists "Providers and admins can delete services" on public.services;
create policy "Providers and admins can delete services"
  on public.services for delete
  to authenticated
  using (
    auth.uid() = provider_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Providers and admins can update services" on public.services;
create policy "Providers and admins can update services"
  on public.services for update
  to authenticated
  using (
    auth.uid() = provider_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() = provider_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
