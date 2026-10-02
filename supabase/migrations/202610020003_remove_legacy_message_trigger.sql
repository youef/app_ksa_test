-- Remove legacy message notification trigger that writes obsolete notification columns.
drop trigger if exists on_new_message on public.messages;
drop function if exists public.handle_new_message();
notify pgrst,'reload schema';
