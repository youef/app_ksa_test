-- Neighbor Appreciation & Coffee Card (+10 Reputation Points)
-- and Neighbor Request Completion with Appreciation Rewards

create or replace function public.send_neighbor_appreciation(
  p_conversation_id uuid,
  p_recipient_id uuid,
  p_note text default 'كفو يا جارنا، بيض الله وجهك 🤍'
)
returns jsonb language plpgsql security definer set search_path=public,app_private,pg_catalog
as $$
declare
  v_sender uuid := auth.uid();
  v_sender_name text;
  v_msg_id uuid;
  v_pts integer := 10;
  v_clean_note text;
begin
  if v_sender is null then
    raise exception 'not_authenticated';
  end if;
  if p_recipient_id is null or p_recipient_id = v_sender then
    raise exception 'invalid_recipient';
  end if;
  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = v_sender
  ) then
    raise exception 'not_conversation_member';
  end if;

  v_clean_note := coalesce(nullif(trim(p_note), ''), 'كفو يا جارنا، بيض الله وجهك 🤍');

  -- Get sender name
  select coalesce(display_name, username, 'جارك') into v_sender_name
  from public.profiles where id = v_sender;

  -- Insert the structured appreciation message
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

  -- Award reputation points to recipient
  perform app_private.award_reputation(
    p_recipient_id,
    'neighbor_appreciation',
    v_pts,
    'message',
    v_msg_id
  );

  -- Notify the recipient (with target_type & target_id for navigation)
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

  return jsonb_build_object(
    'ok', true,
    'message_id', v_msg_id,
    'points', v_pts
  );
end $$;

-- Mark request as completed & reward helper with appreciation card
create or replace function public.complete_neighbor_request(
  p_request_id uuid,
  p_helper_id uuid,
  p_note text default 'بيض الله وجهك على الفزعة الكريمة 🤍'
)
returns jsonb language plpgsql security definer set search_path=public,app_private,pg_catalog
as $$
declare
  v_sender uuid := auth.uid();
  v_sender_name text;
  v_req_title text;
  v_conv_id uuid;
  v_msg_id uuid;
  v_helper_pts integer := 15;
  v_clean_note text;
begin
  if v_sender is null then
    raise exception 'not_authenticated';
  end if;

  -- Check ownership of request
  select title into v_req_title
  from public.requests
  where id = p_request_id and requester_id = v_sender;

  if v_req_title is null then
    raise exception 'not_request_owner';
  end if;

  v_clean_note := coalesce(nullif(trim(p_note), ''), 'بيض الله وجهك على الفزعة الكريمة 🤍');

  -- Update request to completed
  update public.requests
  set status = 'completed',
      accepted_by = coalesce(accepted_by, p_helper_id)
  where id = p_request_id;

  -- Update match status if exists
  if p_helper_id is not null then
    update public.help_matches
    set status = 'completed'
    where request_id = p_request_id and helper_id = p_helper_id;

    -- Award reputation to helper
    perform app_private.award_reputation(
      p_helper_id,
      'neighbor_request_completed',
      v_helper_pts,
      'request',
      p_request_id
    );

    -- Also small community bonus (+5) for requester
    perform app_private.award_reputation(
      v_sender,
      'request_closed_successfully',
      5,
      'request',
      p_request_id
    );

    -- Find conversation between them
    select c.id into v_conv_id
    from public.conversations c
    join public.conversation_members m1 on m1.conversation_id = c.id and m1.user_id = v_sender
    join public.conversation_members m2 on m2.conversation_id = c.id and m2.user_id = p_helper_id
    where c.is_group = false
    limit 1;

    -- Get sender name
    select coalesce(display_name, username, 'جارك') into v_sender_name
    from public.profiles where id = v_sender;

    -- If conversation exists, post appreciation card
    if v_conv_id is not null then
      insert into public.messages (conversation_id, sender_id, body, read_by)
      values (
        v_conv_id,
        v_sender,
        jsonb_build_object(
          'type', 'appreciation',
          'title', '☕ تمت الفزعة بنجاح! بطاقة شكر وقهوة',
          'note', v_clean_note,
          'points', v_helper_pts,
          'giver_name', v_sender_name,
          'request_id', p_request_id
        )::text,
        array[v_sender]
      )
      returning id into v_msg_id;
    end if;

    -- Notify helper
    insert into public.notifications (user_id, type, title, body, data, target_type, target_id)
    values (
      p_helper_id,
      'appreciation',
      '☕ تمت الفزعة وشكرك جارك!',
      'أتم جارك طلب «' || left(v_req_title, 40) || '» وشكرك بقهوة وتقدير (+15 نقطة سمعة ⭐)',
      jsonb_build_object(
        'kind', 'request_completed',
        'request_id', p_request_id,
        'points', v_helper_pts,
        'sender_id', v_sender
      ),
      case when v_conv_id is not null then 'conversation' else 'request' end,
      coalesce(v_conv_id, p_request_id)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'points', v_helper_pts,
    'conversation_id', v_conv_id
  );
