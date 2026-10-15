-- Live guest queue upgrade: host invites a specific person (usually a friend)
-- to take a guest seat instead of waiting for an inbound request.
-- Additive only so older clients keep working.

-- 1) Host invites -----------------------------------------------------------
alter table public.live_guest_requests
  add column if not exists invited_by uuid references public.profiles(id) on delete set null;

-- The state machine gains an 'invited' state (host invites a specific person).
-- Drop any existing status check regardless of how it was named, then recreate it.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname from pg_catalog.pg_constraint
    where conrelid = 'public.live_guest_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* 'status\s*=\s*ANY'
  loop
    execute format('alter table public.live_guest_requests drop constraint %I', constraint_name);
  end loop;
  alter table public.live_guest_requests
    add constraint live_guest_requests_status_check
    check (status in ('pending', 'invited', 'accepted', 'rejected', 'removed', 'cancelled'));
end
$$;

-- The host may create an invite for someone else.
drop policy if exists live_guest_requests_host_invite on public.live_guest_requests;
create policy live_guest_requests_host_invite on public.live_guest_requests
  for insert to authenticated with check (
    invited_by = (select auth.uid())
    and status = 'invited'
    and guest_id <> (select auth.uid())
    and exists (
      select 1 from public.live_streams s
      where s.id = stream_id and s.host_id = (select auth.uid()) and s.status = 'live'
    )
    and not exists (
      select 1 from public.live_user_blocks b
      where b.stream_id = stream_id and b.blocked_user_id = guest_id
    )
  );

-- The invitee may accept or decline their own invite.
drop policy if exists live_guest_requests_invitee_respond on public.live_guest_requests;
create policy live_guest_requests_invitee_respond on public.live_guest_requests
  for update to authenticated using (
    guest_id = (select auth.uid()) and status = 'invited'
  ) with check (
    guest_id = (select auth.uid()) and status in ('accepted', 'rejected')
  );
