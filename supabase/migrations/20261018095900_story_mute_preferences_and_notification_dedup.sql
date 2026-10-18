-- Enforce muted accounts for all story reads and honor per-author notification preferences.
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
  and (auth.uid() is null or auth.uid() = author_id or not exists (
    select 1 from public.story_author_preferences sap
    where sap.user_id = auth.uid() and sap.author_id = stories.author_id and sap.muted = true
  ))
);

create or replace function public.notify_followers_of_story()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_author_name text;
begin
  if coalesce(new.visibility, 'public') not in ('public', 'followers') then return new; end if;
  select coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'أحد الأشخاص الذين تتابعهم')
    into v_author_name from public.profiles p where p.id = new.author_id;
  insert into public.notifications(user_id, type, title, body, data, target_type, target_id)
  select f.follower_id, 'story', 'قصة جديدة', v_author_name || ' نشر قصة جديدة',
         jsonb_build_object('story_id', new.id, 'author_id', new.author_id), 'story', new.id
  from public.follows f
  left join public.story_notification_settings ns on ns.user_id = f.follower_id
  left join public.story_author_preferences sap on sap.user_id = f.follower_id and sap.author_id = new.author_id
  where f.following_id = new.author_id and f.follower_id <> new.author_id
    and coalesce(ns.enabled, true) and coalesce(sap.notifications_enabled, true)
    and not coalesce(sap.muted, false)
    and not (f.follower_id = any(coalesce(new.hidden_user_ids, '{}'::uuid[])))
    and not exists (select 1 from public.blocks b
      where (b.blocker_id = f.follower_id and b.blocked_id = new.author_id)
         or (b.blocker_id = new.author_id and b.blocked_id = f.follower_id))
    and not exists (select 1 from public.notifications n
      where n.user_id = f.follower_id and n.type = 'story'
        and n.data ->> 'author_id' = new.author_id::text
        and n.created_at > now() - interval '24 hours');
  return new;
end;
$function$;
