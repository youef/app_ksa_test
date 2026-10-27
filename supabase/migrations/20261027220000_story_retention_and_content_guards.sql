create or replace function public.hayna_story_publish_guard() returns trigger language plpgsql set search_path = '' as $$
begin
 if exists(select 1 from public.stories s where s.author_id=new.author_id and s.created_at>now()-interval '3 hours') then
 raise exception 'STORY_COOLDOWN_3_HOURS' using errcode='23514'; end if;
 if nullif(btrim(coalesce(new.content,'')),'') is not null and exists(select 1 from public.stories s where s.author_id=new.author_id and lower(btrim(coalesce(s.content,'')))=lower(btrim(new.content)) and s.created_at>now()-interval '24 hours') then
 raise exception 'DUPLICATE_STORY' using errcode='23514'; end if;
 new.expires_at := now()+interval '24 hours'; return new;
end $$;
drop trigger if exists hayna_story_publish_guard on public.stories;
create trigger hayna_story_publish_guard before insert on public.stories for each row execute function public.hayna_story_publish_guard();
create or replace function public.hayna_question_repeat_guard() returns trigger language plpgsql set search_path = '' as $$
begin
 if exists(select 1 from public.questions q where q.author_id=new.author_id and lower(regexp_replace(btrim(coalesce(q.title,'')||' '||coalesce(q.body,'')),'\s+',' ','g')) = lower(regexp_replace(btrim(coalesce(new.title,'')||' '||coalesce(new.body,'')),'\s+',' ','g')) and q.created_at>now()-interval '24 hours') then raise exception 'DUPLICATE_QUESTION' using errcode='23514'; end if; return new;
end $$;
drop trigger if exists hayna_question_repeat_guard on public.questions;
create trigger hayna_question_repeat_guard before insert on public.questions for each row execute function public.hayna_question_repeat_guard();
create or replace function public.hayna_username_guard() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.username is distinct from old.username then
 if old.username_last_changed_at is not null and old.username_last_changed_at>now()-interval '3 months' then raise exception 'USERNAME_COOLDOWN_3_MONTHS' using errcode='23514'; end if;
 if new.username is null or new.username !~ '^[a-zA-Z0-9_]{3,30}$' then raise exception 'INVALID_USERNAME' using errcode='23514'; end if;
 new.username:=lower(new.username); new.username_last_changed_at:=now(); end if; return new;
end $$;
drop trigger if exists hayna_username_guard on public.profiles;
create trigger hayna_username_guard before update of username on public.profiles for each row execute function public.hayna_username_guard();
create unique index if not exists hayna_username_unique_ci on public.profiles(lower(username)) where username is not null;
create unique index if not exists hayna_profile_contact_phone_unique on public.profile_contact_numbers(regexp_replace(phone,'[^0-9]','','g')) where phone is not null;
create or replace function public.hayna_purge_expired_stories() returns void language plpgsql security definer set search_path = '' as $$
begin delete from public.stories where expires_at<=now() or created_at<=now()-interval '24 hours'; end $$;
revoke all on function public.hayna_purge_expired_stories() from public,anon,authenticated;
select cron.schedule('hayna-expired-stories-15min','*/15 * * * *','select public.hayna_purge_expired_stories()');