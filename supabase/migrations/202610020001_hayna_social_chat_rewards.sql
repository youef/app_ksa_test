-- Hayna social/chat/rewards hardening
create schema if not exists app_private;

create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  points integer not null,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  unique(user_id,event_type,source_type,source_id)
);
alter table public.reputation_events enable row level security;
revoke all on table public.reputation_events from anon, authenticated;
grant select on table public.reputation_events to authenticated;
drop policy if exists "reputation events own" on public.reputation_events;
create policy "reputation events own" on public.reputation_events for select to authenticated using ((select auth.uid())=user_id);

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  mentioned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(source_type,source_id,mentioned_user_id)
);
alter table public.mentions enable row level security;
revoke all on table public.mentions from anon, authenticated;
grant select on table public.mentions to authenticated;
drop policy if exists "mentions own or mentioned" on public.mentions;
create policy "mentions own or mentioned" on public.mentions for select to authenticated
using ((select auth.uid())=mentioned_user_id or (select auth.uid())=mentioned_by);

create index if not exists idx_reputation_events_user_created on public.reputation_events(user_id,created_at desc);
create index if not exists idx_mentions_mentioned_created on public.mentions(mentioned_user_id,created_at desc);

create or replace function public.hayna_toggle_follow(p_target uuid)
returns boolean language plpgsql security definer set search_path=public,pg_catalog
as $$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'not_authenticated'; end if;
 if p_target is null or p_target=v_uid then raise exception 'invalid_target'; end if;
 if not exists(select 1 from public.profiles where id=p_target) then raise exception 'user_not_found'; end if;
 if exists(select 1 from public.blocks where (blocker_id=v_uid and blocked_id=p_target) or (blocker_id=p_target and blocked_id=v_uid)) then raise exception 'blocked'; end if;
 if exists(select 1 from public.follows where follower_id=v_uid and following_id=p_target) then
   delete from public.follows where follower_id=v_uid and following_id=p_target;
   return false;
 end if;
 insert into public.follows(follower_id,following_id) values(v_uid,p_target) on conflict do nothing;
 return exists(select 1 from public.follows where follower_id=v_uid and following_id=p_target);
end $$;
revoke all on function public.hayna_toggle_follow(uuid) from public,anon;
grant execute on function public.hayna_toggle_follow(uuid) to authenticated;

create or replace function public.hayna_get_or_create_direct_conversation(p_target uuid)
returns uuid language plpgsql security definer set search_path=public,pg_catalog
as $$
declare v_uid uuid := auth.uid(); v_conv uuid;
begin
 if v_uid is null then raise exception 'not_authenticated'; end if;
 if p_target is null or p_target=v_uid then raise exception 'invalid_target'; end if;
 if not exists(select 1 from public.profiles where id=p_target) then raise exception 'user_not_found'; end if;
 if not public.hayna_can_dm(v_uid,p_target) then raise exception 'dm_not_allowed'; end if;
 select c.id into v_conv
 from public.conversations c
 join public.conversation_members a on a.conversation_id=c.id and a.user_id=v_uid
 join public.conversation_members b on b.conversation_id=c.id and b.user_id=p_target
 where not exists(select 1 from public.conversation_members x where x.conversation_id=c.id and x.user_id not in(v_uid,p_target))
 order by c.created_at asc limit 1;
 if v_conv is null then
   perform pg_advisory_xact_lock(hashtextextended(least(v_uid,p_target)::text||':'||greatest(v_uid,p_target)::text,0));
   select c.id into v_conv
   from public.conversations c
   join public.conversation_members a on a.conversation_id=c.id and a.user_id=v_uid
   join public.conversation_members b on b.conversation_id=c.id and b.user_id=p_target
   where not exists(select 1 from public.conversation_members x where x.conversation_id=c.id and x.user_id not in(v_uid,p_target))
   order by c.created_at asc limit 1;
   if v_conv is null then
     insert into public.conversations(created_by) values(v_uid) returning id into v_conv;
     insert into public.conversation_members(conversation_id,user_id) values(v_conv,v_uid),(v_conv,p_target);
   end if;
 end if;
 return v_conv;
end $$;
revoke all on function public.hayna_get_or_create_direct_conversation(uuid) from public,anon;
grant execute on function public.hayna_get_or_create_direct_conversation(uuid) to authenticated;

