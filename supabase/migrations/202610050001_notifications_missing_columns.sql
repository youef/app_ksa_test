-- Aligns public.notifications with the columns the app and its triggers already use.
-- The deployed table is missing target_type / target_id / data, which makes the
-- handle_new_message() trigger fail and rolls back every message insert
-- ("column \"target_type\" of relation \"notifications\" does not exist").

alter table public.notifications
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists data jsonb;

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_target_idx
  on public.notifications (target_type, target_id);

-- Rebuild the trigger so an existing (stale) definition cannot keep failing.
create or replace function public.handle_new_message()
returns trigger as $$
declare
  v_receiver uuid;
  v_name text;
begin
  select coalesce(nullif(display_name, ''), username, 'جار')
    into v_name
    from public.profiles where id = new.sender_id;

  for v_receiver in
    select cm.user_id
      from public.conversation_members cm
     where cm.conversation_id = new.conversation_id
       and cm.user_id <> new.sender_id
  loop
    continue when public.has_block_between(new.sender_id, v_receiver);
    continue when public.is_conv_muted(new.conversation_id, v_receiver);
    continue when public.is_dnd_active(v_receiver);

    insert into public.notifications (user_id, title, body, type, target_type, target_id)
    values (
      v_receiver,
      'رسالة جديدة من ' || coalesce(v_name, 'جار'),
      left(new.body, 140),
      'message',
      'conversation',
      new.conversation_id
    );
  end loop;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_new_message on public.messages;
create trigger on_new_message
  after insert on public.messages
  for each row execute procedure public.handle_new_message();