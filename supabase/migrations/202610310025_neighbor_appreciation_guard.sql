-- SECURITY REVIEW REQUIRED: draft-only until staging role tests and rollback verification.
-- Bound appreciation reputation to real conversation members and prevent repeated awards.
-- No existing messages or reputation balances are modified by this migration.

create table if not exists app_private.neighbor_appreciation_daily (
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  award_day date not null,
  created_at timestamptz not null default now(),
  constraint neighbor_appreciation_daily_pkey
    primary key (sender_id, recipient_id, conversation_id, award_day)
);

create index if not exists neighbor_appreciation_daily_sender_day_idx
  on app_private.neighbor_appreciation_daily (sender_id, award_day);

alter table app_private.neighbor_appreciation_daily enable row level security;
revoke all on table app_private.neighbor_appreciation_daily from public, anon, authenticated;

create or replace function public.send_neighbor_appreciation(
  p_conversation_id uuid,
  p_recipient_id uuid,
  p_note text default 'كفو يا جارنا، بيض الله وجهك 🤍'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_sender uuid := auth.uid();
  v_sender_name text;
  v_msg_id uuid;
  v_pts integer := 10;
  v_clean_note text;
  v_award_day date := (now() at time zone 'UTC')::date;
  v_sent_today bigint;
begin
  if v_sender is null then
    raise exception 'not_authenticated';
  end if;
  if p_conversation_id is null or p_recipient_id is null or p_recipient_id = v_sender then
    raise exception 'invalid_recipient';
  end if;
  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = v_sender
  ) then
    raise exception 'not_conversation_member';
  end if;
  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = p_recipient_id
  ) then
    raise exception 'recipient_not_conversation_member';
  end if;

  -- Serialize same-sender awards to prevent concurrent requests bypassing the daily cap.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_sender::text, 0));
  select count(*) into v_sent_today
  from app_private.neighbor_appreciation_daily
  where sender_id = v_sender and award_day = v_award_day;
  if v_sent_today >= 10 then
    raise exception 'appreciation_daily_limit';
  end if;

  -- Reserve this sender/recipient/conversation/day exactly once, atomically.
  insert into app_private.neighbor_appreciation_daily (
    sender_id, recipient_id, conversation_id, award_day
  ) values (v_sender, p_recipient_id, p_conversation_id, v_award_day)
  on conflict do nothing;
  if not found then
    raise exception 'appreciation_already_sent_today';
  end if;

  v_clean_note := coalesce(nullif(trim(p_note), ''), 'كفو يا جارنا، بيض الله وجهك 🤍');
  select coalesce(display_name, username, 'جارك') into v_sender_name
  from public.profiles where id = v_sender;

  insert into public.messages (conversation_id, sender_id, body, read_by)
  values (
    p_conversation_id,
    v_sender,
    jsonb_build_object(
      'type', 'appreciation',
      'title', '☕ بطاقة شكر وقهوة الجيران',
      'note', v_clean_note,
      'points', v_pts,
      'giver_name', v_sender_name
    )::text,
    array[v_sender]
  )
  returning id into v_msg_id;

  perform app_private.award_reputation(
    p_recipient_id, 'neighbor_appreciation', v_pts, 'message', v_msg_id
  );

  insert into public.notifications (user_id, type, title, body, data, target_type, target_id)
  values (
    p_recipient_id,
    'appreciation',
    '☕ وصلتك قهوة وشكر من جارك!',
    v_clean_note || ' (+10 نقاط سمعة ⭐)',
    jsonb_build_object(
      'kind', 'appreciation',
      'sender_id', v_sender,
      'conversation_id', p_conversation_id,
      'points', v_pts
    ),
    'conversation',
    p_conversation_id
  );

  return jsonb_build_object('ok', true, 'message_id', v_msg_id, 'points', v_pts);
end $$;

revoke all on function public.send_neighbor_appreciation(uuid, uuid, text) from public, anon;
grant execute on function public.send_neighbor_appreciation(uuid, uuid, text) to authenticated;
