-- Persist cooldown independently of story deletion; serialize concurrent publishes.
create table if not exists app_private.story_publish_limits (
 author_id uuid primary key references auth.users(id) on delete cascade,
 last_published_at timestamptz not null,
 last_text_hash text,
 last_text_at timestamptz
);
revoke all on app_private.story_publish_limits from public,anon,authenticated;
insert into app_private.story_publish_limits(author_id,last_published_at,last_text_hash,last_text_at)
select distinct on (author_id) author_id,created_at,
 case when nullif(btrim(coalesce(content,'')),'') is not null then encode(extensions.digest(lower(btrim(content)),'sha256'),'hex') end,
 created_at
from public.stories order by author_id,created_at desc
on conflict (author_id) do nothing;
create or replace function public.hayna_story_publish_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_last timestamptz; v_hash text; v_previous_hash text; v_previous_at timestamptz;
begin
 if new.author_id is null then raise exception 'STORY_AUTHOR_REQUIRED' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.author_id::text,0));
 select last_published_at,last_text_hash,last_text_at into v_last,v_previous_hash,v_previous_at
 from app_private.story_publish_limits where author_id=new.author_id for update;
 if v_last is not null and v_last>now()-interval '3 hours' then
  raise exception 'STORY_COOLDOWN_3_HOURS' using errcode='23514';
 end if;
 v_hash:=case when nullif(btrim(coalesce(new.content,'')),'') is not null
 then encode(extensions.digest(lower(btrim(new.content)),'sha256'),'hex') else null end;
 if v_hash is not null and v_hash=v_previous_hash and v_previous_at>now()-interval '24 hours' then
  raise exception 'DUPLICATE_STORY' using errcode='23514';
 end if;
 new.created_at:=now();
 new.expires_at:=now()+interval '24 hours';
 insert into app_private.story_publish_limits(author_id,last_published_at,last_text_hash,last_text_at)
 values(new.author_id,now(),coalesce(v_hash,v_previous_hash),case when v_hash is not null then now() else v_previous_at end)
 on conflict(author_id) do update set last_published_at=excluded.last_published_at,
 last_text_hash=excluded.last_text_hash,last_text_at=excluded.last_text_at;
 return new;
end $$;
revoke all on function public.hayna_story_publish_guard() from public,anon,authenticated;