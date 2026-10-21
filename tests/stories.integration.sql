-- Transactional RLS smoke test. All fixtures and triggered notifications roll back.
begin;
do $$
declare owner_id uuid; viewer_id uuid;
begin
  select a.id,b.id into owner_id,viewer_id from public.profiles a cross join public.profiles b
  where a.id<>b.id and coalesce(a.profile_privacy,'public')='public'
    and coalesce(a.allow_story_replies,'everyone')='everyone' and coalesce(a.allow_dms,'everyone')='everyone'
    and not exists(select 1 from public.blocks x where (x.blocker_id=a.id and x.blocked_id=b.id) or (x.blocker_id=b.id and x.blocked_id=a.id))
    and not exists(select 1 from public.follows f where f.follower_id=b.id and f.following_id=a.id)
    and not exists(select 1 from public.notifications n where n.user_id=b.id and n.type='story' and n.data->>'author_id'=a.id::text and n.created_at>now()-interval '24 hours')
  limit 1;
  if owner_id is null then raise exception 'Need two eligible existing members for this test'; end if;
  perform set_config('storyqa.owner',owner_id::text,true);
  perform set_config('storyqa.viewer',viewer_id::text,true);
  perform set_config('storyqa.active',gen_random_uuid()::text,true);
  perform set_config('storyqa.archive',gen_random_uuid()::text,true);
  perform set_config('storyqa.hidden',gen_random_uuid()::text,true);
  perform set_config('storyqa.followers',gen_random_uuid()::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated','is_anonymous',false)::text,true);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
end $$;
set local role authenticated;
insert into public.stories(id,author_id,type,content,expires_at,visibility,hidden_user_ids) values
 (current_setting('storyqa.active')::uuid,current_setting('storyqa.owner')::uuid,'text','Transactional story QA',now()+interval '1 hour','public','{}'),
 (current_setting('storyqa.archive')::uuid,current_setting('storyqa.owner')::uuid,'text','Transactional archive QA',now()-interval '1 hour','public','{}'),
 (current_setting('storyqa.hidden')::uuid,current_setting('storyqa.owner')::uuid,'text','Transactional hidden QA',now()+interval '1 hour','public',array[current_setting('storyqa.viewer')::uuid]),
 (current_setting('storyqa.followers')::uuid,current_setting('storyqa.owner')::uuid,'text','Transactional follower QA',now()+interval '1 hour','followers','{}');
do $$ begin
  if not exists(select 1 from public.stories where id=current_setting('storyqa.archive')::uuid) then raise exception 'Owner archive access failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('storyqa.viewer'),'role','authenticated','is_anonymous',false)::text,true);
select set_config('request.jwt.claim.sub',current_setting('storyqa.viewer'),true);
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.stories where id=current_setting('storyqa.active')::uuid) then raise exception 'Public story is not visible to member'; end if;
  if exists(select 1 from public.stories where id=current_setting('storyqa.archive')::uuid) then raise exception 'Archive leaked'; end if;
  if exists(select 1 from public.stories where id=current_setting('storyqa.hidden')::uuid) then raise exception 'Hidden story leaked'; end if;
  if exists(select 1 from public.stories where id=current_setting('storyqa.followers')::uuid) then raise exception 'Followers-only story leaked'; end if;
end $$;
insert into public.story_likes(story_id,user_id) values(current_setting('storyqa.active')::uuid,current_setting('storyqa.viewer')::uuid);
do $$ begin
  begin
    insert into public.story_likes(story_id,user_id) values(current_setting('storyqa.active')::uuid,current_setting('storyqa.viewer')::uuid);
    raise exception 'Duplicate like accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.story_likes(story_id,user_id) values(current_setting('storyqa.active')::uuid,current_setting('storyqa.owner')::uuid);
    raise exception 'Forged like accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.story_likes(story_id,user_id) values(current_setting('storyqa.hidden')::uuid,current_setting('storyqa.viewer')::uuid);
    raise exception 'Hidden story like accepted';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.story_replies(story_id,sender_id,body) values(current_setting('storyqa.active')::uuid,current_setting('storyqa.viewer')::uuid,'Transactional reply QA');
do $$ begin
  if not exists(select 1 from public.story_replies r join public.messages m on m.conversation_id=r.conversation_id
    where r.story_id=current_setting('storyqa.active')::uuid and m.sender_id=(select auth.uid()) and m.body='↩️ رد على قصتك: Transactional reply QA')
    then raise exception 'Reply did not reach conversation'; end if;
end $$;
delete from public.story_likes where story_id=current_setting('storyqa.active')::uuid and user_id=current_setting('storyqa.viewer')::uuid;
insert into public.follows(follower_id,following_id) values(current_setting('storyqa.viewer')::uuid,current_setting('storyqa.owner')::uuid);
do $$ begin
  if not exists(select 1 from public.stories where id=current_setting('storyqa.followers')::uuid) then raise exception 'Follower could not view follower story'; end if;
