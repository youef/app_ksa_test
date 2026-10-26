-- Already applied to Hayna production as migration 20261026225519.
-- An email address must never grant administrator capabilities.
alter policy "Allow admins to modify app_branding" on public.app_branding
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and not p.is_banned
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and not p.is_banned
  ));
