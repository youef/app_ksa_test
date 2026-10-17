-- Story audience privacy and interactive story metadata.
alter table public.stories
  add column if not exists interactive_type text not null default 'none',
  add column if not exists poll_question text,
  add column if not exists poll_options jsonb not null default '["نعم","لا"]'::jsonb,
  add column if not exists question_prompt text,
  add column if not exists font_family text not null default 'System',
  add column if not exists text_rotation numeric not null default 0,
  add column if not exists text_offset_x numeric not null default 0,
  add column if not exists text_offset_y numeric not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stories_visibility_allowed_check') then
    alter table public.stories add constraint stories_visibility_allowed_check
      check (visibility in ('public', 'followers', 'custom'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stories_interactive_type_check') then
    alter table public.stories add constraint stories_interactive_type_check
      check (interactive_type in ('none', 'poll', 'question'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stories_poll_options_check') then
    alter table public.stories add constraint stories_poll_options_check
      check (jsonb_typeof(poll_options) = 'array' and jsonb_array_length(poll_options) = 2);
  end if;
end $$;

drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories
for select to public
using (
  expires_at > now()
  and (
    coalesce(visibility, 'public') = 'public'
    or auth.uid() = author_id
    or (
      coalesce(visibility, 'public') = 'followers'
      and auth.uid() is not null
      and exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = stories.author_id
      )
    )
    or (
      coalesce(visibility, 'public') = 'custom'
      and auth.uid() = any(coalesce(allowed_user_ids, '{}'::uuid[]))
    )
  )
);

create table if not exists public.story_poll_votes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  option_index smallint not null check (option_index in (0, 1)),
  created_at timestamptz not null default now(),
  unique (story_id, voter_id)
);
alter table public.story_poll_votes enable row level security;
drop policy if exists story_poll_votes_select on public.story_poll_votes;
create policy story_poll_votes_select on public.story_poll_votes
for select to authenticated
using (exists (select 1 from public.stories s where s.id = story_id));
drop policy if exists story_poll_votes_insert on public.story_poll_votes;
create policy story_poll_votes_insert on public.story_poll_votes
for insert to authenticated
with check (
  voter_id = (select auth.uid())
  and exists (
    select 1 from public.stories s
    where s.id = story_id and s.interactive_type = 'poll'
  )
);
drop policy if exists story_poll_votes_update on public.story_poll_votes;
create policy story_poll_votes_update on public.story_poll_votes
for update to authenticated
using (voter_id = (select auth.uid()))
with check (
  voter_id = (select auth.uid())
  and exists (
    select 1 from public.stories s
    where s.id = story_id and s.interactive_type = 'poll'
  )
);
grant select, insert, update on public.story_poll_votes to authenticated;

create table if not exists public.story_question_answers (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  responder_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (char_length(btrim(answer)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.story_question_answers enable row level security;
drop policy if exists story_question_answers_select on public.story_question_answers;
create policy story_question_answers_select on public.story_question_answers
for select to authenticated
using (
  responder_id = (select auth.uid())
  or exists (
    select 1 from public.stories s
    where s.id = story_id and s.author_id = (select auth.uid())
  )
);
drop policy if exists story_question_answers_insert on public.story_question_answers;
create policy story_question_answers_insert on public.story_question_answers
for insert to authenticated
with check (
  responder_id = (select auth.uid())
  and exists (
    select 1 from public.stories s
    where s.id = story_id and s.interactive_type = 'question'
  )
);
grant select, insert on public.story_question_answers to authenticated;