end $$;
reset role;
-- Check each notification preference against the real publishing trigger, without committing.
insert into public.story_notification_settings(user_id,enabled) values(current_setting('storyqa.viewer')::uuid,false) on conflict(user_id) do update set enabled=false;
insert into public.story_author_preferences(user_id,author_id,notifications_enabled,muted) values(current_setting('storyqa.viewer')::uuid,current_setting('storyqa.owner')::uuid,true,false) on conflict(user_id,author_id) do update set notifications_enabled=true,muted=false;
do $$ declare story_id uuid; begin
  insert into public.stories(author_id,type,content) values(current_setting('storyqa.owner')::uuid,'text','Global notifications off QA') returning id into story_id;
  if exists(select 1 from public.notifications where user_id=current_setting('storyqa.viewer')::uuid and target_id=story_id) then raise exception 'Global notification preference ignored'; end if;
  update public.story_notification_settings set enabled=true where user_id=current_setting('storyqa.viewer')::uuid;
  update public.story_author_preferences set notifications_enabled=false where user_id=current_setting('storyqa.viewer')::uuid and author_id=current_setting('storyqa.owner')::uuid;
  insert into public.stories(author_id,type,content) values(current_setting('storyqa.owner')::uuid,'text','Author notifications off QA') returning id into story_id;
  if exists(select 1 from public.notifications where user_id=current_setting('storyqa.viewer')::uuid and target_id=story_id) then raise exception 'Author notification preference ignored'; end if;
  update public.story_author_preferences set notifications_enabled=true,muted=true where user_id=current_setting('storyqa.viewer')::uuid and author_id=current_setting('storyqa.owner')::uuid;
  insert into public.stories(author_id,type,content) values(current_setting('storyqa.owner')::uuid,'text','Muted author QA') returning id into story_id;
  if exists(select 1 from public.notifications where user_id=current_setting('storyqa.viewer')::uuid and target_id=story_id) then raise exception 'Muted author preference ignored'; end if;
  update public.story_author_preferences set muted=false where user_id=current_setting('storyqa.viewer')::uuid and author_id=current_setting('storyqa.owner')::uuid;
  insert into public.stories(author_id,type,content) values(current_setting('storyqa.owner')::uuid,'text','Allowed notification QA') returning id into story_id;
  if not exists(select 1 from public.notifications where user_id=current_setting('storyqa.viewer')::uuid and target_id=story_id) then raise exception 'Allowed story notification missing'; end if;
end $$;
update public.stories set allow_replies=false where id=current_setting('storyqa.active')::uuid;
set local role authenticated;
do $$ begin
  begin
    insert into public.story_replies(story_id,sender_id,body) values(current_setting('storyqa.active')::uuid,current_setting('storyqa.viewer')::uuid,'Must be rejected');
    raise exception 'Disabled story reply accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.stories set allow_replies=true where id=current_setting('storyqa.active')::uuid;
select set_config('request.jwt.claim.sub',current_setting('storyqa.owner'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('storyqa.owner'),'role','authenticated','is_anonymous',false)::text,true);
update public.profiles set allow_story_replies='nobody' where id=current_setting('storyqa.owner')::uuid;
select set_config('request.jwt.claim.sub',current_setting('storyqa.viewer'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('storyqa.viewer'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $$ begin
  begin
    insert into public.story_replies(story_id,sender_id,body) values(current_setting('storyqa.active')::uuid,current_setting('storyqa.viewer')::uuid,'Account replies disabled QA');
    raise exception 'Account reply policy ignored';
  exception when insufficient_privilege then null; end;
end $$;
delete from public.follows where follower_id=current_setting('storyqa.viewer')::uuid and following_id=current_setting('storyqa.owner')::uuid;
reset role;
select set_config('request.jwt.claim.sub',current_setting('storyqa.owner'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('storyqa.owner'),'role','authenticated','is_anonymous',false)::text,true);
update public.profiles set profile_privacy='private' where id=current_setting('storyqa.owner')::uuid;
select set_config('request.jwt.claim.sub',current_setting('storyqa.viewer'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('storyqa.viewer'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.stories where id=current_setting('storyqa.active')::uuid) then raise exception 'Private account story leaked'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  if exists(select 1 from public.stories where id=current_setting('storyqa.active')::uuid) then raise exception 'Guest story access accepted'; end if;
end $$;
reset role;
rollback;
select 'PASS: archive ownership; public/follower/private/hidden/guest visibility; likes and unlike; duplicate/forged likes denied; DM reply delivery; per-story and account reply settings; global, author, muted and enabled story notifications. All fixtures rolled back.' as result;
