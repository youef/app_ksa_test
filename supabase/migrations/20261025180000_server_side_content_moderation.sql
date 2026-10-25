-- Apply to Supabase only after reviewing the policy and running staging tests.
-- Server-side moderation: never trust client-side filters to ban accounts.
alter table public.moderation_violations drop constraint if exists moderation_violations_content_type_check;
alter table public.moderation_violations add constraint moderation_violations_content_type_check
check (content_type in ('question','product','message','request','comment','story','live_chat'));

insert into public.banned_words (word,enabled)
select w,true from unnest(array[
'شرموط','شرموطة','قحبة','قحبه','قواد','كس','طيز','زب','نيك','انيك','انْيك','متناك','منيوك','عرص','خنيث','ديوث','قحابي','شراميط','عاهرة','عاهره','ابن القحبة','ابن القحبه','ولد القحبة','ولد القحبه','يا ابن الكلب','يا ابن الكلبه','يا كلب','يا حيوان','يلعن امك','يلعن ابوك','الله يلعنك','fuck','fucking','motherfucker','bitch','asshole','cunt','whore','slut','shit','dickhead','fuckyou','son of a bitch','يا زبالة','يا زباله','يا حقير','يا وسخ','يا نجس','انقلع يا كلب','يا منحط','يا قذر','تفو عليك','fuck off','piece of shit'
]::text[]) as w
on conflict (word) do update set enabled = true;

create or replace function public.hayna_moderate_text_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_text text;
  v_type text;
  v_normalized text;
  v_word text;
  v_found text;
begin
  if tg_table_name = 'questions' then
    v_user := new.author_id;
    v_text := concat_ws(' ', new.title, new.body);
    v_type := 'question';
  elsif tg_table_name = 'messages' then
    v_user := new.sender_id;
    v_text := new.body;
    v_type := 'message';
  elsif tg_table_name = 'stories' then
    v_user := new.author_id;
    v_text := concat_ws(' ', new.content, new.poll_question, new.question_prompt);
    v_type := 'story';
  elsif tg_table_name = 'live_chat_messages' then
    v_user := new.sender_id;
    v_text := new.body;
    v_type := 'live_chat';
  else
    return new;
  end if;

  -- Only moderate content submitted as the signed-in user, not server-side imports.
  if v_user is null or auth.uid() is distinct from v_user then return new; end if;

  if exists (select 1 from public.profiles where id = v_user and is_banned) then
    return null;
  end if;

  v_normalized := ' ' || trim(regexp_replace(
    translate(lower(coalesce(v_text,'')), 'أإآٱىةؤئ', 'اااايهوي'),
    '[^[:alnum:]_]+', ' ', 'g'
  )) || ' ';

  select bw.word into v_found
  from public.banned_words bw
  where bw.enabled = true and length(trim(bw.word)) >= 3
    and position(
      ' ' || trim(regexp_replace(translate(lower(bw.word), 'أإآٱىةؤئ', 'اااايهوي'), '[^[:alnum:]_]+', ' ', 'g')) || ' '
      in v_normalized
    ) > 0
  order by length(bw.word) desc
  limit 1;

  if v_found is not null then
    insert into public.moderation_violations (user_id, content_type, content, detected_word)
    values (v_user, v_type, left(v_text, 2000), v_found);
    update public.profiles set is_banned = true where id = v_user;
    -- Do not raise an exception: that would roll back the ban and audit entry.
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.hayna_moderate_text_before_insert() from public, anon, authenticated;

drop trigger if exists hayna_moderate_questions_insert on public.questions;
create trigger hayna_moderate_questions_insert before insert on public.questions
for each row execute function public.hayna_moderate_text_before_insert();
drop trigger if exists hayna_moderate_messages_insert on public.messages;
create trigger hayna_moderate_messages_insert before insert on public.messages
for each row execute function public.hayna_moderate_text_before_insert();
drop trigger if exists hayna_moderate_stories_insert on public.stories;
create trigger hayna_moderate_stories_insert before insert on public.stories
for each row execute function public.hayna_moderate_text_before_insert();
drop trigger if exists hayna_moderate_live_chat_insert on public.live_chat_messages;
create trigger hayna_moderate_live_chat_insert before insert on public.live_chat_messages
for each row execute function public.hayna_moderate_text_before_insert();