create or replace function public.hayna_can_message_conversation(p_conversation uuid,p_sender uuid)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $$
 select p_sender is not null
 and exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation and cm.user_id=p_sender)
 and exists(select 1 from public.conversation_members other where other.conversation_id=p_conversation and other.user_id<>p_sender and public.hayna_can_dm(p_sender,other.user_id));
$$;
revoke all on function public.hayna_can_message_conversation(uuid,uuid) from public,anon,authenticated;

drop policy if exists "messages_insert" on public.messages;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages sender insert" on public.messages;
drop policy if exists "messages participants read" on public.messages;
create policy "messages authenticated read allowed conversation" on public.messages for select to authenticated
using ((select public.hayna_can_message_conversation(conversation_id,(select auth.uid()))));
create policy "messages authenticated send allowed conversation" on public.messages for insert to authenticated
with check (sender_id=(select auth.uid()) and (select public.hayna_can_message_conversation(conversation_id,(select auth.uid()))));

drop policy if exists "follows_insert" on public.follows;
drop policy if exists "follows_delete" on public.follows;
drop policy if exists "follows_insert_authenticated" on public.follows;
drop policy if exists "follows_delete_authenticated" on public.follows;
create policy "follows insert authenticated own" on public.follows for insert to authenticated
with check ((select auth.uid())=follower_id and follower_id<>following_id and not exists(
 select 1 from public.blocks b where (b.blocker_id=(select auth.uid()) and b.blocked_id=following_id) or (b.blocker_id=following_id and b.blocked_id=(select auth.uid()))
));
create policy "follows delete authenticated own" on public.follows for delete to authenticated using ((select auth.uid())=follower_id);

revoke all on function public.set_block(uuid,boolean) from public,anon; grant execute on function public.set_block(uuid,boolean) to authenticated;
revoke all on function public.toggle_follow(uuid,boolean) from public,anon,authenticated;

drop policy if exists "blocks_insert" on public.blocks;
drop policy if exists "blocks_delete" on public.blocks;
drop policy if exists "blocks_select" on public.blocks;
create policy "blocks select authenticated own" on public.blocks for select to authenticated using ((select auth.uid())=blocker_id);
create policy "blocks insert authenticated own" on public.blocks for insert to authenticated with check ((select auth.uid())=blocker_id and blocker_id<>blocked_id);
create policy "blocks delete authenticated own" on public.blocks for delete to authenticated using ((select auth.uid())=blocker_id);

drop trigger if exists follows_notify on public.follows;
drop trigger if exists on_new_follow on public.follows;
drop function if exists public.notify_follow();
drop function if exists public.handle_new_follow();

