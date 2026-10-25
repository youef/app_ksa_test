-- Restrict private messages to authenticated conversation participants.
alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update on public.messages;
drop policy if exists messages_delete on public.messages;
revoke all on public.messages from anon;
revoke truncate, references, trigger on public.messages from authenticated;
grant select, insert, update, delete on public.messages to authenticated;
