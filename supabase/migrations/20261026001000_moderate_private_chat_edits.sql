create or replace function public.hayna_guard_message_edit_moderation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_word text; v_normalized text;
begin
 if new.body is not distinct from old.body then return new; end if;
 if auth.uid() is null or auth.uid() is distinct from old.sender_id then
   raise exception 'message_edit_not_authorized' using errcode='42501';
 end if;
 if exists(select 1 from public.profiles where id=old.sender_id and is_banned) then
   raise exception 'account_banned' using errcode='42501';
 end if;
 v_normalized := ' ' || trim(regexp_replace(translate(lower(coalesce(new.body,'')), 'أإآٱىةؤئ','اااايهوي'),'[^[:alnum:]_]+',' ','g')) || ' ';
 select bw.word into v_word from public.banned_words bw where bw.enabled and length(trim(bw.word))>=3
 and position(' ' || trim(regexp_replace(translate(lower(bw.word),'أإآٱىةؤئ','اااايهوي'),'[^[:alnum:]_]+',' ','g')) || ' ' in v_normalized)>0
 order by length(bw.word) desc limit 1;
 if v_word is not null then
   insert into public.moderation_violations(user_id,content_type,content,detected_word)
   values(old.sender_id,'message',left(new.body,2000),v_word);
   update public.profiles set is_banned=true where id=old.sender_id;
   return null;
 end if;
 return new;
end;
$$;
revoke all on function public.hayna_guard_message_edit_moderation() from public,anon,authenticated;
drop trigger if exists hayna_guard_message_edit_moderation on public.messages;
create trigger hayna_guard_message_edit_moderation before update of body on public.messages
for each row execute function public.hayna_guard_message_edit_moderation();