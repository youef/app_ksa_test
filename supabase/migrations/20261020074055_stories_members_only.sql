-- Keep existing audience rules, and require a registered member for every story read.
create policy stories_require_member
on public.stories as restrictive
for select to public
using ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false');
