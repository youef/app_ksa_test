-- Harden live chat moderation and keep high-volume chat queries indexed.
-- Existing moderation tables and triggers are already in place; this migration fixes URL matching,
-- bounds filter settings at the database boundary, and supports the adaptive slow-mode query.

create index if not exists live_chat_messages_stream_created_idx
  on public.live_chat_messages (stream_id, created_at desc);

create index if not exists live_chat_messages_stream_sender_created_idx
  on public.live_chat_messages (stream_id, sender_id, created_at desc);

create or replace function public.live_guard_chat_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_settings public.live_stream_moderation_settings%rowtype;
  v_host uuid;
  v_slow integer;
  v_recent integer;
  v_viewers integer;
  v_term text;
begin
  if v_actor is null or new.sender_id <> v_actor then
    raise exception 'هوية المرسل غير صالحة.';
  end if;

  select s.host_id into v_host
  from public.live_streams s
  where s.id = new.stream_id and s.status = 'live';

  if v_host is null then
    raise exception 'هذا البث غير نشط.';
  end if;

  if exists (
    select 1 from public.live_user_blocks b
    where b.stream_id = new.stream_id and b.blocked_user_id = v_actor
  ) then
    raise exception 'لا يمكنك التعليق في هذا البث.';
  end if;

  delete from public.live_chat_timeouts t
  where t.stream_id = new.stream_id and t.expires_at <= pg_catalog.now();

  if v_actor <> v_host and exists (
    select 1 from public.live_chat_timeouts t
    where t.stream_id = new.stream_id and t.user_id = v_actor and t.expires_at > pg_catalog.now()
  ) then
    raise exception 'أنت محظور مؤقتًا من التعليق في هذا البث.';
  end if;

  -- Serialize messages from one sender in one stream to prevent concurrent slow-mode bypasses.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.stream_id::text || ':' || v_actor::text, 0)
  );

  select * into v_settings
  from public.live_stream_moderation_settings
  where stream_id = new.stream_id;

  if coalesce(v_settings.block_links, true)
     and new.body ~* '(https?://|www[.]|t[.]me/|wa[.]me/|bit[.]ly/|tinyurl[.]com/|linktr[.]ee/|[[:alnum:]-]+[.](com|net|org|io|co|me|ly|app|sa|info|biz|dev|site|xyz)(/[^[:space:]]*)?)' then
    raise exception 'الروابط غير مسموحة في تعليقات هذا البث.';
  end if;

  foreach v_term in array coalesce(v_settings.blocked_terms, '{}'::text[]) loop
    if length(trim(v_term)) > 0 and position(lower(trim(v_term)) in lower(new.body)) > 0 then
      raise exception 'يحتوي التعليق على كلمة غير مسموحة.';
    end if;
  end loop;

  v_slow := coalesce(v_settings.slow_mode_seconds, 0);
  if coalesce(v_settings.adaptive_enabled, true) then
    select count(*)::integer into v_recent
    from public.live_chat_messages m
    where m.stream_id = new.stream_id
      and m.created_at > pg_catalog.now() - interval '10 seconds';

    select coalesce(s.viewer_count, 0) into v_viewers
    from public.live_streams s
    where s.id = new.stream_id;

    if v_recent >= 30 or v_viewers >= 250 then
      v_slow := greatest(v_slow, 5);
    elsif v_recent >= 15 or v_viewers >= 100 then
      v_slow := greatest(v_slow, 3);
    end if;
  end if;

  if v_slow > 0 and exists (
    select 1 from public.live_chat_messages m
    where m.stream_id = new.stream_id
      and m.sender_id = v_actor
      and m.created_at > pg_catalog.now() - pg_catalog.make_interval(secs => v_slow)
  ) then
    raise exception 'تم تفعيل إبطاء التعليقات؛ انتظر قليلًا قبل التعليق مجددًا.';
  end if;

  new.body := left(trim(new.body), 300);
  if new.body = '' then
    raise exception 'اكتب تعليقًا أولًا.';
  end if;

  if v_actor = v_host then
    new.sender_role := 'host';
  elsif exists (
    select 1 from public.live_guest_requests g
    where g.stream_id = new.stream_id and g.guest_id = v_actor and g.status = 'accepted'
  ) then
    new.sender_role := 'guest';
  else
    new.sender_role := 'viewer';
  end if;

  new.is_hidden := false;
  new.is_pinned := false;
  return new;
end;
$function$;

create or replace function public.update_live_moderation_settings(
  p_stream_id uuid,
  p_slow_mode_seconds integer,
  p_block_links boolean,
  p_blocked_terms text[],
  p_adaptive_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_terms text[];
begin
  if v_actor is null or not public.live_has_moderation_permission(p_stream_id, v_actor, 'filters') then
    raise exception 'ليست لديك صلاحية إدارة إعدادات التعليقات.';
  end if;

  if p_slow_mode_seconds is null or p_slow_mode_seconds < 0 or p_slow_mode_seconds > 60 then
    raise exception 'الإبطاء يجب أن يكون بين 0 و60 ثانية.';
  end if;

  select coalesce(array_agg(t.term), '{}'::text[]) into v_terms
  from (
    select left(trim(term), 60) as term
    from unnest(coalesce(p_blocked_terms, '{}'::text[])) as terms(term)
    where trim(term) <> ''
    limit 100
  ) as t;

  insert into public.live_stream_moderation_settings(
    stream_id, slow_mode_seconds, block_links, blocked_terms, adaptive_enabled, updated_by, updated_at
  )
  values (
    p_stream_id, p_slow_mode_seconds, coalesce(p_block_links, true),
    coalesce(v_terms, '{}'::text[]), coalesce(p_adaptive_enabled, true), v_actor, pg_catalog.now()
  )
  on conflict (stream_id) do update set
    slow_mode_seconds = excluded.slow_mode_seconds,
    block_links = excluded.block_links,
    blocked_terms = excluded.blocked_terms,
    adaptive_enabled = excluded.adaptive_enabled,
    updated_by = excluded.updated_by,
    updated_at = pg_catalog.now();

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.update_live_moderation_settings(uuid, integer, boolean, text[], boolean) from public, anon;
grant execute on function public.update_live_moderation_settings(uuid, integer, boolean, text[], boolean) to authenticated;
