create or replace function public.hayna_can_read_chat_media(p_name text)
returns boolean language sql stable security definer set search_path='' as $media$
 select auth.uid() is not null
 and exists(select 1 from public.profiles where id=auth.uid() and not is_banned)
 and (
  split_part(p_name,'/',1)=auth.uid()::text
  or exists(
   select 1 from public.messages m
   where m.sender_id::text=split_part(p_name,'/',1)
    and public.hayna_is_conversation_member(m.conversation_id,auth.uid())
    and case when pg_catalog.pg_input_is_valid(m.body,'jsonb') then
     m.body::jsonb->>'type'='image' and (
      m.body::jsonb->>'storage_path'=p_name
      or split_part(m.body::jsonb->>'url','?',1)='https://vkeuyompnddqfvulalkk.supabase.co/storage/v1/object/public/chat-media/'||p_name
     )
    else false end
  )
 );
$media$;
revoke all on function public.hayna_can_read_chat_media(text) from public,anon;
grant execute on function public.hayna_can_read_chat_media(text) to authenticated;
alter policy chat_media_select on storage.objects to authenticated
 using(bucket_id='chat-media' and public.hayna_can_read_chat_media(name));
update storage.buckets set public=false where id='chat-media';
