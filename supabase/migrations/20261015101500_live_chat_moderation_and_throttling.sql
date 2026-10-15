-- Live chat moderation: moderators, expiring timeouts, filters, slow mode and adaptive throttling.
create table if not exists public.live_stream_moderators (
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_hide_comments boolean not null default true,
  can_timeout_users boolean not null default false,
  can_manage_filters boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (stream_id, user_id),
  check (can_hide_comments or can_timeout_users or can_manage_filters)
);
create table if not exists public.live_chat_timeouts (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  moderator_id uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index if not exists live_chat_timeouts_active_idx on public.live_chat_timeouts(stream_id, user_id, expires_at desc);
create table if not exists public.live_stream_moderation_settings (
  stream_id uuid primary key references public.live_streams(id) on delete cascade,
  slow_mode_seconds smallint not null default 0 check (slow_mode_seconds between 0 and 60),
  block_links boolean not null default true,
  blocked_terms text[] not null default '{}',
  adaptive_enabled boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.live_stream_moderators enable row level security;
alter table public.live_chat_timeouts enable row level security;
alter table public.live_stream_moderation_settings enable row level security;

drop policy if exists live_moderators_read_host_or_self on public.live_stream_moderators;
create policy live_moderators_read_host_or_self on public.live_stream_moderators for select to authenticated
using (user_id = (select auth.uid()) or exists(select 1 from public.live_streams s where s.id = stream_id and s.host_id = (select auth.uid())));
drop policy if exists live_moderation_settings_read_live on public.live_stream_moderation_settings;
create policy live_moderation_settings_read_live on public.live_stream_moderation_settings for select to authenticated
using (exists(select 1 from public.live_streams s where s.id = stream_id and (s.status = 'live' or s.host_id = (select auth.uid()))));
revoke all on public.live_stream_moderators from anon, authenticated;
grant select on public.live_stream_moderators to authenticated;
revoke all on public.live_chat_timeouts from anon, authenticated;
revoke all on public.live_stream_moderation_settings from anon, authenticated;
grant select on public.live_stream_moderation_settings to authenticated;

create or replace function public.live_has_moderation_permission(p_stream_id uuid, p_user_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.live_streams s where s.id = p_stream_id and s.host_id = p_user_id)
  or exists (
    select 1 from public.live_stream_moderators m
    where m.stream_id = p_stream_id and m.user_id = p_user_id
      and case p_permission when 'hide' then m.can_hide_comments when 'timeout' then m.can_timeout_users
        when 'filters' then m.can_manage_filters else false end
  );
$$;
revoke all on function public.live_has_moderation_permission(uuid, uuid, text) from public, anon;
grant execute on function public.live_has_moderation_permission(uuid, uuid, text) to authenticated;

create or replace function public.manage_live_moderator(
  p_stream_id uuid, p_username text, p_action text,
  p_can_hide_comments boolean default true, p_can_timeout_users boolean default false,
  p_can_manage_filters boolean default false
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_target uuid;
begin
  if v_actor is null then raise exception 'يجب تسجيل الدخول.'; end if;
  if not exists(select 1 from public.live_streams s where s.id=p_stream_id and s.host_id=v_actor and s.status='live') then raise exception 'هذه الصلاحية للمضيف فقط.'; end if;
  if lower(coalesce(p_action,'')) not in ('add','remove') then raise exception 'إجراء غير صالح.'; end if;
  select p.id into v_target from public.profiles p where lower(p.username)=lower(trim(p_username)) limit 1;
  if v_target is null then raise exception 'لم نعثر على مستخدم بهذا المعرّف.'; end if;
  if v_target = v_actor then raise exception 'لا يمكن تعيين نفسك مشرفًا.'; end if;
  if p_action='remove' then
    delete from public.live_stream_moderators where stream_id=p_stream_id and user_id=v_target;
  else
    if not (p_can_hide_comments or p_can_timeout_users or p_can_manage_filters) then raise exception 'اختر صلاحية واحدة على الأقل.'; end if;
    insert into public.live_stream_moderators(stream_id,user_id,can_hide_comments,can_timeout_users,can_manage_filters,created_by)
    values(p_stream_id,v_target,p_can_hide_comments,p_can_timeout_users,p_can_manage_filters,v_actor)
    on conflict(stream_id,user_id) do update set can_hide_comments=excluded.can_hide_comments,
      can_timeout_users=excluded.can_timeout_users, can_manage_filters=excluded.can_manage_filters,
      created_by=excluded.created_by, created_at=now();
  end if;
  return jsonb_build_object('ok',true,'username',lower(trim(p_username)),'action',p_action);
end;
$$;
revoke all on function public.manage_live_moderator(uuid,text,text,boolean,boolean,boolean) from public, anon;
grant execute on function public.manage_live_moderator(uuid,text,text,boolean,boolean,boolean) to authenticated;

create or replace function public.update_live_moderation_settings(
  p_stream_id uuid, p_slow_mode_seconds integer, p_block_links boolean,
  p_blocked_terms text[], p_adaptive_enabled boolean
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_terms text[];
begin
  if v_actor is null or not public.live_has_moderation_permission(p_stream_id,v_actor,'filters') then raise exception 'ليست لديك صلاحية إدارة إعدادات التعليقات.'; end if;
  if p_slow_mode_seconds < 0 or p_slow_mode_seconds > 60 then raise exception 'الإبطاء يجب أن يكون بين 0 و60 ثانية.'; end if;
  select coalesce(array_agg(left(trim(term),60)), '{}') into v_terms
  from unnest(coalesce(p_blocked_terms,'{}')) term where trim(term) <> '';
  insert into public.live_stream_moderation_settings(stream_id,slow_mode_seconds,block_links,blocked_terms,adaptive_enabled,updated_by,updated_at)
  values(p_stream_id,p_slow_mode_seconds,p_block_links,coalesce(v_terms,'{}'),p_adaptive_enabled,v_actor,now())
  on conflict(stream_id) do update set slow_mode_seconds=excluded.slow_mode_seconds,
    block_links=excluded.block_links,blocked_terms=excluded.blocked_terms,
    adaptive_enabled=excluded.adaptive_enabled,updated_by=excluded.updated_by,updated_at=now();
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.update_live_moderation_settings(uuid,integer,boolean,text[],boolean) from public, anon;
grant execute on function public.update_live_moderation_settings(uuid,integer,boolean,text[],boolean) to authenticated;

create or replace function public.timeout_live_chat_user(p_stream_id uuid, p_user_id uuid, p_minutes integer, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_expiry timestamptz;
begin
  if v_actor is null or not public.live_has_moderation_permission(p_stream_id,v_actor,'timeout') then raise exception 'ليست لديك صلاحية الحظر المؤقت.'; end if;
  if p_user_id = v_actor or p_minutes < 1 or p_minutes > 10080 then raise exception 'مدة الحظر أو المستخدم غير صالح.'; end if;
  if exists(select 1 from public.live_streams s where s.id=p_stream_id and s.host_id=p_user_id) then raise exception 'لا يمكن حظر مضيف البث.'; end if;
  v_expiry := now() + make_interval(mins => p_minutes);
  insert into public.live_chat_timeouts(stream_id,user_id,moderator_id,expires_at,reason)
  values(p_stream_id,p_user_id,v_actor,v_expiry,left(coalesce(p_reason,''),200));
  return jsonb_build_object('ok',true,'expires_at',v_expiry);
end;
$$;
revoke all on function public.timeout_live_chat_user(uuid,uuid,integer,text) from public, anon;
grant execute on function public.timeout_live_chat_user(uuid,uuid,integer,text) to authenticated;

create or replace function public.live_guard_chat_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_settings public.live_stream_moderation_settings%rowtype;
  v_host uuid; v_slow integer; v_recent integer; v_viewers integer; v_term text;
begin
  if v_actor is null or new.sender_id <> v_actor then raise exception 'هوية المرسل غير صالحة.'; end if;
  select s.host_id into v_host from public.live_streams s where s.id=new.stream_id and s.status='live';
  if v_host is null then raise exception 'هذا البث غير نشط.'; end if;
  if exists(select 1 from public.live_user_blocks b where b.stream_id=new.stream_id and b.blocked_user_id=v_actor) then raise exception 'لا يمكنك التعليق في هذا البث.'; end if;
  if v_actor <> v_host and exists(select 1 from public.live_chat_timeouts t where t.stream_id=new.stream_id and t.user_id=v_actor and t.expires_at > now()) then raise exception 'أنت محظور مؤقتًا من التعليق في هذا البث.'; end if;
  select * into v_settings from public.live_stream_moderation_settings where stream_id=new.stream_id;
  if coalesce(v_settings.block_links,true) and new.body ~* '(https?://|www\.|t\.me/|wa\.me/)' then raise exception 'الروابط غير مسموحة في تعليقات هذا البث.'; end if;
  foreach v_term in array coalesce(v_settings.blocked_terms,'{}') loop
    if length(trim(v_term)) > 0 and position(lower(trim(v_term)) in lower(new.body)) > 0 then raise exception 'يحتوي التعليق على كلمة غير مسموحة.'; end if;
  end loop;
  v_slow := coalesce(v_settings.slow_mode_seconds,0);
  if coalesce(v_settings.adaptive_enabled,true) then
    select count(*)::integer into v_recent from public.live_chat_messages m where m.stream_id=new.stream_id and m.created_at > now()-interval '10 seconds';
    select coalesce(s.viewer_count,0) into v_viewers from public.live_streams s where s.id=new.stream_id;
    if v_recent >= 30 or v_viewers >= 250 then v_slow := greatest(v_slow,5);
    elsif v_recent >= 15 or v_viewers >= 100 then v_slow := greatest(v_slow,3); end if;
  end if;
  if v_slow > 0 and exists(select 1 from public.live_chat_messages m where m.stream_id=new.stream_id and m.sender_id=v_actor and m.created_at > now()-make_interval(secs => v_slow)) then
    raise exception 'تم تفعيل إبطاء التعليقات؛ انتظر قليلًا قبل التعليق مجددًا.';
  end if;
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
drop trigger if exists live_chat_moderation_guard on public.live_chat_messages;
create trigger live_chat_moderation_guard before insert on public.live_chat_messages for each row execute function public.live_guard_chat_insert();

drop policy if exists live_chat_host_hide on public.live_chat_messages;
create policy live_chat_host_hide on public.live_chat_messages for update to authenticated
using (public.live_has_moderation_permission(stream_id,(select auth.uid()),'hide'))
with check (public.live_has_moderation_permission(stream_id,(select auth.uid()),'hide'));

insert into public.live_stream_moderation_settings(stream_id) select id from public.live_streams on conflict(stream_id) do nothing;
