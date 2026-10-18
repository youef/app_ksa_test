-- Per-account story notification/mute controls, user-submitted story reports, and block-aware story visibility.
create table if not exists public.story_author_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_author_preferences_pair_unique unique (user_id, author_id),
  constraint story_author_preferences_no_self check (user_id <> author_id)
);
alter table public.story_author_preferences enable row level security;
drop policy if exists story_author_preferences_select_own on public.story_author_preferences;
create policy story_author_preferences_select_own on public.story_author_preferences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists story_author_preferences_insert_own on public.story_author_preferences;
create policy story_author_preferences_insert_own on public.story_author_preferences for insert to authenticated with check ((select auth.uid()) = user_id and user_id <> author_id);
drop policy if exists story_author_preferences_update_own on public.story_author_preferences;
create policy story_author_preferences_update_own on public.story_author_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and user_id <> author_id);
drop policy if exists story_author_preferences_delete_own on public.story_author_preferences;
create policy story_author_preferences_delete_own on public.story_author_preferences for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists story_author_preferences_user_idx on public.story_author_preferences(user_id);
create index if not exists story_author_preferences_author_idx on public.story_author_preferences(author_id);

create table if not exists public.story_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','inappropriate','misinformation','other')),
  details text,
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  constraint story_reports_not_self check (reporter_id <> author_id)
);
alter table public.story_reports enable row level security;
drop policy if exists story_reports_insert_own on public.story_reports;
create policy story_reports_insert_own on public.story_reports for insert to authenticated with check (
  reporter_id = (select auth.uid()) and reporter_id <> author_id
  and exists (select 1 from public.stories s where s.id = story_id and s.author_id = author_id)
);
drop policy if exists story_reports_select_own on public.story_reports;
create policy story_reports_select_own on public.story_reports for select to authenticated using (reporter_id = (select auth.uid()));
create index if not exists story_reports_status_created_idx on public.story_reports(status, created_at desc);
create index if not exists story_reports_story_idx on public.story_reports(story_id);

drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories for select using (
  expires_at > now()
  and ((auth.uid() is null) or not (auth.uid() = any(coalesce(hidden_user_ids, '{}'::uuid[]))))
  and (
    coalesce(visibility, 'public') = 'public'
    or auth.uid() = author_id
    or (coalesce(visibility, 'public') = 'followers' and auth.uid() is not null
      and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = stories.author_id))
    or (coalesce(visibility, 'public') = 'custom' and auth.uid() = any(coalesce(allowed_user_ids, '{}'::uuid[])))
  )
  and (auth.uid() is null or auth.uid() = author_id or not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = stories.author_id)
       or (b.blocker_id = stories.author_id and b.blocked_id = auth.uid())
  ))
);
