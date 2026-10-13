-- Live video metadata, chat, guest requests, and moderation.
-- Media itself is handled by LiveKit; never store audio/video bytes here.

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  category text not null default 'عام' check (char_length(category) <= 40),
  audience text not null default 'public' check (audience in ('public', 'followers', 'city')),
  room_name text not null unique default ('hayna-' || gen_random_uuid()::text),
  status text not null default 'live' check (status in ('live', 'ended')),
  viewer_count integer not null default 0 check (viewer_count >= 0),
  peak_viewer_count integer not null default 0 check (peak_viewer_count >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_streams_status_started_idx
  on public.live_streams (status, started_at desc);
create index if not exists live_streams_host_status_idx
  on public.live_streams (host_id, status, started_at desc);

create table if not exists public.live_viewer_sessions (
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (stream_id, viewer_id)
);
create index if not exists live_viewer_sessions_seen_idx on public.live_viewer_sessions (stream_id, last_seen_at desc);

create or replace function public.live_viewer_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_seen_at := pg_catalog.now();
  return new;
end;
$$;
drop trigger if exists live_viewer_touch_trigger on public.live_viewer_sessions;
create trigger live_viewer_touch_trigger before insert or update on public.live_viewer_sessions
for each row execute function public.live_viewer_touch();

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists live_chat_stream_created_idx
  on public.live_chat_messages (stream_id, created_at desc);

create table if not exists public.live_guest_requests (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'removed', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (stream_id, guest_id)
);
create index if not exists live_guest_requests_stream_status_idx
  on public.live_guest_requests (stream_id, status, created_at);

create table if not exists public.live_user_blocks (
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (stream_id, blocked_user_id)
);

create table if not exists public.live_reports (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (stream_id, reporter_id)
);

alter table public.live_streams enable row level security;
alter table public.live_viewer_sessions enable row level security;
alter table public.live_chat_messages enable row level security;
alter table public.live_guest_requests enable row level security;
alter table public.live_user_blocks enable row level security;
alter table public.live_reports enable row level security;

grant select on public.live_streams to anon, authenticated;
grant insert, update, delete on public.live_streams to authenticated;
grant select, insert, update, delete on public.live_viewer_sessions to authenticated;
grant select on public.live_chat_messages to anon, authenticated;
grant insert, update, delete on public.live_chat_messages to authenticated;
grant select, insert, update, delete on public.live_guest_requests to authenticated;
grant select, insert, delete on public.live_user_blocks to authenticated;
grant select, insert on public.live_reports to authenticated;

drop policy if exists live_streams_read_live on public.live_streams;
create policy live_streams_read_live on public.live_streams
  for select to anon, authenticated using (
    host_id = (select auth.uid()) or (status = 'live' and (
      audience = 'public'
      or (audience = 'followers' and exists (
        select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = host_id
      ))
      or (audience = 'city' and exists (
        select 1 from public.profiles viewer join public.profiles host on lower(viewer.city) = lower(host.city)
        where viewer.id = (select auth.uid()) and host.id = live_streams.host_id and viewer.city is not null
      ))
    ))
  );
drop policy if exists live_streams_create_self on public.live_streams;
create policy live_streams_create_self on public.live_streams
  for insert to authenticated with check (host_id = (select auth.uid()) and status = 'live');
drop policy if exists live_streams_host_update on public.live_streams;
create policy live_streams_host_update on public.live_streams
  for update to authenticated using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));
drop policy if exists live_streams_host_delete on public.live_streams;
create policy live_streams_host_delete on public.live_streams
  for delete to authenticated using (host_id = (select auth.uid()));

drop policy if exists live_viewers_read_active on public.live_viewer_sessions;
create policy live_viewers_read_active on public.live_viewer_sessions
  for select to authenticated using (exists (
    select 1 from public.live_streams s where s.id = stream_id and s.status = 'live'
  ));
