-- Owners can manage their archive; everyone else only sees active, permitted stories.
alter policy stories_select on public.stories using (
  (select auth.uid()) = author_id or (
    coalesce(expires_at, created_at + interval '24 hours') > now() and (
      coalesce(visibility, 'public') = 'public'
      or (visibility = 'followers' and exists (
        select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = author_id
      ))
      or (visibility = 'custom' and (select auth.uid()) = any(coalesce(allowed_user_ids, '{}'::uuid[])))
    )
  )
);
create policy stories_respect_account_privacy on public.stories as restrictive for select to authenticated using (
  (select auth.uid()) = author_id or (
    not ((select auth.uid()) = any(coalesce(hidden_user_ids, '{}'::uuid[])))
    and not exists (select 1 from public.blocks b where
      (b.blocker_id = (select auth.uid()) and b.blocked_id = author_id)
      or (b.blocked_id = (select auth.uid()) and b.blocker_id = author_id))
    and exists (select 1 from public.profiles p where p.id = author_id and (coalesce(p.profile_privacy, 'public') <> 'private'
      or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = author_id)))
  )
);
alter policy stories_update on public.stories with check ((select auth.uid()) = author_id);

create table public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
create index story_likes_user_idx on public.story_likes(user_id);
alter table public.story_likes enable row level security;
revoke all on public.story_likes from public, anon;
grant select, insert, delete on public.story_likes to authenticated;
create policy story_likes_read on public.story_likes for select to authenticated using (
  exists (select 1 from public.stories s where s.id = story_id)
);
create policy story_likes_add on public.story_likes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.stories s where s.id = story_id
    and coalesce(s.expires_at, s.created_at + interval '24 hours') > now())
);
create policy story_likes_remove on public.story_likes for delete to authenticated using (user_id = (select auth.uid()));

-- Reply permissions apply on the server as well as in the viewer.
alter policy story_replies_insert on public.story_replies with check (
  sender_id = (select auth.uid()) and length(btrim(body)) between 1 and 2000 and exists (
    select 1 from public.stories s join public.profiles p on p.id = s.author_id
    where s.id = story_id and s.author_id <> (select auth.uid()) and s.allow_replies
      and coalesce(s.expires_at, s.created_at + interval '24 hours') > now()
      and coalesce(p.allow_story_replies, 'everyone') <> 'nobody'
      and coalesce(p.allow_dms, 'everyone') <> 'nobody'
      and ((coalesce(p.allow_story_replies, 'everyone') <> 'followers' and coalesce(p.allow_dms, 'everyone') <> 'followers')
        or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = s.author_id))
  )
);

-- Apply each follower's notification and mute settings before creating a notification.
create or replace function public.notify_followers_of_story() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author_name text;
begin
  if coalesce(new.visibility, 'public') not in ('public', 'followers') then return new; end if;
  select coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'أحد الجيران') into v_author_name
    from public.profiles p where p.id = new.author_id;
  insert into public.notifications(user_id, type, title, body, data, target_type, target_id)
  select f.follower_id, 'story', 'يومية جديدة', v_author_name || ' شارك يومية جديدة',
    jsonb_build_object('story_id', new.id, 'author_id', new.author_id), 'story', new.id
  from public.follows f
  left join public.story_notification_settings ns on ns.user_id = f.follower_id
  left join public.story_author_preferences ap on ap.user_id = f.follower_id and ap.author_id = new.author_id
  where f.following_id = new.author_id and f.follower_id <> new.author_id
    and coalesce(ns.enabled, true) and coalesce(ap.notifications_enabled, true) and not coalesce(ap.muted, false)
    and not (f.follower_id = any(coalesce(new.hidden_user_ids, '{}'::uuid[])))
    and not exists (select 1 from public.blocks b where
      (b.blocker_id = f.follower_id and b.blocked_id = new.author_id)
      or (b.blocked_id = f.follower_id and b.blocker_id = new.author_id))
    and not exists (select 1 from public.notifications n where n.user_id = f.follower_id and n.type = 'story'
      and n.data ->> 'author_id' = new.author_id::text and n.created_at > now() - interval '24 hours');
  return new;
end;
$$;
revoke all on function public.notify_followers_of_story() from public, anon, authenticated;
