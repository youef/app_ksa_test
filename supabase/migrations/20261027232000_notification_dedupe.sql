create or replace function public.hayna_dedupe_new_notifications()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.target_id is not null and new.target_type is not null
 and exists(select 1 from public.notifications n where n.user_id=new.user_id and n.type=new.type
 and n.target_type=new.target_type and n.target_id=new.target_id
 and n.read_at is null and n.created_at>now()-interval '10 minutes') then
 return null;
 end if;
 return new;
end $$;
drop trigger if exists hayna_notification_dedupe_insert on public.notifications;
create trigger hayna_notification_dedupe_insert before insert on public.notifications
for each row execute function public.hayna_dedupe_new_notifications();