create or replace function app_private.award_reputation(p_user uuid,p_event text,p_points integer,p_source_type text default null,p_source_id uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$
begin
 if p_user is null or p_points=0 then return; end if;
 insert into public.reputation_events(user_id,event_type,points,source_type,source_id)
 values(p_user,p_event,p_points,p_source_type,p_source_id)
 on conflict do nothing;
 if not found then return; end if;
 insert into public.reputation(user_id,points,updated_at) values(p_user,p_points,now())
 on conflict(user_id) do update set points=public.reputation.points+p_points,updated_at=now();
end $$;

create or replace function app_private.handle_follow_reward()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$
begin
 insert into public.notifications(user_id,type,title,body,data)
 values(new.following_id,'follow','متابع جديد','بدأ أحدهم بمتابعتك',jsonb_build_object('follower_id',new.follower_id,'kind','follow'));
 perform app_private.award_reputation(new.following_id,'follow_received',2,'follow',new.id);
 return new;
end $$;
drop trigger if exists trg_follow_reward on public.follows;
create trigger trg_follow_reward after insert on public.follows for each row execute function app_private.handle_follow_reward();

create or replace function app_private.handle_service_reward()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$
begin perform app_private.award_reputation(new.provider_id,'service_published',3,'service',new.id); return new; end $$;
drop trigger if exists trg_service_reward on public.services;
create trigger trg_service_reward after insert on public.services for each row execute function app_private.handle_service_reward();

create or replace function app_private.handle_answer_activity()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$
begin
 insert into public.reputation_events(user_id,event_type,points,source_type,source_id)
 values(new.author_id,'answer_created',5,'answer',new.id) on conflict do nothing;
 if found then
   insert into public.reputation(user_id,answers_count,points,updated_at) values(new.author_id,1,5,now())
   on conflict(user_id) do update set answers_count=public.reputation.answers_count+1,points=public.reputation.points+5,updated_at=now();
 end if;
 return new;
end $$;

create or replace function app_private.handle_best_answer_activity()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$
declare owner_id uuid;
begin
 if new.best_answer_id is distinct from old.best_answer_id and new.best_answer_id is not null then
  select author_id into owner_id from public.answers where id=new.best_answer_id;
  if owner_id is not null then
   insert into public.reputation_events(user_id,event_type,points,source_type,source_id)
   values(owner_id,'best_answer',15,'question',new.id) on conflict do nothing;
   if found then
    insert into public.reputation(user_id,best_answers,points,updated_at) values(owner_id,1,15,now())
    on conflict(user_id) do update set best_answers=public.reputation.best_answers+1,points=public.reputation.points+15,updated_at=now();
   end if;
  end if;
 end if;
 return new;
end $$;

create or replace function app_private.refresh_badges(p_user uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$
declare pts integer := coalesce((select points from public.reputation where user_id=p_user),0); b record;
begin
 for b in select code,min_points from public.badge_definitions where min_points>0 and min_points<=pts loop
  insert into public.profile_badges(user_id,badge_code) values(p_user,b.code) on conflict do nothing;
 end loop;
end $$;
create or replace function app_private.handle_badge_refresh()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$ begin perform app_private.refresh_badges(new.user_id); return new; end $$;
drop trigger if exists trg_refresh_badges on public.reputation;
create trigger trg_refresh_badges after insert or update of points on public.reputation for each row execute function app_private.handle_badge_refresh();

create or replace function public.hayna_parse_mentions(p_source_type text,p_source_id uuid,p_author uuid,p_body text)
returns void language plpgsql security definer set search_path=public,pg_catalog
as $$
declare v_match text; v_user uuid;
begin
 if p_author is null or p_body is null then return; end if;
 for v_match in select distinct lower((m)[1]) from regexp_matches(p_body,'@([[:alnum:]_]+)','g') m loop
  select id into v_user from public.profiles where lower(username)=v_match limit 1;
  if v_user is not null and v_user<>p_author then
   insert into public.mentions(source_type,source_id,mentioned_user_id,mentioned_by) values(p_source_type,p_source_id,v_user,p_author) on conflict do nothing;
   insert into public.notifications(user_id,type,title,body,data)
   values(v_user,'mention','تم ذكرك في إشارة','ذكرك أحد أعضاء الحي في منشور أو رد',jsonb_build_object('source_type',p_source_type,'source_id',p_source_id,'actor_id',p_author,'kind','mention'));
  end if;
 end loop;
end $$;
revoke all on function public.hayna_parse_mentions(text,uuid,uuid,text) from public,anon,authenticated;

create or replace function app_private.trg_parse_question_mentions()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$ begin perform public.hayna_parse_mentions('question',new.id,new.author_id,coalesce(new.body,'')||' '||coalesce(new.title,'')); return new; end $$;
create or replace function app_private.trg_parse_answer_mentions()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$ begin perform public.hayna_parse_mentions('answer',new.id,new.author_id,coalesce(new.body,'')); return new; end $$;
create or replace function app_private.trg_parse_message_mentions()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,app_private
as $$ begin perform public.hayna_parse_mentions('message',new.id,new.sender_id,coalesce(new.body,'')); return new; end $$;
drop trigger if exists trg_parse_question_mentions on public.questions;
create trigger trg_parse_question_mentions after insert on public.questions for each row execute function app_private.trg_parse_question_mentions();
drop trigger if exists trg_parse_answer_mentions on public.answers;
create trigger trg_parse_answer_mentions after insert on public.answers for each row execute function app_private.trg_parse_answer_mentions();
drop trigger if exists trg_parse_message_mentions on public.messages;
create trigger trg_parse_message_mentions after insert on public.messages for each row execute function app_private.trg_parse_message_mentions();

notify pgrst,'reload schema';
