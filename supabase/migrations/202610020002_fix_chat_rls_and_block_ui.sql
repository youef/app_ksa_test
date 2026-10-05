-- Fix production chat RLS and make block state explicit.
grant execute on function public.hayna_can_message_conversation(uuid,uuid) to authenticated;

drop policy if exists "messages authenticated read allowed conversation" on public.messages;
drop policy if exists "messages authenticated send allowed conversation" on public.messages;

create policy "messages authenticated read allowed conversation"
on public.messages for select to authenticated
using (public.hayna_can_message_conversation(conversation_id, auth.uid()));

create policy "messages authenticated send allowed conversation"
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.hayna_can_message_conversation(conversation_id, auth.uid())
);

notify pgrst,'reload schema';
