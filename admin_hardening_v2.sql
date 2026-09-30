-- Admin hardening applied to Supabase project hayna.
-- Keeps the database-backed admin model in source control.

drop policy if exists "admin_notifications_insert" on public.notifications;
create policy "admin_notifications_insert"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
for update to authenticated
using ((select auth.uid()) = id or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check ((select auth.uid()) = id or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "admin_verif_update" on public.verification_requests;
create policy "admin_verif_update" on public.verification_requests
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "profile_badges_admin_insert" on public.profile_badges;
create policy "profile_badges_admin_insert" on public.profile_badges
for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "profile_badges_admin_delete" on public.profile_badges;
create policy "profile_badges_admin_delete" on public.profile_badges
for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

revoke execute on function public.is_admin_user() from anon, authenticated, public;
revoke execute on function public.admin_review_verification(uuid, text) from anon, public;
grant execute on function public.admin_review_verification(uuid, text) to authenticated;
revoke execute on function public.mark_messages_read(uuid, uuid) from anon, public;
grant execute on function public.mark_messages_read(uuid, uuid) to authenticated;
revoke execute on function public.record_story_view(uuid, uuid) from anon, public;
grant execute on function public.record_story_view(uuid, uuid) to authenticated;
revoke execute on function public.toggle_follow(uuid, boolean) from anon, public;
grant execute on function public.toggle_follow(uuid, boolean) to authenticated;
