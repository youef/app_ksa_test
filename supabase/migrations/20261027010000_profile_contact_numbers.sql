create table if not exists public.profile_contact_numbers (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 phone text not null check (phone ~ '^\+?[0-9]{9,15}$'),
 is_visible boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.profile_contact_numbers enable row level security;
revoke all on public.profile_contact_numbers from anon, authenticated;
grant select on public.profile_contact_numbers to anon, authenticated;
grant insert, update, delete on public.profile_contact_numbers to authenticated;
create policy "contact owner read" on public.profile_contact_numbers for select to authenticated using (user_id = (select auth.uid()));
create policy "contact public read" on public.profile_contact_numbers for select to anon, authenticated using (is_visible and exists (select 1 from public.profiles p where p.id = user_id and coalesce(p.profile_privacy,'public') = 'public' and coalesce(p.hide_name,false) = false and coalesce(p.is_banned,false) = false) and not exists (select 1 from public.blocks b where (b.blocker_id = (select auth.uid()) and b.blocked_id = user_id) or (b.blocked_id = (select auth.uid()) and b.blocker_id = user_id)));
create policy "contact owner insert" on public.profile_contact_numbers for insert to authenticated with check (user_id = (select auth.uid()));
create policy "contact owner update" on public.profile_contact_numbers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "contact owner delete" on public.profile_contact_numbers for delete to authenticated using (user_id = (select auth.uid()));