-- Ban visibility is derived from profiles.is_banned; unbanning restores visibility.
create or replace function public.hayna_account_is_active(p_user uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select p_user is not null and exists (
    select 1 from public.profiles p where p.id = p_user and p.is_banned is not true
  );
$$;
revoke all on function public.hayna_account_is_active(uuid) from public;
grant execute on function public.hayna_account_is_active(uuid) to authenticated, anon;
do $$
declare r record;
begin
 for r in select * from (values
 ('questions','author_id'),('answers','author_id'),('requests','requester_id'),
 ('stories','author_id'),('services','provider_id'),('businesses','owner_id'),
 ('marketplace_items','seller_id'),('live_streams','host_id'),('events','organizer_id'),
 ('borrow_items','owner_id'),('messages','sender_id'),('live_chat_messages','sender_id'),
 ('story_replies','sender_id'),('question_likes','user_id'),('answer_likes','user_id'),
 ('post_reactions','user_id'),('story_likes','user_id'),('follows','follower_id')
 ) as t(tbl,col)
 where exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=t.tbl and c.column_name=t.col)
 loop
  execute format('drop policy if exists hayna_banned_content_guard on public.%I',r.tbl);
  execute format('create policy hayna_banned_content_guard on public.%I as restrictive for all to authenticated, anon using (public.hayna_account_is_active(%I)) with check (public.hayna_account_is_active(%I))',r.tbl,r.col,r.col);
 end loop;
end $$;