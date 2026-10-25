-- Restrict dangerous direct grants on live stream and chat tables.
alter table public.live_streams enable row level security;
alter table public.live_chat_messages enable row level security;
revoke all on public.live_streams from anon;
revoke all on public.live_chat_messages from anon;
grant select on public.live_streams to anon;
grant select on public.live_chat_messages to anon;
revoke truncate, references, trigger, delete on public.live_streams from authenticated;
revoke truncate, references, trigger, delete on public.live_chat_messages from authenticated;
grant select, insert, update, delete on public.live_streams to authenticated;
grant select, insert, update on public.live_chat_messages to authenticated;
