-- Prevent moderators with hide-only permission from changing pinned state or message content.
create or replace function public.live_guard_chat_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_host uuid;
begin
  select s.host_id into v_host from public.live_streams s where s.id=old.stream_id;
  if v_actor is null or not public.live_has_moderation_permission(old.stream_id,v_actor,'hide') then
    raise exception 'ليست لديك صلاحية إدارة هذا التعليق.';
  end if;
  if new.stream_id is distinct from old.stream_id
     or new.sender_id is distinct from old.sender_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at
     or new.sender_role is distinct from old.sender_role then
    raise exception 'لا يمكن تعديل محتوى التعليق.';
  end if;
  if new.is_pinned is distinct from old.is_pinned and v_actor is distinct from v_host then
    raise exception 'تثبيت التعليقات متاح للمضيف فقط.';
  end if;
  if new.is_hidden is distinct from old.is_hidden and not public.live_has_moderation_permission(old.stream_id,v_actor,'hide') then
    raise exception 'ليست لديك صلاحية إخفاء التعليقات.';
  end if;
  return new;
end;
$$;
revoke all on function public.live_guard_chat_update() from public, anon, authenticated;
drop trigger if exists live_chat_moderation_update_guard on public.live_chat_messages;
create trigger live_chat_moderation_update_guard before update on public.live_chat_messages
for each row execute function public.live_guard_chat_update();
