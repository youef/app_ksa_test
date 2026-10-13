-- A blocked user must be able to see their own block record so RLS-backed
-- checks can reject chat, guest requests, and room tokens without exposing
-- other users' moderation rows.
drop policy if exists live_blocks_user_read_own on public.live_user_blocks;
create policy live_blocks_user_read_own on public.live_user_blocks
  for select to authenticated using (blocked_user_id = (select auth.uid()));
