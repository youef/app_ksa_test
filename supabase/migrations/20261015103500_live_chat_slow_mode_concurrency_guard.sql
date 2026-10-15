-- Serialize same-user comment inserts to prevent simultaneous requests bypassing slow mode.
create or replace function public.live_guard_chat_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_settings public.live_stream_moderation_settings%rowtype;
  v_host uuid;
  v_slow integer;
  v_recent integer;
  v_viewers integer;
  v_term text;
begin
  if v_actor is null or new.sender_id <> v_actor then raise exception 'هوية المرسل غير صالحة.'; end if;
  select s.host_id into v_host from public.live_streams s where s.id=new.stream_id and s.status='live';
  if v_host is null then raise exception 'هذا البث غير نشط.'; end if;
  if exists(select 1 from public.live_user_blocks b where b.stream_id=new.stream_id and b.blocked_user_id=v_actor) then
    raise exception 'لا يمكنك التعليق في هذا البث.';
  end if;
  delete from public.live_chat_timeouts t where t.stream_id=new.stream_id and t.expires_at <= now();
  if v_actor <> v_host and exists(select 1 from public.live_chat_timeouts t where t.stream_id=new.stream_id and t.user_id=v_actor and t.expires_at > now()) then
    raise exception 'أنت محظور مؤقتًا من التعليق في هذا البث.';
  end if;

  -- One transaction at a time per sender/stream so two near-simultaneous inserts cannot evade slow mode.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.stream_id::text || ':' || v_actor::text, 0));

  select * into v_settings from public.live_stream_moderation_settings where stream_id=new.stream_id;
  if coalesce(v_settings.block_links,true) and new.body ~* '(https?://|www\.|t\.me/|wa\.me/)' then
    raise exception 'الروابط غير مسموحة في تعليقات هذا البث.';
  end if;
  foreach v_term in array coalesce(v_settings.blocked_terms,'{}') loop
    if length(trim(v_term)) > 0 and position(lower(trim(v_term)) in lower(new.body)) > 0 then
      raise exception 'يحتوي التعليق على كلمة غير مسموحة.';
    end if;
  end loop;

  v_slow := coalesce(v_settings.slow_mode_seconds,0);
  if coalesce(v_settings.adaptive_enabled,true) then
    select count(*)::integer into v_recent from public.live_chat_messages m
      where m.stream_id=new.stream_id and m.created_at > now()-interval '10 seconds';
    select coalesce(s.viewer_count,0) into v_viewers from public.live_streams s where s.id=new.stream_id;
    if v_recent >= 30 or v_viewers >= 250 then v_slow := greatest(v_slow,5);
    elsif v_recent >= 15 or v_viewers >= 100 then v_slow := greatest(v_slow,3);
    end if;
  end if;
  if v_slow > 0 and exists(
    select 1 from public.live_chat_messages m where m.stream_id=new.stream_id and m.sender_id=v_actor
      and m.created_at > now()-make_interval(secs => v_slow)
  ) then raise exception 'تم تفعيل إبطاء التعليقات؛ انتظر قليلًا قبل التعليق مجددًا.'; end if;

  new.body := left(trim(new.body),300);
  if new.body = '' then raise exception 'اكتب تعليقًا أولًا.'; end if;
  if v_actor = v_host then new.sender_role := 'host';
  elsif exists(select 1 from public.live_guest_requests g where g.stream_id=new.stream_id and g.guest_id=v_actor and g.status='accepted') then new.sender_role := 'guest';
  else new.sender_role := 'viewer'; end if;
  new.is_hidden := false;
  return new;
end;
$$;
revoke all on function public.live_guard_chat_insert() from public, anon, authenticated;