drop policy if exists live_viewers_self_manage on public.live_viewer_sessions;
create policy live_viewers_self_manage on public.live_viewer_sessions
  for all to authenticated using (viewer_id = (select auth.uid()))
  with check (viewer_id = (select auth.uid()) and exists (
    select 1 from public.live_streams s where s.id = stream_id and s.status = 'live'
  ));

drop policy if exists live_chat_read_visible on public.live_chat_messages;
create policy live_chat_read_visible on public.live_chat_messages
  for select to anon, authenticated using (
    exists (
      select 1 from public.live_streams s where s.id = stream_id and s.status = 'live'
        and (is_hidden = false or s.host_id = (select auth.uid()))
    )
  );
drop policy if exists live_chat_insert_self on public.live_chat_messages;
create policy live_chat_insert_self on public.live_chat_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and is_hidden = false and exists (
      select 1 from public.live_streams s
      where s.id = stream_id and s.status = 'live'
        and (s.host_id = (select auth.uid()) or not exists (
          select 1 from public.live_user_blocks b
          where b.stream_id = s.id and b.blocked_user_id = (select auth.uid())
        ))
        and not exists (
          select 1 from public.live_user_blocks b
          where b.stream_id = s.id and b.blocked_user_id = (select auth.uid())
        )
    )
  );
drop policy if exists live_chat_host_hide on public.live_chat_messages;
create policy live_chat_host_hide on public.live_chat_messages
  for update to authenticated using (
    exists (select 1 from public.live_streams s where s.id = stream_id and s.host_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.live_streams s where s.id = stream_id and s.host_id = (select auth.uid()))
  );

drop policy if exists live_guest_requests_read on public.live_guest_requests;
create policy live_guest_requests_read on public.live_guest_requests
  for select to authenticated using (
    guest_id = (select auth.uid()) or exists (
      select 1 from public.live_streams s where s.id = stream_id and s.host_id = (select auth.uid())
    )
  );
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
drop policy if exists live_guest_requests_guest_cancel on public.live_guest_requests;
create policy live_guest_requests_guest_cancel on public.live_guest_requests
  for update to authenticated using (guest_id = (select auth.uid()) and status = 'pending')
  with check (guest_id = (select auth.uid()) and status = 'cancelled');
drop policy if exists live_guest_requests_host_decide on public.live_guest_requests;
create policy live_guest_requests_host_decide on public.live_guest_requests
  for update to authenticated using (
    exists (select 1 from public.live_streams s where s.id = stream_id and s.host_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.live_streams s where s.id = stream_id and s.host_id = (select auth.uid()))
  );

drop policy if exists live_blocks_host_manage on public.live_user_blocks;
create policy live_blocks_host_manage on public.live_user_blocks
  for all to authenticated using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()) and exists (
    select 1 from public.live_streams s where s.id = stream_id and s.host_id = (select auth.uid())
  ));
drop policy if exists live_blocks_user_read_own on public.live_user_blocks;
create policy live_blocks_user_read_own on public.live_user_blocks
  for select to authenticated using (blocked_user_id = (select auth.uid()));

drop policy if exists live_reports_create_self on public.live_reports;
create policy live_reports_create_self on public.live_reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid()) and exists (
      select 1 from public.live_streams s where s.id = stream_id
    )
  );
drop policy if exists live_reports_read_own on public.live_reports;
create policy live_reports_read_own on public.live_reports
  for select to authenticated using (reporter_id = (select auth.uid()));

-- Realtime delivers live chat inserts. Keep membership in sync idempotently.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_chat_messages'
  ) then
    alter publication supabase_realtime add table public.live_chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_streams'
  ) then
    alter publication supabase_realtime add table public.live_streams;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_guest_requests'
  ) then
    alter publication supabase_realtime add table public.live_guest_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_viewer_sessions'
  ) then
    alter publication supabase_realtime add table public.live_viewer_sessions;
  end if;
end
$$;
