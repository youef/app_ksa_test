-- Reversible removal from the directory, without deleting products, reviews or conversations.
begin;
alter table public.businesses add column if not exists archived_at timestamptz;
drop policy if exists "Archived businesses stay private to their owner and staff" on public.businesses;
create policy "Archived businesses stay private to their owner and staff" on public.businesses as restrictive for select to anon,authenticated
using (archived_at is null or owner_id=(select auth.uid()) or public.hayna_is_staff((select auth.uid())));
commit;
