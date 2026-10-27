-- Keep removed payloads private for audit; no public role can read this archive.
create table if not exists private.story_moderation_archive (
  id uuid primary key default gen_random_uuid(),
  story_id uuid,
  author_id uuid,
  detected_word text not null,
  source_event text not null,
  payload jsonb not null,
  rejected_payload jsonb,
  removed_at timestamptz not null default now()
);
alter table private.story_moderation_archive enable row level security;
revoke all on private.story_moderation_archive from public, anon, authenticated;

create or replace function private.normalize_story_moderation_text(value text)
returns text language sql immutable set search_path = pg_catalog as $$
  select translate(regexp_replace(lower(coalesce(value, '')),
    U&'[\064B-\065F\0670\0640\200B-\200F\202A-\202E\2060\2066-\2069\FEFF]', '', 'g'),
    'أإآٱىةؤئ', 'اااايهوي');
$$;

create or replace function private.prohibited_story_word(payload jsonb)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare
  normalized text;
  candidate record;
  letters text;
  pattern text;
begin
  normalized := private.normalize_story_moderation_text(concat_ws(' ',
    payload->>'content', payload->>'poll_question', payload->>'question_prompt',
    (select string_agg(option_value, ' ') from jsonb_array_elements_text(
      case when jsonb_typeof(payload->'poll_options') = 'array' then payload->'poll_options' else '[]'::jsonb end
    ) as options(option_value))));
  for candidate in select word from public.banned_words where enabled order by char_length(word) desc loop
    letters := regexp_replace(private.normalize_story_moderation_text(candidate.word), '[^[:alnum:]]', '', 'g');
    if char_length(letters) < 2 then continue; end if;
    select '(^|[^[:alnum:]])' || string_agg(substr(letters, n, 1), '[^[:alnum:]]*') || '([^[:alnum:]]|$)'
      into pattern from generate_series(1, char_length(letters)) n;
    if normalized ~ pattern then return candidate.word; end if;
  end loop;
  return null;
end;
$$;

-- Both paths take the lock before row locks. A simultaneous word-list update
-- cannot leave an unchecked story behind after the new list commits.
create or replace function private.lock_story_moderation()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('hayna_story_moderation', 0));
  return null;
end;
$$;

create or replace function private.guard_story_moderation()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare prohibited text;
begin
  prohibited := private.prohibited_story_word(to_jsonb(new));
  if prohibited is null then return new; end if;
  insert into private.story_moderation_archive(story_id, author_id, detected_word, source_event, payload, rejected_payload)
  values(new.id, new.author_id, prohibited, lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) else to_jsonb(new) end,
    case when tg_op = 'UPDATE' then to_jsonb(new) else null end);
  if tg_op = 'UPDATE' then
    delete from public.notifications where target_type = 'story' and target_id = old.id;
    delete from public.stories where id = old.id;
  end if;
  -- Stop this row before follower notifications or any other INSERT trigger.
  return null;
end;
$$;

create or replace function private.purge_prohibited_stories()
returns integer language plpgsql security definer set search_path = pg_catalog as $$
declare removed_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('hayna_story_moderation', 0));
  with flagged as materialized (
    select s.id, s.author_id, to_jsonb(s) payload, private.prohibited_story_word(to_jsonb(s)) detected_word
    from public.stories s
  ), archived as (
    insert into private.story_moderation_archive(story_id, author_id, detected_word, source_event, payload)
    select id, author_id, detected_word, 'sweep', payload from flagged where detected_word is not null
    returning story_id
  ), removed_notifications as (
    delete from public.notifications where target_type = 'story' and target_id in (select story_id from archived)
  ), removed as (
    delete from public.stories where id in (select story_id from archived) returning id
  ) select count(*) into removed_count from removed;
  return removed_count;
end;
$$;

create or replace function private.sweep_stories_on_word_change()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform private.purge_prohibited_stories();
  return null;
end;
$$;

revoke all on function private.normalize_story_moderation_text(text) from public, anon, authenticated;
revoke all on function private.prohibited_story_word(jsonb) from public, anon, authenticated;
revoke all on function private.lock_story_moderation() from public, anon, authenticated;
revoke all on function private.guard_story_moderation() from public, anon, authenticated;
revoke all on function private.purge_prohibited_stories() from public, anon, authenticated;
revoke all on function private.sweep_stories_on_word_change() from public, anon, authenticated;

drop trigger if exists aa_story_moderation_lock on public.stories;
create trigger aa_story_moderation_lock before insert or update of content, poll_question, poll_options, question_prompt
on public.stories for each statement execute function private.lock_story_moderation();

drop trigger if exists aa_story_content_guard on public.stories;
create trigger aa_story_content_guard before insert or update of content, poll_question, poll_options, question_prompt
on public.stories for each row execute function private.guard_story_moderation();

drop trigger if exists aa_story_word_list_lock on public.banned_words;
create trigger aa_story_word_list_lock before insert or update on public.banned_words
for each statement execute function private.lock_story_moderation();

drop trigger if exists story_word_list_sweep on public.banned_words;
create trigger story_word_list_sweep after insert or update on public.banned_words
for each statement execute function private.sweep_stories_on_word_change();

-- Abort the migration if harmless words are accidentally treated as substrings.
do $$ begin
  if private.prohibited_story_word('{"content":"classic classroom عكس اتجاه السير"}') is not null then
    raise exception 'Story moderation boundary regression';
  end if;
end $$;

select private.purge_prohibited_stories() as removed_prohibited_stories;