end $$;

-- Ensure public.questions constraint allows 'solved' status
do $$
begin
  alter table public.questions drop constraint if exists questions_status_check;
  alter table public.questions add constraint questions_status_check
    check (status in ('open', 'solved', 'closed', 'resolved', 'archived'));
exception when others then
  null;
end $$;

-- Award best answer with reputation & notification
create or replace function public.award_best_answer(
  p_question_id uuid,
  p_answer_id uuid
)
returns jsonb language plpgsql security definer set search_path=public,app_private,pg_catalog
as $$
declare
  v_sender uuid := auth.uid();
  v_author_id uuid;
  v_ans_author_id uuid;
  v_q_title text;
  v_pts integer := 10;
begin
  if v_sender is null then
    raise exception 'not_authenticated';
  end if;

  select author_id, title into v_author_id, v_q_title
  from public.questions
  where id = p_question_id;

  if v_author_id is null or v_author_id <> v_sender then
    raise exception 'not_question_author';
  end if;

  select author_id into v_ans_author_id
  from public.answers
  where id = p_answer_id and question_id = p_question_id;

  if v_ans_author_id is null then
    raise exception 'answer_not_found';
  end if;

  -- Mark question as solved (with fallback for status check constraint)
  begin
    update public.questions
    set best_answer_id = p_answer_id,
        status = 'solved',
        solved_at = now()
    where id = p_question_id;
  exception when check_violation then
    begin
      update public.questions
      set best_answer_id = p_answer_id,
          status = 'closed',
          solved_at = now()
      where id = p_question_id;
    exception when others then
      update public.questions
      set best_answer_id = p_answer_id,
          solved_at = now()
      where id = p_question_id;
    end;
  end;

  -- Award reputation if not answering own question
  if v_ans_author_id <> v_sender then
    perform app_private.award_reputation(
      v_ans_author_id,
      'best_answer_awarded',
      v_pts,
      'answer',
      p_answer_id
    );

    insert into public.notifications (user_id, type, title, body, data, target_type, target_id)
    values (
      v_ans_author_id,
      'answer',
      '🌟 تم اعتماد ردك كأفضل إجابة!',
      'اعتمد جارك ردك كأفضل إجابة على: «' || left(v_q_title, 40) || '» (+10 نقاط سمعة ⭐)',
      jsonb_build_object(
        'kind', 'best_answer',
        'question_id', p_question_id,
        'points', v_pts
      ),
      'question',
      p_question_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'points', v_pts
  );
end $$;

revoke all on function public.send_neighbor_appreciation(uuid, uuid, text) from public, anon;
grant execute on function public.send_neighbor_appreciation(uuid, uuid, text) to authenticated;

revoke all on function public.complete_neighbor_request(uuid, uuid, text) from public, anon;
grant execute on function public.complete_neighbor_request(uuid, uuid, text) to authenticated;

revoke all on function public.award_best_answer(uuid, uuid) from public, anon;
grant execute on function public.award_best_answer(uuid, uuid) to authenticated;

-- Permissive direct message permission check for neighbors
create or replace function public.hayna_can_dm(p_sender uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $$
  select p_sender is not null and p_recipient is not null and p_sender <> p_recipient
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = p_sender and b.blocked_id = p_recipient)
         or (b.blocker_id = p_recipient and b.blocked_id = p_sender)
    );
$$;

-- Resilient get or create direct conversation between two users
create or replace function public.hayna_get_or_create_direct_conversation(p_target uuid)
returns uuid language plpgsql security definer set search_path=public,pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_conv uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_target is null or p_target = v_uid then raise exception 'invalid_target'; end if;
  if not exists (select 1 from public.profiles where id = p_target) then raise exception 'user_not_found'; end if;
  if not public.hayna_can_dm(v_uid, p_target) then raise exception 'dm_not_allowed'; end if;

  select c.id into v_conv
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.user_id = v_uid
  join public.conversation_members b on b.conversation_id = c.id and b.user_id = p_target
  where c.is_group is false
  order by c.created_at asc limit 1;

  if v_conv is null then
    insert into public.conversations(created_by, is_group)
    values(v_uid, false)
    returning id into v_conv;

    insert into public.conversation_members(conversation_id, user_id)
    values(v_conv, v_uid), (v_conv, p_target)
    on conflict do nothing;
  end if;

  return v_conv;
end $$;

grant execute on function public.hayna_can_dm(uuid, uuid) to authenticated;
grant execute on function public.hayna_get_or_create_direct_conversation(uuid) to authenticated;

notify pgrst, 'reload schema';

