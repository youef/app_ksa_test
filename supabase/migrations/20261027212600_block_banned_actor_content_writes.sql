-- Prevent banned authenticated actors from reading or modifying content.
do $$
declare r record;
begin
 for r in select unnest(array['questions','answers','requests','stories','services','businesses','marketplace_items','live_streams','events','borrow_items','messages','live_chat_messages','story_replies','question_likes','answer_likes','post_reactions','story_likes','follows']) as tbl
 loop
  execute format('drop policy if exists hayna_banned_actor_write_guard on public.%I',r.tbl);
  execute format('create policy hayna_banned_actor_write_guard on public.%I as restrictive for all to authenticated using (public.hayna_account_is_active((select auth.uid()))) with check (public.hayna_account_is_active((select auth.uid())))',r.tbl);
 end loop;
end $$;