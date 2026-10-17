-- Story quality, view deduplication, audience exclusions and follower notifications.
alter table public.stories
  add column if not exists hidden_user_ids uuid[] not null default '{}'::uuid[];

create table if not exists public.story_notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.story_notification_settings enable row level security;
drop policy if exists story_notification_settings_select_own on public.story_notification_settings;
create policy story_notification_settings_select_own on public.story_notification_settings for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists story_notification_settings_insert_own on public.story_notification_settings;
create policy story_notification_settings_insert_own on public.story_notification_settings for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists story_notification_settings_update_own on public.story_notification_settings;
create policy story_notification_settings_update_own on public.story_notification_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.story_notification_settings to authenticated;

with ranked as (
  select id, row_number() over (partition by story_id, viewer_id order by viewed_at asc nulls last, id) rn from public.story_views
)
delete from public.story_views v using ranked r where v.id = r.id and r.rn > 1;
create unique index if not exists story_views_story_viewer_unique on public.story_views(story_id, viewer_id);
create index if not exists story_views_story_viewed_at_idx on public.story_views(story_id, viewed_at desc);

create or replace function public.record_story_view(p_story_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_viewer uuid := auth.uid(); v_inserted integer := 0;
begin
  if v_viewer is null then return false; end if;
  insert into public.story_views(story_id, viewer_id, viewed_at)
  select s.id, v_viewer, now() from public.stories s
  where s.id = p_story_id and s.author_id <> v_viewer and s.expires_at > now()
    and not (v_viewer = any(coalesce(s.hidden_user_ids, '{}'::uuid[])))
  on conflict (story_id, viewer_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.stories set view_count = coalesce(view_count, 0) + 1 where id = p_story_id;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.record_story_view(uuid) from public;
grant execute on function public.record_story_view(uuid) to authenticated;

drop policy if exists story_views_select on public.story_views;
drop policy if exists story_views_select_owner_or_self on public.story_views;
create policy story_views_select_owner_or_self on public.story_views for select to authenticated
using (viewer_id = (select auth.uid()) or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid())));
drop policy if exists story_views_insert on public.story_views;
drop policy if exists story_views_insert_self on public.story_views;
revoke insert, update, delete on public.story_views from authenticated;

create or replace function public.notify_followers_of_story()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_author_name text;
begin
  if coalesce(new.visibility, 'public') not in ('public', 'followers') then return new; end if;
  select coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'أحد الأشخاص الذين تتابعهم')
    into v_author_name from public.profiles p where p.id = new.author_id;
  insert into public.notifications(user_id, type, title, body, data, target_type, target_id)
  select f.follower_id, 'story', 'قصة جديدة', v_author_name || ' نشر قصة جديدة',
         jsonb_build_object('story_id', new.id, 'author_id', new.author_id), 'story', new.id
  from public.follows f
  left join public.story_notification_settings ns on ns.user_id = f.follower_id
  where f.following_id = new.author_id and f.follower_id <> new.author_id
    and coalesce(ns.enabled, true)
    and not (f.follower_id = any(coalesce(new.hidden_user_ids, '{}'::uuid[])))
    and not exists (
      select 1 from public.notifications n where n.user_id = f.follower_id and n.type = 'story'
        and n.data ->> 'author_id' = new.author_id::text and n.created_at > now() - interval '24 hours'
    );
  return new;
end;
$$;
drop trigger if exists stories_notify_followers on public.stories;
create trigger stories_notify_followers after insert on public.stories for each row execute function public.notify_followers_of_story();

drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories for select to public using (
  expires_at > now()
  and not (auth.uid() = any(coalesce(hidden_user_ids, '{}'::uuid[])))
  and (
    coalesce(visibility, 'public') = 'public' or auth.uid() = author_id
    or (coalesce(visibility, 'public') = 'followers' and auth.uid() is not null
      and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = stories.author_id))
    or (coalesce(visibility, 'public') = 'custom' and auth.uid() = any(coalesce(allowed_user_ids, '{}'::uuid[])))
  )
);
