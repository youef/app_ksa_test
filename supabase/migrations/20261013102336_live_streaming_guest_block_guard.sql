-- Prevent blocked participants from creating another guest request.
drop policy if exists live_guest_requests_create_self on public.live_guest_requests;
create policy live_guest_requests_create_self on public.live_guest_requests
  for insert to authenticated with check (
    guest_id = (select auth.uid()) and status = 'pending' and exists (
      select 1 from public.live_streams s where s.id = stream_id and s.status = 'live'
        and s.host_id <> (select auth.uid())
    ) and not exists (
      select 1 from public.live_user_blocks b
      where b.stream_id = stream_id and b.blocked_user_id = (select auth.uid())
    )
  );
