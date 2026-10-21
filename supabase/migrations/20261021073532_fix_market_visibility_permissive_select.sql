
-- RLS requires at least one PERMISSIVE policy for a command.
-- These visibility policies were RESTRICTIVE-only, which blocked INSERT ... RETURNING
-- and normal reads even when their predicates were true.

drop policy if exists "market moderation visibility" on public.services;
create policy "market moderation visibility"
on public.services
as permissive
for select
to anon, authenticated
using (
  moderation_status = 'approved'
  or provider_id = auth.uid()
  or public.hayna_is_staff(auth.uid())
);

drop policy if exists "business moderation visibility" on public.businesses;
create policy "business moderation visibility"
on public.businesses
as permissive
for select
to anon, authenticated
using (
  moderation_status = 'approved'
  or owner_id = auth.uid()
  or public.hayna_is_staff(auth.uid())
);
