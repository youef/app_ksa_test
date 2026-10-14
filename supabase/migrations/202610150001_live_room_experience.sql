-- Live room experience: pinned chat, role labels, guest mute control,
-- weekly/monthly host rankings, and non-monetary host achievements.

-- 1) Chat: pinned messages and sender role captured at send time.
alter table public.live_chat_messages
  add column if not exists is_pinned boolean not null default false;
alter table public.live_chat_messages
  add column if not exists sender_role text not null default 'viewer';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint where conname = 'live_chat_messages_sender_role_check'
  ) then
    alter table public.live_chat_messages
      add constraint live_chat_messages_sender_role_check
      check (sender_role in ('host', 'guest', 'viewer'));
  end if;
end
$$;

update public.live_chat_messages m
set sender_role = case
  when exists (
    select 1 from public.live_streams s where s.id = m.stream_id and s.host_id = m.sender_id
  ) then 'host'
  when exists (
    select 1 from public.live_guest_requests g
    where g.stream_id = m.stream_id and g.guest_id = m.sender_id and g.status = 'accepted'
  ) then 'guest'
  else 'viewer'
end
where m.sender_role = 'viewer';

-- Only one pinned message per stream.
create unique index if not exists live_chat_one_pinned_idx
  on public.live_chat_messages (stream_id) where is_pinned;

create or replace function public.live_prepare_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Clients never pin on insert; the host pins afterwards through an update.
  new.is_pinned := false;
  if exists (
    select 1 from public.live_streams s where s.id = new.stream_id and s.host_id = new.sender_id
  ) then
    new.sender_role := 'host';
  elsif exists (
    select 1 from public.live_guest_requests g
    where g.stream_id = new.stream_id and g.guest_id = new.sender_id and g.status = 'accepted'
  ) then
    new.sender_role := 'guest';
  else
    new.sender_role := 'viewer';
  end if;
  return new;
end;
$$;

drop trigger if exists live_chat_prepare_trigger on public.live_chat_messages;
create trigger live_chat_prepare_trigger
  before insert on public.live_chat_messages
  for each row execute function public.live_prepare_chat_message();

-- Hiding a message also unpins it.
create or replace function public.live_chat_hide_unpins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_hidden then
    new.is_pinned := false;
  end if;
  return new;
end;
$$;

drop trigger if exists live_chat_hide_unpins_trigger on public.live_chat_messages;
create trigger live_chat_hide_unpins_trigger
  before update on public.live_chat_messages
  for each row execute function public.live_chat_hide_unpins();

-- Keep the pinned message plus the latest 10 in memory.
create or replace function public.live_limit_chat_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.live_chat_messages
  where stream_id = new.stream_id
    and is_pinned = false
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

-- 2) Guest microphone control: the host toggles it, the guest client applies it.
alter table public.live_guest_requests
  add column if not exists is_muted boolean not null default false;

-- 3) Weekly / monthly host leaderboard with an explicit period.
drop function if exists public.get_live_host_leaderboard();
create function public.get_live_host_leaderboard(p_period text default 'monthly')
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
  where s.started_at >= pg_catalog.now() - case
          when p_period = 'weekly' then interval '7 days'
          else interval '30 days'
        end
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

revoke all on function public.get_live_host_leaderboard(text) from public, anon;
grant execute on function public.get_live_host_leaderboard(text) to authenticated;

-- 4) Non-monetary host achievements. Criteria are explicit and time-bounded.
create or replace function public.get_live_host_achievements(p_host_id uuid default auth.uid())
returns table (key text, earned boolean, metric integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lifetime_streams integer;
  v_recent_streams integer;
  v_recent_minutes integer;
  v_recent_peak integer;
  v_recent_days integer;
begin
  if p_host_id is null then
    raise exception 'معرّف المستخدم مطلوب.';
  end if;

  select count(*)::integer
    into v_lifetime_streams
  from public.live_streams s
  where s.host_id = p_host_id
    and (s.status = 'ended' or s.updated_at >= pg_catalog.now() - interval '90 seconds');

  select count(*)::integer,
         (coalesce(sum(greatest(0, extract(epoch from (
           coalesce(s.ended_at, pg_catalog.now()) - s.started_at
         )))), 0) / 60)::integer,
         coalesce(max(s.peak_viewer_count), 0)::integer
    into v_recent_streams, v_recent_minutes, v_recent_peak
  from public.live_streams s
  where s.host_id = p_host_id
    and s.started_at >= pg_catalog.now() - interval '30 days'
    and (s.status = 'ended' or s.updated_at >= pg_catalog.now() - interval '90 seconds');

  select count(distinct pg_catalog.date_trunc('day', s.started_at))::integer
    into v_recent_days
  from public.live_streams s
  where s.host_id = p_host_id
    and s.started_at >= pg_catalog.now() - interval '30 days';

  return query
    select 'first_stream'::text, v_lifetime_streams >= 1, v_lifetime_streams
    union all select 'active_host'::text, v_recent_streams >= 4, v_recent_streams
    union all select 'community_voice'::text, v_recent_minutes >= 60, v_recent_minutes
    union all select 'neighborhood_star'::text, v_recent_peak >= 25, v_recent_peak
    union all select 'consistent_host'::text, v_recent_days >= 5, v_recent_days;
end;
$$;

revoke all on function public.get_live_host_achievements(uuid) from public, anon;
grant execute on function public.get_live_host_achievements(uuid) to authenticated;
