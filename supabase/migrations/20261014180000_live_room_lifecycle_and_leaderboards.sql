create table if not exists public.live_gift_events (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('🎁', '💎', '🌟', '🔥')),
  created_at timestamptz not null default now()
);

create index if not exists live_gift_events_stream_created_idx
  on public.live_gift_events (stream_id, created_at desc);
create index if not exists live_gift_events_stream_sender_idx
  on public.live_gift_events (stream_id, sender_id);
create index if not exists live_streams_stale_idx
  on public.live_streams (updated_at) where status = 'live';

alter table public.live_gift_events enable row level security;
grant insert on public.live_gift_events to authenticated;

drop policy if exists live_gifts_read_active on public.live_gift_events;

drop policy if exists live_gifts_send_self on public.live_gift_events;
create policy live_gifts_send_self on public.live_gift_events
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and exists (
      select 1 from public.live_streams s
      where s.id = stream_id and s.status = 'live'
        and (
          s.host_id = (select auth.uid())
          or s.audience = 'public'
          or (s.audience = 'followers' and exists (
            select 1 from public.follows f
            where f.follower_id = (select auth.uid()) and f.following_id = s.host_id
          ))
          or (s.audience = 'city' and exists (
            select 1 from public.profiles viewer join public.profiles host
              on pg_catalog.lower(viewer.city) = pg_catalog.lower(host.city)
            where viewer.id = (select auth.uid()) and host.id = s.host_id and viewer.city is not null
          ))
        )
        and not exists (
          select 1 from public.live_user_blocks b
          where b.stream_id = s.id and b.blocked_user_id = (select auth.uid())
        )
    )
  );

create or replace function public.live_limit_gift_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.live_gift_events g
    where g.stream_id = new.stream_id
      and g.sender_id = new.sender_id
      and g.created_at > pg_catalog.now() - interval '2 seconds'
  ) then
    raise exception 'يمكنك إرسال هدية مجانية كل ثانيتين.';
  end if;
  return new;
end;
$$;

drop trigger if exists live_gifts_rate_limit_trigger on public.live_gift_events;
create trigger live_gifts_rate_limit_trigger
  before insert on public.live_gift_events
  for each row execute function public.live_limit_gift_rate();

create or replace function public.live_limit_chat_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.live_chat_messages
  where stream_id = new.stream_id
    and id not in (
      select id
      from public.live_chat_messages
      where stream_id = new.stream_id
      order by created_at desc, id desc
      limit 10
    );
  return new;
end;
$$;

drop trigger if exists live_chat_keep_recent_trigger on public.live_chat_messages;
create trigger live_chat_keep_recent_trigger
  after insert on public.live_chat_messages
  for each row execute function public.live_limit_chat_history();

delete from public.live_chat_messages m
using (
  select ranked.id
  from (
    select chat.id,
           pg_catalog.row_number() over (
             partition by chat.stream_id
             order by chat.created_at desc, chat.id desc
           ) as message_rank
    from public.live_chat_messages chat
    join public.live_streams s on s.id = chat.stream_id
    where s.status = 'live'
  ) ranked
  where ranked.message_rank > 10
) old_messages
where m.id = old_messages.id;

create or replace function public.expire_stale_live_streams()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  update public.live_streams
  set status = 'ended',
      ended_at = coalesce(ended_at, updated_at)
  where status = 'live'
    and updated_at < pg_catalog.now() - interval '90 seconds';
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function public.expire_stale_live_streams() from public, anon;
grant execute on function public.expire_stale_live_streams() to authenticated;

create or replace function public.get_live_host_leaderboard()
returns table (
  host_id uuid,
  display_name text,
  avatar_url text,
  is_verified boolean,
  stream_count bigint,
  total_minutes bigint,
  peak_viewers integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.host_id,
         coalesce(p.display_name, p.username, 'جارٍ'),
         p.avatar_url,
         coalesce(p.is_verified, false),
         count(*)::bigint,
         (sum(greatest(0, extract(epoch from (
           coalesce(s.ended_at, pg_catalog.now()) - s.started_at
         )))) / 60)::bigint,
         max(s.peak_viewer_count)::integer
  from public.live_streams s
  join public.profiles p on p.id = s.host_id
  where s.started_at >= pg_catalog.now() - interval '30 days'
    and (
      s.status = 'ended'
      or s.updated_at >= pg_catalog.now() - interval '90 seconds'
    )
  group by s.host_id, p.display_name, p.username, p.avatar_url, p.is_verified
  order by count(*) desc,
           sum(greatest(0, extract(epoch from (
             coalesce(s.ended_at, pg_catalog.now()) - s.started_at
           )))) desc,
           max(s.peak_viewer_count) desc
  limit 10;
$$;

revoke all on function public.get_live_host_leaderboard() from public, anon;
grant execute on function public.get_live_host_leaderboard() to authenticated;

create or replace function public.get_live_supporters(p_stream_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  is_verified boolean,
  gifts_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.sender_id,
         coalesce(p.display_name, p.username, 'جارٍ'),
         p.avatar_url,
         coalesce(p.is_verified, false),
         count(*)::bigint
  from public.live_gift_events g
  join public.live_streams s on s.id = g.stream_id and s.status = 'live'
  join public.profiles p on p.id = g.sender_id
  where g.stream_id = p_stream_id
    and (
      s.host_id = (select auth.uid())
      or s.audience = 'public'
      or (s.audience = 'followers' and exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid()) and f.following_id = s.host_id
      ))
      or (s.audience = 'city' and exists (
        select 1 from public.profiles viewer join public.profiles host
          on pg_catalog.lower(viewer.city) = pg_catalog.lower(host.city)
        where viewer.id = (select auth.uid()) and host.id = s.host_id and viewer.city is not null
      ))
    )
    and not exists (
      select 1 from public.live_user_blocks b
      where b.stream_id = s.id and b.blocked_user_id = (select auth.uid())
    )
  group by g.sender_id, p.display_name, p.username, p.avatar_url, p.is_verified
  order by count(*) desc, max(g.created_at) desc
  limit 5;
$$;

revoke all on function public.get_live_supporters(uuid) from public, anon;
grant execute on function public.get_live_supporters(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_gift_events'
  ) then
    alter publication supabase_realtime add table public.live_gift_events;
  end if;
end
$$;
